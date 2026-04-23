import { describe, it, expect, beforeEach, afterEach } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import type { ScheduledTask } from "./cae-types"

// We test via env override: set CAE_ROOT to a temp dir
let tmpDir: string
let origCaeRoot: string | undefined

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cae-store-test-"))
  origCaeRoot = process.env.CAE_ROOT
  process.env.CAE_ROOT = tmpDir
})

afterEach(() => {
  if (origCaeRoot !== undefined) {
    process.env.CAE_ROOT = origCaeRoot
  } else {
    delete process.env.CAE_ROOT
  }
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

async function getStore() {
  // Re-import with fresh env after setting CAE_ROOT
  const mod = await import("./cae-schedule-store")
  return mod
}

function makeTask(overrides: Partial<ScheduledTask> = {}): ScheduledTask {
  return {
    id: "test-task",
    nl: "every morning at 9am",
    cron: "0 9 * * *",
    timezone: "America/New_York",
    buildplan: "/home/cae/ctrl-alt-elite/tasks/test.md",
    enabled: true,
    lastRun: 0,
    createdAt: Math.floor(Date.now() / 1000),
    createdBy: "test@test.com",
    ...overrides,
  }
}

describe("cae-schedule-store — readTasks", () => {
  it("returns [] when file does not exist", async () => {
    const { readTasks } = await getStore()
    const tasks = await readTasks()
    expect(tasks).toEqual([])
  })

  it("returns parsed tasks from valid file", async () => {
    const task = makeTask()
    fs.writeFileSync(
      path.join(tmpDir, "scheduled_tasks.json"),
      JSON.stringify([task])
    )
    const { readTasks } = await getStore()
    const tasks = await readTasks()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe("test-task")
  })

  it("filters out invalid entries and logs warning (no crash)", async () => {
    const valid = makeTask({ id: "valid-task" })
    const invalid = { id: "", nl: 123, cron: "bad", timezone: "notreal" } // fails validation
    fs.writeFileSync(
      path.join(tmpDir, "scheduled_tasks.json"),
      JSON.stringify([valid, invalid])
    )
    const { readTasks } = await getStore()
    const tasks = await readTasks()
    // Only valid task should be returned
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe("valid-task")
  })
})

describe("cae-schedule-store — writeTask", () => {
  it("writes a task atomically (file exists after write)", async () => {
    const { writeTask } = await getStore()
    const task = makeTask()
    await writeTask(task)
    const filePath = path.join(tmpDir, "scheduled_tasks.json")
    expect(fs.existsSync(filePath)).toBe(true)
    const contents = JSON.parse(fs.readFileSync(filePath, "utf8"))
    expect(contents).toHaveLength(1)
    expect(contents[0].id).toBe("test-task")
  })

  it("preserves existing tasks on new write", async () => {
    const { writeTask, readTasks } = await getStore()
    await writeTask(makeTask({ id: "task-a" }))
    await writeTask(makeTask({ id: "task-b" }))
    const tasks = await readTasks()
    expect(tasks).toHaveLength(2)
  })

  it("replaces existing task with same id", async () => {
    const { writeTask, readTasks } = await getStore()
    await writeTask(makeTask({ id: "same-id", nl: "original" }))
    await writeTask(makeTask({ id: "same-id", nl: "updated" }))
    const tasks = await readTasks()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].nl).toBe("updated")
  })

  it("rejects task with invalid cron", async () => {
    const { writeTask } = await getStore()
    const task = makeTask({ cron: "not-valid-cron" })
    await expect(writeTask(task)).rejects.toThrow()
  })

  it("rejects task with invalid timezone", async () => {
    const { writeTask } = await getStore()
    const task = makeTask({ timezone: "Mars/Olympus" })
    await expect(writeTask(task)).rejects.toThrow()
  })
})

describe("cae-schedule-store — deleteTask", () => {
  it("removes task by id", async () => {
    const { writeTask, deleteTask, readTasks } = await getStore()
    await writeTask(makeTask({ id: "del-me" }))
    await writeTask(makeTask({ id: "keep-me" }))
    await deleteTask("del-me")
    const tasks = await readTasks()
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe("keep-me")
  })

  it("is a no-op if id not found", async () => {
    const { writeTask, deleteTask, readTasks } = await getStore()
    await writeTask(makeTask())
    await deleteTask("nonexistent")
    const tasks = await readTasks()
    expect(tasks).toHaveLength(1)
  })
})

describe("cae-schedule-store — toggleTask", () => {
  it("toggles enabled to false", async () => {
    const { writeTask, toggleTask, readTasks } = await getStore()
    await writeTask(makeTask({ id: "t1", enabled: true }))
    await toggleTask("t1", false)
    const tasks = await readTasks()
    expect(tasks[0].enabled).toBe(false)
  })

  it("toggles enabled to true", async () => {
    const { writeTask, toggleTask, readTasks } = await getStore()
    await writeTask(makeTask({ id: "t2", enabled: false }))
    await toggleTask("t2", true)
    const tasks = await readTasks()
    expect(tasks[0].enabled).toBe(true)
  })
})

// ─── CR-04 regression: buildplan shell-metacharacter rejection ────────────────
describe("CR-04: writeTask rejects buildplan paths with shell metacharacters", () => {
  it("CR-04a: rejects buildplan with single-quote (RCE vector)", async () => {
    const { writeTask } = await getStore()
    const task = makeTask({ buildplan: "/home/cae/ctrl-alt-elite/ok'; touch /tmp/pwned; echo '" })
    await expect(writeTask(task)).rejects.toThrow(/invalid characters/)
  })

  it("CR-04b: rejects buildplan with semicolon", async () => {
    const { writeTask } = await getStore()
    const task = makeTask({ buildplan: "/home/cae/ctrl-alt-elite/ok;id" })
    await expect(writeTask(task)).rejects.toThrow(/invalid characters/)
  })

  it("CR-04c: rejects buildplan with dollar-sign (command substitution)", async () => {
    const { writeTask } = await getStore()
    const task = makeTask({ buildplan: "/home/cae/ctrl-alt-elite/$(id)" })
    await expect(writeTask(task)).rejects.toThrow(/invalid characters/)
  })

  it("CR-04d: rejects buildplan with space", async () => {
    const { writeTask } = await getStore()
    const task = makeTask({ buildplan: "/home/cae/ctrl-alt-elite/path with space" })
    await expect(writeTask(task)).rejects.toThrow(/invalid characters/)
  })

  it("CR-04e: rejects buildplan with backtick", async () => {
    const { writeTask } = await getStore()
    const task = makeTask({ buildplan: "/home/cae/ctrl-alt-elite/`id`" })
    await expect(writeTask(task)).rejects.toThrow(/invalid characters/)
  })

  it("CR-04f: accepts valid buildplan path (alphanumeric + /._-)", async () => {
    const { writeTask } = await getStore()
    const task = makeTask({ buildplan: "/home/cae/ctrl-alt-elite/tasks/deploy_v2.md" })
    await expect(writeTask(task)).resolves.toBeUndefined()
  })
})
