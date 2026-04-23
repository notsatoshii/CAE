"use client"

import React, { useState, useEffect, useCallback } from "react"
import { SearchX } from "lucide-react"
import type { CatalogSkill, Role } from "@/lib/cae-types"
import { SkillCard } from "./skill-card"
import { EmptyState } from "@/components/ui/empty-state"

type Props = {
  initial: CatalogSkill[]
  onOpen?: (skill: CatalogSkill) => void
  onInstall?: (skill: CatalogSkill) => void
  /** Role from server-component parent. Forwarded to SkillCard → InstallButton. */
  currentRole?: Role
}

/**
 * CatalogGrid — displays a filterable grid of skill cards.
 *
 * - Debounced search (200ms) on the q input
 * - Filters by name, owner, or description (case-insensitive)
 * - Shows "no results" empty state when filter yields nothing
 *
 * Phase 14 Plan 04: currentRole forwarded to SkillCard for InstallButton gating.
 *
 * Phase 15 Wave 2.6 (bonus): no-results state adopts <EmptyState> for
 * visual consistency with every other surface. testId preserved
 * (catalog-no-results) so existing harnesses keep working.
 */
export function CatalogGrid({ initial, onOpen, onInstall, currentRole }: Props) {
  const [q, setQ] = useState("")
  const [displayedQ, setDisplayedQ] = useState("")

  // Debounce search by 200ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDisplayedQ(q)
    }, 200)
    return () => clearTimeout(timer)
  }, [q])

  const filtered = displayedQ
    ? initial.filter((s) => {
        const lower = displayedQ.toLowerCase()
        return (
          s.name.toLowerCase().includes(lower) ||
          s.owner.toLowerCase().includes(lower) ||
          s.description.toLowerCase().includes(lower)
        )
      })
    : initial

  const handleOpen = useCallback(
    (skill: CatalogSkill) => {
      onOpen?.(skill)
    },
    [onOpen]
  )

  const handleInstall = useCallback(
    (skill: CatalogSkill) => {
      onInstall?.(skill)
    },
    [onInstall]
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Search input */}
      <input
        role="searchbox"
        type="search"
        placeholder="Search skills…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full rounded-md border border-[color:var(--border,#1f1f22)] bg-[color:var(--surface-raised,#18181b)] px-3 py-2 text-sm text-[color:var(--text,#e5e5e5)] placeholder:text-zinc-500 outline-none focus:border-[color:var(--accent,#00d4ff)]"
      />

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((skill) => (
            <SkillCard
              key={`${skill.owner}/${skill.name}`}
              skill={skill}
              onOpen={handleOpen}
              onInstall={handleInstall}
              currentRole={currentRole}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={SearchX}
          testId="catalog-no-results"
          title="No skills match your search"
          description="Try a different term, or clear the search box to see the whole catalog."
          tip="Skills come from skills.sh + clawhub + your local ~/.claude/skills directory."
        />
      )}
    </div>
  )
}
