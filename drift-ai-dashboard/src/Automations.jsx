import { useEffect, useState } from "react";

const initialAutomations = [
  {
    id: "ran-failover",
    name: "Self-Healing RAN Failover",
    desc: "Detects degraded radio units and reroutes traffic to neighboring cells before users notice.",
    category: "Resilience",
    enabled: true,
    runsToday: 14,
    runsTotal: 1283,
    savingsPerRun: 38,
    lastRun: "4 min ago",
  },
  {
    id: "spectrum",
    name: "Dynamic Spectrum Reallocation",
    desc: "Shifts bandwidth between cells based on predicted demand, peak-shaving the busiest sectors.",
    category: "Optimization",
    enabled: true,
    runsToday: 96,
    runsTotal: 18420,
    savingsPerRun: 4,
    lastRun: "38 sec ago",
  },
  {
    id: "predictive-maint",
    name: "Predictive Maintenance Dispatch",
    desc: "Flags radios and fiber paths likely to fail within 14 days and auto-creates work orders.",
    category: "Maintenance",
    enabled: true,
    runsToday: 3,
    runsTotal: 211,
    savingsPerRun: 420,
    lastRun: "2 hr ago",
  },
  {
    id: "cell-sleep",
    name: "Energy-Saving Cell Sleep",
    desc: "Powers down underutilized cells overnight and wakes them on demand spikes.",
    category: "Energy",
    enabled: false,
    runsToday: 0,
    runsTotal: 4030,
    savingsPerRun: 11,
    lastRun: "paused",
  },
  {
    id: "anomaly-triage",
    name: "Anomaly Auto-Triage",
    desc: "Classifies alerts by root cause and auto-resolves known patterns without operator action.",
    category: "Operations",
    enabled: true,
    runsToday: 41,
    runsTotal: 7716,
    savingsPerRun: 17,
    lastRun: "1 min ago",
  },
  {
    id: "slice-rebalance",
    name: "QoS Slice Rebalancing",
    desc: "Re-tunes slice bandwidth allocations when latency-critical traffic approaches SLA limits.",
    category: "Optimization",
    enabled: false,
    runsToday: 0,
    runsTotal: 922,
    savingsPerRun: 9,
    lastRun: "paused",
  },
];

const fmtMoney = (n) =>
  "$" + Math.round(n).toLocaleString("en-US");

export default function Automations() {
  const [autos, setAutos] = useState(initialAutomations);

  // Simulate enabled automations firing over time
  useEffect(() => {
    const id = setInterval(() => {
      setAutos((prev) =>
        prev.map((a) => {
          if (!a.enabled || Math.random() > 0.3) return a;
          return {
            ...a,
            runsToday: a.runsToday + 1,
            runsTotal: a.runsTotal + 1,
            lastRun: "just now",
          };
        }),
      );
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const toggle = (id) =>
    setAutos((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, enabled: !a.enabled, lastRun: a.enabled ? "paused" : "armed" }
          : a,
      ),
    );

  const active = autos.filter((a) => a.enabled);
  const runsToday = autos.reduce((s, a) => s + a.runsToday, 0);
  const savingsToday = autos.reduce((s, a) => s + a.runsToday * a.savingsPerRun, 0);
  const savingsAllTime = autos.reduce((s, a) => s + a.runsTotal * a.savingsPerRun, 0);

  return (
    <div className="automation">
      <div className="wizard-head">
        <div>
          <div className="wizard-title">AI Automation</div>
          <div className="wizard-sub">
            Autonomous network actions run by the Drift AI engine — toggle per automation
          </div>
        </div>
        <span className="panel-tag">
          {active.length} OF {autos.length} ACTIVE
        </span>
      </div>

      <div className="auto-summary">
        <div className="auto-stat">
          <span className="auto-stat-label">Active Automations</span>
          <span className="auto-stat-value">{active.length}<span className="kpi-unit">/ {autos.length}</span></span>
        </div>
        <div className="auto-stat">
          <span className="auto-stat-label">Runs Today</span>
          <span className="auto-stat-value">{runsToday.toLocaleString("en-US")}</span>
        </div>
        <div className="auto-stat">
          <span className="auto-stat-label">Savings Today</span>
          <span className="auto-stat-value green">{fmtMoney(savingsToday)}</span>
        </div>
        <div className="auto-stat">
          <span className="auto-stat-label">Savings All-Time</span>
          <span className="auto-stat-value green">{fmtMoney(savingsAllTime)}</span>
        </div>
      </div>

      <div className="auto-list">
        {autos.map((a) => (
          <div className={`auto-card ${a.enabled ? "" : "off"}`} key={a.id}>
            <div className="auto-card-main">
              <div className="auto-card-head">
                <span className="auto-name">{a.name}</span>
                <span className="auto-cat">{a.category}</span>
              </div>
              <div className="auto-desc">{a.desc}</div>
              <div className="auto-metrics">
                <span>
                  RUNS TODAY <b>{a.runsToday.toLocaleString("en-US")}</b>
                </span>
                <span>
                  ALL-TIME <b>{a.runsTotal.toLocaleString("en-US")}</b>
                </span>
                <span>
                  SAVED TODAY <b className="green">{fmtMoney(a.runsToday * a.savingsPerRun)}</b>
                </span>
                <span>
                  SAVED ALL-TIME <b className="green">{fmtMoney(a.runsTotal * a.savingsPerRun)}</b>
                </span>
                <span>
                  LAST RUN <b>{a.lastRun}</b>
                </span>
              </div>
            </div>
            <div className="auto-card-side">
              <button
                className={`switch ${a.enabled ? "on" : ""}`}
                onClick={() => toggle(a.id)}
                aria-label={`Toggle ${a.name}`}
                role="switch"
                aria-checked={a.enabled}
              >
                <span className="switch-knob" />
              </button>
              <span className={`auto-state ${a.enabled ? "on" : ""}`}>
                {a.enabled ? "ACTIVE" : "PAUSED"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
