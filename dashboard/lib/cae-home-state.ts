import { readdir, readFile, stat } from "fs/promises"
import { exec } from "child_process"
import { promisify } from "util"
import { basename, join } from "path"
import { listPhases, listProjects, tailJsonl, listOutbox } from "./cae-state"
import { getPhaseDetail, type TaskStatus } from "./cae-phase-detail"
import { OUTBOX_ROOT } from "./cae-config"
import { agentMetaFor } from "./copy/agent-meta"
import { log } from "./log"
import type { Project, CbEvent } from "./cae-types"

const execAsync = promisify(exec)
const lHome = log("cae-home-state")

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
const CACHE_TTL_MS = 5000

/**
 * Test-only: drop the in-memory cache so consecutive getHomeState() calls
 * with different mocked state in the same Vitest module don't read a stale
 * value. Not exported via the route — production code has no reason to
 * bypass the 1s TTL.
 */
export function __resetHomeStateCacheForTests(): void {
  CACHE = null
}

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

/**
 * Local-midnight boundaries for "today" in the server's local timezone.
 * Session-14 fix: activity.jsonl timestamps are +09:00 (JST). Using UTC-day
 * via todayPrefix().startsWith() dropped JST-today commits whenever the
 * current server UTC day lagged the JST day. Compare in ms-since-epoch
 * against local-midnight bounds instead.
 */
function todayBoundsMs(): { start: number; end: number } {
  const now = new Date()
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0, 0, 0, 0,
  ).getTime()
  return { start, end: start + 24 * 60 * 60 * 1000 }
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

// === Event-field readers — Phase 7 Wave 0 (D-02) snake_case repoint ===
// Ground truth: bin/circuit_breakers.py _log() emits { ts, event, ...fields }
// with snake_case everywhere. Aggregators MUST NOT read camelCase fields.

function eventTs(e: CbEvent | Record<string, unknown>): string | undefined {
  if (typeof e.ts === "string") return e.ts
  return undefined
}

function eventAgent(e: CbEvent | Record<string, unknown>): string {
  const a = (e as CbEvent).agent
  if (typeof a === "string" && a) return a
  return "forge"
}

function eventModel(e: CbEvent | Record<string, unknown>): string {
  const m = (e as CbEvent).model
  if (typeof m === "string" && m) return m
  return "sonnet"
}

function eventTaskId(e: CbEvent | Record<string, unknown>): string {
  const t = (e as CbEvent).task_id
  if (typeof t === "string" && t) return t
  return ""
}

// Phase id derivation from task_id — real jsonl has no phaseId field.
// Task ids shape like "p2-plA-t1-b12bb5" → phase prefix = "p2".
function eventPhasePrefix(e: CbEvent | Record<string, unknown>): string {
  const tid = eventTaskId(e)
  if (!tid) return ""
  const m = tid.match(/^p(\d+)-/)
  return m ? `p${m[1]}` : ""
}

