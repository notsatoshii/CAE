/**
 * cae-activity-state.ts — Aggregator for the Live Activity Panel.
 *
 * Reads the tool-call audit JSONL written by tools/audit-hook.sh and produces
 * the small projection consumed by /api/activity/live and the
 * <LiveActivityPanel /> component above the rollup-strip on /build.
 *
 * Eric P15 complaint: "dashboard shows nothing active when actively running".
 * This module's job is to surface live tool-call activity so that gap closes.
 *
 * Schema (per tools/audit-hook.sh + lib/cae-types.ts AuditEntry):
 *   {"ts":"<ISO8601 Z>","task":"<id>","tool":"<Bash|Edit|...>","cwd":"<path>"}
 *
 * Design notes:
 *   - Pure function with file path + clock injectable (testability).
 *   - Reads the LAST 50 000 bytes only via `tailJsonl` (defended against very
 *     large logs growing unbounded).
 *   - Malformed lines are silently dropped by tailJsonl (existing contract).
 *   - 5-second process-level cache so a 200-rps poll storm doesn't melt fs.io.
 *   - Empty / missing / unreadable file → all-zeros shape with
 *     last_event_at=null (UI must render an empty-state with character).
 */

import { join } from "node:path"
import { tailJsonl } from "./cae-state"
import { CAE_ROOT } from "./cae-config"
import type { AuditEntry } from "./cae-types"

/**
 * Default audit log path.
 *
 * The audit-hook (tools/audit-hook.sh) writes to `${CAE_ROOT}/.cae/metrics/tool-calls.jsonl`
 * — at CAE_ROOT, NOT under dashboard/. The activity panel surfaces activity for
 * the whole CAE workspace, not just the dashboard subdir.
 */
const DEFAULT_AUDIT_PATH = join(CAE_ROOT, ".cae", "metrics", "tool-calls.jsonl")

/** How many JSONL lines to consider — covers ~30 minutes of heavy activity comfortably. */
const TAIL_LIMIT = 5000

/** Window definitions in milliseconds. */
const ONE_MINUTE_MS = 60_000
const FIVE_MINUTES_MS = 5 * ONE_MINUTE_MS
const THIRTY_MINUTES_MS = 30 * ONE_MINUTE_MS
const ONE_DAY_MS = 24 * 60 * ONE_MINUTE_MS

/** Sparkline shape: 30 buckets of 60s each, oldest-first. */
const SPARKLINE_BUCKETS = 30
const SPARKLINE_BUCKET_MS = ONE_MINUTE_MS

/** Process-level cache TTL. Matches the API Cache-Control header. */
export const ACTIVITY_CACHE_TTL_MS = 5_000

/** Public response shape consumed by the /api/activity/live route + UI. */
export interface LiveActivity {
  /** Count of tool calls in the last 60 seconds. */
  tools_per_min_now: number
  /** Most-frequent tool kind in the last 60 seconds, or null when idle. */
  most_frequent_tool: string | null
  /** Total tool count in the last 24 hours. */
  last_24h_count: number
  /**
   * Last 30 minutes broken into 60-second buckets, oldest-first.
   * `ts` is the unix-ms start of the bucket; `count` is the # of tool calls
   * recorded inside [ts, ts+60_000).
   */
  sparkline: Array<{ ts: number; count: number }>
  /** Per-tool counts for the last 5 minutes. Empty object when idle. */
  tool_breakdown_5m: Record<string, number>
  /** Unix-ms of the most recent tool call, or null if no events. */
  last_event_at: number | null
}

/** Empty / zero shape used for missing-file + initial-render fallbacks. */
export function emptyActivity(now: number = Date.now()): LiveActivity {
  const sparkline: Array<{ ts: number; count: number }> = []
  const oldest = now - SPARKLINE_BUCKETS * SPARKLINE_BUCKET_MS
  for (let i = 0; i < SPARKLINE_BUCKETS; i++) {
    sparkline.push({ ts: oldest + i * SPARKLINE_BUCKET_MS, count: 0 })
  }
  return {
    tools_per_min_now: 0,
    most_frequent_tool: null,
    last_24h_count: 0,
    sparkline,
    tool_breakdown_5m: {},
    last_event_at: null,
  }
}

interface CacheEntry {
  expiresAt: number
  data: LiveActivity
}

const cache = new Map<string, CacheEntry>()

/** Test hook — clear the in-process cache between tests. */
export function __resetActivityCache(): void {
  cache.clear()
}

export interface GetLiveActivityOpts {
  /** Override the audit log path (tests + multi-project setups). */
  filePath?: string
  /** Inject a clock for deterministic tests. */
  now?: number
  /** Skip the in-process cache — tests should pass `true`. */
  noCache?: boolean
}

