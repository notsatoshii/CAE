"use client";

/**
 * Phase 9 Wave 2 (plan 09-04) — ChangeRow.
 *
 * One row in the Changes timeline. Default render = founder-speak prose line
 * from `event.prose` (pre-templated by `proseForEvent` in Wave 1; D-02 —
 * zero LLM tokens) PLUS a per-event meta-row (local time · short sha · lead
 * commit subject) so rows in the same bucket never read identically.
 *
 * Class 5C fix: without this meta, events sharing the same
 * (project, weekday, commit-count) tuple rendered identical prose — e.g.
 * 9 rows of "CAE shipped 2 changes to dashboard Monday." — reading like a
 * fake template leak.
 *
 * A small `[technical]` toggle button flips open the DevModeDetail panel.
 *
 * Open-state rule:
 *   - Initial open state === useDevMode().dev (auto-expanded when Dev-mode
 *     is global-on).
 *   - Dev-mode flipping at runtime via Ctrl/Cmd+Shift+D syncs rows that
 *     haven't been user-touched (effect watches `dev`).
 *   - User clicks stay sticky until another user click — mirrors the spec:
 *     "technical is available, just hidden" (Eric's call per must_haves).
 *
 * No `$` in copy (D-13). All strings flow through `labelFor(dev)`.
 * ExplainTooltip surfaces `changesExplainDevToggle` on the toggle button
 * per D-15.
 */

import { useEffect, useState } from "react";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { ExplainTooltip } from "@/components/ui/explain-tooltip";
import { DevModeDetail } from "./dev-mode-detail";
import type { ChangeEvent } from "@/lib/cae-changes-state";

/**
 * HH:MM formatter in viewer-local tz. Falls back to the ISO string's
 * time slice if Date parsing fails (defensive — the aggregator yields
 * ISO strings but belt-and-braces keeps the row renderable).
 */
function formatLocalTime(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso.slice(11, 16);
  try {
    return new Date(ms).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso.slice(11, 16);
  }
}

/** First commit subject or the merge subject as fallback. */
function leadSubject(event: ChangeEvent): string {
  const first = event.commits[0]?.subject?.trim();
  if (first) return first;
  const m = event.mergeSubject?.trim();
  return m || "";
}

export function ChangeRow({ event }: { event: ChangeEvent }) {
  const { dev } = useDevMode();
  const L = labelFor(dev);
  const [openTech, setOpenTech] = useState<boolean>(dev);

  // When Dev-mode toggles at runtime, re-sync this row's open state so
  // ⌘/Ctrl+Shift+D opens all rows globally (or collapses them).
  useEffect(() => {
    setOpenTech(dev);
  }, [dev]);

  const localTime = formatLocalTime(event.ts);
  const subject = leadSubject(event);

  return (
    <li
      data-testid="change-row"
      className="group flex flex-col gap-1 pl-4 py-3"
    >
      <div className="flex flex-wrap items-baseline gap-2">
        {/* Commit msg / prose: 15px semibold = hierarchy hero */}
        <span className="text-[15px] font-semibold text-[color:var(--text,#e5e5e5)]">
          {event.prose}
        </span>
        <button
          type="button"
          onClick={() => setOpenTech((v) => !v)}
          className="text-xs text-[color:var(--text-muted,#8a8a8c)] underline-offset-2 hover:text-[color:var(--text,#e5e5e5)] hover:underline"
          data-testid="change-row-tech-toggle"
          aria-expanded={openTech}
        >
          {L.changesDevToggleLabel}
        </button>
        <ExplainTooltip text={L.changesExplainDevToggle} />
      </div>
      {/* Class 5C — per-row identity line so same-bucket rows never collide. */}
      <div
        data-testid="change-row-meta"
        className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--text-muted,#8a8a8c)]"
      >
        <span
          className="font-mono tabular-nums"
          data-testid="change-row-time"
        >
          {localTime}
        </span>
        <span aria-hidden className="text-[color:var(--text-dim,#555559)]">·</span>
        <span
          className="font-mono text-[color:var(--text-dim,#777)]"
          title={event.sha}
          data-testid="change-row-sha"
        >
          {event.shaShort}
        </span>
        {subject ? (
          <>
            <span aria-hidden className="text-[color:var(--text-dim,#555559)]">·</span>
            <span
              className="min-w-0 truncate"
              title={subject}
              data-testid="change-row-subject"
            >
              {subject}
            </span>
          </>
        ) : null}
      </div>
      {openTech ? <DevModeDetail event={event} /> : null}
    </li>
  );
}
