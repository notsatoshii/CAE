"use client";

/**
 * 7-row x 24-col retry heatmap (Phase 7 Reliability panel).
 *
 * Plain Tailwind grid of 168 cells — NO recharts (per D-04). Background alpha
 * of each cell scales to its retry count over the global max; empty cells get
 * alpha 0. Rows = days of week (Sun..Sat, matching `getUTCDay()` 0..6), cols =
 * UTC hours 0..23.
 *
 * Expects `cells` to already be the 168-cell always-present array emitted by
 * the aggregator (zero-filled). Empty-state message is shown when every count
 * is zero — we still render the grid above it for layout stability.
 */

import * as React from "react";

interface Cell {
  dow: number;
  hour: number;
  count: number;
}

interface Props {
  cells: Cell[];
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export function RetryHeatmap({ cells }: Props) {
  const max = Math.max(1, ...cells.map((c) => c.count));
  const map = new Map<string, number>();
  for (const c of cells) map.set(c.dow + "-" + c.hour, c.count);

  const isEmpty = cells.every((c) => c.count === 0);

  return (
    <div data-testid="retry-heatmap" className="flex flex-col gap-2">
      <div
        className="grid gap-px text-[10px] font-mono"
        style={{ gridTemplateColumns: "28px repeat(24, minmax(0, 1fr))" }}
      >
        {/* Header row: blank corner + hours 0..23 */}
        <div aria-hidden="true" />
        {Array.from({ length: 24 }).map((_, h) => (
          <div
            key={"h-" + h}
            className="text-center text-[color:var(--text-dim)]"
          >
            {h}
          </div>
        ))}
        {/* Data rows: label + 24 cells */}
        {DAY_LABELS.map((d, dow) => (
          <React.Fragment key={"row-" + dow}>
            <div className="pr-1 text-right text-[color:var(--text-dim)]">
              {d}
            </div>
            {Array.from({ length: 24 }).map((_, h) => {
              const n = map.get(dow + "-" + h) ?? 0;
              const alpha = n === 0 ? 0 : (0.15 + (n / max) * 0.85);
              return (
                <div
                  key={"c-" + dow + "-" + h}
                  title={n + " retries"}
                  aria-label={
                    DAY_LABELS[dow] + " " + h + ":00 - " + n + " retries"
                  }
                  className="h-4 rounded-sm"
                  style={{ background: "rgba(239, 68, 68, " + alpha + ")" }}
                  data-count={n}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
      {isEmpty && (
        <span className="text-xs text-[color:var(--text-dim)]">
          No retries in the last 7 days.
        </span>
      )}
    </div>
  );
}
