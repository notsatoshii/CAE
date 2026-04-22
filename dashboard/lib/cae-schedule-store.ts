import fs from "node:fs"
import path from "node:path"
import { CronExpressionParser } from "cron-parser"
import type { ScheduledTask } from "./cae-types"

// ---------------------------------------------------------------------------
// File location
// ---------------------------------------------------------------------------

function getTasksFilePath(): string {
  const root = process.env.CAE_ROOT ?? "/home/cae/ctrl-alt-elite"
  return path.join(root, "scheduled_tasks.json")
}

// ---------------------------------------------------------------------------
// Hand-rolled validator (no Zod dependency)
// ---------------------------------------------------------------------------

const ID_RE = /^[a-z0-9-]+$/

/**
 * Validate that `obj` conforms to the ScheduledTask shape.
 * Throws a descriptive error when any field is wrong.
 *
 * Security: validates cron via CronExpressionParser (throws on bad input)
 * and timezone via Intl.supportedValuesOf (T-14-03-02).
 */
function validateScheduledTask(obj: unknown): ScheduledTask {
  if (typeof obj !== "object" || obj === null) {
    throw new Error("ScheduledTask must be an object")
  }
  const t = obj as Record<string, unknown>

  if (typeof t.id !== "string" || !ID_RE.test(t.id)) {
    throw new Error(`invalid id: "${t.id}" (must match /^[a-z0-9-]+$/)`)
  }
  if (typeof t.nl !== "string" || !t.nl.trim()) {
    throw new Error(`invalid nl: "${t.nl}"`)
  }
  if (typeof t.cron !== "string") {
    throw new Error(`invalid cron: "${t.cron}"`)
  }
  // Throws if cron is not parseable
  CronExpressionParser.parse(t.cron)

  if (typeof t.timezone !== "string") {
    throw new Error(`invalid timezone: "${t.timezone}"`)
  }
  // Validate IANA timezone
  const supportedTzs = Intl.supportedValuesOf("timeZone")
  if (!supportedTzs.includes(t.timezone)) {
    throw new Error(`unsupported timezone: "${t.timezone}"`)
  }
  if (typeof t.buildplan !== "string" || !t.buildplan) {
    throw new Error(`invalid buildplan: "${t.buildplan}"`)
  }
  if (typeof t.enabled !== "boolean") {
    throw new Error(`invalid enabled: "${t.enabled}"`)
  }
  if (typeof t.lastRun !== "number") {
    throw new Error(`invalid lastRun: "${t.lastRun}"`)
  }
  // Optional fields
  if (t.lastCompleted !== undefined && typeof t.lastCompleted !== "number") {
    throw new Error(`invalid lastCompleted: "${t.lastCompleted}"`)
  }
  if (typeof t.createdAt !== "number") {
    throw new Error(`invalid createdAt: "${t.createdAt}"`)
  }
  if (typeof t.createdBy !== "string") {
    throw new Error(`invalid createdBy: "${t.createdBy}"`)
  }

  return t as unknown as ScheduledTask
}

// ---------------------------------------------------------------------------
// Atomic write helper
// ---------------------------------------------------------------------------

/**
 * Write data to filePath atomically via a temp file + rename.
 * Sets mode 0o600 after write (T-14-03-02 security).
 */
async function atomicWrite(filePath: string, data: string): Promise<void> {
  const tmp = `${filePath}.tmp`
  await fs.promises.writeFile(tmp, data, { encoding: "utf8", mode: 0o600 })
  await fs.promises.rename(tmp, filePath)
  // Ensure permissions are 0600 after rename (some systems preserve source perms)
  await fs.promises.chmod(filePath, 0o600)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read all scheduled tasks from the registry.
 *
 * - Returns [] if the file does not exist (also creates an empty file).
 * - Filters out entries that fail schema validation (logged as warnings).
 */
export async function readTasks(): Promise<ScheduledTask[]> {
  const filePath = getTasksFilePath()

  let raw: string
  try {
    raw = await fs.promises.readFile(filePath, "utf8")
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      // Auto-create empty registry
      await atomicWrite(filePath, "[]")
      return []
    }
    throw err
  }

  let parsed: unknown[]
  try {
    parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error("not an array")
  } catch {
    console.warn("[cae-schedule-store] scheduled_tasks.json is malformed — returning []")
    return []
  }

  const tasks: ScheduledTask[] = []
  for (const entry of parsed) {
    try {
      tasks.push(validateScheduledTask(entry))
    } catch (err) {
      console.warn(
        `[cae-schedule-store] skipping invalid entry ${JSON.stringify((entry as Record<string, unknown>)?.id)}: ${(err as Error).message}`
      )
    }
  }
  return tasks
}

/**
 * Write (add or replace) a single task to the registry.
 *
 * Validates the task before writing. Replaces existing task with the same id.
 * Uses atomic rename for write safety (T-14-03-02).
 */
export async function writeTask(task: ScheduledTask): Promise<void> {
  // Validate first — throws if invalid
  validateScheduledTask(task)

  const existing = await readTasks()
  const updated = existing.filter((t) => t.id !== task.id).concat(task)
  await atomicWrite(getTasksFilePath(), JSON.stringify(updated, null, 2))
}

/**
 * Delete a task by id. No-op if id not found.
 */
export async function deleteTask(id: string): Promise<void> {
  const existing = await readTasks()
  const updated = existing.filter((t) => t.id !== id)
  await atomicWrite(getTasksFilePath(), JSON.stringify(updated, null, 2))
}

/**
 * Toggle the enabled flag of a task by id. No-op if id not found.
 */
export async function toggleTask(id: string, enabled: boolean): Promise<void> {
  const existing = await readTasks()
  const updated = existing.map((t) => (t.id === id ? { ...t, enabled } : t))
  await atomicWrite(getTasksFilePath(), JSON.stringify(updated, null, 2))
}
