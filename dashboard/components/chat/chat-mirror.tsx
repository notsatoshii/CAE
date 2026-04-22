"use client";

/**
 * ChatMirror — read-only surface picker for the /chat left pane. CHT-04, D-16 (Wave 4, Plan 09-07).
 *
 * Renders a dropdown picker of the 7 Build surfaces (Home / Agents / Workflows /
 * Queue / Changes / Metrics / Memory). When a surface is selected, it fetches the
 * relevant aggregator API and renders a lightweight read-only preview.
 *
 * Design rules:
 * - NO interactive buttons, detail drawers, or nested routes.
 * - NO interactive buttons that trigger server actions.
 * - File stays under 200 LOC (Phase 12 can add richer per-surface renderers).
 * - Generic JSON fallback for surfaces that don't have a custom renderer yet.
 *
 * Security (T-09-07-01): Payloads come from /api/* which are already auth-gated
 * and scoped to the current user. JSON.stringify truncates at 2000 chars for the
 * generic fallback.
 */

import { useEffect, useState } from "react";

export type MirrorSurface =
  | "home"
  | "agents"
  | "workflows"
  | "queue"
  | "changes"
  | "metrics"
  | "memory";

const SURFACES: Array<{ id: MirrorSurface; endpoint: string; title: string }> =
  [
    { id: "home", endpoint: "/api/state", title: "Home" },
    { id: "agents", endpoint: "/api/agents", title: "Agents" },
    { id: "workflows", endpoint: "/api/workflows", title: "Recipes" },
    { id: "queue", endpoint: "/api/queue", title: "Queue" },
    { id: "changes", endpoint: "/api/changes", title: "Changes" },
    { id: "metrics", endpoint: "/api/metrics", title: "Metrics" },
    { id: "memory", endpoint: "/api/memory/tree", title: "Memory" },
  ];

export function ChatMirror({
  surface,
  onSurfaceChange,
}: {
  surface: MirrorSurface;
  onSurfaceChange: (s: MirrorSurface) => void;
}) {
  const [payload, setPayload] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);

  const def = SURFACES.find((s) => s.id === surface)!;

  useEffect(() => {
    let cancelled = false;
    setPayload(null);
    setErr(null);
    (async () => {
      try {
        const res = await fetch(def.endpoint);
        if (!res.ok) throw new Error("status " + res.status);
        const j = await res.json();
        if (!cancelled) setPayload(j);
      } catch (e) {
        if (!cancelled)
          setErr(e instanceof Error ? e.message : "fetch failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [def.endpoint]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Surface picker */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-[color:var(--text-muted,#8a8a8c)]">
          Mirror:
        </span>
        <select
          value={surface}
          onChange={(e) => onSurfaceChange(e.target.value as MirrorSurface)}
          className="text-sm bg-transparent border border-[color:var(--border,#1f1f22)] rounded px-2 py-1 text-[color:var(--text,#e5e5e5)]"
          aria-label="Select Build surface to mirror"
        >
          {SURFACES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title}
            </option>
          ))}
        </select>
      </div>

      <h2 className="text-xl font-medium mb-3">{def.title}</h2>

      {err ? (
        <p className="text-sm text-destructive">
          Couldn&apos;t load this view: {err}
        </p>
      ) : !payload ? (
        <p className="text-sm text-[color:var(--text-muted,#8a8a8c)]">
          Loading…
        </p>
      ) : (
        <MirrorRender surface={surface} payload={payload} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lightweight read-only renderers per surface.
// Home + Changes have rich renderers; others fall back to truncated JSON.
// Phase 12 polish will wire richer per-surface modes if needed.
// ---------------------------------------------------------------------------

function MirrorRender({
  surface,
  payload,
}: {
  surface: MirrorSurface;
  payload: unknown;
}) {
  const p = payload as Record<string, unknown>;
  try {
    switch (surface) {
      case "home": {
        const phases = (
          p.phases as
            | Array<{
                projectName: string;
                phaseNumber: number;
                progress_pct: number;
                wave_current: number;
                wave_total: number;
              }>
            | undefined
        ) ?? [];
        if (phases.length === 0) {
          return (
            <p className="text-sm text-[color:var(--text-muted,#8a8a8c)]">
              No active phases.
            </p>
          );
        }
        return (
          <ul className="space-y-1 text-sm">
            {phases.slice(0, 10).map((ph, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="flex-1">
                  {ph.projectName} · phase {ph.phaseNumber}
                </span>
                <span className="text-[color:var(--text-muted,#8a8a8c)]">
                  {ph.progress_pct}% · wave {ph.wave_current}/{ph.wave_total}
                </span>
              </li>
            ))}
          </ul>
        );
      }
      case "changes": {
        const projects = (
          p.projects as
            | Array<{
                projectName: string;
                count: number;
                events: Array<{ prose: string }>;
              }>
            | undefined
        ) ?? [];
        if (projects.length === 0) {
          return (
            <p className="text-sm text-[color:var(--text-muted,#8a8a8c)]">
              Nothing shipped in the last 30 days.
            </p>
          );
        }
        return (
          <div className="space-y-3 text-sm">
            {projects.slice(0, 5).map((grp, i) => (
              <div key={i}>
                <div className="font-medium">
                  {grp.projectName} · {grp.count}
                </div>
                <ul className="pl-4 text-[color:var(--text-muted,#8a8a8c)] space-y-0.5">
                  {grp.events.slice(0, 5).map((e, j) => (
                    <li key={j}>{e.prose}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        );
      }
      default: {
        // Generic fallback: truncated JSON (T-09-07-01: 2000-char cap).
        return (
          <pre className="text-xs font-mono text-[color:var(--text-muted,#8a8a8c)] whitespace-pre-wrap max-h-96 overflow-auto">
            {JSON.stringify(p, null, 2).slice(0, 2000)}
          </pre>
        );
      }
    }
  } catch (e) {
    return (
      <p className="text-sm text-destructive">
        Couldn&apos;t render:{" "}
        {e instanceof Error ? e.message : "unknown error"}
      </p>
    );
  }
}
