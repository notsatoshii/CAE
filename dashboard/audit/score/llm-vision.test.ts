// @vitest-environment node
/**
 * audit/score/llm-vision.test.ts — Phase 15 Cap.5.
 *
 * Covers dryRun, cache-hit, and budget-guard paths. No network.
 *
 * Cache-hit test seeds a JSON file at the expected hash path and asserts
 * scoreWithVision reads it. The hash is computed from the PNG bytes, the
 * pillar, and RUBRIC_VERSION — same logic the module uses internally.
 */
import { afterAll, beforeEach, describe, expect, it } from "vitest"
import { createHash } from "node:crypto"
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  scoreWithVision,
  projectedCallCostUsd,
  _resetCumulativeUsd,
} from "./llm-vision"
import { RUBRIC_VERSION } from "./rubric"
import type { CaptureCell } from "./pillars"

const tmpDirs: string[] = []

async function mkCell(opts: { png?: Buffer } = {}): Promise<CaptureCell> {
  const dir = await mkdtemp(join(tmpdir(), "audit-vision-"))
  tmpDirs.push(dir)
  const pngPath = join(dir, "shot.png")
  await writeFile(pngPath, opts.png ?? Buffer.from("fake-png-bytes"))
  return {
    fixture: "test",
    persona: "p",
    route: "/x",
    slug: "x",
    viewport: "laptop",
    pngPath,
    truthPath: join(dir, "x.truth.json"),
    consolePath: join(dir, "x.console.json"),
    expectedFixture: null,
  }
}

afterAll(async () => {
  for (const d of tmpDirs) await rm(d, { recursive: true, force: true })
})

beforeEach(() => {
  _resetCumulativeUsd()
})

describe("scoreWithVision dryRun", () => {
  it("returns placeholder shape without any network call", async () => {
    const cell = await mkCell()
    const r = await scoreWithVision(cell, "craft", { dryRun: true })
    expect(r.score).toBe(3)
    expect(r.evidence).toEqual(["dry-run"])
    expect(r.recommendations).toEqual([])
  })

  it("honors AUDIT_VISION_DRY_RUN=1 env default", async () => {
    const prev = process.env.AUDIT_VISION_DRY_RUN
    process.env.AUDIT_VISION_DRY_RUN = "1"
    try {
      const cell = await mkCell()
      const r = await scoreWithVision(cell, "craft")
      expect(r.score).toBe(3)
    } finally {
      process.env.AUDIT_VISION_DRY_RUN = prev
    }
  })
})

describe("scoreWithVision cache", () => {
  it("returns cached result without calling network", async () => {
    const pngBytes = Buffer.from("cache-test-bytes")
    const cell = await mkCell({ png: pngBytes })
    const cacheDir = join(tmpDirs[tmpDirs.length - 1], "cache")
    await mkdir(cacheDir, { recursive: true })

    const h = createHash("sha256")
    h.update(pngBytes)
    h.update("|")
    h.update("craft")
    h.update("|")
    h.update(RUBRIC_VERSION)
    const hash = h.digest("hex")

    const canned = {
      score: 4,
      evidence: ["cached hit"],
      recommendations: ["none"],
    }
    await writeFile(
      join(cacheDir, `${hash}.json`),
      JSON.stringify(canned),
      "utf8",
    )

    const r = await scoreWithVision(cell, "craft", {
      dryRun: false,
      cacheDir,
      // no ANTHROPIC_API_KEY needed — cache hits before the check.
    })
    expect(r.score).toBe(4)
    expect(r.evidence).toEqual(["cached hit"])
  })
})

describe("scoreWithVision budget guard", () => {
  it("throws when budget too small for even one call", async () => {
    const cell = await mkCell()
    const cacheDir = join(tmpDirs[tmpDirs.length - 1], "cache-budget")
    await expect(
      scoreWithVision(cell, "craft", {
        dryRun: false,
        cacheDir,
        budgetUsd: 0.0001, // smaller than one call's projection
      }),
    ).rejects.toThrow(/budget exceeded/)
  })
})

describe("projectedCallCostUsd", () => {
  it("returns a positive number for the default model", () => {
    const c = projectedCallCostUsd("claude-opus-4-7")
    expect(c).toBeGreaterThan(0)
    // Sanity: single call should be well under a dollar.
    expect(c).toBeLessThan(1)
  })
})
