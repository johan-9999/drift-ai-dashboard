import { useEffect, useRef, useState } from "react";
import Anthropic from "@anthropic-ai/sdk";

const STEPS = [
  { id: 1, label: "Facility" },
  { id: 2, label: "Coverage" },
  { id: 3, label: "Devices" },
  { id: 4, label: "Requirements" },
  { id: 5, label: "Generate" },
];

const FACILITY_TYPES = [
  "Manufacturing Plant",
  "Warehouse / Logistics",
  "Port / Harbor",
  "Hospital Campus",
  "Mining Site",
  "Corporate Campus",
];

const DEVICE_TYPES = [
  "AGVs / AMRs",
  "IoT Sensors",
  "HD Cameras (CCTV)",
  "Handheld Scanners",
  "Industrial Robots",
  "AR/VR Headsets",
  "Connected Vehicles",
  "Push-to-Talk Devices",
];

const initialForm = {
  facilityName: "",
  facilityType: FACILITY_TYPES[0],
  location: "",
  indoorArea: "25000",
  outdoorArea: "10000",
  floors: "1",
  coverageNotes: "",
  deviceCount: "250",
  deviceTypes: ["AGVs / AMRs", "IoT Sensors"],
  peakThroughput: "1.5",
  maxLatency: "10",
  redundancy: "N+1 (single failover)",
  slicing: true,
  spectrumBand: "n78 (3.5 GHz)",
  securityLevel: "High (SIM auth + network segmentation)",
};

function buildPrompt(form) {
  return `Design a private 5G network configuration for the following facility:

## Facility
- Name: ${form.facilityName || "Unnamed facility"}
- Type: ${form.facilityType}
- Location: ${form.location || "Not specified"}

## Coverage Requirements
- Indoor area: ${form.indoorArea} m²
- Outdoor area: ${form.outdoorArea} m²
- Floors: ${form.floors}
- Notes: ${form.coverageNotes || "None"}

## Devices & Capacity
- Expected device count: ${form.deviceCount} UEs
- Device types: ${form.deviceTypes.join(", ") || "Not specified"}
- Peak aggregate throughput: ${form.peakThroughput} Gbps

## Performance & Operational Requirements
- Maximum acceptable latency: ${form.maxLatency} ms
- Redundancy: ${form.redundancy}
- Network slicing required: ${form.slicing ? "Yes" : "No"}
- Spectrum band: ${form.spectrumBand}
- Security level: ${form.securityLevel}

Produce a complete deployment-ready network configuration document in Markdown with these sections:
1. **Executive Summary** — 3-4 sentences on the recommended architecture
2. **RAN Configuration** — number of radio units/small cells, placement strategy, band/bandwidth, TDD pattern, transmit power, expected cell capacity
3. **Core Network** — recommended 5G core deployment (on-prem/edge/hybrid), AMF/SMF/UPF placement, session capacity
4. **Network Slices** — slice definitions with 5QI values, bandwidth allocations, and priority per traffic class (only if slicing was requested)
5. **Capacity Plan** — per-device-class bandwidth budget vs. total capacity, headroom analysis
6. **Redundancy & Resilience** — failover design matching the requested redundancy level
7. **Security Architecture** — SIM/identity strategy, segmentation, monitoring
8. **Bill of Materials** — table of major components with quantities
9. **Deployment Phases** — phased rollout plan with rough timeline

Be specific with numbers (cell counts, dBm, MHz, 5QI values). Base cell-count estimates on the stated areas and device density.`;
}

const SYSTEM_PROMPT =
  "You are Drift AI's principal network architect, an expert in private 5G network design (3GPP Release 17, CBRS/n78 deployments, industrial IoT). You produce precise, deployment-ready network configurations. Be concrete and quantitative; state assumptions explicitly when input data is incomplete.";

