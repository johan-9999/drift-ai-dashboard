# Drift AI — Private 5G Network Management Platform

**AI-native operations for private 5G networks.** Drift AI is a working prototype of a network operations platform that pairs live telemetry monitoring with machine-learning-driven failure prediction, autonomous optimization, and a conversational AI operator assistant.

> 🖥️ **This is an interactive product prototype.** Network telemetry is simulated so the full experience can be demonstrated without physical 5G infrastructure. The Claude-powered features (configuration generation and the AI assistant) make real API calls. The ML models are presented as reference implementations of the production architecture.

---

## The Product

Private 5G networks — in factories, ports, hospitals, and logistics hubs — are powerful but operationally complex. Drift AI's thesis: **a small operations team plus an AI engine can run what traditionally requires a dedicated NOC.**

The prototype demonstrates the full product surface across five areas:

### 📡 Operations Dashboard
A real-time network operations center: latency, throughput, signal strength, and device-count KPIs streaming live; per-site health scoring across a multi-site deployment; and a prioritized alert feed with severity triage.

### 🧠 AI/ML Engine
The core differentiator. A live inference view shows per-cell **failure probability predicted 15 minutes ahead**, recomputed every 1.2 seconds from six telemetry features. Includes model feature-importance analysis, AI-recommended remediation actions, and anomaly events you can watch the system detect and recover from. Reference implementations included for:
- **Failure prediction** — XGBoost classifier with time-series cross-validation
- **Self-optimization** — reinforcement learning (PPO / Stable-Baselines3) tuning transmit power, handover bias, and slice bandwidth for QoS-per-watt
- **Anomaly detection** — Isolation Forest catching failure modes no one has labeled yet
- **Continuous learning** — nightly champion/challenger retraining pipeline (MLflow)

### 🤖 AI Agent
A conversational assistant (powered by Anthropic's Claude) that receives the platform's live telemetry with every question — operators ask "why is Turku Harbor critical?" and get answers grounded in current network state, with recommended next steps.

### 🪄 Deployment Wizard
Five-step facility intake (coverage, devices, performance requirements) that generates a complete, deployment-ready 5G network configuration — RAN design, core placement, network slices, bill of materials, rollout phases — via the Claude API in seconds instead of consulting-engagement weeks.

### ⚙️ Automation
Toggleable autonomous actions — self-healing failover, dynamic spectrum reallocation, predictive maintenance dispatch, energy-saving cell sleep — each tracking run counts and accumulated cost savings.

---

## Running It Locally

Requires [Node.js](https://nodejs.org) 20+.

```bash
cd drift-ai-dashboard
npm install
npm run dev
```

Open **http://localhost:5173**. The Operations, Automation, and ML Engine tabs work immediately. The two Claude-powered features (Deployment Wizard generation and AI Agent chat) ask for an [Anthropic API key](https://console.anthropic.com) — entered once, stored only in your browser.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite |
| Charts | Recharts |
| AI features | Anthropic Claude API (`@anthropic-ai/sdk`, streaming) |
| ML architecture (reference) | XGBoost · Stable-Baselines3 (PPO) · scikit-learn Isolation Forest · MLflow |

## Project Structure

```
drift-ai-dashboard/src/
├── App.jsx              # Shell, tabs, operations dashboard
├── useLiveData.js       # Telemetry simulation engine
├── MLEngine.jsx         # Live inference, anomaly events, model demos
├── mlCode.js            # Python reference implementations
├── AgentChat.jsx        # Telemetry-aware Claude assistant
├── DeploymentWizard.jsx # AI-generated network configurations
└── Automations.jsx      # Autonomous action management
```

## Roadmap (Production Path)

1. **Real telemetry ingestion** — replace the simulator with streaming metrics from RAN/core vendors' APIs
2. **Server-side ML** — train and serve the failure-prediction and anomaly models on real network data
3. **Backend API proxy** — move Claude calls server-side with proper key management and auth
4. **Closed-loop automation** — connect recommended actions to actual network controllers with operator approval gates

---

*Prototype built with [Claude Code](https://claude.com/claude-code).*
