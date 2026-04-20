import { readdir, readFile, stat } from "fs/promises"
import { exec } from "child_process"
import { promisify } from "util"
import { join } from "path"
import { parse as parseYaml } from "yaml"
import { tailJsonl } from "./cae-state"

const execAsync = promisify(exec)

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}

async function gitExec(cwd: string, cmd: string): Promise<string> {
  try {
    const { stdout } = await execAsync(cmd, { cwd })
    return stdout.trim()
  } catch {
    return ""
  }
}

export interface PlanTask {
  id: number
  name: string
  filesSpec: string
}

export interface PlanFileFrontmatter {
  phase: number
  plan: string
  wave: number
  name: string
}

export interface PlanFile {
  filename: string
  frontmatter: PlanFileFrontmatter
  tasks: PlanTask[]
}

export type TaskStatus = "pending" | "running" | "merged" | "failed"

export interface TaskState {
  taskId: string
  planFile: string
  wave: number
  status: TaskStatus
  attempts: number
  outputPath: string | null
}

export interface PhaseDetail {
  number: number
  name: string
  planFiles: PlanFile[]
  tasks: TaskState[]
  summary: string | null
  mergedCommits: string[]
  currentBranch: string
}

function parsePlanFile(filename: string, content: string): PlanFile {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
  let frontmatter: PlanFileFrontmatter = { phase: 0, plan: "A", wave: 1, name: "" }
  if (fmMatch) {
    try {
      const parsed = parseYaml(fmMatch[1]) as Record<string, unknown>
      frontmatter = {
        phase: typeof parsed.phase === "number" ? parsed.phase : 0,
        plan: typeof parsed.plan === "string" ? parsed.plan : "A",
        wave: typeof parsed.wave === "number" ? parsed.wave : 1,
        name: typeof parsed.name === "string" ? parsed.name : "",
      }
    } catch {
      // leave defaults
    }
  }

  const taskPattern = /<task id="(\d+)">([\s\S]*?)<\/task>/g
  const tasks: PlanTask[] = []
  let match
  while ((match = taskPattern.exec(content)) !== null) {
    const id = parseInt(match[1], 10)
    const body = match[2]
    const nameMatch = body.match(/<name>([\s\S]*?)<\/name>/)
    const filesMatch = body.match(/<files>([\s\S]*?)<\/files>/)
    tasks.push({
      id,
      name: nameMatch ? nameMatch[1].trim() : `Task ${id}`,
      filesSpec: filesMatch ? filesMatch[1].trim() : "",
    })
  }

  return { filename, frontmatter, tasks }
}

export async function getPhaseDetail(
  projectRoot: string,
  phaseNumber: number,
): Promise<PhaseDetail> {
  const phasesDir = join(projectRoot, ".planning", "phases")

  let phaseDir: string | null = null
  let phaseName = ""

  if (await exists(phasesDir)) {
    const entries = await readdir(phasesDir, { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const m = entry.name.match(/^(\d+)-(.+)$/)
      if (m && parseInt(m[1], 10) === phaseNumber) {
        phaseDir = join(phasesDir, entry.name)
        phaseName = m[2]
        break
      }
    }
  }

  if (!phaseDir) {
    return {
      number: phaseNumber,
      name: "unknown",
      planFiles: [],
      tasks: [],
      summary: null,
      mergedCommits: [],
      currentBranch: "",
    }
  }

  const children = await readdir(phaseDir)
  const planFilenames = children.filter((f) => f.endsWith("-PLAN.md"))
  const planFiles: PlanFile[] = []

  for (const filename of planFilenames) {
    const content = await readFile(join(phaseDir, filename), "utf8").catch(() => "")
    planFiles.push(parsePlanFile(filename, content))
  }

  const branchList = await gitExec(projectRoot, "git branch -a")
  const mergeLog = await gitExec(projectRoot, "git log --merges --oneline -100")
  const currentBranch = await gitExec(projectRoot, "git rev-parse --abbrev-ref HEAD")

  const phasePrefix = `forge/p${phaseNumber}-`

  const mergedBranchNames: string[] = []
  for (const line of mergeLog.split("\n")) {
    const m = line.match(/Merge (\S+)/)
    if (m && m[1].startsWith(phasePrefix)) {
      mergedBranchNames.push(m[1])
    }
  }

  const mergedCommits = mergeLog
    .split("\n")
    .filter((l) => l.includes(phasePrefix))

  const cbPath = join(projectRoot, ".cae", "metrics", "circuit-breakers.jsonl")
  const metricEvents = await tailJsonl(cbPath, 500)
  const failedTaskIds = new Set<string>()
  for (const ev of metricEvents) {
    if (typeof ev !== "object" || ev === null) continue
    const e = ev as Record<string, unknown>
    if (e.event === "forge_fail" && typeof e.taskId === "string") {
      failedTaskIds.add(e.taskId as string)
    }
  }

  const tasks: TaskState[] = []
  for (const pf of planFiles) {
    const planLetter = pf.frontmatter.plan
    for (const task of pf.tasks) {
      const taskKey = `pl${planLetter}-t${task.id}`
      const branchPrefix = `${phasePrefix}pl${planLetter}-t${task.id}-`

      const activeBranches = branchList
        .split("\n")
        .filter((b) => b.replace(/^\*?\s+/, "").startsWith(branchPrefix))
      const mergedForTask = mergedBranchNames.filter((b) => b.startsWith(branchPrefix))
      const attempts = activeBranches.length + mergedForTask.length

      let status: TaskStatus = "pending"
      if (mergedForTask.length > 0) {
        status = "merged"
      } else if (failedTaskIds.has(taskKey)) {
        status = "failed"
      } else if (activeBranches.length > 0) {
        status = "running"
      }

      const logPath = join(projectRoot, ".cae", "logs", `p${phaseNumber}-${taskKey}.log`)
      const outputPath = (await exists(logPath)) ? logPath : null

      tasks.push({
        taskId: taskKey,
        planFile: pf.filename,
        wave: pf.frontmatter.wave,
        status,
        attempts,
        outputPath,
      })
    }
  }

  const summaryPath = join(phaseDir, "CAE-SUMMARY.md")
  const summary = await readFile(summaryPath, "utf8").catch(() => null)

  return {
    number: phaseNumber,
    name: phaseName,
    planFiles,
    tasks,
    summary,
    mergedCommits,
    currentBranch,
  }
}
