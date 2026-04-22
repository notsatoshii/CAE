"use client";

/**
 * Speed panel composer (Phase 7 — REQ-7-FAST).
 *
 * Consumes `useMetricsPoll()` (provider is mounted by `/metrics/page.tsx`) and
 * renders three sub-components:
 *   - <PerAgentWallTable> — P50/P95 by agent
 *   - <QueueDepthDisplay> — current inbox depth
 *   - <TimeToMergeHistogram> — recharts bar over 5 fixed bins
 *
 * Three render states mirror ReliabilityPanel: error-no-data, loading, loaded.
 *
 * Lede math: sample-weighted overall P50 across agents with completed jobs.
 * Gives the headline "Most jobs finish in about 3.2s" signal a founder cares
 * about without over-indexing on any single under-sampled agent.
 *
 * 07-05: ExplainTooltip anchors attached next to per-agent heading (P50 + P95),
 * queue-depth card (QueueDepth), and time-to-merge heading (TimeToMerge).
 */

import { useMetricsPoll } from "@/lib/hooks/use-metrics-poll";
import { labelFor } from "@/lib/copy/labels";
import { useDevMode } from "@/lib/providers/dev-mode";
import { PerAgentWallTable } from "./per-agent-wall-table";
import { TimeToMergeHistogram } from "./time-to-merge-histogram";
import { QueueDepthDisplay } from "./queue-depth-display";
import { ExplainTooltip } from "@/components/ui/explain-tooltip";

export function SpeedPanel() {
  const { data, error } = useMetricsPoll();
  const { dev } = useDevMode();
  const L = labelFor(dev);

  if (error && !data) {
    return (
      <section
        data-testid="speed-panel-error"
        aria-labelledby="speed-heading"
        className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6"
      >
        <h2
          id="speed-heading"
          className="text-lg font-semibold text-[color:var(--text)]"
        >
          {L.metricsFastHeading}
        </h2>
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">
          {L.metricsFailedToLoad}
        </p>
      </section>
    );
  }

  if (!data) {
    return (
      <section
        data-testid="speed-panel-loading"
        aria-labelledby="speed-heading"
        className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6"
      >
        <h2
          id="speed-heading"
          className="text-lg font-semibold text-[color:var(--text)]"
        >
          {L.metricsFastHeading}
        </h2>
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">
          {L.metricsEmptyState}
        </p>
      </section>
    );
  }

  const sp = data.speed;

  // Overall P50 across agents with n > 0, weighted by sample count.
  const qualified = sp.per_agent_wall.filter((p) => p.n > 0);
  const totalN = qualified.reduce((s, p) => s + p.n, 0);
  const overallP50 =
    totalN === 0
      ? 0
      : Math.round(
          qualified.reduce((s, p) => s + p.p50_ms * p.n, 0) / totalN,
        );

  return (
    <section
      data-testid="speed-panel"
      aria-labelledby="speed-heading"
      className="flex flex-col gap-6 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6"
    >
      <header>
        <h2
          id="speed-heading"
          className="text-lg font-semibold text-[color:var(--text)]"
        >
          {L.metricsFastHeading}
        </h2>
        <p className="mt-1 text-sm text-[color:var(--text-muted)]">
          {L.metricsFastLede(overallP50)}
        </p>
      </header>

      {/* Per-agent wall + queue depth — side-by-side on wide screens. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-2 lg:col-span-2">
          <h3 className="flex items-center gap-2 text-sm font-medium text-[color:var(--text-muted)]">
            <span>{L.metricsFastPerAgentHeading}</span>
            <ExplainTooltip
              text={L.metricsExplainP50}
              ariaLabel="Explain P50"
            />
            <ExplainTooltip
              text={L.metricsExplainP95}
              ariaLabel="Explain P95"
            />
          </h3>
          <PerAgentWallTable rows={sp.per_agent_wall} />
        </div>
        <div className="flex flex-col gap-1">
          <QueueDepthDisplay value={sp.queue_depth_now} />
          <div className="flex items-center justify-end">
            <ExplainTooltip
              text={L.metricsExplainQueueDepth}
              ariaLabel="Explain queue depth"
            />
          </div>
        </div>
      </div>

      {/* Time-to-merge histogram */}
      <div className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-sm font-medium text-[color:var(--text-muted)]">
          <span>{L.metricsFastTimeToMergeHeading}</span>
          <ExplainTooltip
            text={L.metricsExplainTimeToMerge}
            ariaLabel="Explain time to merge"
          />
        </h3>
        <TimeToMergeHistogram bins={sp.time_to_merge_bins} />
      </div>
    </section>
  );
}
