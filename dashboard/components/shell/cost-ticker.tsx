"use client";

import { useStatePoll } from "@/lib/hooks/use-state-poll";
import { LastUpdated } from "@/components/ui/last-updated";

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(1) + "k";
  return (n / 1_000_000).toFixed(2) + "M";
}

const TOOLTIP = "Token usage from local logs. OAuth subscription — not billed per call.";

export function CostTicker() {
  const { data, lastUpdated } = useStatePoll();

  if (!data) {
    return (
      <span
        data-testid="cost-ticker"
        className="inline-flex items-center gap-1.5 font-mono text-xs text-[color:var(--text-muted)]"
        title={TOOLTIP}
      >
        <span>— tok today</span>
        <span className="uppercase text-[10px] tracking-wider opacity-70">est.</span>
        <LastUpdated at={lastUpdated} threshold_ms={6000} />
      </span>
    );
  }

  // Phase 7 Wave 0 (D-02): inputTokensToday / outputTokensToday are the
  // camelCase API-response envelope fields from /api/state. The underlying
  // .cae/metrics/circuit-breakers.jsonl uses snake_case input_tokens /
  // output_tokens — the aggregator converts at the API boundary.
  const totalTokens = data.breakers.inputTokensToday + data.breakers.outputTokensToday;

  return (
    <span
      data-testid="cost-ticker"
      className="inline-flex items-center gap-1.5 font-mono text-xs text-[color:var(--text)]"
      title={TOOLTIP}
    >
      <span>{formatTokens(totalTokens)} tok today</span>
      <span className="uppercase text-[10px] tracking-wider text-[color:var(--text-muted)]">est.</span>
      <LastUpdated at={lastUpdated} threshold_ms={6000} />
    </span>
  );
}
