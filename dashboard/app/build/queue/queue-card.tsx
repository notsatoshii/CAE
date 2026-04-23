"use client"

/**
 * QueueCard — single dense card for the Phase 6 KANBAN.
 *
 * Renders agent emoji + task title + project · relative-time + up to 3 tags.
 * Shows a pulsing cyan dot on `in_progress` cards (the "running now" indicator).
 *
 * Click (or Enter/Space) opens the Phase 4 TaskDetailSheet via URL state:
 *   ?sheet=open&task={taskId}&project={project}
 * Phase 6 queue cards don't map to a specific phase number — the sheet
 * gracefully handles missing/NaN phase (per task-detail-sheet.tsx §line 93,
 * `Number.isNaN(phaseNumber)` guard).
 *
 * Phase 15 Wave 2.1 — Surface uses `.card-base card-base--interactive`
 * (globals.css). Status accent stays as a 2px left ribbon.
 */

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { agentMetaFor } from "@/lib/copy/agent-meta"
import { labelFor } from "@/lib/copy/labels"
import { useDevMode } from "@/lib/providers/dev-mode"
import type { QueueCard as QueueCardData } from "@/lib/cae-queue-state"

function relativeTime(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000) return "just now"
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + "m ago"
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + "h ago"
  return Math.floor(diff / 86_400_000) + "d ago"
}

export function QueueCard({ card }: { card: QueueCardData }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { dev } = useDevMode()
  const t = labelFor(dev)
  const meta = agentMetaFor(card.agent)
  const isRunning = card.status === "in_progress"

  function openSheet() {
    const params = new URLSearchParams(searchParams?.toString() ?? "")
    params.set("sheet", "open")
    params.set("task", card.taskId)
    if (card.project && card.project !== "—") params.set("project", card.project)
    // Phase 6 queue cards don't map to a specific phase number — the sheet
    // gracefully handles missing/NaN phase (see task-detail-sheet.tsx line 93).
    router.push((pathname ?? "/build/queue") + "?" + params.toString())
  }

  return (
    <article
      data-testid={"queue-card-" + card.taskId}
      data-status={card.status}
      data-agent={card.agent}
      role="button"
      tabIndex={0}
      onClick={openSheet}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          openSheet()
        }
      }}
      className="card-base card-base--interactive text-left text-xs min-h-[80px] flex flex-col relative overflow-hidden"
    >
      {/* Left-border status accent — status color here only, not on whole card */}
      <span
        aria-hidden
        className={
          card.status === "in_progress"
            ? "absolute left-0 top-0 bottom-0 w-0.5 bg-[color:var(--accent,#00d4ff)]"
            : card.status === "stuck"
              ? "absolute left-0 top-0 bottom-0 w-0.5 bg-[color:var(--danger,#ef4444)]"
              : card.status === "shipped"
                ? "absolute left-0 top-0 bottom-0 w-0.5 bg-[color:var(--success,#2f9e44)]"
                : "hidden"
        }
      />
      <header className="flex items-start gap-2">
        <span aria-hidden className="text-sm shrink-0">
          {meta.emoji}
        </span>
        <h3 className="text-sm font-medium text-[color:var(--text,#e5e5e5)] line-clamp-2 min-w-0 flex-1">
          {card.title}
        </h3>
      </header>
      <div className="text-[color:var(--text-muted,#8a8a8c)]">
        {t.queueCardAgentProjectLine(card.project, relativeTime(card.ts))}
      </div>
      {card.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {card.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded px-1.5 py-0.5 text-[10px] bg-[color:var(--surface-hover,#1a1a1d)] text-[color:var(--text-muted,#8a8a8c)]"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
      {isRunning && (
        <span
          data-testid="queue-card-pulse"
          aria-label={t.queueCardLivePulseLabel}
          className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[color:var(--accent,#00d4ff)] animate-pulse"
        />
      )}
    </article>
  )
}
