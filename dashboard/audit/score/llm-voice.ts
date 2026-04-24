/**
 * audit/score/llm-voice.ts — Class 11.
 *
 * LLM-backed voice pillar scorer. The existing regex banned-phrase sweep
 * in pillars.ts::scoreVoice catches hard fouls ("loading...", "no data")
 * but can't distinguish "Shipped 3 phases in 2h" (founder-speak) from
 * "Leveraged our synergistic pipeline to deliver stakeholder value"
 * (corporate fluff). Both pass the regex; only one reads like a real
 * founder wrote it.
 *
 * This module augments the regex scorer via an opt-in env flag
 * (AUDIT_VOICE=1 in score-run.ts). The heuristic scorer stays wired as
 * the default so normal cycles don't pay the LLM cost.
 *
 * Transport: same `claude -p` shellout used by llm-vision.ts. OAuth /
 * Max-plan path — no API key, no USD cost book-keeping. The dashboard
 * runs as root and the `claude` CLI refuses root, so shellout goes
 * through `sudo -u cae -E env HOME=/home/cae claude`.
 *
 * Inputs: data-label-* / data-truth key+value pairs from the cell's
 * `.truth.json`. No PNG OCR — prose extraction from images is a separate
 * pillar. Banned-phrase hits from the regex scorer (counted, not
 * re-checked) auto-downgrade the LLM score by 1 per hit, floor 1.
 *
 * Output: { score: 1|2|3|4|5, evidence[], recommendations[] } matching
 * ScoreResult in pillars.ts so score-run.ts can plug this in alongside
 * heuristic scores.
 */

import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile, access } from "node:fs/promises"
import { dirname, join } from "node:path"
import { RUBRIC, RUBRIC_VERSION, VOICE_BANNED } from "./rubric"
import type { ScoreResult, CaptureCell } from "./pillars"

// ── Options ────────────────────────────────────────────────────────────

export interface VoiceOpts {
  model?: string
  dryRun?: boolean
  cacheDir?: string
  signal?: AbortSignal
  /** Override the CLI binary for tests (default "claude"). */
  cliBin?: string
  /**
   * Override the sudo wrapper for tests. Default
   * ["sudo", "-u", "cae", "-E", "env", "HOME=/home/cae"]. Setting to []
   * runs the CLI binary directly — useful for unit tests that only
   * assert on prompt-building.
   */
  sudoWrap?: readonly string[]
  /** Max characters of prose input sent to the model. Default 4000. */
  maxPromptChars?: number
}

const DEFAULT_SUDO_WRAP: readonly string[] = [
  "sudo",
  "-u",
  "cae",
  "-E",
  "env",
  "HOME=/home/cae",
]

const MAX_OUTPUT_TOKENS = 512

function resolveModel(opts?: VoiceOpts): string {
  return opts?.model ?? process.env.AUDIT_VOICE_MODEL ?? "claude-opus-4-7"
}

function resolveDryRun(opts?: VoiceOpts): boolean {
  if (typeof opts?.dryRun === "boolean") return opts.dryRun
  return process.env.AUDIT_VOICE_DRY_RUN === "1"
}

function resolveCacheDir(opts?: VoiceOpts): string {
  return opts?.cacheDir ?? join(__dirname, ".cache-voice")
}

function resolveSudoWrap(opts?: VoiceOpts): readonly string[] {
  if (opts?.sudoWrap !== undefined) return opts.sudoWrap
  return DEFAULT_SUDO_WRAP
}

function resolveMaxPromptChars(opts?: VoiceOpts): number {
  if (typeof opts?.maxPromptChars === "number") return opts.maxPromptChars
  const fromEnv = Number.parseInt(
    process.env.AUDIT_VOICE_MAX_PROMPT_CHARS ?? "",
    10,
  )
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 4000
}

// ── Truth extraction ───────────────────────────────────────────────────

export interface ExtractedPhrase {
  key: string
  value: string
}

interface TruthRow {
  key?: unknown
  value?: unknown
  tag?: unknown
}

/**
 * Extract human-readable key/value pairs from a loaded `.truth.json`
 * array. Filters out:
 *   - numeric-only values ("0", "1%", "1776956961000")
 *   - boolean-ish values ("yes", "no", "true", "false")
 *   - single-character values
 *   - empty / null values
 * because those aren't prose and don't speak with a "voice".
 *
 * Exported so the unit test can exercise it without spinning the LLM.
 */
