/**
 * live-instances.test.ts — unit tests for the workflow-instances reducer.
 *
 * Covers:
 *   - empty inputs → empty list
 *   - canonical workflow_start / workflow_step / workflow_end lifecycle
 *   - failure promotion (step failed → overall failed)
 *   - legacy `workflow_run` rows surfaced as one-step instances
 *   - `cycle_step` rows (audit harness) unioned as first-class workflows
 *   - phase-state snapshots merged in
 *   - order invariant: freshest run first
 *   - etagFor stability + change-on-transition
 *   - formatDurationMs formatting matrix
 *   - file I/O driver tolerates missing files + missing phases dir
 */

import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  etagFor,
  formatDurationMs,
  getLiveInstances,
  reduceWorkflowInstances,
} from "./live-instances"

let tmpRoot: string

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), "cae-wf-live-"))
})

afterEach(() => {
  rmSync(tmpRoot, { recursive: true, force: true })
})

describe("reduceWorkflowInstances", () => {
  it("empty inputs → empty list", () => {
    expect(reduceWorkflowInstances([], [])).toEqual([])
  })

  it("canonical lifecycle groups by workflow_id and computes step durations", () => {
    const rows = [
      {
        ts: "2026-04-24T10:00:00.000Z",
        type: "workflow_start",
        meta: { workflow_id: "w1", workflow_name: "Nightly ship" },
      },
      {
        ts: "2026-04-24T10:00:05.000Z",
        type: "workflow_step",
        meta: { workflow_id: "w1", step: "build" },
      },
      {
        ts: "2026-04-24T10:00:15.000Z",
        type: "workflow_step",
        meta: { workflow_id: "w1", step: "build", status: "passed" },
      },
      {
        ts: "2026-04-24T10:00:16.000Z",
        type: "workflow_step",
        meta: { workflow_id: "w1", step: "test" },
      },
      {
        ts: "2026-04-24T10:00:20.000Z",
        type: "workflow_end",
        meta: { workflow_id: "w1", status: "passed" },
      },
    ]
    const [instance] = reduceWorkflowInstances(rows, [])
    expect(instance.id).toBe("w1")
    expect(instance.name).toBe("Nightly ship")
    expect(instance.status).toBe("passed")
    expect(instance.started_at).toBe("2026-04-24T10:00:00.000Z")
    expect(instance.ended_at).toBe("2026-04-24T10:00:20.000Z")
    expect(instance.steps).toHaveLength(2)
    expect(instance.steps[0]).toMatchObject({
      name: "build",
      status: "passed",
      duration_ms: 10_000,
    })
    // `test` step never saw a terminal event, but workflow_end closed it as
    // passed with the end timestamp.
    expect(instance.steps[1]).toMatchObject({
      name: "test",
      status: "passed",
      duration_ms: 4_000,
    })
    expect(instance.current_step).toBe(-1)
  })

  it("step failure promotes overall status to failed", () => {
    const rows = [
      {
        ts: "2026-04-24T10:00:00.000Z",
        type: "workflow_start",
        meta: { workflow_id: "w2", workflow_name: "CI" },
      },
      {
        ts: "2026-04-24T10:00:05.000Z",
        type: "workflow_step",
        meta: { workflow_id: "w2", step: "test" },
      },
      {
        ts: "2026-04-24T10:00:06.000Z",
        type: "workflow_step",
        meta: { workflow_id: "w2", step: "test", status: "failed" },
      },
    ]
    const [instance] = reduceWorkflowInstances(rows, [])
    expect(instance.status).toBe("failed")
    expect(instance.steps[0].status).toBe("failed")
    expect(instance.steps[0].duration_ms).toBe(1_000)
  })

  it("running workflow shows current_step pointing at the active step", () => {
    const rows = [
      {
        ts: "2026-04-24T10:00:00.000Z",
        type: "workflow_start",
        meta: { workflow_id: "w3", workflow_name: "Deploy" },
      },
      {
        ts: "2026-04-24T10:00:05.000Z",
        type: "workflow_step",
        meta: { workflow_id: "w3", step: "build" },
      },
      {
        ts: "2026-04-24T10:00:10.000Z",
        type: "workflow_step",
        meta: { workflow_id: "w3", step: "build", status: "passed" },
      },
      {
        ts: "2026-04-24T10:00:11.000Z",
        type: "workflow_step",
        meta: { workflow_id: "w3", step: "deploy" },
      },
    ]
    const [instance] = reduceWorkflowInstances(rows, [])
    expect(instance.status).toBe("running")
    expect(instance.current_step).toBe(1)
    expect(instance.steps[1].status).toBe("running")
    expect(instance.steps[1].duration_ms).toBeNull()
  })

  it("cycle_step rows are unioned as first-class workflows", () => {
    const rows = [
      {
        ts: "2026-04-24T09:00:00.000Z",
        type: "cycle_step",
        meta: { label: "C5", fixture: "healthy", step: "start" },
      },
      {
        ts: "2026-04-24T09:00:05.000Z",
        type: "cycle_step",
        meta: { label: "C5", fixture: "healthy", step: "playwright" },
      },
      {
        ts: "2026-04-24T09:00:30.000Z",
        type: "cycle_step",
        meta: { label: "C5", fixture: "healthy", step: "score" },
      },
      {
        ts: "2026-04-24T09:00:32.000Z",
        type: "cycle_step",
        meta: { label: "C5", fixture: "healthy", step: "complete" },
      },
    ]
    const [instance] = reduceWorkflowInstances(rows, [])
    expect(instance.id).toBe("cycle:C5:healthy")
    expect(instance.name).toContain("C5")
    expect(instance.status).toBe("passed")
    const names = instance.steps.map((s) => s.name)
    expect(names).toContain("playwright")
    expect(names).toContain("score")
  })

  it("cycle_step rows are excluded when includeCycleSteps=false", () => {
    const rows = [
      {
        ts: "2026-04-24T09:00:00.000Z",
        type: "cycle_step",
        meta: { label: "C5", fixture: "healthy", step: "start" },
      },
    ]
    expect(
      reduceWorkflowInstances(rows, [], { includeCycleSteps: false }),
    ).toHaveLength(0)
  })

  it("legacy workflow_run rows produce a synthetic instance keyed by phase", () => {
    const rows = [
      {
        ts: "2026-04-24T08:00:00.000Z",
        type: "workflow_run",
        meta: { phase: "p12", step: "scheduler-tick" },
      },
    ]
    const [instance] = reduceWorkflowInstances(rows, [])
    expect(instance.id).toBe("p12")
    expect(instance.origin).toBe("activity")
  })

  it("phase-state snapshots merge in and are returned", () => {
    const rows: unknown[] = []
    const phaseStates = [
      {
        workflow_id: "ph-42",
        name: "Phase 42",
        status: "running",
        started_at: "2026-04-24T07:00:00.000Z",
        steps: [
          {
            name: "plan",
            status: "passed",
            duration_ms: 12_000,
            started_at: "2026-04-24T07:00:00.000Z",
            ended_at: "2026-04-24T07:00:12.000Z",
          },
          {
            name: "execute",
            status: "running",
            started_at: "2026-04-24T07:00:12.000Z",
          },
        ],
      },
    ]
    const [instance] = reduceWorkflowInstances(rows, phaseStates)
    expect(instance.id).toBe("ph-42")
    expect(instance.origin).toBe("phase-state")
    expect(instance.steps[0].duration_ms).toBe(12_000)
    expect(instance.current_step).toBe(1)
  })

  it("sorts instances by started_at DESC", () => {
    const rows = [
      {
        ts: "2026-04-24T10:00:00.000Z",
        type: "workflow_start",
        meta: { workflow_id: "a", workflow_name: "A" },
      },
      {
        ts: "2026-04-24T11:00:00.000Z",
        type: "workflow_start",
        meta: { workflow_id: "b", workflow_name: "B" },
      },
    ]
    const out = reduceWorkflowInstances(rows, [])
    expect(out.map((i) => i.id)).toEqual(["b", "a"])
  })

  it("rows with no groupable key are dropped silently", () => {
    const rows = [
      { ts: "2026-04-24T10:00:00.000Z", type: "workflow_start", meta: {} },
      { ts: "2026-04-24T10:00:01.000Z", type: "commit", meta: { sha: "abc" } },
    ]
    expect(reduceWorkflowInstances(rows, [])).toHaveLength(0)
  })
})

