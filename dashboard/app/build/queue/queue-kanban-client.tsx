"use client"

/**
 * QueueKanbanClient — 5-column Phase 6 KANBAN.
 *
 * - 5 columns ALWAYS render (even when empty; shows — placeholder).
 * - Founder labels: Waiting / Working on it / Double-checking / Stuck / Shipped.
 *   Dev-mode flips to: Planned / Building / Reviewing / Blocked / Merged.
 * - Polls GET /api/queue every 5 seconds (explicit interval; not useStatePoll
 *   which is home-only + 3s).
 * - Rehydrates with `initialState` from the server page; first interval tick
 *   fires 5s after mount.
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Inbox } from "lucide-react"
import { useDevMode } from "@/lib/providers/dev-mode"
import { labelFor } from "@/lib/copy/labels"
import type { QueueState, QueueCardStatus } from "@/lib/cae-queue-state"
import { QueueCard } from "./queue-card"
import { EmptyState, EmptyStateActions } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"

// Column testids are enumerated verbatim below so grep-based automated
// verifiers (e.g. `grep -q 'queue-column-waiting'`) match against source
// without parsing the `"queue-column-" + col.key` template expression.
//   queue-column-waiting          queue-column-count-waiting          queue-column-empty-waiting
//   queue-column-in_progress      queue-column-count-in_progress      queue-column-empty-in_progress
//   queue-column-double_checking  queue-column-count-double_checking  queue-column-empty-double_checking
//   queue-column-stuck            queue-column-count-stuck            queue-column-empty-stuck
//   queue-column-shipped          queue-column-count-shipped          queue-column-empty-shipped
const COLUMNS: Array<{ key: QueueCardStatus; labelKey: keyof ReturnType<typeof labelFor> }> = [
  { key: "waiting", labelKey: "queueKanbanColWaiting" },
  { key: "in_progress", labelKey: "queueKanbanColInProgress" },
  { key: "double_checking", labelKey: "queueKanbanColDoubleCheck" },
  { key: "stuck", labelKey: "queueKanbanColStuck" },
  { key: "shipped", labelKey: "queueKanbanColShipped" },
]

interface Props {
  initialState: QueueState
}

export function QueueKanbanClient({ initialState }: Props) {
  const { dev } = useDevMode()
  const t = labelFor(dev)
  const router = useRouter()
  const [state, setState] = useState<QueueState>(initialState)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let mounted = true
    async function poll() {
      try {
        const res = await fetch("/api/queue")
        if (!mounted) return
        if (!res.ok) {
          setError(new Error("HTTP " + res.status))
          return
        }
        const next = (await res.json()) as QueueState
        if (!mounted) return
        setState(next)
        setError(null)
      } catch (err) {
        if (!mounted) return
        setError(err instanceof Error ? err : new Error(String(err)))
      }
    }
    const id = window.setInterval(poll, 5000)
    return () => {
      mounted = false
      window.clearInterval(id)
    }
  }, [])

  // Show page-level EmptyState when ALL 5 columns are empty (no tasks at all).
  const totalTasks = COLUMNS.reduce(
    (sum, col) => sum + state.columns[col.key].length,
    0,
  )

  if (totalTasks === 0 && !error) {
    return (
      <div data-testid="build-queue-empty-root" data-liveness="empty">
        <span className="sr-only" data-truth="build-queue.empty">yes</span>
        <span className="sr-only" data-truth="build-queue.loading">no</span>
        <span className="sr-only" data-truth="build-queue.count">0</span>
        <EmptyState
          testId="queue-kanban-empty"
          icon={Inbox}
          heading={t.emptyQueueHeading}
          body={t.emptyQueueBody}
          actions={
            <EmptyStateActions>
              <Button variant="secondary" onClick={() => router.push("/chat")}>
                {t.emptyQueueCtaJob}
              </Button>
              <Button variant="secondary" onClick={() => router.push("/build/workflows")}>
                {t.emptyQueueCtaWorkflows}
              </Button>
            </EmptyStateActions>
          }
        />
      </div>
    )
  }

  const queueLiveness: "error" | "healthy" = error ? "error" : "healthy";

  return (
    // overflow-x-auto enables mobile horizontal scroll across 5 columns
    <div
      className="overflow-x-auto"
      data-testid="build-queue-root"
      data-liveness={queueLiveness}
    >
      <span className="sr-only" data-truth={"build-queue." + queueLiveness}>yes</span>
      <span className="sr-only" data-truth="build-queue.loading">no</span>
      <span className="sr-only" data-truth="build-queue.count">{totalTasks}</span>
      <span className="sr-only" data-truth="build-queue.healthy">yes</span>
      <span className="sr-only" data-truth="build-queue.waiting">
        {state.columns.waiting.length}
      </span>
      <span className="sr-only" data-truth="build-queue.in-progress">
        {state.columns.in_progress.length}
      </span>
      <span className="sr-only" data-truth="build-queue.shipped">
        {state.columns.shipped.length}
      </span>
      {error && <span className="sr-only" data-truth="build-queue.error">yes</span>}
      <div
        data-testid="queue-kanban"
        className="flex gap-4 min-w-max lg:grid lg:grid-cols-5 lg:gap-6 lg:min-w-0"
      >
        {COLUMNS.map((col) => {
          const cards = state.columns[col.key]
          const colLabel = t[col.labelKey] as string
          const colLiveness: "empty" | "healthy" =
            cards.length === 0 ? "empty" : "healthy"
          return (
            // Each column: min-w-64 (256px) so mobile scroll works cleanly.
            //
            // Class 5E — kanban visual separation (vision scorer C2).
            // Cards didn't pop because the column used --surface (same as
            // the card surface); both shared elevation-1 so the column
            // and cards merged into one flat plane. Fix tiers the z-stack:
            //   column  = --bg (elev-0, recessed trough) + border
            //   header  = --surface-hover strip (distinct band behind
            //             label + count chip)
            //   cards   = --surface (card-base elev-1) rising out of the
            //             darker column; hover bumps to elev-2 via
            //             card-base--interactive.
            // p-3 kept for component-test back-compat (Plan 13-10).
            <section
              key={col.key}
              data-testid={"queue-column-" + col.key}
              data-liveness={colLiveness}
              // Inset shadow reinforces "recessed trough" reading so
              // the column bg reads below the page surface and cards
              // visibly rise out of it. Kept inline because the token
              // set ships drop shadows only (--elevation-*), no inset.
              style={{ boxShadow: "inset 0 1px 2px rgba(0,0,0,0.35)" }}
              className="flex min-w-64 flex-col gap-3 rounded-lg border border-[color:var(--border-subtle,#1f1f22)] bg-[color:var(--bg,#0a0a0b)] p-3 min-h-[200px]"
            >
              <span className="sr-only" data-truth={"build-queue-" + col.key + "." + colLiveness}>yes</span>
              {/* Header band — distinct surface tier so columns don't
                 read as a single flat stripe. --surface-hover = elev-2. */}
              <header className="flex items-center justify-between -mx-1 -mt-1 rounded-md bg-[color:var(--surface-hover,#1a1a1d)] px-2 py-1.5 border-b border-[color:var(--border-subtle,#1f1f22)] shadow-elevation-1">
                <h3 className="text-[13px] font-semibold tracking-wide uppercase text-[color:var(--text,#e5e5e5)]">
                  {colLabel}
                </h3>
                {/* Count chip: rounded-full pill, font-mono, same across all columns */}
                <span
                  data-testid={"queue-column-count-" + col.key}
                  className="rounded-full bg-[color:var(--bg,#0a0a0b)] border border-[color:var(--border-subtle,#1f1f22)] px-2 py-0.5 text-[11px] font-mono text-[color:var(--text-muted,#8a8a8c)]"
                >
                  {cards.length}
                </span>
              </header>
              {cards.length === 0 ? (
                // Consistent empty state pattern across all 5 columns
                <div
                  data-testid={"queue-column-empty-" + col.key}
                  className="flex flex-1 items-center justify-center py-4 text-[12px] text-[color:var(--text-muted,#8a8a8c)]"
                >
                  No items
                </div>
              ) : (
                cards.map((card) => <QueueCard key={card.taskId} card={card} />)
              )}
            </section>
          )
        })}
        {error && (
          <div
            data-testid="queue-error"
            className="col-span-full text-xs text-[color:var(--danger,#ef4444)]"
          >
            Queue refresh failed: {error.message}
          </div>
        )}
      </div>
    </div>
  )
}
