"use client";

/**
 * Phase 7 — 30-day daily tokens sparkline.
 *
 * Consumes `SpendingState["daily_30d"]` from `getMetricsState()` — 30
 * zero-filled UTC date rows `{ date, tokens }`.
 *
 * Per CONTEXT D-04, this reuses the Phase 5 hand-rolled
 * `components/ui/sparkline.tsx` primitive — NOT recharts. Keeps the v0.1
 * footprint of recharts narrow (only the stacked bar + the time-to-merge
 * histogram in 07-04 pull it in).
 */

import { Sparkline } from "@/components/ui/sparkline";
import type { SpendingState } from "@/lib/cae-metrics-state";

interface Props {
  data: SpendingState["daily_30d"];
}

export function SpendingDailyLine({ data }: Props) {
  const values = data.map((d) => d.tokens);
  const isEmpty = values.length === 0 || values.every((v) => v === 0);

  return (
    <div
      data-testid="spending-daily-line"
      className="flex items-center gap-3"
    >
      <Sparkline
        values={values}
        width={260}
        height={40}
        color="var(--accent, #00d4ff)"
        ariaLabel="Daily token usage, last 30 days"
      />
      {isEmpty && (
        <span className="text-xs text-[color:var(--text-dim)]">
          No data in the last 30 days.
        </span>
      )}
    </div>
  );
}