/**
 * Read + project the audit JSONL into the LiveActivity shape.
 *
 * Cached for 5 s per file path to absorb the 5-s client poll without
 * re-walking the JSONL on every request.
 */
export async function getLiveActivity(
  opts: GetLiveActivityOpts = {},
): Promise<LiveActivity> {
  const filePath = opts.filePath ?? DEFAULT_AUDIT_PATH
  const now = opts.now ?? Date.now()

  if (!opts.noCache) {
    const cached = cache.get(filePath)
    if (cached && cached.expiresAt > now) return cached.data
  }

  const rows = await tailJsonl(filePath, TAIL_LIMIT)
  const events = parseEvents(rows)
  const data = projectActivity(events, now)

  if (!opts.noCache) {
    cache.set(filePath, { expiresAt: now + ACTIVITY_CACHE_TTL_MS, data })
  }
  return data
}

/**
 * parseEvents — typeguard JSONL rows into AuditEntry shape with usable ts_ms.
 * Drops rows where ts is missing / unparseable / tool is non-string.
 */
function parseEvents(rows: unknown[]): Array<{ ts_ms: number; tool: string; entry: AuditEntry }> {
  const out: Array<{ ts_ms: number; tool: string; entry: AuditEntry }> = []
  for (const row of rows) {
    if (row === null || typeof row !== "object") continue
    const r = row as Record<string, unknown>
    if (typeof r.ts !== "string") continue
    if (typeof r.tool !== "string" || r.tool.length === 0) continue
    const t = Date.parse(r.ts)
    if (Number.isNaN(t)) continue
    out.push({
      ts_ms: t,
      tool: r.tool,
      entry: r as unknown as AuditEntry,
    })
  }
  return out
}

/**
 * projectActivity — pure projection; event list → API response shape.
 *
 * Walks the events once, bucketing into:
 *   - last 60s window           → tools_per_min_now + most_frequent_tool
 *   - last 5m window            → tool_breakdown_5m
 *   - last 24h window           → last_24h_count
 *   - last 30m × 60s buckets    → sparkline
 *
 * Bucket index for sparkline:
 *   oldest_bucket_ts = floor((now - 30m) / 60s) * 60s
 *   index = floor((event_ts - oldest_bucket_ts) / 60s)
 *   keep iff 0 <= index < 30
 */
function projectActivity(
  events: Array<{ ts_ms: number; tool: string; entry: AuditEntry }>,
  now: number,
): LiveActivity {
  const window60s = now - ONE_MINUTE_MS
  const window5m = now - FIVE_MINUTES_MS
  const window30m = now - THIRTY_MINUTES_MS
  const window24h = now - ONE_DAY_MS

  // Align sparkline buckets to whole-minute boundaries so two consecutive
  // polls return identical bucket starts (no jitter in the chart x-axis).
  const oldestBucketTs = Math.floor(window30m / SPARKLINE_BUCKET_MS) * SPARKLINE_BUCKET_MS
  const sparkline: Array<{ ts: number; count: number }> = []
  for (let i = 0; i < SPARKLINE_BUCKETS; i++) {
    sparkline.push({ ts: oldestBucketTs + i * SPARKLINE_BUCKET_MS, count: 0 })
  }

  const tools60s: Record<string, number> = {}
  const tools5m: Record<string, number> = {}
  let count60s = 0
  let count24h = 0
  let lastEventAt: number | null = null

  for (const ev of events) {
    if (ev.ts_ms <= 0) continue

    if (lastEventAt === null || ev.ts_ms > lastEventAt) lastEventAt = ev.ts_ms

    if (ev.ts_ms >= window24h) count24h++
    if (ev.ts_ms >= window5m) {
      tools5m[ev.tool] = (tools5m[ev.tool] ?? 0) + 1
    }
    if (ev.ts_ms >= window60s) {
      count60s++
      tools60s[ev.tool] = (tools60s[ev.tool] ?? 0) + 1
    }
    if (ev.ts_ms >= oldestBucketTs && ev.ts_ms < oldestBucketTs + SPARKLINE_BUCKETS * SPARKLINE_BUCKET_MS) {
      const idx = Math.floor((ev.ts_ms - oldestBucketTs) / SPARKLINE_BUCKET_MS)
      sparkline[idx].count++
    }
  }

  let mostFrequent: string | null = null
  if (count60s > 0) {
    let best = -1
    for (const [tool, n] of Object.entries(tools60s)) {
      if (n > best) {
        best = n
        mostFrequent = tool
      }
    }
  }

  return {
    tools_per_min_now: count60s,
    most_frequent_tool: mostFrequent,
    last_24h_count: count24h,
    sparkline,
    tool_breakdown_5m: tools5m,
    last_event_at: lastEventAt,
  }
}
