/**
 * lib/workflows/live-instances.ts — Class 19D.
 *
 * Eric (session 13): "Workflows tab: currently static stub. Render live
 * workflow instances with per-step state + duration. Source activity.jsonl
 * + phases/*\/state.json."
 *
 * This module is the reducer that turns the canonical activity stream +
 * any phase-state snapshots into a typed list of `WorkflowInstance`s the
 * /build/workflows page renders.
 *
 * Inputs
 * ------
 *   1. `.cae/metrics/activity.jsonl` — canonical event stream (see
 *      cae-event-emit.ts). We accept three event shapes:
 *        - producer-facing: `{ type: "workflow_start" | "workflow_step" |
 *          "workflow_end", meta: { workflow_id, name?, step?, status? } }`
 *        - legacy `workflow_run` event with `meta.phase` + `meta.step` —
 *          surfaced as a one-step instance so runs still appear.
 *        - producer-facing `cycle_step` (audit harness) — unioned only if
 *          the caller passes `includeCycleSteps: true`. The /build/workflows
 *          tab uses this to render audit-cycle runs as first-class
 *          workflows while `audit-run-cycle` is CAE's main orchestrated
 *          pipeline (see audit/run-cycle.sh). Keeping it gated avoids
 *          polluting the list once real workflow_* producers come online.
 *   2. `.planning/phases/*\/state.json` — when phases emit their own
 *      in-flight snapshot, we union those into the list keyed by
 *      `workflow_id`. Missing dir = silently skipped (most CAE repos don't
 *      ship a .planning/phases/ today).
 *
 * The reducer is pure: takes arrays of events + state files, returns
 * WorkflowInstance[]. File I/O lives behind `getLiveInstances`.
 *
 * Concurrency / caching: the API route in front of this holds a 3s
 * process-level cache (matching the 5s client poll with slack). This
 * module itself is stateless.
 *
 * Class 20 (data-feed recovery): browser-safe types + `formatDurationMs`
 * live in `./types.ts`. This file keeps the reducer + filesystem driver +
 * `etagFor` (server-only) and re-exports the shared shapes so existing
 * server-side callers keep working unchanged. The split stops client
 * components from transitively pulling `node:fs/promises` into the
 * browser bundle — a dependency chain that was 500'ing /api/state and
 * silently killing the RollupStrip, ActivePhaseCards, RecentLedger,
 * LiveOpsLine, and ActivityFeed cards on /build.
 */

import { readdir, readFile, stat } from "node:fs/promises"
import { join } from "node:path"
import { CAE_ROOT } from "../cae-config"
import { tailJsonl } from "../cae-state"
import { ACTIVITY_JSONL_PATH } from "../cae-event-emit"
import type {
  WorkflowInstance,
  WorkflowInstanceStatus,
  WorkflowInstanceStep,
  WorkflowStepStatus,
} from "./types"

// Re-export the client-safe shapes so server-side callers that used to
// `import { WorkflowInstance } from "@/lib/workflows/live-instances"` keep
// working without changes.
export type {
  WorkflowInstance,
  WorkflowInstanceStatus,
  WorkflowInstanceStep,
  WorkflowStepStatus,
} from "./types"
export { formatDurationMs } from "./types"

// ── Raw event typing ────────────────────────────────────────────────────

/**
 * Subset of the activity.jsonl row shape this reducer cares about.
 * We tolerate extra fields and unknown types.
 */
interface RawActivityRow {
  ts: string
  type: string
  source?: string
  summary?: string
  meta?: Record<string, unknown>
}

/**
 * Subset of the phase-state schema. Each phase directory under
 * `.planning/phases/` MAY drop a state.json with this shape. Missing
 * fields are tolerated and fall back to sensible defaults.
 */
interface RawPhaseState {
  workflow_id?: string
  name?: string
  status?: string
  started_at?: string
  ended_at?: string
  steps?: Array<{
    name?: string
    status?: string
    duration_ms?: number
    started_at?: string
    ended_at?: string
  }>
}

// ── Helpers ─────────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object"
}

function asRow(raw: unknown): RawActivityRow | null {
  if (!isRecord(raw)) return null
  if (typeof raw.ts !== "string") return null
  if (typeof raw.type !== "string") return null
  return {
    ts: raw.ts,
    type: raw.type,
    source: typeof raw.source === "string" ? raw.source : undefined,
    summary: typeof raw.summary === "string" ? raw.summary : undefined,
    meta: isRecord(raw.meta) ? raw.meta : undefined,
  }
}

function normaliseInstanceStatus(s: unknown): WorkflowInstanceStatus {
  if (s === "passed" || s === "failed" || s === "running") return s
  // Be liberal with common aliases from producers.
  if (s === "success" || s === "ok" || s === "complete" || s === "completed") {
    return "passed"
  }
  if (s === "error" || s === "fail" || s === "aborted") return "failed"
  return "running"
}

