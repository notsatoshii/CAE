/**
 * audit/score-run.ts — Phase 15 Cap.7.
 *
 * Walk audit/shots/<fixture>/<persona>/<slug>--<viewport>.png + sibling
 * .truth.json + .console.json triples. For each cell, build a CaptureCell
 * and call scoreCell() from audit/score/pillars.ts. If --vision, also
 * call scoreWithVision(cell, "craft") from audit/score/llm-vision.ts and
 * merge its score into out.craft.
 *
 * Emits THREE reports under audit/reports/:
 *   <label>-SCORES.md    — heatmap + rollup
 *   <label>-FINDINGS.md  — cells ≤3 grouped by route
 *   <label>-SUMMARY.json — machine-readable dump
 *
 * If --prior <label> is given AND audit/reports/<prior>-SUMMARY.json
 * exists, also write <label>-DELTA.md showing regressions vs prior.
 *
 * Usage:
 *   npx tsx audit/score-run.ts <cycle-label> [--fixture healthy]
 *     [--vision] [--prior <prior-cycle-label>] [--shots-dir <path>]
 *     [--reports-dir <path>]
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import { PILLARS, type PillarId } from "./score/rubric"
import {
  scoreCell,
  type CaptureCell,
  type ScoreResult,
} from "./score/pillars"
import { scoreWithVision } from "./score/llm-vision"
import { lookupAccess } from "./fixtures/persona-access"
import { ROUTES } from "./routes"
import type { PersonaId } from "./routes"

// ── Types ──────────────────────────────────────────────────────────────
export interface CellSummary {
  fixture: string
  persona: string
  route: string
  slug: string
  viewport: string
  scores: Record<
    PillarId,
    {
      score: 1 | 2 | 3 | 4 | 5
      evidence: string[]
      /**
       * True when the scorer marked the cell not-applicable (e.g. a
       * gated capture on a persona that can't reach the route). Rollup,
       * delta, and findings skip N/A cells. Absent for legacy cells.
       */
      na?: true
    }
  >
}

export interface RunSummary {
  label: string
  fixture: string
  vision: boolean
  cells: CellSummary[]
}

export interface ScoreRunOptions {
  label: string
  fixture: string
  vision?: boolean
  prior?: string
  shotsDir?: string
  reportsDir?: string
  /** Override for tests — resolve fixture module by name. */
  loadFixtureModule?: (name: string) => Promise<unknown>
}

// ── Shots walker ───────────────────────────────────────────────────────
interface CellPaths {
  persona: string
  slug: string
  viewport: string
  pngPath: string
  truthPath: string
  consolePath: string
}

