// @vitest-environment node
/**
 * audit/score/llm-voice.test.ts — Class 11.
 *
 * Tests the pure-function surface of the voice scorer: extractor, banned-
 * phrase counter, prompt builder, response parser, cache / dry-run path,
 * and banned-hit auto-downgrade. Does NOT shell out to the `claude` CLI
 * — those tests would need a real OAuth session and aren't unit tests.
 */
import { afterAll, describe, expect, it } from "vitest"
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  extractPhrasesFromTruth,
  countBannedPhrases,
  buildVoicePrompt,
  parseVoiceResponse,
  scoreVoiceWithLLM,
} from "./llm-voice"
import type { CaptureCell } from "./pillars"

const tmpDirs: string[] = []

afterAll(async () => {
  for (const d of tmpDirs) await rm(d, { recursive: true, force: true })
})

async function mkCell(rows: unknown): Promise<CaptureCell> {
  const dir = await mkdtemp(join(tmpdir(), "audit-voice-"))
  tmpDirs.push(dir)
  const truthPath = join(dir, "x.truth.json")
  await writeFile(truthPath, JSON.stringify(rows), "utf8")
  return {
    fixture: "test",
    persona: "p",
    route: "/x",
    slug: "x",
    viewport: "laptop",
    pngPath: join(dir, "x.png"),
    truthPath,
    consolePath: join(dir, "x.console.json"),
    expectedFixture: null,
  }
}

// ── extractPhrasesFromTruth ────────────────────────────────────────────

describe("extractPhrasesFromTruth", () => {
  it("keeps prose values", () => {
    const out = extractPhrasesFromTruth([
      { key: "build.status", value: "Shipped 3 phases in 2h" },
      { key: "nav.label", value: "Overview" },
    ])
    expect(out).toEqual([
      { key: "build.status", value: "Shipped 3 phases in 2h" },
      { key: "nav.label", value: "Overview" },
    ])
  })

  it("drops numeric-only and boolean values", () => {
    const out = extractPhrasesFromTruth([
      { key: "mission-control.active-count", value: "5" },
      { key: "mission-control.healthy", value: "yes" },
      { key: "mission-control.empty", value: "false" },
      { key: "mission-control.budget-pct", value: "1%" },
      { key: "mission-control.ts", value: "1776956961000" },
      { key: "build.status", value: "Shipped 3 phases" },
    ])
    expect(out).toEqual([
      { key: "build.status", value: "Shipped 3 phases" },
    ])
  })

  it("dedupes identical key/value pairs", () => {
    const out = extractPhrasesFromTruth([
      { key: "rollup.label", value: "Shipped" },
      { key: "rollup.label", value: "Shipped" },
      { key: "rollup.label", value: "Shipped" },
    ])
    expect(out).toEqual([{ key: "rollup.label", value: "Shipped" }])
  })

  it("handles malformed input gracefully", () => {
    expect(extractPhrasesFromTruth(null)).toEqual([])
    expect(extractPhrasesFromTruth("not-an-array")).toEqual([])
    expect(
      extractPhrasesFromTruth([
        null,
        "string",
        { key: null, value: "x" },
        { key: "k", value: null },
        { key: "k", value: "" },
      ]),
    ).toEqual([])
  })

  it("trims whitespace and skips single-char values", () => {
    const out = extractPhrasesFromTruth([
      { key: "a", value: " Shipped " },
      { key: "b", value: "a" },
    ])
    expect(out).toEqual([{ key: "a", value: "Shipped" }])
  })
})

// ── countBannedPhrases ─────────────────────────────────────────────────

describe("countBannedPhrases", () => {
  it("flags exact-match banned phrases", () => {
    const hits = countBannedPhrases([
      { key: "a", value: "Loading..." },
      { key: "b", value: "Error" },
      { key: "c", value: "Shipped 3 phases" },
      { key: "d", value: "No data" },
    ])
    expect(hits).toBe(3)
  })

  it("is 0 when nothing matches", () => {
    const hits = countBannedPhrases([
      { key: "a", value: "Shipped 3 phases in 2h" },
    ])
    expect(hits).toBe(0)
  })

  it("only counts once per phrase even if multiple banned regexes hit", () => {
    const hits = countBannedPhrases([{ key: "a", value: "failed" }])
    expect(hits).toBe(1)
  })
})

// ── buildVoicePrompt ───────────────────────────────────────────────────

