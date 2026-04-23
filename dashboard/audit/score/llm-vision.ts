/**
 * audit/score/llm-vision.ts — Phase 15 Cap.5.
 *
 * Vision scorer for pillars where pure heuristics can't see (mainly
 * `craft`). Calls Anthropic Messages API with the route PNG as an
 * image block + the rubric anchors for the target pillar. Returns the
 * same `ScoreResult` shape as pillars.ts so the aggregator can plug
 * one in for the other.
 *
 * Design rules:
 *   - No new npm deps — raw fetch() against /v1/messages.
 *   - dryRun default = process.env.AUDIT_VISION_DRY_RUN === "1". Tests
 *     run in dry-run so CI stays free and offline.
 *   - Cache results by hash(PNG bytes | pillar | RUBRIC_VERSION) to a
 *     local dir. `.gitignore` covers `score/.cache/`.
 *   - Budget guard: projected USD cost checked before every call; abort
 *     with a clear error if the running total would exceed
 *     AUDIT_VISION_BUDGET_USD (default 5.0).
 *
 * Pricing placeholders below are ROUGH; verify against the current
 * Anthropic pricing page before running at scale. The budget math is
 * conservative: each call assumes full output at the `max_tokens` cap
 * so we won't over-spend between checks.
 */

import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile, access } from "node:fs/promises"
import { dirname, join } from "node:path"
import { RUBRIC, RUBRIC_VERSION, type PillarId } from "./rubric"
import type { ScoreResult, CaptureCell } from "./pillars"

// ── Pricing (placeholder — verify before production use) ───────────────
// USD per 1M input / output tokens. Numbers are rough starting points
// for the budget math; real costs may differ.
const PRICING: Record<string, { inputPer1MUsd: number; outputPer1MUsd: number }> = {
  "claude-opus-4-7": { inputPer1MUsd: 15, outputPer1MUsd: 75 },
  // Fallback — Anthropic lists Sonnet 4 around these numbers.
  "claude-sonnet-4-5": { inputPer1MUsd: 3, outputPer1MUsd: 15 },
}

// Running per-process USD total. Not persisted — each invocation starts
// clean. A multi-run budget should read the cache dir's size instead.
let cumulativeUsd = 0

// Each image block costs ~1200-1600 tokens depending on dims; use a
// conservative upper bound. PNGs here are full-page captures which may
// be large, so bump slightly.
const IMAGE_INPUT_TOKENS_ESTIMATE = 2_000
const MAX_OUTPUT_TOKENS = 512 // generous for {score, evidence[], recs[]}
const SYSTEM_PROMPT_TOKENS_ESTIMATE = 300

export interface VisionOpts {
  model?: string
  dryRun?: boolean
  /** Override the budget limit (USD). Default: AUDIT_VISION_BUDGET_USD or 5. */
  budgetUsd?: number
  /** Override cache dir for tests. */
  cacheDir?: string
  /** Abort signal for the fetch call. */
  signal?: AbortSignal
}

function resolveModel(opts?: VisionOpts): string {
  return opts?.model ?? process.env.AUDIT_VISION_MODEL ?? "claude-opus-4-7"
}

function resolveDryRun(opts?: VisionOpts): boolean {
  if (typeof opts?.dryRun === "boolean") return opts.dryRun
  return process.env.AUDIT_VISION_DRY_RUN === "1"
}

function resolveBudget(opts?: VisionOpts): number {
  if (typeof opts?.budgetUsd === "number") return opts.budgetUsd
  const fromEnv = Number.parseFloat(process.env.AUDIT_VISION_BUDGET_USD ?? "5")
  return Number.isFinite(fromEnv) ? fromEnv : 5
}

function resolveCacheDir(opts?: VisionOpts): string {
  return opts?.cacheDir ?? join(__dirname, ".cache")
}

// ── Cost math ──────────────────────────────────────────────────────────
export function projectedCallCostUsd(model: string): number {
  const p = PRICING[model] ?? PRICING["claude-opus-4-7"]
  const inputTokens = IMAGE_INPUT_TOKENS_ESTIMATE + SYSTEM_PROMPT_TOKENS_ESTIMATE
  const outputTokens = MAX_OUTPUT_TOKENS
  const inputUsd = (inputTokens / 1_000_000) * p.inputPer1MUsd
  const outputUsd = (outputTokens / 1_000_000) * p.outputPer1MUsd
  return inputUsd + outputUsd
}

// Exposed so tests can reset the running total.
export function _resetCumulativeUsd(): void {
  cumulativeUsd = 0
}
export function _getCumulativeUsd(): number {
  return cumulativeUsd
}

