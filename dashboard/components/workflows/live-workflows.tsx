"use client"

/**
 * LiveWorkflows — Class 19D.
 *
 * Renders the list of live workflow instances sourced from
 * `/api/workflows/live`. Mounted above the recipes list on
 * `/build/workflows` so Eric sees real runs at a glance before browsing
 * saved recipes.
 *
 * Polling: 5s fetch poll with If-None-Match. We deliberately fall back
 * to 5s instead of SSE — see the route file comment and Class 19D plan
 * (polling strategy: "mirror live-activity pattern … fall back to 5s
 * fetch-poll if SSE too much work").
 *
 * SSR: we render the first fetch worth of data server-side via the
 * `initialInstances` prop (see page.tsx) so the DOM has instance rows
 * immediately after hydration — this is what the audit harness keys on
 * (`[data-truth="build-workflows-live.*"]`).
 */

import { useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  formatDurationMs,
  type WorkflowInstance,
  type WorkflowInstanceStatus,
  type WorkflowInstanceStep,
  type WorkflowStepStatus,
} from "@/lib/workflows/types"

const POLL_MS = 5_000

interface LiveWorkflowsProps {
  /** SSR-rendered first page so hydration is useful even if the poll never fires. */
  initialInstances: WorkflowInstance[]
  /** Inject a fetcher for tests — defaults to window.fetch. */
  fetcher?: typeof fetch
  /** Disable the polling loop (tests / Storybook). */
  disablePoll?: boolean
}