async function walkShots(
  shotsDir: string,
  fixture: string,
): Promise<CellPaths[]> {
  const fixtureDir = join(shotsDir, fixture)
  if (!existsSync(fixtureDir)) return []
  const personas = (await readdir(fixtureDir, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
  const out: CellPaths[] = []
  for (const persona of personas) {
    const dir = join(fixtureDir, persona)
    const entries = await readdir(dir)
    for (const f of entries) {
      if (!f.endsWith(".png")) continue
      // <slug>--<viewport>.png
      const stem = f.replace(/\.png$/, "")
      const dashIdx = stem.lastIndexOf("--")
      if (dashIdx < 0) continue
      const slug = stem.slice(0, dashIdx)
      const viewport = stem.slice(dashIdx + 2)
      const pngPath = join(dir, f)
      const truthPath = join(dir, `${stem}.truth.json`)
      const consolePath = join(dir, `${stem}.console.json`)
      out.push({ persona, slug, viewport, pngPath, truthPath, consolePath })
    }
  }
  return out
}

// ── Fixture module loader (overridable for tests) ──────────────────────
async function defaultLoadFixture(name: string): Promise<unknown> {
  try {
    return await import(`./fixtures/${name}.js`)
  } catch {
    return await import(`./fixtures/${name}`)
  }
}

// ── Route label ────────────────────────────────────────────────────────
// We can't import ROUTES without a circular risk if someone uses
// score-run in a worker pool, so pass the slug through as the "route"
// label — it's the same thing the harness uses in paths, and SCORES.md
// can show both slug + original / URL if ROUTES is present. Cheap
// fallback — just use slug as route label.
function routeLabelForSlug(slug: string): string {
  return slug
}

// ── Score a run ────────────────────────────────────────────────────────
export async function runScoring(
  opts: ScoreRunOptions,
): Promise<RunSummary> {
  const shotsDir = resolve(opts.shotsDir ?? join(process.cwd(), "audit/shots"))
  const loadFixture = opts.loadFixtureModule ?? defaultLoadFixture
  const cellPaths = await walkShots(shotsDir, opts.fixture)

  // Cache the fixture module (same fixture for all cells in this run).
  let fixtureModule: unknown = null
  try {
    fixtureModule = await loadFixture(opts.fixture)
  } catch {
    // leave null — scorer handles that gracefully
  }

  // Resolve a (slug → RouteEntry) index once so per-cell lookups are O(1).
  const routeBySlug = new Map(ROUTES.map((r) => [r.slug, r]))

  const cellSummaries: CellSummary[] = []
  for (const cp of cellPaths) {
    // Class 4B: tag the cell with its expected persona access so the
    // depth scorer can distinguish genuine missing-annotation cases
    // (score 1) from correctly-gated ones (N/A).
    const routeEntry = routeBySlug.get(cp.slug)
    const expectedAccess = routeEntry
      ? lookupAccess(cp.persona as PersonaId, cp.slug)
      : undefined

    const cell: CaptureCell = {
      fixture: opts.fixture,
      persona: cp.persona,
      route: routeLabelForSlug(cp.slug),
      slug: cp.slug,
      viewport: cp.viewport,
      pngPath: cp.pngPath,
      truthPath: cp.truthPath,
      consolePath: cp.consolePath,
      expectedFixture: fixtureModule,
      expectedAccess,
    }
    const scored = await scoreCell(cell)
    if (opts.vision) {
      try {
        const v = await scoreWithVision(cell, "craft")
        scored.craft = v
      } catch (err) {
        scored.craft = {
          score: 3,
          evidence: [
            `vision failed: ${err instanceof Error ? err.message : String(err)}`,
          ],
          recommendations: scored.craft.recommendations,
        }
      }
    }
    cellSummaries.push(pack(cell, scored))
  }

  const run: RunSummary = {
    label: opts.label,
    fixture: opts.fixture,
    vision: !!opts.vision,
    cells: cellSummaries,
  }
  return run
}

function pack(
  cell: CaptureCell,
  scored: Record<PillarId, ScoreResult>,
): CellSummary {
  const entries = {} as CellSummary["scores"]
  for (const p of PILLARS) {
    const r = scored[p]
    entries[p] = r.na
      ? { score: r.score, evidence: r.evidence, na: true }
      : { score: r.score, evidence: r.evidence }
  }
  return {
    fixture: cell.fixture,
    persona: cell.persona,
    route: cell.route,
    slug: cell.slug,
    viewport: cell.viewport,
    scores: entries,
  }
}

// ── SCORES.md ──────────────────────────────────────────────────────────
export function renderScoresMd(run: RunSummary): string {
  const lines: string[] = []
  lines.push(`# ${run.label} — SCORES`)
  lines.push("")
  lines.push(
    `Fixture: \`${run.fixture}\`  ·  Cells: ${run.cells.length}  ·  Vision: ${run.vision ? "on" : "off"}`,
  )
  lines.push("")

  // Rollup: per-pillar average + distribution.
  // N/A cells (e.g. depth on a persona-gated capture) are excluded from
  // the mean and the 1-5 buckets; surfaced in a separate "na" column so
  // the reader can see how many cells were skipped.
  lines.push("## Rollup")
  lines.push("")
  lines.push("| pillar | avg | 1 | 2 | 3 | 4 | 5 | na |")
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |")
  for (const p of PILLARS) {
    const applicable = run.cells.filter((c) => !c.scores[p].na)
    const naCount = run.cells.length - applicable.length
    const scores = applicable.map((c) => c.scores[p].score)
    if (scores.length === 0) {
      lines.push(`| ${p} | — | 0 | 0 | 0 | 0 | 0 | ${naCount} |`)
      continue
    }
    const avg = (
      scores.reduce((a, b) => a + b, 0) / scores.length
    ).toFixed(2)
    const dist = [1, 2, 3, 4, 5].map(
      (n) => scores.filter((s) => s === n).length,
    )
    lines.push(`| ${p} | ${avg} | ${dist.join(" | ")} | ${naCount} |`)
  }
  lines.push("")

  // Heatmap: one row per cell
  lines.push("## Heatmap")
  lines.push("")
  lines.push(
    "| fixture | persona | route | viewport | " +
      PILLARS.join(" | ") +
      " |",
  )
  lines.push(
    "| --- | --- | --- | --- | " + PILLARS.map(() => "---").join(" | ") + " |",
  )
  for (const c of run.cells) {
    const cells = PILLARS.map((p) => {
      const s = c.scores[p]
      const ev = (s.evidence[0] ?? "").replace(/\|/g, "\\|").slice(0, 60)
      const head = s.na ? "N/A" : String(s.score)
      return `${head} · ${ev}`
    })
    lines.push(
      `| ${c.fixture} | ${c.persona} | ${c.route} | ${c.viewport} | ${cells.join(" | ")} |`,
    )
  }
  lines.push("")
  return lines.join("\n")
}

// ── FINDINGS.md ────────────────────────────────────────────────────────
export function renderFindingsMd(run: RunSummary): string {
  const lines: string[] = []
  lines.push(`# ${run.label} — FINDINGS`)
  lines.push("")
  lines.push("Cells with any pillar score ≤ 3, grouped by route.")
  lines.push("")

  // Group cells by route, only those with any failing pillar.
  // N/A pillars are not "failing" — skip them when deciding whether the
  // cell deserves a findings entry and when listing per-pillar failures.
  const byRoute = new Map<string, CellSummary[]>()
  for (const c of run.cells) {
    const hasFail = PILLARS.some(
      (p) => !c.scores[p].na && c.scores[p].score <= 3,
    )
    if (!hasFail) continue
    const list = byRoute.get(c.route) ?? []
    list.push(c)
    byRoute.set(c.route, list)
  }

  if (byRoute.size === 0) {
    lines.push("_No findings — all cells scored ≥ 4 across all pillars._")
    lines.push("")
    return lines.join("\n")
  }

  for (const [route, cells] of [...byRoute.entries()].sort()) {
    lines.push(`## ${route}`)
    lines.push("")
    for (const c of cells) {
      lines.push(`### ${c.persona} · ${c.viewport}`)
      lines.push("")
      for (const p of PILLARS) {
        const s = c.scores[p]
        if (s.na) continue
        if (s.score > 3) continue
        lines.push(`- **${p}** — score **${s.score}**`)
        for (const ev of s.evidence.slice(0, 3)) {
          lines.push(`  - ${ev}`)
        }
      }
      lines.push("")
    }
  }
  return lines.join("\n")
}

// ── DELTA.md ───────────────────────────────────────────────────────────
interface DeltaRow {
  slug: string
  persona: string
  viewport: string
  pillar: PillarId
  from: number
  to: number
}

export function computeDelta(
  prior: RunSummary,
  current: RunSummary,
): {
  regressions: DeltaRow[]
  improvements: DeltaRow[]
  stuckLow: DeltaRow[]
} {
  const key = (c: CellSummary) => `${c.slug}|${c.persona}|${c.viewport}`
  const priorMap = new Map(prior.cells.map((c) => [key(c), c]))

  const regressions: DeltaRow[] = []
  const improvements: DeltaRow[] = []
  const stuckLow: DeltaRow[] = []
  for (const c of current.cells) {
    const pc = priorMap.get(key(c))
    if (!pc) continue
    for (const p of PILLARS) {
      // N/A → no data point in either direction. Skip delta.
      if (c.scores[p].na || pc.scores[p].na) continue
      const from = pc.scores[p].score
      const to = c.scores[p].score
      const delta = from - to // positive = regression
      if (delta >= 2) {
        regressions.push({
          slug: c.slug,
          persona: c.persona,
          viewport: c.viewport,
          pillar: p,
          from,
          to,
        })
      } else if (to - from >= 1) {
        improvements.push({
          slug: c.slug,
          persona: c.persona,
          viewport: c.viewport,
          pillar: p,
          from,
          to,
        })
      } else if (from === to && to <= 3) {
        stuckLow.push({
          slug: c.slug,
          persona: c.persona,
          viewport: c.viewport,
          pillar: p,
          from,
          to,
        })
      }
    }
  }
  return { regressions, improvements, stuckLow }
}

export function renderDeltaMd(
  priorLabel: string,
  current: RunSummary,
  diff: ReturnType<typeof computeDelta>,
): string {
  const lines: string[] = []
  lines.push(`# ${current.label} — DELTA vs ${priorLabel}`)
  lines.push("")
  lines.push(
    `Regressions: ${diff.regressions.length}  ·  Improvements: ${diff.improvements.length}  ·  Stuck ≤3: ${diff.stuckLow.length}`,
  )
  lines.push("")

  const section = (title: string, rows: DeltaRow[]) => {
    lines.push(`## ${title}`)
    lines.push("")
    if (rows.length === 0) {
      lines.push("_None._")
      lines.push("")
      return
    }
    lines.push("| slug | persona | viewport | pillar | from | to |")
    lines.push("| --- | --- | --- | --- | --- | --- |")
    for (const r of rows) {
      lines.push(
        `| ${r.slug} | ${r.persona} | ${r.viewport} | ${r.pillar} | ${r.from} | ${r.to} |`,
      )
    }
    lines.push("")
  }

  section("Regressions (pillar dropped ≥2 levels)", diff.regressions)
  section("Improvements (pillar lifted ≥1 level)", diff.improvements)
  section("Stuck low (same score, still ≤3)", diff.stuckLow)
  return lines.join("\n")
}

// ── Report writer ──────────────────────────────────────────────────────
export async function writeReports(
  run: RunSummary,
  opts: { reportsDir: string; prior?: string },
): Promise<{
  scoresPath: string
  findingsPath: string
  summaryPath: string
  deltaPath?: string
}> {
  await mkdir(opts.reportsDir, { recursive: true })
  const scoresPath = join(opts.reportsDir, `${run.label}-SCORES.md`)
  const findingsPath = join(opts.reportsDir, `${run.label}-FINDINGS.md`)
  const summaryPath = join(opts.reportsDir, `${run.label}-SUMMARY.json`)
  await writeFile(scoresPath, renderScoresMd(run), "utf8")
  await writeFile(findingsPath, renderFindingsMd(run), "utf8")
  await writeFile(summaryPath, JSON.stringify(run, null, 2), "utf8")

  let deltaPath: string | undefined
  if (opts.prior) {
    const priorPath = join(opts.reportsDir, `${opts.prior}-SUMMARY.json`)
    if (existsSync(priorPath)) {
      const raw = await readFile(priorPath, "utf8")
      const prior = JSON.parse(raw) as RunSummary
      const diff = computeDelta(prior, run)
      deltaPath = join(opts.reportsDir, `${run.label}-DELTA.md`)
      await writeFile(deltaPath, renderDeltaMd(opts.prior, run, diff), "utf8")
    }
  }
  return { scoresPath, findingsPath, summaryPath, deltaPath }
}

// ── CLI ────────────────────────────────────────────────────────────────
function parseArgs(argv: string[]): {
  label: string
  fixture: string
  vision: boolean
  prior?: string
  shotsDir?: string
  reportsDir?: string
} {
  const args = argv.slice(2)
  let label: string | undefined
  let fixture = "healthy"
  let vision = false
  let prior: string | undefined
  let shotsDir: string | undefined
  let reportsDir: string | undefined
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === "--fixture") fixture = args[++i]
    else if (a === "--vision") vision = true
    else if (a === "--prior") prior = args[++i]
    else if (a === "--shots-dir") shotsDir = args[++i]
    else if (a === "--reports-dir") reportsDir = args[++i]
    else if (!label && a && !a.startsWith("--")) label = a
  }
  if (!label) {
    throw new Error(
      "Usage: npx tsx audit/score-run.ts <label> [--fixture <name>] [--vision] [--prior <label>]",
    )
  }
  return { label, fixture, vision, prior, shotsDir, reportsDir }
}

export async function main(argv: string[] = process.argv): Promise<void> {
  const a = parseArgs(argv)
  const run = await runScoring({
    label: a.label,
    fixture: a.fixture,
    vision: a.vision,
    prior: a.prior,
    shotsDir: a.shotsDir,
    reportsDir: a.reportsDir,
  })
  const reportsDir = resolve(
    a.reportsDir ?? join(process.cwd(), "audit/reports"),
  )
  const out = await writeReports(run, { reportsDir, prior: a.prior })
  console.log(`[score] cells=${run.cells.length} fixture=${run.fixture}`)
  console.log(`[score] wrote ${out.scoresPath}`)
  console.log(`[score] wrote ${out.findingsPath}`)
  console.log(`[score] wrote ${out.summaryPath}`)
  if (out.deltaPath) console.log(`[score] wrote ${out.deltaPath}`)
}

const invoked = process.argv[1] && /score-run\.(ts|js)$/.test(process.argv[1])
if (invoked) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
