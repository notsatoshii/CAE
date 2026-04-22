"use client";

/**
 * Sentinel-reject 30d trend sparkline (Phase 7 Reliability panel).
 *
 * Reuses the hand-rolled `<Sparkline>` primitive (D-04 — no recharts for 30d
 * lines). Values plotted = daily reject count; the trailing span reports the
 * 30d total so the sparkline carries scale context even when axes are absent.
 */

import { Sparkline } from "@/components/ui/sparkline";

interface Props {
  data: Array<{ date: string; rejects: number; approvals: number }>;
}

export function SentinelRejectTrend({ data }: Props) {
  const values = data.map((d) => d.rejects);
  const totalRejects = values.reduce((sum, v) => sum + v, 0);

  return (
    <div
      data-testid="sentinel-reject-trend"
      className="flex items-center gap-3"
    >
      <Sparkline
        values={values}
        width={240}
        height={36}
        color="var(--warning, #eab308)"
        ariaLabel="Sentinel reject count, last 30 days"
      />
      <span className="font-mono text-xs text-[color:var(--text-muted)]">
        {totalRejects} push-backs (30d)
      </span>
    </div>
  );
}
