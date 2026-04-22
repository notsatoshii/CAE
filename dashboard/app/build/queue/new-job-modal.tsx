"use client"

/**
 * NewJobModal — Phase 6 wrapper around the preserved Phase 2 DelegateForm.
 *
 * The Phase 2 `createDelegation` server action + DelegateForm are untouched
 * (DelegateForm got ONE additive prop: `onSuccess?`). When the user clicks
 * the trigger, we open a Dialog with the form inside. On success, we toast
 * the new task id and close the modal — the KANBAN's 5-second poll picks up
 * the new job within the next tick.
 */

import { useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useDevMode } from "@/lib/providers/dev-mode"
import { labelFor } from "@/lib/copy/labels"
import { DelegateForm } from "./delegate-form"

export function NewJobModal() {
  const [open, setOpen] = useState(false)
  const { dev } = useDevMode()
  const t = labelFor(dev)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button data-testid="queue-new-job-trigger" type="button">
            {t.queueKanbanNewJobButton}
          </Button>
        }
      />
      <DialogContent data-testid="queue-new-job-modal" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.queueKanbanNewJobModalTitle}</DialogTitle>
        </DialogHeader>
        <DelegateForm
          onSuccess={(taskId) => {
            toast.success("Job queued", { description: taskId })
            setOpen(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
