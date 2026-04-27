import { open, readdir, readFile, stat } from "fs/promises"
import { join } from "path"
import { parse as parseYaml } from "yaml"
import { CAE_ROOT, INBOX_ROOT, OUTBOX_ROOT } from "./cae-config"
import { log } from "./log"
import type { CbState, InboxTask, OutboxTask, Phase, Project } from "./cae-types"

// Phase 10 D-02: Scan this directory for Shift-managed projects.
const SHIFT_PROJECTS_HOME = process.env.SHIFT_PROJECTS_HOME ?? "/home/cae"

const lState = log("cae-state")

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function readLines(filePath: string): Promise<string[]> {
  try {
    const text = await readFile(filePath, "utf8")
    return text.split("\n").filter((l) => l.trim() !== "")
  } catch {
    return []
  }
}

export async function listPhases(projectRoot: string): Promise<Phase[]> {
  const phasesDir = join(projectRoot, ".planning", "phases")
  if (!(await exists(phasesDir))) return []

  const entries = await readdir(phasesDir, { withFileTypes: true })
  const phaseDirs = entries.filter((e) => e.isDirectory() && /^\d{2}-.+/.test(e.name))

  // Class 20B (data-feed recovery): the circuit-breakers.jsonl event schema
  // carries `task_id` (e.g. "p15-pl01-t1"), never `phaseId`. The prior
  // check — `rec.phaseId !== phaseTag` — compared `undefined !== "15-…"`
  // which was always truthy, so every phase without a CAE-SUMMARY.md was
  // silently marked "idle". buildPhases() in cae-home-state.ts filtered them
  // all out, leaving ActivePhaseCards empty on /build. Fix: derive phase
  // number from the `task_id` prefix (matches cae-home-state's own
  // `eventPhasePrefix`) and also accept rows from activity.jsonl so the
  // "active" signal survives gaps in cb events.
  const cbPath = join(projectRoot, ".cae", "metrics", "circuit-breakers.jsonl")
  const activityPath = join(projectRoot, ".cae", "metrics", "activity.jsonl")
  const [cbLines, activityLines] = await Promise.all([
    tailJsonl(cbPath, 200),
    tailJsonl(activityPath, 500),
  ])
  const nowMs = Date.now()
  const activeWindowMs = 24 * 60 * 60 * 1000 // 24h — intra-day work

  function rowPhaseNumber(rec: Record<string, unknown>): number | null {
    const tid = typeof rec.task_id === "string" ? rec.task_id : undefined
    if (tid) {
      const m = tid.match(/^p(\d+)-/)
      if (m) return parseInt(m[1], 10)
    }
    const meta = rec.meta
    if (meta && typeof meta === "object") {
      const mp = (meta as Record<string, unknown>).phase
      if (typeof mp === "string") {
        const m = mp.match(/^p?(\d+)/)
        if (m) return parseInt(m[1], 10)
      }
    }
    return null
  }

  function rowTs(rec: Record<string, unknown>): number | null {
    if (typeof rec.ts !== "string") return null
    const n = Date.parse(rec.ts)
    return Number.isNaN(n) ? null : n
  }

  const activePhaseNumbers = new Set<number>()
  for (const l of [...cbLines, ...activityLines]) {
    if (typeof l !== "object" || l === null) continue
    const rec = l as Record<string, unknown>
    const ts = rowTs(rec)
    if (ts === null || nowMs - ts > activeWindowMs) continue
    const n = rowPhaseNumber(rec)
    if (n === null || Number.isNaN(n)) continue
    activePhaseNumbers.add(n)
  }

  const phases: Phase[] = []
  for (const entry of phaseDirs) {
    const match = entry.name.match(/^(\d+)-(.+)$/)
    if (!match) continue
    const number = parseInt(match[1], 10)
    const name = match[2]
    const phaseDir = join(phasesDir, entry.name)

    const children = await readdir(phaseDir)
    const planFiles = children.filter((f) => f.endsWith("-PLAN.md"))

    const summaryPath = join(phaseDir, "CAE-SUMMARY.md")
    const hasSummary = await exists(summaryPath)

    let status: Phase["status"] = "idle"
    if (hasSummary) {
      const summaryText = await readFile(summaryPath, "utf8").catch(() => "")
      const lower = summaryText.toLowerCase()
      if (lower.includes("failed") || lower.includes("error")) {
        status = "failed"
      } else {
        status = "done"
      }
    } else if (activePhaseNumbers.has(number)) {
      status = "active"
    }

    phases.push({ number, name, planFiles, status })
  }

  return phases.sort((a, b) => a.number - b.number)
}

