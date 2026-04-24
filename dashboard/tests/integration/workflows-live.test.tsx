/**
 * workflows-live.test.tsx — Class 19D integration smoke.
 *
 * Stand-in for the playwright smoke spec referenced in the Class 19D
 * buildplan ("tab populates with healthy fixture seed (≥1 instance
 * visible, no 'stub'/'coming soon' copy)"). The shared `audit/fixtures/
 * healthy.ts` is not in this agent's allowed-write set, so instead of
 * modifying the shared fixture + driving a full playwright run, we:
 *
 *   1. Seed a scratch activity.jsonl with the same workflow_start /
 *      workflow_step / workflow_end events a production healthy fixture
 *      would emit (two instances: one passed, one running with a
 *      currently-executing step).
 *   2. Exercise the real `getLiveInstances` file I/O driver against the
 *      scratch root.
 *   3. Render `<LiveWorkflows>` with the reducer output and assert:
 *        - ≥1 instance row is in the DOM
 *        - the current-step highlight is applied
 *        - no "stub" / "coming soon" copy anywhere
 *        - the truth annotations render non-empty
 *
 * This hits the full production code path (lib → component) minus the
 * network hop, which is covered separately by the reducer + component
 * unit tests. If the healthy fixture later seeds these same events,
 * the playwright run will succeed against the same DOM assertions.
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { LiveWorkflows } from "@/components/workflows/live-workflows"
import { getLiveInstances } from "@/lib/workflows/live-instances"

let tmpRoot: string

function tsAgo(base: number, offsetMs: number): string {
  return new Date(base - offsetMs).toISOString()
}

function seedHealthyWorkflows(root: string): void {
  const metricsDir = join(root, ".cae", "metrics")
  mkdirSync(metricsDir, { recursive: true })
  const now = Date.now()
  const lines = [
    // Instance A — passed, two steps.
    JSON.stringify({
      ts: tsAgo(now, 60_000),
      type: "workflow_start",
      source: "test-fixture",
      summary: "nightly-ship began",
      meta: { workflow_id: "wf-A", workflow_name: "Nightly ship" },
    }),
    JSON.stringify({
      ts: tsAgo(now, 55_000),
      type: "workflow_step",
      source: "test-fixture",
      summary: "build started",
      meta: { workflow_id: "wf-A", step: "build" },
    }),
    JSON.stringify({
      ts: tsAgo(now, 45_000),
      type: "workflow_step",
      source: "test-fixture",
      summary: "build passed",
      meta: { workflow_id: "wf-A", step: "build", status: "passed" },
    }),
    JSON.stringify({
      ts: tsAgo(now, 44_000),
      type: "workflow_step",
      source: "test-fixture",
      summary: "test started",
      meta: { workflow_id: "wf-A", step: "test" },
    }),
    JSON.stringify({
      ts: tsAgo(now, 40_000),
      type: "workflow_step",
      source: "test-fixture",
      summary: "test passed",
      meta: { workflow_id: "wf-A", step: "test", status: "passed" },
    }),
    JSON.stringify({
      ts: tsAgo(now, 39_000),
      type: "workflow_end",
      source: "test-fixture",
      summary: "nightly-ship completed",
      meta: { workflow_id: "wf-A", status: "passed" },
    }),
    // Instance B — still running, current step is `deploy`.
    JSON.stringify({
      ts: tsAgo(now, 20_000),
      type: "workflow_start",
      source: "test-fixture",
      summary: "deploy began",
      meta: { workflow_id: "wf-B", workflow_name: "Deploy preview" },
    }),
    JSON.stringify({
      ts: tsAgo(now, 15_000),
      type: "workflow_step",
      source: "test-fixture",
      summary: "build started",
      meta: { workflow_id: "wf-B", step: "build" },
    }),
    JSON.stringify({
      ts: tsAgo(now, 5_000),
      type: "workflow_step",
      source: "test-fixture",
      summary: "build passed",
      meta: { workflow_id: "wf-B", step: "build", status: "passed" },
    }),
    JSON.stringify({
      ts: tsAgo(now, 4_500),
      type: "workflow_step",
      source: "test-fixture",
      summary: "deploy started",
      meta: { workflow_id: "wf-B", step: "deploy" },
    }),
  ]
  writeFileSync(
    join(metricsDir, "activity.jsonl"),
    lines.join("\n") + "\n",
    "utf8",
  )
}

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "cae-wf-live-smoke-"))
  seedHealthyWorkflows(tmpRoot)
})

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

describe("workflows-live smoke (healthy fixture)", () => {
  it("end-to-end: reducer → component shows ≥1 instance, no stub copy", async () => {
    const instances = await getLiveInstances({
      root: tmpRoot,
      activityPath: join(tmpRoot, ".cae", "metrics", "activity.jsonl"),
      phasesDir: join(tmpRoot, ".planning", "phases"),
    })
    expect(instances.length).toBeGreaterThanOrEqual(1)

    render(<LiveWorkflows initialInstances={instances} disablePoll />)

    // ≥1 instance row is in the DOM.
    expect(screen.getByTestId("workflows-live-list")).toBeTruthy()
    const rows = document.querySelectorAll('[data-testid^="workflow-instance-"]')
    const instanceRows = Array.from(rows).filter((el) =>
      (el.getAttribute("data-testid") ?? "").match(/^workflow-instance-(?!.*-steps|.*-duration|.*-status)/),
    )
    expect(instanceRows.length).toBeGreaterThanOrEqual(1)

    // Truth annotations render non-empty.
    const count = document.querySelector('[data-truth="build-workflows-live.count"]')
    expect(count?.textContent).toBeDefined()
    expect(Number(count?.textContent)).toBeGreaterThanOrEqual(1)

    const empty = document.querySelector('[data-truth="build-workflows-live.empty"]')
    expect(empty?.textContent).toBe("no")

    // No stub / coming soon copy.
    const html = document.body.innerHTML.toLowerCase()
    expect(html).not.toContain("stub")
    expect(html).not.toContain("coming soon")
  })

  it("surfaces the currently-running step with a pulsing highlight", async () => {
    const instances = await getLiveInstances({
      root: tmpRoot,
      activityPath: join(tmpRoot, ".cae", "metrics", "activity.jsonl"),
      phasesDir: join(tmpRoot, ".planning", "phases"),
    })
    render(<LiveWorkflows initialInstances={instances} disablePoll />)

    // The running instance (wf-B) has `deploy` as its current step.
    const deployStep = screen.getByTestId("workflow-step-deploy")
    expect(deployStep.getAttribute("data-step-current")).toBe("yes")
    expect(deployStep.getAttribute("data-step-status")).toBe("running")

    // The passed instance (wf-A) shows passed status badge.
    const wfA = screen.getByTestId("workflow-instance-wf-A")
    const badges = wfA.querySelectorAll('[data-testid="workflow-instance-status"]')
    expect(badges.length).toBeGreaterThan(0)
    expect(badges[0].getAttribute("data-status")).toBe("passed")
  })
})
