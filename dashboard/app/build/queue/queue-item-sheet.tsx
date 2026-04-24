"use client";

/**
 * QueueItemSheet — clicked-card sheet for the /build/queue KANBAN.
 *
 * Replaces the old shared TaskDetailSheet (which was built for phase-shaped
 * data) on the queue page. class19b fix: wires the 8 previously-stubbed
 * controls and kills the hardcoded "Phase 8/9" strings.
 *
 * Data flow:
 *   1. Sheet opens when ?sheet=open&task={taskId} appears in the URL.
 *   2. Fetches GET /api/queue/item/[taskId] to hydrate title / summary /
 *      tags / log path / status flags.
 *   3. Renders sections: header, summary, live log, actions.
 *   4. Action buttons POST /api/queue/item/[taskId]/action with
 *      {action: "abort" | "retry" | "approve" | "deny"} — on success we
 *      close + router.refresh() so the kanban repolls.
 *
 * Buttons that still have no backend are HIDDEN (not stubbed). Missing
 * backends are catalogued in `docs/queue-backend-gaps.md`.
 *
 *   wired:   abort, retry, approve, deny
 *   hidden:  pause, abandon, reassign, edit-plan
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SheetLiveLog } from "@/components/build-home/sheet-live-log";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface QueueItemDetail {
  taskId: string;
  title: string;
  summary: string;
  logPath: string;
  buildplanPath: string;
  ts: number;
  tags: string[];
  status: "waiting" | "in_progress" | "double_checking" | "stuck" | "shipped";
  hasReviewMarker: boolean;
  hasHaltMarker: boolean;
  hasDone: boolean;
  running: boolean;
  outboxStatus: string | null;
}

// Status → founder-friendly label. Owned here (not labels.ts) so the sheet
// stays self-contained and doesn't drag in the old phase-shaped copy keys.
const STATUS_LABEL: Record<QueueItemDetail["status"], string> = {
  waiting: "Waiting",
  in_progress: "Working on it",
  double_checking: "Awaiting review",
  stuck: "Stuck",
  shipped: "Shipped",
};

export function QueueItemSheet() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const taskId = searchParams?.get("task") ?? "";
  const open = searchParams?.get("sheet") === "open" && taskId.length > 0;

  const [item, setItem] = useState<QueueItemDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  // Fetch on open.
  useEffect(() => {
    if (!open || !taskId) {
      setItem(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/queue/item/" + encodeURIComponent(taskId))
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body?.error ?? "HTTP " + res.status);
          setItem(null);
          return;
        }
        const body = (await res.json()) as QueueItemDetail;
        if (cancelled) return;
        setItem(body);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, taskId]);

  const closeSheet = useCallback(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("sheet");
    params.delete("task");
    const qs = params.toString();
    router.push((pathname ?? "/build/queue") + (qs ? "?" + qs : ""));
  }, [router, pathname, searchParams]);

  const invoke = useCallback(
    async (action: "abort" | "retry" | "approve" | "deny") => {
      if (!taskId) return;
      setPendingAction(action);
      try {
        const res = await fetch(
          "/api/queue/item/" + encodeURIComponent(taskId) + "/action",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ action }),
          },
        );
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (!res.ok || body.ok === false) {
          toast.error(action + " failed: " + (body.error ?? "HTTP " + res.status));
          return;
        }
        toast.success(action + " succeeded");
        // Let the kanban see the new marker.
        router.refresh();
        closeSheet();
      } catch (err) {
        toast.error(
          action + " failed: " + (err instanceof Error ? err.message : String(err)),
        );
      } finally {
        setPendingAction(null);
      }
    },
    [taskId, router, closeSheet],
  );

  // Which action buttons to render. We hide anything without a backend —
  // see docs/queue-backend-gaps.md for the full catalogue of missing
  // endpoints (pause / abandon / reassign / edit-plan).
  const showApproveDeny = item?.status === "double_checking";
  const showRetry = item?.status === "stuck";
  // Abort only makes sense while the task can still progress.
  const showAbort =
    item?.status === "in_progress" ||
    item?.status === "waiting" ||
    item?.status === "double_checking";

  const title = item?.title ?? (loading ? "Loading…" : taskId || "Queue item");

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) closeSheet();
      }}
    >
      <SheetContent
        side="right"
        data-testid="queue-item-sheet"
        data-task-id={item?.taskId ?? taskId}
        data-status={item?.status ?? "loading"}
        className="sm:max-w-[50vw] w-full flex flex-col p-0"
      >
        <SheetHeader className="px-5 py-4 border-b border-[color:var(--border-subtle)] shrink-0">
          <div className="flex items-start justify-between gap-4">
            <SheetTitle
              className="text-base"
              data-testid="queue-item-sheet-title"
            >
              {title}
            </SheetTitle>
            {item && (
              <span
                data-testid="queue-item-sheet-status"
                className="text-[11px] uppercase tracking-wide font-mono text-[color:var(--text-muted)] border border-[color:var(--border-subtle)] rounded-full px-2 py-0.5"
              >
                {STATUS_LABEL[item.status]}
              </span>
            )}
          </div>
          {item && item.tags.length > 0 && (
            <div
              data-testid="queue-item-sheet-tags"
              className="flex flex-wrap gap-1 mt-2"
            >
              {item.tags.slice(0, 6).map((tag) => (
                <span
                  key={tag}
                  className="rounded px-1.5 py-0.5 text-[10px] bg-[color:var(--surface-hover,#1a1a1d)] text-[color:var(--text-muted,#8a8a8c)]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Summary */}
          <section data-testid="queue-item-sheet-summary">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)] mb-2">
              Summary
            </h3>
            {loading && !item ? (
              <Skeleton
                testId="queue-item-sheet-summary-skeleton"
                height={16}
                width="70%"
                variant="text"
                label="Loading queue item"
              />
            ) : error ? (
              <p
                data-testid="queue-item-sheet-error"
                className="text-sm text-[color:var(--danger,#ef4444)]"
              >
                {error}
              </p>
            ) : item ? (
              <p className="text-sm text-[color:var(--text)]">{item.summary}</p>
            ) : null}
          </section>

          {/* Live log — re-uses the existing SSE tail component. */}
          <section data-testid="queue-item-sheet-log">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)] mb-2">
              Live activity
            </h3>
            <SheetLiveLog path={item?.logPath ?? ""} />
          </section>

          {/* Actions */}
          <section data-testid="queue-item-sheet-actions">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)] mb-2">
              Actions
            </h3>
            <div className="flex flex-wrap gap-2">
              {showApproveDeny && (
                <>
                  <button
                    type="button"
                    data-testid="queue-item-action-approve"
                    onClick={() => invoke("approve")}
                    disabled={pendingAction !== null}
                    aria-label="Approve this task's review"
                    className={cn(buttonVariants({ variant: "default", size: "sm" }))}
                  >
                    {pendingAction === "approve" ? "Approving…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    data-testid="queue-item-action-deny"
                    onClick={() => invoke("deny")}
                    disabled={pendingAction !== null}
                    aria-label="Deny this task's review"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    {pendingAction === "deny" ? "Denying…" : "Deny"}
                  </button>
                </>
              )}
              {showRetry && (
                <button
                  type="button"
                  data-testid="queue-item-action-retry"
                  onClick={() => invoke("retry")}
                  disabled={pendingAction !== null}
                  aria-label="Retry this task"
                  className={cn(buttonVariants({ variant: "default", size: "sm" }))}
                >
                  {pendingAction === "retry" ? "Retrying…" : "Retry"}
                </button>
              )}
              {showAbort && (
                <button
                  type="button"
                  data-testid="queue-item-action-abort"
                  onClick={() => {
                    if (
                      typeof window !== "undefined" &&
                      !window.confirm("Abort this task?")
                    )
                      return;
                    invoke("abort");
                  }}
                  disabled={pendingAction !== null}
                  aria-label="Abort this task"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  {pendingAction === "abort" ? "Aborting…" : "Abort"}
                </button>
              )}
              {/* If none of the above apply (e.g. shipped item), show a stub
                   line so testers don't think the panel is broken. */}
              {!showApproveDeny && !showRetry && !showAbort && (
                <p
                  data-testid="queue-item-actions-empty"
                  className="text-xs text-[color:var(--text-muted)]"
                >
                  No actions available for this item.
                </p>
              )}
            </div>
          </section>

          {/* BUILDPLAN link */}
          {item && (
            <section data-testid="queue-item-sheet-meta">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)] mb-2">
                Task details
              </h3>
              <dl className="text-xs grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1">
                <dt className="text-[color:var(--text-muted)]">Task id</dt>
                <dd
                  data-testid="queue-item-sheet-taskid"
                  className="font-mono truncate"
                >
                  {item.taskId}
                </dd>
                <dt className="text-[color:var(--text-muted)]">Buildplan</dt>
                <dd className="font-mono truncate" title={item.buildplanPath}>
                  {item.buildplanPath}
                </dd>
                {item.outboxStatus && (
                  <>
                    <dt className="text-[color:var(--text-muted)]">Outbox</dt>
                    <dd className="font-mono">{item.outboxStatus}</dd>
                  </>
                )}
              </dl>
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
