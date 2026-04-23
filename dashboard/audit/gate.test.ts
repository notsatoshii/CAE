/**
 * audit/gate.test.ts — Phase 15 Cap.8.
 */
import { describe, it, expect } from "vitest"
import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { checkFixGate } from "./gate"
import type { PillarId } from "./score/rubric"

interface CellShape {
  slug: string
  persona: string
  viewport: string
  route: string
  fixture: string
  scores: Record<
    PillarId,
    { score: 1 | 2 | 3 | 4 | 5; evidence: string[] }
  >
}

function cell(
  slug: string,
  overrides: Partial<Record<PillarId, 1 | 2 | 3 | 4 | 5>> = {},
  persona = "admin",
  viewport = "laptop",
): CellShape {
  const base = {
    truth: 5,
    depth: 5,
    liveness: 5,
    voice: 5,
    craft: 5,
    reliability: 5,
    ia: 5,
  } as const
  const out = {} as CellShape["scores"]
  for (const p of [
    "truth",
    "depth",
    "liveness",
    "voice",
    "craft",
    "reliability",
    "ia",
  ] as const) {
    out[p] = { score: (overrides[p] ?? base[p]) as 1 | 2 | 3 | 4 | 5, evidence: [] }
  }
  return {
    slug,
    persona,
    viewport,
    route: slug,
    fixture: "healthy",
    scores: out,
  }
}

async function seedSummary(
  reportsDir: string,
  label: string,
  cells: CellShape[],
): Promise<void> {
  await mkdir(reportsDir, { recursive: true })
  await writeFile(
    join(reportsDir, `${label}-SUMMARY.json`),
    JSON.stringify(
      { label, fixture: "healthy", vision: false, cells },
      null,
      2,
    ),
    "utf8",
  )
}

describe("gate", () => {
  it("passes when no regression and no new ≤3", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gate-pass-"))
    const reportsDir = join(dir, "reports")
    await seedSummary(reportsDir, "C1", [cell("build")])
    await seedSummary(reportsDir, "C2", [cell("build")])
    const r = await checkFixGate({
      cycle: "C2",
      priorCycle: "C1",
      reportsDir,
    })
    expect(r.pass).toBe(true)
    expect(r.regressions).toHaveLength(0)
    expect(r.unresolved).toHaveLength(0)
  })

  it("fails on ≥2-level regression", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gate-regress-"))
    const reportsDir = join(dir, "reports")
    await seedSummary(reportsDir, "C1", [cell("build", { truth: 5 })])
    await seedSummary(reportsDir, "C2", [cell("build", { truth: 3 })])
    const r = await checkFixGate({
      cycle: "C2",
      priorCycle: "C1",
      reportsDir,
    })
    expect(r.pass).toBe(false)
    expect(r.regressions).toHaveLength(1)
    expect(r.regressions[0]).toMatchObject({
      slug: "build",
      pillar: "truth",
      from: 5,
      to: 3,
    })
  })

  it("does NOT flag a 1-level drop (that's below threshold)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gate-soft-"))
    const reportsDir = join(dir, "reports")
    await seedSummary(reportsDir, "C1", [cell("build", { truth: 5 })])
    await seedSummary(reportsDir, "C2", [cell("build", { truth: 4 })])
    const r = await checkFixGate({
      cycle: "C2",
      priorCycle: "C1",
      reportsDir,
    })
    expect(r.pass).toBe(true)
    expect(r.regressions).toHaveLength(0)
  })

  it("fails on new ≤3 breakage (was >3 in prior)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gate-new-low-"))
    const reportsDir = join(dir, "reports")
    await seedSummary(reportsDir, "C1", [cell("build", { depth: 4 })])
    // Drop to 3 — only 1 level but triggers Rule B (was >3, now ≤3).
    await seedSummary(reportsDir, "C2", [cell("build", { depth: 3 })])
    const r = await checkFixGate({
      cycle: "C2",
      priorCycle: "C1",
      reportsDir,
    })
    expect(r.pass).toBe(false)
    expect(r.unresolved.some((u) => u.pillar === "depth" && u.score === 3)).toBe(
      true,
    )
  })

  it("does NOT flag ≤3 that was already ≤3 in prior (existing debt)", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gate-existing-"))
    const reportsDir = join(dir, "reports")
    await seedSummary(reportsDir, "C1", [cell("build", { depth: 2 })])
    await seedSummary(reportsDir, "C2", [cell("build", { depth: 2 })])
    const r = await checkFixGate({
      cycle: "C2",
      priorCycle: "C1",
      reportsDir,
    })
    expect(r.pass).toBe(true)
    expect(r.unresolved).toHaveLength(0)
  })

  it("routeFilter narrows to only listed slugs", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gate-filter-"))
    const reportsDir = join(dir, "reports")
    await seedSummary(reportsDir, "C1", [
      cell("build", { truth: 5 }),
      cell("memory", { truth: 5 }),
    ])
    await seedSummary(reportsDir, "C2", [
      cell("build", { truth: 5 }),
      cell("memory", { truth: 2 }), // regression on memory only
    ])
    const inScope = await checkFixGate({
      cycle: "C2",
      priorCycle: "C1",
      reportsDir,
      routeFilter: ["build"],
    })
    expect(inScope.pass).toBe(true)

    const all = await checkFixGate({
      cycle: "C2",
      priorCycle: "C1",
      reportsDir,
    })
    expect(all.pass).toBe(false)
    expect(all.regressions.some((r) => r.slug === "memory")).toBe(true)
  })

  it("fails when current summary is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gate-missing-"))
    const reportsDir = join(dir, "reports")
    await mkdir(reportsDir, { recursive: true })
    const r = await checkFixGate({ cycle: "C99", reportsDir })
    expect(r.pass).toBe(false)
    expect(r.reasons[0]).toMatch(/current cycle summary missing/)
  })

  it("with no priorCycle: every ≤3 is unresolved", async () => {
    const dir = await mkdtemp(join(tmpdir(), "gate-no-prior-"))
    const reportsDir = join(dir, "reports")
    await seedSummary(reportsDir, "C1", [cell("build", { truth: 3, depth: 5 })])
    const r = await checkFixGate({ cycle: "C1", reportsDir })
    expect(r.pass).toBe(false)
    expect(r.unresolved.some((u) => u.pillar === "truth")).toBe(true)
    expect(r.unresolved.some((u) => u.pillar === "depth")).toBe(false)
  })
})
