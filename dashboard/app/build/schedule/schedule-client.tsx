"use client"

import React, { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import type { ScheduledTask } from "@/lib/cae-types"
import { TaskList } from "@/components/schedule/task-list"
import { NlInput, type ParseResult } from "@/components/schedule/nl-input"
import { CronPreview } from "@/components/schedule/cron-preview"

export type ScheduleClientProps = {
  initialTasks: ScheduledTask[]
}

/**
 * ScheduleClient — client-side schedule manager.
 *
 * Two tabs: "My schedules" (TaskList) | "New schedule" (NlInput + Save).
 */
export function ScheduleClient({ initialTasks }: ScheduleClientProps) {
  const router = useRouter()
  const [tab, setTab] = useState<"list" | "new">("list")
  const [tasks, setTasks] = useState(initialTasks)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [buildplan, setBuildplan] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function handleToggle(id: string, enabled: boolean) {
    await fetch(`/api/schedule/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    })
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, enabled } : t))
    )
  }

  async function handleDelete(id: string) {
    await fetch(`/api/schedule/${id}`, { method: "DELETE" })
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  function handleOpenLog(id: string) {
    // Reuses Phase 2 tmux-tail SSE pattern
    window.open(`/api/tail?session=scheduler-${id}`, "_blank")
  }

  async function handleSave() {
    if (!parseResult || !buildplan.trim()) return
    setSaving(true)
    setSaveError(null)
    try {
      const caeRoot = "/home/cae/ctrl-alt-elite" // populated by watcher from process.env
      const bp = buildplan.trim().startsWith("/")
        ? buildplan.trim()
        : `${caeRoot}/${buildplan.trim()}`

      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nl: (document.querySelector("textarea[aria-label='Schedule description']") as HTMLTextAreaElement)?.value ?? "",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          buildplan: bp,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSaveError(data.error ?? "Save failed")
      } else {
        setTasks((prev) => [...prev, data as ScheduledTask])
        setTab("list")
        setBuildplan("")
        setParseResult(null)
        startTransition(() => router.refresh())
      }
    } catch {
      setSaveError("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-[color:var(--border,#1f1f22)]">
        {(["list", "new"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "pb-2 px-1 text-sm font-medium border-b-2 transition-colors",
              tab === t
                ? "border-[color:var(--accent,#00d4ff)] text-[color:var(--accent,#00d4ff)]"
                : "border-transparent text-[color:var(--text-muted,#8a8a8c)] hover:text-[color:var(--text,#e5e5e5)]",
            ].join(" ")}
          >
            {t === "list" ? "My schedules" : "New schedule"}
          </button>
        ))}
      </div>

      {tab === "list" && (
        <TaskList
          tasks={tasks}
          onToggle={handleToggle}
          onDelete={handleDelete}
          onOpenLog={handleOpenLog}
        />
      )}

      {tab === "new" && (
        <div className="space-y-4 max-w-xl">
          <div className="space-y-1">
            <label className="text-sm font-medium text-[color:var(--text,#e5e5e5)]">
              When should this run?
            </label>
            <NlInput onResult={setParseResult} />
          </div>

          {parseResult && (
            <CronPreview
              cron={parseResult.cron}
              source={parseResult.source}
              english={parseResult.english}
              nextRun={parseResult.nextRun}
            />
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-[color:var(--text,#e5e5e5)]">
              Buildplan path
            </label>
            <input
              type="text"
              value={buildplan}
              onChange={(e) => setBuildplan(e.target.value)}
              placeholder="/home/cae/ctrl-alt-elite/tasks/plan.md"
              className="w-full rounded-md border border-[color:var(--border,#1f1f22)] bg-[color:var(--surface,#121214)] px-3 py-2 text-sm text-[color:var(--text,#e5e5e5)] placeholder:text-[color:var(--text-muted,#8a8a8c)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent,#00d4ff)]"
            />
          </div>

          {saveError && (
            <p className="text-sm text-red-400">{saveError}</p>
          )}

          <button
            onClick={handleSave}
            disabled={!parseResult || !buildplan.trim() || saving}
            className="rounded-md bg-[color:var(--accent,#00d4ff)] px-4 py-2 text-sm font-medium text-black disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {saving ? "Saving…" : "Save schedule"}
          </button>
        </div>
      )}
    </div>
  )
}
