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
  /** True from mount until the first successful fetch completes. */
  loading: boolean;
  /** Unix-ms timestamp of last successful fetch (null until first success). */
  lastUpdated: number | null;
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
  // WR-02: track whether the first fetch has resolved so panels can distinguish
  // "loading" from "genuinely empty". Starts true, cleared after first poll attempt.
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
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
      const ac = new AbortController();
      const timeoutId = window.setTimeout(() => ac.abort(), 5_000);
      try {
        const res = await fetch("/api/metrics", { signal: ac.signal });
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
        setLastUpdated(Date.now());
        setError(null);
      } catch (err) {
        if (!mounted.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        window.clearTimeout(timeoutId);
        // Clear loading after first attempt regardless of success/error.
        if (mounted.current) setLoading(false);
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
    <MetricsPollContext.Provider value={{ data, error, loading, lastUpdated }}>
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
