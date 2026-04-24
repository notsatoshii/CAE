"use client"

/**
 * AgentCard — single agent tile redesigned to MC pattern (Plan 13-10).
 *
 * MC-style layout (reference/agents.png):
 *   - Avatar circle (40px, first-letter-of-name initial) + name + model chip
 *     on the left cluster.
 *   - Right-aligned status pill: green dot + "Active" or gray dot + "Offline".
 *   - Session 14 (this change): when the agent has live forge_begin events
 *     in the last 5 min, a pulsing colored "ACTIVE · Nx" chip renders in
 *     the header alongside the availability pill. Chip hue is derived from
 *     the agent's name via the same 8-color palette the avatar uses, so
 *     scanning the roster for "who is actually working" is a color read,
 *     not a text read.
 *   - Last-active time in muted mono below the header row.
 *   - Always-visible compact action row at bottom (Phase 15 Wave 2.2).
 *
 * Phase 15 Wave 2.2: replaced the old `opacity-0 group-hover:opacity-100`
 * hover-reveal verbs with a persistent compact action row. Hidden verbs
 * leak no affordance for keyboard users (focus-within reveal didn't help
 * because nothing is focused at rest) and break Eric's "you should be
 * able to see what you can do" rule. New rest state: muted text on
 * transparent surface; hover/focus jumps to --accent + --surface-hover
 * background. Buttons stay compact (text-xs / py-1.5 / px-2.5) so the
 * row reads as a secondary affordance, not a primary CTA.
 *
 * Phase 15 Wave 2.1: card surface uses `.card-base card-base--interactive`.
 *
 * All verb buttons are ≥24×24px click targets (WCAG SC 2.5.8).
 *
 * Plan 13-07: verbs from agentVerbs(getAgentVerbSet()) — A/B via localStorage.
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

/**
 * Deterministic agent palette — 8 hex hues keyed by a stable name-hash.
 *
 * Shared between the avatar (background tile) and the "ACTIVE · Nx" activity
 * chip (session 14, Eric: "different color tags for each agent"). Keeping the
 * palette + hash colocated here is the single source of truth; any new
 * surface that wants the hue should call agentHue(name) rather than roll
 * its own copy of the hash.
 */
export const AGENT_HUE_PALETTE = [
  "#3b5bdb", "#ae3ec9", "#0ca678", "#e67700",
  "#d63939", "#1971c2", "#2f9e44", "#c92a2a",
] as const

export function agentHue(name: string): string {
  const sum = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AGENT_HUE_PALETTE[sum % AGENT_HUE_PALETTE.length]
}

/** Avatar: colored circle with name initials, 40px. */
function AgentAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const initial = name.charAt(0).toUpperCase()
  const bgColor = agentHue(name)
  return (
    <div
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full text-white font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.4),
        backgroundColor: bgColor,
      }}
    >
      {initial}
    </div>
  )
}

/**
 * ACTIVE chip — pulsing tag rendered in the card header when the agent has
 * live forge_begin events in the last 5 min. Color is the agent's
 * deterministic hue (hash-derived) so multi-concurrent scanning reads as
 * color coded. Label format: "ACTIVE · Nx" (N = active_concurrent).
 *
 * Accessibility:
 *   - `title` attribute spells out the count + agent for sighted hover + AT.
 *   - Pulse animation is gated on `prefers-reduced-motion` — under reduced
 *     motion the chip stays static at full opacity (still colored, still
 *     readable; just no animation). The gating lives in the keyframes block
 *     inline below so we don't have to bounce through globals.css.
 *   - Real <span> with tabIndex=0 so keyboard users can focus it.
 */
function AgentActiveChip({
  agentName,
  agentLabel,
  count,
}: {
  agentName: string
  agentLabel: string
  count: number
}) {
  const hue = agentHue(agentName)
  // 20% opacity background so the hue tints without washing out the label.
  // color-mix is supported in every Chromium / Firefox / Safari version
  // shipping since 2023; the agents page already requires a modern browser.
  const bg = `color-mix(in srgb, ${hue} 20%, transparent)`
  return (
    <span
      role="status"
      tabIndex={0}
      data-testid={"agent-card-" + agentName + "-active-chip"}
      title={count + " concurrent tasks running as " + agentLabel}
      className="agent-active-chip flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-[color:var(--bg,#0a0a0a)]"
      style={{
        backgroundColor: bg,
        borderColor: hue,
        color: hue,
      }}
    >
      <Circle
        size={6}
        aria-hidden
        className="fill-current"
        style={{ color: hue }}
      />
      ACTIVE · {count}x
    </span>
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
  const activeConcurrent = agent.active_concurrent ?? 0

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

  // Shared compact-action-button class: muted at rest, accent on hover/focus.
  // Per-verb hover hue is overridden inline so the variant tints don't fight
  // the resting state.
  const verbBase =
    "flex-1 rounded border border-transparent bg-transparent px-2.5 py-1.5 text-xs font-mono text-[color:var(--text-muted,#8a8a8c)] hover:bg-[color:var(--surface-hover,#1a1a1d)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#00d4ff)] transition-colors min-h-[24px] min-w-[24px]"

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={onKeyDown}
      data-testid={"agent-card-" + agent.name}
      data-group={agent.group}
      aria-label={agent.label + " — open details"}
      className="card-base card-base--interactive group relative block focus:outline-none"
    >

      {/* Header: avatar + name/model on left; ACTIVE chip (if any) + status pill on right */}
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
        <div className="flex shrink-0 items-center gap-2">
          {activeConcurrent > 0 && (
            <AgentActiveChip
              agentName={agent.name}
              agentLabel={agent.label}
              count={activeConcurrent}
            />
          )}
          <StatusPill active={isActive} />
        </div>
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

      {/* Always-visible compact action row (Wave 2.2). Buttons sit in the
          tab order at rest; no opacity gating. */}
      <div
        className="mt-4 flex gap-2"
        data-testid={"agent-card-" + agent.name + "-verbs"}
      >
        <button
          type="button"
          aria-label={verbs.primary + " " + agent.label}
          onClick={(e) => { e.stopPropagation() }}
          className={cn(verbBase, "hover:border-[color:var(--accent,#00d4ff)] hover:text-[color:var(--accent,#00d4ff)]")}
          data-testid={"agent-card-" + agent.name + "-verb-primary"}
        >
          {verbs.primary}
        </button>
        <button
          type="button"
          aria-label={verbs.stop + " " + agent.label}
          onClick={(e) => { e.stopPropagation() }}
          className={cn(verbBase, "hover:border-[color:var(--warning,#f59e0b)] hover:text-[color:var(--warning,#f59e0b)]")}
          data-testid={"agent-card-" + agent.name + "-verb-stop"}
        >
          {verbs.stop}
        </button>
        <button
          type="button"
          aria-label={verbs.archive + " " + agent.label}
          onClick={(e) => { e.stopPropagation() }}
          className={cn(verbBase, "hover:border-[color:var(--danger,#ef4444)] hover:text-[color:var(--danger,#ef4444)]")}
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
  )
}
