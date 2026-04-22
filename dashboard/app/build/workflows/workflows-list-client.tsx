"use client"

/**
 * WorkflowsListClient — client component rendering saved workflow cards
 * with a "Run now" action on each row.
 *
 * Copy flips via `useDevMode()` + `labelFor(dev)`. The server component
 * (`./page.tsx`) fetches `listWorkflows()` directly and passes the
 * sorted records in as `initialWorkflows` — this component never
 * re-fetches; a Next `router.refresh()` from the form will re-render
 * the server boundary if a workflow is saved or deleted.
 *
 * Run button → POST /api/workflows/{slug}/run → sonner toast with the
 * returned taskId. The list stays on this page; the queue page is the
 * place to watch progress.
 */

import { useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useDevMode } from "@/lib/providers/dev-mode"
import { labelFor } from "@/lib/copy/labels"
import type { WorkflowRecord } from "@/lib/cae-workflows"

function relativeTime(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + "m ago"
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + "h ago"
  return Math.floor(diff / 86_400_000) + "d ago"
}

export function WorkflowsListClient({
  initialWorkflows,
}: {
  initialWorkflows: WorkflowRecord[]
}) {
  const { dev } = useDevMode()
  const t = labelFor(dev)
  const [workflows] = useState(initialWorkflows)
  const [runningSlug, setRunningSlug] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function runWorkflow(slug: string) {
    setRunningSlug(slug)
    try {
      const res = await fetch(
        "/api/workflows/" + encodeURIComponent(slug) + "/run",
        { method: "POST" },
      )
      if (!res.ok) {
        const body = await res
          .json()
          .catch(() => ({ error: "HTTP " + res.status }))
        toast.error(body.error ?? "Run failed")
        return
      }
      const body = (await res.json()) as {
        taskId: string
        slug: string
        ts: number
      }
      toast.success("Started — task " + body.taskId, {
        description: "Open Queue to watch progress.",
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Run failed")
    } finally {
      setRunningSlug(null)
    }
  }

  if (workflows.length === 0) {
    return (
      <Card data-testid="workflows-empty">
        <CardContent className="py-10 text-center text-sm text-[color:var(--text-muted,#8a8a8c)]">
          {t.workflowsListEmpty}
        </CardContent>
      </Card>
    )
  }

  return (
    <div data-testid="workflows-list" className="flex flex-col gap-3">
      {workflows.map((w) => (
        <Card key={w.slug} data-testid={"workflow-row-" + w.slug}>
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Link
                href={"/build/workflows/" + encodeURIComponent(w.slug)}
                className="text-sm font-medium hover:text-[color:var(--accent,#00d4ff)]"
              >
                {w.spec.name}
              </Link>
              {w.spec.description && (
                <p className="text-xs text-[color:var(--text-muted,#8a8a8c)] mt-1 truncate">
                  {w.spec.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-[color:var(--text-muted,#8a8a8c)]">
                <span data-testid={"workflow-row-stepcount-" + w.slug}>
                  {t.workflowsListRowStepCount(w.spec.steps.length)}
                </span>
                <span>·</span>
                <span>{t.workflowsListRowLastRun(relativeTime(w.mtime))}</span>
                {dev && (
                  <>
                    <span>·</span>
                    <span className="font-mono">{w.spec.trigger.type}</span>
                  </>
                )}
              </div>
            </div>
            <Button
              type="button"
              data-testid={"workflow-run-button-" + w.slug}
              variant="outline"
              size="sm"
              disabled={runningSlug === w.slug}
              onClick={() => startTransition(() => void runWorkflow(w.slug))}
            >
              {runningSlug === w.slug
                ? t.workflowsRunBtnPending
                : t.workflowsListRowRunButton}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