function eventTokens(e: CbEvent | Record<string, unknown>): number {
  let n = 0
  const cb = e as CbEvent
  if (typeof cb.input_tokens === "number") n += cb.input_tokens
  if (typeof cb.output_tokens === "number") n += cb.output_tokens
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
  const { start: todayStartMs, end: todayEndMs } = todayBoundsMs()
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
        const mtimeMs = st.mtime.getTime()
        if (mtimeMs >= todayStartMs && mtimeMs < todayEndMs) shipped_today++
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }

  // Class 20C (data-feed recovery): count canonical activity.jsonl
  // `type:"commit"` rows for today. Session-14 fix: compare parsed ts_ms
  // against local-midnight bounds instead of UTC-prefix match, so JST
  // (+09:00) timestamps don't get dropped when server UTC day lags local.
  const countedShaToday = new Set<string>()
  for (const p of projects) {
    const actPath = join(p.path, ".cae", "metrics", "activity.jsonl")
    const rows = await tailJsonl(actPath, 2000)
    for (const raw of rows) {
      if (typeof raw !== "object" || raw === null) continue
      const r = raw as Record<string, unknown>
      if (r.type !== "commit") continue
      const ts = typeof r.ts === "string" ? r.ts : null
      if (!ts) continue
      const tsMs = Date.parse(ts)
      if (Number.isNaN(tsMs) || tsMs < todayStartMs || tsMs >= todayEndMs) continue
      const meta = r.meta as Record<string, unknown> | undefined
      const sha =
        meta && typeof meta.sha === "string"
          ? meta.sha
          : meta && typeof meta.short_sha === "string"
            ? meta.short_sha
            : `${p.path}:${ts}`
      countedShaToday.add(sha as string)
    }
  }
  shipped_today += countedShaToday.size

  // Legacy fallback: count merged forge/* commits today only when neither
  // outbox nor activity produced any hits. Kept for forward-compat with a
  // future Shift flow that actually merges from forge branches.
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

  // tokens_today + warnings across all projects' circuit-breakers.jsonl.
  // Tokens come from snake_case input_tokens/output_tokens fields (on
  // token_usage events but any event carrying them is summed).
  // Session-14 fix: parse ts→ms and compare against todayStartMs/EndMs
  // instead of UTC-prefix string match, so JST timestamps aren't dropped.
  const nowMs = Date.now()
  for (const p of projects) {
    const cbPath = join(p.path, ".cae", "metrics", "circuit-breakers.jsonl")
    const entries = await tailJsonl(cbPath, 500)
    for (const raw of entries) {
      if (typeof raw !== "object" || raw === null) continue
      const e = raw as CbEvent
      const ts = eventTs(e)
      if (!ts) continue
      const tsMs = Date.parse(ts)
      if (!Number.isNaN(tsMs) && tsMs >= todayStartMs && tsMs < todayEndMs) {
        if (typeof e.input_tokens === "number") tokens_today += e.input_tokens
        if (typeof e.output_tokens === "number") tokens_today += e.output_tokens
      }
      // Phase 7 Wave 0 (D-02): real event name is escalate-to-phantom.
      if (e.event === "escalate_to_phantom") {
        if (!Number.isNaN(tsMs) && nowMs - tsMs <= msPerDay()) warnings++
      }
    }
  }

  // in_flight: a phase is live if progress is strictly between 0 and 100
  // OR if any agent is currently running on it (per circuit-breaker
  // forge_begin/forge_end window in agents_active). Session-14 fix: the
  // old filter missed phases where progress_pct rounds to 0 or 100 while
  // agents are actively mid-wave.
  const in_flight = phases.filter((ph) => {
    if (ph.progress_pct > 0 && ph.progress_pct < 100) return true
    const activeConcurrent = ph.agents_active.reduce(
      (acc, a) => acc + Math.max(0, a.concurrent),
      0,
    )
    return activeConcurrent > 0
  }).length
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

  // Phase 7 Wave 0 (D-02): real schema has no `phaseId` field. Derive phase
  // tag from task_id prefix (e.g. "p2-plA-t1-b12bb5" → "p2"). Match against
  // the phaseName's leading digits.
  const pm = phaseName.match(/^(\d+)-/)
  const phasePrefix = pm ? `p${parseInt(pm[1], 10)}` : ""

  // Track active forge_begin events (no matching forge_end) in the last 30s
  // window keyed by (agent, task_id).
  const openStarts = new Map<string, { agent: string; count: number }>()

  for (const raw of entries) {
    if (typeof raw !== "object" || raw === null) continue
    const e = raw as CbEvent
    if (phasePrefix && eventPhasePrefix(e) !== phasePrefix) continue
    const ts = eventTs(e)
    if (!ts) continue
    const tsMs = Date.parse(ts)
    if (Number.isNaN(tsMs)) continue
    if (nowMs - tsMs > windowMs) continue

    const taskId = eventTaskId(e) || "unknown"
    const agent = eventAgent(e)
    const key = `${agent}::${taskId}`

    if (e.event === "forge_begin") {
      const existing = openStarts.get(key)
      if (existing) existing.count++
      else openStarts.set(key, { agent, count: 1 })
    } else if (e.event === "forge_end") {
      // forge_end subsumes old completion events via its success bool.
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
  // Phase 7 Wave 0 (D-02): phaseId field doesn't exist. Derive phase tag
  // "pN" from phaseName's leading digits and match task_id prefix.
  const cbPath = join(projectPath, ".cae", "metrics", "circuit-breakers.jsonl")
  const entries = await tailJsonl(cbPath, 1000)
  const pm = phaseName.match(/^(\d+)-/)
  const phasePrefix = pm ? `p${parseInt(pm[1], 10)}` : ""
  let tokens = 0
  for (const raw of entries) {
    if (typeof raw !== "object" || raw === null) continue
    const e = raw as CbEvent
    if (phasePrefix && eventPhasePrefix(e) !== phasePrefix) continue
    if (typeof e.input_tokens === "number") tokens += e.input_tokens
    if (typeof e.output_tokens === "number") tokens += e.output_tokens
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
      // Session-14 fix: the old filter required status === "active", which
      // dropped every phase in this repo (all were "idle" despite real work
      // happening inside them) → /build "home_phases" always came back
      // empty. Include any phase that isn't explicitly archived, so the
      // home feed reflects the full slate of live + recently-worked phases.
      // Failed phases are kept so Eric can see the red state immediately.
      if (ph.status === "archived") continue
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
      const e = raw as CbEvent
      // Phase 7 Wave 0 (D-02): the old two-event completion shape collapsed
      // into one forge_end event carrying a `success` bool. Shipped = true,
      // aborted = false.
      if (e.event !== "forge_end") continue
      const ts = eventTs(e)
      if (!ts) continue
      // Real schema has no phaseId — derive from task_id prefix ("p2-..."→2).
      const taskId = eventTaskId(e)
      const phasePrefix = eventPhasePrefix(e)
      const phaseNumberMatch = phasePrefix.match(/^p(\d+)$/)
      const phaseNumber = phaseNumberMatch ? parseInt(phaseNumberMatch[1], 10) : 0
      const phaseLabel = phasePrefix
      const planId =
        phaseNumber > 0 && taskId ? formatPlanId(phaseNumber, taskId) : taskId

      out.push({
        ts,
        project: p.path,
        projectName: toProjectName(p.path),
        phase: phaseLabel,
        plan: planId,
        status: e.success === true ? "shipped" : "aborted",
        commits: 0, // v1: not in event payload; real count requires git log per branch
        agent: eventAgent(e),
        model: eventModel(e),
        tokens: eventTokens(e),
      })
    }
  }

  // Class 20D (data-feed recovery): union real git commits from activity.jsonl.
  // Outbox + forge_end feed are mostly-empty on this repo; the RecentLedger
  // was showing fixture data from last session's test run. Surfacing real
  // commits means the card reflects actual shipped work.
  for (const p of projects) {
    const actPath = join(p.path, ".cae", "metrics", "activity.jsonl")
    const rows = await tailJsonl(actPath, 500)
    for (const raw of rows) {
      if (typeof raw !== "object" || raw === null) continue
      const r = raw as Record<string, unknown>
      if (r.type !== "commit") continue
      const ts = typeof r.ts === "string" ? r.ts : null
      if (!ts) continue
      const meta = (r.meta as Record<string, unknown> | undefined) ?? {}
      const shortSha = typeof meta.short_sha === "string" ? meta.short_sha : null
      const subject = typeof meta.subject === "string" ? meta.subject : null
      const actorRaw = typeof r.actor === "string" ? r.actor : null
      const summary = typeof r.summary === "string" ? r.summary : null
      // Plan id = short sha + subject gist so RecentLedger rows are human-
      // readable in the ledger's middle column.
      const planId = shortSha
        ? subject
          ? `${shortSha} ${subject}`
          : shortSha
        : summary ?? "commit"
      out.push({
        ts,
        project: p.path,
        projectName: toProjectName(p.path),
        phase: "",
        plan: planId,
        status: "shipped",
        commits: 1,
        agent: actorRaw ?? "git",
        model: "",
        tokens: 0,
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

    // blocked: tasks with 3+ failed attempts in last 24h OR status === failed.
    // Phase 7 Wave 0 (D-02): failure is now forge_end with success:false.
    // Phase tag derived from task_id prefix since jsonl has no phaseId field.
    const cbPath = join(p.path, ".cae", "metrics", "circuit-breakers.jsonl")
    const entries = await tailJsonl(cbPath, 500)
    const failCounts = new Map<string, { phaseTag: string; count: number }>()
    for (const raw of entries) {
      if (typeof raw !== "object" || raw === null) continue
      const e = raw as CbEvent
      if (e.event !== "forge_end" || e.success !== false) continue
      const ts = eventTs(e)
      if (!ts) continue
      const tsMs = Date.parse(ts)
      if (Number.isNaN(tsMs) || nowMs - tsMs > windowMs) continue
      const taskId = eventTaskId(e)
      const phaseTag = eventPhasePrefix(e)
      if (!taskId) continue
      const cur = failCounts.get(taskId)
      if (cur) cur.count++
      else failCounts.set(taskId, { phaseTag, count: 1 })
    }

    for (const [taskId, { phaseTag, count }] of failCounts.entries()) {
      if (count < 3) continue
      const phaseNumMatch = phaseTag.match(/^p(\d+)$/)
      const phaseNum = phaseNumMatch ? parseInt(phaseNumMatch[1], 10) : 0
      const href = `/build?project=${encodeURIComponent(
        p.path,
      )}&sheet=open&phase=${phaseNum}&plan=${encodeURIComponent(
        taskId,
      )}&task=${encodeURIComponent(taskId)}`
      out.push({
        type: "blocked",
        project: p.path,
        projectName,
        phase: phaseTag,
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
      const e = raw as CbEvent
      const ts = eventTs(e)
      if (!ts) continue
      const tsMs = Date.parse(ts)
      if (Number.isNaN(tsMs) || nowMs - tsMs > windowMs) continue

      // Phase 7 Wave 0 (D-02): no phaseId — derive tag from task_id prefix.
      const taskId = eventTaskId(e) || "unknown"
      const phaseTag = eventPhasePrefix(e)
      const agent = eventAgent(e)
      const key = `${agent}::${phaseTag}::${taskId}`

      if (e.event === "forge_begin") {
        const existing = openStarts.get(key)
        if (existing) existing.count++
        else openStarts.set(key, { agent, taskId, count: 1 })
      } else if (e.event === "forge_end") {
        const existing = openStarts.get(key)
        if (existing) {
          existing.count--
          if (existing.count <= 0) openStarts.delete(key)
        }
      }
    }
  }

  // Class 20E (data-feed recovery): also count recent activity.jsonl rows as
  // an "active" signal. When cb events stop firing but the agent is still
  // running (git commit stream, workflow_step, audit cycle_step, etc.), the
  // Live Ops line used to collapse to "Idle right now." even while the
  // dashboard was visibly receiving events. Broaden the window to 120s for
  // activity rows since those arrive at a lower cadence than cb events.
  const activityWindowMs = 120_000
  for (const p of projects) {
    const actPath = join(p.path, ".cae", "metrics", "activity.jsonl")
    const rows = await tailJsonl(actPath, 500)
    for (const raw of rows) {
      if (typeof raw !== "object" || raw === null) continue
      const r = raw as Record<string, unknown>
      const ts = typeof r.ts === "string" ? r.ts : null
      if (!ts) continue
      const tsMs = Date.parse(ts)
      if (Number.isNaN(tsMs) || nowMs - tsMs > activityWindowMs) continue

      const type = typeof r.type === "string" ? r.type : ""
      // Infer an agent label from the row. Source=git-post-commit etc.
      const actor = typeof r.actor === "string" ? r.actor : null
      const source = typeof r.source === "string" ? r.source : null
      const agent =
        actor && actor.trim().length > 0
          ? actor
          : source === "git-post-commit"
            ? "git"
            : type === "cycle_step"
              ? "audit"
              : type === "chat_turn"
                ? "chat"
                : "activity"
      const meta = (r.meta as Record<string, unknown> | undefined) ?? {}
      const taskId =
        typeof meta.task_id === "string"
          ? meta.task_id
          : typeof meta.label === "string"
            ? meta.label
            : typeof r.summary === "string"
              ? r.summary
              : type

      const key = `${agent}::activity::${taskId}`
      const existing = openStarts.get(key)
      if (existing) existing.count++
      else openStarts.set(key, { agent, taskId, count: 1 })
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
//
// Signature is intentionally zero-arg: the rollup/phases/events-recent tiles
// describe the entire CAE ecosystem, not a single project. The `project=`
// query on /api/state scopes the route-level `breakers.*` fields (legacy
// cost-ticker) and nothing else — home.rollup unions across every project
// in listProjects(). If a future refactor adds a `project` parameter here,
// the ecosystem contract breaks and lib/cae-home-state.test.ts catches it.
export async function getHomeState(): Promise<HomeState> {
  const now = Date.now()
  if (CACHE && now - CACHE.ts < CACHE_TTL_MS) return CACHE.value

  const projects = await listProjects()
  if (projects.length === 0) {
    lHome.warn(
      {},
      "listProjects returned empty — rollup tiles will read 0. Verify SHIFT_PROJECTS_HOME + CAE_ROOT are mounted.",
    )
  }

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
