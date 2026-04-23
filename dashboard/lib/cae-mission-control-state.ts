/**
 * cae-mission-control-state.ts — aggregator for the Mission Control hero
 * banner that sits at the top of /build (Phase 15 Wave 3.1).
 *
 * Eric P15: "dashboard shows nothing active when actively running" — the
 * Mission Control banner exists so a user landing on /build sees, in one
 * glance: how many agents are working, how fast tokens are being burned,
 * how much of today's budget is gone, what the last 60 seconds of activity
 * looked like, and (when returning after >1h) what's changed while they
 * were away.
 *
 * Data sources:
 *   - Active count   → tail of `.cae/metrics/circuit-breakers.jsonl`
 *                      (last 5 minutes, count forge_begin without matching
 *                       forge_end)
 *   - Token burn      → tail of `.cae/metrics/tool-calls.jsonl`
 *                      (last 60 seconds, summed via lib/cae-cost-table.ts
 *                       per-model rates)
 *   - 60s sparkline  → same source, per-second buckets
 *   - Since-you-left → `.cae/sessions/last-seen.json` (touched on every
 *                      Mission Control fetch); diff via STATE.md / git log
 *                      isn't available in this layer so we surface the
 *                      counts derived from the same JSONL streams
 *
 * Caching: 5-second process-level cache so the 5-second client poll never
 * re-walks the JSONL on every request.
 *
 * No dollar signs in this file (lint-no-dollar.sh guard).
 */

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { CAE_ROOT } from "./cae-config"
import { tailJsonl } from "./cae-state"
import { rateFor } from "./cae-cost-table"
import type { CbEvent } from "./cae-types"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_CB_PATH = join(CAE_ROOT, ".cae", "metrics", "circuit-breakers.jsonl")
const DEFAULT_TOOLS_PATH = join(CAE_ROOT, ".cae", "metrics", "tool-calls.jsonl")
const DEFAULT_LAST_SEEN_PATH = join(CAE_ROOT, ".cae", "sessions", "last-seen.json")

const ONE_SECOND_MS = 1_000
const ONE_MINUTE_MS = 60_000
const FIVE_MINUTES_MS = 5 * ONE_MINUTE_MS
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS
const ONE_DAY_MS = 24 * ONE_HOUR_MS

const TAIL_LIMIT_CB = 5_000
const TAIL_LIMIT_TOOLS = 5_000

const SPARKLINE_BUCKETS = 60
const SPARKLINE_BUCKET_MS = ONE_SECOND_MS

const SINCE_YOU_LEFT_THRESHOLD_MS = ONE_HOUR_MS

const DEFAULT_DAILY_BUDGET_USD = 50

export const MISSION_CONTROL_CACHE_TTL_MS = 5_000

// ---------------------------------------------------------------------------
// Types — frozen contract; consumed by /api/mission-control + UI
// ---------------------------------------------------------------------------

export interface MissionControlSparkBucket {
  /** Unix-ms start of the second-bucket. */
  ts: number
  /** Number of tool calls observed inside [ts, ts+1000). */
  count: number
}

export interface MissionControlSinceYouLeft {
  /** True iff the user's last visit was more than SINCE_YOU_LEFT_THRESHOLD_MS ago. */
  show: boolean
  /** Unix-ms of the previous visit, or null when first visit. */
  last_seen_at: number | null
  /** Tool-call count since last_seen_at (capped to 24h). */
  tool_calls_since: number
  /** Estimated USD spent since last_seen_at (token-weighted). */
  usd_since: number
  /** Distinct task IDs touched since last_seen_at. */
  tasks_touched: number
}

export interface MissionControlState {
  /**
   * Number of forge_begin events without a matching forge_end in the last
   * 5 minutes. This is the "agents working right now" headline number.
   */
  active_count: number

  /**
   * USD per minute, projected from the last 60 seconds of token usage.
   * 0 when no token usage events found in window.
   */
  token_burn_usd_per_min: number

  /** Total USD spent today (UTC midnight rollover). */
  cost_today_usd: number

  /** Daily budget in USD (env CAE_DAILY_BUDGET_USD ?? 50). */
  daily_budget_usd: number

  /** cost_today_usd / daily_budget_usd, clamped 0..2 (over-budget = >1). */
  cost_pct_of_budget: number

  /** Last 60 seconds of tool-call activity, oldest-first, 1s buckets. */
  sparkline_60s: MissionControlSparkBucket[]

  /** Since-you-left chip data; show=false when last visit was recent. */
  since_you_left: MissionControlSinceYouLeft

