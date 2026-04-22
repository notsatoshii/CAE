"use client";

/**
 * components/shell/debug-breadcrumb-panel.tsx — Dev-mode floating breadcrumb panel.
 *
 * Dev-only floating panel (bottom-right) showing the last 50 client-side log
 * events from the client-log-bus circular buffer. Intended as a "what fired
 * before this error?" trail for developers.
 *
 * Features:
 *   - Gated on useDevMode().dev — returns null in founder/production mode
 *   - Fixed bottom-right, collapsed by default, click toggle to expand
 *   - Live-updates via 'cae:log' CustomEvent (new events added to top)
 *   - Click entry → shows full JSON detail (ctx, scope, reqId, etc.)
 *   - Shows entry count in the toggle button so you can see activity while collapsed
 *   - Independent of IncidentStream: this is CLIENT events only; IS is SERVER events
 *
 * Severity color codes (inline style for reliability across themes):
 *   error/fatal → var(--danger)
 *   warn        → var(--warning)
 *   info/debug  → var(--text-muted)
 *
 * Plan 13-08 (D-04): dev-mode gated; T-13-08-04 accepted (cosmetic, single-user).
 */

import { useEffect, useState } from "react";
import { useDevMode } from "@/lib/providers/dev-mode";
import { getBuffer, type ClientLogEntry } from "@/lib/client-log-bus";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function levelColor(level: string): string {
  if (level === "error" || level === "fatal") return "var(--danger, #ef4444)";
  if (level === "warn") return "var(--warning, #f97316)";
  return "var(--text-muted, #9ca3af)";
}

function levelLabel(level: string): string {
  return level[0].toUpperCase();
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DebugBreadcrumbPanel() {
  const { dev } = useDevMode();
  const [entries, setEntries] = useState<ClientLogEntry[]>(() => getBuffer());
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<ClientLogEntry | null>(null);

  // Subscribe to live cae:log events
  useEffect(() => {
    if (!dev) return;

    const onLog = (ev: Event) => {
      const entry = (ev as CustomEvent<ClientLogEntry>).detail;
      setEntries((prev) => [...prev, entry].slice(-50));
    };

    window.addEventListener("cae:log", onLog);
    return () => window.removeEventListener("cae:log", onLog);
  }, [dev]);

  // Dev-mode gate — must be AFTER hooks (hooks can't be conditional)
  if (!dev) return null;

  const handleToggle = () => {
    setExpanded((v) => !v);
    // Reset selected when collapsing
    if (expanded) setSelected(null);
  };

  const handleEntryClick = (entry: ClientLogEntry) => {
    setSelected((prev) => (prev === entry ? null : entry));
  };

  // Entries displayed newest-first
  const displayed = [...entries].reverse();

  return (
    <div className="fixed bottom-2 right-2 z-50 font-mono text-[10px]">
      {/* Toggle button */}
      <button
        data-testid="debug-breadcrumb-toggle"
        onClick={handleToggle}
        className="flex items-center gap-1 rounded border border-[color:var(--border)] bg-[color:var(--bg-elev)] px-2 py-1 text-[10px] text-[color:var(--text-muted)] hover:bg-[color:var(--bg)] transition-colors"
        aria-expanded={expanded}
        aria-label="Toggle debug breadcrumb panel"
      >
        <span>breadcrumbs ({entries.length})</span>
        <span aria-hidden="true">{expanded ? "▼" : "▲"}</span>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div
          data-testid="debug-breadcrumb-panel"
          className="mt-1 w-80 max-h-64 overflow-auto rounded border border-[color:var(--border)] bg-[color:var(--bg-elev)] p-2"
          role="log"
          aria-label="Debug breadcrumb log"
          aria-live="polite"
        >
          {displayed.length === 0 ? (
            <div className="text-[color:var(--text-muted)] py-2 text-center">
              no events yet
            </div>
          ) : (
            displayed.map((e, i) => (
              <div
                key={i}
                data-testid={`breadcrumb-entry-${i}`}
                onClick={() => handleEntryClick(e)}
                className="cursor-pointer rounded px-1 py-0.5 hover:bg-[color:var(--bg)] transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span
                    style={{ color: levelColor(e.level) }}
                    aria-label={`level: ${e.level}`}
                  >
                    {levelLabel(e.level)}
                  </span>
                  <span className="text-[color:var(--text-muted)] tabular-nums">
                    {formatTime(e.time)}
                  </span>
                  <span className="text-[color:var(--text-muted)]">{e.scope}</span>
                  <span className="flex-1 truncate text-[color:var(--text)]">{e.msg}</span>
                </div>

                {selected === e && (
                  <pre
                    data-testid="breadcrumb-detail"
                    className="mt-1 overflow-auto rounded bg-[color:var(--bg)] p-1 text-[9px] text-[color:var(--text-muted)] whitespace-pre-wrap"
                  >
                    {JSON.stringify(e, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
