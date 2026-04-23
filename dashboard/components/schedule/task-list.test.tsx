import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import React from "react"
import type { ScheduledTask } from "@/lib/cae-types"
import { TaskList } from "./task-list"

const SAMPLE_TASKS: ScheduledTask[] = [
  {
    id: "morning-brief",
    nl: "every morning at 9am",
    cron: "0 9 * * *",
    timezone: "America/New_York",
    buildplan: "/home/cae/ctrl-alt-elite/tasks/morning-brief.md",
    enabled: true,
    lastRun: 0,
    createdAt: 1714000000,
    createdBy: "test@test.com",
  },
  {
    id: "weekday-pulse",
    nl: "every weekday at 7pm",
    cron: "0 19 * * 1-5",
    timezone: "America/New_York",
    buildplan: "/home/cae/ctrl-alt-elite/tasks/pulse.md",
    enabled: false,
    lastRun: 1700000000,
    createdAt: 1714000000,
    createdBy: "test@test.com",
  },
  {
    id: "hourly-health",
    nl: "every hour",
    cron: "0 * * * *",
    timezone: "UTC",
    buildplan: "/home/cae/ctrl-alt-elite/tasks/health.md",
    enabled: true,
    lastRun: 0,
    createdAt: 1714000000,
    createdBy: "test@test.com",
  },
]

describe("TaskList", () => {
  it("Test 6: renders all tasks", () => {
    render(
      <TaskList
        tasks={SAMPLE_TASKS}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onOpenLog={vi.fn()}
      />
    )
    expect(screen.getByText("every morning at 9am")).toBeInTheDocument()
    expect(screen.getByText("every weekday at 7pm")).toBeInTheDocument()
    expect(screen.getByText("every hour")).toBeInTheDocument()
  })

  it("Test 6b: toggle button calls onToggle with id and new state", () => {
    const onToggle = vi.fn()
    render(
      <TaskList
        tasks={SAMPLE_TASKS}
        onToggle={onToggle}
        onDelete={vi.fn()}
        onOpenLog={vi.fn()}
        currentRole="operator"
      />
    )
    // Click the toggle for "morning-brief" (enabled=true → should pass false)
    const toggleBtns = screen.getAllByRole("button", { name: /toggle/i })
    fireEvent.click(toggleBtns[0])
    expect(onToggle).toHaveBeenCalledWith("morning-brief", false)
  })

  it("Test 6c: delete button calls onDelete with id", () => {
    const onDelete = vi.fn()
    render(
      <TaskList
        tasks={SAMPLE_TASKS}
        onToggle={vi.fn()}
        onDelete={onDelete}
        onOpenLog={vi.fn()}
        currentRole="operator"
      />
    )
    const deleteBtns = screen.getAllByRole("button", { name: /delete/i })
    fireEvent.click(deleteBtns[0])
    expect(onDelete).toHaveBeenCalledWith("morning-brief")
  })

  it("Test 6d: renders empty state when tasks is empty", () => {
    render(
      <TaskList
        tasks={[]}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
        onOpenLog={vi.fn()}
      />
    )
    expect(screen.getByText(/no schedules/i)).toBeInTheDocument()
  })
})
