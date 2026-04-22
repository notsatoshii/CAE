"use client";

/**
 * Phase 7 metrics polling provider + hook.
 *
 * Fetches `/api/metrics` every 30s (D-06). Pauses when the tab is hidden
 * (`document.visibilityState === "hidden"`) and resumes immediately on
 * visibility change.  Kept deliberately independent of StatePollProvider —
 * 30s cadence + different shape + different namespace (D-06).
 *
 * Mirrors the pattern in `use-state-poll.tsx` but without projectPath
 * (aggregator walks all projects server-side per D-03).
 */

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { MetricsState } from "@/lib/cae-metrics-state";

interface MetricsPollValue {
  data: MetricsState | null;
  error: Error | null;
}

const MetricsPollContext = createContext<MetricsPollValue | null>(null);

interface MetricsPollProviderProps {
  children: React.ReactNode;
  intervalMs?: number;
}

export function MetricsPollProvider({
  children,
  intervalMs = 30_000,
}: MetricsPollProviderProps) {
  const [data, setData] = useState<MetricsState | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    async function poll() {
      // Pause when tab hidden — reduces idle CPU + server load.
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }
      try {
        const res = await fetch("/api/metrics");
        if (!mounted.current) return;
        if (!res.ok) {
          setError(new Error("/api/metrics returned " + res.status));
          // Still parse the fallback body — route.ts returns the full shape
          // on 500, so the UI can continue to render (as zeros) instead of
          // blanking out.
          try {
            const json = (await res.json()) as MetricsState;
            if (!mounted.current) return;
            setData(json);
          } catch {
            // body unreadable; keep prior data
          }
          return;
        }
        const json = (await res.json()) as MetricsState;
        if (!mounted.current) return;
        setData(json);
        setError(null);
      } catch (err) {
        if (!mounted.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    }

    // Immediate + scheduled.
    poll();
    const id = window.setInterval(poll, intervalMs);

    // Resume immediately when tab becomes visible again (so the first
    // unhidden poll doesn't wait up to 30s).
    function onVisibility() {
      if (document.visibilityState === "visible") poll();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mounted.current = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);

  return (
    <MetricsPollContext.Provider value={{ data, error }}>
      {children}
    </MetricsPollContext.Provider>
  );
}

export function useMetricsPoll(): MetricsPollValue {
  const value = useContext(MetricsPollContext);
  if (value === null) {
    throw new Error("useMetricsPoll must be used inside <MetricsPollProvider>");
  }
  return value;
}
