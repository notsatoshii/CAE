"use client"

/**
 * TrustGrid — sortable table of per-skill trust scores with expandable factor rows.
 *
 * Sort order: ascending by score (worst first) — founder attention goes to risky skills.
 * Click a row to expand inline TrustExplainer with per-factor breakdown.
 * Admin-only override button via RoleGate (inside TrustExplainer).
 */
import { useState, useCallback } from "react"
import type { CatalogSkill, TrustScore, Role } from "@/lib/cae-types"
import { TrustBadge } from "./trust-badge"
import { TrustExplainer } from "./trust-explainer"

export type TrustGridEntry = {
  skill: CatalogSkill
  trust: TrustScore
}

export type TrustGridProps = {
  entries: TrustGridEntry[]
  currentRole: Role | undefined
  onOverride?: (owner: string, name: string, trusted: boolean) => Promise<void>
}

export function TrustGrid({ entries, currentRole, onOverride }: TrustGridProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [overridePending, setOverridePending] = useState<string | null>(null)

  // Sort ascending by score (worst first)
  const sorted = [...entries].sort((a, b) => a.trust.total - b.trust.total)

  const handleOverride = useCallback(
    async (owner: string, name: string, trusted: boolean) => {
      const key = `${owner}/${name}`
      setOverridePending(key)
      try {
        await onOverride?.(owner, name, trusted)
      } finally {
        setOverridePending(null)
      }
    },
    [onOverride]
  )

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No installed skills found. Install a skill to see trust scores.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {sorted.map(({ skill, trust }) => {
        const key = `${skill.owner}/${skill.name}`
        const isExpanded = expanded === key

        return (
          <div key={key} className="rounded border border-zinc-800 bg-zinc-900/50">
            {/* Row header — click to expand */}
            <button
              type="button"
              data-testid={`trust-row-${skill.name}`}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-zinc-800/40"
              onClick={() => setExpanded(isExpanded ? null : key)}
            >
              <span className="flex-1 text-sm font-medium text-zinc-200">
                {skill.name}
              </span>
              <span className="text-xs text-zinc-500">{skill.owner}</span>
              <TrustBadge trust={trust} size="sm" />
              <span className="text-xs text-zinc-600">{isExpanded ? "▲" : "▼"}</span>
            </button>

            {/* Expanded factor breakdown */}
            {isExpanded && (
              <div className="border-t border-zinc-800 px-4 py-3">
                <TrustExplainer
                  trust={trust}
                  skill={skill}
                  currentRole={currentRole}
                  overridePending={overridePending === key}
                  onOverride={(trusted) => handleOverride(skill.owner, skill.name, trusted)}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
