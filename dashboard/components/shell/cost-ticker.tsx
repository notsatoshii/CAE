"use client";

import { useStatePoll } from "@/lib/hooks/use-state-poll";

function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(1) + "k";
  return (n / 1_000_000).toFixed(2) + "M";
}

const TOOLTIP = "Token usage from local logs. OAuth subscription — not billed per call.";

export function CostTicker() {
  const { data } = useStatePoll();

  if (!data) {
    return (
      <span
        data-testid="cost-ticker"
        className="inline-flex items-center gap-1.5 font-mono text-xs text-[color:var(--text-muted)]"
        title={TOOLTIP}
      >
        <span>— tok today</span>
        <span className="uppercase text-[10px] tracking-wider opacity-70">est.</span>
      </span>
    );
  }

  const totalTokens = data.breakers.inputTokensToday + data.breakers.outputTokensToday;

  return (
    <span
      data-testid="cost-ticker"
      className="inline-flex items-center gap-1.5 font-mono text-xs text-[color:var(--text)]"
      title={TOOLTIP}
    >
      <span>{formatTokens(totalTokens)} tok today</span>
      <span className="uppercase text-[10px] tracking-wider text-[color:var(--text-muted)]">est.</span>
    </span>
  );
}
