"use client";

/**
 * Phase 9 Wave 2 (plan 09-04, CHG-01, D-12) — ChangesClient.
 *
 * Client island for /build/changes. Fetches the frozen-in-09-02 API:
 *   GET /api/changes → { projects: ProjectGroup[], generated_at, cache_ttl_ms }
 *
 * Renders:
 *   - Page heading + ExplainTooltip (D-15).
 *   - Lede: count of events whose `ts` falls on "today" (local calendar,
 *     matching founder mental model for "today"), formatted via
 *     `changesPageLede(n)`.
 *   - One base-ui Accordion.Root wrapping ProjectGroups. `multiple={true}` +
 *     `defaultValue={allProjectIds}` per D-12 (every project expanded by
 *     default). No `asChild` anywhere (gotcha #5).
 *
 * States:
 *   - Pre-fetch → founder-speak loading copy (changesEmpty placeholder is
 *     re-used as the neutral resting state).
 *   - Error → `changesFailedToLoad`.
 *   - Zero projects → heading + empty copy.
 *
 * All strings flow through `labelFor(useDevMode().dev)`; no literal `$`.
 */

import { useEffect, useState } from "react";
import { Accordion } from "@base-ui/react/accordion";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { ExplainTooltip } from "@/components/ui/explain-tooltip";
import { ProjectGroup } from "@/components/changes/project-group";
import type { ProjectGroup as ProjectGroupData } from "@/lib/cae-changes-state";

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
        className="text-sm text-[color:var(--destructive,#ef4444)]"
      >
        {L.changesFailedToLoad}
      </p>
    );
  }

  if (!data) {
    return (
      <p
        data-testid="changes-loading"
        className="text-sm text-[color:var(--text-muted,#8a8a8c)]"
      >
        {L.changesEmpty}
      </p>
    );
  }

  const totalToday = countEventsToday(data);

  if (data.projects.length === 0) {
    return (
      <div>
        <h1 className="mb-2 flex items-center gap-2 text-2xl font-medium text-[color:var(--text,#e5e5e5)]">
          {L.changesPageHeading}
          <ExplainTooltip text={L.changesExplainTimeline} />
        </h1>
        <p
          data-testid="changes-empty"
          className="text-sm text-[color:var(--text-muted,#8a8a8c)]"
        >
          {L.changesEmpty}
        </p>
      </div>
    );
  }

  const allIds = data.projects.map((p) => p.project);

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-2 text-2xl font-medium text-[color:var(--text,#e5e5e5)]">
        {L.changesPageHeading}
        <ExplainTooltip text={L.changesExplainTimeline} />
      </h1>
      <p className="mb-6 text-sm text-[color:var(--text-muted,#8a8a8c)]">
        {L.changesPageLede(totalToday)}
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
