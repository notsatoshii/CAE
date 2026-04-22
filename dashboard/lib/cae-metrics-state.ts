/**
 * Phase 7 metrics aggregator — single data source of truth for /api/metrics
 * and every panel under /metrics.
 *
 * Walks `.cae/metrics/circuit-breakers.jsonl` and `.cae/metrics/sentinel.jsonl`
 * across ALL projects returned by `listProjects()` (per D-03 — multi-project
 * aggregation is the default, no per-project filter UI in v0.1) and returns
 * the canonical `MetricsState` shape locked by 07-CONTEXT.md §D-10.
 *
 * Design rules (DO NOT VIOLATE):
 *   1. Real jsonl schema is snake_case (ts, task_id, input_tokens,
 *      output_tokens) — NEVER camelCase. Events are forge_begin / forge_end
 *      (with success:bool) — NEVER forge_start / forge_done / forge_fail.
 *   2. Every field read uses typeof-guards against a Record<string, unknown>
 *      proxy (CbEvent). Malformed rows must not produce NaN.
 *   3. Process-level 30s cache TTL (CACHE_TTL_MS). Panel freshness budget.
 *   4. Per-project reads are wrapped in try/catch; one bad project must not
 *      poison the whole aggregator.
 *   5. Sort in COPIES — never mutate the cached value's arrays.
 *   6. Aggregator does NOT filter the "min 5 samples" rule for per-agent
 *      success rate — it emits sample_n so the UI can apply that policy.
 *
 * See 07-CONTEXT.md D-10, 07-RESEARCH.md §Panel → Source Matrix, and
 * 07-01-SUMMARY.md for Wave 0 schema details.
 */

import { join } from "path"
import { stat } from "fs/promises"
import {
  listProjects,
  tailJsonl,
  listInbox,
  listOutbox,
} from "./cae-state"
import { OUTBOX_ROOT } from "./cae-config"
import { AGENT_META, type AgentName } from "./copy/agent-meta"
import type { CbEvent, Project, OutboxTask } from "./cae-types"

// === Constants ===

const CACHE_TTL_MS = 30_000
const DAY_MS = 86_400_000
const WINDOW_7D_MS = 7 * DAY_MS
const WINDOW_30D_MS = 30 * DAY_MS
const MAX_WALL_MS = 10 * 3_600_000 // 10h guard against stuck sessions

// Tail sizes per file per project. Generous enough to cover 30d of activity
// on an active repo but bounded to avoid O(n) blow-up on legacy ones.
// Documented in SUMMARY.
const CB_TAIL_LINES = 10_000
const SENTINEL_TAIL_LINES = 2_000

// Fixed time-to-merge bin edges (ms upper bound inclusive). Order preserved
// in output even when count === 0 (UI renders zeroes as empty bars).
const MERGE_BINS: Array<{ label: string; maxMs: number }> = [
  { label: "<1m", maxMs: 60_000 },
  { label: "1-5m", maxMs: 300_000 },
  { label: "5-15m", maxMs: 900_000 },
  { label: "15m-1h", maxMs: 3_600_000 },
  { label: ">1h", maxMs: Number.POSITIVE_INFINITY },
]

// === Exported types (Wave 2 panels import these) ===

export interface SpendingState {
  tokens_today: number
  tokens_mtd: number
  tokens_projected_monthly: number
  by_agent_30d: Array<{ date: string; [agentName: string]: number | string }>
  daily_30d: Array<{ date: string; tokens: number }>
  top_expensive: Array<{
    task_id: string
    title: string
    tokens: number
    agent: string
    ts: string
  }>
}

export interface ReliabilityState {
  per_agent_7d: Array<{ agent: string; success_rate: number; sample_n: number }>
  retry_heatmap: Array<{ dow: number; hour: number; count: number }>
  halt_events: Array<{ ts: string; reason: string; task_id?: string }>
  sentinel_rejects_30d: Array<{ date: string; rejects: number; approvals: number }>
}

export interface SpeedState {
  per_agent_wall: Array<{ agent: string; p50_ms: number; p95_ms: number; n: number }>
  queue_depth_now: number
  time_to_merge_bins: Array<{ bin_label: string; count: number }>
}

export interface MetricsState {
  generated_at: string
  spending: SpendingState
  reliability: ReliabilityState
  speed: SpeedState
}

// === Internal event containers ===

interface CollectedCb {
  project: Project
  event: CbEvent
}

interface CollectedSentinel {
  project: Project
  event: Record<string, unknown>
}

