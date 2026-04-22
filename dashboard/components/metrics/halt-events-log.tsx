"use client";

/**
 * Halt-events log (Phase 7 Reliability panel).
 *
 * Renders a chronological list of circuit-breaker halt events (newest-first).
 * Each row shows the halt reason + timestamp; dev-mode also shows the task_id
 * when present. The aggregator caps the list at 20 events; we just render
 * whatever it sends.
 *
 * Empty state uses the founder-speak "Nothing paused this month. Nice." copy
 * (or the dev-speak equivalent when Dev Mode is on).
 */

import { labelFor } from "@/lib/copy/labels";
import { useDevMode } from "@/lib/providers/dev-mode";

interface Event {
  ts: string;
  reason: string;
  task_id?: string;
}

interface Props {
  events: Event[];
}

export function HaltEventsLog({ events }: Props) {
  const { dev } = useDevMode();
  const L = labelFor(dev);

  if (events.length === 0) {
    return (
      <div
        data-testid="halt-events-empty"
        className="rounded-md border border-dashed border-[color:var(--border)] p-4 text-sm text-[color:var(--text-muted)]"
      >
        {L.metricsWellHaltsEmpty}
      </div>
    );
  }

  return (
    <ul data-testid="halt-events" className="space-y-1">
      {events.map((e, idx) => (
        <li
          key={e.ts + "-" + idx}
          className="flex items-start justify-between gap-3 rounded-md bg-[color:var(--surface)] px-3 py-2 text-sm"
        >
          <span className="text-[color:var(--text)]">{e.reason}</span>
          <span className="shrink-0 font-mono text-[10px] text-[color:var(--text-muted)]">
            {new Date(e.ts).toLocaleString()}
            {dev && e.task_id ? " - " + e.task_id : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}
