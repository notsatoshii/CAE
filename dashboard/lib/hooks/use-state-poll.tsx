"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

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
}

interface StatePollValue {
  data: StateResponse | null;
  error: Error | null;
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
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const url = `/api/state?project=${encodeURIComponent(projectPath)}`;

    async function poll() {
      try {
        const res = await fetch(url);
        if (!mounted.current) return;
        if (!res.ok) {
          setError(new Error(`/api/state returned ${res.status}`));
          return;
        }
        const json = (await res.json()) as StateResponse;
        if (!mounted.current) return;
        setData(json);
        setError(null);
      } catch (err) {
        if (!mounted.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    }

    poll();
    const id = window.setInterval(poll, intervalMs);
    return () => {
      mounted.current = false;
      window.clearInterval(id);
    };
  }, [projectPath, intervalMs]);

  return (
    <StatePollContext.Provider value={{ data, error }}>
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
