"use client"

/**
 * LifetimeStats — 4 headline tiles (tasks, tokens, success, avg wall) plus
 * a Top 5 expensive-tasks list. Data comes from the aggregator's lifetime
 * pass (full event stream, no 7d window).
 *
 * See .planning/phases/05-agents-tab/05-CONTEXT.md §Detail drawer §4 for
 * the section contract.
 */

import { useDevMode } from "@/lib/providers/dev-mode"
import { labelFor } from "@/lib/copy/labels"
import type { AgentDetailEntry } from "@/lib/cae-agents-state"

export function LifetimeStats({
  lifetime,
}: {
  lifetime: AgentDetailEntry["lifetime"]
}) {
  const { dev } = useDevMode()
  const t = labelFor(dev)
  const avgSec = Math.round(lifetime.avg_wall_ms / 1000)
  const avgDisplay =
    avgSec >= 60
      ? Math.floor(avgSec / 60) + ":" + String(avgSec % 60).padStart(2, "0")
      : avgSec + "s"
  return (
    <section
      data-testid="lifetime-stats"
      aria-labelledby="lifetime-heading"
      className="flex flex-col gap-4"
    >
      <h3
        id="lifetime-heading"
        className="text-sm font-semibold uppercase tracking-wide text-[color:var(--text-muted,#8a8a8c)]"
      >
        {t.agentsDrawerLifetimeHeading}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
        <Stat
          label={t.agentsDrawerLifetimeTasks}
          value={lifetime.tasks_total.toLocaleString()}
        />
        <Stat
          label={t.agentsDrawerLifetimeTokens}
          value={formatK(lifetime.tokens_total)}
        />
        <Stat
          label={t.agentsDrawerLifetimeSuccess}
          value={Math.round(lifetime.success_rate * 100) + "%"}
        />
        <Stat label={t.agentsDrawerLifetimeAvg} value={avgDisplay} />
      </div>
      {lifetime.top_expensive.length > 0 && (
        <div>
          <h4 className="text-xs uppercase tracking-wide text-[color:var(--text-muted,#8a8a8c)] mb-2">
            {t.agentsDrawerTopExpensiveHeading}
          </h4>
          <ul
            className="divide-y divide-[color:var(--border,#1f1f22)] text-xs font-mono"
            data-testid="top-expensive-list"
          >
            {lifetime.top_expensive.map((tx, i) => (
              <li
                key={i}
                className="flex items-center justify-between py-1.5"
              >
                <span className="truncate mr-2">
                  {tx.project} · {tx.phase}
                  {tx.plan ? "-" + tx.plan : ""}
                  {tx.task ? "-" + tx.task : ""}
                </span>
                <span className="text-[color:var(--text,#e5e5e5)]">
                  {formatK(tx.tokens)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-[color:var(--text-muted,#8a8a8c)]">
        {label}
      </span>
      <span className="font-mono text-sm text-[color:var(--text,#e5e5e5)]">
        {value}
      </span>
    </div>
  )
}

function formatK(n: number): string {
  if (n < 1000) return String(n)
  if (n < 1_000_000) return (n / 1000).toFixed(1) + "k"
  return (n / 1_000_000).toFixed(1) + "M"
}
