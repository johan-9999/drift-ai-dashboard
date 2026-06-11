// Python source shown in the ML Engine "Code" tab.
// These are illustrative reference implementations of the models the demo simulates.

export const PY_FILES = [
  {
    name: "failure_prediction.py",
    title: "Failure Prediction — XGBoost",
    desc: "Gradient-boosted classifier that estimates per-cell failure probability from live telemetry features.",
    code: `"""Drift AI — per-cell failure prediction (XGBoost).

Predicts P(failure within 15 min) for each radio cell from
a 6-feature telemetry vector sampled every 10 seconds.
"""

import joblib
import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import TimeSeriesSplit

FEATURES = [
    "signal_dbm",        # mean RSRP across attached UEs
    "device_count",      # active RRC-connected UEs
    "throughput_gbps",   # cell aggregate throughput
    "error_rate_pct",    # BLER / packet error rate
    "interference_dbm",  # uplink noise floor
    "cpu_load_pct",      # baseband unit CPU
]
LABEL = "failed_within_15m"


class FailurePredictor:
    def __init__(self) -> None:
        self.model = xgb.XGBClassifier(
            n_estimators=400,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            scale_pos_weight=24.0,   # failures are rare (~4%)
            eval_metric="aucpr",
            early_stopping_rounds=30,
        )

    def train(self, df: pd.DataFrame) -> dict:
        """Time-ordered split — never let the model peek at the future."""
        X, y = df[FEATURES], df[LABEL]
        cv = TimeSeriesSplit(n_splits=5)
        scores = []
        for train_idx, val_idx in cv.split(X):
            self.model.fit(
                X.iloc[train_idx], y.iloc[train_idx],
                eval_set=[(X.iloc[val_idx], y.iloc[val_idx])],
                verbose=False,
            )
            proba = self.model.predict_proba(X.iloc[val_idx])[:, 1]
            scores.append({
                "auc": roc_auc_score(y.iloc[val_idx], proba),
                "aucpr": average_precision_score(y.iloc[val_idx], proba),
            })
        return pd.DataFrame(scores).mean().to_dict()

    def predict(self, telemetry: dict) -> float:
        """Single-cell inference — called by the streaming scorer."""
        x = np.array([[telemetry[f] for f in FEATURES]])
        return float(self.model.predict_proba(x)[0, 1])

    def feature_importance(self) -> pd.Series:
        booster = self.model.get_booster()
        gain = booster.get_score(importance_type="gain")
        s = pd.Series(gain).reindex(FEATURES).fillna(0.0)
        return s / s.sum()

    def save(self, path: str = "models/failure_xgb.joblib") -> None:
        joblib.dump(self.model, path)
`,
  },
  {
    name: "rl_optimizer.py",
    title: "RL Optimizer — Stable-Baselines3 PPO",
    desc: "Reinforcement-learning agent that tunes transmit power, handover bias, and slice bandwidth to maximize QoS per watt.",
    code: `"""Drift AI — RAN parameter optimizer (PPO, Stable-Baselines3).

The agent continuously tunes per-cell knobs. Reward balances
throughput and latency SLAs against energy draw.
"""

import gymnasium as gym
import numpy as np
from gymnasium import spaces
from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import SubprocVecEnv


class RanOptimizationEnv(gym.Env):
    """One step = one 10-second network telemetry window."""

    def __init__(self, sim):
        super().__init__()
        self.sim = sim  # digital-twin network simulator
        # observation: 6 telemetry features x 4 cells, normalized
        self.observation_space = spaces.Box(-1.0, 1.0, shape=(24,))
        # actions per cell: tx power delta (dB), handover bias
        # delta (dB), URLLC slice bandwidth share delta
        self.action_space = spaces.Box(-1.0, 1.0, shape=(12,))

    def step(self, action):
        self.sim.apply(
            tx_power_delta=action[0::3] * 2.0,      # +/- 2 dB
            handover_bias_delta=action[1::3] * 1.5, # +/- 1.5 dB
            slice_bw_delta=action[2::3] * 0.05,     # +/- 5%
        )
        obs = self.sim.observe()
        reward = self._reward(self.sim.kpis())
        return obs, reward, False, False, {}

    def _reward(self, k) -> float:
        sla_latency = np.clip((10.0 - k.p99_latency_ms) / 10.0, -1, 1)
        sla_tput = np.clip(k.throughput_gbps / k.demand_gbps, 0, 1)
        energy_penalty = 0.15 * (k.power_kw / k.baseline_power_kw - 1.0)
        drop_penalty = 4.0 * k.drop_rate_pct / 100.0
        return 0.5 * sla_latency + 0.5 * sla_tput - energy_penalty - drop_penalty

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        return self.sim.reset(), {}


def train(total_steps: int = 5_000_000) -> PPO:
    env = SubprocVecEnv([lambda: RanOptimizationEnv(make_sim()) for _ in range(8)])
    model = PPO(
        "MlpPolicy", env,
        learning_rate=3e-4,
        n_steps=2048,
        batch_size=256,
        gamma=0.997,           # long-horizon: energy savings compound
        ent_coef=0.005,
        tensorboard_log="runs/ran_ppo",
    )
    model.learn(total_timesteps=total_steps)
    model.save("models/ran_ppo")
    return model
`,
  },
  {
    name: "anomaly_detection.py",
    title: "Anomaly Detection — Isolation Forest",
    desc: "Unsupervised detector that flags abnormal telemetry windows without needing labeled failures.",
    code: `"""Drift AI — telemetry anomaly detection (Isolation Forest).

Catches failure modes the supervised model has never seen:
no labels required, scores every 10-second window per cell.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import RobustScaler

WINDOW = 30  # rolling feature window (5 min of 10s samples)


def engineer_window_features(df: pd.DataFrame) -> pd.DataFrame:
    """Raw telemetry -> rolling stats the forest scores."""
    feats = {}
    for col in ["signal_dbm", "throughput_gbps", "error_rate_pct",
                "interference_dbm", "cpu_load_pct", "device_count"]:
        r = df[col].rolling(WINDOW, min_periods=WINDOW // 2)
        feats[f"{col}_mean"] = r.mean()
        feats[f"{col}_std"] = r.std()
        feats[f"{col}_slope"] = r.apply(
            lambda w: np.polyfit(np.arange(len(w)), w, 1)[0], raw=True
        )
    return pd.DataFrame(feats).dropna()


class TelemetryAnomalyDetector:
    def __init__(self, contamination: float = 0.01):
        self.scaler = RobustScaler()  # telemetry has heavy tails
        self.forest = IsolationForest(
            n_estimators=300,
            contamination=contamination,
            max_samples=0.7,
            n_jobs=-1,
            random_state=7,
        )

    def fit(self, healthy_telemetry: pd.DataFrame) -> None:
        """Train on known-healthy weeks only."""
        X = engineer_window_features(healthy_telemetry)
        self.forest.fit(self.scaler.fit_transform(X))

    def score(self, recent: pd.DataFrame) -> pd.Series:
        """Returns anomaly score in [0, 1]; > 0.6 raises an alert."""
        X = engineer_window_features(recent)
        raw = self.forest.score_samples(self.scaler.transform(X))
        # score_samples: lower = more anomalous. Map to [0, 1].
        return pd.Series(
            np.clip((raw.mean() - raw) / 0.35, 0.0, 1.0), index=X.index
        )

    def explain(self, window: pd.Series) -> list[str]:
        """Rank features by deviation for the alert payload."""
        z = (window - window.mean()) / (window.std() + 1e-9)
        return z.abs().sort_values(ascending=False).head(3).index.tolist()
`,
  },
  {
    name: "train_pipeline.py",
    title: "Training Pipeline — Orchestration",
    desc: "Nightly pipeline: pulls telemetry, engineers features, retrains all three models, validates, and promotes to the registry.",
    code: `"""Drift AI — nightly model training pipeline.

Telemetry lake -> features -> train -> validate -> registry.
Runs at 02:00 UTC; promotion requires beating the champion.
"""

from datetime import datetime, timedelta

import mlflow
import pandas as pd

from anomaly_detection import TelemetryAnomalyDetector
from failure_prediction import FailurePredictor
from feature_store import build_features, load_telemetry

CHAMPION_METRIC = "aucpr"
MIN_IMPROVEMENT = 0.005   # don't churn models for noise


def run(lookback_days: int = 90) -> None:
    since = datetime.utcnow() - timedelta(days=lookback_days)

    # 1. Extract — raw telemetry from the lake (10s resolution)
    raw = load_telemetry(since=since, sites=["DRF-EDGE-01..04"])

    # 2. Feature engineering + labeling (15-min failure horizon)
    df = build_features(raw, label_horizon_min=15)
    train_df, holdout_df = df[df.ts < df.ts.quantile(0.85)], df[df.ts >= df.ts.quantile(0.85)]

    with mlflow.start_run(run_name=f"nightly-{datetime.utcnow():%Y%m%d}"):
        # 3. Train challenger models
        predictor = FailurePredictor()
        cv_metrics = predictor.train(train_df)
        mlflow.log_metrics({f"cv_{k}": v for k, v in cv_metrics.items()})

        detector = TelemetryAnomalyDetector()
        detector.fit(train_df[train_df.failed_within_15m == 0])

        # 4. Validate on untouched holdout (most recent 15%)
        holdout = evaluate(predictor, holdout_df)
        mlflow.log_metrics({f"holdout_{k}": v for k, v in holdout.items()})

        # 5. Champion/challenger gate -> registry
        champion = current_champion_metric(CHAMPION_METRIC)
        if holdout[CHAMPION_METRIC] >= champion + MIN_IMPROVEMENT:
            mlflow.sklearn.log_model(predictor.model, "failure_xgb",
                                     registered_model_name="drift-failure-predictor")
            mlflow.sklearn.log_model(detector.forest, "anomaly_iforest",
                                     registered_model_name="drift-anomaly-detector")
            promote_to_staging("drift-failure-predictor")
            notify("#noc-ml", f"Promoted challenger: {CHAMPION_METRIC} "
                              f"{champion:.3f} -> {holdout[CHAMPION_METRIC]:.3f}")
        else:
            notify("#noc-ml", "Challenger did not beat champion; keeping current model.")


def evaluate(predictor, df: pd.DataFrame) -> dict:
    proba = df.apply(lambda r: predictor.predict(r.to_dict()), axis=1)
    from sklearn.metrics import average_precision_score, roc_auc_score
    return {
        "auc": roc_auc_score(df.failed_within_15m, proba),
        "aucpr": average_precision_score(df.failed_within_15m, proba),
    }


if __name__ == "__main__":
    run()
`,
  },
];