function normaliseStepStatus(s: unknown): WorkflowStepStatus {
  if (s === "passed" || s === "failed" || s === "running" || s === "pending") {
    return s
  }
  if (s === "success" || s === "ok" || s === "complete" || s === "completed") {
    return "passed"
  }
  if (s === "error" || s === "fail" || s === "aborted") return "failed"
  // step_event with no status = step began
  return "running"
}

function parseIsoMs(ts: string): number | null {
  const n = Date.parse(ts)
  return Number.isNaN(n) ? null : n
}

// ── Pure reducer ────────────────────────────────────────────────────────

/**
 * Reduce a flat event list + optional phase-state snapshots into
 * grouped, normalised `WorkflowInstance`s.
 *
 * Grouping order (highest precedence first):
 *   1. `meta.workflow_id` if present (explicit identity).
 *   2. `meta.phase` (legacy `workflow_run` rows).
 *   3. `meta.label` + `meta.fixture` (audit `cycle_step` rows).
 *
 * Rows we can't group are dropped silently. The UI will simply show
 * nothing rather than render a broken instance.
 */
export function reduceWorkflowInstances(
  rows: unknown[],
  phaseStates: RawPhaseState[] = [],
  opts: { includeCycleSteps?: boolean } = {},
): WorkflowInstance[] {
  const includeCycleSteps = opts.includeCycleSteps ?? true

  const byId = new Map<string, WorkflowInstance>()
  const stepStartIndex = new Map<string, Map<string, number>>()

  // Preserve insertion order so "most-recently-seen first" rendering is
  // stable even when two runs share a timestamp.
  const orderedIds: string[] = []

  // Seed from phase-state snapshots first so activity events can overlay
  // fresher state on top.
  for (const ps of phaseStates) {
    const instance = phaseStateToInstance(ps)
    if (!instance) continue
    byId.set(instance.id, instance)
    stepStartIndex.set(instance.id, new Map())
    orderedIds.push(instance.id)
  }

  // Sort events by timestamp ASC so state transitions apply in causal
  // order (workflow_start → step → end).
  const sorted: RawActivityRow[] = []
  for (const raw of rows) {
    const r = asRow(raw)
    if (r) sorted.push(r)
  }
  sorted.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0))

  for (const row of sorted) {
    const key = keyFor(row, { includeCycleSteps })
    if (!key) continue

    const { id, name } = key
    let instance = byId.get(id)
    if (!instance) {
      instance = {
        id,
        name,
        status: "running",
        started_at: row.ts,
        ended_at: null,
        steps: [],
        current_step: -1,
        origin: "activity",
      }
      byId.set(id, instance)
      stepStartIndex.set(id, new Map())
      orderedIds.push(id)
    }

    applyRow(row, instance, stepStartIndex.get(id)!)
  }

  // Finalise: clean up current_step + steps still marked running but
  // superseded by a later step.
  const out: WorkflowInstance[] = []
  for (const id of orderedIds) {
    const instance = byId.get(id)
    if (!instance) continue
    finaliseInstance(instance)
    out.push(instance)
  }

  // Render order: instances sorted by `started_at` DESC so the freshest
  // run is always at the top. Stable for equal timestamps thanks to the
  // preserved ordered-ids list.
  out.sort((a, b) => (a.started_at < b.started_at ? 1 : a.started_at > b.started_at ? -1 : 0))
  return out
}

function keyFor(
  row: RawActivityRow,
  opts: { includeCycleSteps: boolean },
): { id: string; name: string } | null {
  const meta = row.meta ?? {}
  const wid = typeof meta.workflow_id === "string" ? meta.workflow_id : undefined
  const wname =
    typeof meta.workflow_name === "string"
      ? meta.workflow_name
      : typeof meta.name === "string"
        ? meta.name
        : undefined

  // Canonical producer-facing types first.
  if (
    row.type === "workflow_start" ||
    row.type === "workflow_step" ||
    row.type === "workflow_end"
  ) {
    if (wid) return { id: wid, name: wname ?? wid }
    // No workflow_id → synthesise from name + start ts.
    if (wname) return { id: `${wname}@${row.ts}`, name: wname }
    return null
  }

  // Legacy `workflow_run` (see cae-event-emit ActivityEventType).
  if (row.type === "workflow_run") {
    const phase = typeof meta.phase === "string" ? meta.phase : undefined
    const schedule = typeof meta.schedule === "string" ? meta.schedule : undefined
    const id = wid ?? phase ?? schedule
    if (!id) return null
    return { id, name: wname ?? schedule ?? phase ?? id }
  }

  // Audit harness `cycle_step` events. Each cycle = one logical workflow
  // (seed-fixture → playwright → score → reports). Key on label+fixture.
  if (opts.includeCycleSteps && row.type === "cycle_step") {
    const label = typeof meta.label === "string" ? meta.label : undefined
    const fixture = typeof meta.fixture === "string" ? meta.fixture : undefined
    if (!label) return null
    const id = `cycle:${label}:${fixture ?? "unknown"}`
    const name = fixture
      ? `Audit cycle ${label} (${fixture})`
      : `Audit cycle ${label}`
    return { id, name }
  }

  return null
}

