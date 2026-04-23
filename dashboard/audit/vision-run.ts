/**
 * audit/vision-run.ts — Phase 15 Cap.5 retro-scorer.
 *
 * Consumes an already-captured cycle (PNG + .truth.json + .console.json
 * triples under audit/shots/<fixture>/<persona>/) plus the existing
 * heuristic SUMMARY.json, then fills in the `craft` pillar (or any other
 * requested pillar) via scoreWithVision() against the Anthropic Messages
 * API.
 *
 * Designed to be rerun safely: the scorer's SHA256-keyed disk cache under
 * audit/score/.cache/ makes second-pass calls free. If the per-process
 * budget (AUDIT_VISION_BUDGET_USD / --budget) runs out, the CLI halts
 * gracefully and preserves whatever scoring has already been written to
 * cache; the next invocation picks up where it left off.
 *
 * Outputs (rewritten in place):
 *   audit/reports/<label>-SUMMARY.json   — canonical machine-readable
 *   audit/reports/<label>-SCORES.md      — re-rendered heatmap+rollup
 *   audit/reports/<label>-VISION-FINDINGS.md — worst craft cells by route
 *
 * Usage:
 *   npx tsx audit/vision-run.ts <label> --fixture healthy
 *     [--budget <usd>] [--limit <n>] [--pillar craft]
 *     [--reports-dir <path>] [--shots-dir <path>]
 */
import { readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import {
  scoreWithVision,
  projectedCallCostUsd,
  _resetCumulativeUsd,
  _getCumulativeUsd,
} from "./score/llm-vision"
import type { CaptureCell, ScoreResult } from "./score/pillars"
import { PILLARS, type PillarId } from "./score/rubric"
import {
  renderScoresMd,
  type CellSummary,
  type RunSummary,
} from "./score-run"

// ── CLI parse ──────────────────────────────────────────────────────────
export interface VisionRunArgs {
  label: string
  fixture: string
  budget: number
  limit?: number
  pillar: PillarId
  reportsDir?: string
  shotsDir?: string
}

function parseArgs(argv: string[]): VisionRunArgs {
  const args = argv.slice(2)
  let label: string | undefined
  let fixture = "healthy"
  let budget = Number.parseFloat(process.env.AUDIT_VISION_BUDGET_USD ?? "6")
  let limit: number | undefined
  let pillar: PillarId = "craft"
  let reportsDir: string | undefined
  let shotsDir: string | undefined
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === "--fixture") fixture = args[++i]
    else if (a === "--budget") budget = Number.parseFloat(args[++i])
    else if (a === "--limit") limit = Number.parseInt(args[++i], 10)
    else if (a === "--pillar") pillar = args[++i] as PillarId
    else if (a === "--reports-dir") reportsDir = args[++i]
    else if (a === "--shots-dir") shotsDir = args[++i]
    else if (!label && a && !a.startsWith("--")) label = a
  }
  if (!label) {
    throw new Error(
      "Usage: npx tsx audit/vision-run.ts <label> [--fixture <name>] " +
        "[--budget <usd>] [--limit <n>] [--pillar craft]",
    )
  }
  if (!Number.isFinite(budget) || budget <= 0) {
    throw new Error(`invalid --budget: ${budget}`)
  }
  if (!(PILLARS as string[]).includes(pillar)) {
    throw new Error(
      `invalid --pillar ${pillar}; expected one of: ${PILLARS.join(", ")}`,
    )
  }
  return { label, fixture, budget, limit, pillar, reportsDir, shotsDir }
}

// ── Retry wrapper ──────────────────────────────────────────────────────
const RETRYABLE = /\b(429|50[0-9]|52[0-9])\b/
const RETRY_BACKOFF_MS = 2000

export async function scoreWithRetry(
  cell: CaptureCell,
  pillar: PillarId,
  opts: { budgetUsd: number },
): Promise<ScoreResult> {
  try {
    return await scoreWithVision(cell, pillar, { budgetUsd: opts.budgetUsd })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Budget-exceeded always propagates — no retry.
    if (/budget exceeded/.test(msg)) throw err
    if (!RETRYABLE.test(msg)) throw err
    await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS))
    return await scoreWithVision(cell, pillar, { budgetUsd: opts.budgetUsd })
  }
}

// ── Shot path resolver ─────────────────────────────────────────────────
function resolveCellPaths(
  shotsDir: string,
  cell: { fixture: string; persona: string; slug: string; viewport: string },
): { pngPath: string; truthPath: string; consolePath: string } {
  const stem = `${cell.slug}--${cell.viewport}`
  const dir = join(shotsDir, cell.fixture, cell.persona)
  return {
    pngPath: join(dir, `${stem}.png`),
    truthPath: join(dir, `${stem}.truth.json`),
    consolePath: join(dir, `${stem}.console.json`),
  }
}

