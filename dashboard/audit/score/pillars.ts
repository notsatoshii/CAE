/**
 * audit/score/pillars.ts — Phase 15 Cap.4.
 *
 * Heuristic pillar scorer. Pure functions over a `CaptureCell`
 * (file paths → JSON artifacts). No network, no LLM, no fs writes.
 *
 * Cap.5 layers an LLM-vision scorer on top for `craft` (aesthetics
 * need eyeballs). This module returns a placeholder for craft so the
 * aggregator shape stays uniform.
 *
 * Pillars:
 *   truth       → fixture.readExpectedTruth() vs actual truth.json
 *   depth       → rendered key count vs per-route expected field count
 *   liveness    → loading/empty/error/stale/healthy keys present
 *   voice       → banned-phrase regex sweep on truth values
 *   craft       → placeholder 3; Cap.5 fills via llm-vision
 *   reliability → console.json error/warning counts
 *   ia          → clickwalk reachability (placeholder 3 until wired)
 */

import { readFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join, dirname, basename } from "node:path"
import {
  PILLARS,
  RUBRIC,
  VOICE_BANNED,
  type PillarId,
} from "./rubric"
import type { AccessExpectation } from "../fixtures/persona-access"

export type { PillarId } from "./rubric"

export interface ScoreResult {
  score: 1 | 2 | 3 | 4 | 5
  evidence: string[]
  recommendations: string[]
  /**
   * True when this cell should be excluded from rollup aggregates —
   * e.g. the depth pillar on a persona-gated route where the capture
   * legitimately landed on /signin or /403. The `score` field still
   * carries a 1-5 value for backwards-compat with consumers that
   * haven't been upgraded to check `na`; new consumers should treat
   * `na: true` as "no data point" and drop the cell from means, mins,
   * distributions, and delta comparisons.
   */
  na?: true
}

export interface CaptureCell {
  fixture: string
  persona: string
  route: string
  slug: string
  viewport: string
  pngPath: string
  truthPath: string
  consolePath: string
  /**
   * The loaded fixture module (or any object with a
   * `readExpectedTruth(): Record<string,string>`). Scorer calls into it
   * for the truth-diff. Intentionally typed `unknown` so the caller can
   * pass either a dynamic import or a stub.
   */
  expectedFixture: unknown
  /**
   * Optional expected-access hint from audit/fixtures/persona-access.ts.
   * When present and equal to "gate" or "redirect", the depth scorer
   * treats empty-truth captures as N/A instead of punishing them with
   * a score of 1. Undefined falls back to the conservative legacy
   * behaviour (score 1 on missing keys). Populated by score-run.ts
   * after walking shots.
   */
  expectedAccess?: AccessExpectation
}

// ── Per-route expected field counts ────────────────────────────────────
// Rough counts of top-level fields the aggregator exposes per route —
// drives the "depth" pillar. Values are hand-estimated from the
// aggregator shape; anything missing from ROUTE_DEPTH falls back to 5.
// Revisit after the `data-truth` annotation wave lands.
export const ROUTE_DEPTH: Record<string, number> = {
  root: 3,
  signin: 2,
  "403": 2,
  plan: 8,
  build: 12,
  chat: 6,
  floor: 10,
  "floor-popout": 10,
  memory: 7,
  metrics: 10,
  "build-queue": 6,
  "build-changes": 6,
  "build-agents": 8,
  "build-workflows": 8,
  "build-workflows-new": 4,
  "build-schedule": 6,
  "build-schedule-new": 4,
  "build-skills": 6,
  "build-skills-installed": 6,
  "build-security": 8,
  "build-security-secrets": 5,
  "build-security-skills": 5,
  "build-security-audit": 8,
  "build-admin-roles": 7,
}

// ── Shared IO helpers ──────────────────────────────────────────────────
interface TruthRow {
  key: string | null
  value: string | null
  tag?: string
}

async function readTruthRows(path: string): Promise<TruthRow[]> {
  try {
    const raw = await readFile(path, "utf8")
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((r): r is TruthRow => r && typeof r === "object")
  } catch {
    return []
  }
}

interface ConsoleSidecar {
  console?: Array<{ type: string; text: string }>
  page_errors?: Array<{ name: string; message: string }>
}

async function readConsole(path: string): Promise<ConsoleSidecar> {
  try {
    const raw = await readFile(path, "utf8")
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object") return parsed as ConsoleSidecar
    return {}
  } catch {
    return {}
  }
}

