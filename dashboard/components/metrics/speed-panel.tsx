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

import { useRouter } from "next/navigation";
import { LineChart } from "lucide-react";
import { useMetricsPoll } from "@/lib/hooks/use-metrics-poll";
import { labelFor } from "@/lib/copy/labels";
import { useDevMode } from "@/lib/providers/dev-mode";
import { PerAgentWallTable } from "./per-agent-wall-table";
import { TimeToMergeHistogram } from "./time-to-merge-histogram";
import { QueueDepthDisplay } from "./queue-depth-display";
import { ExplainTooltip } from "@/components/ui/explain-tooltip";
import { Panel } from "@/components/ui/panel";
import { EmptyState, EmptyStateActions } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { GoldenSignalsSubtitle } from "./golden-signals-subtitles";

export function SpeedPanel() {
  const { data, error, loading } = useMetricsPoll();
  const { dev } = useDevMode();
  const L = labelFor(dev);
  const router = useRouter();

  if (error && !data) {
    return (
      <Panel
        title={L.metricsFastHeading}
        headingId="speed-heading"
        testId="speed-panel-error"
      >
        <p className="text-sm text-[color:var(--text-muted)]">
          {L.metricsFailedToLoad}
        </p>
      </Panel>
    );
  }

  // WR-02: show loading state while first fetch is in-flight, not EmptyState.
  if (loading && !data) {
    return (
      <Panel
        title={L.metricsFastHeading}
        headingId="speed-heading"
        testId="speed-panel-loading"
      >
        <p className="text-sm text-[color:var(--text-muted)]">{L.metricsEmptyState}</p>
      </Panel>
    );
  }

  // Only show EmptyState when fetch has completed and genuinely returned no data.
  if (!loading && !data) {
    return (
      <Panel
        title={L.metricsFastHeading}
        headingId="speed-heading"
        testId="speed-panel-empty"
      >
        <EmptyState
          icon={LineChart}
          heading={L.emptyMetricsPanelHeading}
          body={L.emptyMetricsPanelBody}
          actions={
            <EmptyStateActions>
              <Button variant="secondary" onClick={() => router.push("/chat")}>
                {L.emptyMetricsPanelCtaTest}
              </Button>
            </EmptyStateActions>
          }
        />
      </Panel>
    );
  }

  // data is guaranteed non-null here — all null paths return early above.
  const sp = data!.speed;

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
    <Panel
      title={L.metricsFastHeading}
      headingId="speed-heading"
      testId="speed-panel"
      className="flex flex-col gap-6"
    >
      <div>
        <GoldenSignalsSubtitle panel="howfast" />
        <p className="text-sm text-[color:var(--text-muted)]">
          {L.metricsFastLede(overallP50)}
        </p>
      </div>

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
    </Panel>
  );
}
