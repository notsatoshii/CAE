"use client"

/**
 * RecentCommits — Class 15C.
 *
 * Card rendered on /build home that shows the last 10 commits from the
 * active repo. Fetches from /api/commits (local git log + optional
 * GitHub REST union). Links each row to GitHub when a URL is available.
 *
 * States (per Class 3 liveness discipline):
 *   - loading  → rendered while awaiting the first fetch
 *   - empty    → rendered when /api/commits returns []
 *   - error    → rendered on fetch/HTTP failure
 *   - healthy  → rendered with the list, plus `data-liveness="healthy"`
 *
 * Eric's ask: "Also somewhere on the dash should track github commits as
 * well think it should go in home somewhere."
 */

import { useCallback, useEffect, useState } from "react"
import { GitCommit, ExternalLink } from "lucide-react"
import { Panel } from "@/components/ui/panel"
import { EmptyState } from "@/components/ui/empty-state"
import { LastUpdated } from "@/components/ui/last-updated"
import { Skeleton } from "@/components/ui/skeleton"

interface CommitRow {
  sha: string
  shortSha: string
  subject: string
  author: string
  ts: string
  url?: string
  source: "local" | "github"
}

interface CommitsResponse {
  commits: CommitRow[]
  repo: string | null
}

const POLL_MS = 30_000

/**
 * Render an ISO timestamp as a human-friendly relative string.
 * Inline impl avoids pulling date-fns into the build — we already hand-
 * roll relative-time formatting elsewhere (recent-ledger pattern).
 */
function relativeTime(iso: string, now = Date.now()): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return iso
  const delta = Math.max(0, now - then)
  if (delta < 60_000) return "just now"
  if (delta < 3_600_000) {
    const m = Math.round(delta / 60_000)
    return `${m}m ago`
  }
  if (delta < 86_400_000) {
    const h = Math.round(delta / 3_600_000)
    return `${h}h ago`
  }
  const d = Math.round(delta / 86_400_000)
  return `${d}d ago`
}

export function RecentCommits() {
  const [data, setData] = useState<CommitsResponse | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(null)

  const fetchCommits = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/commits?limit=10", { signal })
      if (!res.ok) throw new Error(`/api/commits ${res.status}`)
      const json = (await res.json()) as CommitsResponse
      setData(json)
      setLastUpdated(Date.now())
      setError(null)
    } catch (err) {
      if ((err as Error).name === "AbortError") return
      setError(err instanceof Error ? err : new Error(String(err)))
    }
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    fetchCommits(ctrl.signal)
    const id = window.setInterval(() => fetchCommits(), POLL_MS)
    return () => {
      ctrl.abort()
      window.clearInterval(id)
    }
  }, [fetchCommits])

  const loading = data === null && error === null
  const empty = data !== null && data.commits.length === 0
  const healthy = data !== null && data.commits.length > 0

  let liveness: "loading" | "empty" | "error" | "healthy" = "loading"
  if (error) liveness = "error"
  else if (loading) liveness = "loading"
  else if (empty) liveness = "empty"
  else liveness = "healthy"

  return (
    <Panel
      title="Recent commits"
      headingId="recent-commits-heading"
      testId="recent-commits"
      className="mb-6"
      dataLiveness={liveness}
      subtitle={
        healthy ? <LastUpdated at={lastUpdated} threshold_ms={60_000} /> : undefined
      }
    >
      <span className="sr-only" data-truth="recent-commits.healthy">
        {healthy ? "yes" : "no"}
      </span>
      <span className="sr-only" data-truth="recent-commits.count">
        {data?.commits.length ?? 0}
      </span>

      {loading && (
        <div
          data-testid="recent-commits-loading"
          role="status"
          aria-busy="true"
          className="flex flex-col gap-2"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-6 w-full" />
          ))}
        </div>
      )}

      {error && (
        <EmptyState
          icon={GitCommit}
          testId="recent-commits-error"
          title="Couldn't reach git."
          description={error.message}
          variant="error"
        />
      )}

      {empty && (
        <EmptyState
          icon={GitCommit}
          testId="recent-commits-empty"
          title="No commits in the last 7 days."
          description="Ship something and it lands here the moment git finishes."
        />
      )}

      {healthy && data && (
        <ul
          className="divide-y divide-[color:var(--border-subtle)] font-mono text-xs"
          role="list"
        >
          {data.commits.map((c) => (
            <CommitLi key={c.sha} c={c} />
          ))}
        </ul>
      )}

      {healthy && (
        <div className="mt-3 flex justify-end">
          <a
            href="/build/changes"
            className="text-[11px] text-[color:var(--text-muted)] hover:text-[color:var(--text)] underline underline-offset-2"
          >
            See all →
          </a>
        </div>
      )}
    </Panel>
  )
}

function CommitLi({ c }: { c: CommitRow }) {
  const rel = relativeTime(c.ts)
  const body = (
    <>
      <span
        aria-hidden="true"
        className="text-[color:var(--text-muted)] shrink-0"
        style={{ width: "6ch" }}
      >
        {c.shortSha}
      </span>
      <span className="text-[color:var(--text)] flex-1 truncate">{c.subject}</span>
      <span className="text-[color:var(--text-muted)] shrink-0">{c.author}</span>
      <span className="text-[color:var(--text-dim)] shrink-0" style={{ width: "6ch", textAlign: "right" }}>
        {rel}
      </span>
      {c.url && (
        <ExternalLink
          aria-hidden="true"
          size={12}
          className="text-[color:var(--text-dim)] shrink-0"
        />
      )}
    </>
  )
  const label = `Commit ${c.shortSha} by ${c.author}: ${c.subject}`
  return (
    <li role="listitem" data-testid={`recent-commit-${c.shortSha}`}>
      {c.url ? (
        <a
          href={c.url}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={label}
          className="flex w-full items-center gap-3 py-1.5 cursor-pointer transition-colors hover:bg-[color:var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] rounded-sm px-1 -mx-1"
        >
          {body}
        </a>
      ) : (
        <div
          aria-label={label}
          className="flex w-full items-center gap-3 py-1.5 px-1 -mx-1"
        >
          {body}
        </div>
      )}
    </li>
  )
}
