"use client"

/**
 * AgentGrid — grouped grid of AgentCards (Phase 5 Plan 05-03).
 *
 * Groups agents into three sections in locked order:
 *   Active → Recently used → Dormant
 * Empty groups are hidden entirely. Preserves aggregator order within a group
 * (the roster aggregator emits AGENT_META order — deterministic).
 *
 * Responsive grid: 1 col mobile, 2 cols md (~768px+), 3 cols xl (~1280px+).
 * Matches UI-SPEC §6 card-grid expectation (2–3 cols at common Build widths).
 *
 * Client component because it reads `useDevMode` for founder/dev headings
 * and the failed-to-load copy. The caller (server page) owns data fetching.
 *
 * See .planning/phases/05-agents-tab/05-CONTEXT.md §Card grouping for the
 * authoritative ordering contract.
 */

import { useDevMode } from "@/lib/providers/dev-mode"
import { labelFor } from "@/lib/copy/labels"
import { AgentCard } from "./agent-card"
import type { AgentRosterEntry } from "@/lib/cae-agents-state"

interface AgentGridProps {
  agents: AgentRosterEntry[]
  loadError?: string | null
}

type Group = "active" | "recently_used" | "dormant"
const GROUP_ORDER: Group[] = ["active", "recently_used", "dormant"]

export function AgentGrid({ agents, loadError }: AgentGridProps) {
  const { dev } = useDevMode()
  const t = labelFor(dev)

  if (loadError) {
    return (
      <div
        data-testid="agent-grid-error"
        className="rounded-lg border border-[color:var(--danger,#ef4444)]/50 bg-[color:var(--danger,#ef4444)]/5 p-6 text-sm text-[color:var(--danger,#ef4444)]"
      >
        {t.agentsListFailedToLoad}
      </div>
    )
  }

  const grouped: Record<Group, AgentRosterEntry[]> = {
    active: [],
    recently_used: [],
    dormant: [],
  }
  for (const a of agents) grouped[a.group].push(a)

  return (
    <div data-testid="agent-grid" className="flex flex-col gap-8">
      {GROUP_ORDER.map((group) => {
        const members = grouped[group]
        if (members.length === 0) return null
        const heading =
          group === "active"
            ? t.agentsGroupActive(members.length)
            : group === "recently_used"
              ? t.agentsGroupRecent(members.length)
              : t.agentsGroupDormant(members.length)
        return (
          <section
            key={group}
            data-testid={"agent-group-" + group}
            aria-labelledby={"agent-group-heading-" + group}
          >
            <h2
              id={"agent-group-heading-" + group}
              className="text-sm font-semibold uppercase tracking-wide text-[color:var(--text-muted,#8a8a8c)] mb-3"
            >
              {heading}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map((a) => (
                <AgentCard key={a.name} agent={a} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
