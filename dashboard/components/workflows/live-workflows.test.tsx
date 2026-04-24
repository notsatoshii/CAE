/**
 * LiveWorkflows component tests — Class 19D.
 *
 * React Testing Library + vitest. Poll loop disabled via `disablePoll`
 * so tests assert purely against the SSR-rendered initial props.
 */
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { LiveWorkflows } from "./live-workflows"
import type { WorkflowInstance } from "@/lib/workflows/live-instances"

function buildInstance(over: Partial<WorkflowInstance> = {}): WorkflowInstance {
  return {
    id: "w-1",
    name: "Nightly ship",
    status: "running",
    started_at: "2026-04-24T10:00:00.000Z",
    ended_at: null,
    steps: [
      {
        name: "build",
        status: "passed",
        duration_ms: 10_000,
        started_at: "2026-04-24T10:00:00.000Z",
        ended_at: "2026-04-24T10:00:10.000Z",
      },
      {
        name: "test",
        status: "running",
        duration_ms: null,
        started_at: "2026-04-24T10:00:10.000Z",
        ended_at: null,
      },
    ],
    current_step: 1,
    origin: "activity",
    ...over,
  }
}

describe("LiveWorkflows", () => {
  it("renders empty branch with truth annotations when no instances", () => {
    render(<LiveWorkflows initialInstances={[]} disablePoll />)
    expect(screen.getByTestId("workflows-live-root")).toBeTruthy()
    expect(screen.getByTestId("workflows-live-empty")).toBeTruthy()
    const truth = screen.getByTestId("workflows-live-root")
    expect(truth.getAttribute("data-liveness")).toBe("empty")
  })

  it("renders ≥1 instance row for healthy fixture", () => {
    render(<LiveWorkflows initialInstances={[buildInstance()]} disablePoll />)
    expect(screen.getByTestId("workflows-live-list")).toBeTruthy()
    expect(screen.getByTestId("workflow-instance-w-1")).toBeTruthy()
  })

  it("shows the status badge with the overall status", () => {
    render(<LiveWorkflows initialInstances={[buildInstance({ status: "passed" })]} disablePoll />)
    const badge = screen.getByTestId("workflow-instance-status")
    expect(badge.getAttribute("data-status")).toBe("passed")
  })

  it("marks the current step with data-step-current=yes", () => {
    render(<LiveWorkflows initialInstances={[buildInstance()]} disablePoll />)
    const running = screen.getByTestId("workflow-step-test")
    expect(running.getAttribute("data-step-current")).toBe("yes")
    const past = screen.getByTestId("workflow-step-build")
    expect(past.getAttribute("data-step-current")).toBe("no")
  })

  it("renders step durations in human form", () => {
    render(<LiveWorkflows initialInstances={[buildInstance()]} disablePoll />)
    const build = screen.getByTestId("workflow-step-build")
    expect(build.textContent).toContain("10s")
  })

  it("does NOT emit stub/coming-soon copy (smoke guard)", () => {
    render(<LiveWorkflows initialInstances={[buildInstance()]} disablePoll />)
    const html = document.body.innerHTML.toLowerCase()
    expect(html).not.toContain("stub")
    expect(html).not.toContain("coming soon")
  })
})
