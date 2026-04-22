import { readdir, readFile, stat } from "fs/promises"
import { exec } from "child_process"
import { promisify } from "util"
import { basename, join } from "path"
import { listPhases, listProjects, tailJsonl, listOutbox } from "./cae-state"
import { getPhaseDetail, type TaskStatus } from "./cae-phase-detail"
import { OUTBOX_ROOT } from "./cae-config"
import { agentMetaFor } from "./copy/agent-meta"
import type { Project } from "./cae-types"

const execAsync = promisify(exec)

// === Types ===
export interface Rollup {
  shipped_today: number
  tokens_today: number
  in_flight: number
  blocked: number
  warnings: number
}

export interface AgentActive {
  name: string
  concurrent: number
}

export interface PhaseSummary {
  project: string
  projectName: string
  phase: string
  phaseNumber: number
  wave_current: number
  wave_total: number
  progress_pct: number
  eta_min: number | null
  tokens_phase: number
  agents_active: AgentActive[]
}

export interface RecentEvent {
  ts: string
  project: string
  projectName: string
  phase: string
  plan: string
  status: "shipped" | "aborted"
  commits: number
  agent: string
  model: string
  tokens: number
}

export interface NeedsYouItem {
  type: "blocked" | "dangerous" | "plan_review"
  project: string
  projectName: string
  phase?: string
  task?: string
  summary: string
  actions: Array<{ label: string; href: string }>
}

export interface HomeState {
  rollup: Rollup
  phases: PhaseSummary[]
  events_recent: RecentEvent[]
  needs_you: NeedsYouItem[]
  live_ops_line: string
}

// === TaskStatus literals — SOURCE OF TRUTH is lib/cae-phase-detail.ts ===
// Verified via grep: "pending" | "running" | "merged" | "failed"
// If cae-phase-detail.ts TaskStatus changes, TypeScript will fail compilation here.
const STATUS_RUNNING: TaskStatus = "running"
const STATUS_MERGED: TaskStatus = "merged"
const STATUS_FAILED: TaskStatus = "failed"

// === Founder-label source of truth: lib/copy/agent-meta.ts (Plan 04-06 consolidation) ===
// The previously-inline FOUNDER_LABEL map was removed in Plan 04-06 after Plan 04-02's
// agent-meta.ts shipped in wave 1. Lookups now go through agentMetaFor(name).founder_label
// which returns the raw name for unknown agents (equivalent to the prior `?? agent.name`).

// === 1-second result cache to survive 3s polling without FS thrash ===
let CACHE: { ts: number; value: HomeState } | null = null
const CACHE_TTL_MS = 1000

// === Utility helpers ===
function toProjectName(projectPath: string): string {
  return basename(projectPath.replace(/\/+$/, ""))
}

function phaseNumberFromDir(phaseDir: string): number {
  const m = phaseDir.match(/^(\d+)-/)
  return m ? parseInt(m[1], 10) : 0
}

function todayPrefix(): string {
  return new Date().toISOString().slice(0, 10)
}

function msPerDay(): number {
  return 24 * 60 * 60 * 1000
}

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

function eventTs(e: Record<string, unknown>): string | undefined {
  if (typeof e.timestamp === "string") return e.timestamp
  if (typeof e.ts === "string") return e.ts
  return undefined
}

function eventAgent(e: Record<string, unknown>): string {
  const a = e.agent
  if (typeof a === "string" && a) return a
  return "forge"
}

function eventModel(e: Record<string, unknown>): string {
  const m = e.model
  if (typeof m === "string" && m) return m
  return "sonnet"
}

function eventTokens(e: Record<string, unknown>): number {
  let n = 0
  if (typeof e.inputTokens === "number") n += e.inputTokens
  if (typeof e.outputTokens === "number") n += e.outputTokens
  if (typeof e.tokens === "number" && n === 0) n = e.tokens
  return n
}