function applyRow(
  row: RawActivityRow,
  instance: WorkflowInstance,
  stepIndex: Map<string, number>,
): void {
  const meta = row.meta ?? {}

  // workflow_start — stamp started_at if earlier than what we have.
  if (row.type === "workflow_start") {
    if (row.ts < instance.started_at) instance.started_at = row.ts
    if (typeof meta.workflow_name === "string") instance.name = meta.workflow_name
    return
  }

  // workflow_end — terminal. Record status + ended_at.
  if (row.type === "workflow_end") {
    instance.ended_at = row.ts
    instance.status = normaliseInstanceStatus(meta.status)
    // Close any still-running step as passed — end event trumps.
    if (instance.current_step >= 0) {
      const cur = instance.steps[instance.current_step]
      if (cur && cur.status === "running") {
        cur.status = normaliseInstanceStatus(meta.status) === "failed" ? "failed" : "passed"
        cur.ended_at = row.ts
        if (cur.started_at) {
          const start = parseIsoMs(cur.started_at)
          const end = parseIsoMs(row.ts)
          if (start !== null && end !== null) cur.duration_ms = end - start
        }
      }
    }
    return
  }

  // workflow_step / cycle_step — advance the step list.
  if (row.type === "workflow_step" || row.type === "cycle_step") {
    const stepName =
      typeof meta.step === "string"
        ? meta.step
        : typeof meta.name === "string"
          ? meta.name
          : null
    if (!stepName) return

    // cycle_step carries its own status via `meta.step` values like
    // "start", "score", "complete". We treat those as open/close markers
    // heuristically: "start" / "complete" flip the whole cycle, everything
    // else is a discrete step.
    if (row.type === "cycle_step") {
      if (stepName === "start") {
        if (row.ts < instance.started_at) instance.started_at = row.ts
        instance.status = "running"
        return
      }
      if (stepName === "complete") {
        instance.ended_at = row.ts
        instance.status = "passed"
        if (instance.current_step >= 0) {
          const cur = instance.steps[instance.current_step]
          if (cur && cur.status === "running") {
            cur.status = "passed"
            cur.ended_at = row.ts
            if (cur.started_at) {
              const s = parseIsoMs(cur.started_at)
              const e = parseIsoMs(row.ts)
              if (s !== null && e !== null) cur.duration_ms = e - s
            }
          }
        }
        return
      }
    }

    const existingIdx = stepIndex.get(stepName)
    if (existingIdx === undefined) {
      // New step begins — close the previous running step as passed.
      closeRunningStep(instance, row.ts)
      const next: WorkflowInstanceStep = {
        name: stepName,
        status: normaliseStepStatus(meta.status),
        duration_ms: null,
        started_at: row.ts,
        ended_at: null,
      }
      instance.steps.push(next)
      const idx = instance.steps.length - 1
      stepIndex.set(stepName, idx)
      instance.current_step = idx
      return
    }

    // Re-visit of an existing step — usually the terminal event.
    const existing = instance.steps[existingIdx]
    if (!existing) return
    const nextStatus = normaliseStepStatus(meta.status)
    if (nextStatus !== "running") {
      existing.status = nextStatus
      existing.ended_at = row.ts
      if (existing.started_at) {
        const s = parseIsoMs(existing.started_at)
        const e = parseIsoMs(row.ts)
        if (s !== null && e !== null) existing.duration_ms = e - s
      }
      if (instance.current_step === existingIdx) instance.current_step = -1
      if (nextStatus === "failed") instance.status = "failed"
    }
  }
}

function closeRunningStep(instance: WorkflowInstance, ts: string): void {
  if (instance.current_step < 0) return
  const cur = instance.steps[instance.current_step]
  if (!cur) return
  if (cur.status !== "running") return
  cur.status = "passed"
  cur.ended_at = ts
  if (cur.started_at) {
    const s = parseIsoMs(cur.started_at)
    const e = parseIsoMs(ts)
    if (s !== null && e !== null) cur.duration_ms = e - s
  }
}

