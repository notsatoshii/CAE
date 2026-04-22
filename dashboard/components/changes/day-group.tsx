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
import { ChangeRow } from "./change-row";
import type { ChangeEvent } from "@/lib/cae-changes-state";

/**
 * NOTE — we intentionally avoid importing runtime helpers from
 * `@/lib/cae-changes-state`: that module imports `child_process`, which
 * Turbopack cannot bundle for a Client Component. Only `import type` is
 * safe here (types are erased at compile time). Bucket math below is a
 * tiny, client-safe re-implementation matching the 09-02 bucket contract
 * (same UTC-day / yesterday / 2-6 day weekday / ≥7 day M/D).
 */

type Bucket =
  | { kind: "today" }
  | { kind: "yesterday" }
  | { kind: "week"; key: string }
  | { kind: "older"; key: string };

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function bucketForTs(isoTs: string, now: Date): Bucket {
  const tsMs = Date.parse(isoTs);
  if (!Number.isFinite(tsMs)) return { kind: "older", key: "—" };
  const ts = new Date(tsMs);

  const sameUtcDay =
    ts.getUTCFullYear() === now.getUTCFullYear() &&
    ts.getUTCMonth() === now.getUTCMonth() &&
    ts.getUTCDate() === now.getUTCDate();
  if (sameUtcDay) return { kind: "today" };

  const yesterday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1),
  );
  if (
    ts.getUTCFullYear() === yesterday.getUTCFullYear() &&
    ts.getUTCMonth() === yesterday.getUTCMonth() &&
    ts.getUTCDate() === yesterday.getUTCDate()
  ) {
    return { kind: "yesterday" };
  }

  const dayDeltaMs =
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
    Date.UTC(ts.getUTCFullYear(), ts.getUTCMonth(), ts.getUTCDate());
  const dayDelta = Math.round(dayDeltaMs / 86_400_000);

  if (dayDelta >= 2 && dayDelta <= 6) {
    return { kind: "week", key: WEEKDAYS[ts.getUTCDay()] };
  }

  return { kind: "older", key: `${ts.getUTCMonth() + 1}/${ts.getUTCDate()}` };
}

export function DayGroup({ events }: { events: ChangeEvent[] }) {
  const { dev } = useDevMode();
  const L = labelFor(dev);

  const now = new Date();
  const today: ChangeEvent[] = [];
  const yesterday: ChangeEvent[] = [];
  // Ordered maps preserve first-appearance order of weekday/date keys.
  const thisWeek = new Map<string, ChangeEvent[]>();
  const older = new Map<string, ChangeEvent[]>();

  for (const e of events) {
    const b = bucketForTs(e.ts, now);
    if (b.kind === "today") {
      today.push(e);
    } else if (b.kind === "yesterday") {
      yesterday.push(e);
    } else if (b.kind === "week") {
      const arr = thisWeek.get(b.key);
      if (arr) arr.push(e);
      else thisWeek.set(b.key, [e]);
    } else {
      const arr = older.get(b.key);
      if (arr) arr.push(e);
      else older.set(b.key, [e]);
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
