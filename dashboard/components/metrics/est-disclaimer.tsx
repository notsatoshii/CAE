"use client";

/**
 * Phase 7 — small pill-shaped "est." disclaimer used inside panel headers.
 *
 * Mirrors the uppercase "est." visual tag pattern from
 * `components/shell/cost-ticker.tsx` so the concept ("these numbers are
 * estimated from local logs, not billed invoices") reads the same everywhere.
 *
 * Copy source of truth: `labelFor(dev).metricsSpendingDisclaimer`
 *   FOUNDER: "Estimated from local logs. Subscription covers the bill."
 *   DEV    : "est. — from .cae/metrics/circuit-breakers.jsonl"
 */

import { labelFor } from "@/lib/copy/labels";
import { useDevMode } from "@/lib/providers/dev-mode";

export function EstDisclaimer() {
  const { dev } = useDevMode();
  const L = labelFor(dev);
  return (
    <div
      data-testid="metrics-est-disclaimer"
      className="inline-flex items-center gap-2 rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-xs text-[color:var(--text-muted)]"
    >
      <span className="uppercase font-mono text-[10px] tracking-wider text-[color:var(--accent)]">
        est.
      </span>
      <span>{L.metricsSpendingDisclaimer}</span>
    </div>
  );
}
