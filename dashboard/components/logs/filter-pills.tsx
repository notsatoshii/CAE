"use client"

/**
 * components/logs/filter-pills.tsx — Phase 15 Wave 5.1.
 *
 * Three pill rows: level / source / scope.
 *
 * Each pill is a toggle button with `aria-pressed` reflecting state.
 * The level + source rows are statically known (we know the enum); the
 * scope row is dynamic — derived from the loaded buffer.
 */
import { cn } from "@/lib/utils"
import type { LogLevel, LogSource } from "@/lib/logs/multi-source-merge"

const LEVELS: LogLevel[] = ["debug", "info", "warn", "error", "fatal"]
const SOURCES: LogSource[] = ["tail", "audit", "tool", "heartbeat"]

export interface FiltersState {
  levels: Set<LogLevel>
  sources: Set<LogSource>
  scopes: Set<string>
}

interface FilterPillsProps {
  filters: FiltersState
  /** Scope strings discovered in the live buffer (sorted alphabetically). */
  availableScopes: string[]
  onChange: (next: FiltersState) => void
}

export function FilterPills({ filters, availableScopes, onChange }: FilterPillsProps) {
  function togglePill<T>(set: Set<T>, key: T): Set<T> {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  }

  return (
    <div
      data-testid="filter-pills"
      className="flex flex-col gap-2 border-b border-[color:var(--border-subtle)] px-3 py-2"
      role="group"
      aria-label="Log filters"
    >
      <PillRow
        label="Level"
        items={LEVELS}
        selected={filters.levels}
        testIdPrefix="filter-level"
        onToggle={(l) => onChange({ ...filters, levels: togglePill(filters.levels, l) })}
      />
      <PillRow
        label="Source"
        items={SOURCES}
        selected={filters.sources}
        testIdPrefix="filter-source"
        onToggle={(s) => onChange({ ...filters, sources: togglePill(filters.sources, s) })}
      />
      {availableScopes.length > 0 ? (
        <PillRow
          label="Scope"
          items={availableScopes}
          selected={filters.scopes}
          testIdPrefix="filter-scope"
          onToggle={(s) => onChange({ ...filters, scopes: togglePill(filters.scopes, s) })}
        />
      ) : null}
    </div>
  )
}

function PillRow<T extends string>({
  label,
  items,
  selected,
  testIdPrefix,
  onToggle,
}: {
  label: string
  items: readonly T[]
  selected: Set<T>
  testIdPrefix: string
  onToggle: (item: T) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-[10px] uppercase tracking-wider text-[color:var(--text-dim)]">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-1">
        {items.map((item) => {
          const active = selected.has(item)
          return (
            <button
              key={item}
              type="button"
              data-testid={`${testIdPrefix}-${item}`}
              aria-pressed={active}
              onClick={() => onToggle(item)}
              className={cn(
                "rounded border px-2 py-[2px] font-mono text-[11px] transition-colors",
                active
                  ? "border-[color:var(--accent)] bg-[color:var(--accent)] text-[color:var(--accent-foreground)]"
                  : "border-[color:var(--border-subtle)] text-[color:var(--text-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]",
              )}
            >
              {item}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Predicate — applied per LogLine. Empty Set means "no filter on this axis".
// ---------------------------------------------------------------------------

import type { LogLine } from "@/lib/logs/multi-source-merge"

export function matchesFilters(line: LogLine, f: FiltersState): boolean {
  if (f.levels.size > 0 && !f.levels.has(line.level)) return false
  if (f.sources.size > 0 && !f.sources.has(line.source)) return false
  if (f.scopes.size > 0) {
    if (!line.scope || !f.scopes.has(line.scope)) return false
  }
  return true
}