// Parse a plan id string like "pl03-t1" / "p4-pl03-t1" / "04-01" → keep as-is for display
function formatPlanId(phaseNumber: number, taskId: string): string {
  // taskId shape in cae-phase-detail is `pl{letter}-t{n}` (e.g., "pl01-t1")
  // Compose `p{N}-{taskId}` as canonical identifier
  return `p${phaseNumber}-${taskId}`
}

// === Rollup ===
async function buildRollup(
  projects: Project[],
  phases: PhaseSummary[],
  needsYou: NeedsYouItem[],
): Promise<Rollup> {
  const today = todayPrefix()
  let shipped_today = 0
  let tokens_today = 0
  let warnings = 0

  // shipped_today from outbox DONE.md with status=success today
  try {
    const outbox = await listOutbox()
    for (const o of outbox) {
      if (!o.hasDone || o.status !== "success") continue
      const donePath = join(OUTBOX_ROOT, o.taskId, "DONE.md")
      try {
        const st = await stat(donePath)
        if (st.mtime.toISOString().slice(0, 10) === today) shipped_today++
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }

  // Fallback: count merged forge/* commits today if outbox gave zero
  if (shipped_today === 0) {
    for (const p of projects) {
      try {
        const { stdout } = await execAsync(
          `git log --merges --since="${today} 00:00" --until="${today} 23:59" --oneline | grep -c "forge/" || true`,
          { cwd: p.path },
        )
        const n = parseInt(stdout.trim(), 10)
        if (!Number.isNaN(n)) shipped_today += n
      } catch {
        // ignore
      }
    }
  }

  // tokens_today + warnings across all projects' circuit-breakers.jsonl
  const nowMs = Date.now()
  for (const p of projects) {
    const cbPath = join(p.path, ".cae", "metrics", "circuit-breakers.jsonl")
    const entries = await tailJsonl(cbPath, 500)
    for (const raw of entries) {
      if (typeof raw !== "object" || raw === null) continue
      const e = raw as Record<string, unknown>
      const ts = eventTs(e)
      if (!ts) continue
      if (ts.startsWith(today)) {
        if (typeof e.inputTokens === "number") tokens_today += e.inputTokens
        if (typeof e.outputTokens === "number") tokens_today += e.outputTokens
      }
      if (e.event === "phantom_escalation") {
        const tsMs = Date.parse(ts)
        if (!Number.isNaN(tsMs) && nowMs - tsMs <= msPerDay()) warnings++
      }
    }
  }

  const in_flight = phases.filter(
    (ph) => ph.progress_pct > 0 && ph.progress_pct < 100,
  ).length
  const blocked = needsYou.filter((n) => n.type === "blocked").length

  return { shipped_today, tokens_today, in_flight, blocked, warnings }
}

// === Phases ===
async function getWaveTotal(projectPath: string, phaseName: string): Promise<number> {
  const phaseDir = join(projectPath, ".planning", "phases", phaseName)
  let waveTotal = 1
  try {
    const children = await readdir(phaseDir)
    for (const f of children) {
      if (!f.endsWith("-PLAN.md")) continue
      const content = await readFile(join(phaseDir, f), "utf8").catch(() => "")
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
      if (!fmMatch) continue
      const waveMatch = fmMatch[1].match(/^wave:\s*(\d+)/m)
      if (waveMatch) {
        const n = parseInt(waveMatch[1], 10)
        if (n > waveTotal) waveTotal = n
      }
    }
  } catch {
    // default 1
  }
  return waveTotal
}

async function computeAgentsActiveForPhase(
  projectPath: string,
  phaseName: string,
): Promise<AgentActive[]> {
  const cbPath = join(projectPath, ".cae", "metrics", "circuit-breakers.jsonl")
  const entries = await tailJsonl(cbPath, 500)
  const nowMs = Date.now()
  const windowMs = 30_000

  // Track active forge_start events (no matching forge_done/fail) in the last 30s window
  // keyed by (taskId, agent)
  const openStarts = new Map<string, { agent: string; count: number }>()

  for (const raw of entries) {
    if (typeof raw !== "object" || raw === null) continue
    const e = raw as Record<string, unknown>
    if (e.phaseId !== phaseName) continue
    const ts = eventTs(e)
    if (!ts) continue
    const tsMs = Date.parse(ts)
    if (Number.isNaN(tsMs)) continue
    if (nowMs - tsMs > windowMs) continue

    const taskId = typeof e.taskId === "string" ? e.taskId : "unknown"
    const agent = eventAgent(e)
    const key = `${agent}::${taskId}`

    if (e.event === "forge_start") {
      const existing = openStarts.get(key)
      if (existing) existing.count++
      else openStarts.set(key, { agent, count: 1 })
    } else if (e.event === "forge_done" || e.event === "forge_fail") {
      const existing = openStarts.get(key)
      if (existing) {
        existing.count--
        if (existing.count <= 0) openStarts.delete(key)
      }
    }
  }

  const agg = new Map<string, number>()
  for (const { agent, count } of openStarts.values()) {
    agg.set(agent, (agg.get(agent) ?? 0) + count)
  }

  return Array.from(agg.entries()).map(([name, concurrent]) => ({ name, concurrent }))
}

async function tokensForPhase(projectPath: string, phaseName: string): Promise<number> {
  const cbPath = join(projectPath, ".cae", "metrics", "circuit-breakers.jsonl")
  const entries = await tailJsonl(cbPath, 1000)
  let tokens = 0
  for (const raw of entries) {
    if (typeof raw !== "object" || raw === null) continue
    const e = raw as Record<string, unknown>
    if (e.phaseId !== phaseName) continue
    if (typeof e.inputTokens === "number") tokens += e.inputTokens
    if (typeof e.outputTokens === "number") tokens += e.outputTokens
  }
  return tokens
}

// ETA heuristic (documented in SUMMARY): use prior phase completion time average * (remaining_waves / wave_total).
// If no prior phase history for project, return null.
async function estimateEtaMin(
  projectPath: string,
  phaseName: string,
  waveCurrent: number,
  waveTotal: number,
): Promise<number | null> {
  try {
    const phasesDir = join(projectPath, ".planning", "phases")
    if (!(await exists(phasesDir))) return null
    const entries = await readdir(phasesDir, { withFileTypes: true })
    const priorDurations: number[] = []
    for (const e of entries) {
      if (!e.isDirectory()) continue
      if (e.name === phaseName) continue
      const summaryPath = join(phasesDir, e.name, "CAE-SUMMARY.md")
      if (!(await exists(summaryPath))) continue
      try {
        const phaseDirStat = await stat(join(phasesDir, e.name))
        const summaryStat = await stat(summaryPath)
        const durMs = summaryStat.mtimeMs - phaseDirStat.birthtimeMs
        if (durMs > 0) priorDurations.push(durMs / 60_000)
      } catch {
        // ignore
      }
    }
    if (priorDurations.length === 0) return null
    const avg = priorDurations.reduce((a, b) => a + b, 0) / priorDurations.length
    const remaining = Math.max(0, waveTotal - waveCurrent)
    if (waveTotal <= 0) return null
    return Math.round((avg * remaining) / waveTotal)
  } catch {
    return null
  }
}

async function buildPhases(projects: Project[]): Promise<PhaseSummary[]> {
  const out: PhaseSummary[] = []
  for (const p of projects) {
    if (!p.hasPlanning) continue
    const phases = await listPhases(p.path)
    for (const ph of phases) {
      if (ph.status !== "active") continue
      const phaseDirName = `${String(ph.number).padStart(2, "0")}-${ph.name}`
      const detail = await getPhaseDetail(p.path, ph.number)

      const tasksTotal = detail.tasks.length
      const merged = detail.tasks.filter((t) => t.status === STATUS_MERGED).length
      const progress_pct =
        tasksTotal === 0 ? 0 : Math.round((merged / tasksTotal) * 100)

      // wave_current: highest wave with a running task; else highest wave with all tasks merged + 1
      let waveCurrent = 0
      const runningWaves = detail.tasks
        .filter((t) => t.status === STATUS_RUNNING)
        .map((t) => t.wave)
      if (runningWaves.length > 0) {
        waveCurrent = Math.max(...runningWaves)
      } else {
        // highest wave index with ALL tasks merged → +1
        const waveBuckets = new Map<number, TaskStatus[]>()
        for (const t of detail.tasks) {
          if (!waveBuckets.has(t.wave)) waveBuckets.set(t.wave, [])
          waveBuckets.get(t.wave)!.push(t.status)
        }
        let maxCompletedWave = 0
        for (const [wave, statuses] of waveBuckets.entries()) {
          if (statuses.length > 0 && statuses.every((s) => s === STATUS_MERGED)) {
            if (wave > maxCompletedWave) maxCompletedWave = wave
          }
        }
        waveCurrent = maxCompletedWave + 1
      }

      const waveTotal = await getWaveTotal(p.path, phaseDirName)
      if (waveCurrent > waveTotal) waveCurrent = waveTotal
      if (waveCurrent < 1) waveCurrent = 1

      const agents_active = await computeAgentsActiveForPhase(p.path, phaseDirName)
      const tokens_phase = await tokensForPhase(p.path, phaseDirName)
      const eta_min = await estimateEtaMin(p.path, phaseDirName, waveCurrent, waveTotal)

      out.push({
        project: p.path,
        projectName: toProjectName(p.path),
        phase: phaseDirName,
        phaseNumber: ph.number,
        wave_current: waveCurrent,
        wave_total: waveTotal,
        progress_pct,
        eta_min,
        tokens_phase,
        agents_active,
      })
    }
  }
  return out
}

// === Recent events ===
async function buildEventsRecent(projects: Project[]): Promise<RecentEvent[]> {
  const out: RecentEvent[] = []
  for (const p of projects) {
    const cbPath = join(p.path, ".cae", "metrics", "circuit-breakers.jsonl")
    const entries = await tailJsonl(cbPath, 500)
    for (const raw of entries) {
      if (typeof raw !== "object" || raw === null) continue
      const e = raw as Record<string, unknown>
      if (e.event !== "forge_done" && e.event !== "forge_fail") continue
      const ts = eventTs(e)
      if (!ts) continue
      const phaseId = typeof e.phaseId === "string" ? e.phaseId : ""
      const phaseNumber = phaseNumberFromDir(phaseId)
      const taskId = typeof e.taskId === "string" ? e.taskId : ""
      const planId =
        phaseNumber > 0 && taskId ? formatPlanId(phaseNumber, taskId) : taskId

      out.push({
        ts,
        project: p.path,
        projectName: toProjectName(p.path),
        phase: phaseId,
        plan: planId,
        status: e.event === "forge_done" ? "shipped" : "aborted",
        commits: 0, // v1: not in event payload; real count requires git log per branch
        agent: eventAgent(e),
        model: eventModel(e),
        tokens: eventTokens(e),
      })
    }
  }
  out.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0))
  return out.slice(0, 20)
}

