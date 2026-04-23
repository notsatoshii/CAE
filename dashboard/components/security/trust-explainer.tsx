"use client"

/**
 * TrustExplainer — per-factor breakdown for a skill's trust score.
 *
 * Shows each factor with pass/fail icon, weight pill, reason text.
 * Admin-only "Mark as trusted" override button via RoleGate.
 */
import type { TrustScore, CatalogSkill, Role } from "@/lib/cae-types"
import { RoleGate } from "@/components/auth/role-gate"

export type TrustExplainerProps = {
  trust: TrustScore
  skill: CatalogSkill
  currentRole: Role | undefined
  onOverride?: (trusted: boolean) => Promise<void>
  overridePending?: boolean
}

export function TrustExplainer({
  trust,
  skill,
  currentRole,
  onOverride,
  overridePending,
}: TrustExplainerProps) {
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-1.5">
        {trust.factors.map((f) => (
          <li key={f.id} className="flex items-start gap-2 text-sm">
            <span
              className={f.passed ? "text-emerald-400 mt-0.5" : "text-red-400 mt-0.5"}
              aria-label={f.passed ? "passed" : "failed"}
            >
              {f.passed ? "✓" : "✗"}
            </span>
            <span className="flex-1 text-zinc-300">{f.reason}</span>
            <span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-zinc-500">
              {Math.round(f.weight * 100)}%
            </span>
          </li>
        ))}
      </ul>

      <RoleGate role="admin" currentRole={currentRole}>
        {!trust.overridden ? (
          <button
            type="button"
            data-testid="trust-override-btn"
            disabled={overridePending}
            onClick={() => onOverride?.(true)}
            className="mt-2 rounded border border-emerald-600 px-3 py-1 text-xs text-emerald-400
              hover:bg-emerald-600/10 disabled:opacity-50"
          >
            {overridePending ? "Saving…" : "Mark as trusted"}
          </button>
        ) : (
          <button
            type="button"
            data-testid="trust-override-btn"
            disabled={overridePending}
            onClick={() => onOverride?.(false)}
            className="mt-2 rounded border border-zinc-600 px-3 py-1 text-xs text-zinc-400
              hover:bg-zinc-600/10 disabled:opacity-50"
          >
            {overridePending ? "Saving…" : "Remove trust override"}
          </button>
        )}
      </RoleGate>
    </div>
  )
}
