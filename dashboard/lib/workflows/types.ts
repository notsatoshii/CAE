/**
 * lib/workflows/types.ts — browser-safe types + pure helpers for Class 19D.
 *
 * `lib/workflows/live-instances.ts` has Node-only imports (fs/promises +
 * cae-state) which the Next bundler refuses to ship to client components.
 * Client-side surfaces (components/workflows/live-workflows.tsx) import
 * types + pure formatters from here; server routes still import the full
 * file for I/O + the reducer.
 */

export type WorkflowInstanceStatus = "running" | "passed" | "failed"

export type WorkflowStepStatus = "running" | "passed" | "failed" | "pending"

export interface WorkflowInstanceStep {
  name: string
  status: WorkflowStepStatus
  duration_ms: number | null
  started_at: string | null
  ended_at: string | null
}

export interface WorkflowInstance {
  id: string
  name: string
  status: WorkflowInstanceStatus
  started_at: string
  ended_at: string | null
  steps: WorkflowInstanceStep[]
  current_step: number
  origin: "activity" | "phase-state"
}

export function formatDurationMs(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return "—"
  if (ms < 0) return "—"
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = ms / 1000
  if (s < 10) return `${s.toFixed(1)}s`
  if (s < 60) return `${Math.round(s)}s`
  const m = Math.floor(s / 60)
  const remSec = Math.round(s - m * 60)
  if (m < 60) return `${m}m ${String(remSec).padStart(2, "0")}s`
  const h = Math.floor(m / 60)
  const remMin = m - h * 60
  return `${h}h ${String(remMin).padStart(2, "0")}m`
}
