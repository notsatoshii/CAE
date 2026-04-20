import { readdir, readFile, stat } from "fs/promises"
import { join } from "path"
import { parse as parseYaml } from "yaml"
import { CAE_ROOT, INBOX_ROOT, OUTBOX_ROOT } from "./cae-config"
import type { CbState, InboxTask, OutboxTask, Phase, Project } from "./cae-types"

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
        (l) =>
          typeof l === "object" &&
          l !== null &&
          (l as Record<string, unknown>).phaseId === phaseTag &&
          (l as Record<string, unknown>).event === "forge_start",
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

  const projects: Project[] = []
  for (const c of candidates) {
    if (!(await exists(c.path))) continue
    const hasPlanning = await exists(join(c.path, ".planning"))
    projects.push({ name: c.name, path: c.path, hasPlanning })
  }
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
    const taskId = e.taskId as string | undefined

    switch (event) {
      case "forge_start":
        if (taskId) activeTaskIds.add(taskId)
        break
      case "forge_done":
      case "forge_fail":
        if (taskId) activeTaskIds.delete(taskId)
        if (event === "forge_fail") recentFailures++
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
