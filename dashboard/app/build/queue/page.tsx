/**
 * Phase 6 Queue page — KANBAN shell.
 *
 * Replaces the Phase 2 inbox/outbox tables with a 5-column KANBAN powered by
 * /api/queue (from 06-02). The Phase 2 `createDelegation` server action in
 * `./actions.ts` is UNTOUCHED; its form is reused verbatim inside a modal
 * opened by the "New job" button. Card clicks open the class19b
 * QueueItemSheet via URL state (?sheet=open&task=...).
 *
 * Phase 2 legacy sub-routes at `/build/queue/inbox/[taskId]` and
 * `/build/queue/outbox/[taskId]` are left alone — this plan only rewrites
 * the root page.
 *
 * class19b — swapped TaskDetailSheet (phase-shaped, 8 toast.info stubs) for
 * the new QueueItemSheet (queue-item-shaped, wires real backend endpoints
 * for abort/retry/approve/deny and hides the 4 controls without a backend).
 * StatePollProvider removed from here — it was only needed by the old
 * phase-oriented sheet.
 *
 * P17-W1: getQueueState() moved into a Suspense boundary so the page shell
 * (heading + NewJobModal) renders immediately regardless of queue FS latency.
 */

export const dynamic = "force-dynamic"

import { Suspense } from "react"
import { getQueueState } from "@/lib/cae-queue-state"
import { labelFor } from "@/lib/copy/labels"
import { QueueKanbanClient } from "./queue-kanban-client"
import { NewJobModal } from "./new-job-modal"
import { QueueItemSheet } from "./queue-item-sheet"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "Queue" }

const t = labelFor(false)

export default function QueuePage() {
  return (
    <main data-testid="queue-page" className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="type-hero" data-testid="queue-page-heading">{t.queueHeading}</h1>
        <NewJobModal />
      </div>
      <Suspense fallback={<QueueLoadingSkeleton />}>
        <QueueContent />
      </Suspense>
      <Suspense fallback={null}>
        <QueueItemSheet />
      </Suspense>
    </main>
  )
}

async function QueueContent() {
  const initialState = await getQueueState()
  return <QueueKanbanClient initialState={initialState} />
}

function QueueLoadingSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading queue"
      data-testid="queue-loading-skeleton"
    >
      <span className="sr-only" data-truth="build-queue.loading">yes</span>
      <div className="grid grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-6 w-full rounded" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}
