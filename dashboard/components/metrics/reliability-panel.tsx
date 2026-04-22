"use client";

/**
 * Reliability panel composer (Phase 7 — REQ-7-WELL).
 *
 * Consumes `useMetricsPoll()` (provider is mounted by `/metrics/page.tsx`) and
 * renders four sub-components:
 *   - <SuccessGauge> × 9 — one per agent in AGENT_META order
 *   - <RetryHeatmap> — 7x24 tailwind grid
 *   - <HaltEventsLog> — chronological
 *   - <SentinelRejectTrend> — sparkline
 *
 * Handles three render states:
 *   1. error with no data → error card with the failed-to-load copy
 *   2. loading (no data yet) → loading card with empty-state copy
 *   3. loaded → full panel with lede line (weighted rate across n>=5 agents)
 *
 * Lede math: weight success_rate by sample_n so a 100% / n=5 agent doesn't
 * outweigh a 90% / n=500 agent. Agents with n<5 are excluded from the lede
 * (and the underlying gauges show the insufficient-samples banner).
 *
 * 07-05: ExplainTooltip anchors attached next to lede (success rate) and
 * retry-heatmap h3.
 */

import { useRouter } from "next/navigation";
import { LineChart } from "lucide-react";
import { useMetricsPoll } from "@/lib/hooks/use-metrics-poll";
import { labelFor } from "@/lib/copy/labels";
import { useDevMode } from "@/lib/providers/dev-mode";
import { AGENT_META, type AgentName } from "@/lib/copy/agent-meta";
import { SuccessGauge } from "./success-gauge";
import { RetryHeatmap } from "./retry-heatmap";
import { HaltEventsLog } from "./halt-events-log";
import { SentinelRejectTrend } from "./sentinel-reject-trend";
import { ExplainTooltip } from "@/components/ui/explain-tooltip";
import { GoldenSignalsSubtitle } from "./golden-signals-subtitles";
import { Panel } from "@/components/ui/panel";
import { EmptyState, EmptyStateActions } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

const MIN_SAMPLES_FOR_LEDE = 5;

export function ReliabilityPanel() {
  const { data, error, loading } = useMetricsPoll();
  const { dev } = useDevMode();
  const L = labelFor(dev);
  const router = useRouter();

  if (error && !data) {
    return (
      <Panel
        title={L.metricsWellHeading}
        headingId="reliability-heading"
        testId="reliability-panel-error"
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
        title={L.metricsWellHeading}
        headingId="reliability-heading"
        testId="reliability-panel-loading"
      >
        <p className="text-sm text-[color:var(--text-muted)]">{L.metricsEmptyState}</p>
      </Panel>
    );
  }

  // Only show EmptyState when fetch has completed and genuinely returned no data.
  if (!loading && !data) {
    return (
      <Panel
        title={L.metricsWellHeading}
        headingId="reliability-heading"
        testId="reliability-panel-empty"
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
  const r = data!.reliability;

  // Sample-weighted overall rate across agents with n >= 5.
  const qualified = r.per_agent_7d.filter(
    (p) => p.sample_n >= MIN_SAMPLES_FOR_LEDE,
  );
  const totalN = qualified.reduce((s, p) => s + p.sample_n, 0);
  const weightedRate =
    totalN === 0
      ? 0
      : qualified.reduce((s, p) => s + p.success_rate * p.sample_n, 0) / totalN;

  // Lookup per_agent_7d entry by agent name for gauge composition.
  const byAgent = new Map(r.per_agent_7d.map((p) => [p.agent, p]));

  return (
    <Panel
      title={L.metricsWellHeading}
      headingId="reliability-heading"
      testId="reliability-panel"
      className="flex flex-col gap-6"
    >
      <div>
        <GoldenSignalsSubtitle panel="howwell" />
        <p className="flex items-center gap-1.5 text-sm text-[color:var(--text-muted)]">
          <span>{L.metricsWellLede(weightedRate)}</span>
          <ExplainTooltip
            text={L.metricsExplainSuccessRate}
            ariaLabel="Explain success rate"
          />
        </p>
      </div>

      {/* Per-agent gauges — iterate AGENT_META so every agent shows even when
          the aggregator omits one (defensive; aggregator currently emits all 9). */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {(Object.keys(AGENT_META) as AgentName[]).map((name) => {
          const meta = AGENT_META[name];
          const entry = byAgent.get(name) ?? {
            agent: name,
            success_rate: 0,
            sample_n: 0,
          };
          return (
            <SuccessGauge
              key={name}
              rate={entry.success_rate}
              sampleN={entry.sample_n}
              label={meta.label}
              founderLabel={meta.founder_label}
            />
          );
        })}
      </div>

      {/* Retry heatmap */}
      <div className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-sm font-medium text-[color:var(--text-muted)]">
          <span>{L.metricsWellRetryHeatmapHeading}</span>
          <ExplainTooltip
            text={L.metricsExplainRetryHeatmap}
            ariaLabel="Explain retry heatmap"
          />
        </h3>
        <RetryHeatmap cells={r.retry_heatmap} />
      </div>

      {/* Halt events */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-[color:var(--text-muted)]">
          {L.metricsWellHaltsHeading}
        </h3>
        <HaltEventsLog events={r.halt_events} />
      </div>

      {/* Sentinel reject trend */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-[color:var(--text-muted)]">
          {L.metricsWellSentinelTrendHeading}
        </h3>
        <SentinelRejectTrend data={r.sentinel_rejects_30d} />
      </div>
    </Panel>
  );
}
