"use client"

/**
 * AgentCard — single agent tile redesigned to MC pattern (Plan 13-10).
 *
 * MC-style layout (reference/agents.png):
 *   - Avatar circle (40px, first-letter-of-name initial) + name + model chip
 *     on the left cluster.
 *   - Right-aligned status pill: green dot + "Active" or gray dot + "Offline".
 *   - Last-active time in muted mono below the header row.
 *   - Hover-reveal action verbs at bottom (group-hover:opacity-100 + focus-within).
 *
 * Hover-reveal verbs reduce visual noise at rest (MC pattern) while keeping
 * the affordance discoverable. Keyboard users get focus-within reveal.
 * All verb buttons are ≥24×24px click targets (WCAG SC 2.5.8).
 *
 * Plan 13-07: verbs from agentVerbs(getAgentVerbSet()) — A/B via localStorage.
 * Plan 13-10: visual redesign; stats preserved in an expandable area triggered
 * by clicking the card body (URL state ?agent={name} opens the detail drawer).
 *
 * See .planning/phases/05-agents-tab/05-CONTEXT.md §Agent card layout for
 * the original contract. This plan reshapes UI; props stay the same.
 */

import { useState, useEffect } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Circle } from "lucide-react"
import { useDevMode } from "@/lib/providers/dev-mode"
import { labelFor, agentVerbs, getAgentVerbSet } from "@/lib/copy/labels"
import { cn } from "@/lib/utils"
import type { AgentRosterEntry } from "@/lib/cae-agents-state"
import type * as React from "react"

interface AgentCardProps {
  agent: AgentRosterEntry
}

/** Avatar: colored circle with name initials, 40px. */
function AgentAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const initial = name.charAt(0).toUpperCase()
  // Deterministic color per agent name — cycles through a small palette.
  const COLORS = [
    "bg-[#3b5bdb]", "bg-[#ae3ec9]", "bg-[#0ca678]", "bg-[#e67700]",
    "bg-[#d63939]", "bg-[#1971c2]", "bg-[#2f9e44]", "bg-[#c92a2a]",
  ]
  const colorIndex = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % COLORS.length
  const bgColor = COLORS[colorIndex]
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full text-white font-semibold",
        bgColor,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initial}
    </div>
  )
}

/** Status pill: green "Active" or gray "Offline". */
function StatusPill({ active }: { active: boolean }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
        active
          ? "border-[color:var(--success,#2f9e44)]/30 bg-[color:var(--success,#2f9e44)]/10 text-[color:var(--success,#2f9e44)]"
          : "border-[color:var(--border,#1f1f22)] bg-[color:var(--bg,#0a0a0a)] text-[color:var(--text-muted,#8a8a8c)]",
      )}
    >
      <Circle
        size={6}
        aria-hidden
        className={cn(
          "fill-current",
          active ? "text-[color:var(--success,#2f9e44)]" : "text-[color:var(--text-muted,#8a8a8c)]",
        )}
      />
      {active ? "Active" : "Offline"}
    </div>
  )
}

