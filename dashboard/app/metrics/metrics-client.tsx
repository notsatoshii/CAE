"use client";

/**
 * Phase 7 — /metrics client island (D-09, D-06).
 *
 * Mounts MetricsPollProvider ONCE around all three panels so they share a
 * single 30s poll cycle (D-06). Panels consume `useMetricsPoll()` internally
 * and throw if used outside a provider — this wrapper is the anchor.
 *
 * Kept intentionally small: any future page-level controls (date-range
 * picker, project filter) live here, not in the server page.
 */

import { MetricsPollProvider } from "@/lib/hooks/use-metrics-poll";
import { SpendingPanel } from "@/components/metrics/spending-panel";
import { ReliabilityPanel } from "@/components/metrics/reliability-panel";
import { SpeedPanel } from "@/components/metrics/speed-panel";
import { IncidentStream } from "@/components/shell/incident-stream";

export function MetricsClient() {
  return (
    <MetricsPollProvider intervalMs={30_000}>
      {/* 3-panel Golden Signals grid */}
      <div className="flex flex-col gap-6" data-testid="metrics-client">
        {/* Row 1: Spending + Incident Stream side by side on md+ */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <SpendingPanel />
          {/* Incident Stream: plan 13-08 — surfaces pino logs from .cae/logs/dashboard.log.jsonl */}
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--bg-elev)] p-5">
            <IncidentStream />
          </div>
        </div>
        {/* Row 2: Reliability + Speed */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <ReliabilityPanel />
          <SpeedPanel />
        </div>
      </div>
    </MetricsPollProvider>
  );
}
