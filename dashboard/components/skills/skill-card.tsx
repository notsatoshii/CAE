"use client"

import React from "react"
import { cn } from "@/lib/utils"
import type { CatalogSkill, Role } from "@/lib/cae-types"
import { RoleGate } from "@/components/auth/role-gate"
import { Timestamp } from "@/components/ui/timestamp"

/**
 * Accept CatalogSkill + the server-added freshness ISO. The /build/skills
 * server component decorates each catalog entry with `lastUpdatedISO` sourced
 * from git log (see lib/skills/last-updated.ts). When present the card
 * renders a chip with the relative time and the absolute ISO on hover —
 * Eric's rule: timestamps never fuzzy, always hover-absolute.
 */
type SkillWithFreshness = CatalogSkill & { lastUpdatedISO?: string | null }

type Props = {
  skill: SkillWithFreshness
  onOpen: (skill: CatalogSkill) => void
  onInstall: (skill: CatalogSkill) => void
  /** Role from server-component parent. Gates the Install button. */
  currentRole?: Role
}

function SourceBadge({ source }: { source: CatalogSkill["source"] }) {
  const label =
    source === "skills.sh" ? "skills.sh" : source === "clawhub" ? "ClawHub" : "Local"
  const cls =
    source === "local"
      ? "bg-cyan-900/40 text-cyan-300 border border-cyan-700/50"
      : "bg-zinc-800 text-zinc-400 border border-zinc-700/50"
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium leading-none", cls)}>
      {label}
    </span>
  )
}

/**
 * SkillCard — displays a single skill in the catalog grid.
 *
 * Props:
 *   skill       — CatalogSkill data (+ optional server-added lastUpdatedISO)
 *   onOpen      — fired when the card body is clicked (opens detail drawer)
 *   onInstall   — fired when the Install button is clicked
 *   currentRole — gates the Install button (operator+ required)
 *
 * Phase 14 Plan 04: viewers see a disabled "Read-only" button.
 * Phase 15 Wave 2.1: surface uses `.card-base card-base--interactive`.
 * Skills/class19c: renders last-updated chip when lastUpdatedISO is provided.
 */
export function SkillCard({ skill, onOpen, onInstall, currentRole }: Props) {
  const { name, owner, description, source, installs, stars, installed, lastUpdatedISO } = skill

  const countLabel = installs != null ? `${installs.toLocaleString()} installs` : stars != null ? `${stars.toLocaleString()} stars` : null

  function handleInstall(e: React.MouseEvent) {
    e.stopPropagation()
    onInstall(skill)
  }

  return (
    <div
      data-testid="skill-card"
      className="card-base card-base--interactive relative flex flex-col"
    >
      {/* Installed badge */}
      {installed && (
        <span className="absolute right-2 top-2 rounded bg-emerald-900/50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
          Installed
        </span>
      )}

      {/* Card body — clicking opens detail drawer */}
      <div
        data-testid="skill-card-body"
        className="flex flex-col gap-1"
        onClick={() => onOpen(skill)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onOpen(skill)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[color:var(--text,#e5e5e5)] truncate">
            {name}
          </span>
          <SourceBadge source={source} />
        </div>

        <span className="text-xs text-[color:var(--text-muted,#8a8a8c)] truncate">
          {owner}
        </span>

        {description && (
          <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{description}</p>
        )}

        <div className="mt-1 flex items-center justify-between gap-2">
          {countLabel ? (
            <span className="text-[10px] text-zinc-500">{countLabel}</span>
          ) : (
            <span />
          )}
          {lastUpdatedISO && (
            <span
              data-testid="skill-last-updated"
              className="text-[10px] text-zinc-500"
            >
              <span className="mr-1">updated</span>
              <Timestamp iso={lastUpdatedISO} className="text-[10px]" />
            </span>
          )}
        </div>
      </div>

      {/* Actions row — gated by RoleGate */}
      {!installed && (
        <div className="flex justify-end pt-1">
          <RoleGate
            role="operator"
            currentRole={currentRole}
            fallback={
              <button
                type="button"
                disabled
                title="Ask an admin to give you operator access to install skills"
                className="rounded border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-500 cursor-not-allowed"
              >
                Read-only
              </button>
            }
          >
            <button
              type="button"
              aria-label={`Install ${name}`}
              onClick={handleInstall}
              className="rounded bg-[color:var(--accent,#00d4ff)] px-2.5 py-1 text-xs font-medium text-black transition-opacity hover:opacity-80 active:opacity-70"
            >
              Install
            </button>
          </RoleGate>
        </div>
      )}
    </div>
  )
}
