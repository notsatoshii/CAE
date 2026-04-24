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
 * Run button → gate dialog → POST /api/workflows/{slug}/run → sonner toast
 * with the returned taskId. The list stays on this page; the queue page is
 * the place to watch progress.
 *
 * Phase 14 Plan 04: currentRole prop gates the Run button via RoleGate.
 * Viewer-role users see a disabled "Read-only" button instead.
 */

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { BookMarked } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useDevMode } from "@/lib/providers/dev-mode"
import { labelFor } from "@/lib/copy/labels"
import { useGatedAction } from "@/lib/chat-gated-actions"
import { ConfirmActionDialog } from "@/components/chat/confirm-action-dialog"
import { EmptyState, EmptyStateActions } from "@/components/ui/empty-state"
import { RoleGate } from "@/components/auth/role-gate"
import type { WorkflowRecord } from "@/lib/cae-workflows"
import type { Role } from "@/lib/cae-types"

function relativeTime(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + "m ago"
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + "h ago"
  return Math.floor(diff / 86_400_000) + "d ago"
}

export function WorkflowsListClient({
  initialWorkflows,
  currentRole,
}: {
  initialWorkflows: WorkflowRecord[]
  currentRole?: Role
}) {
  const { dev } = useDevMode()
  const t = labelFor(dev)
  const router = useRouter()
  const [workflows] = useState(initialWorkflows)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const [runningSlug, setRunningSlug] = useState<string | null>(null)
  const [pendingRun, setPendingRun] = useState<{ slug: string; name: string } | null>(null)

  const gate = useGatedAction({
    spec: { type: "workflow_run", slug: pendingRun?.slug ?? "", priorRuns: [] },
    summary: pendingRun ? `Run the "${pendingRun.name}" recipe now` : "",
    onRun: async () => {
      if (!pendingRun) return
      const slug = pendingRun.slug
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
        setPendingRun(null)
      }
    },
  })

  if (workflows.length === 0) {
    return (
      <div data-testid="workflows-list-empty" data-liveness="empty">
        <span className="sr-only" data-truth="build-workflows.empty">yes</span>
        <span className="sr-only" data-truth="build-workflows.loading">no</span>
        <span className="sr-only" data-truth="build-workflows.count">0</span>
        <EmptyState
          testId="workflows-empty"
          icon={BookMarked}
          heading={t.emptyWorkflowsHeading}
          body={t.workflowsListEmpty}
          actions={
            <EmptyStateActions>
              <Button variant="secondary" onClick={() => router.push("/build/workflows/new")}>
                {t.emptyWorkflowsCtaRecipe}
              </Button>
            </EmptyStateActions>
          }
        />
      </div>
    )
  }

  return (
    <div data-testid="workflows-list-root" data-liveness="healthy">
      <span className="sr-only" data-truth="build-workflows.count">{workflows.length}</span>
      <span className="sr-only" data-truth="build-workflows.healthy">yes</span>
      <span className="sr-only" data-truth="build-workflows.loading">no</span>
      <span className="sr-only" data-truth="build-workflows.running">
        {runningSlug ?? "none"}
      </span>
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
                  <span>{t.workflowsListRowLastRun(mounted ? relativeTime(w.mtime) : new Date(w.mtime).toISOString().slice(0, 10))}</span>
                  {dev && (
                    <>
                      <span>·</span>
                      <span className="font-mono">{w.spec.trigger.type}</span>
                    </>
                  )}
                </div>
              </div>
              <RoleGate
                role="operator"
                currentRole={currentRole}
                fallback={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled
                    title="Ask an admin to give you operator access to run workflows"
                  >
                    Read-only
                  </Button>
                }
              >
                <Button
                  type="button"
                  data-testid={"workflow-run-button-" + w.slug}
                  variant="outline"
                  size="sm"
                  disabled={runningSlug === w.slug || gate.open}
                  onClick={() => {
                    setPendingRun({ slug: w.slug, name: w.spec.name ?? w.slug })
                    gate.request()
                  }}
                >
                  {runningSlug === w.slug
                    ? t.workflowsRunBtnPending
                    : t.workflowsListRowRunButton}
                </Button>
              </RoleGate>
            </CardContent>
          </Card>
        ))}
      </div>
      <ConfirmActionDialog {...gate.dialogProps} />
    </div>
  )
}
