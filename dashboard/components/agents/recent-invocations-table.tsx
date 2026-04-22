"use client"

/**
 * RecentInvocationsTable — last 50 completed invocations for one agent, in a
 * scrollable mono table. Columns: ts | project | phase-task | tokens | wall |
 * status. Data comes from the aggregator's `recent_invocations` slice (newest
 * first, completed events only).
 *
 * See .planning/phases/05-agents-tab/05-CONTEXT.md §Detail drawer §5 for the
 * column contract.
 */

import { useDevMode } from "@/lib/providers/dev-mode"
import { labelFor } from "@/lib/copy/labels"
import type { AgentInvocation } from "@/lib/cae-agents-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export function RecentInvocationsTable({
  invocations,
}: {
  invocations: AgentInvocation[]
}) {
  const { dev } = useDevMode()
  const t = labelFor(dev)
  if (invocations.length === 0) {
    return (
      <div
        data-testid="recent-invocations-empty"
        className="text-xs text-[color:var(--text-muted,#8a8a8c)] py-6"
      >
        {t.agentsDrawerRecentEmpty}
      </div>
    )
  }
  return (
    <section
      data-testid="recent-invocations"
      aria-labelledby="recent-heading"
      className="flex flex-col gap-2"
    >
      <h3
        id="recent-heading"
        className="text-sm font-semibold uppercase tracking-wide text-[color:var(--text-muted,#8a8a8c)]"
      >
        {t.agentsDrawerRecentHeading}
      </h3>
      <div className="overflow-auto max-h-[320px] rounded-md border border-[color:var(--border,#1f1f22)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-mono text-xs">ts</TableHead>
              <TableHead className="font-mono text-xs">project</TableHead>
              <TableHead className="font-mono text-xs">phase-task</TableHead>
              <TableHead className="font-mono text-xs text-right">
                tokens
              </TableHead>
              <TableHead className="font-mono text-xs text-right">
                wall
              </TableHead>
              <TableHead className="font-mono text-xs">status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invocations.map((inv, i) => (
              <TableRow key={i}>
                <TableCell className="font-mono text-xs">
                  {formatTs(inv.ts)}
                </TableCell>
                <TableCell className="font-mono text-xs truncate max-w-[120px]">
                  {inv.project}
                </TableCell>
                <TableCell className="font-mono text-xs truncate max-w-[160px]">
                  {inv.phase + (inv.task ? "-" + inv.task : "")}
                </TableCell>
                <TableCell className="font-mono text-xs text-right">
                  {inv.tokens.toLocaleString()}
                </TableCell>
                <TableCell className="font-mono text-xs text-right">
                  {Math.round(inv.wall_ms / 1000)}s
                </TableCell>
                <TableCell className="font-mono text-xs">
                  <span
                    className={
                      inv.status === "ok"
                        ? "text-[color:var(--success,#22c55e)]"
                        : "text-[color:var(--danger,#ef4444)]"
                    }
                  >
                    {inv.status === "ok"
                      ? t.agentsDrawerRecentStatusOk
                      : t.agentsDrawerRecentStatusFail}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function formatTs(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  } catch {
    return iso
  }
}