// === Defensive field readers (snake_case per Wave 0 schema) ===

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined
}

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined
}

function eventTs(e: CbEvent): string | undefined {
  return asString(e.ts)
}

function eventKind(e: CbEvent): string {
  return typeof e.event === "string" ? e.event : ""
}

function eventAgent(e: CbEvent): string {
  // Matches cae-agents-state.ts fallback — if adapter didn't stamp an agent
  // field, assume forge (the default CAE executor).
  const a = asString(e.agent)
  return a ? a.toLowerCase() : "forge"
}

function eventTokens(e: CbEvent): number {
  let n = 0
  const inp = asNumber(e.input_tokens)
  const out = asNumber(e.output_tokens)
  if (inp !== undefined) n += inp
  if (out !== undefined) n += out
  return n
}

function eventTaskId(e: CbEvent): string {
  return asString(e.task_id) ?? ""
}

function eventAttempt(e: CbEvent): number {
  return asNumber(e.attempt) ?? 1
}

// === Helpers ===

/**
 * Linear-interpolation percentile over an already-sorted ascending array.
 * Matches numpy's default `linear` interpolation so unit-test reference
 * values can be computed with `np.percentile(samples, p)`.
 */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

function utcDateString(tsMs: number): string {
  const d = new Date(tsMs)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const dd = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${dd}`
}

function daysInUtcMonth(now: Date): number {
  return new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate()
}

function enumerateDatesBackward(nowMs: number, days: number): string[] {
  const out: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    out.push(utcDateString(nowMs - i * DAY_MS))
  }
  return out
}

// === Cache ===

interface Cached {
  at: number
  value: MetricsState
}

let cached: Cached | null = null

/**
 * Public entry-point. Returns a freshly-computed MetricsState OR the cached
 * one if it's younger than CACHE_TTL_MS. The cached object is returned
 * by-reference; callers must not mutate.
 */
export async function getMetricsState(): Promise<MetricsState> {
  const now = Date.now()
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.value
  const value = await build()
  cached = { at: now, value }
  return value
}

// === Build pipeline ===

async function build(): Promise<MetricsState> {
  const projects = await listProjects()
  const cbEvents: CollectedCb[] = []
  const sentinelEvents: CollectedSentinel[] = []

  for (const p of projects) {
    // circuit-breakers.jsonl: source of spending + reliability + speed.
    try {
      const rows = await tailJsonl(
        join(p.path, ".cae", "metrics", "circuit-breakers.jsonl"),
        CB_TAIL_LINES,
      )
      for (const row of rows) {
        if (typeof row !== "object" || row === null) continue
        const ev = row as CbEvent
        // Drop rows without the two required fields (defensive guard).
        if (typeof ev.ts !== "string" || typeof ev.event !== "string") continue
        cbEvents.push({ project: p, event: ev })
      }
    } catch (err) {
      console.error(`[cae-metrics-state] cb read failed for ${p.name}:`, err)
    }

    // sentinel.jsonl: only sentinel_rejects_30d needs this. May not exist
    // until first sentinel run — silent fallback is correct.
    try {
      const rows = await tailJsonl(
        join(p.path, ".cae", "metrics", "sentinel.jsonl"),
        SENTINEL_TAIL_LINES,
      )
      for (const row of rows) {
        if (typeof row !== "object" || row === null) continue
        sentinelEvents.push({ project: p, event: row as Record<string, unknown> })
      }
    } catch {
      // silently ok — no sentinel data yet
    }
  }

  const [inbox, outbox] = await Promise.all([
    listInbox().catch((err): [] => {
      console.error("[cae-metrics-state] listInbox failed:", err)
      return []
    }),
    listOutbox().catch((err): [] => {
      console.error("[cae-metrics-state] listOutbox failed:", err)
      return []
    }),
  ])

  return {
    generated_at: new Date().toISOString(),
    spending: buildSpending(cbEvents),
    reliability: buildReliability(cbEvents, sentinelEvents),
    speed: await buildSpeed(cbEvents, inbox.length, outbox),
  }
}

// === Spending (REQ-7-SPEND) ===

function buildSpending(events: CollectedCb[]): SpendingState {
  const nowMs = Date.now()
  const now = new Date(nowMs)
  const todayDate = utcDateString(nowMs)
  const monthPrefix = todayDate.slice(0, 7) // YYYY-MM
  const agentNames = Object.keys(AGENT_META) as AgentName[]

  // Zero-filled date skeleton for the last 30d.
  const dates30d = enumerateDatesBackward(nowMs, 30)
  const dailyMap = new Map<string, number>()
  for (const d of dates30d) dailyMap.set(d, 0)

  // by_agent_30d: date → (agent → tokens)
  const byAgent30d = new Map<string, Map<string, number>>()
  for (const d of dates30d) {
    const row = new Map<string, number>()
    for (const a of agentNames) row.set(a, 0)
    byAgent30d.set(d, row)
  }

  // top_expensive scratch (group by task_id across all projects).
  interface TaskAgg {
    tokens: number
    lastTs: string
    agentCounts: Map<string, number>
  }
  const taskAgg = new Map<string, TaskAgg>()

  let tokens_today = 0
  let tokens_mtd = 0

  for (const { event } of events) {
    const tok = eventTokens(event)
    if (tok <= 0) continue
    const tsStr = eventTs(event)
    if (!tsStr) continue
    const tsMs = Date.parse(tsStr)
    if (!Number.isFinite(tsMs)) continue

    const eDateStr = utcDateString(tsMs)

    if (eDateStr === todayDate) tokens_today += tok
    if (eDateStr.startsWith(monthPrefix)) tokens_mtd += tok

    const ageMs = nowMs - tsMs
    if (ageMs >= 0 && ageMs < WINDOW_30D_MS) {
      const daily = dailyMap.get(eDateStr)
      if (daily !== undefined) dailyMap.set(eDateStr, daily + tok)

      const agent = eventAgent(event)
      const row = byAgent30d.get(eDateStr)
      if (row) {
        // Unknown agents fold under "forge" to avoid legend sprawl while
        // preserving the stack total (same pattern as Phase 5).
        const key = agent in AGENT_META ? agent : "forge"
        row.set(key, (row.get(key) ?? 0) + tok)
      }

      const taskId = eventTaskId(event)
      if (taskId) {
        let agg = taskAgg.get(taskId)
        if (!agg) {
          agg = { tokens: 0, lastTs: tsStr, agentCounts: new Map() }
          taskAgg.set(taskId, agg)
        }
        agg.tokens += tok
        if (tsStr > agg.lastTs) agg.lastTs = tsStr
        agg.agentCounts.set(agent, (agg.agentCounts.get(agent) ?? 0) + 1)
      }
    }
  }

  const dim = daysInUtcMonth(now)
  const dayOfMonth = Math.max(1, now.getUTCDate())
  const tokens_projected_monthly = Math.round(tokens_mtd * (dim / dayOfMonth))

  // Materialize zero-filled rows in chronological order.
  const by_agent_30d: SpendingState["by_agent_30d"] = dates30d.map((d) => {
    const row: { date: string; [agentName: string]: number | string } = { date: d }
    const agentRow = byAgent30d.get(d)!
    for (const a of agentNames) row[a] = agentRow.get(a) ?? 0
    return row
  })

  const daily_30d: SpendingState["daily_30d"] = dates30d.map((d) => ({
    date: d,
    tokens: dailyMap.get(d) ?? 0,
  }))

  // Top expensive — sort copy, take 10. Agent = most-frequent on task events.
  const taskEntries: Array<[string, TaskAgg]> = Array.from(taskAgg.entries())
  taskEntries.sort((a, b) => b[1].tokens - a[1].tokens)
  const top_expensive: SpendingState["top_expensive"] = taskEntries
    .slice(0, 10)
    .map(([taskId, agg]) => {
      let bestAgent = "forge"
      let bestCount = -1
      for (const [a, c] of agg.agentCounts) {
        if (c > bestCount) {
          bestCount = c
          bestAgent = a
        }
      }
      return {
        task_id: taskId,
        // Title derivation from BUILDPLAN.md across projects is deferred
        // (v0.1); UI can fall back to task_id — per CONTEXT comment.
        title: taskId,
        tokens: agg.tokens,
        agent: bestAgent,
        ts: agg.lastTs,
      }
    })

  return {
    tokens_today,
    tokens_mtd,
    tokens_projected_monthly,
    by_agent_30d,
    daily_30d,
    top_expensive,
  }
}

// === Reliability (REQ-7-WELL) ===

function buildReliability(
  cbEvents: CollectedCb[],
  sentinelEvents: CollectedSentinel[],
): ReliabilityState {
  const nowMs = Date.now()
  const sevenDaysAgo = nowMs - WINDOW_7D_MS
  const agentNames = Object.keys(AGENT_META) as AgentName[]

  // per_agent_7d: emit ALL 9 agents (sample_n may be 0) — UI decides the ≥5
  // gate. Aggregator does not filter (per plan task §2).
  const perAgent = new Map<string, { success: number; total: number }>()
  for (const a of agentNames) perAgent.set(a, { success: 0, total: 0 })

  // retry_heatmap 7d: 7 dow × 24 hour grid, always-present cells.
  // Retry = forge_end(success:false) OR limit_exceeded(limit=="max_retries")
  const heatmap = new Map<string, number>()
  for (let dow = 0; dow < 7; dow++) {
    for (let hour = 0; hour < 24; hour++) heatmap.set(`${dow}-${hour}`, 0)
  }

  const halts: ReliabilityState["halt_events"] = []

  // sentinel rejects — 30d zero-filled daily.
  const dates30d = enumerateDatesBackward(nowMs, 30)
  const rejectMap = new Map<string, number>()
  const approveMap = new Map<string, number>()
  for (const d of dates30d) {
    rejectMap.set(d, 0)
    approveMap.set(d, 0)
  }

  for (const { event: ev } of cbEvents) {
    const tsStr = eventTs(ev)
    if (!tsStr) continue
    const tsMs = Date.parse(tsStr)
    if (!Number.isFinite(tsMs)) continue
    const kind = eventKind(ev)

    // 7d per-agent success rate on forge_end rows.
    if (tsMs >= sevenDaysAgo && kind === "forge_end") {
      const agent = eventAgent(ev)
      const bucket = agent in AGENT_META ? agent : "forge"
      const slot = perAgent.get(bucket)
      if (slot) {
        slot.total += 1
        if (ev.success === true) slot.success += 1
      }
    }

    // 7d retry heatmap.
    if (tsMs >= sevenDaysAgo) {
      const isFailedForge = kind === "forge_end" && ev.success === false
      const isRetryLimit =
        kind === "limit_exceeded" && asString(ev.limit) === "max_retries"
      if (isFailedForge || isRetryLimit) {
        const d = new Date(tsMs)
        const key = `${d.getUTCDay()}-${d.getUTCHours()}`
        heatmap.set(key, (heatmap.get(key) ?? 0) + 1)
      }
    }

    // halt events (no time window — bounded to last 20 after sort).
    if (kind === "halt") {
      halts.push({
        ts: tsStr,
        reason: asString(ev.reason) ?? "unknown",
        task_id: eventTaskId(ev) || undefined,
      })
    }
  }

  // Materialize per_agent_7d in AGENT_META iteration order.
  const per_agent_7d: ReliabilityState["per_agent_7d"] = agentNames.map((a) => {
    const slot = perAgent.get(a)!
    const sample_n = slot.total
    const success_rate = sample_n === 0 ? 0 : slot.success / sample_n
    return { agent: a, success_rate, sample_n }
  })

  // Materialize heatmap in stable (dow, hour) order.
  const retry_heatmap: ReliabilityState["retry_heatmap"] = []
  for (let dow = 0; dow < 7; dow++) {
    for (let hour = 0; hour < 24; hour++) {
      retry_heatmap.push({ dow, hour, count: heatmap.get(`${dow}-${hour}`) ?? 0 })
    }
  }

  // halt_events: newest-first, cap 20 (sort on copy).
  const haltsSorted = halts
    .slice()
    .sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0))
  const halt_events = haltsSorted.slice(0, 20)

  // Sentinel rejects/approvals 30d.
  for (const { event: ev } of sentinelEvents) {
    const ts = asString(ev.ts)
    if (!ts) continue
    const tsMs = Date.parse(ts)
    if (!Number.isFinite(tsMs)) continue
    const ageMs = nowMs - tsMs
    if (ageMs < 0 || ageMs >= WINDOW_30D_MS) continue
    const dateStr = utcDateString(tsMs)

    const approve = ev.approve
    const kind = asString(ev.event) ?? ""
    const isInvalid = /verdict_invalid|total_failure/.test(kind)
    if (approve === false || isInvalid) {
      rejectMap.set(dateStr, (rejectMap.get(dateStr) ?? 0) + 1)
    } else if (approve === true) {
      approveMap.set(dateStr, (approveMap.get(dateStr) ?? 0) + 1)
    }
  }

  const sentinel_rejects_30d: ReliabilityState["sentinel_rejects_30d"] =
    dates30d.map((d) => ({
      date: d,
      rejects: rejectMap.get(d) ?? 0,
      approvals: approveMap.get(d) ?? 0,
    }))

  return {
    per_agent_7d,
    retry_heatmap,
    halt_events,
    sentinel_rejects_30d,
  }
}

// === Speed (REQ-7-FAST) ===

async function buildSpeed(
  cbEvents: CollectedCb[],
  inboxDepth: number,
  outbox: OutboxTask[],
): Promise<SpeedState> {
  const agentNames = Object.keys(AGENT_META) as AgentName[]
  const foldAgent = (a: string): string => (a in AGENT_META ? a : "forge")

  // Pair forge_begin / forge_end by (project.name, task_id, attempt).
  // Project scoping avoids cross-project collisions when two projects reuse
  // the same task_id convention.
  interface BeginRec {
    tsStr: string
    agent: string
  }
  const beginMap = new Map<string, BeginRec>()
  const wallsByAgent = new Map<string, number[]>()
  for (const a of agentNames) wallsByAgent.set(a, [])

  // First pass: gather forge_begin events.
  for (const { project, event } of cbEvents) {
    if (eventKind(event) !== "forge_begin") continue
    const ts = eventTs(event)
    if (!ts) continue
    const taskId = eventTaskId(event)
    const attempt = eventAttempt(event)
    const key = `${project.name}::${taskId}::${attempt}`
    beginMap.set(key, { tsStr: ts, agent: foldAgent(eventAgent(event)) })
  }

  // Second pass: match forge_end → forge_begin, compute delta.
  for (const { project, event } of cbEvents) {
    if (eventKind(event) !== "forge_end") continue
    const endStr = eventTs(event)
    if (!endStr) continue
    const taskId = eventTaskId(event)
    const attempt = eventAttempt(event)
    const key = `${project.name}::${taskId}::${attempt}`
    const begin = beginMap.get(key)
    if (!begin) continue
    const a = Date.parse(begin.tsStr)
    const b = Date.parse(endStr)
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue
    const delta = b - a
    // Guard against negative / zero / absurdly-long sessions.
    if (delta <= 0 || delta > MAX_WALL_MS) continue
    // Agent = begin.agent (most reliable on lifecycle pairing); fall back to
    // the forge_end agent if the begin omitted it.
    const agent = begin.agent || foldAgent(eventAgent(event))
    const bucket = wallsByAgent.get(agent) ?? wallsByAgent.get("forge")!
    bucket.push(delta)
  }

  const per_agent_wall: SpeedState["per_agent_wall"] = agentNames.map((a) => {
    const samples = wallsByAgent.get(a) ?? []
    const sorted = samples.slice().sort((x, y) => x - y)
    return {
      agent: a,
      p50_ms: Math.round(percentile(sorted, 50)),
      p95_ms: Math.round(percentile(sorted, 95)),
      n: sorted.length,
    }
  })

  // Time-to-merge distribution: outbox DONE.md mtime − inbox task birthtime.
  // Inbox is ephemeral (often cleared post-completion); we can only compute
  // the metric for tasks still present in both. Documented in SUMMARY.
  const counts = new Array<number>(MERGE_BINS.length).fill(0)
  if (outbox.length > 0) {
    let inboxSnapshot: Awaited<ReturnType<typeof listInbox>> = []
    try {
      inboxSnapshot = await listInbox()
    } catch {
      inboxSnapshot = []
    }
    const inboxByTask = new Map<string, number>()
    for (const t of inboxSnapshot) {
      inboxByTask.set(t.taskId, t.createdAt.getTime())
    }
    for (const t of outbox) {
      if (!t.hasDone) continue
      const createdMs = inboxByTask.get(t.taskId)
      if (createdMs === undefined) continue
      try {
        const s = await stat(join(OUTBOX_ROOT, t.taskId, "DONE.md"))
        const delta = s.mtimeMs - createdMs
        if (!Number.isFinite(delta) || delta < 0) continue
        for (let i = 0; i < MERGE_BINS.length; i++) {
          if (delta <= MERGE_BINS[i].maxMs) {
            counts[i] += 1
            break
          }
        }
      } catch {
        // DONE.md vanished between listOutbox and stat — skip.
      }
    }
  }

  const time_to_merge_bins: SpeedState["time_to_merge_bins"] = MERGE_BINS.map(
    (b, i) => ({ bin_label: b.label, count: counts[i] }),
  )

  return {
    per_agent_wall,
    queue_depth_now: inboxDepth,
    time_to_merge_bins,
  }
}
