"use client"

import React from "react"

export type CronPreviewProps = {
  english: string
  nextRun: string | null
  source: "rule" | "llm"
  cron: string
}

/**
 * CronPreview — shows human-readable schedule description + next run time.
 *
 * Per UI-SPEC §14 founder-speak: no raw cron exposure except in dev mode.
 * Source pill: rule = green (deterministic), llm = amber (warn about AI interpretation).
 */
export function CronPreview({ english, nextRun, source, cron }: CronPreviewProps) {
  const nextRunDate = nextRun ? new Date(nextRun) : null
  const relativeTime = nextRunDate ? formatRelativeTime(nextRunDate) : null

  return (
    <div
      className="rounded-md border border-[color:var(--border,#1f1f22)] bg-[color:var(--surface,#121214)] p-3 space-y-1.5"
      data-testid="cron-preview"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm text-[color:var(--text,#e5e5e5)]">
          This runs: <strong>{english}</strong>
        </span>
        <span
          className={[
            "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium",
            source === "rule"
              ? "bg-green-500/15 text-green-400"
              : "bg-amber-500/15 text-amber-400",
          ].join(" ")}
          title={
            source === "llm"
              ? "We used AI to interpret this — double-check the preview"
              : "Deterministic rule matched"
          }
        >
          {source === "rule" ? "rule" : "AI interpreted"}
        </span>
      </div>

      {relativeTime && (
        <p className="text-xs text-[color:var(--text-muted,#8a8a8c)]">
          Next run: <span className="font-medium">{relativeTime}</span>
        </p>
      )}

      {/* Dev-mode raw cron for transparency */}
      {process.env.NODE_ENV === "development" && (
        <p className="text-xs font-mono text-[color:var(--text-muted,#8a8a8c)] opacity-60">
          {cron}
        </p>
      )}
    </div>
  )
}

function formatRelativeTime(date: Date): string {
  const now = Date.now()
  const diff = date.getTime() - now
  if (diff < 0) return "now"

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `in ${days} day${days > 1 ? "s" : ""}`
  if (hours > 0) return `in ${hours} hour${hours > 1 ? "s" : ""}`
  if (minutes > 0) return `in ${minutes} minute${minutes > 1 ? "s" : ""}`
  return `in ${seconds} second${seconds !== 1 ? "s" : ""}`
}