describe("etagFor", () => {
  it("returns 'empty' quoted sentinel for empty list", () => {
    expect(etagFor([])).toBe('"empty"')
  })

  it("produces a stable etag for identical inputs", () => {
    const rows = [
      {
        ts: "2026-04-24T10:00:00.000Z",
        type: "workflow_start",
        meta: { workflow_id: "w1", workflow_name: "X" },
      },
    ]
    const a = reduceWorkflowInstances(rows, [])
    const b = reduceWorkflowInstances(rows, [])
    expect(etagFor(a)).toBe(etagFor(b))
  })

  it("changes when a status transitions", () => {
    const base = [
      {
        ts: "2026-04-24T10:00:00.000Z",
        type: "workflow_start",
        meta: { workflow_id: "w1", workflow_name: "X" },
      },
    ]
    const before = reduceWorkflowInstances(base, [])
    const after = reduceWorkflowInstances(
      [
        ...base,
        {
          ts: "2026-04-24T10:00:10.000Z",
          type: "workflow_end",
          meta: { workflow_id: "w1", status: "passed" },
        },
      ],
      [],
    )
    expect(etagFor(before)).not.toBe(etagFor(after))
  })
})

describe("formatDurationMs", () => {
  it.each([
    [null, "—"],
    [0, "0ms"],
    [430, "430ms"],
    [1_200, "1.2s"],
    [9_900, "9.9s"],
    [10_100, "10s"],
    [59_900, "60s"],
    [60_000, "1m 00s"],
    [192_000, "3m 12s"],
    [3_600_000, "1h 00m"],
    [3_840_000, "1h 04m"],
  ])("formatDurationMs(%p) === %p", (input, expected) => {
    expect(formatDurationMs(input)).toBe(expected)
  })
})