function getExpectedTruth(
  fixtureModule: unknown,
): Record<string, string> | null {
  if (!fixtureModule || typeof fixtureModule !== "object") return null
  const fn = (fixtureModule as { readExpectedTruth?: unknown }).readExpectedTruth
  if (typeof fn !== "function") return null
  const result = (fn as () => unknown)()
  if (!result || typeof result !== "object") return null
  const entries = Object.entries(result as Record<string, unknown>)
  const out: Record<string, string> = {}
  for (const [k, v] of entries) {
    out[k] = typeof v === "string" ? v : String(v)
  }
  return out
}

// ── Pillar: truth ──────────────────────────────────────────────────────
async function scoreTruth(cell: CaptureCell): Promise<ScoreResult> {
  const expected = getExpectedTruth(cell.expectedFixture)
  const rows = await readTruthRows(cell.truthPath)

  if (!expected || Object.keys(expected).length === 0) {
    return {
      score: 3,
      evidence: ["fixture missing readExpectedTruth(); skipping diff"],
      recommendations: [
        "add readExpectedTruth() to the fixture so truth can be verified",
      ],
    }
  }

  const actual = new Map<string, string>()
  for (const r of rows) {
    if (r.key && typeof r.key === "string") {
      actual.set(r.key, r.value ?? "")
    }
  }

  const keys = Object.keys(expected)
  let drifted = 0
  const badKeys: string[] = []
  for (const k of keys) {
    const got = actual.get(k)
    if (got === undefined || got !== expected[k]) {
      drifted++
      if (badKeys.length < 5) badKeys.push(k)
    }
  }
  const rate = drifted / keys.length

  let score: 1 | 2 | 3 | 4 | 5
  if (rate === 0) score = 5
  else if (rate < 0.05) score = 4
  else if (rate < 0.15) score = 3
  else if (rate < 0.3) score = 2
  else score = 1

  return {
    score,
    evidence: [
      `${keys.length - drifted}/${keys.length} truth keys matched`,
      RUBRIC.truth[score],
      ...(badKeys.length ? [`drifted: ${badKeys.join(", ")}`] : []),
    ],
    recommendations:
      drifted === 0
        ? []
        : [`align rendered values for: ${badKeys.join(", ")}`],
  }
}

// ── Pillar: depth ──────────────────────────────────────────────────────
async function scoreDepth(cell: CaptureCell): Promise<ScoreResult> {
  const rows = await readTruthRows(cell.truthPath)
  const keyCount = new Set(
    rows.map((r) => r.key).filter((k): k is string => !!k),
  ).size
  const expected = ROUTE_DEPTH[cell.slug] ?? 5
  const ratio = keyCount / expected

  // Class 4B: persona-gated captures legitimately land on /signin or /403,
  // producing zero data-truth keys for the *requested* route. Scoring that
  // as 1 punishes the app for correct gating. Only honour the N/A path
  // when the capture is actually empty — if a gated persona still managed
  // to render keys (shouldn't happen in practice), keep normal scoring
  // so we surface the anomaly.
  if (
    keyCount === 0 &&
    (cell.expectedAccess === "gate" || cell.expectedAccess === "redirect")
  ) {
    return {
      score: 1,
      na: true,
      evidence: [
        `persona access=${cell.expectedAccess}; capture landed on gate/signin (0 keys expected)`,
        "excluded from depth rollup (N/A)",
      ],
      recommendations: [],
    }
  }

  let score: 1 | 2 | 3 | 4 | 5
  if (ratio >= 0.8) score = 5
  else if (ratio >= 0.6) score = 4
  else if (ratio >= 0.4) score = 3
  else if (ratio >= 0.2) score = 2
  else score = 1

  return {
    score,
    evidence: [
      `${keyCount}/${expected} data-truth keys rendered`,
      RUBRIC.depth[score],
    ],
    recommendations:
      score >= 4
        ? []
        : [
            `annotate more fields with data-truth on ${cell.slug}`,
          ],
  }
}

// ── Pillar: liveness ───────────────────────────────────────────────────
const LIVENESS_MARKERS = ["loading", "empty", "error", "stale", "healthy"]

async function scoreLiveness(cell: CaptureCell): Promise<ScoreResult> {
  const rows = await readTruthRows(cell.truthPath)
  const keys = rows.map((r) => r.key?.toLowerCase() ?? "")
  const hit = new Set<string>()
  for (const marker of LIVENESS_MARKERS) {
    if (keys.some((k) => k.includes(marker))) hit.add(marker)
  }
  const n = hit.size as 0 | 1 | 2 | 3 | 4 | 5
  const score = (n === 0 ? 1 : n) as 1 | 2 | 3 | 4 | 5
  const missing = LIVENESS_MARKERS.filter((m) => !hit.has(m))
  return {
    score,
    evidence: [
      `${n}/5 liveness markers: ${[...hit].join(",") || "(none)"}`,
      RUBRIC.liveness[score],
    ],
    recommendations: missing.length
      ? [`surface these states: ${missing.join(", ")}`]
      : [],
  }
}

