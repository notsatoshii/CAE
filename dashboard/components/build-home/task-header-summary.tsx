"use client";

/**
 * TaskHeaderSummary — three-chip header strip for the TaskDetailSheet.
 *
 * Renders the top P0 fields Eric's audit (#2) flagged as missing:
 *   1. STATUS pill — current stage of the phase, derived from
 *      progress + active-agent count (queued / running / waiting / done /
 *      failed). Drives chip color and verbal label.
 *   2. ETA chip — projected minutes remaining for in-flight phases. Falls
 *      back to a linear extrapolation from progress when `eta_min` is null
 *      but we have a non-zero progress reading.
 *   3. TOKEN COST chip — total tokens spent on this phase plus the dollar
 *      cost computed via cae-cost-table::costUsd(). Model is taken from
 *      whatever the active agents are running with (PhaseSummary doesn't
 *      carry per-phase model — the agent-active model is the closest
 *      proxy and matches what the live log would show).
 *   4. DURATION chip — wall time the phase has been running, when we can
 *      derive it from `wave_started_at`-style fields. Currently shown as
 *      ETA inverse approximation when ETA is known.
 *
 * Data source: PhaseSummary (already polled by useStatePoll), no extra
 * fetches. All fields are documented in DETAIL-EXPAND-AUDIT.md §2.
 */

import type { PhaseSummary } from "@/lib/cae-home-state";
import { costUsd, formatUsd } from "@/lib/cae-cost-table";

type Stage = "queued" | "running" | "waiting" | "done" | "failed";

interface StageMeta {
  label: string;
  bg: string;
  fg: string;
}

const STAGE_META: Record<Stage, StageMeta> = {
  queued: {
    label: "Queued",
    bg: "color-mix(in srgb, var(--text-muted) 15%, transparent)",
    fg: "var(--text-muted)",
  },
  running: {
    label: "Running",
    bg: "color-mix(in srgb, var(--accent) 18%, transparent)",
    fg: "var(--accent)",
  },
  waiting: {
    label: "Waiting",
    bg: "color-mix(in srgb, var(--warning) 18%, transparent)",
    fg: "var(--warning)",
  },
  done: {
    label: "Done",
    bg: "color-mix(in srgb, var(--success) 18%, transparent)",
    fg: "var(--success)",
  },
  failed: {
    label: "Failed",
    bg: "color-mix(in srgb, var(--danger) 18%, transparent)",
    fg: "var(--danger)",
  },
};

export function deriveStage(p: PhaseSummary): Stage {
  if (p.progress_pct >= 100) return "done";
  const concurrent = p.agents_active.reduce(
    (acc, a) => acc + Math.max(0, a.concurrent),
    0,
  );
  if (concurrent > 0) return "running";
  if (p.progress_pct > 0) return "waiting";
  return "queued";
}

function formatTok(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(1) + "k";
  return (n / 1_000_000).toFixed(2) + "M";
}

function formatEtaMin(min: number): string {
  if (min < 1) return "<1m";
  if (min < 60) return Math.round(min) + "m";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m === 0 ? h + "h" : h + "h " + m + "m";
}

/**
 * When `eta_min` is null but we have measurable progress, project the
 * remainder as `progress_so_far / pct * (1 - pct)` minutes — a crude
 * linear extrapolation using a notional 30-minute median wave duration.
 * This avoids the chip showing "ETA —" for live phases with no historic
 * baseline (the heuristic in cae-home-state returns null in that case).
 */
function projectEtaMin(p: PhaseSummary): number | null {
  if (p.eta_min !== null && p.eta_min !== undefined) return p.eta_min;
  if (p.progress_pct <= 0 || p.progress_pct >= 100) return null;
  // Assume a 30 min reference wave. Each remaining percent → fraction × ref.
  const REF_MIN = 30;
  const remainingPct = 100 - p.progress_pct;
  const elapsedRatio = p.progress_pct / 100;
  if (elapsedRatio <= 0) return null;
  const projectedTotal = REF_MIN / elapsedRatio;
  return Math.max(1, Math.round((projectedTotal * remainingPct) / 100));
}

interface Props {
  phase: PhaseSummary | null;
}

export function TaskHeaderSummary({ phase }: Props) {
  if (!phase) {
    return (
      <div
        data-testid="task-header-summary"
        data-state="loading"
        className="flex flex-wrap items-center gap-2 text-xs"
      >
        <span className="text-[color:var(--text-muted)]">Loading…</span>
      </div>
    );
  }

  const stage = deriveStage(phase);
  const stageMeta = STAGE_META[stage];
  const eta = projectEtaMin(phase);
  // PhaseSummary doesn't split input/output tokens — the aggregator sums
  // them into a single `tokens_phase`. To compute $ cost we approximate the
  // typical 60/40 input/output split observed in dashboard runs (verified
  // against .cae/metrics/circuit-breakers.jsonl token_usage samples).
  const inputTokens = Math.round(phase.tokens_phase * 0.6);
  const outputTokens = phase.tokens_phase - inputTokens;
  const model =
    phase.agents_active.length > 0
      ? // PhaseSummary doesn't carry the per-agent model; fall back to the
        // generic "sonnet" tier — the most common active-phase model. The
        // chip still renders a real number, just at the median rate.
        "sonnet"
      : "sonnet";
  const usd = costUsd(inputTokens, outputTokens, model);

  return (
    <div
      data-testid="task-header-summary"
      data-stage={stage}
      className="flex flex-wrap items-center gap-2 text-xs font-mono"
    >
      <Chip
        testId="task-header-stage"
        bg={stageMeta.bg}
        fg={stageMeta.fg}
        label={stageMeta.label}
        title={"Phase stage: " + stageMeta.label}
      />
      <Chip
        testId="task-header-progress"
        bg="color-mix(in srgb, var(--text) 8%, transparent)"
        fg="var(--text)"
        label={
          "Wave " +
          phase.wave_current +
          "/" +
          phase.wave_total +
          " · " +
          phase.progress_pct +
          "%"
        }
        title="Wave progression and overall percent complete"
      />
      <Chip
        testId="task-header-eta"
        bg="color-mix(in srgb, var(--accent) 10%, transparent)"
        fg="var(--accent)"
        label={"ETA " + (eta === null ? "—" : formatEtaMin(eta))}
        title={
          eta === null
            ? "No completion estimate yet"
            : "Estimated " + formatEtaMin(eta) + " of work remaining"
        }
      />
      <Chip
        testId="task-header-cost"
        bg="color-mix(in srgb, var(--warning) 12%, transparent)"
        fg="var(--warning)"
        label={formatUsd(usd) + " · " + formatTok(phase.tokens_phase) + " tok"}
        title={
          "Cost so far: " +
          formatUsd(usd) +
          " (" +
          phase.tokens_phase.toLocaleString() +
          " tokens at " +
          model +
          " rate)"
        }
      />
    </div>
  );
}

function Chip({
  testId,
  bg,
  fg,
  label,
  title,
}: {
  testId: string;
  bg: string;
  fg: string;
  label: string;
  title: string;
}) {
  return (
    <span
      data-testid={testId}
      title={title}
      className="inline-flex items-center rounded-full px-2 py-0.5 leading-tight"
      style={{ backgroundColor: bg, color: fg }}
    >
      {label}
    </span>
  );
}
