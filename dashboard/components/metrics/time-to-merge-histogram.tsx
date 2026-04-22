"use client";

/**
 * Time-to-merge histogram (Phase 7 Speed panel).
 *
 * Recharts `<BarChart>` over the pre-binned `time_to_merge_bins` array from
 * the aggregator. Bins are fixed ("<1m" | "1-5m" | "5-15m" | "15m-1h" | ">1h")
 * and always returned in that order even when empty — we render linear-scale
 * bars against the label axis; no re-binning on the client (per D-10).
 *
 * Recharts note: v3 requires "use client"; rendering inside a server component
 * would throw at runtime. Kept independent of the panel composer so it can be
 * swapped for a dynamic import later if hydration-mismatch issues appear.
 *
 * Tooltip formatter types in recharts v3 are strict: `value` is the widened
 * `ValueType` union, so we coerce to number inside the callback rather than
 * annotating the parameter (which no longer satisfies `Formatter<ValueType>`).
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { labelFor } from "@/lib/copy/labels";
import { useDevMode } from "@/lib/providers/dev-mode";

interface Bin {
  bin_label: string;
  count: number;
}

interface Props {
  bins: Bin[];
}

export function TimeToMergeHistogram({ bins }: Props) {
  const { dev } = useDevMode();
  const L = labelFor(dev);

  const isEmpty = bins.every((b) => b.count === 0);

  if (isEmpty) {
    return (
      <div
        data-testid="time-to-merge-empty"
        className="flex h-48 items-center justify-center rounded-md border border-dashed border-[color:var(--border)] text-sm text-[color:var(--text-dim)]"
      >
        No shipped jobs to chart yet.
      </div>
    );
  }

  return (
    <div data-testid="time-to-merge-histogram" className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bins} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            opacity={0.4}
          />
          <XAxis
            dataKey="bin_label"
            stroke="var(--text-muted)"
            fontSize={11}
            tickLine={false}
          />
          <YAxis
            stroke="var(--text-muted)"
            fontSize={11}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 12,
            }}
            cursor={{ fill: "var(--surface-hover)", opacity: 0.3 }}
            formatter={(value, _name, item) => {
              const n = typeof value === "number" ? value : Number(value) || 0;
              const payload = (item as { payload?: Bin } | undefined)?.payload;
              const bin = payload ? payload.bin_label : "";
              return [L.metricsFastTimeToMergeBinLabel(bin, n), ""];
            }}
          />
          <Bar dataKey="count" fill="var(--accent, #00d4ff)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
