"use client"

/**
 * AuditTable — filterable, paginated view of tool-call audit log.
 *
 * Filters: date range (from/to), tool name select, task text filter.
 * On filter change, re-fetches /api/security/audit with params.
 * Click row to expand full cwd + ts detail.
 *
 * Phase 15 Wave 2.6 (bonus): both empty branches now adopt <EmptyState>
 * + EMPTY_COPY.audit so the rest-state speaks in CAE's voice and matches
 * every other surface visually. testIds preserved (audit-empty / audit-table-empty).
 */
import { useState, useCallback, Fragment } from "react"
import { ShieldCheck } from "lucide-react"
import type { AuditEntry } from "@/lib/cae-types"
import { EmptyState } from "@/components/ui/empty-state"
import { EMPTY_COPY } from "@/lib/copy/empty-states"

const PAGE_SIZE = 50

export type AuditTableProps = {
  initial: { entries: AuditEntry[]; total: number }
}

function relativeTime(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(ts).toLocaleDateString()
}

export function AuditTable({ initial }: AuditTableProps) {
  const [entries, setEntries] = useState(initial.entries)
  const [total, setTotal] = useState(initial.total)
  const [tool, setTool] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [taskFilter, setTaskFilter] = useState("")
  const [page, setPage] = useState(0)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetch_ = useCallback(
    async (opts: { tool?: string; from?: string; to?: string; task?: string; page?: number }) => {
      setLoading(true)
      try {
        const sp = new URLSearchParams()
        if (opts.tool) sp.set("tool", opts.tool)
        if (opts.from) sp.set("from", opts.from)
        if (opts.to) sp.set("to", opts.to)
        if (opts.task) sp.set("task", opts.task)
        sp.set("limit", String(PAGE_SIZE))
        sp.set("offset", String((opts.page ?? 0) * PAGE_SIZE))
        const res = await fetch(`/api/security/audit?${sp}`)
        if (res.ok) {
          const data = await res.json()
          setEntries(data.entries)
          setTotal(data.total)
        }
      } finally {
        setLoading(false)
      }
    },
    []
  )

  function applyFilters(overrides: Partial<{ tool: string; from: string; to: string; task: string; page: number }>) {
    const next = { tool, from, to, task: taskFilter, page, ...overrides }
    setPage(next.page ?? 0)
    fetch_(next)
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Cold-start empty (no filters applied yet) — use the full character copy.
  if (entries.length === 0 && !loading && !tool && !from && !to && !taskFilter) {
    return (
      <EmptyState
        icon={ShieldCheck}
        testId="audit-empty"
        {...EMPTY_COPY.audit}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          data-testid="audit-filter-tool"
          value={tool}
          onChange={(e) => { setTool(e.target.value); applyFilters({ tool: e.target.value, page: 0 }) }}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
        >
          <option value="">All tools</option>
          {["Bash", "Write", "Edit", "MultiEdit", "Agent", "Task"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input
          data-testid="audit-filter-from"
          type="date"
          value={from}
          onChange={(e) => { setFrom(e.target.value); applyFilters({ from: e.target.value, page: 0 }) }}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
          placeholder="From"
        />
        <input
          data-testid="audit-filter-to"
          type="date"
          value={to}
          onChange={(e) => { setTo(e.target.value); applyFilters({ to: e.target.value, page: 0 }) }}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300"
          placeholder="To"
        />
        <input
          data-testid="audit-filter-task"
          type="text"
          value={taskFilter}
          onChange={(e) => { setTaskFilter(e.target.value); applyFilters({ task: e.target.value, page: 0 }) }}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-300 w-32"
          placeholder="Task ID"
        />
        <span className="ml-auto text-xs text-zinc-500 self-center">
          {total} {total === 1 ? "entry" : "entries"}
        </span>
      </div>

      {/* Table */}
      <div className="rounded border border-zinc-800 overflow-x-auto">
        {entries.length === 0 ? (
          // Filter-applied empty — short copy because the user controls the filters.
          <div data-testid="audit-table-empty" className="py-6">
            <EmptyState
              icon={ShieldCheck}
              testId="audit-table-empty-state"
              title="No entries match the current filters"
              description="Loosen the date range or clear the tool / task filter to see more."
            />
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900">
                <th className="py-2 px-3 text-left font-medium text-zinc-500">When</th>
                <th className="py-2 px-3 text-left font-medium text-zinc-500">Tool</th>
                <th className="py-2 px-3 text-left font-medium text-zinc-500">Task</th>
                <th className="py-2 px-3 text-left font-medium text-zinc-500">Directory</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const rowKey = `${e.ts}-${i}`
                const isExp = expanded === rowKey
                return (
                  <Fragment key={rowKey}>
                    <tr
                      data-testid={`audit-row-${i}`}
                      onClick={() => setExpanded(isExp ? null : rowKey)}
                      className="cursor-pointer border-b border-zinc-800/50 hover:bg-zinc-800/30"
                    >
                      <td className="py-2 px-3 text-zinc-400" title={e.ts}>
                        {relativeTime(e.ts)}
                      </td>
                      <td className="py-2 px-3">
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-zinc-300">
                          {e.tool}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-zinc-400">
                          {e.task}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-zinc-500 truncate max-w-[200px]">
                        {e.cwd}
                      </td>
                    </tr>
                    {isExp && (
                      <tr key={`${rowKey}-exp`} className="bg-zinc-900/50">
                        <td colSpan={4} className="px-4 py-3">
                          <pre className="text-xs text-zinc-400 whitespace-pre-wrap break-all">
                            {JSON.stringify(e, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            disabled={page === 0 || loading}
            onClick={() => { const p = page - 1; setPage(p); fetch_({ tool, from, to, task: taskFilter, page: p }) }}
            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400
              hover:border-zinc-500 disabled:opacity-30"
          >
            ← Prev
          </button>
          <span className="text-xs text-zinc-500">
            Page {page + 1} of {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount - 1 || loading}
            onClick={() => { const p = page + 1; setPage(p); fetch_({ tool, from, to, task: taskFilter, page: p }) }}
            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400
              hover:border-zinc-500 disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