export default function DeploymentWizard() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("drift_api_key") || "");
  const [status, setStatus] = useState("idle"); // idle | streaming | done | error
  const [output, setOutput] = useState("");
  const [error, setError] = useState("");
  const outputRef = useRef(null);

  useEffect(() => {
    if (status === "streaming" && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output, status]);

  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const toggleDevice = (type) => {
    setForm((f) => ({
      ...f,
      deviceTypes: f.deviceTypes.includes(type)
        ? f.deviceTypes.filter((t) => t !== type)
        : [...f.deviceTypes, type],
    }));
  };

  async function generate() {
    if (!apiKey.trim()) {
      setError("Enter your Anthropic API key to generate the configuration.");
      setStatus("error");
      return;
    }
    localStorage.setItem("drift_api_key", apiKey.trim());
    setStatus("streaming");
    setOutput("");
    setError("");

    try {
      const client = new Anthropic({
        apiKey: apiKey.trim(),
        dangerouslyAllowBrowser: true,
      });

      const stream = client.messages.stream({
        model: "claude-opus-4-8",
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildPrompt(form) }],
      });

      stream.on("text", (delta) => setOutput((prev) => prev + delta));

      await stream.finalMessage();
      setStatus("done");
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) {
        setError("Invalid API key. Check your key at console.anthropic.com.");
      } else if (err instanceof Anthropic.RateLimitError) {
        setError("Rate limited by the API. Wait a moment and try again.");
      } else if (err instanceof Anthropic.APIError) {
        setError(`API error ${err.status}: ${err.message}`);
      } else {
        setError(`Request failed: ${err.message}`);
      }
      setStatus("error");
    }
  }

  function downloadConfig() {
    const blob = new Blob([output], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(form.facilityName || "network-config").replace(/\s+/g, "-").toLowerCase()}-5g-config.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const canNext =
    step === 1 ? form.facilityName.trim().length > 0 : true;

  return (
    <div className="wizard">
      <div className="wizard-head">
        <div>
          <div className="wizard-title">Deployment Wizard</div>
          <div className="wizard-sub">
            Configure a new private 5G site — Drift AI generates the network architecture
          </div>
        </div>
        <span className="panel-tag">AI-ASSISTED</span>
      </div>

      <div className="wizard-steps">
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className={`wstep ${step === s.id ? "active" : ""} ${step > s.id ? "complete" : ""}`}
          >
            <span className="wstep-num">{step > s.id ? "✓" : s.id}</span>
            <span className="wstep-label">{s.label}</span>
            {i < STEPS.length - 1 && <span className="wstep-line" />}
          </div>
        ))}
      </div>

      <div className="wizard-body panel">
        {step === 1 && (
          <div className="wform">
            <h3 className="wform-title">Facility Information</h3>
            <div className="field">
              <label>Facility name *</label>
              <input
                value={form.facilityName}
                onChange={set("facilityName")}
                placeholder="e.g. Espoo Assembly Plant"
              />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Facility type</label>
                <select value={form.facilityType} onChange={set("facilityType")}>
                  {FACILITY_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Location</label>
                <input
                  value={form.location}
                  onChange={set("location")}
                  placeholder="City, country"
                />
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="wform">
            <h3 className="wform-title">Coverage & Layout</h3>
            <div className="field-row">
              <div className="field">
                <label>Indoor area (m²)</label>
                <input type="number" value={form.indoorArea} onChange={set("indoorArea")} />
              </div>
              <div className="field">
                <label>Outdoor area (m²)</label>
                <input type="number" value={form.outdoorArea} onChange={set("outdoorArea")} />
              </div>
              <div className="field">
                <label>Floors</label>
                <input type="number" value={form.floors} onChange={set("floors")} min="1" />
              </div>
            </div>
            <div className="field">
              <label>Coverage notes</label>
              <textarea
                rows={3}
                value={form.coverageNotes}
                onChange={set("coverageNotes")}
                placeholder="Metal racking, high-bay storage, cold rooms, RF-dense zones…"
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="wform">
            <h3 className="wform-title">Devices & Capacity</h3>
            <div className="field-row">
              <div className="field">
                <label>Expected device count (UEs)</label>
                <input type="number" value={form.deviceCount} onChange={set("deviceCount")} />
              </div>
              <div className="field">
                <label>Peak throughput (Gbps)</label>
                <input
                  type="number"
                  step="0.1"
                  value={form.peakThroughput}
                  onChange={set("peakThroughput")}
                />
              </div>
            </div>
            <div className="field">
              <label>Device types</label>
              <div className="chip-grid">
                {DEVICE_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`chip ${form.deviceTypes.includes(t) ? "selected" : ""}`}
                    onClick={() => toggleDevice(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="wform">
            <h3 className="wform-title">Performance & Requirements</h3>
            <div className="field-row">
              <div className="field">
                <label>Max latency (ms)</label>
                <input type="number" value={form.maxLatency} onChange={set("maxLatency")} />
              </div>
              <div className="field">
                <label>Spectrum band</label>
                <select value={form.spectrumBand} onChange={set("spectrumBand")}>
                  <option>n78 (3.5 GHz)</option>
                  <option>n48 / CBRS (3.55–3.7 GHz)</option>
                  <option>n77 (3.7 GHz)</option>
                  <option>n38 (2.6 GHz)</option>
                  <option>mmWave n257 (28 GHz)</option>
                </select>
              </div>
            </div>
            <div className="field-row">
              <div className="field">
                <label>Redundancy</label>
                <select value={form.redundancy} onChange={set("redundancy")}>
                  <option>None (best effort)</option>
                  <option>N+1 (single failover)</option>
                  <option>2N (full duplication)</option>
                  <option>Geo-redundant core</option>
                </select>
              </div>
              <div className="field">
                <label>Security level</label>
                <select value={form.securityLevel} onChange={set("securityLevel")}>
                  <option>Standard (SIM auth)</option>
                  <option>High (SIM auth + network segmentation)</option>
                  <option>Maximum (zero-trust + air-gapped core)</option>
                </select>
              </div>
            </div>
            <label className="check-row">
              <input type="checkbox" checked={form.slicing} onChange={set("slicing")} />
              Enable network slicing (separate slices per traffic class)
            </label>
          </div>
        )}

        {step === 5 && (
          <div className="wform">
            <h3 className="wform-title">Review & Generate</h3>
            <div className="review-grid">
              <div className="review-item"><span>Facility</span><b>{form.facilityName || "—"} · {form.facilityType}</b></div>
              <div className="review-item"><span>Coverage</span><b>{form.indoorArea} m² indoor / {form.outdoorArea} m² outdoor · {form.floors} floor(s)</b></div>
              <div className="review-item"><span>Devices</span><b>{form.deviceCount} UEs · {form.deviceTypes.length} device classes</b></div>
              <div className="review-item"><span>Performance</span><b>≤{form.maxLatency} ms · {form.peakThroughput} Gbps · {form.spectrumBand}</b></div>
              <div className="review-item"><span>Resilience</span><b>{form.redundancy} · slicing {form.slicing ? "on" : "off"}</b></div>
            </div>

            <div className="field">
              <label>Anthropic API key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-ant-…"
                autoComplete="off"
              />
              <div className="field-hint">
                Stored locally in your browser only. Calls go directly from this page to the
                Claude API — for production, route through a backend instead.
              </div>
            </div>

            <button
              className="btn-generate"
              onClick={generate}
              disabled={status === "streaming"}
            >
              {status === "streaming" ? (
                <>
                  <span className="spinner" /> Generating configuration…
                </>
              ) : (
                "Generate Network Configuration"
              )}
            </button>

            {status === "error" && <div className="gen-error">{error}</div>}

            {(output || status === "streaming") && (
              <div className="gen-output-wrap">
                <div className="gen-output-head">
                  <span className="panel-title">
                    Generated Configuration
                    {status === "streaming" && <span className="dot green" style={{ marginLeft: 10 }} />}
                  </span>
                  {status === "done" && (
                    <button className="btn-small" onClick={downloadConfig}>
                      Download .md
                    </button>
                  )}
                </div>
                <pre className="gen-output" ref={outputRef}>{output || "Waiting for first tokens…"}</pre>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="wizard-nav">
        <button
          className="btn-secondary"
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1 || status === "streaming"}
        >
          ← Back
        </button>
        <span className="wizard-progress">Step {step} of {STEPS.length}</span>
        {step < 5 ? (
          <button
            className="btn-primary"
            onClick={() => setStep((s) => Math.min(5, s + 1))}
            disabled={!canNext}
          >
            Next →
          </button>
        ) : (
          <span style={{ width: 84 }} />
        )}
      </div>
    </div>
  );
}