// Shift project scan with 2s timeout and 30s cache
let _shiftCache: { data: Array<{ name: string; path: string }>; ts: number } | null = null
const SHIFT_CACHE_TTL = 30_000

async function listShiftProjectsCached(): Promise<Array<{ name: string; path: string }>> {
  // DEV BYPASS: Shift scan of /home/cae hangs due to kernel-level readdir
  // blocking on restricted subdirs (.claude). Skip until Shift is actually used.
  // TODO: Re-enable when Shift projects exist, or change SHIFT_PROJECTS_HOME.
  return []
}

export async function listProjects(): Promise<Project[]> {
  const candidates: Array<{ name: string; path: string }> = [
    { name: "ctrl-alt-elite", path: CAE_ROOT },
    { name: "cae-dashboard", path: join(CAE_ROOT, "dashboard") },
  ]

  // 1. Scan SHIFT_PROJECTS_HOME for Shift-managed directories (2s timeout + 30s cache).
  const shiftFound = await listShiftProjectsCached()

  // 2. Union with the hard-coded candidates, deduping by absolute path.
  const byPath = new Map<string, { name: string; path: string }>()
  for (const c of [...candidates, ...shiftFound]) {
    if (!byPath.has(c.path)) byPath.set(c.path, c)
  }

  // 3. Enrich each with Shift state (when present) and existence checks.
  //
  // Session-14 hardening: CAE_ROOT is the canonical ecosystem root. Every
  // rollup aggregator (buildRollup, buildPhases, buildEventsRecent) unions
  // across the list this function returns — if CAE_ROOT ever falls out of
  // the list, top-of-funnel tiles silently read 0 even though commits are
  // landing in /home/cae/ctrl-alt-elite/.cae/metrics/activity.jsonl.
  //
  // Guarantee: if the CAE_ROOT candidate fails an exists() check (unusual —
  // only happens when the fs is mis-mounted or CAE_ROOT env points at a
  // non-existent path), log a warning and INCLUDE it anyway with
  // hasPlanning=false. Readers already no-op on missing files via
  // tailJsonl → readLines, so an invalid path degrades to "0 contribution"
  // not "loop early-exit".
  const projects: Project[] = []
  for (const c of byPath.values()) {
    const pathExists = await exists(c.path)
    if (!pathExists) {
      if (c.path === CAE_ROOT) {
        lState.warn({ path: c.path }, "CAE_ROOT missing from filesystem — including in listProjects anyway so rollup unions don't silently drop it")
      } else {
        continue
      }
    }
    const hasPlanning = pathExists ? await exists(join(c.path, ".planning")) : false
    let shiftPhase: string | null = null
    let shiftUpdated: string | null = null
    if (pathExists) {
      try {
        const raw = await readFile(join(c.path, ".shift", "state.json"), "utf8")
        const state = JSON.parse(raw)
        shiftPhase = typeof state?.phase === "string" ? state.phase : null
        shiftUpdated = typeof state?.updated === "string" ? state.updated : null
      } catch { /* not a Shift project or malformed — leave null */ }
    }
    projects.push({ name: c.name, path: c.path, hasPlanning, shiftPhase, shiftUpdated })
  }

  // 4. Sort: Shift projects by shiftUpdated desc, non-Shift at the end.
  projects.sort((a, b) => {
    const au = a.shiftUpdated ?? ""
    const bu = b.shiftUpdated ?? ""
    if (au && bu) return bu.localeCompare(au)
    if (au) return -1
    if (bu) return 1
    return a.name.localeCompare(b.name)
  })

  return projects
}

export async function listInbox(): Promise<InboxTask[]> {
  if (!(await exists(INBOX_ROOT))) return []

  const entries = await readdir(INBOX_ROOT, { withFileTypes: true })
  const taskDirs = entries.filter((e) => e.isDirectory())

  const tasks: InboxTask[] = []
  for (const entry of taskDirs) {
    const taskDir = join(INBOX_ROOT, entry.name)
    const dirStat = await stat(taskDir)
    const buildplanPath = join(taskDir, "BUILDPLAN.md")
    const metaPath = join(taskDir, "META.yaml")
    tasks.push({
      taskId: entry.name,
      createdAt: dirStat.birthtime,
      buildplanPath,
      metaPath,
      hasBuildplan: await exists(buildplanPath),
    })
  }
  return tasks
}

