"use client";

/**
 * Phase 9 Wave 2 (plan 09-04, CHG-01, D-12) — ChangesClient.
 *
 * Client island for /build/changes. Fetches the frozen-in-09-02 API:
 *   GET /api/changes → { projects: ProjectGroup[], generated_at, cache_ttl_ms }
 *
 * Renders:
 *   - Page heading + ExplainTooltip (D-15).
 *   - Lede: founder copy calibrated against totals. When today > 0 we lead
 *     with "N change(s) today." — otherwise we lead with the 30-day total so
 *     the copy never contradicts the list below ("Nothing today — yet" was
 *     flagged by C2 vision as contradicting the visibly-populated accordion).
 *   - One base-ui Accordion.Root wrapping ProjectGroups. `multiple={true}` +
 *     `defaultValue={allProjectIds}` per D-12 (every project expanded by
 *     default). No `asChild` anywhere (gotcha #5).
 *
 * States:
 *   - Pre-fetch  → loading copy (liveness=loading).
 *   - Error      → `changesFailedToLoad`.
 *   - Zero projects → EmptyState with `changesEmpty` copy + refresh CTA.
 *
 * All strings flow through `labelFor(useDevMode().dev)`; no literal `$`.
 */

import { useEffect, useState } from "react";
import { GitMerge } from "lucide-react";
import { Accordion } from "@base-ui/react/accordion";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { ExplainTooltip } from "@/components/ui/explain-tooltip";
import { ProjectGroup } from "@/components/changes/project-group";
import type { ProjectGroup as ProjectGroupData } from "@/lib/cae-changes-state";
import { EmptyState, EmptyStateActions } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

interface ChangesResponse {
  projects: ProjectGroupData[];
  generated_at: string;
  cache_ttl_ms: number;
}

function countEventsToday(data: ChangesResponse): number {
  const now = new Date();
  const today = now.toDateString();
  let n = 0;
  for (const g of data.projects) {
    for (const e of g.events) {
      const d = new Date(e.ts);
      if (Number.isFinite(d.getTime()) && d.toDateString() === today) n++;
    }
  }
  return n;
}

export function ChangesClient() {
  const { dev } = useDevMode();
  const L = labelFor(dev);
  const [data, setData] = useState<ChangesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/changes");
        if (!res.ok) throw new Error("status " + res.status);
        const j = (await res.json()) as ChangesResponse;
        if (!cancelled) setData(j);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "fetch failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p
        data-testid="changes-error"
        data-liveness="error"
        className="text-sm text-[color:var(--destructive,#ef4444)]"
      >
        <span className="sr-only" data-truth="build-changes.error">yes</span>
        {L.changesFailedToLoad}
      </p>
    );
  }

  if (!data) {
    return (
      <p
        data-testid="changes-loading"
        data-liveness="loading"
        className="text-sm text-[color:var(--text-muted,#8a8a8c)]"
      >
        <span className="sr-only" data-truth="build-changes.loading">yes</span>
        {L.changesEmpty}
      </p>
    );
  }

  const totalToday = countEventsToday(data);
  const totalEvents = data.projects.reduce((s, p) => s + p.events.length, 0);

  if (data.projects.length === 0) {
    return (
      <div data-testid="build-changes-empty-root" data-liveness="empty">
        <span className="sr-only" data-truth="build-changes.empty">yes</span>
        <span className="sr-only" data-truth="build-changes.loading">no</span>
        <span className="sr-only" data-truth="build-changes.project-count">0</span>
        <span className="sr-only" data-truth="build-changes.event-count">0</span>
        <h1 className="mb-4 flex items-center gap-2 text-2xl font-medium text-[color:var(--text,#e5e5e5)]">
          {L.changesPageHeading}
          <ExplainTooltip text={L.changesExplainTimeline} />
        </h1>
        {/*
         * Class 5C — EmptyState replaces any phantom-row fallback. A single
         * friendly empty message + refresh CTA; no fabricated rows, no
         * repeating placeholder copy.
         */}
        <EmptyState
          testId="changes-empty"
          icon={GitMerge}
          heading={L.changesEmpty}
          body={L.emptyChangesBody}
          actions={
            <EmptyStateActions>
              <Button
                variant="secondary"
                onClick={() => window.location.reload()}
              >
                {L.emptyChangesCtaClear}
              </Button>
            </EmptyStateActions>
          }
        />
      </div>
    );
  }

  const allIds = data.projects.map((p) => p.project);

  return (
    <div data-testid="build-changes-root" data-liveness="healthy">
      <span className="sr-only" data-truth="build-changes.healthy">yes</span>
      <span className="sr-only" data-truth="build-changes.loading">no</span>
      <span className="sr-only" data-truth="build-changes.project-count">
        {data.projects.length}
      </span>
      <span className="sr-only" data-truth="build-changes.event-count">
        {totalEvents}
      </span>
      <span className="sr-only" data-truth="build-changes.events-today">
        {totalToday}
      </span>
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-medium text-[color:var(--text,#e5e5e5)]">
        {L.changesPageHeading}
        <ExplainTooltip text={L.changesExplainTimeline} />
      </h1>
      {/*
       * Class 5C — when today=0 but older events exist we avoid the
       * "Nothing's shipped today — yet" lede (C2 vision flagged it as
       * contradicting the visibly-populated list below). Show 30-day total
       * instead so the copy is always consistent with the accordion.
       */}
      <p className="mb-6 text-sm text-[color:var(--text-muted,#8a8a8c)]">
        {totalToday > 0
          ? L.changesPageLede(totalToday)
          : totalEvents +
            " " +
            (totalEvents === 1 ? "change" : "changes") +
            " in the last 30 days."}
      </p>
      <Accordion.Root
        multiple
        defaultValue={allIds}
        className="rounded-lg border border-[color:var(--border,#1f1f22)] bg-[color:var(--surface,#121214)]"
        data-testid="changes-accordion"
      >
        {data.projects.map((g) => (
          <ProjectGroup key={g.project} group={g} />
        ))}
      </Accordion.Root>
    </div>
  );
}
