/**
 * Per-million-token rates for Anthropic Claude models, in USD.
 *
 * Used by the TaskDetailSheet header chip + (future) any other surface
 * that needs to display $ cost alongside raw token counts. Hardcoded here
 * because there's no upstream `cae-cost-table` and pricing changes
 * infrequently — when Anthropic publishes new rates, edit this file.
 *
 * Rates as of 2026-04 (sources: anthropic.com/pricing snapshot):
 *   - Opus 4.x:    $15 input / $75 output per Mtok
 *   - Sonnet 4.x:  $3 input / $15 output per Mtok
 *   - Haiku 4.5:   $1 input / $5 output per Mtok
 *
 * The matcher accepts the raw model strings emitted by adapters
 * (`claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5`, etc.) plus
 * shorthand keys ("opus", "sonnet", "haiku"). Unknown models fall back to
 * the Sonnet tier — the most common runtime model — so $ never silently
 * displays as $0.00 just because a model name looks unfamiliar.
 */

export interface ModelRate {
  /** USD per million input tokens. */
  input_per_mtok: number;
  /** USD per million output tokens. */
  output_per_mtok: number;
}

export const MODEL_RATES: Record<string, ModelRate> = {
  opus: { input_per_mtok: 15, output_per_mtok: 75 },
  sonnet: { input_per_mtok: 3, output_per_mtok: 15 },
  haiku: { input_per_mtok: 1, output_per_mtok: 5 },
};

const DEFAULT_RATE: ModelRate = MODEL_RATES.sonnet;

/**
 * Resolve a `ModelRate` for the given model identifier. Tolerates dialect
 * differences (`claude-opus-4-7` vs `opus-4` vs `opus`) by lowercasing the
 * input and matching the first family token it contains.
 */
export function rateFor(model: string | null | undefined): ModelRate {
  if (!model) return DEFAULT_RATE;
  const m = model.toLowerCase();
  if (m.includes("opus")) return MODEL_RATES.opus;
  if (m.includes("haiku")) return MODEL_RATES.haiku;
  if (m.includes("sonnet")) return MODEL_RATES.sonnet;
  return DEFAULT_RATE;
}

/**
 * Compute USD cost for a given input/output token split under the rate
 * implied by `model`. Returns 0 when both counts are non-positive — callers
 * should still render the chip (signals "no spend yet"), so we don't
 * special-case `null`.
 */
export function costUsd(
  inputTokens: number,
  outputTokens: number,
  model: string | null | undefined,
): number {
  const r = rateFor(model);
  const input = Math.max(0, inputTokens) * (r.input_per_mtok / 1_000_000);
  const output = Math.max(0, outputTokens) * (r.output_per_mtok / 1_000_000);
  return input + output;
}

/**
 * Format USD as a compact dashboard chip — "$0.00" / "$0.42" / "$12.34" /
 * "$1.2k". Always two decimal places under $1k so cost rounding never
 * looks like "$1" when it's actually "$1.49".
 */
export function formatUsd(usd: number): string {
  if (!Number.isFinite(usd) || usd < 0) return "$0.00";
  if (usd < 1000) return "$" + usd.toFixed(2);
  if (usd < 1_000_000) return "$" + (usd / 1000).toFixed(1) + "k";
  return "$" + (usd / 1_000_000).toFixed(2) + "M";
}