function finaliseInstance(instance: WorkflowInstance): void {
  // If no explicit end event but every step is terminal, mark passed/failed
  // based on worst step status.
  if (instance.ended_at === null && instance.steps.length > 0) {
    const anyRunning = instance.steps.some((s) => s.status === "running")
    const anyFailed = instance.steps.some((s) => s.status === "failed")
    if (!anyRunning) {
      instance.status = anyFailed ? "failed" : "passed"
      const lastEnd = instance.steps
        .map((s) => s.ended_at)
        .filter((t): t is string => typeof t === "string")
        .sort()
        .pop()
      instance.ended_at = lastEnd ?? null
    }
  }
  // current_step invariant: -1 if no step is currently running.
  const runningIdx = instance.steps.findIndex((s) => s.status === "running")
  instance.current_step = runningIdx
}

function phaseStateToInstance(ps: RawPhaseState): WorkflowInstance | null {
  if (!ps.workflow_id) return null
  const steps: WorkflowInstanceStep[] = Array.isArray(ps.steps)
    ? ps.steps.map((s) => ({
        name: typeof s.name === "string" ? s.name : "step",
        status: normaliseStepStatus(s.status),
        duration_ms:
          typeof s.duration_ms === "number" && Number.isFinite(s.duration_ms)
            ? s.duration_ms
            : null,
        started_at: typeof s.started_at === "string" ? s.started_at : null,
        ended_at: typeof s.ended_at === "string" ? s.ended_at : null,
      }))
    : []
  return {
    id: ps.workflow_id,
    name: ps.name ?? ps.workflow_id,
    status: normaliseInstanceStatus(ps.status),
    started_at: ps.started_at ?? new Date(0).toISOString(),
    ended_at: ps.ended_at ?? null,
    steps,
    current_step: steps.findIndex((s) => s.status === "running"),
    origin: "phase-state",
  }
}

// ── File I/O driver ─────────────────────────────────────────────────────

export interface GetLiveInstancesOpts {
  /** Override CAE_ROOT — tests + multi-project setups. */
  root?: string
  /** Override the activity.jsonl path. */
  activityPath?: string
  /** Override the phases directory. Missing dir is tolerated. */
  phasesDir?: string
  /** Tail limit for activity.jsonl (default 5000). */
  tailLimit?: number
  /** Surface audit `cycle_step` rows (default true). */
  includeCycleSteps?: boolean
}

/**
 * Read both sources, run the reducer, return the instance list. Missing
 * files fall back to empty arrays — a fresh repo should render an empty
 * list, not explode.
 */
export async function getLiveInstances(
  opts: GetLiveInstancesOpts = {},
): Promise<WorkflowInstance[]> {
  const root = opts.root ?? CAE_ROOT
  const activityPath = opts.activityPath ?? ACTIVITY_JSONL_PATH
  const phasesDir = opts.phasesDir ?? join(root, ".planning", "phases")
  const tailLimit = opts.tailLimit ?? 5000

  const [rows, phaseStates] = await Promise.all([
    tailJsonl(activityPath, tailLimit).catch(() => []),
    readPhaseStates(phasesDir),
  ])

  return reduceWorkflowInstances(rows, phaseStates, {
    includeCycleSteps: opts.includeCycleSteps,
  })
}

async function readPhaseStates(phasesDir: string): Promise<RawPhaseState[]> {
  try {
    const s = await stat(phasesDir)
    if (!s.isDirectory()) return []
  } catch {
    return []
  }

  let dirs: string[]
  try {
    const entries = await readdir(phasesDir, { withFileTypes: true })
    dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }

  const results: RawPhaseState[] = []
  await Promise.all(
    dirs.map(async (name) => {
      const statePath = join(phasesDir, name, "state.json")
      try {
        const text = await readFile(statePath, "utf8")
        const parsed = JSON.parse(text) as unknown
        if (isRecord(parsed)) results.push(parsed as RawPhaseState)
      } catch {
        // No state.json for this phase → skip silently.
      }
    }),
  )
  return results
}

// ── ETag helper (server-only, used by /api/workflows/live) ─────────────

/**
 * Stable ETag for the instance list. Used by the API route to short-
 * circuit unchanged polls with a 304. Based on id+status+ended_at of the
 * current list so any transition invalidates. Not cryptographic.
 *
 * Kept server-side: the API route is the only consumer today. Client
 * components should import `formatDurationMs` and the types from
 * `./types` directly.
 */
export function etagFor(instances: WorkflowInstance[]): string {
  if (instances.length === 0) return '"empty"'
  const parts: string[] = []
  for (const i of instances) {
    parts.push(`${i.id}:${i.status}:${i.ended_at ?? ""}:${i.steps.length}`)
  }
  // Djb2-ish hash — plenty of collision space for a few dozen instances.
  let h = 5381
  const joined = parts.join("|")
  for (let i = 0; i < joined.length; i++) {
    h = ((h << 5) + h + joined.charCodeAt(i)) | 0
  }
  return `"w-${(h >>> 0).toString(16)}-${instances.length}"`
}
