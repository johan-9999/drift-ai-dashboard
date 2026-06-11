import { useEffect, useRef, useState } from "react";
import Anthropic from "@anthropic-ai/sdk";
import { alerts } from "./alertsData";

function buildSystemPrompt(data) {
  const sites = data.sites
    .map(
      (s) =>
        `- ${s.name} (${s.id}): status ${s.status.toUpperCase()}, health ${s.health.toFixed(0)}%, latency ${s.latency.toFixed(1)} ms, ${s.devices} connected devices`,
    )
    .join("\n");

  const alertLines = alerts
    .map((a) => `- [${a.sev.toUpperCase()}] ${a.msg} (${a.src}, ${a.time})`)
    .join("\n");

  return `You are Drift, the AI operations assistant built into Drift AI's private 5G network management platform. You help network operators understand and troubleshoot the network.

Guidelines:
- Be concise and specific. Quote actual numbers from the telemetry below.
- When discussing problems, suggest concrete next steps an operator could take.
- If asked about things unrelated to the network or platform, briefly redirect to network operations.
- Plain text or light Markdown; no headers unless the answer is long.

## Live network telemetry (captured just now)

### Network-wide KPIs
- Average latency: ${data.latency.toFixed(1)} ms
- Aggregate throughput: ${data.throughput.toFixed(2)} Gbps
- Average signal strength: ${data.signal.toFixed(0)} dBm
- Connected devices: ${data.devices} UEs

### Sites
${sites}

### Active alerts
${alertLines}

### Platform status
- 5G core: AMF/SMF healthy, 1,842 UPF sessions, 6 network slices active, 99.98% core uptime
- AI engine: Drift Core v3.2 operational — 14 ms inference latency, 97.4% anomaly detection accuracy, ~128 optimizations/hr, last retrained 06:00 UTC`;
}

const SUGGESTIONS = [
  "Summarize current network health",
  "Why is Turku Harbor critical?",
  "Which site needs attention next?",
  "Explain the n78 interference alert",
];

export default function AgentChat({ data }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("drift_api_key") || "");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function send(textArg) {
    const text = (textArg ?? input).trim();
    if (!text || busy) return;
    if (!apiKey.trim()) {
      setError("Enter your Anthropic API key above to start chatting.");
      return;
    }
    localStorage.setItem("drift_api_key", apiKey.trim());

    const history = [...messages, { role: "user", text }];
    setMessages([...history, { role: "assistant", text: "" }]);
    setInput("");
    setBusy(true);
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
        system: buildSystemPrompt(data),
        messages: history.map((m) => ({ role: m.role, content: m.text })),
      });

      stream.on("text", (delta) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, text: last.text + delta };
          return next;
        });
      });

      await stream.finalMessage();
    } catch (err) {
      let msg;
      if (err instanceof Anthropic.AuthenticationError) {
        msg = "Invalid API key. Check your key at console.anthropic.com.";
      } else if (err instanceof Anthropic.RateLimitError) {
        msg = "Rate limited by the API. Wait a moment and try again.";
      } else if (err instanceof Anthropic.APIError) {
        msg = `API error ${err.status}: ${err.message}`;
      } else {
        msg = `Request failed: ${err.message}`;
      }
      setError(msg);
      // Drop the empty assistant placeholder if nothing streamed
      setMessages((prev) =>
        prev[prev.length - 1]?.role === "assistant" && prev[prev.length - 1].text === ""
          ? prev.slice(0, -1)
          : prev,
      );
    }
    setBusy(false);
    inputRef.current?.focus();
  }

  return (
    <div className="agent">
      <div className="wizard-head">
        <div>
          <div className="wizard-title">AI Agent</div>
          <div className="wizard-sub">
            Ask Drift about the network — it sees the same live telemetry as this dashboard
          </div>
        </div>
        <span className="panel-tag">
          <span className="dot green" style={{ marginRight: 7 }} />
          TELEMETRY-AWARE
        </span>
      </div>

      {!localStorage.getItem("drift_api_key") && (
        <div className="agent-key-row">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Anthropic API key (sk-ant-…) — stored locally in your browser only"
            autoComplete="off"
          />
        </div>
      )}

      <div className="panel agent-panel">
        <div className="agent-scroll" ref={scrollRef}>
          {messages.length === 0 && (
            <div className="agent-empty">
              <div className="brand-mark" style={{ width: 44, height: 44, fontSize: 20 }}>Δ</div>
              <div className="agent-empty-title">Drift is monitoring the network</div>
              <div className="agent-empty-sub">
                Live KPIs, site health, and active alerts are shared with the assistant on every
                message. Try one of these:
              </div>
              <div className="chip-grid" style={{ justifyContent: "center" }}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              {m.role === "assistant" && <div className="msg-avatar">Δ</div>}
              <div className="msg-bubble">
                {m.text ||
                  (busy && i === messages.length - 1 ? (
                    <span className="typing">
                      <span /><span /><span />
                    </span>
                  ) : (
                    ""
                  ))}
              </div>
            </div>
          ))}
        </div>

        {error && <div className="gen-error agent-error">{error}</div>}

        <div className="agent-input-row">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask about latency, sites, alerts…"
            disabled={busy}
          />
          <button className="btn-primary agent-send" onClick={() => send()} disabled={busy || !input.trim()}>
            {busy ? <span className="spinner spinner-dark" /> : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
