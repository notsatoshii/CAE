"use client"

/**
 * DriftBanner — conditional red banner shown in the agent detail drawer when
 * the aggregator flagged `drift_warning: true` (7d success rate < 85% of 30d
 * baseline, with ≥5 samples to avoid dormant-waking false positives).
 *
 * Founder/dev copy flip lives in labels.ts under `agentsDriftBanner`. This
 * component just renders the copy and styles it — no threshold logic here.
 *
 * See .planning/phases/05-agents-tab/05-CONTEXT.md §Drift banner copy +
 * §Drift detection thresholds for the authoritative contract.
 */

import { useDevMode } from "@/lib/providers/dev-mode"
import { labelFor } from "@/lib/copy/labels"

interface DriftBannerProps {
  agentLabel: string
  successRate7d: number
  successRate30d: number
}

export function DriftBanner({
  agentLabel,
  successRate7d,
  successRate30d,
}: DriftBannerProps) {
  const { dev } = useDevMode()
  const t = labelFor(dev)
  return (
    <div
      data-testid="drift-banner"
      role="alert"
      aria-live="polite"
      className="rounded-md border border-[color:var(--danger,#ef4444)] bg-[color:var(--danger,#ef4444)]/10 px-4 py-3 text-sm text-[color:var(--danger,#ef4444)]"
    >
      {t.agentsDriftBanner(agentLabel, successRate7d, successRate30d)}
    </div>
  )
}
