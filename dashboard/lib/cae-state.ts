import { readdir, readFile, stat } from "fs/promises"
import { join } from "path"
import { parse as parseYaml } from "yaml"
import { CAE_ROOT, INBOX_ROOT, OUTBOX_ROOT } from "./cae-config"
import type { CbState, InboxTask, OutboxTask, Phase, Project } from "./cae-types"

// Phase 10 D-02: Scan this directory for Shift-managed projects.
const SHIFT_PROJECTS_HOME = process.env.SHIFT_PROJECTS_HOME ?? "/home/cae"

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
    } else {
      const cbPath = join(projectRoot, ".cae", "metrics", "circuit-breakers.jsonl")
      const cbLines = await tailJsonl(cbPath, 50)
      const phaseTag = entry.name
      const isActive = cbLines.some(
        (l) => {
          if (typeof l !== "object" || l === null) return false
          const rec = l as Record<string, unknown>
          if (rec.phaseId !== phaseTag) return false
          const ev = rec.event
          return ev === "forge_begin" || ev === "forge_start"
        },
      )
      if (isActive) status = "active"
    }

    phases.push({ number, name, planFiles, status })
  }

  return phases.sort((a, b) => a.number - b.number)
}

export async function listProjects(): Promise<Project[]> {
  const candidates: Array<{ name: string; path: string }> = [
    { name: "ctrl-alt-elite", path: CAE_ROOT },
    { name: "cae-dashboard", path: join(CAE_ROOT, "dashboard") },
    { name: "cae-dashboard-alt", path: "/home/cae-dashboard" },
    { name: "bridge-test-repo", path: "/tmp/bridge-test-repo" },
  ]

  // 1. Scan SHIFT_PROJECTS_HOME for Shift-managed directories.
  const shiftFound: Array<{ name: string; path: string }> = []
  try {
    const entries = await readdir(SHIFT_PROJECTS_HOME, { withFileTypes: true })
    for (const e of entries) {
      if (!e.isDirectory()) continue
      const projPath = join(SHIFT_PROJECTS_HOME, e.name)
      const stateFile = join(projPath, ".shift", "state.json")
      if (await exists(stateFile)) {
        shiftFound.push({ name: e.name, path: projPath })
      }
    }
  } catch { /* SHIFT_PROJECTS_HOME missing or unreadable — skip quietly */ }

  // 2. Union with the hard-coded candidates, deduping by absolute path.
  const byPath = new Map<string, { name: string; path: string }>()
  for (const c of [...candidates, ...shiftFound]) {
    if (!byPath.has(c.path)) byPath.set(c.path, c)
  }

  // 3. Enrich each with Shift state (when present) and existence checks.
  const projects: Project[] = []
  for (const c of byPath.values()) {
    if (!(await exists(c.path))) continue
    const hasPlanning = await exists(join(c.path, ".planning"))
    let shiftPhase: string | null = null
    let shiftUpdated: string | null = null
    try {
      const raw = await readFile(join(c.path, ".shift", "state.json"), "utf8")
      const state = JSON.parse(raw)
      shiftPhase = typeof state?.phase === "string" ? state.phase : null
      shiftUpdated = typeof state?.updated === "string" ? state.updated : null
    } catch { /* not a Shift project or malformed — leave null */ }
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
  const lines = await readLines(path)
  const tail = lines.slice(-limit)
  return tail.flatMap((line) => {
    try {
      return [JSON.parse(line)]
    } catch {
      return []
    }
  })
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
