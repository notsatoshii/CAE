"use client"

/**
 * ActivityFeed — Class 15C.
 *
 * Renders the unified /api/state.recent_activity stream as a scrollable
 * feed card grouped by day. Replaces the illusion of an idle dashboard
 * when the repo is actually humming — commits, agent spawns, cycle
 * steps, vision scores, skill installs, everything the canonical
 * activity.jsonl carries.
 *
 * Liveness states mirror RecentCommits (loading/empty/healthy/error).
 *
 * Source of truth: `useStatePoll().data.recent_activity` — populated by
 * /api/state (Class 15A). We cast-read instead of extending the hook's
 * StateResponse type so this component doesn't bleed into the global
 * shared type (isolation gate for Class 18's ongoing state refactor).
 */

import {
  Activity,
  CheckCircle2,
  GitCommit,
  Heart,
  MessageSquare,
  Package,
  PlayCircle,
  Settings,
  Sparkles,
  Workflow,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { useStatePoll } from "@/lib/hooks/use-state-poll"
import { Panel } from "@/components/ui/panel"
import { EmptyState } from "@/components/ui/empty-state"
import { LastUpdated } from "@/components/ui/last-updated"
import { Skeleton } from "@/components/ui/skeleton"
import type { ActivityFeedRow } from "@/lib/cae-activity-feed"

// Icon per event.type — missing types fall back to Activity.
const TYPE_ICON: Record<string, LucideIcon> = {
  commit: GitCommit,
  agent_spawn: PlayCircle,
  agent_complete: CheckCircle2,
  cycle_step: Workflow,
  vision_score: Sparkles,
  chat_turn: MessageSquare,
  workflow_run: Workflow,
  queue_delegate: Package,
  skill_install: Settings,
  other: Activity,
  heartbeat: Heart,
}

function iconFor(row: ActivityFeedRow): LucideIcon {
  return TYPE_ICON[row.type] ?? Activity
}

/**
 * Group rows by day boundary (YYYY-MM-DD). Keeps input order within a day
 * — the source is ts-DESC so that's what the feed shows.
 */
function groupByDay(rows: ActivityFeedRow[]): Array<{
  day: string
  rows: ActivityFeedRow[]
}> {
  const byDay = new Map<string, ActivityFeedRow[]>()
  for (const r of rows) {
    const day = r.ts.slice(0, 10)
    const bucket = byDay.get(day)
    if (bucket) bucket.push(r)
    else byDay.set(day, [r])
  }
  return Array.from(byDay.entries()).map(([day, rows]) => ({ day, rows }))
}

function formatDay(day: string, now = Date.now()): string {
  const today = new Date(now).toISOString().slice(0, 10)
  const yesterday = new Date(now - 86_400_000).toISOString().slice(0, 10)
  if (day === today) return "Today"
  if (day === yesterday) return "Yesterday"
  try {
    return new Date(day + "T00:00:00Z").toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    })
  } catch {
    return day
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  } catch {
    return iso.slice(11, 16)
  }
}

export function ActivityFeed() {
  const { data, error, lastUpdated } = useStatePoll()

  // Cast-read — StateResponse doesn't carry recent_activity in its shared
  // type today (Class 18 owns that migration). The runtime field is
  // populated by /api/state; we narrow defensively here.
  const dataWithActivity = data as
    | (typeof data & { recent_activity?: ActivityFeedRow[] })
    | null
  const rows = dataWithActivity?.recent_activity ?? null

  const loading = data === null && error === null
  const empty = rows !== null && rows.length === 0
  const healthy = rows !== null && rows.length > 0

  let liveness: "loading" | "empty" | "error" | "healthy" = "loading"
  if (error) liveness = "error"
  else if (loading) liveness = "loading"
  else if (empty) liveness = "empty"
  else liveness = "healthy"

  const groups = healthy && rows ? groupByDay(rows) : []

  return (
    <Panel
      title="Activity"
      headingId="activity-feed-heading"
      testId="activity-feed"
      className="mb-6"
      dataLiveness={liveness}
      subtitle={
        healthy ? <LastUpdated at={lastUpdated} threshold_ms={10_000} /> : undefined
      }
    >
      <span className="sr-only" data-truth="activity-feed.healthy">
        {healthy ? "yes" : "no"}
      </span>
      <span className="sr-only" data-truth="activity-feed.count">
        {rows?.length ?? 0}
      </span>

      {loading && (
        <div
          data-testid="activity-feed-loading"
          role="status"
          aria-busy="true"
          className="flex flex-col gap-2"
        >
          {/*
            Class 5C — 3 staggered-width skeleton rows (not 9+ identical
            placeholders). Shimmer reads unambiguously as "loading".
          */}
          {[100, 82, 64].map((pct, i) => (
            <Skeleton
              key={i}
              className="h-5"
              width={`${pct}%`}
              testId={`activity-feed-skeleton-${i}`}
            />
          ))}
        </div>
      )}

      {error && (
        <EmptyState
          icon={Activity}
          testId="activity-feed-error"
          title="Activity stream offline."
          description={error.message}
          variant="error"
        />
      )}

      {empty && (
        <EmptyState
          icon={Activity}
          testId="activity-feed-empty"
          title="Nothing on the wire yet."
          description="Commits, agent spawns, and cycle steps all land here live."
        />
      )}

      {healthy && (
        <div className="flex flex-col gap-3">
          {groups.map((g) => (
            <DayGroup key={g.day} day={g.day} rows={g.rows} />
          ))}
        </div>
      )}
    </Panel>
  )
}

function DayGroup({ day, rows }: { day: string; rows: ActivityFeedRow[] }) {
  return (
    <section data-testid={`activity-day-${day}`} className="flex flex-col gap-1">
      <h3 className="type-section text-[color:var(--text-dim)]">
        {formatDay(day)}
      </h3>
      <ul className="divide-y divide-[color:var(--border-subtle)] font-mono text-xs" role="list">
        {rows.map((r, i) => (
          <ActivityLi key={`${r.ts}-${i}`} row={r} />
        ))}
      </ul>
    </section>
  )
}

function ActivityLi({ row }: { row: ActivityFeedRow }) {
  const Icon = iconFor(row)
  const label = `${row.type} from ${row.source}${row.actor ? ` by ${row.actor}` : ""}: ${row.summary}`
  return (
    <li role="listitem" data-testid={`activity-row-${row.type}`}>
      <div
        aria-label={label}
        className="flex items-center gap-3 py-1.5 px-1 -mx-1"
      >
        <Icon aria-hidden="true" size={14} className="shrink-0 text-[color:var(--text-muted)]" />
        <span className="text-[color:var(--text-muted)] shrink-0" style={{ width: "5ch" }}>
          {formatTime(row.ts)}
        </span>
        <span className="text-[color:var(--text)] flex-1 truncate">{row.summary}</span>
        {row.actor && (
          <span className="text-[color:var(--text-dim)] shrink-0 hidden sm:inline">
            {row.actor}
          </span>
        )}
      </div>
    </li>
  )
}