export async function listOutbox(): Promise<OutboxTask[]> {
  if (!(await exists(OUTBOX_ROOT))) return []

  const entries = await readdir(OUTBOX_ROOT, { withFileTypes: true })
  const taskDirs = entries.filter((e) => e.isDirectory())

  const tasks: OutboxTask[] = []
  for (const entry of taskDirs) {
    const taskDir = join(OUTBOX_ROOT, entry.name)
    const donePath = join(taskDir, "DONE.md")
    const hasDone = await exists(donePath)

    let status: string | undefined
    let summary: string | undefined
    let branch: string | undefined
    let commits: string[] | undefined

    if (hasDone) {
      const raw = await readFile(donePath, "utf8").catch(() => "")
      const yamlContent = raw.replace(/^---\n/, "").replace(/\n---\s*$/, "")
      try {
        const parsed = parseYaml(yamlContent) as Record<string, unknown>
        status = parsed.status as string | undefined
        summary = parsed.summary as string | undefined
        branch = parsed.branch as string | undefined
        if (Array.isArray(parsed.commits)) {
          commits = parsed.commits as string[]
        }
      } catch {
        // malformed DONE.md — leave fields undefined
      }
    }

    tasks.push({
      taskId: entry.name,
      hasDone,
      processed: hasDone && status === "success",
      status,
      summary,
      branch,
      commits,
    })
  }
  return tasks
}

export async function tailJsonl(path: string, limit = 100): Promise<unknown[]> {
  try {
    const s = await stat(path)
    if (s.size === 0) return []
    // Read last 64KB max (enough for ~200 lines of JSON)
    const bytesToRead = Math.min(s.size, 65536)
    const buf = Buffer.alloc(bytesToRead)
    const fh = await open(path, 'r')
    try {
      await fh.read(buf, 0, bytesToRead, s.size - bytesToRead)
    } finally {
      await fh.close()
    }
    const text = buf.toString('utf8')
    const lines = text.split('\n').filter(l => l.trim())
    // First line might be partial, skip it if we didn't read from start
    if (bytesToRead < s.size && lines.length > 0) lines.shift()
    const tail = lines.slice(-limit)
    return tail.flatMap(line => { try { return [JSON.parse(line)] } catch { return [] } })
  } catch { return [] }
}

export async function getCircuitBreakerState(projectRoot: string): Promise<CbState> {
  const cbPath = join(projectRoot, ".cae", "metrics", "circuit-breakers.jsonl")
  const entries = await tailJsonl(cbPath, 200)

  const activeTaskIds = new Set<string>()
  let recentFailures = 0
  let recentPhantomEscalations = 0
  let halted = false

  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null) continue
    const e = entry as Record<string, unknown>
    const event = e.event as string | undefined
    // Real adapter emits snake_case task_id; older drafts used camelCase.
    const taskId = (e.task_id ?? e.taskId) as string | undefined
    const success = e.success as boolean | undefined

    switch (event) {
      // Canonical vocabulary — real CAE adapter, fixtures, and every other
      // aggregator (cae-agents-state, cae-changes-state, cae-activity-feed,
      // cae-mission-control-state) all speak forge_begin/forge_end.
      case "forge_begin":
      case "forge_start":
        if (taskId) activeTaskIds.add(taskId)
        break
      case "forge_end":
        if (taskId) activeTaskIds.delete(taskId)
        if (success === false) recentFailures++
        break
      // Legacy vocabulary — keep handling for back-compat with any
      // stored jsonl predating the rename.
      case "forge_done":
        if (taskId) activeTaskIds.delete(taskId)
        break
      case "forge_fail":
        if (taskId) activeTaskIds.delete(taskId)
        recentFailures++
        break
      case "phantom_escalation":
        recentPhantomEscalations++
        break
      case "halt":
        halted = true
        break
      case "resume":
        halted = false
        break
    }
  }

  return {
    activeForgeCount: activeTaskIds.size,
    activeTaskIds: Array.from(activeTaskIds),
    recentFailures,
    recentPhantomEscalations,
    halted,
  }
}
