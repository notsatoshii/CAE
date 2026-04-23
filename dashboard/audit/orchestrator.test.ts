/**
 * audit/orchestrator.test.ts — Phase 15 Cap.7.
 *
 * Coverage for seed-fixture + score-run. Does NOT exec run-cycle.sh
 * (no dev server, no Playwright). All fs work happens in mkdtemp()ed
 * dirs so tests stay hermetic.
 */
import { describe, it, expect } from "vitest"
import { mkdtemp, writeFile, mkdir, readFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { seedFixture } from "./seed-fixture"
import { readExpectedTruth as healthyReadExpectedTruth } from "./fixtures/healthy"
import {
  runScoring,
  writeReports,
  computeDelta,
  renderDeltaMd,
  type RunSummary,
} from "./score-run"

// ── seed-fixture ───────────────────────────────────────────────────────
describe("seed-fixture", () => {
  it("seeds empty fixture into a tmpdir", async () => {
    const root = await mkdtemp(join(tmpdir(), "cae-seed-empty-"))
    const s = await seedFixture("empty", root)
    expect(s.fixture).toBe("empty")
    expect(s.root).toBe(root)
    expect(s.fileCount).toBeGreaterThan(0)
    expect(existsSync(join(root, ".cae/metrics/circuit-breakers.jsonl"))).toBe(
      true,
    )
  })

  it("seeds healthy fixture with non-empty bytes", async () => {
    const root = await mkdtemp(join(tmpdir(), "cae-seed-healthy-"))
    const s = await seedFixture("healthy", root)
    expect(s.totalBytes).toBeGreaterThan(0)
    const cb = await readFile(
      join(root, ".cae/metrics/circuit-breakers.jsonl"),
      "utf8",
    )
    expect(cb.split("\n").filter(Boolean).length).toBeGreaterThan(0)
  })

  it("rejects unknown fixture", async () => {
    await expect(seedFixture("bogus", "/tmp/nope")).rejects.toThrow(
      /unknown fixture/,
    )
  })
})

// ── score-run ──────────────────────────────────────────────────────────
async function writeSyntheticCell(
  shotsDir: string,
  fixture: string,
  persona: string,
  slug: string,
  viewport: string,
  opts: {
    truth?: Array<{ key: string; value: string }>
    console?: { console: Array<{ type: string; text: string }> }
  } = {},
): Promise<void> {
  const dir = join(shotsDir, fixture, persona)
  await mkdir(dir, { recursive: true })
  const stem = `${slug}--${viewport}`
  // Minimal non-zero PNG placeholder — 1-byte file satisfies reads.
  // Scorer doesn't decode it; llm-vision is skipped.
  await writeFile(join(dir, `${stem}.png`), "x", "utf8")
  await writeFile(
    join(dir, `${stem}.truth.json`),
    JSON.stringify(opts.truth ?? []),
    "utf8",
  )
  await writeFile(
    join(dir, `${stem}.console.json`),
    JSON.stringify(opts.console ?? { console: [], page_errors: [] }),
    "utf8",
  )
}

describe("score-run", () => {
  it("writes SCORES.md, FINDINGS.md, SUMMARY.json for a minimal cell", async () => {
    const workDir = await mkdtemp(join(tmpdir(), "cae-score-"))
    const shotsDir = join(workDir, "shots")
    const reportsDir = join(workDir, "reports")

    // healthy fixture's readExpectedTruth() expects a map of scalar keys.
    // Reflect it 1:1 so truth pillar scores 5 (zero drift) while we also
    // cover every annotation we've added to product code.
    const healthyExpected = healthyReadExpectedTruth()
    await writeSyntheticCell(
      shotsDir,
      "healthy",
      "admin",
      "build",
      "laptop",
      {
        truth: Object.entries(healthyExpected).map(([key, value]) => ({
          key,
          value,
        })),
      },
    )

    const run = await runScoring({
      label: "C1",
      fixture: "healthy",
      shotsDir,
    })
    expect(run.cells.length).toBe(1)
    expect(run.cells[0].slug).toBe("build")
    expect(run.cells[0].viewport).toBe("laptop")
    // truth should be 5 — every expected key matches exactly.
    expect(run.cells[0].scores.truth.score).toBe(5)

    const out = await writeReports(run, { reportsDir })
    expect(existsSync(out.scoresPath)).toBe(true)
    expect(existsSync(out.findingsPath)).toBe(true)
    expect(existsSync(out.summaryPath)).toBe(true)

    const summary = JSON.parse(await readFile(out.summaryPath, "utf8"))
    expect(summary.label).toBe("C1")
    expect(summary.fixture).toBe("healthy")
    expect(Array.isArray(summary.cells)).toBe(true)
    expect(summary.cells[0].scores.truth.score).toBe(5)

    const scoresMd = await readFile(out.scoresPath, "utf8")
    expect(scoresMd).toContain("# C1 — SCORES")
    expect(scoresMd).toContain("## Rollup")
    expect(scoresMd).toContain("## Heatmap")
  })

  it("FINDINGS.md surfaces low-score cells grouped by route", async () => {
    const workDir = await mkdtemp(join(tmpdir(), "cae-findings-"))
    const shotsDir = join(workDir, "shots")
    const reportsDir = join(workDir, "reports")

    // No truth rows → depth=1, truth≈1, reliability=5, liveness=1 → findings.
    await writeSyntheticCell(
      shotsDir,
      "healthy",
      "operator",
      "build-queue",
      "wide",
    )

    const run = await runScoring({
      label: "C2",
      fixture: "healthy",
      shotsDir,
    })
    const out = await writeReports(run, { reportsDir })
    const findings = await readFile(out.findingsPath, "utf8")
    expect(findings).toContain("## build-queue")
    expect(findings).toContain("operator")
  })
})

// ── delta ──────────────────────────────────────────────────────────────
function mkCell(
  slug: string,
  persona: string,
  viewport: string,
  scores: Record<string, number>,
): RunSummary["cells"][number] {
  const out = {} as RunSummary["cells"][number]["scores"]
  for (const p of [
    "truth",
    "depth",
    "liveness",
    "voice",
    "craft",
    "reliability",
    "ia",
  ] as const) {
    const s = (scores[p] ?? 5) as 1 | 2 | 3 | 4 | 5
    out[p] = { score: s, evidence: [] }
  }
  return {
    fixture: "healthy",
    persona,
    route: slug,
    slug,
    viewport,
    scores: out,
  }
}

describe("delta", () => {
  it("detects regression when pillar drops ≥2 levels", async () => {
    const prior: RunSummary = {
      label: "C1",
      fixture: "healthy",
      vision: false,
      cells: [mkCell("build", "admin", "laptop", { truth: 5 })],
    }
    const current: RunSummary = {
      label: "C2",
      fixture: "healthy",
      vision: false,
      cells: [mkCell("build", "admin", "laptop", { truth: 3 })],
    }
    const diff = computeDelta(prior, current)
    expect(diff.regressions).toHaveLength(1)
    expect(diff.regressions[0].pillar).toBe("truth")
    expect(diff.regressions[0].from).toBe(5)
    expect(diff.regressions[0].to).toBe(3)

    const md = renderDeltaMd("C1", current, diff)
    expect(md).toContain("# C2 — DELTA vs C1")
    expect(md).toContain("Regressions (pillar dropped ≥2 levels)")
    expect(md).toContain("| build |")
  })

  it("writes DELTA.md when --prior supplied and SUMMARY exists", async () => {
    const workDir = await mkdtemp(join(tmpdir(), "cae-delta-"))
    const shotsDir = join(workDir, "shots")
    const reportsDir = join(workDir, "reports")
    await mkdir(reportsDir, { recursive: true })

    // Seed a prior SUMMARY.json claiming truth=5 everywhere.
    const priorRun: RunSummary = {
      label: "C1",
      fixture: "healthy",
      vision: false,
      cells: [mkCell("build", "admin", "laptop", { truth: 5, depth: 5 })],
    }
    await writeFile(
      join(reportsDir, "C1-SUMMARY.json"),
      JSON.stringify(priorRun, null, 2),
      "utf8",
    )

    // Build a current cell with degraded truth.
    await writeSyntheticCell(
      shotsDir,
      "healthy",
      "admin",
      "build",
      "laptop",
      { truth: [] }, // no rows → truth score drops
    )
    const run = await runScoring({
      label: "C2",
      fixture: "healthy",
      shotsDir,
    })
    const out = await writeReports(run, { reportsDir, prior: "C1" })
    expect(out.deltaPath).toBeDefined()
    expect(existsSync(out.deltaPath!)).toBe(true)
    const md = await readFile(out.deltaPath!, "utf8")
    expect(md).toContain("DELTA vs C1")
  })

  it("improvements + stuckLow classify correctly", () => {
    const prior: RunSummary = {
      label: "C1",
      fixture: "healthy",
      vision: false,
      cells: [
        mkCell("build", "admin", "laptop", {
          truth: 3,
          depth: 2,
          reliability: 2,
        }),
      ],
    }
    const current: RunSummary = {
      label: "C2",
      fixture: "healthy",
      vision: false,
      cells: [
        mkCell("build", "admin", "laptop", {
          truth: 3, // stuck low (still ≤3)
          depth: 4, // improved +2 (counts as improvement)
          reliability: 2, // stuck low
        }),
      ],
    }
    const diff = computeDelta(prior, current)
    expect(diff.improvements.some((r) => r.pillar === "depth")).toBe(true)
    expect(diff.stuckLow.some((r) => r.pillar === "truth")).toBe(true)
    expect(diff.stuckLow.some((r) => r.pillar === "reliability")).toBe(true)
  })
})
