/**
 * Phase 5 agents roster + detail aggregator.
 *
 * Walks `.cae/metrics/circuit-breakers.jsonl` across all projects returned by
 * `listProjects()` and produces:
 *   - `getAgentsRoster()` — one card per agent in AGENT_META (always 9 entries)
 *   - `getAgentDetail(name)` — full drawer data for a single agent (persona,
 *     lifetime stats, last 50 invocations)
 *
 * Single pass over the event stream per cache window. Process-level 30s cache
 * (longer than the 1s home cache — agent stats move slowly). Mirrors the
 * defensive `typeof`-guard pattern from `cae-home-state.ts` so malformed /
 * partial event rows never produce NaN output.
 *
 * See .planning/phases/05-agents-tab/05-CONTEXT.md §Data API and §Drift
 * detection thresholds for the authoritative contract.
 */

import { readFile } from "fs/promises"
import { join } from "path"
import { listProjects, tailJsonl } from "./cae-state"
import { CAE_ROOT } from "./cae-config"
import { AGENT_META, agentMetaFor, type AgentName } from "./copy/agent-meta"
import type { Project } from "./cae-types"

// === Exported types ===

export interface AgentRosterEntry {
  name: string
  label: string
  founder_label: string
  emoji: string
  color: string
  model: string
  group: "active" | "recently_used" | "dormant"
  last_run_days_ago: number | null
  stats_7d: {
    tokens_per_hour: number[]
    tokens_total: number
    success_rate: number
    success_history: number[]
    avg_wall_ms: number
    wall_history: number[]
  }
  current: {
    concurrent: number
    queued: number
    last_24h_count: number
  }
  drift_warning: boolean
}

export interface AgentInvocation {
  ts: string
  project: string
  phase: string
  task: string
  model: string
  tokens: number
  wall_ms: number
  status: "ok" | "fail"
}

export interface AgentDetailEntry extends AgentRosterEntry {
  persona_md: string | null
  lifetime: {
    tasks_total: number
    tokens_total: number
    success_rate: number
    avg_wall_ms: number
    top_expensive: Array<{
      project: string
      phase: string
      plan: string
      task: string
      tokens: number
      timestamp: string
    }>
  }
  recent_invocations: AgentInvocation[]
}

// === Constants ===

const CACHE_TTL_MS = 30_000
const BUCKET_COUNT = 10
const DAY_MS = 86_400_000
const WINDOW_7D_MS = 7 * DAY_MS
const WINDOW_30D_MS = 30 * DAY_MS
const WINDOW_24H_MS = DAY_MS
const WINDOW_CONCURRENT_MS = 30_000
const BUCKET_MS = WINDOW_7D_MS / BUCKET_COUNT
const HOUR_MS = 3_600_000
const DRIFT_THRESHOLD = 0.85
const DRIFT_MIN_SAMPLES_7D = 5
const DEFAULT_MODEL = "claude-sonnet-4-6"

// === Internal event container ===

interface CollectedEvent {
  project: string
  projectPath: string
  event: Record<string, unknown>
}

// === Defensive event-field readers (mirror cae-home-state.ts conventions) ===

function eventTs(e: Record<string, unknown>): string | undefined {
  if (typeof e.timestamp === "string") return e.timestamp
  if (typeof e.ts === "string") return e.ts
  return undefined
}

function eventAgent(e: Record<string, unknown>): string {
  const a = e.agent
  if (typeof a === "string" && a) return a.toLowerCase()
  return "forge"
}

function eventModel(e: Record<string, unknown>): string | null {
  const m = e.model
  if (typeof m === "string" && m) return m
  return null
}

function eventTokens(e: Record<string, unknown>): number {
  let n = 0
  if (typeof e.inputTokens === "number") n += e.inputTokens
  if (typeof e.outputTokens === "number") n += e.outputTokens
  if (n === 0 && typeof e.tokens === "number") n = e.tokens
  return n
}

function eventWallMs(e: Record<string, unknown>): number | null {
  if (typeof e.wallMs === "number") return e.wallMs
  return null
}

function derivePlanFromPhase(phaseId: string, taskId: string): string {
  // Phase 4 task ids look like "pl01-t1"; older shape embeds plan in phaseId
  // e.g. "04-build-home-rewrite" → no plan. Prefer the "pl{X}" prefix of taskId.
  const m = taskId.match(/^pl[0-9A-Za-z]+/)
  if (m) return m[0]
  const mp = phaseId.match(/-pl([0-9A-Za-z]+)/)
  if (mp) return "pl" + mp[1]
  return ""
}