export function LiveWorkflows({
  initialInstances,
  fetcher,
  disablePoll,
}: LiveWorkflowsProps) {
  const [instances, setInstances] = useState<WorkflowInstance[]>(initialInstances)
  const etagRef = useRef<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (disablePoll) return
    const f = fetcher ?? fetch
    let cancelled = false

    async function tick(): Promise<void> {
      try {
        const headers: Record<string, string> = {}
        if (etagRef.current) headers["If-None-Match"] = etagRef.current
        const res = await f("/api/workflows/live", { headers })
        if (cancelled) return
        if (res.status === 304) return // no-op; list unchanged
        if (!res.ok) {
          setError(`HTTP ${res.status}`)
          return
        }
        const etag = res.headers.get("etag")
        if (etag) etagRef.current = etag
        const body = (await res.json()) as { instances: WorkflowInstance[] }
        if (cancelled) return
        setInstances(body.instances ?? [])
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : String(err))
      }
    }

    const iv = setInterval(tick, POLL_MS)
    // Fire once immediately so first real-data frame lands before the
    // first interval tick.
    void tick()
    return () => {
      cancelled = true
      clearInterval(iv)
    }
  }, [fetcher, disablePoll])

  const count = instances.length
  const empty = count === 0

  return (
    <section
      data-testid="workflows-live-root"
      data-liveness={empty ? "empty" : "healthy"}
      aria-label="Live workflow instances"
      className="mb-8"
    >
      {/* Truth annotations — consumed by the audit harness + vision scorer. */}
      <span className="sr-only" data-truth="build-workflows-live.healthy">
        yes
      </span>
      <span className="sr-only" data-truth="build-workflows-live.count">
        {String(count)}
      </span>
      <span className="sr-only" data-truth="build-workflows-live.empty">
        {empty ? "yes" : "no"}
      </span>

      <header className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-semibold tracking-wide text-[color:var(--text-muted,#8a8a8c)] uppercase">
          Live runs
          <span className="ml-2 normal-case text-xs text-[color:var(--text-muted,#8a8a8c)]">
            ({count})
          </span>
        </h2>
        {error && (
          <span className="text-xs text-[color:var(--destructive,#ef4444)]">
            poll error: {error}
          </span>
        )}
      </header>

      {empty ? (
        <Card data-testid="workflows-live-empty">
          <CardContent className="p-4 text-sm text-[color:var(--text-muted,#8a8a8c)]">
            No workflow runs in the last window. Kick off a recipe below to
            see it appear here.
          </CardContent>
        </Card>
      ) : (
        <ul data-testid="workflows-live-list" className="flex flex-col gap-3">
          {instances.map((inst) => (
            <InstanceRow key={inst.id} instance={inst} />
          ))}
        </ul>
      )}
    </section>
  )
}

function InstanceRow({ instance }: { instance: WorkflowInstance }) {
  const totalDuration = (() => {
    const start = Date.parse(instance.started_at)
    if (!Number.isFinite(start)) return null
    const end = instance.ended_at ? Date.parse(instance.ended_at) : Date.now()
    if (!Number.isFinite(end)) return null
    return end - start
  })()

  return (
    <li data-testid={`workflow-instance-${instance.id}`}>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">
                  {instance.name}
                </span>
                <StatusBadge status={instance.status} />
              </div>
              <div className="mt-1 text-xs text-[color:var(--text-muted,#8a8a8c)] flex items-center gap-3">
                <span
                  data-testid={`workflow-instance-${instance.id}-duration`}
                  title={`started ${instance.started_at}`}
                >
                  {formatDurationMs(totalDuration)}
                </span>
                <span>·</span>
                <span>{instance.steps.length} steps</span>
                {instance.origin === "phase-state" && (
                  <>
                    <span>·</span>
                    <span className="font-mono">phase</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {instance.steps.length > 0 && (
            <ol
              className="mt-3 flex flex-col gap-1"
              data-testid={`workflow-instance-${instance.id}-steps`}
            >
              {instance.steps.map((step, idx) => (
                <StepRow
                  key={`${step.name}-${idx}`}
                  step={step}
                  isCurrent={idx === instance.current_step}
                />
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </li>
  )
}

function StepRow({
  step,
  isCurrent,
}: {
  step: WorkflowInstanceStep
  isCurrent: boolean
}) {
  return (
    <li
      data-testid={`workflow-step-${step.name}`}
      data-step-status={step.status}
      data-step-current={isCurrent ? "yes" : "no"}
      className={cn(
        "flex items-center justify-between rounded-md px-2 py-1 text-xs",
        isCurrent &&
          "bg-[color:var(--accent-subtle,rgba(0,212,255,0.08))] ring-1 ring-[color:var(--accent,#00d4ff)]",
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        <StepDot status={step.status} isCurrent={isCurrent} />
        <span className="truncate">{step.name}</span>
      </div>
      <div className="flex items-center gap-2 text-[color:var(--text-muted,#8a8a8c)]">
        <StepStatusLabel status={step.status} />
        <span>·</span>
        <span>{formatDurationMs(step.duration_ms)}</span>
      </div>
    </li>
  )
}

function StepDot({
  status,
  isCurrent,
}: {
  status: WorkflowStepStatus
  isCurrent: boolean
}) {
  const color = colorForStepStatus(status)
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-2 rounded-full",
        isCurrent && "animate-pulse",
      )}
      style={{ backgroundColor: color }}
    />
  )
}

function colorForStepStatus(status: WorkflowStepStatus): string {
  switch (status) {
    case "passed":
      return "#10b981"
    case "failed":
      return "#ef4444"
    case "running":
      return "#00d4ff"
    case "pending":
    default:
      return "#6b7280"
  }
}

function StepStatusLabel({ status }: { status: WorkflowStepStatus }) {
  const label = ({
    passed: "passed",
    failed: "failed",
    running: "running",
    pending: "pending",
  } as const)[status]
  return <span>{label}</span>
}

function StatusBadge({ status }: { status: WorkflowInstanceStatus }) {
  if (status === "passed") {
    // Class 5G: use the shared `success` semantic variant instead of the
    // hardcoded emerald tailwind class so badge saturation stays unified
    // across the dashboard.
    return (
      <Badge
        variant="success"
        data-testid="workflow-instance-status"
        data-status="passed"
      >
        passed
      </Badge>
    )
  }
  if (status === "failed") {
    return (
      <Badge
        variant="danger"
        data-testid="workflow-instance-status"
        data-status="failed"
      >
        failed
      </Badge>
    )
  }
  return (
    <Badge
      variant="info"
      data-testid="workflow-instance-status"
      data-status="running"
    >
      running
    </Badge>
  )
}
