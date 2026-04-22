/**
 * Phase 6 Queue page — KANBAN shell.
 *
 * Replaces the Phase 2 inbox/outbox tables with a 5-column KANBAN powered by
 * /api/queue (from 06-02). The Phase 2 `createDelegation` server action in
 * `./actions.ts` is UNTOUCHED; its form is reused verbatim inside a modal
 * opened by the "New job" button. Card clicks open the Phase 4
 * TaskDetailSheet via URL state (?sheet=open&task=...).
 *
 * Phase 2 legacy sub-routes at `/build/queue/inbox/[taskId]` and
 * `/build/queue/outbox/[taskId]` are left alone — this plan only rewrites
 * the root page.
 */

export const dynamic = "force-dynamic"

import { Suspense } from "react"
import { getQueueState } from "@/lib/cae-queue-state"
import { labelFor } from "@/lib/copy/labels"
import { QueueKanbanClient } from "./queue-kanban-client"
import { NewJobModal } from "./new-job-modal"
import { TaskDetailSheet } from "@/components/build-home/task-detail-sheet"
import { StatePollProvider } from "@/lib/hooks/use-state-poll"

export const metadata = { title: "Queue" }

export default async function QueuePage() {
  const initialState = await getQueueState()
  const t = labelFor(false)
  return (
    <main data-testid="queue-page" className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-[20px] font-semibold">{t.queueHeading}</h1>
        <NewJobModal />
      </div>
      <QueueKanbanClient initialState={initialState} />
      {/*
        TaskDetailSheet reads phaseSummary via useStatePoll, which requires
        StatePollProvider in the tree. Queue cards don't supply a phase
        number, so the sheet's `Number.isNaN(phaseNumber)` guard kicks in and
        renders "Phase ?" gracefully — acceptable for Phase 6. Full queue-
        task detail rendering is a later polish.
      */}
      <Suspense fallback={null}>
        <StatePollProvider>
          <TaskDetailSheet />
        </StatePollProvider>
      </Suspense>
    </main>
  )
}
