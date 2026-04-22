/**
 * lib/cae-plan-home.ts — /plan home page aggregator.
 * Phase 10 REQ-10-01. Mirrors shape of lib/cae-home-state.ts.
 * Pure read + derive; no shell, no disk writes.
 */
import { basename } from "path"
import type { Project } from "./cae-types"
import { listProjects } from "./cae-state"

export interface PlanHomeProject extends Project {
  /** Founder-speak badge string — e.g. "Spec drafting", "Building". */
  lifecycleBadge: string
  /** Lower-case internal id for CSS classing ("idea" | "prd" | "roadmap" | "waiting" | "executing" | "done" | "unknown"). */
  lifecycleKey: string
}

export interface PlanHomeState {
  projects: PlanHomeProject[]
  emptyState: boolean
  /** Basename of the most-recent project (by shiftUpdated), or null when empty. */
  mostRecentSlug: string | null
}

const BADGE_TABLE: ReadonlyArray<{ phases: readonly string[]; label: string; key: string }> = [
  { phases: ["idea", "research"], label: "Idea captured", key: "idea" },
  { phases: ["prd"], label: "Spec drafting", key: "prd" },
  { phases: ["roadmap"], label: "Next steps drafting", key: "roadmap" },
  { phases: ["waiting_for_plans"], label: "Ready to build", key: "waiting" },
  { phases: ["executing"], label: "Building", key: "executing" },
  { phases: ["done"], label: "Shipped", key: "done" },
]

/**
 * Table-driven mapping from Shift phase to founder-speak badge.
 * Exported for unit tests and wizard preview.
 * Returns { label: "Not started", key: "unknown" } for null/undefined/unrecognized phases.
 */
export function lifecycleBadgeFor(shiftPhase: string | null | undefined): { label: string; key: string } {
  if (!shiftPhase) return { label: "Not started", key: "unknown" }
  for (const row of BADGE_TABLE) {
    if (row.phases.includes(shiftPhase)) return { label: row.label, key: row.key }
  }
  return { label: "Not started", key: "unknown" }
}

/**
 * Aggregates listProjects() + derives UI-ready lifecycle badges.
 * No shell-out, no disk writes.
 * mostRecentSlug = basename of the project with the most recent shiftUpdated timestamp.
 * Falls back to the first project when no project has shiftUpdated set.
 */
export async function getPlanHomeState(): Promise<PlanHomeState> {
  const projects = await listProjects()
  const enriched: PlanHomeProject[] = projects.map((p) => {
    const badge = lifecycleBadgeFor(p.shiftPhase ?? null)
    return { ...p, lifecycleBadge: badge.label, lifecycleKey: badge.key }
  })
  const emptyState = enriched.length === 0

  let mostRecentSlug: string | null = null
  if (enriched.length > 0) {
    // Find the project with the latest shiftUpdated timestamp.
    let best = enriched[0]
    for (const p of enriched) {
      const pu = p.shiftUpdated ?? ""
      const bu = best.shiftUpdated ?? ""
      if (pu > bu) best = p
    }
    mostRecentSlug = basename(best.path)
  }

  return { projects: enriched, emptyState, mostRecentSlug }
}