describe("buildVoicePrompt", () => {
  it("includes all 5 rubric anchors", () => {
    const prompt = buildVoicePrompt(
      [{ key: "a", value: "Shipped 3 phases" }],
      { maxChars: 4000 },
    )
    expect(prompt).toMatch(/5 — Reads like Resend\/Stripe/)
    expect(prompt).toMatch(/4 — Mostly human, some boilerplate/)
    expect(prompt).toMatch(/3 — Mixed boilerplate/)
    expect(prompt).toMatch(/2 — Generic/)
    expect(prompt).toMatch(/1 — Lorem-ipsum tier/)
  })

  it("includes founder-speak principles", () => {
    const prompt = buildVoicePrompt([], { maxChars: 4000 })
    expect(prompt).toMatch(/Direct/)
    expect(prompt).toMatch(/High-signal/)
    expect(prompt).toMatch(/Short/)
    expect(prompt).toMatch(/Concrete/)
    expect(prompt).toMatch(/Honest/)
  })

  it("lists auto-downgrade triggers", () => {
    const prompt = buildVoicePrompt([], { maxChars: 4000 })
    expect(prompt).toMatch(/Leveraging/)
    expect(prompt).toMatch(/synergy/)
    expect(prompt).toMatch(/mission-critical/)
  })

  it("demands JSON-only output", () => {
    const prompt = buildVoicePrompt([], { maxChars: 4000 })
    expect(prompt).toMatch(/Return ONLY JSON/)
    expect(prompt).toMatch(/"score":/)
    expect(prompt).toMatch(/"evidence":/)
    expect(prompt).toMatch(/"recommendations":/)
  })

  it("inlines extracted phrases into the body", () => {
    const prompt = buildVoicePrompt(
      [
        { key: "hero.title", value: "Leveraging synergy for excellence" },
        { key: "cta.label", value: "Get started" },
      ],
      { maxChars: 4000 },
    )
    expect(prompt).toMatch(/\[hero.title\] Leveraging synergy for excellence/)
    expect(prompt).toMatch(/\[cta.label\] Get started/)
  })

  it("truncates when exceeding maxChars", () => {
    const phrases = Array.from({ length: 50 }, (_, i) => ({
      key: `k.${i}`,
      value: `phrase-${i}-`.repeat(20),
    }))
    const prompt = buildVoicePrompt(phrases, { maxChars: 500 })
    // Loose bound: rubric/header add ~1.5KB. Body section should fit the
    // budget even if header blows past it.
    expect(prompt).toBeTruthy()
    // At least one phrase should have been dropped.
    const included = phrases.filter((p) => prompt.includes(p.value)).length
    expect(included).toBeLessThan(phrases.length)
  })

  it("shows a clear empty-state note when phrases are empty", () => {
    const prompt = buildVoicePrompt([], { maxChars: 4000 })
    expect(prompt).toMatch(/no prose phrases extracted/)
  })
})

// ── parseVoiceResponse ─────────────────────────────────────────────────

describe("parseVoiceResponse", () => {
  it("parses a well-formed JSON response", () => {
    const r = parseVoiceResponse(
      JSON.stringify({
        score: 4,
        evidence: ["tight copy"],
        recommendations: ["keep it up"],
      }),
    )
    expect(r.score).toBe(4)
    expect(r.evidence).toEqual(["tight copy"])
    expect(r.recommendations).toEqual(["keep it up"])
  })

  it("strips ```json fences", () => {
    const r = parseVoiceResponse(
      '```json\n{"score":2,"evidence":["fluff"],"recommendations":["trim"]}\n```',
    )
    expect(r.score).toBe(2)
    expect(r.evidence).toEqual(["fluff"])
  })

  it("clamps out-of-range scores to 3", () => {
    const r = parseVoiceResponse(
      JSON.stringify({ score: 9, evidence: [], recommendations: [] }),
    )
    expect(r.score).toBe(3)
  })

  it("rounds fractional scores", () => {
    const r = parseVoiceResponse(
      JSON.stringify({ score: 3.7, evidence: [], recommendations: [] }),
    )
    expect(r.score).toBe(4)
  })

  it("drops non-string evidence/recommendations entries", () => {
    const r = parseVoiceResponse(
      JSON.stringify({
        score: 3,
        evidence: ["a", 42, null, "b"],
        recommendations: [],
      }),
    )
    expect(r.evidence).toEqual(["a", "b"])
  })
})

// ── scoreVoiceWithLLM: dry-run + downgrade ─────────────────────────────