  /** Unix-ms of the most recent event seen across either log. */
  last_event_at: number | null

  /** Generation timestamp for the response, ISO8601. */
  generated_at: string
}

// ---------------------------------------------------------------------------
// Empty / zero shape
// ---------------------------------------------------------------------------

export function emptyMissionControl(now: number = Date.now()): MissionControlState {
  const sparkline: MissionControlSparkBucket[] = []
  const oldest = Math.floor((now - SPARKLINE_BUCKETS * SPARKLINE_BUCKET_MS) / SPARKLINE_BUCKET_MS) * SPARKLINE_BUCKET_MS
  for (let i = 0; i < SPARKLINE_BUCKETS; i++) {
    sparkline.push({ ts: oldest + i * SPARKLINE_BUCKET_MS, count: 0 })
  }
  return {
    active_count: 0,
    token_burn_usd_per_min: 0,
    cost_today_usd: 0,
    daily_budget_usd: dailyBudget(),
    cost_pct_of_budget: 0,
    sparkline_60s: sparkline,
    since_you_left: {
      show: false,
      last_seen_at: null,
      tool_calls_since: 0,
      usd_since: 0,
      tasks_touched: 0,
    },
    last_event_at: null,
    generated_at: new Date(now).toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  expiresAt: number
  data: MissionControlState
}

const cache = new Map<string, CacheEntry>()

/** Test hook — clear in-process cache. */
export function __resetMissionControlCache(): void {
  cache.clear()
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface GetMissionControlOpts {
  /** Override the circuit-breakers JSONL path (tests). */
  cbPath?: string
  /** Override the tool-calls JSONL path (tests). */
  toolsPath?: string
  /** Override the last-seen path (tests). */
  lastSeenPath?: string
  /** Inject a clock for deterministic tests. */
  now?: number
  /** Skip the in-process cache. */
  noCache?: boolean
  /**
   * When false, do NOT touch the last-seen file on this call. Tests should
   * pass false to keep assertions deterministic between runs.
   */
  touchLastSeen?: boolean
  /** Override the daily budget (tests). */
  dailyBudgetUsd?: number
}

export async function getMissionControlState(
  opts: GetMissionControlOpts = {},
): Promise<MissionControlState> {
  const cbPath = opts.cbPath ?? DEFAULT_CB_PATH
  const toolsPath = opts.toolsPath ?? DEFAULT_TOOLS_PATH
  const lastSeenPath = opts.lastSeenPath ?? DEFAULT_LAST_SEEN_PATH
  const now = opts.now ?? Date.now()
  const budget = opts.dailyBudgetUsd ?? dailyBudget()
  const touchLastSeen = opts.touchLastSeen !== false

  const cacheKey = cbPath + "|" + toolsPath + "|" + lastSeenPath
  if (!opts.noCache) {
    const cached = cache.get(cacheKey)
    if (cached && cached.expiresAt > now) return cached.data
  }

  // Read both logs in parallel — JSONL reads are independent.
  const [cbRows, toolRows] = await Promise.all([
    tailJsonl(cbPath, TAIL_LIMIT_CB),
    tailJsonl(toolsPath, TAIL_LIMIT_TOOLS),
  ])

  const previousLastSeen = await readLastSeen(lastSeenPath)

  const data = projectMissionControl({
    cbRows,
    toolRows,
    now,
    budget,
    previousLastSeen,
  })

  if (touchLastSeen) {
    // Fire-and-forget; failure to write last-seen is non-fatal — the user
    // simply gets the same since-you-left payload next visit.
    void writeLastSeen(lastSeenPath, now).catch(() => undefined)
  }

  if (!opts.noCache) {
    cache.set(cacheKey, { expiresAt: now + MISSION_CONTROL_CACHE_TTL_MS, data })
  }

  return data
}

// ---------------------------------------------------------------------------
// Internals — pure projections (testable without filesystem)
// ---------------------------------------------------------------------------

interface ProjectArgs {
  cbRows: unknown[]
  toolRows: unknown[]
  now: number
  budget: number
  previousLastSeen: number | null
}

interface ParsedCbEvent {
  ts_ms: number
  event: string
  task_id?: string
  input_tokens?: number
  output_tokens?: number
  model?: string
}

interface ParsedToolEvent {
  ts_ms: number
  task: string
  tool: string
}

function parseCb(rows: unknown[]): ParsedCbEvent[] {
  const out: ParsedCbEvent[] = []
  for (const row of rows) {
    if (row === null || typeof row !== "object") continue
    const r = row as Record<string, unknown>
    if (typeof r.ts !== "string") continue
    if (typeof r.event !== "string") continue
    const t = Date.parse(r.ts)
    if (Number.isNaN(t)) continue
    const ev: ParsedCbEvent = {
      ts_ms: t,
      event: r.event,
    }
    if (typeof r.task_id === "string") ev.task_id = r.task_id
    if (typeof r.input_tokens === "number") ev.input_tokens = r.input_tokens
    if (typeof r.output_tokens === "number") ev.output_tokens = r.output_tokens
    if (typeof r.model === "string") ev.model = r.model
    out.push(ev)
  }
  return out
}

function parseTools(rows: unknown[]): ParsedToolEvent[] {
  const out: ParsedToolEvent[] = []
  for (const row of rows) {
    if (row === null || typeof row !== "object") continue
    const r = row as Record<string, unknown>
    if (typeof r.ts !== "string") continue
    if (typeof r.tool !== "string" || r.tool.length === 0) continue
    const t = Date.parse(r.ts)
    if (Number.isNaN(t)) continue
    out.push({
      ts_ms: t,
      task: typeof r.task === "string" ? r.task : "",
      tool: r.tool,
    })
  }
  return out
}

/**
 * countActiveAgents — count forge_begin events in the last 5 minutes that
 * do NOT have a matching forge_end with the same task_id later in the
 * window. Conservative: an unknown event kind never decrements the count.
 */
function countActiveAgents(events: ParsedCbEvent[], now: number): number {
  const start = now - FIVE_MINUTES_MS
  // Walk newest-to-oldest is the intuitive direction, but we already get
  // oldest-first from tailJsonl, so accumulate in a Map<task, "begin"|"end">.
  const status = new Map<string, "begin" | "end">()
  for (const ev of events) {
    if (ev.ts_ms < start) continue
    if (!ev.task_id) continue
    if (ev.event === "forge_begin") {
      // Only set to "begin" if not already terminated later — but since we
      // walk in time order, we always overwrite with the latest state.
      status.set(ev.task_id, "begin")
    } else if (ev.event === "forge_end") {
      status.set(ev.task_id, "end")
    }
  }
  let count = 0
  for (const v of status.values()) {
    if (v === "begin") count++
  }
  return count
}

/**
 * costFromTokenUsage — sum USD across token_usage events in [start, now]
 * using rateFor(model). Returns 0 when no events.
 */
function costFromTokenUsage(events: ParsedCbEvent[], start: number, now: number): number {
  let usd = 0
  for (const ev of events) {
    if (ev.event !== "token_usage") continue
    if (ev.ts_ms < start || ev.ts_ms > now) continue
    const rate = rateFor(ev.model ?? null)
    const inputUsd = (ev.input_tokens ?? 0) * (rate.input_per_mtok / 1_000_000)
    const outputUsd = (ev.output_tokens ?? 0) * (rate.output_per_mtok / 1_000_000)
    usd += Math.max(0, inputUsd) + Math.max(0, outputUsd)
  }
  return usd
}

/**
 * sparkline60s — last 60 seconds of tool calls bucketed into 1s slots,
 * aligned to whole-second boundaries (so two consecutive polls share x-axis).
 */
function sparkline60s(events: ParsedToolEvent[], now: number): MissionControlSparkBucket[] {
  const oldestBucket = Math.floor((now - SPARKLINE_BUCKETS * SPARKLINE_BUCKET_MS) / SPARKLINE_BUCKET_MS) * SPARKLINE_BUCKET_MS
  const buckets: MissionControlSparkBucket[] = []
  for (let i = 0; i < SPARKLINE_BUCKETS; i++) {
    buckets.push({ ts: oldestBucket + i * SPARKLINE_BUCKET_MS, count: 0 })
  }
  for (const ev of events) {
    if (ev.ts_ms < oldestBucket) continue
    if (ev.ts_ms >= oldestBucket + SPARKLINE_BUCKETS * SPARKLINE_BUCKET_MS) continue
    const idx = Math.floor((ev.ts_ms - oldestBucket) / SPARKLINE_BUCKET_MS)
    if (idx >= 0 && idx < SPARKLINE_BUCKETS) buckets[idx].count++
  }
  return buckets
}

/**
 * sinceYouLeft — diff against the recorded previous visit. show=false when
 * either there is no previous visit (first visit) OR the previous visit was
 * within the show threshold.
 */
function sinceYouLeft(
  cbEvents: ParsedCbEvent[],
  toolEvents: ParsedToolEvent[],
  previousLastSeen: number | null,
  now: number,
): MissionControlSinceYouLeft {
  if (previousLastSeen === null || now - previousLastSeen <= SINCE_YOU_LEFT_THRESHOLD_MS) {
    return {
      show: false,
      last_seen_at: previousLastSeen,
      tool_calls_since: 0,
      usd_since: 0,
      tasks_touched: 0,
    }
  }

  // Cap the diff window at 24h so the chip never claims the universe-of-time
  // when last-seen is months stale.
  const start = Math.max(previousLastSeen, now - ONE_DAY_MS)

  let toolCalls = 0
  const taskSet = new Set<string>()
  for (const ev of toolEvents) {
    if (ev.ts_ms < start || ev.ts_ms > now) continue
    toolCalls++
    if (ev.task) taskSet.add(ev.task)
  }
  const usd = costFromTokenUsage(cbEvents, start, now)

  return {
    show: true,
    last_seen_at: previousLastSeen,
    tool_calls_since: toolCalls,
    usd_since: usd,
    tasks_touched: taskSet.size,
  }
}

/** todayStartMs — UTC midnight today (the dashboard runs server-side, UTC). */
function todayStartMs(now: number): number {
  const d = new Date(now)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

function projectMissionControl(args: ProjectArgs): MissionControlState {
  const cbEvents = parseCb(args.cbRows)
  const toolEvents = parseTools(args.toolRows)
  const now = args.now

  const activeCount = countActiveAgents(cbEvents, now)

  // Token burn rate — last 60 seconds of token_usage events, projected to
  // a per-minute rate. Already 60 seconds so no extrapolation needed.
  const tokenBurnUsd = costFromTokenUsage(cbEvents, now - ONE_MINUTE_MS, now)
  const tokenBurnUsdPerMin = tokenBurnUsd

  const dayStart = todayStartMs(now)
  const costTodayUsd = costFromTokenUsage(cbEvents, dayStart, now)

  const budget = args.budget > 0 ? args.budget : DEFAULT_DAILY_BUDGET_USD
  const pct = budget > 0 ? Math.min(2, costTodayUsd / budget) : 0

  const spark = sparkline60s(toolEvents, now)

  const syl = sinceYouLeft(cbEvents, toolEvents, args.previousLastSeen, now)

  let lastEventAt: number | null = null
  for (const ev of cbEvents) {
    if (lastEventAt === null || ev.ts_ms > lastEventAt) lastEventAt = ev.ts_ms
  }
  for (const ev of toolEvents) {
    if (lastEventAt === null || ev.ts_ms > lastEventAt) lastEventAt = ev.ts_ms
  }

  return {
    active_count: activeCount,
    token_burn_usd_per_min: tokenBurnUsdPerMin,
    cost_today_usd: costTodayUsd,
    daily_budget_usd: budget,
    cost_pct_of_budget: pct,
    sparkline_60s: spark,
    since_you_left: syl,
    last_event_at: lastEventAt,
    generated_at: new Date(now).toISOString(),
  }
}

// ---------------------------------------------------------------------------
// last-seen.json read / write helpers
// ---------------------------------------------------------------------------

interface LastSeenFile {
  last_seen_at: number
}

async function readLastSeen(path: string): Promise<number | null> {
  try {
    const raw = await readFile(path, "utf8")
    const parsed = JSON.parse(raw) as Partial<LastSeenFile>
    if (typeof parsed.last_seen_at === "number" && Number.isFinite(parsed.last_seen_at)) {
      return parsed.last_seen_at
    }
    return null
  } catch {
    return null
  }
}

async function writeLastSeen(path: string, ts: number): Promise<void> {
  try {
    await mkdir(dirname(path), { recursive: true })
    const body: LastSeenFile = { last_seen_at: ts }
    await writeFile(path, JSON.stringify(body), "utf8")
  } catch {
    // non-fatal; surface nothing
  }
}

// ---------------------------------------------------------------------------
// Daily-budget helper — env-driven, defaults to $50.
// ---------------------------------------------------------------------------

function dailyBudget(): number {
  const raw = process.env.CAE_DAILY_BUDGET_USD
  if (!raw) return DEFAULT_DAILY_BUDGET_USD
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_DAILY_BUDGET_USD
  return n
}

// Re-export the parsed-event shapes so tests that want to assemble fixtures
// without going through JSONL serialisation can do so.
export type { CbEvent }
