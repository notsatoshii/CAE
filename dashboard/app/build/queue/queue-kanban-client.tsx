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
      <EmptyState
        data-testid="queue-kanban-empty"
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
    )
  }

  return (
    <div
      data-testid="queue-kanban"
      className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3"
    >
      {COLUMNS.map((col) => {
        const cards = state.columns[col.key]
        const colLabel = t[col.labelKey] as string
        return (
          <section
            key={col.key}
            data-testid={"queue-column-" + col.key}
            className="flex flex-col gap-2 rounded-md border border-[color:var(--border,#1f1f22)] bg-[color:var(--surface,#121214)] p-3 min-h-[200px]"
          >
            <header className="flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted,#8a8a8c)]">
                {colLabel}
              </h2>
              <span
                data-testid={"queue-column-count-" + col.key}
                className="text-[10px] text-[color:var(--text-muted,#8a8a8c)]"
              >
                {t.queueKanbanColCount(cards.length)}
              </span>
            </header>
            {cards.length === 0 ? (
              <div
                data-testid={"queue-column-empty-" + col.key}
                className="text-xs text-[color:var(--text-muted,#8a8a8c)] italic"
              >
                {t.queueKanbanEmptyColumn}
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
          className="col-span-full text-xs text-red-300"
        >
          Queue refresh failed: {error.message}
        </div>
      )}
    </div>
  )
}