// === Data collection pass — one call reads every project's jsonl ===

async function collectAllEvents(projects: Project[]): Promise<CollectedEvent[]> {
  const out: CollectedEvent[] = []
  for (const p of projects) {
    const cbPath = join(p.path, ".cae", "metrics", "circuit-breakers.jsonl")
    try {
      const entries = await tailJsonl(cbPath, 5000)
      for (const raw of entries) {
        if (typeof raw !== "object" || raw === null) continue
        out.push({
          project: p.name,
          projectPath: p.path,
          event: raw as Record<string, unknown>,
        })
      }
    } catch (err) {
      console.error("[cae-agents-state] failed reading " + cbPath + ":", err)
    }
  }
  return out
}

// === Per-agent roster entry build ===

function buildRosterEntryForAgent(
  agentName: AgentName,
  events: CollectedEvent[],
  now: number,
): AgentRosterEntry {
  const meta = AGENT_META[agentName]

  // Filter events for this agent
  const mine: CollectedEvent[] = []
  for (const ce of events) {
    if (eventAgent(ce.event) === agentName) mine.push(ce)
  }

  // Pre-extract parsed timestamps for faster window checks
  interface Parsed {
    ce: CollectedEvent
    tsMs: number
    tsStr: string
  }
  const parsed: Parsed[] = []
  for (const ce of mine) {
    const ts = eventTs(ce.event)
    if (!ts) continue
    const tsMs = Date.parse(ts)
    if (Number.isNaN(tsMs)) continue
    parsed.push({ ce, tsMs, tsStr: ts })
  }

  // last_run_days_ago: from the newest event ts regardless of kind
  let lastTsMs: number | null = null
  for (const p of parsed) {
    if (lastTsMs === null || p.tsMs > lastTsMs) lastTsMs = p.tsMs
  }
  const last_run_days_ago =
    lastTsMs === null ? null : Math.floor((now - lastTsMs) / DAY_MS)

  // Sparkline buckets (10 over 7d). Bucket index 0 = oldest, 9 = newest.
  const tokensPerBucket = new Array<number>(BUCKET_COUNT).fill(0)
  const successCountPerBucket = new Array<number>(BUCKET_COUNT).fill(0)
  const completedCountPerBucket = new Array<number>(BUCKET_COUNT).fill(0)
  const wallSumPerBucket = new Array<number>(BUCKET_COUNT).fill(0)
  const wallCountPerBucket = new Array<number>(BUCKET_COUNT).fill(0)

  let tokensTotal7d = 0
  let successCount7d = 0
  let completedCount7d = 0
  let wallSum7d = 0
  let wallCount7d = 0

  let successCount30d = 0
  let completedCount30d = 0

  let last24hCount = 0

  for (const p of parsed) {
    const ageMs = now - p.tsMs
    const ev = p.ce.event
    const kind = typeof ev.event === "string" ? ev.event : ""
    const tok = eventTokens(ev)
    const wall = eventWallMs(ev)
    const isDone = kind === "forge_done"
    const isFail = kind === "forge_fail"
    const isCompleted = isDone || isFail

    if (ageMs >= 0 && ageMs < WINDOW_24H_MS) last24hCount++

    if (ageMs >= 0 && ageMs < WINDOW_30D_MS) {
      if (isCompleted) {
        completedCount30d++
        if (isDone) successCount30d++
      }
    }

    if (ageMs >= 0 && ageMs < WINDOW_7D_MS) {
      // newest bucket (index 9) holds the most recent hour slice
      const rawIdx = Math.floor(ageMs / BUCKET_MS)
      const bucketIdx = Math.max(0, Math.min(BUCKET_COUNT - 1, BUCKET_COUNT - 1 - rawIdx))

      if (tok > 0) {
        tokensPerBucket[bucketIdx] += tok
        tokensTotal7d += tok
      }
      if (isCompleted) {
        completedCountPerBucket[bucketIdx]++
        completedCount7d++
        if (isDone) {
          successCountPerBucket[bucketIdx]++
          successCount7d++
        }
        if (wall !== null) {
          wallSumPerBucket[bucketIdx] += wall
          wallCountPerBucket[bucketIdx] += 1
          wallSum7d += wall
          wallCount7d += 1
        }
      }
    }
  }

  // Convert token buckets to tokens / hour (bucket spans BUCKET_MS)
  const tokens_per_hour = tokensPerBucket.map(
    (sum) => sum / (BUCKET_MS / HOUR_MS),
  )

  const success_history = completedCountPerBucket.map((tot, i) =>
    tot === 0 ? 0 : successCountPerBucket[i] / tot,
  )

  const wall_history = wallCountPerBucket.map((cnt, i) =>
    cnt === 0 ? 0 : wallSumPerBucket[i] / cnt,
  )

  const success_rate_7d =
    completedCount7d === 0 ? 0 : successCount7d / completedCount7d
  const avg_wall_ms_7d = wallCount7d === 0 ? 0 : wallSum7d / wallCount7d
  const success_rate_30d =
    completedCount30d === 0 ? 0 : successCount30d / completedCount30d

  // Drift detection — guard against dormant-waking false positives.
  const drift_warning =
    completedCount7d >= DRIFT_MIN_SAMPLES_7D &&
    success_rate_30d > 0 &&
    success_rate_7d < success_rate_30d * DRIFT_THRESHOLD

  // Concurrency (30s sliding window; forge_start minus matching forge_done/fail)
  const openStarts = new Map<string, number>()
  for (const p of parsed) {
    if (now - p.tsMs > WINDOW_CONCURRENT_MS) continue
    const ev = p.ce.event
    const kind = typeof ev.event === "string" ? ev.event : ""
    const taskId = typeof ev.taskId === "string" ? ev.taskId : "unknown"
    const phaseId = typeof ev.phaseId === "string" ? ev.phaseId : ""
    const key = phaseId + "::" + taskId
    if (kind === "forge_start") {
      openStarts.set(key, (openStarts.get(key) ?? 0) + 1)
    } else if (kind === "forge_done" || kind === "forge_fail") {
      const c = (openStarts.get(key) ?? 0) - 1
      if (c <= 0) openStarts.delete(key)
      else openStarts.set(key, c)
    }
  }
  let concurrent = 0
  for (const c of openStarts.values()) concurrent += c

  // Model resolution — newest event carrying a model wins
  let model = DEFAULT_MODEL
  const sortedDesc = parsed.slice().sort((a, b) => b.tsMs - a.tsMs)
  for (const p of sortedDesc) {
    const m = eventModel(p.ce.event)
    if (m) {
      model = m
      break
    }
  }

  // Group classification
  let group: AgentRosterEntry["group"]
  if (concurrent > 0) group = "active"
  else if (last_run_days_ago !== null && last_run_days_ago <= 7)
    group = "recently_used"
  else group = "dormant"

  return {
    name: agentName,
    label: meta.label,
    founder_label: meta.founder_label,
    emoji: meta.emoji,
    color: meta.color,
    model,
    group,
    last_run_days_ago,
    stats_7d: {
      tokens_per_hour,
      tokens_total: tokensTotal7d,
      success_rate: success_rate_7d,
      success_history,
      avg_wall_ms: avg_wall_ms_7d,
      wall_history,
    },
    current: {
      concurrent,
      queued: 0, // outbox queued wiring deferred per plan §Do NOT list
      last_24h_count: last24hCount,
    },
    drift_warning,
  }
}