export const TRAINING_STEPS = [
  {
    n: 1,
    title: "Telemetry Collection",
    desc: "Every radio, baseband unit, and core function streams metrics at 10-second resolution into the telemetry lake — signal, throughput, errors, interference, and compute load, tagged by cell and site.",
    snippet: `raw = load_telemetry(
    since=now() - timedelta(days=90),
    sites=["DRF-EDGE-01..04"],
    resolution="10s",
)  # ~78M rows / 90 days`,
  },
  {
    n: 2,
    title: "Feature Engineering & Labeling",
    desc: "Raw counters become model features: rolling means, variances, and slopes over 5-minute windows. Historical outages are back-labeled so each window knows whether a failure followed within 15 minutes.",
    snippet: `df = build_features(raw, label_horizon_min=15)
# signal_dbm_slope, error_rate_pct_std, ...
# label: failed_within_15m (4.1% positive)`,
  },
  {
    n: 3,
    title: "Model Training",
    desc: "Three models learn in parallel: XGBoost predicts failure probability from labeled history, Isolation Forest learns the shape of healthy telemetry to catch novel faults, and a PPO agent trains in a digital-twin simulator to optimize RAN parameters.",
    snippet: `predictor.train(train_df)        # XGBoost, TimeSeriesSplit CV
detector.fit(healthy_windows)    # Isolation Forest, no labels
ppo.learn(total_timesteps=5e6)   # PPO in digital twin`,
  },
  {
    n: 4,
    title: "Validation & Champion Gate",
    desc: "Challenger models are scored on the most recent 15% of data they never saw. A challenger only replaces the production champion if it improves precision-recall AUC by a meaningful margin — no churn on noise.",
    snippet: `if holdout["aucpr"] >= champion + 0.005:
    promote_to_staging("drift-failure-predictor")
else:
    keep_champion()`,
  },
  {
    n: 5,
    title: "Deployment & Continuous Learning",
    desc: "Promoted models roll out to edge inference nodes, scoring every cell every 10 seconds. Predictions, actions, and outcomes flow back into the lake — so tonight's mistakes become tomorrow's training data.",
    snippet: `# edge scorer (runs at each site)
p_fail = predictor.predict(window)   # < 15 ms
if p_fail > 0.70:
    actions.execute("preemptive_failover")
log_outcome(p_fail, actions, observed)  # feedback loop`,
  },
];
