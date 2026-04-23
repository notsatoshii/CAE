// @vitest-environment node
/**
 * audit/score/pillars.test.ts — Phase 15 Cap.4.
 *
 * Feeds synthetic truth/console JSON into each pillar scorer and asserts
 * expected 1-5 scores. No real fixture files, no Playwright.
 */
import { afterAll, describe, expect, it } from "vitest"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  scoreCell,
  scorePillar,
  type CaptureCell,
} from "./pillars"

const tmpDirs: string[] = []

async function mkCell(opts: {
  truth: unknown
  consoleJson?: unknown
  expectedFixture?: unknown
  slug?: string
}): Promise<CaptureCell> {
  const dir = await mkdtemp(join(tmpdir(), "audit-pillars-"))
  tmpDirs.push(dir)
  const truthPath = join(dir, "x.truth.json")
  const consolePath = join(dir, "x.console.json")
  await writeFile(truthPath, JSON.stringify(opts.truth ?? []), "utf8")
  await writeFile(
    consolePath,
    JSON.stringify(opts.consoleJson ?? { console: [], page_errors: [] }),
    "utf8",
  )
  return {
    fixture: "test",
    persona: "test-p",
    route: "/x",
    slug: opts.slug ?? "x",
    viewport: "laptop",
    pngPath: join(dir, "x.png"),
    truthPath,
    consolePath,
    expectedFixture: opts.expectedFixture,
  }
}

afterAll(async () => {
  for (const d of tmpDirs) await rm(d, { recursive: true, force: true })
})

describe("scorePillar: truth", () => {
  it("scores 5 on exact match", async () => {
    const cell = await mkCell({
      truth: [
        { key: "a", value: "1" },
        { key: "b", value: "2" },
      ],
      expectedFixture: {
        readExpectedTruth: () => ({ a: "1", b: "2" }),
      },
    })
    const r = await scorePillar("truth", cell)
    expect(r.score).toBe(5)
  })

  it("scores 1 on pervasive drift", async () => {
    const cell = await mkCell({
      truth: [
        { key: "a", value: "wrong" },
        { key: "b", value: "wrong" },
        { key: "c", value: "wrong" },
        { key: "d", value: "wrong" },
      ],
      expectedFixture: {
        readExpectedTruth: () => ({ a: "1", b: "2", c: "3", d: "4" }),
      },
    })
    const r = await scorePillar("truth", cell)
    expect(r.score).toBe(1)
  })

  it("scores 3 (placeholder) when fixture has no readExpectedTruth", async () => {
    const cell = await mkCell({
      truth: [],
      expectedFixture: {},
    })
    const r = await scorePillar("truth", cell)
    expect(r.score).toBe(3)
    expect(r.evidence.join(" ")).toMatch(/fixture missing/)
  })
})

describe("scorePillar: depth", () => {
  it("scores 5 when ≥80% of expected keys rendered", async () => {
    const truth = Array.from({ length: 10 }, (_, i) => ({
      key: `k${i}`,
      value: "v",
    }))
    const cell = await mkCell({ truth, slug: "metrics" }) // ROUTE_DEPTH[metrics] = 10
    const r = await scorePillar("depth", cell)
    expect(r.score).toBe(5)
    expect(r.na).toBeUndefined()
  })

  it("scores 1 when none rendered and access is 'render'", async () => {
    const cell = await mkCell({ truth: [], slug: "metrics" })
    cell.expectedAccess = "render"
    const r = await scorePillar("depth", cell)
    expect(r.score).toBe(1)
    expect(r.na).toBeUndefined()
  })

  it("scores 3 at ~50% coverage", async () => {
    const truth = Array.from({ length: 5 }, (_, i) => ({
      key: `k${i}`,
      value: "v",
    }))
    const cell = await mkCell({ truth, slug: "metrics" }) // 5/10 = 0.5 → 3
    const r = await scorePillar("depth", cell)
    expect(r.score).toBe(3)
  })

  it("marks N/A when expectedAccess='gate' and zero keys rendered", async () => {
    const cell = await mkCell({ truth: [], slug: "build-admin-roles" })
    cell.expectedAccess = "gate"
    const r = await scorePillar("depth", cell)
    expect(r.na).toBe(true)
    expect(r.evidence.join(" ")).toMatch(/access=gate/)
  })

  it("marks N/A when expectedAccess='redirect' and zero keys rendered", async () => {
    const cell = await mkCell({ truth: [], slug: "build" })
    cell.expectedAccess = "redirect"
    const r = await scorePillar("depth", cell)
    expect(r.na).toBe(true)
    expect(r.evidence.join(" ")).toMatch(/access=redirect/)
  })

  it("does NOT mark N/A when keys did render despite gate expectation", async () => {
    // Should never happen in practice, but if it does we want the
    // anomaly surfaced, not buried in N/A.
    const cell = await mkCell({
      truth: [{ key: "a", value: "v" }],
      slug: "build-admin-roles",
    })
    cell.expectedAccess = "gate"
    const r = await scorePillar("depth", cell)
    expect(r.na).toBeUndefined()
  })

  it("keeps score 1 when expectedAccess is undefined (legacy fallback)", async () => {
    const cell = await mkCell({ truth: [], slug: "metrics" })
    // expectedAccess intentionally unset
    const r = await scorePillar("depth", cell)
    expect(r.score).toBe(1)
    expect(r.na).toBeUndefined()
  })
})