export function extractPhrasesFromTruth(rows: unknown): ExtractedPhrase[] {
  if (!Array.isArray(rows)) return []
  const out: ExtractedPhrase[] = []
  const seen = new Set<string>()
  for (const r of rows as TruthRow[]) {
    if (!r || typeof r !== "object") continue
    const key = typeof r.key === "string" ? r.key : null
    const value = typeof r.value === "string" ? r.value : null
    if (!key || !value) continue
    const trimmed = value.trim()
    if (trimmed.length < 2) continue
    if (/^-?\d+(\.\d+)?%?$/.test(trimmed)) continue // 0, 1%, 1776956961000
    if (/^(yes|no|true|false)$/i.test(trimmed)) continue
    // Dedupe exact (key,value) pairs — truth.json has repeats.
    const dedup = `${key}::${trimmed}`
    if (seen.has(dedup)) continue
    seen.add(dedup)
    out.push({ key, value: trimmed })
  }
  return out
}

async function readTruthRowsSafe(path: string): Promise<unknown> {
  try {
    const raw = await readFile(path, "utf8")
    return JSON.parse(raw)
  } catch {
    return []
  }
}

// ── Banned-phrase count ────────────────────────────────────────────────

export function countBannedPhrases(phrases: ExtractedPhrase[]): number {
  let hits = 0
  for (const p of phrases) {
    for (const re of VOICE_BANNED) {
      if (re.test(p.value)) {
        hits++
        break
      }
    }
  }
  return hits
}

// ── Prompt builder ─────────────────────────────────────────────────────

/**
 * Build the founder-speak rubric prompt. Exported so the unit test can
 * assert on structure without shelling out to the CLI.
 */
export function buildVoicePrompt(
  phrases: ExtractedPhrase[],
  opts: { maxChars: number },
): string {
  const anchors = RUBRIC.voice
  const anchorLines = (
    [5, 4, 3, 2, 1] as Array<1 | 2 | 3 | 4 | 5>
  )
    .map((n) => `${n} — ${anchors[n]}`)
    .join("\n")

  // Rank longer values first — those carry the most signal. Short
  // numeric-like strings already got filtered in extractPhrases.
  const ranked = [...phrases].sort((a, b) => b.value.length - a.value.length)
  const lines: string[] = []
  let used = 0
  for (const p of ranked) {
    const line = `- [${p.key}] ${p.value}`
    if (used + line.length + 1 > opts.maxChars) break
    lines.push(line)
    used += line.length + 1
  }
  const body = lines.length
    ? lines.join("\n")
    : "(no prose phrases extracted — truth.json was empty or all numeric)"

  return `You are scoring the *voice* of a dashboard surface — the text a
founder would read in the UI. Rubric anchors 1-5:
${anchorLines}

Founder-speak principles (5 = all present, 1 = none):
- Direct: states the fact, no hedging ("Shipped 3 phases" not "We are pleased to announce")
- High-signal: every word earns its place, no filler
- Short: tight sentences, no corporate run-ons
- Concrete: numbers, nouns, verbs — not adjectives like "robust", "seamless"
- Honest: surfaces problems ("2 phases stuck") not marketing gloss

Auto-downgrade triggers (check these first):
- "Leveraging", "synergy", "best-in-class", "world-class", "mission-critical"
- "Please try again", vague "Something went wrong"
- Lorem-ipsum / placeholder text

Here are the key/value pairs rendered on this surface:
${body}

Return ONLY JSON matching:
{"score": 1|2|3|4|5, "evidence": string[], "recommendations": string[]}
No prose outside the JSON. Each of evidence and recommendations ≤3 items.
Evidence should quote the worst or best phrase(s). Recommendations should
rewrite corporate-fluff phrases into founder-speak.`
}

// ── Response parsing ───────────────────────────────────────────────────

export function parseVoiceResponse(text: string): ScoreResult {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim()
  const parsed = JSON.parse(cleaned)
  const rawScore = Number(parsed?.score)
  const score: 1 | 2 | 3 | 4 | 5 =
    rawScore >= 1 && rawScore <= 5
      ? (Math.round(rawScore) as 1 | 2 | 3 | 4 | 5)
      : 3
  const evidence = Array.isArray(parsed?.evidence)
    ? parsed.evidence.filter((x: unknown): x is string => typeof x === "string")
    : []
  const recommendations = Array.isArray(parsed?.recommendations)
    ? parsed.recommendations.filter(
        (x: unknown): x is string => typeof x === "string",
      )
    : []
  return { score, evidence, recommendations }
}

// ── Cache helpers ──────────────────────────────────────────────────────

