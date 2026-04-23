"use client"

import React, { useState } from "react"
import { CalendarClock } from "lucide-react"
import type { ScheduledTask, Role } from "@/lib/cae-types"
import { RoleGate } from "@/components/auth/role-gate"
import { EmptyState } from "@/components/ui/empty-state"

export type TaskListProps = {
  tasks: ScheduledTask[]
  onToggle: (id: string, enabled: boolean) => void
  onDelete: (id: string) => void
  onOpenLog: (id: string) => void
  /** Role from server-component parent. Gates toggle + delete. */
  currentRole?: Role
}

function formatEpoch(epoch: number): string {
  if (!epoch) return "Never"
  return new Date(epoch * 1000).toLocaleString()
}

/**
 * TaskList — renders scheduled tasks in a table with toggle/delete/expand.
 *
 * Row expand: click row to see buildplan path + last run log link.
 * Toggle: enables/disables schedule (operator+ only).
 * Delete: removes from registry (operator+ only).
 * Viewer-role users see the list but toggle and delete are hidden.
 *
 * Phase 15 Wave 2.6 (bonus): empty state adopts <EmptyState> +
 * EMPTY_COPY.schedule for character + a CTA back to /build/schedule/new.
 */
export function TaskList({ tasks, onToggle, onDelete, onOpenLog, currentRole }: TaskListProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        testId="task-list-empty"
        title="No schedules yet"
        description="Cron jobs you create from /build/schedule/new appear here. Toggle, expand, or delete each row in place."
        cta={{ label: "Create one", href: "/build/schedule/new" }}
      />
    )
  }

  return (
    <div className="rounded-md border border-[color:var(--border,#1f1f22)] overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[color:var(--surface,#121214)] text-[color:var(--text-muted,#8a8a8c)]">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Schedule</th>
            <th className="px-4 py-2 text-left font-medium">Last run</th>
            <th className="px-4 py-2 text-left font-medium">Enabled</th>
            <th className="px-4 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <React.Fragment key={task.id}>
              <tr
                className="border-t border-[color:var(--border,#1f1f22)] hover:bg-[color:var(--surface-hover,#1a1a1d)] cursor-pointer"
                onClick={() => setExpanded(expanded === task.id ? null : task.id)}
              >
                <td className="px-4 py-3 text-[color:var(--text,#e5e5e5)]">
                  <span className="font-medium">{task.nl}</span>
                  <span className="ml-2 font-mono text-xs text-[color:var(--text-muted,#8a8a8c)]">
                    {task.cron}
                  </span>
                </td>
                <td className="px-4 py-3 text-[color:var(--text-muted,#8a8a8c)]">
                  {formatEpoch(task.lastRun)}
                </td>
                <td className="px-4 py-3">
                  <RoleGate
                    role="operator"
                    currentRole={currentRole}
                    fallback={
                      /* Viewer: show read-only indicator */
                      <span
                        className={[
                          "inline-flex h-5 w-9 items-center rounded-full",
                          task.enabled
                            ? "bg-[color:var(--accent,#00d4ff)] opacity-50"
                            : "bg-[color:var(--border,#1f1f22)] opacity-50",
                        ].join(" ")}
                        title="Read-only"
                      >
                        <span
                          className={[
                            "inline-block h-4 w-4 rounded-full bg-white shadow",
                            task.enabled ? "translate-x-4" : "translate-x-0.5",
                          ].join(" ")}
                        />
                      </span>
                    }
                  >
                    <button
                      aria-label={`Toggle ${task.nl}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggle(task.id, !task.enabled)
                      }}
                      className={[
                        "inline-flex h-5 w-9 items-center rounded-full transition-colors",
                        task.enabled
                          ? "bg-[color:var(--accent,#00d4ff)]"
                          : "bg-[color:var(--border,#1f1f22)]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                          task.enabled ? "translate-x-4" : "translate-x-0.5",
                        ].join(" ")}
                      />
                    </button>
                  </RoleGate>
                </td>
                <td className="px-4 py-3 text-right">
                  <RoleGate role="operator" currentRole={currentRole}>
                    <button
                      aria-label={`Delete ${task.nl}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(task.id)
                      }}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1 rounded"
                    >
                      Delete
                    </button>
                  </RoleGate>
                </td>
              </tr>
              {expanded === task.id && (
                <tr className="border-t border-[color:var(--border,#1f1f22)] bg-[color:var(--surface,#121214)]">
                  <td colSpan={4} className="px-4 py-3 space-y-1">
                    <p className="text-xs text-[color:var(--text-muted,#8a8a8c)]">
                      <span className="font-medium text-[color:var(--text,#e5e5e5)]">Buildplan:</span>{" "}
                      <code className="font-mono">{task.buildplan}</code>
                    </p>
                    <p className="text-xs text-[color:var(--text-muted,#8a8a8c)]">
                      <span className="font-medium text-[color:var(--text,#e5e5e5)]">Last run:</span>{" "}
                      {formatEpoch(task.lastRun)}
                    </p>
                    {task.lastCompleted !== undefined && (
                      <p className="text-xs text-[color:var(--text-muted,#8a8a8c)]">
                        <span className="font-medium text-[color:var(--text,#e5e5e5)]">
                          Last completed:
                        </span>{" "}
                        {formatEpoch(task.lastCompleted)}
                      </p>
                    )}
                    <button
                      onClick={() => onOpenLog(task.id)}
                      className="text-xs text-[color:var(--accent,#00d4ff)] hover:underline"
                    >
                      Open log →
                    </button>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
