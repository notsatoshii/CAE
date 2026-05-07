/**
 * FloorTimeline — sidebar component showing live and historical agents.
 *
 * Features:
 * - Display all agents (live + historical) in a scrollable list
 * - Color-coded by hue derived from task_id
 * - Sorted newest first
 * - Clickable rows to select and view details
 * - Show duration, status badge
 * - Mobile-responsive: hide on <768px
 */

"use client";

import React from "react";
import type { PixelAgent } from "@/lib/floor/scene";
import type { AgentLifecycle } from "@/lib/floor/parse-circuit-breaker";

export interface FloorTimelineProps {
  historicalAgents: AgentLifecycle[];
  liveAgents: PixelAgent[];
  selectedTaskId?: string;
  onSelectAgent: (taskId: string) => void;
}

interface AgentRow {
  taskId: string;
  spawnedAt: number;
  finishedAt: number | null;
  status: "working" | "completed" | "failed";
  isLive: boolean;
}

/** Compute hue from task_id for consistent coloring. */
function getHueForTaskId(taskId: string): number {
  let hash = 0;
  for (let i = 0; i < taskId.length; i++) {
    hash = ((hash << 5) - hash) + taskId.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash) % 360;
}

/** Format duration (start to end, or start to now). */
function formatDuration(spawnedAt: number, finishedAt: number | null): string {
  const endTime = finishedAt || Date.now();
  const durationMs = endTime - spawnedAt;
  const durationS = Math.floor(durationMs / 1000);
  const durationM = Math.floor(durationS / 60);
  const durationH = Math.floor(durationM / 60);

  if (durationH > 0) {
    const remainingM = durationM % 60;
    return remainingM > 0 ? `${durationH}h ${remainingM}m` : `${durationH}h`;
  } else if (durationM > 0) {
    const remainingS = durationS % 60;
    return remainingS > 0 ? `${durationM}m ${remainingS}s` : `${durationM}m`;
  } else {
    return `${durationS}s`;
  }
}

/** Format spawn time as HH:MM. */
function formatTime(epochMs: number): string {
  const date = new Date(epochMs);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Get status badge emoji and label. */
function getStatusBadge(status: "working" | "completed" | "failed"): string {
  switch (status) {
    case "completed":
      return "✓";
    case "failed":
      return "✗";
    case "working":
      return "⏳";
  }
}

export function FloorTimeline({
  historicalAgents,
  liveAgents,
  selectedTaskId,
  onSelectAgent,
}: FloorTimelineProps) {
  // Combine and sort agents
  const rows: AgentRow[] = [
    ...liveAgents.map((ag) => ({
      taskId: ag.taskId,
      spawnedAt: 0, // Live agents don't have spawn time from here
      finishedAt: null,
      status: "working" as const,
      isLive: true,
    })),
    ...historicalAgents.map((ag) => ({
      taskId: ag.taskId,
      spawnedAt: ag.spawnedAt,
      finishedAt: ag.finishedAt,
      status: ag.status,
      isLive: false,
    })),
  ];

  // Deduplicate by taskId (live takes priority over historical)
  const seen = new Set<string>();
  const deduped: AgentRow[] = [];
  for (const row of rows) {
    if (!seen.has(row.taskId)) {
      seen.add(row.taskId);
      deduped.push(row);
    }
  }

  // Sort by spawn time descending (newest first), then by taskId
  deduped.sort((a, b) => {
    if (a.spawnedAt !== b.spawnedAt) {
      return b.spawnedAt - a.spawnedAt;
    }
    return b.taskId.localeCompare(a.taskId);
  });

  // On mobile (<768px), hide the timeline
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  if (isMobile) {
    return null;
  }

  return (
    <aside className="absolute bottom-0 left-0 right-0 h-32 border-t border-[color:var(--border-subtle)] bg-[color:var(--surface)]/95 backdrop-blur overflow-x-auto">
      <div className="flex gap-2 p-2 min-w-max">
        {deduped.length === 0 ? (
          <div className="text-xs text-[color:var(--text-muted)] px-2 py-1">
            No agents
          </div>
        ) : (
          deduped.map((row) => {
            const hue = getHueForTaskId(row.taskId);
            const duration = formatDuration(row.spawnedAt, row.finishedAt);
            const time = row.spawnedAt ? formatTime(row.spawnedAt) : "—";
            const badge = getStatusBadge(row.status);
            const isSelected = row.taskId === selectedTaskId;

            return (
              <button
                key={row.taskId}
                onClick={() => onSelectAgent(row.taskId)}
                className={`
                  flex items-center gap-2 px-2 py-1 rounded text-xs whitespace-nowrap
                  transition-colors
                  ${
                    isSelected
                      ? "bg-[color:var(--accent)] text-[color:var(--bg)]"
                      : "bg-[color:var(--surface)] hover:bg-[color:var(--border-subtle)] text-[color:var(--text)]"
                  }
                `}
              >
                {/* Color square */}
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: `hsl(${hue} 80% 58%)` }}
                />

                {/* Task ID, time, duration */}
                <span className="font-mono">{row.taskId}</span>
                <span className="text-[color:var(--text-muted)]">{time}</span>
                <span className="text-[color:var(--text-muted)]">{duration}</span>

                {/* Status badge */}
                <span
                  className={`
                    font-bold
                    ${
                      row.status === "completed"
                        ? "text-[color:var(--success)]"
                        : row.status === "failed"
                          ? "text-[color:var(--danger)]"
                          : "text-[color:var(--accent)]"
                    }
                  `}
                >
                  {badge}
                </span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
