/**
 * audit/gate.ts — Phase 15 Cap.8.
 *
 * Fix-gate check. Wave commits run this before merging to confirm:
 *   A. no pillar score regressed ≥2 levels vs prior cycle
 *   B. no new pillar cell dropped to ≤3 that wasn't already ≤3 in prior
 *
 * Both conditions per CLOSE-OUT-CRITERIA.md Hard-close blocker B +
 * CAPTURE-IMPL-PLAN.md Cap.8 ("score must improve from prior cycle;
 * no regressions").
 *
 * Scope narrowing: `routeFilter` restricts the check to routes a wave
 * actually touched (e.g. ["build", "build-queue"]). Matched case-
 * sensitively against the cell `slug`. When omitted, all routes.
 *
 * Pass semantics: cumulative improvements still allow a wave to ship
 * even if the global close-out isn't met yet — that's a separate gate.
 */
import { readFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import type { PillarId } from "./score/rubric"
import { PILLARS } from "./score/rubric"

// caveman: shape must match score-run.ts RunSummary exactly.
interface CellScores {
  scores: Record<PillarId, { score: 1 | 2 | 3 | 4 | 5; evidence: string[] }>
  persona: string
  slug: string
  viewport: string
  route: string
  fixture: string
}
interface RunSummaryShape {
  label: string
  fixture: string
  cells: CellScores[]
}

export interface GateRegression {
  slug: string
  pillar: string
  from: number
  to: number
}

export interface GateUnresolved {
  slug: string
  pillar: string
  score: number
}

export interface GateResult {
  pass: boolean
  reasons: string[]
  regressions: GateRegression[]
  unresolved: GateUnresolved[]
}

export interface GateOpts {
  cycle: string
  priorCycle?: string
  reportsDir?: string
  routeFilter?: string[]
}

async function readSummary(
  reportsDir: string,
  label: string,
): Promise<RunSummaryShape | null> {
  const path = join(reportsDir, `${label}-SUMMARY.json`)
  if (!existsSync(path)) return null
  const raw = await readFile(path, "utf8")
  const parsed = JSON.parse(raw)
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.cells)) {
    return null
  }
  return parsed as RunSummaryShape
}

function inScope(slug: string, filter?: string[]): boolean {
  if (!filter || filter.length === 0) return true
  return filter.includes(slug)
}

// Key is per pillar × cell, not just cell — a single cell can regress
// on truth but hold steady on reliability. Matches score-run.computeDelta.
function cellKey(c: CellScores): string {
  return `${c.slug}|${c.persona}|${c.viewport}`
}

export async function checkFixGate(opts: GateOpts): Promise<GateResult> {
  const reportsDir = resolve(
    opts.reportsDir ?? join(process.cwd(), "audit/reports"),
  )

  const current = await readSummary(reportsDir, opts.cycle)
  if (!current) {
    return {
      pass: false,
      reasons: [`gate: current cycle summary missing (${opts.cycle})`],
      regressions: [],
      unresolved: [],
    }
  }

  const prior = opts.priorCycle
    ? await readSummary(reportsDir, opts.priorCycle)
    : null

  const priorByKey = new Map<string, CellScores>()
  if (prior) {
    for (const c of prior.cells) priorByKey.set(cellKey(c), c)
  }

  const regressions: GateRegression[] = []
  const unresolved: GateUnresolved[] = []

  for (const c of current.cells) {
    if (!inScope(c.slug, opts.routeFilter)) continue
    const p0 = priorByKey.get(cellKey(c))
    for (const pillar of PILLARS) {
      const to = c.scores[pillar]?.score
      if (typeof to !== "number") continue

      // Rule A — regression ≥2 levels (requires prior)
      if (p0) {
        const from = p0.scores[pillar]?.score
        if (typeof from === "number" && from - to >= 2) {
          regressions.push({ slug: c.slug, pillar, from, to })
        }
      }

      // Rule B — new ≤3 breakage vs prior. If prior exists, only flag
      // when this cell was NOT already ≤3 there. If no prior, every ≤3
      // counts as unresolved (first cycle baseline case).
      if (to <= 3) {
        if (!p0) {
          unresolved.push({ slug: c.slug, pillar, score: to })
        } else {
          const from = p0.scores[pillar]?.score
          if (typeof from !== "number" || from > 3) {
            unresolved.push({ slug: c.slug, pillar, score: to })
          }
        }
      }
    }
  }

  const reasons: string[] = []
  if (regressions.length > 0) {
    reasons.push(
      `${regressions.length} pillar regression(s) ≥2 levels vs ${opts.priorCycle ?? "prior"}`,
    )
  }
  if (unresolved.length > 0) {
    reasons.push(
      `${unresolved.length} pillar cell(s) newly ≤3 (fresh breakage)`,
    )
  }

  return {
    pass: reasons.length === 0,
    reasons,
    regressions,
    unresolved,
  }
}