export function AgentCard({ agent }: AgentCardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { dev } = useDevMode()
  const t = labelFor(dev)

  // Agent verb A/B — reads localStorage on mount; default is start_stop_archive.
  const [verbs, setVerbs] = useState(() => agentVerbs("start_stop_archive"))
  useEffect(() => {
    setVerbs(agentVerbs(getAgentVerbSet()))
  }, [])

  const isActive = agent.group === "active"

  function open() {
    const p = new URLSearchParams(searchParams?.toString() ?? "")
    p.set("agent", agent.name)
    router.push((pathname ?? "/build/agents") + "?" + p.toString())
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      open()
    }
  }

  // Last-active display: "Xd ago" or "Never"
  const lastActiveDisplay =
    agent.last_run_days_ago === null
      ? "Never"
      : agent.last_run_days_ago === 0
        ? "Today"
        : agent.last_run_days_ago === 1
          ? "Yesterday"
          : agent.last_run_days_ago + "d ago"

  const successPct =
    agent.stats_7d.success_rate != null
      ? Math.round(agent.stats_7d.success_rate * 100) + "%"
      : "—"

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={onKeyDown}
      data-testid={"agent-card-" + agent.name}
      data-group={agent.group}
      aria-label={agent.label + " — open details"}
      className="group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#00d4ff)] rounded-lg"
    >
      <div className="relative rounded-lg border border-[color:var(--border,#1f1f22)] bg-[color:var(--surface,#121214)] p-4 transition-colors hover:border-[color:var(--accent,#00d4ff)]/30">

        {/* Header: avatar + name/model on left; status pill on right */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <AgentAvatar name={agent.name} size={40} />
            <div className="min-w-0">
              <div
                className="text-[15px] font-semibold text-[color:var(--text,#e5e5e5)] truncate"
                data-testid={"agent-card-" + agent.name + "-headline"}
              >
                {dev ? agent.label.toUpperCase() : agent.label}
              </div>
              <div
                className="mt-0.5 text-[12px] font-mono text-[color:var(--text-muted,#8a8a8c)] truncate"
                data-testid={"agent-card-" + agent.name + "-subtitle"}
              >
                {dev ? agent.model : agent.founder_label}
              </div>
            </div>
          </div>
          <StatusPill active={isActive} />
        </div>

        {/* Last-active + success rate row */}
        <div className="mt-3 flex items-center justify-between text-[12px] text-[color:var(--text-muted,#8a8a8c)] font-mono">
          <span data-testid={"agent-card-" + agent.name + "-idle"}>
            {lastActiveDisplay}
          </span>
          <span>{successPct}</span>
        </div>

        {/* Drift warning badge (conditional) */}
        {agent.drift_warning && (
          <div
            className="mt-2 rounded-sm border border-[color:var(--danger,#ef4444)] bg-[color:var(--danger,#ef4444)]/10 px-2 py-1 text-xs text-[color:var(--danger,#ef4444)] flex items-center gap-1"
            data-testid={"agent-card-" + agent.name + "-drift-indicator"}
            aria-label="drift warning"
          >
            <span aria-hidden>⚠</span> drift
          </div>
        )}

        {/* Hover-reveal verb actions — opacity-0 at rest, opacity-100 on hover/focus */}
        <div
          className="mt-4 flex gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
          data-testid={"agent-card-" + agent.name + "-verbs"}
        >
          <button
            type="button"
            aria-label={verbs.primary + " " + agent.label}
            onClick={(e) => { e.stopPropagation() }}
            className="flex-1 rounded border border-[color:var(--border,#1f1f22)] px-2 py-1.5 text-[12px] font-mono text-[color:var(--text-muted,#8a8a8c)] hover:border-[color:var(--accent,#00d4ff)] hover:text-[color:var(--accent,#00d4ff)] transition-colors min-h-[24px] min-w-[24px]"
            data-testid={"agent-card-" + agent.name + "-verb-primary"}
          >
            {verbs.primary}
          </button>
          <button
            type="button"
            aria-label={verbs.stop + " " + agent.label}
            onClick={(e) => { e.stopPropagation() }}
            className="flex-1 rounded border border-[color:var(--border,#1f1f22)] px-2 py-1.5 text-[12px] font-mono text-[color:var(--text-muted,#8a8a8c)] hover:border-[color:var(--warning,#f59e0b)] hover:text-[color:var(--warning,#f59e0b)] transition-colors min-h-[24px] min-w-[24px]"
            data-testid={"agent-card-" + agent.name + "-verb-stop"}
          >
            {verbs.stop}
          </button>
          <button
            type="button"
            aria-label={verbs.archive + " " + agent.label}
            onClick={(e) => { e.stopPropagation() }}
            className="flex-1 rounded border border-[color:var(--border,#1f1f22)] px-2 py-1.5 text-[12px] font-mono text-[color:var(--text-muted,#8a8a8c)] hover:border-[color:var(--danger,#ef4444)] hover:text-[color:var(--danger,#ef4444)] transition-colors min-h-[24px] min-w-[24px]"
            data-testid={"agent-card-" + agent.name + "-verb-archive"}
          >
            {verbs.archive}
          </button>
        </div>

        {/* Footer: active · queued · /day */}
        <div className="mt-3 flex items-center gap-3 text-xs text-[color:var(--text-muted,#8a8a8c)] font-mono">
          <span>{t.agentsLiveActiveLabel(agent.current.concurrent)}</span>
          <span aria-hidden>·</span>
          <span>{t.agentsLiveQueuedLabel(agent.current.queued)}</span>
          <span aria-hidden>·</span>
          <span>{t.agentsLive24hLabel(agent.current.last_24h_count)}</span>
        </div>
      </div>
    </div>
  )
}
