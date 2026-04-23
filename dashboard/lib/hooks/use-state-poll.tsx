"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Rollup, PhaseSummary, RecentEvent, NeedsYouItem } from "@/lib/cae-home-state";

export interface StateResponse {
  breakers: {
    activeForgeCount: number;
    inputTokensToday: number;
    outputTokensToday: number;
    retryCount: number;
    recentPhantomEscalations: number;
    halted: boolean;
  };
  metrics: {
    breakers: unknown[];
    sentinel: unknown[];
    compaction: unknown[];
    approvals: unknown[];
  };
  // Phase 4 extension (route.ts exposes home.phases as home_phases to avoid shadowing the existing `phases` key)
  rollup: Rollup;
  home_phases: PhaseSummary[];
  events_recent: RecentEvent[];
  needs_you: NeedsYouItem[];
  live_ops_line: string;
}

interface StatePollValue {
  data: StateResponse | null;
  error: Error | null;
  /** Unix-ms timestamp of the last successful fetch, or null if no fetch has completed yet. */
  lastUpdated: number | null;
}

const StatePollContext = createContext<StatePollValue | null>(null);

interface StatePollProviderProps {
  children: React.ReactNode;
  projectPath?: string;
  intervalMs?: number;
}

export function StatePollProvider({
  children,
  projectPath = "",
  intervalMs = 3000,
}: StatePollProviderProps) {
  const [data, setData] = useState<StateResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const url = `/api/state?project=${encodeURIComponent(projectPath)}`;

    async function poll() {
      try {
        const res = await fetch(url);
        if (!mounted.current) return;
        if (res.status === 401) {
          // Unauthenticated (e.g. /signin page) — stop polling; shell pages
          // remount the provider on nav into authed routes.
          setError(new Error(`/api/state 401`));
          window.clearInterval(id);
          return;
        }
        if (!res.ok) {
          setError(new Error(`/api/state ${res.status}`));
          return;
        }
        const json = (await res.json()) as StateResponse;
        if (!mounted.current) return;
        setData(json);
        setLastUpdated(Date.now());
        setError(null);
      } catch (err) {
        if (!mounted.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    }

    let id = window.setInterval(poll, intervalMs);
    poll();

    const onVisibility = () => {
      if (document.hidden) {
        window.clearInterval(id);
      } else {
        poll();
        id = window.setInterval(poll, intervalMs);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mounted.current = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [projectPath, intervalMs]);

  return (
    <StatePollContext.Provider value={{ data, error, lastUpdated }}>
      {children}
    </StatePollContext.Provider>
  );
}

export function useStatePoll(): StatePollValue {
  const value = useContext(StatePollContext);
  if (value === null) {
    throw new Error("useStatePoll must be used inside <StatePollProvider>");
  }
  return value;
}
