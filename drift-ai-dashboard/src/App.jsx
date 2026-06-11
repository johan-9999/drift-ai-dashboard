import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useLiveData } from "./useLiveData";
import DeploymentWizard from "./DeploymentWizard";
import Automations from "./Automations";
import AgentChat from "./AgentChat";
import MLEngine from "./MLEngine";
import { alerts } from "./alertsData";

/* ---------- Icons (inline SVG, stroke = currentColor) ---------- */
const Icon = ({ d, size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {d}
  </svg>
);

const icons = {
  latency: <Icon d={<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>} />,
  throughput: <Icon d={<><path d="M3 17l5-6 4 4 6-8" /><path d="M14 7h4v4" /></>} />,
  signal: <Icon d={<><path d="M4 18h.01" /><path d="M8 18v-3" /><path d="M12 18v-6" /><path d="M16 18V9" /><path d="M20 18V5" /></>} />,
  devices: <Icon d={<><rect x="3" y="5" width="12" height="14" rx="2" /><path d="M18 9h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1" /><path d="M9 16h.01" /></>} />,
};

/* ---------- Header ---------- */
function Header({ tab, onTabChange }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="header">
      <div className="brand">
        <div className="brand-mark">Δ</div>
        <div>
          <div className="brand-name">
            Drift <span>AI</span>
          </div>
          <div className="brand-sub">Private 5G Network Operations</div>
        </div>
      </div>
      <nav className="tabs">
        <button
          className={`tab ${tab === "operations" ? "active" : ""}`}
          onClick={() => onTabChange("operations")}
        >
          Operations
        </button>
        <button
          className={`tab ${tab === "wizard" ? "active" : ""}`}
          onClick={() => onTabChange("wizard")}
        >
          Deployment Wizard
        </button>
        <button
          className={`tab ${tab === "automation" ? "active" : ""}`}
          onClick={() => onTabChange("automation")}
        >
          Automation
        </button>
        <button
          className={`tab ${tab === "agent" ? "active" : ""}`}
          onClick={() => onTabChange("agent")}
        >
          AI Agent
        </button>
        <button
          className={`tab ${tab === "ml" ? "active" : ""}`}
          onClick={() => onTabChange("ml")}
        >
          ML Engine
        </button>
      </nav>
      <div className="header-status">
        <div className="status-pill">
          <span className="dot green" />
          NETWORK <b>ONLINE</b>
        </div>
        <div className="status-pill">
          <span className="dot green" />
          5G CORE <b>ACTIVE</b>
        </div>
        <div className="status-pill">
          <span className="dot amber" />
          ALERTS <b>3 OPEN</b>
        </div>
        <div className="header-clock">
          {now.toLocaleTimeString("en-US", { hour12: false })} UTC+3
        </div>
      </div>
    </header>
  );
}

/* ---------- KPI cards ---------- */
function KpiCard({ label, icon, value, unit, delta, deltaDir }) {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <span className="kpi-icon">{icon}</span>
      </div>
      <div className="kpi-value">
        {value}
        <span className="kpi-unit">{unit}</span>
      </div>
      <div className={`kpi-delta ${deltaDir}`}>
        {deltaDir === "up" ? "▲" : "▼"} {delta} <span className="vs">vs last hour</span>
      </div>
    </div>
  );
}

/* ---------- Live area chart ---------- */
function chartTooltipStyle() {
  return {
    background: "#0d1410",
    border: "1px solid #2a3f30",
    borderRadius: 6,
    fontFamily: "SF Mono, Menlo, monospace",
    fontSize: 11,
  };
}

