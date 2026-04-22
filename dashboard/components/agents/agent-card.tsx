"use client"

/**
 * AgentCard — single agent tile (Phase 5 Plan 05-03).
 *
 * Two variants driven by `agent.group`:
 *   - active | recently_used → header + subtitle + 3 stat rows with sparklines + footer
 *   - dormant               → header + subtitle + idle line + footer
 *
 * Click (or Enter/Space) opens URL state `?agent={name}`. The detail drawer
 * wiring reads that state in Plan 05-04 — in Plan 05-03 the click just
 * updates the URL (no visible drawer yet). Using `role="button"` on a
 * `<div>` (not a nested `<button>`) avoids a11y conflicts with the future
 * Sheet trigger inside the card.
 *
 * Drift indicator is a small inline badge here; the big founder/dev copy
 * banner lives in the drawer.
 *
 * See .planning/phases/05-agents-tab/05-CONTEXT.md §Agent card layout +
 * §Idle-agent card variant + §Founder-speak flip for the authoritative
 * visual/copy contract. Pattern reference for URL-state click flow:
 * components/build-home/active-phase-cards.tsx.
 */

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { useDevMode } from "@/lib/providers/dev-mode"
import { labelFor } from "@/lib/copy/labels"
import { Card, CardContent } from "@/components/ui/card"
import { Sparkline } from "@/components/ui/sparkline"
import { cn } from "@/lib/utils"
import type { AgentRosterEntry } from "@/lib/cae-agents-state"
import type * as React from "react"

interface AgentCardProps {
  agent: AgentRosterEntry
}

export function AgentCard({ agent }: AgentCardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { dev } = useDevMode()
  const t = labelFor(dev)

  const isIdle = agent.group === "dormant"

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

  const subtitle = dev ? agent.model : agent.founder_label

  const successPct = Math.round(agent.stats_7d.success_rate * 100)
  const avgWallSec = Math.round(agent.stats_7d.avg_wall_ms / 1000)
  const wallDisplay =
    avgWallSec >= 60
      ? Math.floor(avgWallSec / 60) + ":" + String(avgWallSec % 60).padStart(2, "0")
      : avgWallSec + "s"
  const tokensDisplay = formatK(agent.stats_7d.tokens_total)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={onKeyDown}
      data-testid={"agent-card-" + agent.name}
      data-group={agent.group}
      aria-label={agent.label + " — open details"}
      className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent,#00d4ff)] rounded-xl"
    >
      <Card className="min-h-[280px] h-full transition-colors hover:bg-[color:var(--surface-hover,#1a1a1d)]">
        <CardContent className="flex flex-col gap-3 p-4">
          {/* Header: emoji + name + concurrency dots */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span aria-hidden className="text-lg">
                {agent.emoji}
              </span>
              <span
                className={cn(
                  "font-heading text-base",
                  dev ? "uppercase tracking-wide" : "font-medium",
                )}
                data-testid={"agent-card-" + agent.name + "-headline"}
              >
                {dev ? agent.label.toUpperCase() : agent.label}
              </span>
            </div>
            <ConcurrencyDots
              count={agent.current.concurrent}
              testid={"agent-card-" + agent.name + "-concurrency"}
            />
          </div>

          {/* Subtitle: founder_label (founder) or model chip (dev) */}
          <div
            className={cn(
              "text-xs text-[color:var(--text-muted,#8a8a8c)]",
              dev && "font-mono",
            )}
            data-testid={"agent-card-" + agent.name + "-subtitle"}
          >
            {subtitle}
          </div>

          <div className="h-px bg-[color:var(--border,#1f1f22)]" />

          {isIdle ? (
            /* Idle variant */
            <div
              className="text-xs text-[color:var(--text-dim,#5a5a5c)] font-mono py-4"
              data-testid={"agent-card-" + agent.name + "-idle"}
            >
              {agent.last_run_days_ago === null
                ? t.agentsIdleNever
                : t.agentsIdleLine(
                    agent.last_run_days_ago,
                    dayOfWeekFrom(agent.last_run_days_ago),
                  )}
            </div>
          ) : (
            /* Active / Recently-used stats block */
            <div
              className="flex flex-col gap-1.5 font-mono text-xs"
              data-testid={"agent-card-" + agent.name + "-stats"}
            >
              <StatRow
                label={t.agentsStatTokensPerHour}
                value={tokensDisplay}
                sparkValues={agent.stats_7d.tokens_per_hour}
              />
              <StatRow
                label={t.agentsStatSuccess}
                value={successPct + "%"}
                sparkValues={agent.stats_7d.success_history}
              />
              <StatRow
                label={t.agentsStatWall}
                value={wallDisplay}
                sparkValues={agent.stats_7d.wall_history}
              />
            </div>
          )}

          <div className="h-px bg-[color:var(--border,#1f1f22)] mt-auto" />

          {/* Footer: active · queued · /day */}
          <div className="flex items-center gap-3 text-xs text-[color:var(--text-muted,#8a8a8c)] font-mono">
            <span>{t.agentsLiveActiveLabel(agent.current.concurrent)}</span>
            <span aria-hidden>·</span>
            <span>{t.agentsLiveQueuedLabel(agent.current.queued)}</span>
            <span aria-hidden>·</span>
            <span>{t.agentsLive24hLabel(agent.current.last_24h_count)}</span>
          </div>

          {agent.drift_warning && (
            <div
              className="mt-1 rounded-sm border border-[color:var(--danger,#ef4444)] bg-[color:var(--danger,#ef4444)]/10 px-2 py-1 text-xs text-[color:var(--danger,#ef4444)]"
              data-testid={"agent-card-" + agent.name + "-drift-indicator"}
              aria-label="drift warning"
            >
              ⚠ drift
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// === Helpers ===

function formatK(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return (n / 1000).toFixed(1) + "k"
  return (n / 1_000_000).toFixed(1) + "M"
}

function dayOfWeekFrom(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86400000)
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()]
}

function StatRow({
  label,
  value,
  sparkValues,
}: {
  label: string
  value: string
  sparkValues: number[]
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[color:var(--text-muted,#8a8a8c)] w-24 truncate">
        {label}
      </span>
      <Sparkline values={sparkValues} width={90} height={18} />
      <span className="text-[color:var(--text,#e5e5e5)] w-12 text-right">
        {value}
      </span>
    </div>
  )
}

function ConcurrencyDots({
  count,
  testid,
}: {
  count: number
  testid: string
}) {
  const max = 4
  const visible = Math.min(count, max)
  const overflow = Math.max(0, count - max)
  return (
    <div
      className="flex items-center gap-0.5"
      data-testid={testid}
      aria-label={count + " active tasks"}
    >
      {Array.from({ length: visible }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent,#00d4ff)]"
        />
      ))}
      {overflow > 0 && (
        <span className="ml-1 text-[10px] text-[color:var(--text-muted,#8a8a8c)] font-mono">
          +{overflow}
        </span>
      )}
    </div>
  )
}