describe("getLiveInstances (file I/O driver)", () => {
  it("returns [] when activity.jsonl is missing", async () => {
    const out = await getLiveInstances({
      root: tmpRoot,
      activityPath: join(tmpRoot, "does-not-exist.jsonl"),
      phasesDir: join(tmpRoot, "no-phases"),
    })
    expect(out).toEqual([])
  })

  it("reads + reduces a healthy fixture stream", async () => {
    const metricsDir = join(tmpRoot, ".cae", "metrics")
    mkdirSync(metricsDir, { recursive: true })
    const path = join(metricsDir, "activity.jsonl")
    const lines = [
      JSON.stringify({
        ts: "2026-04-24T10:00:00.000Z",
        type: "workflow_start",
        source: "test",
        summary: "start",
        meta: { workflow_id: "wx", workflow_name: "Smoke" },
      }),
      JSON.stringify({
        ts: "2026-04-24T10:00:02.000Z",
        type: "workflow_step",
        source: "test",
        summary: "step",
        meta: { workflow_id: "wx", step: "seed" },
      }),
      JSON.stringify({
        ts: "2026-04-24T10:00:03.000Z",
        type: "workflow_step",
        source: "test",
        summary: "step",
        meta: { workflow_id: "wx", step: "seed", status: "passed" },
      }),
      JSON.stringify({
        ts: "2026-04-24T10:00:04.000Z",
        type: "workflow_end",
        source: "test",
        summary: "end",
        meta: { workflow_id: "wx", status: "passed" },
      }),
    ]
    writeFileSync(path, lines.join("\n") + "\n", "utf8")
    const out = await getLiveInstances({
      root: tmpRoot,
      activityPath: path,
      phasesDir: join(tmpRoot, "no-phases"),
    })
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe("wx")
    expect(out[0].status).toBe("passed")
    expect(out[0].steps[0].duration_ms).toBe(1_000)
  })

  it("unions phase-state snapshots alongside activity rows", async () => {
    const metricsDir = join(tmpRoot, ".cae", "metrics")
    mkdirSync(metricsDir, { recursive: true })
    const activityPath = join(metricsDir, "activity.jsonl")
    writeFileSync(activityPath, "", "utf8")

    const phasesDir = join(tmpRoot, ".planning", "phases")
    const phaseDir = join(phasesDir, "01-example")
    mkdirSync(phaseDir, { recursive: true })
    writeFileSync(
      join(phaseDir, "state.json"),
      JSON.stringify({
        workflow_id: "phase-01",
        name: "Example",
        status: "running",
        started_at: "2026-04-24T06:00:00.000Z",
        steps: [
          {
            name: "plan",
            status: "passed",
            duration_ms: 5_000,
            started_at: "2026-04-24T06:00:00.000Z",
            ended_at: "2026-04-24T06:00:05.000Z",
          },
        ],
      }),
      "utf8",
    )

    const out = await getLiveInstances({
      root: tmpRoot,
      activityPath,
      phasesDir,
    })
    expect(out).toHaveLength(1)
    expect(out[0].origin).toBe("phase-state")
    expect(out[0].id).toBe("phase-01")
  })
})
