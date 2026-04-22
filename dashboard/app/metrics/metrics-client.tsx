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

export function MetricsClient() {
  return (
    <MetricsPollProvider intervalMs={30_000}>
      <div className="flex flex-col gap-6" data-testid="metrics-client">
        <SpendingPanel />
        <ReliabilityPanel />
        <SpeedPanel />
      </div>
    </MetricsPollProvider>
  );
}
