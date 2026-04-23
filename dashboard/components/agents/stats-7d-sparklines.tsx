"use client";

/**
 * Stats7dSparklines — three inline sparklines for an agent's last-7d trend.
 *
 * Eric's P15 audit (#1) flagged that `stats_7d.tokens_per_hour`,
 * `success_history`, and `wall_history` were available on AgentDetailEntry
 * but never rendered. This row fixes that gap by emitting one Sparkline per
 * series under the Lifetime grid.
 *
 * Bucket semantics: each series is a 10-element array spanning 7 days
 * (oldest → newest, matching cae-agents-state.ts §buildRosterEntryForAgent).
 * Hover-tooltip via the chip's title attribute summarises the latest value.
 *
 * Color tokens — uses existing CSS vars per the constraint "don't introduce
 * new colors":
 *   - invocations  → --accent (cyan)
 *   - success rate → --success
 *   - tokens cost  → --warning
 */

import { Sparkline } from "@/components/ui/sparkline";
import type { AgentRosterEntry } from "@/lib/cae-agents-state";

interface Props {
  stats_7d: AgentRosterEntry["stats_7d"];
}

function formatTok(n: number): string {
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) return (n / 1000).toFixed(1) + "k";
  return (n / 1_000_000).toFixed(2) + "M";
}

function formatMs(ms: number): string {
  if (ms < 1000) return Math.round(ms) + "ms";
  const sec = ms / 1000;
  if (sec < 60) return sec.toFixed(1) + "s";
  const min = sec / 60;
  return min.toFixed(1) + "m";
}

function latest(values: number[]): number {
  if (!values || values.length === 0) return 0;
  return values[values.length - 1];
}

export function Stats7dSparklines({ stats_7d }: Props) {
  // The aggregator emits tokens_per_hour, success_history, wall_history.
  // To approximate "invocations per day" we use tokens_per_hour as the
  // activity proxy — invocation count per bucket isn't shipped today, so
  // tokens-per-hour is the closest available velocity series. The success
  // and wall series ARE per-completion, so they map directly.
  const invocationsSeries = stats_7d.tokens_per_hour ?? [];
  const successSeries = (stats_7d.success_history ?? []).map((v) => v * 100);
  const wallSeries = stats_7d.wall_history ?? [];

  return (
    <section
      data-testid="stats-7d-sparklines"
      aria-labelledby="stats-7d-heading"
      className="flex flex-col gap-2"
    >
      <h4
        id="stats-7d-heading"
        className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted,#8a8a8c)]"
      >
        Last 7 days
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SparklineCell
          testId="sparkline-invocations"
          label="Activity"
          value={formatTok(latest(invocationsSeries)) + " tok/hr"}
          values={invocationsSeries}
          color="var(--accent, #00d4ff)"
          ariaLabel="7-day activity sparkline (tokens per hour, oldest to newest)"
        />
        <SparklineCell
          testId="sparkline-success"
          label="Success rate"
          value={Math.round(latest(successSeries)) + "%"}
          values={successSeries}
          color="var(--success, #22c55e)"
          ariaLabel="7-day success-rate sparkline (percent, oldest to newest)"
        />
        <SparklineCell
          testId="sparkline-tokens"
          label="Avg wall time"
          value={formatMs(latest(wallSeries))}
          values={wallSeries}
          color="var(--warning, #f59e0b)"
          ariaLabel="7-day average-wall-time sparkline (ms, oldest to newest)"
        />
      </div>
    </section>
  );
}

interface CellProps {
  testId: string;
  label: string;
  value: string;
  values: number[];
  color: string;
  ariaLabel: string;
}

function SparklineCell({ testId, label, value, values, color, ariaLabel }: CellProps) {
  const hasData = values.some((v) => v > 0);
  return (
    <div
      data-testid={testId}
      data-empty={hasData ? undefined : "true"}
      className="flex flex-col gap-1 rounded-md border border-[color:var(--border,#1f1f22)] bg-[color:var(--surface,#101013)] p-2"
    >
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-[color:var(--text-muted,#8a8a8c)]">{label}</span>
        <span className="font-mono text-xs text-[color:var(--text,#e5e5e5)]">{value}</span>
      </div>
      <div className="w-full">
        <Sparkline
          values={values}
          height={24}
          color={color}
          className="w-full"
          ariaLabel={ariaLabel}
        />
      </div>
    </div>
  );
}
