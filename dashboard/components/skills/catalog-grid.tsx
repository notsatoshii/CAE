"use client"

import React, { useState, useEffect, useCallback } from "react"
import type { CatalogSkill } from "@/lib/cae-types"
import { SkillCard } from "./skill-card"

type Props = {
  initial: CatalogSkill[]
  onOpen?: (skill: CatalogSkill) => void
  onInstall?: (skill: CatalogSkill) => void
}

/**
 * CatalogGrid — displays a filterable grid of skill cards.
 *
 * - Debounced search (200ms) on the q input
 * - Filters by name, owner, or description (case-insensitive)
 * - Shows "no results" empty state when filter yields nothing
 */
export function CatalogGrid({ initial, onOpen, onInstall }: Props) {
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
            />
          ))}
        </div>
      ) : (
        <div
          data-testid="catalog-no-results"
          className="py-16 text-center text-sm text-zinc-500"
        >
          No skills match your search. Try a different term.
        </div>
      )}
    </div>
  )
}
