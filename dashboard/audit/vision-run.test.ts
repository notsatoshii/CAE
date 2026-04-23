// @vitest-environment node
/**
 * audit/vision-run.test.ts — Phase 15 Cap.5.
 *
 * Exercises the CLI in dry-run mode against a tiny synthetic fixture so
 * we never hit the network. Verifies:
 *  - SUMMARY.json gets the craft pillar rewritten
 *  - SCORES.md regenerates
 *  - VISION-FINDINGS.md lists cells with score ≤ 3
 *  - --limit truncates the iteration
 *  - missing PNG is skipped gracefully (not a throw)
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runVisionPass, renderVisionFindingsMd } from "./vision-run"
import type { RunSummary } from "./score-run"

const tmpDirs: string[] = []

async function setupFixture(): Promise<{
  reportsDir: string
  shotsDir: string
  summaryPath: string
}> {
  const root = await mkdtemp(join(tmpdir(), "vision-run-"))
  tmpDirs.push(root)
  const reportsDir = join(root, "reports")
  const shotsDir = join(root, "shots")
  await mkdir(reportsDir, { recursive: true })
  const persona = "admin"
  const fixture = "healthy"
  const viewport = "laptop"
  // Two cells: one will have a PNG, the other won't (tests skip path).
  const cellDir = join(shotsDir, fixture, persona)
  await mkdir(cellDir, { recursive: true })
  await writeFile(join(cellDir, `alpha--${viewport}.png`), Buffer.from("x"))
  // Skip: no PNG for beta--laptop

  const run: RunSummary = {
    label: "TEST",
    fixture,
    vision: false,
    cells: [
      {
        fixture,
        persona,
        route: "alpha",
        slug: "alpha",
        viewport,
        scores: {
          truth: { score: 5, evidence: [] },
          depth: { score: 4, evidence: [] },
          liveness: { score: 3, evidence: [] },
          voice: { score: 5, evidence: [] },
          craft: { score: 3, evidence: ["requires Cap.5 llm-vision"] },
          reliability: { score: 5, evidence: [] },
          ia: { score: 3, evidence: [] },
        },
      },
      {
        fixture,
        persona,
        route: "beta",
        slug: "beta",
        viewport,
        scores: {
          truth: { score: 5, evidence: [] },
          depth: { score: 4, evidence: [] },
          liveness: { score: 3, evidence: [] },
          voice: { score: 5, evidence: [] },
          craft: { score: 3, evidence: ["requires Cap.5 llm-vision"] },
          reliability: { score: 5, evidence: [] },
          ia: { score: 3, evidence: [] },
        },
      },
    ],
  }

  const summaryPath = join(reportsDir, "TEST-SUMMARY.json")
  await writeFile(summaryPath, JSON.stringify(run, null, 2), "utf8")

  return { reportsDir, shotsDir, summaryPath }
}

afterAll(async () => {
  for (const d of tmpDirs) await rm(d, { recursive: true, force: true })
})

beforeEach(() => {
  process.env.AUDIT_VISION_DRY_RUN = "1"
})

describe("runVisionPass (dry-run)", () => {
  it("rewrites SUMMARY.json with craft score from dry-run scorer", async () => {
    const fix = await setupFixture()
    await runVisionPass({
      label: "TEST",
      fixture: "healthy",
      budget: 6,
      pillar: "craft",
      reportsDir: fix.reportsDir,
      shotsDir: fix.shotsDir,
    })
    const parsed = JSON.parse(await readFile(fix.summaryPath, "utf8")) as RunSummary
    const alpha = parsed.cells.find((c) => c.slug === "alpha")!
    expect(alpha.scores.craft.score).toBe(3)
    expect(alpha.scores.craft.evidence).toEqual(["dry-run"])
    expect(parsed.vision).toBe(true)
  })

  it("skips cells with missing PNG instead of throwing", async () => {
    const fix = await setupFixture()
    const out = await runVisionPass({
      label: "TEST",
      fixture: "healthy",
      budget: 6,
      pillar: "craft",
      reportsDir: fix.reportsDir,
      shotsDir: fix.shotsDir,
    })
    // alpha scored, beta skipped.
    expect(out.scored).toBe(1)
    expect(out.skipped).toBe(1)
  })

  it("emits VISION-FINDINGS.md listing low-craft cells grouped by route", async () => {
    const fix = await setupFixture()
    await runVisionPass({
      label: "TEST",
      fixture: "healthy",
      budget: 6,
      pillar: "craft",
      reportsDir: fix.reportsDir,
      shotsDir: fix.shotsDir,
    })
    const findings = await readFile(
      join(fix.reportsDir, "TEST-VISION-FINDINGS.md"),
      "utf8",
    )
    expect(findings).toContain("# TEST — VISION-FINDINGS (craft)")
    expect(findings).toContain("alpha")
    // beta appears as skipped (error branch).
    expect(findings).toContain("beta")
    expect(findings).toContain("craft **3**")
  })

  it("respects --limit", async () => {
    const fix = await setupFixture()
    const out = await runVisionPass({
      label: "TEST",
      fixture: "healthy",
      budget: 6,
      limit: 1,
      pillar: "craft",
      reportsDir: fix.reportsDir,
      shotsDir: fix.shotsDir,
    })
    expect(out.totalCells).toBe(1)
  })

  it("refuses to run without a prior SUMMARY.json", async () => {
    const fix = await setupFixture()
    await rm(fix.summaryPath)
    await expect(
      runVisionPass({
        label: "TEST",
        fixture: "healthy",
        budget: 6,
        pillar: "craft",
        reportsDir: fix.reportsDir,
        shotsDir: fix.shotsDir,
      }),
    ).rejects.toThrow(/missing .*SUMMARY\.json/)
  })
})

describe("renderVisionFindingsMd", () => {
  it("reports the 'all clean' case when every score is > 3", () => {
    const md = renderVisionFindingsMd(
      "C9",
      "craft",
      [
        {
          cell: {
            fixture: "healthy",
            persona: "p",
            route: "r",
            slug: "r",
            viewport: "v",
            scores: {} as never,
          },
          result: { score: 5, evidence: [], recommendations: [] },
        },
      ],
      { scored: 1, cachedHits: 0, skipped: 0, spentUsd: 0.01, budgetUsd: 6 },
    )
    expect(md).toContain("All cells scored ≥ 4")
  })
})
