/**
 * cae-activity-feed.ts — Class 15A reader.
 *
 * Unions the canonical activity.jsonl (producer-driven, written by
 * cae-event-emit) with the legacy per-category streams the dashboard
 * already tails:
 *   - circuit-breakers.jsonl  (forge_begin / forge_end / halt / …)
 *   - heartbeat.jsonl         (alive-signal beats, cron @30s)
 *   - scheduler.jsonl         (cae scheduler tick events)
 *
 * Produces a single sorted `ActivityFeedRow[]` keyed on `ts` DESC.
 *
 * Why union instead of migrate: the legacy streams are written by
 * bin/circuit_breakers.py + heartbeat-emitter.sh, which are not dashboard
 * code. Migrating those to emit to activity.jsonl is a multi-repo change.
 * The union reader is cheap and works TODAY — anything new emits
 * directly to activity.jsonl, legacy streams surface until migrated.
 */

import { join } from "node:path"
import { tailJsonl } from "./cae-state"
import { CAE_ROOT } from "./cae-config"
import type { ActivityEventType } from "./cae-event-emit"
import { ACTIVITY_JSONL_PATH } from "./cae-event-emit"

/**
 * Final shape consumed by the UI feed card. Extends ActivityEvent with an
 * origin tag so the UI can distinguish activity.jsonl rows from synthesised
 * rows derived from legacy streams (useful for debugging + icon choice).
 */
export interface ActivityFeedRow {
  ts: string
  type: ActivityEventType
  source: string
  actor?: string
  phase?: string
  summary: string
  meta?: Record<string, unknown>
  /** Which underlying stream produced this row. */
  origin: "activity" | "circuit-breakers" | "heartbeat" | "scheduler"
}

export const FEED_CAP = 500

export interface GetActivityFeedOpts {
  /** Override CAE_ROOT — tests + multi-project setups. */
  root?: string
  /** Override individual paths for testing. */
  paths?: {
    activity?: string
    circuitBreakers?: string
    heartbeat?: string
    scheduler?: string
  }
  /** Tail window — default 2000 per stream. */
  tailLimit?: number
}

/**
 * Read + union + sort. Pure projection; no caching here — the API route
 * sits in front.
 */
export async function getActivityFeed(
  opts: GetActivityFeedOpts = {},
): Promise<ActivityFeedRow[]> {
  const root = opts.root ?? CAE_ROOT
  const metricsDir = join(root, ".cae", "metrics")
  const p = {
    activity: opts.paths?.activity ?? ACTIVITY_JSONL_PATH,
    circuitBreakers:
      opts.paths?.circuitBreakers ?? join(metricsDir, "circuit-breakers.jsonl"),
    heartbeat: opts.paths?.heartbeat ?? join(metricsDir, "heartbeat.jsonl"),
    scheduler: opts.paths?.scheduler ?? join(metricsDir, "scheduler.jsonl"),
  }
  const tailLimit = opts.tailLimit ?? 2000

  const [activity, cb, hb, sch] = await Promise.all([
    tailJsonl(p.activity, tailLimit),
    tailJsonl(p.circuitBreakers, tailLimit),
    tailJsonl(p.heartbeat, tailLimit),
    tailJsonl(p.scheduler, tailLimit),
  ])

  const rows: ActivityFeedRow[] = []

  // activity.jsonl — pass through as-is, stamped with origin=activity.
  for (const raw of activity) {
    const row = projectActivityRow(raw)
    if (row) rows.push(row)
  }

  // circuit-breakers.jsonl — translate each row into the feed shape.
  for (const raw of cb) {
    const row = projectCircuitBreakerRow(raw)
    if (row) rows.push(row)
  }

  // heartbeat.jsonl — translate (mostly one-per-30s, will be down-sampled
  // at render time; we still include all so dashboards can show gaps).
  for (const raw of hb) {
    const row = projectHeartbeatRow(raw)
    if (row) rows.push(row)
  }

  // scheduler.jsonl
  for (const raw of sch) {
    const row = projectSchedulerRow(raw)
    if (row) rows.push(row)
  }

  // Sort ts DESC — lexicographic compare is valid for ISO-8601 UTC strings.
  rows.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0))

  return rows.slice(0, FEED_CAP)
}

// ── projection helpers ─────────────────────────────────────────────────

function projectActivityRow(raw: unknown): ActivityFeedRow | null {
  if (raw === null || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (typeof r.ts !== "string") return null
  if (typeof r.type !== "string") return null
  if (typeof r.source !== "string") return null
  if (typeof r.summary !== "string") return null
  return {
    ts: r.ts,
    type: r.type as ActivityEventType,
    source: r.source,
    actor: typeof r.actor === "string" ? r.actor : undefined,
    phase: typeof r.phase === "string" ? r.phase : undefined,
    summary: r.summary,
    meta:
      r.meta && typeof r.meta === "object"
        ? (r.meta as Record<string, unknown>)
        : undefined,
    origin: "activity",
  }
}

function projectCircuitBreakerRow(raw: unknown): ActivityFeedRow | null {
  if (raw === null || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (typeof r.ts !== "string") return null
  const event = typeof r.event === "string" ? r.event : ""
  if (!event) return null

  const agent = typeof r.agent === "string" ? r.agent : undefined
  const taskId = typeof r.task_id === "string" ? r.task_id : undefined

  let type: ActivityEventType = "other"
  let summary = event
  if (event === "forge_begin") {
    type = "agent_spawn"
    summary = `${agent ?? "agent"} started ${taskId ?? "task"}`
  } else if (event === "forge_end") {
    type = "agent_complete"
    const ok = r.success === true
    summary = `${agent ?? "agent"} ${ok ? "completed" : "aborted"} ${taskId ?? "task"}`
  } else if (event === "halt") {
    type = "other"
    summary = `halt: ${typeof r.reason === "string" ? r.reason : "unknown"}`
  } else if (event === "token_usage") {
    type = "other"
    const inTok = typeof r.input_tokens === "number" ? r.input_tokens : 0
    const outTok = typeof r.output_tokens === "number" ? r.output_tokens : 0
    summary = `${agent ?? "agent"} used ${inTok + outTok} tokens`
  }

  return {
    ts: r.ts,
    type,
    source: "circuit-breakers",
    actor: agent,
    phase: deriveCbPhase(taskId),
    summary,
    meta: {
      event,
      task_id: taskId,
      success: r.success,
    },
    origin: "circuit-breakers",
  }
}

function projectHeartbeatRow(raw: unknown): ActivityFeedRow | null {
  if (raw === null || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (typeof r.ts !== "string") return null
  const source = typeof r.source === "string" ? r.source : "heartbeat"
  return {
    ts: r.ts,
    type: "other",
    source: `heartbeat:${source}`,
    summary: "heartbeat",
    origin: "heartbeat",
  }
}

function projectSchedulerRow(raw: unknown): ActivityFeedRow | null {
  if (raw === null || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  if (typeof r.ts !== "string") return null
  const event = typeof r.event === "string" ? r.event : "scheduler_tick"
  const schedule = typeof r.schedule === "string" ? r.schedule : undefined
  return {
    ts: r.ts,
    type: "workflow_run",
    source: "scheduler",
    summary: schedule ? `scheduler → ${schedule}` : `scheduler ${event}`,
    meta: { event, schedule },
    origin: "scheduler",
  }
}

function deriveCbPhase(taskId: string | undefined): string | undefined {
  if (!taskId) return undefined
  const m = taskId.match(/^p(\d+)-/)
  return m ? `p${m[1]}` : undefined
}