// === Needs you ===
async function buildNeedsYou(projects: Project[]): Promise<NeedsYouItem[]> {
  const out: NeedsYouItem[] = []
  const nowMs = Date.now()
  const windowMs = msPerDay()

  for (const p of projects) {
    if (!p.hasPlanning) continue
    const projectName = toProjectName(p.path)

    // blocked: tasks with recentFailures >= 3 in last 24h OR status === failed
    const cbPath = join(p.path, ".cae", "metrics", "circuit-breakers.jsonl")
    const entries = await tailJsonl(cbPath, 500)
    const failCounts = new Map<string, { phaseId: string; count: number }>()
    for (const raw of entries) {
      if (typeof raw !== "object" || raw === null) continue
      const e = raw as Record<string, unknown>
      if (e.event !== "forge_fail") continue
      const ts = eventTs(e)
      if (!ts) continue
      const tsMs = Date.parse(ts)
      if (Number.isNaN(tsMs) || nowMs - tsMs > windowMs) continue
      const taskId = typeof e.taskId === "string" ? e.taskId : ""
      const phaseId = typeof e.phaseId === "string" ? e.phaseId : ""
      if (!taskId) continue
      const cur = failCounts.get(taskId)
      if (cur) cur.count++
      else failCounts.set(taskId, { phaseId, count: 1 })
    }

    for (const [taskId, { phaseId, count }] of failCounts.entries()) {
      if (count < 3) continue
      const phaseNum = phaseNumberFromDir(phaseId)
      const href = `/build?project=${encodeURIComponent(
        p.path,
      )}&sheet=open&phase=${phaseNum}&plan=${encodeURIComponent(
        taskId,
      )}&task=${encodeURIComponent(taskId)}`
      out.push({
        type: "blocked",
        project: p.path,
        projectName,
        phase: phaseId,
        task: taskId,
        summary: `Sentinel rejected ${count}×`,
        actions: [{ label: "Review", href }],
      })
    }

    // Also: add blocked for any task currently in FAILED status across active phases
    const phases = await listPhases(p.path)
    for (const ph of phases) {
      if (ph.status !== "active") continue
      const phaseDirName = `${String(ph.number).padStart(2, "0")}-${ph.name}`
      const detail = await getPhaseDetail(p.path, ph.number)
      for (const t of detail.tasks) {
        if (t.status !== STATUS_FAILED) continue
        // avoid duplicate if already added from recentFailures
        if (out.some((n) => n.task === t.taskId && n.project === p.path)) continue
        const href = `/build?project=${encodeURIComponent(
          p.path,
        )}&sheet=open&phase=${ph.number}&plan=${encodeURIComponent(
          t.taskId,
        )}&task=${encodeURIComponent(t.taskId)}`
        out.push({
          type: "blocked",
          project: p.path,
          projectName,
          phase: phaseDirName,
          task: t.taskId,
          summary: `Task ${t.taskId} failed`,
          actions: [{ label: "Review", href }],
        })
      }
    }

    // plan_review: any .planning/phases/*-REVIEW-READY.md marker
    const phasesDir = join(p.path, ".planning", "phases")
    if (await exists(phasesDir)) {
      try {
        const kids = await readdir(phasesDir)
        for (const k of kids) {
          if (!k.endsWith("-REVIEW-READY.md")) continue
          out.push({
            type: "plan_review",
            project: p.path,
            projectName,
            summary: `Plan review ready: ${k}`,
            actions: [
              {
                label: "Open Plan",
                href: `/plan?project=${encodeURIComponent(p.path)}`,
              },
            ],
          })
        }
      } catch {
        // ignore
      }
    }
  }

  // dangerous: outbox entries with pending APPROVAL.md and no DONE.md
  try {
    if (await exists(OUTBOX_ROOT)) {
      const taskDirs = await readdir(OUTBOX_ROOT, { withFileTypes: true })
      for (const td of taskDirs) {
        if (!td.isDirectory()) continue
        const taskPath = join(OUTBOX_ROOT, td.name)
        const approvalPath = join(taskPath, "APPROVAL.md")
        const donePath = join(taskPath, "DONE.md")
        if ((await exists(approvalPath)) && !(await exists(donePath))) {
          out.push({
            type: "dangerous",
            project: OUTBOX_ROOT,
            projectName: "outbox",
            task: td.name,
            summary: `Dangerous action pending approval (${td.name})`,
            actions: [
              {
                label: "Approve",
                href: `/build?approval=${encodeURIComponent(td.name)}&decision=approve`,
              },
              {
                label: "Deny",
                href: `/build?approval=${encodeURIComponent(td.name)}&decision=deny`,
              },
            ],
          })
        }
      }
    }
  } catch {
    // ignore
  }

  return out
}