function LiveChart({ title, data, dataKey, color, unit, current, domain }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">{title}</span>
        <span className="chart-current">
          <span>{current}</span> {unit}
        </span>
      </div>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 6, left: -14, bottom: 0 }}>
            <defs>
              <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1c2a20" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="time"
              tick={{ fill: "#46554b", fontSize: 9, fontFamily: "monospace" }}
              tickLine={false}
              axisLine={{ stroke: "#1c2a20" }}
              interval={6}
            />
            <YAxis
              domain={domain}
              tick={{ fill: "#46554b", fontSize: 9, fontFamily: "monospace" }}
              tickLine={false}
              axisLine={false}
              width={46}
            />
            <Tooltip
              contentStyle={chartTooltipStyle()}
              labelStyle={{ color: "#6f8276" }}
              itemStyle={{ color }}
              formatter={(v) => [`${v.toFixed(2)} ${unit}`, title]}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${dataKey})`}
              isAnimationActive={false}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ---------- Site health ---------- */
function SiteCard({ site }) {
  return (
    <div className={`site-card ${site.status}`}>
      <div className="site-head">
        <span className="site-name">{site.name}</span>
        <span className={`badge ${site.status}`}>
          <span className={`dot ${site.status === "optimal" ? "green" : site.status === "warning" ? "amber" : "red"}`} />
          {site.status}
        </span>
      </div>
      <div className="site-id">{site.id}</div>
      <div className="health-row">
        <span>HEALTH</span>
        <b>{site.health.toFixed(0)}%</b>
      </div>
      <div className="health-bar">
        <div className={`health-fill ${site.status}`} style={{ width: `${site.health}%` }} />
      </div>
      <div className="site-meta">
        <span>
          LAT <b>{site.latency.toFixed(1)}ms</b>
        </span>
        <span>
          UE <b>{site.devices}</b>
        </span>
      </div>
    </div>
  );
}

/* ---------- Alerts ---------- */
function AlertsPanel() {
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">Active Alerts</span>
        <span className="panel-tag">LIVE FEED</span>
      </div>
      <div className="alerts-list">
        {alerts.map((a, i) => (
          <div className="alert-row" key={i}>
            <span className={`sev ${a.sev}`}>{a.sev.toUpperCase()}</span>
            <div className="alert-msg">
              {a.msg}
              <div className="alert-src">{a.src}</div>
            </div>
            <span className="alert-time">{a.time}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Sidebar ---------- */
function Sidebar({ sites }) {
  return (
    <aside className="sidebar">
      <div>
        <div className="side-section-title">Site Status</div>
        {sites.map((site) => (
          <div className="side-site" key={site.id}>
            <span className={`dot ${site.status === "optimal" ? "green" : site.status === "warning" ? "amber" : "red"}`} />
            <span className="side-site-name">{site.name}</span>
            <span className="side-site-stat">{site.health.toFixed(0)}%</span>
          </div>
        ))}
      </div>

      <div>
        <div className="side-section-title">AI Engine</div>
        <div className="ai-engine-box">
          <div className="ai-engine-head">
            <span className="dot green" />
            <span className="ai-engine-name">Drift Core v3.2</span>
          </div>
          <div className="ai-engine-desc">
            Autonomous RAN optimization and anomaly detection running across all edge sites.
          </div>
          <div className="ai-row">
            <span className="ai-key">Status</span>
            <span className="ai-val green">OPERATIONAL</span>
          </div>
          <div className="ai-row">
            <span className="ai-key">Inference latency</span>
            <span className="ai-val">14 ms</span>
          </div>
          <div className="ai-row">
            <span className="ai-key">Anomaly accuracy</span>
            <span className="ai-val">97.4%</span>
          </div>
          <div className="ai-row">
            <span className="ai-key">Optimizations / hr</span>
            <span className="ai-val">128</span>
          </div>
          <div className="ai-row">
            <span className="ai-key">Last retrain</span>
            <span className="ai-val">06:00 UTC</span>
          </div>
          <div className="scan-line" />
        </div>
      </div>

      <div>
        <div className="side-section-title">Network Core</div>
        <div className="ai-row">
          <span className="ai-key">AMF / SMF</span>
          <span className="ai-val green">HEALTHY</span>
        </div>
        <div className="ai-row">
          <span className="ai-key">UPF sessions</span>
          <span className="ai-val">1,842</span>
        </div>
        <div className="ai-row">
          <span className="ai-key">Slices active</span>
          <span className="ai-val">6</span>
        </div>
        <div className="ai-row">
          <span className="ai-key">Core uptime</span>
          <span className="ai-val">99.98%</span>
        </div>
      </div>
    </aside>
  );
}

/* ---------- App ---------- */
export default function App() {
  const data = useLiveData();
  const [tab, setTab] = useState("operations");

  return (
    <div className="app">
      <Header tab={tab} onTabChange={setTab} />
      <div className="main">
        {tab === "wizard" && (
          <main className="content">
            <DeploymentWizard />
          </main>
        )}
        {tab === "automation" && (
          <main className="content">
            <Automations />
          </main>
        )}
        {tab === "ml" && (
          <main className="content">
            <MLEngine />
          </main>
        )}
        {/* Chat stays mounted so the conversation survives tab switches */}
        <main
          className="content"
          style={{ display: tab === "agent" ? "flex" : "none" }}
        >
          <AgentChat data={data} />
        </main>
        {tab === "operations" && (
        <main className="content">
          <div className="kpi-grid">
            <KpiCard
              label="Avg Latency"
              icon={icons.latency}
              value={data.latency.toFixed(1)}
              unit="ms"
              delta="0.8ms"
              deltaDir={data.latency < 10 ? "up" : "down"}
            />
            <KpiCard
              label="Throughput"
              icon={icons.throughput}
              value={data.throughput.toFixed(2)}
              unit="Gbps"
              delta="4.2%"
              deltaDir={data.throughput > 1.4 ? "up" : "down"}
            />
            <KpiCard
              label="Signal Strength"
              icon={icons.signal}
              value={data.signal.toFixed(0)}
              unit="dBm"
              delta="2dBm"
              deltaDir={data.signal > -66 ? "up" : "down"}
            />
            <KpiCard
              label="Connected Devices"
              icon={icons.devices}
              value={data.devices}
              unit="UEs"
              delta="12"
              deltaDir={data.devices > 210 ? "up" : "down"}
            />
          </div>

          <div className="charts-row">
            <LiveChart
              title="Network Latency"
              data={data.history}
              dataKey="latency"
              color="#00e676"
              unit="ms"
              current={data.latency.toFixed(1)}
              domain={[0, 30]}
            />
            <LiveChart
              title="Aggregate Throughput"
              data={data.history}
              dataKey="throughput"
              color="#2dd4bf"
              unit="Gbps"
              current={data.throughput.toFixed(2)}
              domain={[0, 2.5]}
            />
          </div>

          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Site Health</span>
              <span className="panel-tag">4 SITES</span>
            </div>
            <div className="sites-grid">
              {data.sites.map((site) => (
                <SiteCard site={site} key={site.id} />
              ))}
            </div>
          </div>

          <AlertsPanel />
        </main>
        )}
        {tab === "operations" && <Sidebar sites={data.sites} />}
      </div>
    </div>
  );
}
