import { useEffect, useState } from "react";

const HISTORY_LEN = 30;

// Random walk that drifts back toward a baseline and stays within [min, max]
function drift(value, baseline, jitter, min, max) {
  const pull = (baseline - value) * 0.15;
  const next = value + pull + (Math.random() - 0.5) * jitter;
  return Math.min(max, Math.max(min, next));
}

function timestamp() {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

const initialSites = [
  { id: "DRF-EDGE-01", name: "Helsinki Core", status: "optimal", health: 98, latency: 6.2, devices: 84 },
  { id: "DRF-EDGE-02", name: "Tampere Edge", status: "optimal", health: 95, latency: 7.8, devices: 61 },
  { id: "DRF-EDGE-03", name: "Oulu Factory", status: "warning", health: 71, latency: 18.4, devices: 47 },
  { id: "DRF-EDGE-04", name: "Turku Harbor", status: "critical", health: 32, latency: 46.1, devices: 19 },
];

function makeInitialState() {
  const now = Date.now();
  const history = Array.from({ length: HISTORY_LEN }, (_, i) => ({
    time: new Date(now - (HISTORY_LEN - i) * 2000).toLocaleTimeString("en-US", { hour12: false }),
    latency: 9 + (Math.random() - 0.5) * 4,
    throughput: 1.45 + (Math.random() - 0.5) * 0.4,
  }));
  return {
    latency: 9.2,
    throughput: 1.46,
    signal: -64,
    devices: 211,
    history,
    sites: initialSites,
  };
}

const STATUS_BOUNDS = {
  optimal: { base: 96, jitter: 3, min: 90, max: 100 },
  warning: { base: 70, jitter: 5, min: 55, max: 84 },
  critical: { base: 31, jitter: 7, min: 12, max: 48 },
};

export function useLiveData() {
  const [state, setState] = useState(makeInitialState);

  useEffect(() => {
    const id = setInterval(() => {
      setState((prev) => {
        const latency = drift(prev.latency, 9, 3.5, 4, 24);
        const throughput = drift(prev.throughput, 1.45, 0.28, 0.8, 2.1);
        const signal = drift(prev.signal, -64, 4, -78, -52);
        const devices = Math.round(drift(prev.devices, 212, 9, 180, 245));

        const history = [
          ...prev.history.slice(1),
          { time: timestamp(), latency, throughput },
        ];

        const sites = prev.sites.map((site) => {
          const b = STATUS_BOUNDS[site.status];
          return {
            ...site,
            health: drift(site.health, b.base, b.jitter, b.min, b.max),
            latency: drift(site.latency, site.latency, 2, 3, 60),
            devices: Math.round(drift(site.devices, site.devices, 4, 5, 120)),
          };
        });

        return { latency, throughput, signal, devices, history, sites };
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return state;
}
