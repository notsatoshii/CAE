"use client"

/**
 * AgentDetailDrawer — right-slide sheet that renders the 6-section agent
 * detail surface (Phase 5 Plan 05-04).
 *
 * URL-state driven (mirrors Phase 4 task-detail-sheet convention):
 *   - ?agent={name} present  → drawer open, fetches /api/agents/{name} once
 *   - no ?agent param        → drawer closed
 *
 * Close path deletes only the `agent` key — any other query params (e.g. a
 * future ?project=) are preserved. Esc + focus-trap + focus-return are
 * handled natively by @base-ui/react/dialog (underneath the Sheet primitive).
 *
 * No polling inside the drawer (CONTEXT §Detail drawer explicitly). The
 * 30s aggregator cache absorbs re-open load.
 *
 * Section order (locked — CONTEXT §Detail drawer):
 *   1. Persona
 *   2. Model override
 *   3. Drift banner (conditional — above Lifetime)
 *   4. Lifetime stats
 *   4b. 7-day sparklines (P15 fix — surfaces stats_7d that was always in
 *       state but never rendered)
 *   5. Recent invocations
 *
 * See .planning/phases/05-agents-tab/05-CONTEXT.md §Detail drawer + §Drift
 * detection thresholds for the authoritative contract.
 */

import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { useDevMode } from "@/lib/providers/dev-mode"
import { labelFor } from "@/lib/copy/labels"
import { DriftBanner } from "./drift-banner"
import { PersonaMarkdown } from "./persona-markdown"
import { ModelOverride } from "./model-override"
import { LifetimeStats } from "./lifetime-stats"
import { RecentInvocationsTable } from "./recent-invocations-table"
import { Stats7dSparklines } from "./stats-7d-sparklines"
import type { AgentDetailEntry } from "@/lib/cae-agents-state"

export function AgentDetailDrawer() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { dev } = useDevMode()
  const t = labelFor(dev)

  const agentParam = searchParams?.get("agent") ?? ""
  const open = Boolean(agentParam)

  const [detail, setDetail] = useState<AgentDetailEntry | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setDetail(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch("/api/agents/" + encodeURIComponent(agentParam))
      .then((r) => {
        if (r.status === 404) throw new Error("not_found")
        if (!r.ok) throw new Error("fetch_failed_" + r.status)
        return r.json()
      })
      .then((json: AgentDetailEntry) => {
        if (!cancelled) setDetail(json)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, agentParam])

  const close = useCallback(() => {
    const p = new URLSearchParams(searchParams?.toString() ?? "")
    p.delete("agent")
    // URL-PARAM PRESERVATION: only `agent` is removed here. Any other query
    // params (e.g. a future ?project= or ?filter=) survive the drawer close.
    // Automated guard via verify greps this file for extra `.delete(` calls.
    const qs = p.toString()
    router.push((pathname ?? "/build/agents") + (qs ? "?" + qs : ""))
  }, [router, pathname, searchParams])

  // 30d baseline isn't returned in detail (aggregator only emits the boolean
  // drift_warning flag). For the dev-mode banner copy we approximate
  // pct30d = pct7d / 0.85 — the threshold boundary, close enough for the
  // banner per CONTEXT §Claude's Discretion.
  const pct7d = detail?.stats_7d.success_rate ?? 0
  const pct30d = Math.min(1, pct7d / 0.85)

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) close()
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:!max-w-xl lg:!max-w-2xl overflow-y-auto"
        data-testid="agent-detail-drawer"
      >
        <SheetHeader>
          <SheetTitle data-testid="agent-detail-title">
            {detail ? (
              <span className="flex items-center gap-2">
                <span aria-hidden className="text-2xl">
                  {detail.emoji}
                </span>
                <span>{detail.label}</span>
                {!dev && (
                  <span className="text-sm text-[color:var(--text-muted,#8a8a8c)] font-normal">
                    — {detail.founder_label}
                  </span>
                )}
              </span>
            ) : loading ? (
              <span>Loading…</span>
            ) : error ? (
              <span>{agentParam}</span>
            ) : (
              <span>{t.agentsDrawerTitle}</span>
            )}
          </SheetTitle>
          <SheetDescription>{t.agentsDrawerTitle}</SheetDescription>
        </SheetHeader>

        <div
          className="px-6 pb-8 flex flex-col gap-6"
          data-testid="agent-detail-body"
        >
          {loading && (
            <div
              data-testid="agent-detail-loading"
              className="flex flex-col gap-2"
            >
              <div className="h-4 w-32 rounded bg-[color:var(--surface-hover,#1a1a1d)] animate-pulse" />
              <div className="h-24 rounded bg-[color:var(--surface-hover,#1a1a1d)] animate-pulse" />
              <div className="h-12 rounded bg-[color:var(--surface-hover,#1a1a1d)] animate-pulse" />
            </div>
          )}

          {!loading && error && (
            <div
              data-testid="agent-detail-error"
              role="alert"
              className="rounded-md border border-[color:var(--danger,#ef4444)] bg-[color:var(--danger,#ef4444)]/10 p-4 text-sm text-[color:var(--danger,#ef4444)]"
            >
              {error === "not_found" ? (
                <>
                  No agent named{" "}
                  <code className="font-mono">{agentParam}</code>.
                </>
              ) : (
                <>Couldn&apos;t load agent detail. ({error})</>
              )}
            </div>
          )}

          {!loading && detail && (
            <>
              {/* 1. Persona */}
              <section
                data-testid="drawer-section-persona"
                aria-labelledby="persona-heading"
                className="flex flex-col gap-2"
              >
                <h3
                  id="persona-heading"
                  className="text-sm font-semibold uppercase tracking-wide text-[color:var(--text-muted,#8a8a8c)]"
                >
                  {t.agentsDrawerPersonaHeading}
                </h3>
                {detail.persona_md ? (
                  <PersonaMarkdown source={detail.persona_md} />
                ) : (
                  <p className="text-sm text-[color:var(--text-muted,#8a8a8c)]">
                    {t.agentsDrawerPersonaMissing}
                  </p>
                )}
              </section>

              {/* 2. Model override */}
              <ModelOverride
                agentName={detail.name}
                currentModel={detail.model}
              />

              {/* 3. Drift banner — conditional, ABOVE lifetime */}
              {detail.drift_warning && (
                <DriftBanner
                  agentLabel={detail.label}
                  successRate7d={pct7d}
                  successRate30d={pct30d}
                />
              )}

              {/* 4. Lifetime stats */}
              <LifetimeStats lifetime={detail.lifetime} />

              {/* 4b. 7-day sparklines — P15 detail-expand fix. stats_7d is
                   on AgentDetailEntry but was never rendered; surfaces here
                   under Lifetime so trend is visible at a glance. */}
              <Stats7dSparklines stats_7d={detail.stats_7d} />

              {/* 5. Recent invocations */}
              <RecentInvocationsTable
                invocations={detail.recent_invocations}
              />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