// ── Pillar: voice ──────────────────────────────────────────────────────
async function scoreVoice(cell: CaptureCell): Promise<ScoreResult> {
  const rows = await readTruthRows(cell.truthPath)
  const hits: string[] = []
  for (const r of rows) {
    const v = r.value ?? ""
    for (const re of VOICE_BANNED) {
      if (re.test(v)) {
        hits.push(`"${v}" @ ${r.key ?? "?"}`)
        break
      }
    }
  }
  const start = 5
  const score = Math.max(1, start - hits.length) as 1 | 2 | 3 | 4 | 5
  return {
    score,
    evidence: [
      `${hits.length} banned-phrase hits`,
      RUBRIC.voice[score],
      ...hits.slice(0, 5),
    ],
    recommendations:
      hits.length === 0
        ? []
        : ["rewrite banned phrases per WAVE-6-VOICE-PLAN principles"],
  }
}

// ── Pillar: craft (placeholder; Cap.5 fills) ───────────────────────────
function scoreCraftPlaceholder(): ScoreResult {
  return {
    score: 3,
    evidence: ["requires Cap.5 llm-vision"],
    recommendations: [],
  }
}

// ── Pillar: reliability ────────────────────────────────────────────────
async function scoreReliability(cell: CaptureCell): Promise<ScoreResult> {
  const sidecar = await readConsole(cell.consolePath)
  const consoleEntries = sidecar.console ?? []
  const pageErrors = sidecar.page_errors ?? []
  const errors =
    pageErrors.length +
    consoleEntries.filter((e) => e.type === "error").length
  const warnings = consoleEntries.filter((e) => e.type === "warning").length
  // caveman: warnings count half → round up
  const effective = errors + Math.ceil(warnings / 2)

  let score: 1 | 2 | 3 | 4 | 5
  if (effective === 0) score = 5
  else if (effective === 1) score = 4
  else if (effective <= 3) score = 3
  else if (effective <= 6) score = 2
  else score = 1

  return {
    score,
    evidence: [
      `errors=${errors} warnings=${warnings}`,
      RUBRIC.reliability[score],
    ],
    recommendations:
      errors + warnings === 0
        ? []
        : ["resolve console errors + warnings surfaced in .console.json"],
  }
}

// ── Pillar: IA (placeholder; Cap.6 clickwalk will fill) ────────────────
async function scoreIA(cell: CaptureCell): Promise<ScoreResult> {
  // Optional: if Cap.6 has already written a <slug>--ia.json sidecar,
  // use its `reachable` bool. Otherwise placeholder 3.
  const iaPath = join(
    dirname(cell.truthPath),
    basename(cell.truthPath).replace(/\.truth\.json$/, "--ia.json"),
  )
  if (existsSync(iaPath)) {
    try {
      const raw = await readFile(iaPath, "utf8")
      const parsed = JSON.parse(raw) as { reachable?: boolean }
      const reachable = parsed.reachable === true
      const score: 1 | 2 | 3 | 4 | 5 = reachable ? 5 : 2
      return {
        score,
        evidence: [
          reachable ? "route reachable via sidebar/breadcrumb" : "orphan route",
          RUBRIC.ia[score],
        ],
        recommendations: reachable
          ? []
          : ["link this route from the sidebar or a parent page"],
      }
    } catch {
      // fallthrough
    }
  }
  return {
    score: 3,
    evidence: ["Cap.6 clickwalk not yet run; reachability unknown"],
    recommendations: ["run clickwalk to populate <slug>--ia.json"],
  }
}

// ── Dispatch ───────────────────────────────────────────────────────────
export async function scorePillar(
  pillar: PillarId,
  cell: CaptureCell,
): Promise<ScoreResult> {
  switch (pillar) {
    case "truth":
      return scoreTruth(cell)
    case "depth":
      return scoreDepth(cell)
    case "liveness":
      return scoreLiveness(cell)
    case "voice":
      return scoreVoice(cell)
    case "craft":
      return scoreCraftPlaceholder()
    case "reliability":
      return scoreReliability(cell)
    case "ia":
      return scoreIA(cell)
  }
}

export async function scoreCell(
  cell: CaptureCell,
): Promise<Record<PillarId, ScoreResult>> {
  const out = {} as Record<PillarId, ScoreResult>
  for (const p of PILLARS) {
    out[p] = await scorePillar(p, cell)
  }
  return out
}