function hashInputs(promptText: string): string {
  const h = createHash("sha256")
  h.update(promptText)
  h.update("|")
  h.update("voice")
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
    if (parsed && typeof parsed === "object" && typeof parsed.score === "number") {
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

// ── CLI shellout ───────────────────────────────────────────────────────

function runCli(
  cmd: string,
  args: string[],
  signal?: AbortSignal,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] })
    const outChunks: Buffer[] = []
    const errChunks: Buffer[] = []
    child.stdout.on("data", (c: Buffer) => outChunks.push(c))
    child.stderr.on("data", (c: Buffer) => errChunks.push(c))
    const onAbort = () => child.kill("SIGTERM")
    signal?.addEventListener("abort", onAbort, { once: true })
    child.on("error", (err) => {
      signal?.removeEventListener("abort", onAbort)
      reject(err)
    })
    child.on("close", (code) => {
      signal?.removeEventListener("abort", onAbort)
      const stdout = Buffer.concat(outChunks).toString("utf8")
      const stderr = Buffer.concat(errChunks).toString("utf8")
      if (code !== 0) {
        reject(
          new Error(
            `${cmd} ${args[0]} exited ${code}: ${stderr.slice(0, 500)}`,
          ),
        )
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

interface CliShellOpts {
  prompt: string
  model: string
  bin: string
  sudoWrap: readonly string[]
  signal?: AbortSignal
}

async function callClaudeCli(opts: CliShellOpts): Promise<ScoreResult> {
  const claudeArgs = [
    "-p",
    "--model",
    opts.model,
    "--output-format",
    "json",
    opts.prompt,
  ]
  const [cmd, ...prefixArgs] =
    opts.sudoWrap.length > 0
      ? [opts.sudoWrap[0], ...opts.sudoWrap.slice(1), opts.bin, ...claudeArgs]
      : [opts.bin, ...claudeArgs]
  const args = opts.sudoWrap.length > 0 ? prefixArgs : claudeArgs
  const { stdout } = await runCli(cmd, args, opts.signal)

  let envelope: { result?: string; is_error?: boolean }
  try {
    envelope = JSON.parse(stdout)
  } catch (err) {
    throw new Error(
      `audit/llm-voice: claude CLI returned non-JSON stdout: ${stdout.slice(0, 300)}`,
      { cause: err },
    )
  }
  if (envelope.is_error) {
    throw new Error(
      `audit/llm-voice: claude CLI reported error: ${stdout.slice(0, 500)}`,
    )
  }
  const modelText = typeof envelope.result === "string" ? envelope.result : ""
  return parseVoiceResponse(modelText)
}

// ── Main export ────────────────────────────────────────────────────────

/**
 * Score the voice pillar for a capture cell via LLM.
 *
 * Flow:
 *   1. Read + dedupe truth.json key/value pairs → prose phrases.
 *   2. Build founder-speak rubric prompt.
 *   3. Hash prompt → cache lookup.
 *   4. On miss: shell out to `sudo -u cae ... claude -p` (OAuth / Max).
 *   5. Parse JSON response → ScoreResult.
 *   6. Auto-downgrade by banned-phrase hit count (min 1).
 *   7. Write cache.
 */
export async function scoreVoiceWithLLM(
  cell: CaptureCell,
  opts?: VoiceOpts,
): Promise<ScoreResult> {
  const dryRun = resolveDryRun(opts)
  const maxPromptChars = resolveMaxPromptChars(opts)

  const rows = await readTruthRowsSafe(cell.truthPath)
  const phrases = extractPhrasesFromTruth(rows)
  const bannedHits = countBannedPhrases(phrases)
  const prompt = buildVoicePrompt(phrases, { maxChars: maxPromptChars })

  if (dryRun) {
    return {
      score: 3,
      evidence: [
        "dry-run",
        `phrases=${phrases.length}`,
        `banned-hits=${bannedHits}`,
      ],
      recommendations: [],
    }
  }

  const cacheDir = resolveCacheDir(opts)
  const hash = hashInputs(prompt)
  const cached = await readCache(cacheDir, hash)
  if (cached) return applyBannedDowngrade(cached, bannedHits)

  const model = resolveModel(opts)
  const sudoWrap = resolveSudoWrap(opts)
  const result = await callClaudeCli({
    prompt,
    model,
    bin: opts?.cliBin ?? "claude",
    sudoWrap,
    signal: opts?.signal,
  })
  await writeCache(cacheDir, hash, result)
  return applyBannedDowngrade(result, bannedHits)
}

function applyBannedDowngrade(
  base: ScoreResult,
  hits: number,
): ScoreResult {
  if (hits <= 0) return base
  const adjusted = Math.max(1, base.score - hits) as 1 | 2 | 3 | 4 | 5
  return {
    score: adjusted,
    evidence: [
      ...base.evidence,
      `auto-downgrade: ${hits} banned-phrase hit(s) from regex sweep`,
    ],
    recommendations: base.recommendations,
  }
}