describe("scoreVoiceWithLLM", () => {
  it("returns placeholder on dryRun without any CLI shellout", async () => {
    const cell = await mkCell([
      { key: "a", value: "Shipped 3 phases" },
    ])
    const r = await scoreVoiceWithLLM(cell, { dryRun: true })
    expect(r.score).toBe(3)
    expect(r.evidence).toContain("dry-run")
  })

  it("honors AUDIT_VOICE_DRY_RUN env default", async () => {
    const prev = process.env.AUDIT_VOICE_DRY_RUN
    process.env.AUDIT_VOICE_DRY_RUN = "1"
    try {
      const cell = await mkCell([{ key: "a", value: "Shipped" }])
      const r = await scoreVoiceWithLLM(cell)
      expect(r.score).toBe(3)
    } finally {
      process.env.AUDIT_VOICE_DRY_RUN = prev
    }
  })

  it("surfaces banned-phrase hit count in dry-run evidence", async () => {
    const cell = await mkCell([
      { key: "a", value: "Loading..." },
      { key: "b", value: "Error" },
    ])
    const r = await scoreVoiceWithLLM(cell, { dryRun: true })
    expect(r.evidence.join(" ")).toMatch(/banned-hits=2/)
  })

  it("reads cache when present (no CLI shellout needed)", async () => {
    const cell = await mkCell([
      { key: "a", value: "Shipped 3 phases in 2h" },
    ])
    const cacheDir = await mkdtemp(join(tmpdir(), "audit-voice-cache-"))
    tmpDirs.push(cacheDir)

    // Re-build the same prompt the module will produce, then hash it.
    const rows = [{ key: "a", value: "Shipped 3 phases in 2h" }]
    const phrases = extractPhrasesFromTruth(rows)
    const prompt = buildVoicePrompt(phrases, { maxChars: 4000 })
    const { createHash } = await import("node:crypto")
    const { RUBRIC_VERSION } = await import("./rubric")
    const h = createHash("sha256")
    h.update(prompt)
    h.update("|")
    h.update("voice")
    h.update("|")
    h.update(RUBRIC_VERSION)
    const hash = h.digest("hex")

    await mkdir(cacheDir, { recursive: true })
    const canned = {
      score: 5,
      evidence: ["founder-speak"],
      recommendations: ["keep it"],
    }
    await writeFile(
      join(cacheDir, `${hash}.json`),
      JSON.stringify(canned),
      "utf8",
    )

    const r = await scoreVoiceWithLLM(cell, { dryRun: false, cacheDir })
    expect(r.score).toBe(5)
    expect(r.evidence).toContain("founder-speak")
  })

  it("auto-downgrades by banned-phrase hit count on cache hit", async () => {
    const cell = await mkCell([
      { key: "a", value: "Loading..." },
      { key: "b", value: "Error" },
      { key: "c", value: "No data" },
    ])
    const cacheDir = await mkdtemp(join(tmpdir(), "audit-voice-cache-"))
    tmpDirs.push(cacheDir)

    const rows = [
      { key: "a", value: "Loading..." },
      { key: "b", value: "Error" },
      { key: "c", value: "No data" },
    ]
    const phrases = extractPhrasesFromTruth(rows)
    const prompt = buildVoicePrompt(phrases, { maxChars: 4000 })
    const { createHash } = await import("node:crypto")
    const { RUBRIC_VERSION } = await import("./rubric")
    const h = createHash("sha256")
    h.update(prompt)
    h.update("|")
    h.update("voice")
    h.update("|")
    h.update(RUBRIC_VERSION)
    const hash = h.digest("hex")

    const canned = { score: 4, evidence: ["base"], recommendations: [] }
    await writeFile(
      join(cacheDir, `${hash}.json`),
      JSON.stringify(canned),
      "utf8",
    )

    const r = await scoreVoiceWithLLM(cell, { dryRun: false, cacheDir })
    // base 4 − 3 banned hits = 1 (floor 1)
    expect(r.score).toBe(1)
    expect(r.evidence.join(" ")).toMatch(/auto-downgrade/)
  })

  it("does not downgrade when no banned phrases present", async () => {
    const cell = await mkCell([
      { key: "a", value: "Shipped 3 phases in 2h" },
    ])
    const cacheDir = await mkdtemp(join(tmpdir(), "audit-voice-cache-"))
    tmpDirs.push(cacheDir)

    const rows = [{ key: "a", value: "Shipped 3 phases in 2h" }]
    const phrases = extractPhrasesFromTruth(rows)
    const prompt = buildVoicePrompt(phrases, { maxChars: 4000 })
    const { createHash } = await import("node:crypto")
    const { RUBRIC_VERSION } = await import("./rubric")
    const h = createHash("sha256")
    h.update(prompt)
    h.update("|")
    h.update("voice")
    h.update("|")
    h.update(RUBRIC_VERSION)
    const hash = h.digest("hex")

    const canned = { score: 5, evidence: ["clean"], recommendations: [] }
    await writeFile(
      join(cacheDir, `${hash}.json`),
      JSON.stringify(canned),
      "utf8",
    )

    const r = await scoreVoiceWithLLM(cell, { dryRun: false, cacheDir })
    expect(r.score).toBe(5)
    expect(r.evidence).toEqual(["clean"])
  })
})
