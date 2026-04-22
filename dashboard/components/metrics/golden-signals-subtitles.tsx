"use client";

/**
 * GoldenSignalsSubtitle — SRE-canon secondary subtitle for /metrics panels.
 *
 * Plan 13-07, Task 3. MC IA adoption V2 §5 row 4.
 *
 * PURPOSE: Adds a secondary subtitle strip underneath each panel's founder-speak
 * primary heading. The founder heading remains unchanged (e.g., "Spending",
 * "How well it's going", "How fast"). This subtitle adds SRE Golden Signals
 * framing to help technically-minded users recognize the canonical patterns:
 *
 *   Golden Signals (Google SRE Book §6.1):
 *   - Latency   — how long it takes to serve a request → "How fast" panel
 *   - Traffic   — how much demand is being placed on the system → "Spending" panel
 *   - Errors    — rate of failed requests → "How well" panel
 *   - Saturation — how "full" the service is → "Spending" panel (budget %)
 *
 * DATA: Reads from useMetricsPoll() — same 30s poll already active for the
 * parent panel. Zero new fetches. Falls back to "—" when data is null.
 *
 * DESIGN: Small monospace secondary text between panel heading and content.
 * Does not replace founder-speak — additive SRE vocabulary layer only.
 *
 * PANEL MAPPING:
 *   "spending" → Traffic (tokens today) + Saturation (% of projected MTD)
 *   "howwell"  → Errors (halt events) + Success rate
 *   "howfast"  → Latency p50 + p95 (median across all agents)
 */

import { useMetricsPoll } from "@/lib/hooks/use-metrics-poll";

export type GoldenSignalsPanel = "spending" | "howwell" | "howfast";

interface Props {
  panel: GoldenSignalsPanel;
}

function fmtTokens(n: number): string {
  if (n < 1_000) return String(n);
  if (n < 1_000_000) return (n / 1_000).toFixed(1) + "k";
  return (n / 1_000_000).toFixed(2) + "M";
}

function fmtMs(n: number): string {
  if (n < 1000) return n + "ms";
  return (n / 1000).toFixed(1) + "s";
}

/**
 * Compute weighted success rate across all agents with n >= 5 samples.
 * Weighted by sample_n so high-volume agents dominate.
 */
function weightedSuccessRate(
  perAgent: Array<{ agent: string; success_rate: number; sample_n: number }>,
): number | null {
  const eligible = perAgent.filter((a) => a.sample_n >= 5);
  if (eligible.length === 0) return null;
  const totalN = eligible.reduce((s, a) => s + a.sample_n, 0);
  const weightedSum = eligible.reduce(
    (s, a) => s + a.success_rate * a.sample_n,
    0,
  );
  return weightedSum / totalN;
}

/**
 * Compute overall p50/p95 as simple average of per-agent values
 * (weighted by sample count n).
 */
function globalP50P95(
  perAgent: Array<{ agent: string; p50_ms: number; p95_ms: number; n: number }>,
): { p50: number | null; p95: number | null } {
  const eligible = perAgent.filter((a) => a.n > 0);
  if (eligible.length === 0) return { p50: null, p95: null };
  const totalN = eligible.reduce((s, a) => s + a.n, 0);
  const p50 = eligible.reduce((s, a) => s + a.p50_ms * a.n, 0) / totalN;
  const p95 = eligible.reduce((s, a) => s + a.p95_ms * a.n, 0) / totalN;
  return { p50: Math.round(p50), p95: Math.round(p95) };
}

export function GoldenSignalsSubtitle({ panel }: Props) {
  const { data } = useMetricsPoll();

  let line: string;

  if (panel === "spending") {
    // Traffic = tokens today (demand proxy)
    // Saturation = MTD tokens / projected monthly → how "full" the budget is
    const tokensToday = data?.spending?.tokens_today ?? null;
    const tokensMtd = data?.spending?.tokens_mtd ?? null;
    const projectedMtd = data?.spending?.tokens_projected_monthly ?? null;

    const trafficStr =
      tokensToday !== null ? `${fmtTokens(tokensToday)} tok today` : "—";
    const satStr =
      tokensMtd !== null && projectedMtd !== null && projectedMtd > 0
        ? `${Math.round((tokensMtd / projectedMtd) * 100)}% budget MTD`
        : "—";

    line = `Traffic · ${trafficStr}  |  Saturation · ${satStr}`;
  } else if (panel === "howwell") {
    // Errors = halt events (proxy for failed-job rate)
    // Success rate = weighted across agents with ≥5 samples
    const haltCount = data?.reliability?.halt_events?.length ?? null;
    const perAgent = data?.reliability?.per_agent_7d ?? null;

    const errStr =
      haltCount !== null
        ? `${haltCount} halt${haltCount === 1 ? "" : "s"}`
        : "—";
    const rate = perAgent ? weightedSuccessRate(perAgent) : null;
    const rateStr = rate !== null ? `${Math.round(rate * 100)}%` : "—";

    line = `Errors · ${errStr}  |  Success rate · ${rateStr}`;
  } else {
    // howfast: Latency (global p50 and p95 weighted by sample count)
    const perAgent = data?.speed?.per_agent_wall ?? null;
    const { p50, p95 } = perAgent ? globalP50P95(perAgent) : { p50: null, p95: null };

    const p50Str = p50 !== null ? fmtMs(p50) : "—";
    const p95Str = p95 !== null ? fmtMs(p95) : "—";

    line = `Latency p50 · ${p50Str}  |  p95 · ${p95Str}`;
  }

  return (
    <p
      data-testid={`golden-signals-subtitle-${panel}`}
      className="text-[11px] font-mono text-[color:var(--text-dim)] mt-0.5 mb-2 select-none"
      aria-label={`Golden Signals: ${line}`}
    >
      {line}
    </p>
  );
}
