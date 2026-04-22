"use client";

/**
 * Phase 7 — Spending panel composer (REQ-7-SPEND).
 *
 * Consumes `useMetricsPoll()` and renders the three render states:
 *   1. error-without-data  — panel shell + failed-to-load note
 *   2. loading (data null) — panel shell + empty-state copy
 *   3. loaded              — full panel: big-number row + stacked bar + sparkline + top-10
 *
 * Composition (all children are `"use client"` islands themselves):
 *   - <EstDisclaimer>       in panel header, right-aligned
 *   - <AgentStackedBar>     for by_agent_30d (recharts)
 *   - <SpendingDailyLine>   for daily_30d (sparkline reuse)
 *   - <TopExpensiveTasks>   for top_expensive (<ol> list)
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
 */

import { useMetricsPoll } from "@/lib/hooks/use-metrics-poll";
import { labelFor } from "@/lib/copy/labels";
import { useDevMode } from "@/lib/providers/dev-mode";
import { AgentStackedBar } from "./agent-stacked-bar";
import { SpendingDailyLine } from "./spending-daily-line";
import { TopExpensiveTasks } from "./top-expensive-tasks";
import { EstDisclaimer } from "./est-disclaimer";

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(1) + "k";
  return (n / 1_000_000).toFixed(2) + "M";
}

export function SpendingPanel() {
  const { data, error } = useMetricsPoll();
  const { dev } = useDevMode();
  const L = labelFor(dev);

  if (error && !data) {
    return (
      <section
        data-testid="spending-panel-error"
        aria-labelledby="spending-heading"
        className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6"
      >
        <h2
          id="spending-heading"
          className="text-lg font-semibold text-[color:var(--text)]"
        >
          {L.metricsSpendingHeading}
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
        data-testid="spending-panel-loading"
        aria-labelledby="spending-heading"
        className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6"
      >
        <h2
          id="spending-heading"
          className="text-lg font-semibold text-[color:var(--text)]"
        >
          {L.metricsSpendingHeading}
        </h2>
        <p className="mt-2 text-sm text-[color:var(--text-muted)]">
          {L.metricsEmptyState}
        </p>
      </section>
    );
  }

  const s = data.spending;

  return (
    <section
      data-testid="spending-panel"
      aria-labelledby="spending-heading"
      className="flex flex-col gap-6 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6"
    >
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h2
          id="spending-heading"
          className="text-lg font-semibold text-[color:var(--text)]"
        >
          {L.metricsSpendingHeading}
        </h2>
        <EstDisclaimer />
      </header>

      {/* Big-number row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <BigNumber
          label={L.metricsSpendingTodayLabel}
          value={formatTokens(s.tokens_today) + " tok"}
          testId="spending-today"
        />
        <BigNumber
          label={L.metricsSpendingMtdLabel}
          value={formatTokens(s.tokens_mtd) + " tok"}
          testId="spending-mtd"
        />
        <BigNumber
          label={L.metricsSpendingProjectedLabel}
          value={"~" + formatTokens(s.tokens_projected_monthly) + " tok"}
          testId="spending-projected"
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
        <h3 className="text-sm font-medium text-[color:var(--text-muted)]">
          {L.metricsSpendingTopTasksHeading}
        </h3>
        <TopExpensiveTasks data={s.top_expensive} />
      </div>
    </section>
  );
}

interface BigNumberProps {
  label: string;
  value: string;
  testId: string;
}

function BigNumber({ label, value, testId }: BigNumberProps) {
  return (
    <div
      data-testid={testId}
      className="flex flex-col gap-1 rounded-md bg-[color:var(--surface-hover)] p-4"
    >
      <span className="text-xs uppercase tracking-wider text-[color:var(--text-muted)]">
        {label}
      </span>
      <span className="font-mono text-2xl text-[color:var(--text)]">
        {value}
      </span>
    </div>
  );
}