// === Cache ===

interface RosterBuild {
  at: number
  roster: AgentRosterEntry[]
  events: CollectedEvent[] // retained for detail pass
}

let cached: RosterBuild | null = null

async function buildRoster(): Promise<RosterBuild> {
  const projects = await listProjects()
  const events = await collectAllEvents(projects)
  const now = Date.now()
  const roster: AgentRosterEntry[] = []
  for (const agentName of Object.keys(AGENT_META) as AgentName[]) {
    roster.push(buildRosterEntryForAgent(agentName, events, now))
  }
  return { at: now, roster, events }
}

async function getCachedBuild(): Promise<RosterBuild> {
  const now = Date.now()
  if (cached && now - cached.at < CACHE_TTL_MS) return cached
  const fresh = await buildRoster()
  cached = fresh
  return fresh
}

// === Public API ===

export async function getAgentsRoster(): Promise<{ agents: AgentRosterEntry[] }> {
  const build = await getCachedBuild()
  return { agents: build.roster }
}

export async function getAgentDetail(
  name: string,
): Promise<AgentDetailEntry | null> {
  const key = name.toLowerCase()
  if (!(key in AGENT_META)) return null
  const agentName = key as AgentName

  const build = await getCachedBuild()
  const roster = build.roster.find((r) => r.name === agentName)
  if (!roster) return null

  // Persona file (null-safe on ENOENT or any read error)
  let persona_md: string | null = null
  try {
    persona_md = await readFile(
      join(CAE_ROOT, "agents", "cae-" + agentName + ".md"),
      "utf8",
    )
  } catch {
    persona_md = null
  }

  // Lifetime pass — iterate full event set (not windowed)
  const mine: Array<{ ce: CollectedEvent; tsMs: number; tsStr: string }> = []
  for (const ce of build.events) {
    if (eventAgent(ce.event) !== agentName) continue
    const ts = eventTs(ce.event)
    if (!ts) continue
    const tsMs = Date.parse(ts)
    if (Number.isNaN(tsMs)) continue
    mine.push({ ce, tsMs, tsStr: ts })
  }

  let tasks_total = 0
  let tokens_total = 0
  let success_count = 0
  let completed_count = 0
  let wall_sum = 0
  let wall_count = 0

  interface CostRow {
    project: string
    phase: string
    plan: string
    task: string
    tokens: number
    timestamp: string
  }
  const costRows: CostRow[] = []

  for (const { ce, tsStr } of mine) {
    const ev = ce.event
    const kind = typeof ev.event === "string" ? ev.event : ""
    const tok = eventTokens(ev)
    const wall = eventWallMs(ev)
    const isDone = kind === "forge_done"
    const isFail = kind === "forge_fail"
    const isCompleted = isDone || isFail

    if (isCompleted) {
      tasks_total++
      completed_count++
      if (isDone) success_count++
      if (wall !== null) {
        wall_sum += wall
        wall_count++
      }
    }
    if (tok > 0) {
      tokens_total += tok
      const phaseId = typeof ev.phaseId === "string" ? ev.phaseId : ""
      const taskId = typeof ev.taskId === "string" ? ev.taskId : ""
      costRows.push({
        project: ce.project,
        phase: phaseId,
        plan: derivePlanFromPhase(phaseId, taskId),
        task: taskId,
        tokens: tok,
        timestamp: tsStr,
      })
    }
  }

  costRows.sort((a, b) => b.tokens - a.tokens)
  const top_expensive = costRows.slice(0, 5)

  const lifetime_success_rate =
    completed_count === 0 ? 0 : success_count / completed_count
  const lifetime_avg_wall_ms = wall_count === 0 ? 0 : wall_sum / wall_count

  // Recent invocations — newest-first, only completed events, max 50
  const completedOnly = mine.filter(({ ce }) => {
    const kind = typeof ce.event.event === "string" ? ce.event.event : ""
    return kind === "forge_done" || kind === "forge_fail"
  })
  completedOnly.sort((a, b) => b.tsMs - a.tsMs)

  const recent_invocations: AgentInvocation[] = completedOnly
    .slice(0, 50)
    .map(({ ce, tsStr }) => {
      const ev = ce.event
      const kind = typeof ev.event === "string" ? ev.event : ""
      const phaseId = typeof ev.phaseId === "string" ? ev.phaseId : ""
      const taskId = typeof ev.taskId === "string" ? ev.taskId : ""
      const wall = eventWallMs(ev) ?? 0
      return {
        ts: tsStr,
        project: ce.project,
        phase: phaseId,
        task: taskId,
        model: eventModel(ev) ?? roster.model,
        tokens: eventTokens(ev),
        wall_ms: wall,
        status: kind === "forge_done" ? "ok" : "fail",
      }
    })

  // Satisfy ts6133 on the agentMetaFor fallback import (used defensively if an
  // unknown agent ever slips into callers — plan mandates its presence).
  void agentMetaFor

  return {
    ...roster,
    persona_md,
    lifetime: {
      tasks_total,
      tokens_total,
      success_rate: lifetime_success_rate,
      avg_wall_ms: lifetime_avg_wall_ms,
      top_expensive,
    },
    recent_invocations,
  }
}