// ── Findings renderer ──────────────────────────────────────────────────
interface Finding {
  cell: CellSummary
  result: ScoreResult | null
  error?: string
}

export function renderVisionFindingsMd(
  label: string,
  pillar: PillarId,
  findings: Finding[],
  meta: { scored: number; skipped: number; cachedHits: number; spentUsd: number; budgetUsd: number },
): string {
  const lines: string[] = []
  lines.push(`# ${label} — VISION-FINDINGS (${pillar})`)
  lines.push("")
  lines.push(
    `Scored: **${meta.scored}**  ·  Cache hits: **${meta.cachedHits}**  ·  ` +
      `Skipped: **${meta.skipped}**  ·  Spent: **$${meta.spentUsd.toFixed(4)}** / $${meta.budgetUsd.toFixed(2)}`,
  )
  lines.push("")
  lines.push(
    `Cells grouped by route, craft score ≤ 3 (and any skipped cells). Each entry shows ` +
      `the LLM's evidence + recommendations verbatim — this is the "what looks bad and why" log.`,
  )
  lines.push("")

  // Group by route.
  const byRoute = new Map<string, Finding[]>()
  for (const f of findings) {
    if (f.result) {
      if (f.result.score > 3) continue
    }
    const list = byRoute.get(f.cell.route) ?? []
    list.push(f)
    byRoute.set(f.cell.route, list)
  }

  if (byRoute.size === 0) {
    lines.push("_All cells scored ≥ 4 on craft. Nothing to flag._")
    lines.push("")
    return lines.join("\n")
  }

  // Sort routes by worst-avg score ascending (worst first).
  const routeAvg = (entries: Finding[]): number => {
    const xs: number[] = entries.map((e) => e.result?.score ?? 1)
    if (xs.length === 0) return 1
    return xs.reduce((a, b) => a + b, 0) / xs.length
  }
  const sortedRoutes = [...byRoute.entries()].sort(
    (a, b) => routeAvg(a[1]) - routeAvg(b[1]),
  )

  for (const [route, entries] of sortedRoutes) {
    const avg = routeAvg(entries).toFixed(2)
    lines.push(`## ${route}  (avg craft: ${avg})`)
    lines.push("")
    // Sort within route worst-first.
    entries.sort((a, b) => (a.result?.score ?? 1) - (b.result?.score ?? 1))
    for (const f of entries) {
      const head = `${f.cell.persona} · ${f.cell.viewport}`
      if (f.error) {
        lines.push(`### ${head} — _skipped_`)
        lines.push("")
        lines.push(`- error: ${f.error}`)
        lines.push("")
        continue
      }
      const r = f.result
      if (!r) continue
      lines.push(`### ${head} — craft **${r.score}**`)
      lines.push("")
      if (r.evidence.length) {
        lines.push(`**Evidence:**`)
        for (const ev of r.evidence) lines.push(`- ${ev}`)
      }
      if (r.recommendations.length) {
        lines.push(``)
        lines.push(`**Recommendations:**`)
        for (const rec of r.recommendations) lines.push(`- ${rec}`)
      }
      lines.push("")
    }
  }

  return lines.join("\n")
}

// ── Main run ───────────────────────────────────────────────────────────
export interface VisionRunResult {
  label: string
  pillar: PillarId
  totalCells: number
  scored: number
  cachedHits: number
  skipped: number
  spentUsd: number
  summaryPath: string
  scoresPath: string
  findingsPath: string
}

