import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { PY_FILES, TRAINING_STEPS } from "./mlCode";

/* ---------- Simulation ---------- */

const BASELINE = {
  signal: -62,
  devices: 215,
  throughput: 1.45,
  errorRate: 0.9,
  interference: -96,
  cpu: 44,
};

const SCENARIOS = {
  interference_storm: {
    label: "Uplink interference storm",
    targets: { interference: -82, errorRate: 6.5, throughput: 0.7 },
  },
  congestion: {
    label: "Cell congestion event",
    targets: { devices: 325, cpu: 92, throughput: 0.75, errorRate: 3.6 },
  },
  degradation: {
    label: "RF degradation",
    targets: { signal: -84, errorRate: 5.6, throughput: 0.95 },
  },
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const noise = (amp) => (Math.random() - 0.5) * amp;

// Mirrors the XGBoost model's gain-based feature importance
const IMPORTANCE = [
  { key: "errorRate", label: "Error Rate", weight: 0.28 },
  { key: "interference", label: "Interference", weight: 0.22 },
  { key: "signal", label: "Signal Strength", weight: 0.18 },
  { key: "cpu", label: "CPU Load", weight: 0.12 },
  { key: "throughput", label: "Throughput", weight: 0.11 },
  { key: "devices", label: "Device Count", weight: 0.09 },
];

function badness(m) {
  return {
    errorRate: clamp01(m.errorRate / 8),
    interference: clamp01((m.interference + 100) / 18),
    signal: clamp01((-m.signal - 56) / 30),
    cpu: clamp01((m.cpu - 30) / 60),
    throughput: clamp01((1.7 - m.throughput) / 1.2),
    devices: clamp01((m.devices - 170) / 160),
  };
}

function failureProbability(m) {
  const b = badness(m);
  const raw = IMPORTANCE.reduce((s, f) => s + f.weight * b[f.key], 0);
  return Math.max(1, Math.min(98, 4 + 92 * raw + noise(3)));
}

function level(prob) {
  if (prob >= 70) return "critical";
  if (prob >= 40) return "warning";
  return "nominal";
}

function featureStatus(m) {
  return {
    signal: m.signal >= -70 ? "ok" : m.signal >= -78 ? "warn" : "crit",
    devices: m.devices <= 270 ? "ok" : m.devices <= 310 ? "warn" : "crit",
    throughput: m.throughput >= 1.1 ? "ok" : m.throughput >= 0.85 ? "warn" : "crit",
    errorRate: m.errorRate < 2.5 ? "ok" : m.errorRate <= 5 ? "warn" : "crit",
    interference: m.interference <= -90 ? "ok" : m.interference <= -86 ? "warn" : "crit",
    cpu: m.cpu < 70 ? "ok" : m.cpu <= 85 ? "warn" : "crit",
  };
}

function useInferenceSim() {
  const [sim, setSim] = useState(() => {
    const m = { ...BASELINE };
    const prob = failureProbability(m);
    return {
      metrics: m,
      anomaly: null,
      prob,
      history: Array.from({ length: 40 }, (_, i) => ({
        t: i,
        prob: 18 + noise(8),
      })),
      tick: 40,
    };
  });

  useEffect(() => {
    const id = setInterval(() => {
      setSim((prev) => {
        let anomaly = prev.anomaly;

        // Maybe start an anomaly event
        if (!anomaly && Math.random() < 0.045) {
          const keys = Object.keys(SCENARIOS);
          const scenario = keys[Math.floor(Math.random() * keys.length)];
          anomaly = { scenario, ticksLeft: 10 + Math.floor(Math.random() * 9) };
        }

        const targets = anomaly
          ? { ...BASELINE, ...SCENARIOS[anomaly.scenario].targets }
          : BASELINE;

        const jitter = {
          signal: 1.2, devices: 6, throughput: 0.07,
          errorRate: 0.25, interference: 1.0, cpu: 2.5,
        };

        const metrics = {};
        for (const k of Object.keys(BASELINE)) {
          metrics[k] = prev.metrics[k] + (targets[k] - prev.metrics[k]) * 0.22 + noise(jitter[k]);
        }
        metrics.devices = Math.round(metrics.devices);
        metrics.errorRate = Math.max(0.05, metrics.errorRate);

        if (anomaly) {
          anomaly = anomaly.ticksLeft <= 1 ? null : { ...anomaly, ticksLeft: anomaly.ticksLeft - 1 };
        }

        const prob = failureProbability(metrics);
        const tick = prev.tick + 1;
        const history = [...prev.history.slice(-59), { t: tick, prob }];

        return { metrics, anomaly, prob, history, tick };
      });
    }, 1200);
    return () => clearInterval(id);
  }, []);

  return sim;
}

/* ---------- Recommended actions ---------- */

function recommendedActions(m, prob) {
  const st = featureStatus(m);
  const actions = [];
  const conf = (base) => Math.round(Math.min(97, base + prob / 4));

  if (prob >= 70)
    actions.push({
      sev: "critical",
      text: "Initiate preemptive failover — predicted failure window under 15 minutes",
      conf: conf(72),
    });
  if (st.interference !== "ok")
    actions.push({
      sev: st.interference === "crit" ? "critical" : "warning",
      text: "Apply interference mitigation profile on band n78 (−1.5 dB handover bias, RL-recommended)",
      conf: conf(64),
    });
  if (st.cpu !== "ok")
    actions.push({
      sev: st.cpu === "crit" ? "critical" : "warning",
      text: "Rebalance UPF sessions to standby baseband unit BBU-02",
      conf: conf(61),
    });
  if (st.throughput !== "ok")
    actions.push({
      sev: st.throughput === "crit" ? "critical" : "warning",
      text: "Shift 5% slice bandwidth from eMBB to the congested URLLC slice",
      conf: conf(58),
    });
  if (st.signal !== "ok")
    actions.push({
      sev: st.signal === "crit" ? "critical" : "warning",
      text: "Raise sector transmit power +2 dB and schedule antenna alignment check",
      conf: conf(56),
    });
  if (st.errorRate !== "ok")
    actions.push({
      sev: st.errorRate === "crit" ? "critical" : "warning",
      text: "Enable robust MCS fallback until block error rate returns below 2%",
      conf: conf(60),
    });
  if (st.devices !== "ok")
    actions.push({
      sev: st.devices === "crit" ? "critical" : "warning",
      text: "Activate load-balancing handovers to neighbor cells DRF-C2/C3",
      conf: conf(57),
    });

  if (actions.length === 0)
    return [
      { sev: "info", text: "Network nominal — RL agent in monitoring mode, no intervention required", conf: 96 },
      { sev: "info", text: "Energy-saving cell sleep schedule continues on low-traffic sectors", conf: 91 },
    ];
  return actions.slice(0, 4);
}

/* ---------- UI pieces ---------- */

function Gauge({ prob }) {
  const lv = level(prob);
  const color = lv === "critical" ? "var(--red)" : lv === "warning" ? "var(--amber)" : "var(--green)";
  const R = 84;
  const C = Math.PI * R; // semicircle length
  return (
    <div className="gauge">
      <svg viewBox="0 0 200 115" className="gauge-svg">
        <path
          d="M 16 100 A 84 84 0 0 1 184 100"
          fill="none"
          stroke="#16201a"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M 16 100 A 84 84 0 0 1 184 100"
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${(prob / 100) * C} ${C}`}
          style={{ transition: "stroke-dasharray 0.9s ease, stroke 0.5s ease", filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="gauge-value" style={{ color }}>
        {prob.toFixed(1)}<span>%</span>
      </div>
      <div className="gauge-label">FAILURE PROBABILITY · NEXT 15 MIN</div>
      <span className={`badge ${lv === "nominal" ? "optimal" : lv}`}>{lv}</span>
    </div>
  );
}

const FEATURE_DEFS = [
  { key: "signal", label: "Signal Strength", unit: "dBm", fmt: (v) => v.toFixed(0) },
  { key: "devices", label: "Device Count", unit: "UEs", fmt: (v) => v },
  { key: "throughput", label: "Throughput", unit: "Gbps", fmt: (v) => v.toFixed(2) },
  { key: "errorRate", label: "Error Rate", unit: "%", fmt: (v) => v.toFixed(1) },
  { key: "interference", label: "Interference", unit: "dBm", fmt: (v) => v.toFixed(0) },
  { key: "cpu", label: "CPU Load", unit: "%", fmt: (v) => v.toFixed(0) },
];

function LiveInference({ sim }) {
  const { metrics, anomaly, prob, history } = sim;
  const st = featureStatus(metrics);
  const actions = recommendedActions(metrics, prob);
  const importanceData = IMPORTANCE.map((f) => ({ name: f.label, value: f.weight * 100 }));

  return (
    <>
      {anomaly && (
        <div className="ml-anomaly-banner">
          <span className="dot red" />
          ANOMALY DETECTED — {SCENARIOS[anomaly.scenario].label} · Isolation Forest score elevated ·
          model re-scoring every 1.2 s
        </div>
      )}

      <div className="ml-top">
        <div className="panel gauge-panel">
          <div className="panel-head">
            <span className="panel-title">Live Inference</span>
            <span className="panel-tag">XGBOOST · 10s WINDOW</span>
          </div>
          <Gauge prob={prob} />
        </div>

        <div className="ml-features">
          {FEATURE_DEFS.map((f) => (
            <div className={`ml-feature ${st[f.key]}`} key={f.key}>
              <div className="ml-feature-top">
                <span className="kpi-label">{f.label}</span>
                <span className={`dot ${st[f.key] === "ok" ? "green" : st[f.key] === "warn" ? "amber" : "red"}`} />
              </div>
              <div className="ml-feature-value">
                {f.fmt(metrics[f.key])}
                <span className="kpi-unit">{f.unit}</span>
              </div>
              <div className="ml-feature-status">
                {st[f.key] === "ok" ? "NOMINAL" : st[f.key] === "warn" ? "WARNING" : "CRITICAL"}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="ml-mid">
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Feature Importance</span>
            <span className="panel-tag">MODEL GAIN</span>
          </div>
          <div className="ml-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={importanceData} layout="vertical" margin={{ top: 8, right: 30, left: 14, bottom: 0 }}>
                <CartesianGrid stroke="#1c2a20" strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" unit="%" tick={{ fill: "#46554b", fontSize: 9, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={108} tick={{ fill: "#6f8276", fontSize: 10, fontFamily: "monospace" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#0d1410", border: "1px solid #2a3f30", borderRadius: 6, fontFamily: "monospace", fontSize: 11 }}
                  formatter={(v) => [`${v.toFixed(0)}%`, "weight"]}
                  cursor={{ fill: "rgba(0,230,118,0.05)" }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={false}>
                  {importanceData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "#00e676" : `rgba(0, 230, 118, ${0.75 - i * 0.11})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">AI Recommended Actions</span>
            <span className="panel-tag">RL POLICY</span>
          </div>
          <div className="ml-actions">
            {actions.map((a, i) => (
              <div className="ml-action" key={i}>
                <span className={`sev ${a.sev === "info" ? "info" : a.sev}`}>
                  {a.sev === "info" ? "NOMINAL" : a.sev.toUpperCase()}
                </span>
                <span className="ml-action-text">{a.text}</span>
                <span className="ml-action-conf">{a.conf}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Failure Probability History</span>
          <span className="chart-current">
            <span>{prob.toFixed(1)}</span> % · updating every 1.2 s
          </span>
        </div>
        <div className="ml-history">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="grad-prob" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00e676" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#00e676" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#1c2a20" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="t" tick={false} axisLine={{ stroke: "#1c2a20" }} />
              <YAxis domain={[0, 100]} tick={{ fill: "#46554b", fontSize: 9, fontFamily: "monospace" }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: "#0d1410", border: "1px solid #2a3f30", borderRadius: 6, fontFamily: "monospace", fontSize: 11 }}
                labelFormatter={() => ""}
                formatter={(v) => [`${v.toFixed(1)} %`, "P(failure)"]}
                isAnimationActive={false}
              />
              <ReferenceLine y={40} stroke="#ffb020" strokeDasharray="4 4" strokeOpacity={0.6} />
              <ReferenceLine y={70} stroke="#ff4d5e" strokeDasharray="4 4" strokeOpacity={0.6} />
              <Area type="monotone" dataKey="prob" stroke="#00e676" strokeWidth={2} fill="url(#grad-prob)" dot={false} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}

function CodeTab() {
  const [fileIdx, setFileIdx] = useState(0);
  const file = PY_FILES[fileIdx];
  return (
    <div className="panel">
      <div className="code-files">
        {PY_FILES.map((f, i) => (
          <button key={f.name} className={`code-file ${i === fileIdx ? "active" : ""}`} onClick={() => setFileIdx(i)}>
            {f.name}
          </button>
        ))}
      </div>
      <div className="code-meta">
        <b>{file.title}</b>
        <span>{file.desc}</span>
      </div>
      <pre className="gen-output code-view">{file.code}</pre>
    </div>
  );
}

function HowItLearns() {
  return (
    <div className="learn-steps">
      {TRAINING_STEPS.map((s) => (
        <div className="learn-step" key={s.n}>
          <div className="learn-step-rail">
            <div className="learn-step-num">{s.n}</div>
            {s.n < TRAINING_STEPS.length && <div className="learn-step-line" />}
          </div>
          <div className="learn-step-body panel">
            <div className="learn-step-title">{s.title}</div>
            <div className="learn-step-desc">{s.desc}</div>
            <pre className="learn-snippet">{s.snippet}</pre>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- Main ---------- */

export default function MLEngine() {
  const [view, setView] = useState("inference");
  const sim = useInferenceSim();

  return (
    <div className="ml-engine">
      <div className="wizard-head">
        <div>
          <div className="wizard-title">AI/ML Engine</div>
          <div className="wizard-sub">
            Drift Core v3.2 — failure prediction, anomaly detection, and RL-based network optimization
          </div>
        </div>
        <span className="panel-tag">
          <span className="dot green" style={{ marginRight: 7 }} />
          MODELS LIVE
        </span>
      </div>

      <div className="tabs ml-subtabs">
        <button className={`tab ${view === "inference" ? "active" : ""}`} onClick={() => setView("inference")}>
          Live Inference
        </button>
        <button className={`tab ${view === "code" ? "active" : ""}`} onClick={() => setView("code")}>
          Code
        </button>
        <button className={`tab ${view === "learn" ? "active" : ""}`} onClick={() => setView("learn")}>
          How It Learns
        </button>
      </div>

      {view === "inference" && <LiveInference sim={sim} />}
      {view === "code" && <CodeTab />}
      {view === "learn" && <HowItLearns />}
    </div>
  );
}