// === Live Ops line ===
function composeLiveOpsLine(activeAgents: AgentActive[], taskLabels: Map<string, string>): string {
  if (activeAgents.length === 0) return "Idle right now."

  const labelFor = (name: string): string =>
    agentMetaFor(name).founder_label

  const lines: string[] = []
  const shown = activeAgents.slice(0, 3)
  for (const a of shown) {
    const task = taskLabels.get(a.name) ?? "idle"
    lines.push(`${labelFor(a.name)} is on ${task}.`)
  }
  let result = `Right now: ${lines.join(" ")}`

  const remaining = activeAgents.length - shown.length
  if (remaining > 0) result += ` +${remaining} more idle`

  return result.trim()
}

// Build global active agent map across projects (30s window), with sample task labels for live ops line.
async function buildGlobalActiveAgents(
  projects: Project[],
): Promise<{ agents: AgentActive[]; taskLabels: Map<string, string> }> {
  const nowMs = Date.now()
  const windowMs = 30_000
  const openStarts = new Map<string, { agent: string; taskId: string; count: number }>()

  for (const p of projects) {
    const cbPath = join(p.path, ".cae", "metrics", "circuit-breakers.jsonl")
    const entries = await tailJsonl(cbPath, 500)
    for (const raw of entries) {
      if (typeof raw !== "object" || raw === null) continue
      const e = raw as Record<string, unknown>
      const ts = eventTs(e)
      if (!ts) continue
      const tsMs = Date.parse(ts)
      if (Number.isNaN(tsMs) || nowMs - tsMs > windowMs) continue

      const taskId = typeof e.taskId === "string" ? e.taskId : "unknown"
      const phaseId = typeof e.phaseId === "string" ? e.phaseId : ""
      const agent = eventAgent(e)
      const key = `${agent}::${phaseId}::${taskId}`

      if (e.event === "forge_start") {
        const existing = openStarts.get(key)
        if (existing) existing.count++
        else openStarts.set(key, { agent, taskId, count: 1 })
      } else if (e.event === "forge_done" || e.event === "forge_fail") {
        const existing = openStarts.get(key)
        if (existing) {
          existing.count--
          if (existing.count <= 0) openStarts.delete(key)
        }
      }
    }
  }

  const agg = new Map<string, number>()
  const taskLabels = new Map<string, string>()
  for (const { agent, taskId } of openStarts.values()) {
    agg.set(agent, (agg.get(agent) ?? 0) + 1)
    if (!taskLabels.has(agent)) taskLabels.set(agent, taskId)
  }
  const agents: AgentActive[] = Array.from(agg.entries()).map(([name, concurrent]) => ({
    name,
    concurrent,
  }))

  return { agents, taskLabels }
}

// === Main aggregator ===
export async function getHomeState(): Promise<HomeState> {
  const now = Date.now()
  if (CACHE && now - CACHE.ts < CACHE_TTL_MS) return CACHE.value

  const projects = await listProjects()

  const [phases, events_recent, { agents: activeAgents, taskLabels }] = await Promise.all([
    buildPhases(projects),
    buildEventsRecent(projects),
    buildGlobalActiveAgents(projects),
  ])

  const needs_you = await buildNeedsYou(projects)
  const rollup = await buildRollup(projects, phases, needs_you)
  const live_ops_line = composeLiveOpsLine(activeAgents, taskLabels)

  const value: HomeState = {
    rollup,
    phases,
    events_recent,
    needs_you,
    live_ops_line,
  }

  CACHE = { ts: now, value }
  return value
}
