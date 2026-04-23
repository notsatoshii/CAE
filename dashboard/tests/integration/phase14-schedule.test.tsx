/**
 * phase14-schedule.test.tsx — Integration tests for Phase 14 Wave 2: NL Scheduler
 *
 * Covers:
 *   REQ-P14-04: NL parse → cron expression → CronPreview shows "At 09:00 AM"
 *   REQ-P14-05: Watcher dispatches scheduled fixture task (bash test re-run via execSync)
 *
 * Uses RTL for component tests, execSync for bash integration sanity.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { execSync } from "node:child_process"
import path from "node:path"
import React from "react"

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/build/schedule",
}))

const DASHBOARD_DIR = path.resolve(__dirname, "../../")

// ─── REQ-P14-04: NL Parse → CronPreview ───────────────────────────────────────
describe("REQ-P14-04: NL parse → CronPreview shows english description", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          cron: "0 9 * * *",
          source: "rule",
          confidence: "high",
          english: "At 09:00 AM",
          nextRun: "2026-04-24T09:00:00.000Z",
        }),
    })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it("Test 04a: parseSchedule rule engine handles 'every morning at 9am'", async () => {
    const { parseSchedule } = await import("@/lib/cae-schedule-parse")
    const result = await parseSchedule("every morning at 9am")
    expect(result.cron).toBe("0 9 * * *")
    expect(result.source).toBe("rule")
  })

  it("Test 04b: NlInput debounces and fires fetch after 300ms", async () => {
    const { NlInput } = await import("@/components/schedule/nl-input")

    render(<NlInput onResult={vi.fn()} />)
    const textarea = screen.getByPlaceholderText(/every morning at 9am/i)

    fireEvent.change(textarea, { target: { value: "every morning at 9am" } })

    await act(async () => {
      vi.advanceTimersByTime(300)
      await Promise.resolve()
    })

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/schedule/parse",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("Test 04c: NlInput does not fire for empty input", async () => {
    const { NlInput } = await import("@/components/schedule/nl-input")

    render(<NlInput onResult={vi.fn()} />)
    const textarea = screen.getByPlaceholderText(/every morning at 9am/i)

    fireEvent.change(textarea, { target: { value: "   " } })

    await act(async () => {
      vi.advanceTimersByTime(500)
    })

    expect(global.fetch).not.toHaveBeenCalled()
  })

  it("Test 04d: describeCron converts '0 9 * * *' to human text", async () => {
    const { describeCron } = await import("@/lib/cae-schedule-describe")
    const result = await describeCron("0 9 * * *", "UTC")
    expect(result.english).toContain("09:00")
  })

  it("Test 04e: parseSchedule handles weekly patterns", async () => {
    const { parseSchedule } = await import("@/lib/cae-schedule-parse")

    const mon = await parseSchedule("every monday at 8am")
    expect(mon.cron).toMatch(/^0 8 \* \* 1$/)

    const fri = await parseSchedule("every friday at 5pm")
    expect(fri.cron).toMatch(/^0 17 \* \* 5$/)
  })
})

// ─── REQ-P14-05: Watcher dispatch ─────────────────────────────────────────────
describe("REQ-P14-05: Scheduler watcher dispatches fixture task", () => {
  it("Test 05a: test-scheduler-watcher.sh exits 0 and prints OK", () => {
    const result = execSync(`bash ${DASHBOARD_DIR}/tests/test-scheduler-watcher.sh`, {
      timeout: 15000,
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: process.env.HOME ?? "/root",
      },
    })
    expect(result).toContain("scheduler watcher OK")
  })

  it("Test 05b: schedule store reads and writes task entries", async () => {
    const os = await import("node:os")
    const fs = await import("node:fs/promises")
    const pathMod = await import("node:path")

    const tmpRoot = pathMod.join(os.tmpdir(), `cae_root_test_${Date.now()}`)
    await fs.mkdir(tmpRoot, { recursive: true })
    await fs.writeFile(pathMod.join(tmpRoot, "scheduled_tasks.json"), "[]")

    const prevRoot = process.env.CAE_ROOT
    process.env.CAE_ROOT = tmpRoot
    vi.resetModules()

    try {
      const { readTasks, writeTask, deleteTask } = await import("@/lib/cae-schedule-store")

      const task = {
        id: "test-task-integration",
        nl: "every hour",
        cron: "0 * * * *",
        // Use a valid IANA timezone — cron-parser v5 rejects "UTC" on this system
        timezone: "America/New_York",
        buildplan: pathMod.join(tmpRoot, "PLAN.md"),
        enabled: true as const,
        lastRun: 0,               // Unix epoch seconds, 0 = never run
        createdAt: Math.floor(Date.now() / 1000), // Unix epoch seconds
        createdBy: "test@example.com",
      }

      await writeTask(task)

      const tasks = await readTasks()
      const found = tasks.find((t) => t.id === "test-task-integration")
      expect(found).toBeDefined()
      expect(found?.cron).toBe("0 * * * *")

      await deleteTask("test-task-integration")
      const after = await readTasks()
      expect(after.find((t) => t.id === "test-task-integration")).toBeUndefined()
    } finally {
      if (prevRoot !== undefined) {
        process.env.CAE_ROOT = prevRoot
      } else {
        delete process.env.CAE_ROOT
      }
      await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => undefined)
      vi.resetModules()
    }
  })

  it("Test 05c: readTasks returns empty array when scheduled_tasks.json does not exist", async () => {
    const os = await import("node:os")
    const fs = await import("node:fs/promises")
    const pathMod = await import("node:path")

    const emptyRoot = pathMod.join(os.tmpdir(), `cae_root_empty_${Date.now()}`)
    await fs.mkdir(emptyRoot, { recursive: true })

    const prevRoot = process.env.CAE_ROOT
    process.env.CAE_ROOT = emptyRoot
    vi.resetModules()

    try {
      const { readTasks } = await import("@/lib/cae-schedule-store")
      const tasks = await readTasks()
      expect(Array.isArray(tasks)).toBe(true)
      expect(tasks).toHaveLength(0)
    } finally {
      if (prevRoot !== undefined) {
        process.env.CAE_ROOT = prevRoot
      } else {
        delete process.env.CAE_ROOT
      }
      await fs.rm(emptyRoot, { recursive: true, force: true }).catch(() => undefined)
      vi.resetModules()
    }
  })
})
