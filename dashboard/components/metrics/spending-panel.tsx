"use client";

/**
 * Phase 7 — Spending panel composer (REQ-7-SPEND).
 *
 * Consumes `useMetricsPoll()` and renders the three render states:
 *   1. error-without-data  — panel shell + failed-to-load note
 *   2. loading (data null) — panel shell + CardSkeleton placeholders
 *   3. loaded              — full panel: big-number row + stacked bar + sparkline + top-10
 *
 * Composition (all children are `"use client"` islands themselves):
 *   - <EstDisclaimer>       in panel header, right-aligned
 *   - <AgentStackedBar>     for by_agent_30d (recharts)
 *   - <SpendingDailyLine>   for daily_30d (sparkline reuse)
 *   - <TopExpensiveTasks>   for top_expensive (<ol> list)
 *   - <ExplainTooltip>      next to big-number labels + top-tasks heading (07-05)
 *
 * Design notes:
 * - <section aria-labelledby="spending-heading"> makes the whole panel a
 *   landmark for screen readers.
 * - Each big-number card carries a data-testid so Wave 4 UAT can locate them.
 * - Projected value shows with a leading tilde ("~") to signal it's an
 *   estimate. Kept inline (not in labels.ts) because it's a math convention,
 *   not translatable user-facing copy — the copy is L.metricsSpendingProjectedLabel.
 * - No `MetricsPollProvider` here — the page shell (07-05) mounts the
 *   provider once around all panels. This panel assumes the provider is
 *   above it in the tree (useMetricsPoll() throws if not).
 * - No recharts imports in this file; sub-charts isolate that dependency.
 *
 * Phase 15 Wave 2.7: loading copy replaced by <CardSkeleton> grid so the
 * pre-fetch state visually matches the loaded layout instead of collapsing
 * to a single line of text.
 */

import { useRouter } from "next/navigation";
import { LineChart } from "lucide-react";
import { useMetricsPoll } from "@/lib/hooks/use-metrics-poll";
import { labelFor } from "@/lib/copy/labels";
import { useDevMode } from "@/lib/providers/dev-mode";
import { AgentStackedBar } from "./agent-stacked-bar";
import { SpendingDailyLine } from "./spending-daily-line";
import { TopExpensiveTasks } from "./top-expensive-tasks";
import { EstDisclaimer } from "./est-disclaimer";
import { ExplainTooltip } from "@/components/ui/explain-tooltip";
import { GoldenSignalsSubtitle } from "./golden-signals-subtitles";
import { Panel } from "@/components/ui/panel";
import { EmptyState, EmptyStateActions } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { CardSkeleton, Skeleton } from "@/components/ui/skeleton";
import { LastUpdated } from "@/components/ui/last-updated";

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(1) + "k";
  return (n / 1_000_000).toFixed(2) + "M";
}

const METRICS_STALE_MS = 60_000;

