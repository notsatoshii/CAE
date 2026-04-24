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
 */

export const dynamic = "force-dynamic"

import { Suspense } from "react"
import { getQueueState } from "@/lib/cae-queue-state"
import { labelFor } from "@/lib/copy/labels"
import { QueueKanbanClient } from "./queue-kanban-client"
import { NewJobModal } from "./new-job-modal"
import { QueueItemSheet } from "./queue-item-sheet"

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
      {/* class19b — queue-item-shaped sheet. Wires abort/retry/approve/deny
          to /api/queue/item/[taskId]/action and reads details from
          /api/queue/item/[taskId]. The 4 controls without backend support
          (pause / abandon / reassign / edit-plan) are HIDDEN, tracked in
          docs/queue-backend-gaps.md. */}
      <Suspense fallback={null}>
        <QueueItemSheet />
      </Suspense>
    </main>
  )
}
