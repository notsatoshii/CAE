"use client"

/**
 * TrustBadge — compact visual indicator of a skill's trust score.
 *
 * Color tiers (per research §4a):
 *   80+  → green  "High trust · {score}"
 *   50-79 → amber  "Medium · {score}"
 *   <50  → red    "Low · {score}"
 *
 * Overridden skills show "Trusted by admin" in green.
 */
import type { TrustScore } from "@/lib/cae-types"

export type TrustBadgeProps = {
  trust: TrustScore
  size?: "sm" | "md"
}

function tier(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "High trust", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" }
  if (score >= 50) return { label: "Medium", color: "text-amber-400 bg-amber-400/10 border-amber-400/20" }
  return { label: "Low · review needed", color: "text-red-400 bg-red-400/10 border-red-400/20" }
}

export function TrustBadge({ trust, size = "sm" }: TrustBadgeProps) {
  if (trust.overridden) {
    return (
      <span
        data-testid="trust-badge"
        data-score={trust.total}
        className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono
          text-emerald-400 bg-emerald-400/10 border-emerald-400/20
          ${size === "sm" ? "text-xs" : "text-sm"}`}
      >
        Trusted by admin
      </span>
    )
  }

  const { label, color } = tier(trust.total)
  return (
    <span
      data-testid="trust-badge"
      data-score={trust.total}
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 font-mono
        ${color} ${size === "sm" ? "text-xs" : "text-sm"}`}
    >
      {label} · {trust.total}
    </span>
  )
}
