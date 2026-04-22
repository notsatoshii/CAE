"use client";

/**
 * Phase 9 Wave 2 (plan 09-04) — DayGroup.
 *
 * Buckets a flat, newest-first list of ChangeEvents into day-sections and
 * renders each section with a founder-speak header (Today / Yesterday /
 * weekday) + a divided list of ChangeRow.
 *
 * Bucketing rule (matches 09-02 `relativeTime` output contract):
 *   - Same UTC-calendar-day → "today" bucket (labelled via changesDayToday)
 *   - Previous UTC day      → "yesterday" bucket (changesDayYesterday)
 *   - 2-6 UTC days prior    → weekday name bucket, keyed by the weekday
 *                             string so multiple same-weekday events fold in
 *                             (labelled via changesDayWeek(day))
 *   - ≥7 UTC days prior     → M/D bucket, keyed by the M/D string; labelled
 *                             verbatim (same in founder + dev)
 *
 * Input order is preserved within each bucket (events are already sorted
 * newest-first by the 09-02 aggregator; we append in-order).
 */

import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { relativeTime } from "@/lib/cae-changes-state";
import { ChangeRow } from "./change-row";
import type { ChangeEvent } from "@/lib/cae-changes-state";

type Bucket = "today" | "yesterday" | "week" | "older";

function bucketFromRelTime(rt: string): Bucket {
  if (
    rt === "just now" ||
    rt === "this morning" ||
    rt === "this afternoon" ||
    rt === "this evening"
  ) {
    return "today";
  }
  if (rt === "yesterday") return "yesterday";
  // Weekday names are alphabetic-only ("Sunday", "Monday", ...). M/D forms
  // contain a digit, so detect by whether the string has any digits.
  if (/\d/.test(rt)) return "older";
  return "week";
}

export function DayGroup({ events }: { events: ChangeEvent[] }) {
  const { dev } = useDevMode();
  const L = labelFor(dev);

  const today: ChangeEvent[] = [];
  const yesterday: ChangeEvent[] = [];
  // Ordered maps preserve first-appearance order of weekday/date keys.
  const thisWeek = new Map<string, ChangeEvent[]>();
  const older = new Map<string, ChangeEvent[]>();

  for (const e of events) {
    const rt = relativeTime(e.ts);
    const b = bucketFromRelTime(rt);
    if (b === "today") {
      today.push(e);
    } else if (b === "yesterday") {
      yesterday.push(e);
    } else if (b === "week") {
      const arr = thisWeek.get(rt);
      if (arr) arr.push(e);
      else thisWeek.set(rt, [e]);
    } else {
      const arr = older.get(rt);
      if (arr) arr.push(e);
      else older.set(rt, [e]);
    }
  }

  const sections: Array<{ key: string; label: string; evs: ChangeEvent[] }> = [];
  if (today.length) {
    sections.push({ key: "today", label: L.changesDayToday, evs: today });
  }
  if (yesterday.length) {
    sections.push({
      key: "yesterday",
      label: L.changesDayYesterday,
      evs: yesterday,
    });
  }
  for (const [day, evs] of thisWeek) {
    sections.push({ key: `week-${day}`, label: L.changesDayWeek(day), evs });
  }
  for (const [day, evs] of older) {
    sections.push({ key: `older-${day}`, label: day, evs });
  }

  return (
    <div className="space-y-4" data-testid="day-group">
      {sections.map(({ key, label, evs }) => (
        <div key={key}>
          <h3 className="mb-2 text-sm font-medium text-[color:var(--text-muted,#8a8a8c)]">
            {label}
          </h3>
          <div className="divide-y divide-[color:var(--border,#1f1f22)]">
            {evs.map((e) => (
              <ChangeRow key={e.sha} event={e} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
