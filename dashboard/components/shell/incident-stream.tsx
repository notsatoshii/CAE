"use client";

/**
 * components/shell/incident-stream.tsx — Live incident stream panel.
 *
 * Connects to /api/incidents (SSE) on mount, accumulates the last 200
 * warn+/error lines, and renders them newest-first in a scrollable list.
 *
 * Features:
 *   - Severity badge: warn=amber, error=red (CSS variable tokens)
 *   - Click row → expand JSON detail (scope, reqId, stack, full ctx)
 *   - Empty state: "No incidents since {timestamp}. Gateway healthy."
 *   - Auto-scroll to top on new entries
 *   - Pause on hover (stops scroll but keeps accumulating)
 *   - Max 200 visible entries; oldest are dropped
 *
 * Data flow:
 *   /api/incidents SSE → EventSource → React state → rendered list
 *
 * Plan 13-08 (D-07): surfaces existing data (pino → .cae/logs/dashboard.log.jsonl).
 * No new data source introduced.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Panel } from "@/components/ui/panel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IncidentEntry {
  level: string;
  time: number;
  scope?: string;
  reqId?: string;
  route?: string;
  msg?: string;
  [k: string]: unknown;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ENTRIES = 200;
const MAX_RETRIES = 5;
const SSE_ENDPOINT = "/api/incidents";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function severityStyle(level: string): {
  badgeClass: string;
  testId: string;
  label: string;
} {
  if (level === "error" || level === "fatal") {
    return {
      badgeClass:
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[color:var(--danger-bg,#450a0a)] text-[color:var(--danger,#ef4444)] border border-[color:var(--danger,#ef4444)]/30",
      testId: "incident-badge-error",
      label: level === "fatal" ? "fatal" : "error",
    };
  }
  return {
    badgeClass:
      "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-[color:var(--warning-bg,#451a03)] text-[color:var(--warning,#f97316)] border border-[color:var(--warning,#f97316)]/30",
    testId: "incident-badge-warn",
    label: "warn",
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IncidentStream() {
  const [entries, setEntries] = useState<IncidentEntry[]>([]);
  const [selected, setSelected] = useState<IncidentEntry | null>(null);
  const [mountTime, setMountTime] = useState<Date | null>(null);
  const [connState, setConnState] = useState<"connecting" | "open" | "lost">(
    "connecting"
  );
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setMountTime(new Date());
  }, []);
  const listRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(false);
  const esRef = useRef<EventSource | null>(null);

  // Auto-scroll to top on new entry (newest-first list = DOM top)
  const scrollToTop = useCallback(() => {
    if (isPausedRef.current) return;
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    function connect() {
      const es = new EventSource(SSE_ENDPOINT);
      esRef.current = es;

      es.addEventListener("open", () => {
        retryCountRef.current = 0;
        setConnState("open");
      });

      es.addEventListener("message", (ev: MessageEvent) => {
        retryCountRef.current = 0;
        setConnState("open");
        try {
          const line = JSON.parse(ev.data) as IncidentEntry;
          setEntries((prev) => {
            const next = [line, ...prev];
            return next.length > MAX_ENTRIES ? next.slice(0, MAX_ENTRIES) : next;
          });
          scrollToTop();
        } catch {
          // Malformed frame — skip silently
        }
      });

      es.addEventListener("error", () => {
        es.close();
        esRef.current = null;

        if (retryCountRef.current >= MAX_RETRIES) {
          setConnState("lost");
          return;
        }

        const attempt = retryCountRef.current;
        retryCountRef.current += 1;
        const delay = Math.min(1000 * Math.pow(2, attempt), 10_000);
        setConnState("connecting");
        retryTimerRef.current = setTimeout(connect, delay);
      });
    }

    connect();

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      esRef.current?.close();
      esRef.current = null;
    };
  }, [scrollToTop]);

  const handleMouseEnter = () => {
    isPausedRef.current = true;
  };
  const handleMouseLeave = () => {
    isPausedRef.current = false;
  };

  const toggleSelected = (entry: IncidentEntry) => {
    setSelected((prev) => (prev === entry ? null : entry));
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const subtitle = connState === "lost"
    ? "Connection lost"
    : entries.length === 0
      ? "Waiting for events…"
      : `${entries.length} event${entries.length === 1 ? "" : "s"}`;

  // C2-wave/Class 3: compute liveness state for SSE-backed panel.
  //  - connecting  → loading
  //  - lost        → error (retries exhausted)
  //  - open + 0 rows → empty
  //  - open + rows → healthy (SSE: freshness ties to connection, not wall time)
  const liveness: "loading" | "error" | "empty" | "healthy" =
    connState === "connecting"
      ? "loading"
      : connState === "lost"
        ? "error"
        : entries.length === 0
          ? "empty"
          : "healthy";

  return (
    <Panel
      title="Incident Stream"
      subtitle={subtitle}
      testId="incident-stream-panel"
      className="flex flex-col gap-2"
      dataLiveness={liveness}
    >
      <span className="sr-only" data-truth={`incident-stream.${liveness}`}>yes</span>
      {/* Connection lost state (retries exhausted) */}
      {connState === "lost" && (
        <div
          data-testid="incident-stream-lost"
          className="flex flex-col items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-elev)] px-4 py-6 text-center"
        >
          <p className="text-sm font-medium text-[color:var(--text)]">
            Connection lost. Refresh to retry.
          </p>
        </div>
      )}

      {/* Empty state */}
      {connState !== "lost" && entries.length === 0 && (
        <div
          data-testid="incident-stream-empty"
          className="flex flex-col items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-elev)] px-4 py-6 text-center"
        >
          <svg
            className="h-6 w-6 text-[color:var(--success,#22c55e)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
            />
          </svg>
          <p className="text-sm font-medium text-[color:var(--text)]">
            {mountTime ? `No incidents since ${mountTime.toLocaleTimeString()}` : "No incidents"}
          </p>
          <p className="text-xs text-[color:var(--text-muted)]">Gateway healthy.</p>
        </div>
      )}

      {/* Event list */}
      {connState !== "lost" && entries.length > 0 && (
        <div
          ref={listRef}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className="max-h-72 overflow-y-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--bg-elev)]"
        >
          {entries.map((entry, idx) => {
            const sev = severityStyle(entry.level);
            const isSelected = selected === entry;
            return (
              <div
                key={idx}
                data-testid="incident-row"
                onClick={() => toggleSelected(entry)}
                className={[
                  "cursor-pointer border-b border-[color:var(--border)] px-3 py-2 last:border-0",
                  "hover:bg-[color:var(--bg)] transition-colors",
                  isSelected ? "bg-[color:var(--bg)]" : "",
                ].join(" ")}
              >
                <div className="flex items-center gap-2">
                  <span data-testid={sev.testId} className={sev.badgeClass}>
                    {sev.label}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-[color:var(--text-muted)]">
                    {formatTime(entry.time)}
                  </span>
                  {entry.scope && (
                    <span className="text-[11px] text-[color:var(--text-muted)]">
                      {entry.scope}
                    </span>
                  )}
                  <span className="flex-1 truncate text-xs text-[color:var(--text)]">
                    {entry.msg ?? "(no message)"}
                  </span>
                </div>

                {isSelected && (
                  <pre
                    data-testid="incident-detail"
                    className="mt-2 overflow-auto rounded bg-[color:var(--bg)] p-2 font-mono text-[10px] text-[color:var(--text-muted)] whitespace-pre-wrap"
                  >
                    {JSON.stringify(entry, null, 2)}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