export async function runVisionPass(args: VisionRunArgs): Promise<VisionRunResult> {
  const reportsDir = resolve(
    args.reportsDir ?? join(process.cwd(), "audit/reports"),
  )
  const shotsDir = resolve(
    args.shotsDir ?? join(process.cwd(), "audit/shots"),
  )
  const summaryPath = join(reportsDir, `${args.label}-SUMMARY.json`)
  if (!existsSync(summaryPath)) {
    throw new Error(
      `audit/vision-run: missing ${summaryPath}. Run score-run.ts first to produce the heuristic baseline.`,
    )
  }

  const raw = await readFile(summaryPath, "utf8")
  const run = JSON.parse(raw) as RunSummary
  const cells = run.cells.slice(0, args.limit ?? run.cells.length)

  // Reset the module-level cost counter so a fresh invocation has the
  // full budget. The on-disk cache still suppresses duplicate network
  // calls across invocations.
  _resetCumulativeUsd()

  const findings: Finding[] = []
  let scored = 0
  let cachedHits = 0
  let skipped = 0
  let halted = false

  for (let i = 0; i < cells.length; i++) {
    const cs = cells[i]
    const paths = resolveCellPaths(shotsDir, cs)
    if (!existsSync(paths.pngPath)) {
      skipped++
      findings.push({
        cell: cs,
        result: null,
        error: `png missing: ${paths.pngPath}`,
      })
      continue
    }

    const cell: CaptureCell = {
      fixture: cs.fixture,
      persona: cs.persona,
      route: cs.route,
      slug: cs.slug,
      viewport: cs.viewport,
      pngPath: paths.pngPath,
      truthPath: paths.truthPath,
      consolePath: paths.consolePath,
      expectedFixture: null,
    }

    const beforeSpent = _getCumulativeUsd()
    let result: ScoreResult
    try {
      result = await scoreWithRetry(cell, args.pillar, {
        budgetUsd: args.budget,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (/budget exceeded/.test(msg)) {
        halted = true
        skipped++
        findings.push({ cell: cs, result: null, error: `halted: ${msg}` })
        // eslint-disable-next-line no-console
        console.error(
          `[vision] budget exhausted at cell ${i + 1}/${cells.length}; ` +
            `halting gracefully. Remaining cells will be skipped. ` +
            `Re-run after bumping --budget or AUDIT_VISION_BUDGET_USD to resume (cache preserves progress).`,
        )
        break
      }
      skipped++
      findings.push({ cell: cs, result: null, error: msg })
      // eslint-disable-next-line no-console
      console.error(
        `[vision] skip ${cs.persona}/${cs.slug}/${cs.viewport}: ${msg.slice(0, 200)}`,
      )
      continue
    }

    // Merge into the summary in-place.
    cs.scores[args.pillar] = { score: result.score, evidence: result.evidence }
    findings.push({ cell: cs, result })
    scored++
    if (_getCumulativeUsd() === beforeSpent) {
      cachedHits++
    }

    if ((i + 1) % 25 === 0 || i + 1 === cells.length) {
      // eslint-disable-next-line no-console
      console.log(
        `[vision] ${i + 1}/${cells.length}  spent=$${_getCumulativeUsd().toFixed(4)}  ` +
          `cached=${cachedHits}  scored=${scored}  skipped=${skipped}`,
      )
    }
  }

  // Flag truncated runs so readers notice.
  if (halted) {
    run.vision = false
  } else if (scored > 0) {
    run.vision = true
  }

  // Write outputs.
  await writeFile(summaryPath, JSON.stringify(run, null, 2), "utf8")

  const scoresPath = join(reportsDir, `${args.label}-SCORES.md`)
  await writeFile(scoresPath, renderScoresMd(run), "utf8")

  const findingsPath = join(reportsDir, `${args.label}-VISION-FINDINGS.md`)
  const spentUsd = _getCumulativeUsd()
  await writeFile(
    findingsPath,
    renderVisionFindingsMd(args.label, args.pillar, findings, {
      scored,
      cachedHits,
      skipped,
      spentUsd,
      budgetUsd: args.budget,
    }),
    "utf8",
  )

  return {
    label: args.label,
    pillar: args.pillar,
    totalCells: cells.length,
    scored,
    cachedHits,
    skipped,
    spentUsd,
    summaryPath,
    scoresPath,
    findingsPath,
  }
}

// ── Entry point ────────────────────────────────────────────────────────
export async function main(argv: string[] = process.argv): Promise<void> {
  const args = parseArgs(argv)
  const out = await runVisionPass(args)
  // eslint-disable-next-line no-console
  console.log(
    `[vision] done — pillar=${out.pillar} cells=${out.totalCells} ` +
      `scored=${out.scored} cached=${out.cachedHits} skipped=${out.skipped} ` +
      `spent=$${out.spentUsd.toFixed(4)}`,
  )
  // eslint-disable-next-line no-console
  console.log(`[vision] wrote ${out.summaryPath}`)
  // eslint-disable-next-line no-console
  console.log(`[vision] wrote ${out.scoresPath}`)
  // eslint-disable-next-line no-console
  console.log(`[vision] wrote ${out.findingsPath}`)
}

// Guard against importing this file from a test.
const invoked =
  process.argv[1] && /vision-run\.(ts|js)$/.test(process.argv[1])
if (invoked) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}

// Estimate helper — exposed for tests.
export { projectedCallCostUsd }