// ── Cache helpers ──────────────────────────────────────────────────────
async function hashInputs(
  pngBytes: Buffer,
  pillar: PillarId,
): Promise<string> {
  const h = createHash("sha256")
  h.update(pngBytes)
  h.update("|")
  h.update(pillar)
  h.update("|")
  h.update(RUBRIC_VERSION)
  return h.digest("hex")
}

async function readCache(
  cacheDir: string,
  hash: string,
): Promise<ScoreResult | null> {
  const path = join(cacheDir, `${hash}.json`)
  try {
    await access(path)
    const raw = await readFile(path, "utf8")
    const parsed = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.score === "number"
    ) {
      return parsed as ScoreResult
    }
    return null
  } catch {
    return null
  }
}

async function writeCache(
  cacheDir: string,
  hash: string,
  result: ScoreResult,
): Promise<void> {
  const path = join(cacheDir, `${hash}.json`)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(result, null, 2), "utf8")
}

// ── Prompt ─────────────────────────────────────────────────────────────
function buildPrompt(pillar: PillarId): string {
  const anchors = RUBRIC[pillar]
  const anchorLines = (
    [5, 4, 3, 2, 1] as Array<1 | 2 | 3 | 4 | 5>
  )
    .map((n) => `${n} — ${anchors[n]}`)
    .join("\n")
  return `You are scoring a dashboard route screenshot against the ${pillar} rubric.
Anchors for 1-5:
${anchorLines}

Return ONLY JSON matching:
{"score": 1|2|3|4|5, "evidence": string[], "recommendations": string[]}
No prose outside the JSON. Keep evidence and recommendations each ≤3 items.`
}

// ── Response parsing ───────────────────────────────────────────────────
interface AnthropicContent {
  type: string
  text?: string
}
interface AnthropicResponse {
  content?: AnthropicContent[]
}

function parseVisionResponse(text: string): ScoreResult {
  // Strip code fences if the model wrapped JSON.
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim()
  const parsed = JSON.parse(cleaned)
  const rawScore = Number(parsed?.score)
  const score = (
    rawScore >= 1 && rawScore <= 5 ? (Math.round(rawScore) as 1 | 2 | 3 | 4 | 5) : 3
  )
  const evidence = Array.isArray(parsed?.evidence)
    ? parsed.evidence.filter((x: unknown): x is string => typeof x === "string")
    : []
  const recommendations = Array.isArray(parsed?.recommendations)
    ? parsed.recommendations.filter((x: unknown): x is string => typeof x === "string")
    : []
  return { score, evidence, recommendations }
}

// ── Main export ────────────────────────────────────────────────────────
export async function scoreWithVision(
  cell: CaptureCell,
  pillar: PillarId,
  opts?: VisionOpts,
): Promise<ScoreResult> {
  const dryRun = resolveDryRun(opts)
  const model = resolveModel(opts)
  const cacheDir = resolveCacheDir(opts)

  // Dry-run short-circuit — no file IO, no API call.
  if (dryRun) {
    return {
      score: 3,
      evidence: ["dry-run"],
      recommendations: [],
    }
  }

  // Need the PNG bytes for both hashing + image block.
  const pngBytes = await readFile(cell.pngPath)
  const hash = await hashInputs(pngBytes, pillar)

  const cached = await readCache(cacheDir, hash)
  if (cached) return cached

  // Budget guard — run BEFORE the network call.
  const budgetUsd = resolveBudget(opts)
  const projected = projectedCallCostUsd(model)
  if (cumulativeUsd + projected > budgetUsd) {
    throw new Error(
      `audit/llm-vision: budget exceeded. cumulative=$${cumulativeUsd.toFixed(
        4,
      )} + projected=$${projected.toFixed(4)} > budget=$${budgetUsd.toFixed(2)}. ` +
        `Raise AUDIT_VISION_BUDGET_USD or use dryRun.`,
    )
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      "audit/llm-vision: ANTHROPIC_API_KEY not set. Either export the key " +
        "or run with AUDIT_VISION_DRY_RUN=1.",
    )
  }

  const prompt = buildPrompt(pillar)
  const body = {
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: pngBytes.toString("base64"),
            },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
    signal: opts?.signal,
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "<no body>")
    throw new Error(
      `audit/llm-vision: ${res.status} ${res.statusText}: ${errText.slice(0, 500)}`,
    )
  }

  const json = (await res.json()) as AnthropicResponse
  const text = (json.content ?? [])
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text as string)
    .join("\n")
  const result = parseVisionResponse(text)

  cumulativeUsd += projected
  await writeCache(cacheDir, hash, result)
  return result
}