describe("scorePillar: liveness", () => {
  it("scores 5 when all 5 markers present", async () => {
    const truth = [
      { key: "mission.loading", value: "" },
      { key: "mission.empty", value: "" },
      { key: "mission.error", value: "" },
      { key: "mission.stale", value: "" },
      { key: "mission.healthy", value: "" },
    ]
    const cell = await mkCell({ truth })
    const r = await scorePillar("liveness", cell)
    expect(r.score).toBe(5)
  })

  it("scores 1 when none present", async () => {
    const cell = await mkCell({ truth: [{ key: "unrelated", value: "" }] })
    const r = await scorePillar("liveness", cell)
    expect(r.score).toBe(1)
  })
})

describe("scorePillar: voice", () => {
  it("scores 5 when no banned phrases", async () => {
    const truth = [
      { key: "queue", value: "Queue is clear" },
      { key: "status", value: "Everything is running" },
    ]
    const cell = await mkCell({ truth })
    const r = await scorePillar("voice", cell)
    expect(r.score).toBe(5)
  })

  it("drops 1 per banned hit", async () => {
    const truth = [
      { key: "a", value: "No data" },
      { key: "b", value: "Loading..." },
    ]
    const cell = await mkCell({ truth })
    const r = await scorePillar("voice", cell)
    expect(r.score).toBe(3)
  })

  it("floors at 1", async () => {
    const truth = [
      { key: "a", value: "No data" },
      { key: "b", value: "Loading..." },
      { key: "c", value: "Error" },
      { key: "d", value: "Empty" },
      { key: "e", value: "Failed" },
      { key: "f", value: "Please try again" },
      { key: "g", value: "No items" },
    ]
    const cell = await mkCell({ truth })
    const r = await scorePillar("voice", cell)
    expect(r.score).toBe(1)
  })
})

describe("scorePillar: craft", () => {
  it("returns placeholder 3", async () => {
    const cell = await mkCell({ truth: [] })
    const r = await scorePillar("craft", cell)
    expect(r.score).toBe(3)
    expect(r.evidence.join(" ")).toMatch(/llm-vision/)
  })
})

describe("scorePillar: reliability", () => {
  it("scores 5 with zero errors/warnings", async () => {
    const cell = await mkCell({ truth: [] })
    const r = await scorePillar("reliability", cell)
    expect(r.score).toBe(5)
  })

  it("scores 2 at 4 errors", async () => {
    const cell = await mkCell({
      truth: [],
      consoleJson: {
        console: [
          { type: "error", text: "x" },
          { type: "error", text: "y" },
          { type: "error", text: "z" },
          { type: "error", text: "w" },
        ],
        page_errors: [],
      },
    })
    const r = await scorePillar("reliability", cell)
    expect(r.score).toBe(2)
  })

  it("warnings count half", async () => {
    const cell = await mkCell({
      truth: [],
      consoleJson: {
        console: [
          { type: "warning", text: "x" },
          { type: "warning", text: "y" },
        ],
        page_errors: [],
      },
    })
    // 2 warnings → ceil(2/2) = 1 effective → score 4
    const r = await scorePillar("reliability", cell)
    expect(r.score).toBe(4)
  })
})

describe("scorePillar: ia", () => {
  it("returns placeholder 3 when no ia sidecar", async () => {
    const cell = await mkCell({ truth: [] })
    const r = await scorePillar("ia", cell)
    expect(r.score).toBe(3)
  })
})

describe("scoreCell", () => {
  it("emits a result for every pillar", async () => {
    const cell = await mkCell({
      truth: [{ key: "a", value: "1" }],
      expectedFixture: { readExpectedTruth: () => ({ a: "1" }) },
    })
    const all = await scoreCell(cell)
    expect(Object.keys(all).sort()).toEqual(
      ["craft", "depth", "ia", "liveness", "reliability", "truth", "voice"].sort(),
    )
    for (const k of Object.keys(all)) {
      const r = all[k as keyof typeof all]
      expect(r.score).toBeGreaterThanOrEqual(1)
      expect(r.score).toBeLessThanOrEqual(5)
    }
  })
})