export function SpendingPanel() {
  const { data, error, loading, lastUpdated } = useMetricsPoll();
  const { dev } = useDevMode();
  const L = labelFor(dev);
  const router = useRouter();

  if (error && !data) {
    return (
      <Panel
        title={L.metricsSpendingHeading}
        headingId="spending-heading"
        testId="spending-panel-error"
        dataLiveness="error"
      >
        <span className="sr-only" data-truth="metrics-spending.error">yes</span>
        <p className="text-sm text-[color:var(--text-muted)]">
          {L.metricsFailedToLoad}
        </p>
      </Panel>
    );
  }

  // WR-02: show loading state while first fetch is in-flight, not EmptyState.
  // Phase 15 Wave 2.7: skeleton placeholders mirror the loaded big-number row +
  // sparkline so the layout doesn't shift when data lands.
  if (loading && !data) {
    return (
      <Panel
        title={L.metricsSpendingHeading}
        headingId="spending-heading"
        testId="spending-panel-loading"
        dataLiveness="loading"
      >
        <span className="sr-only" data-truth="metrics.loading">yes</span>
        <span className="sr-only" data-truth="metrics-spending.loading">yes</span>
        <div className="flex flex-col gap-6">
          <span className="sr-only">{L.metricsEmptyState}</span>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <CardSkeleton testId="spending-skeleton-card-0" />
            <CardSkeleton testId="spending-skeleton-card-1" />
            <CardSkeleton testId="spending-skeleton-card-2" />
          </div>
          <Skeleton height={64} width="100%" testId="spending-skeleton-bar" label="Loading spending bar" />
          <Skeleton height={32} width="100%" testId="spending-skeleton-line" label="Loading spending sparkline" />
        </div>
      </Panel>
    );
  }

  // Only show EmptyState when fetch has completed and genuinely returned no data.
  if (!loading && !data) {
    return (
      <Panel
        title={L.metricsSpendingHeading}
        headingId="spending-heading"
        testId="spending-panel-empty"
        dataLiveness="empty"
      >
        <span className="sr-only" data-truth="metrics.empty">yes</span>
        <span className="sr-only" data-truth="metrics-spending.empty">yes</span>
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
  const s = data!.spending;
  const isStale =
    lastUpdated !== null && Date.now() - lastUpdated > METRICS_STALE_MS;
  const liveness: "stale" | "healthy" = isStale ? "stale" : "healthy";

  return (
    <Panel
      title={L.metricsSpendingHeading}
      headingId="spending-heading"
      testId="spending-panel"
      subtitle={
        <span className="flex items-center gap-2">
          <EstDisclaimer />
          <LastUpdated at={lastUpdated} threshold_ms={METRICS_STALE_MS} />
        </span>
      }
      className="flex flex-col gap-6"
      dataLiveness={liveness}
    >
      <span className="sr-only" data-truth="metrics.healthy">yes</span>
      <span className="sr-only" data-truth={`metrics-spending.${liveness}`}>yes</span>
      <span className="sr-only" data-truth="metrics.tokens-today">{s.tokens_today}</span>
      <span className="sr-only" data-truth="metrics.tokens-mtd">{s.tokens_mtd}</span>
      <span className="sr-only" data-truth="metrics.tokens-projected-monthly">
        {s.tokens_projected_monthly}
      </span>
      <span className="sr-only" data-truth="metrics.top-expensive-count">
        {s.top_expensive.length}
      </span>
      <GoldenSignalsSubtitle panel="spending" />

      {/* Big-number row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <BigNumber
          label={L.metricsSpendingTodayLabel}
          value={formatTokens(s.tokens_today) + " tok"}
          testId="spending-today"
          explainText={L.metricsExplainTokens}
        />
        <BigNumber
          label={L.metricsSpendingMtdLabel}
          value={formatTokens(s.tokens_mtd) + " tok"}
          testId="spending-mtd"
          explainText={L.metricsExplainTokens}
        />
        <BigNumber
          label={L.metricsSpendingProjectedLabel}
          value={"~" + formatTokens(s.tokens_projected_monthly) + " tok"}
          testId="spending-projected"
          explainText={L.metricsExplainProjected}
        />
      </div>

      {/* Stacked bar — by agent */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-[color:var(--text-muted)]">
          {L.metricsSpendingByAgentHeading}
        </h3>
        <AgentStackedBar data={s.by_agent_30d} />
      </div>

      {/* Sparkline — daily 30d */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-[color:var(--text-muted)]">
          {L.metricsSpendingDaily30dHeading}
        </h3>
        <SpendingDailyLine data={s.daily_30d} />
      </div>

      {/* Top-10 expensive */}
      <div className="flex flex-col gap-2">
        <h3 className="flex items-center gap-2 text-sm font-medium text-[color:var(--text-muted)]">
          <span>{L.metricsSpendingTopTasksHeading}</span>
          <ExplainTooltip
            text={L.metricsExplainTokens}
            ariaLabel="Explain expensive tasks"
          />
        </h3>
        <TopExpensiveTasks data={s.top_expensive} />
      </div>
    </Panel>
  );
}

interface BigNumberProps {
  label: string;
  value: string;
  testId: string;
  explainText?: string;
}

function BigNumber({ label, value, testId, explainText }: BigNumberProps) {
  return (
    <div
      data-testid={testId}
      className="flex flex-col gap-1 rounded-md bg-[color:var(--surface-hover)] p-4"
    >
      <span className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
        {label}
        {explainText ? (
          <ExplainTooltip text={explainText} ariaLabel={"Explain " + label} />
        ) : null}
      </span>
      <span className="font-mono text-2xl text-[color:var(--text)]">
        {value}
      </span>
    </div>
  );
}
