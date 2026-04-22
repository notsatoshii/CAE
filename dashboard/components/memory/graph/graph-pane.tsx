"use client";

/**
 * Phase 8 Wave 3 (MEM-05..MEM-08, D-04..D-06, D-08, D-17): Graph tab.
 *
 * Fetches `/api/memory/graph` on mount, tracks the 4 NodeKind filters (all
 * on by default — D-04: commits excluded), renders the 500-node-cap
 * banner (D-05), the `<GraphFilters>` chip row, the `<RegenerateButton>`
 * (D-06 debounce), the `<GraphCanvas>`, and the `<NodeDrawer>` overlay.
 *
 * This file carries `"use client"` (D-08) because react-flow and the
 * event-driven drawer need the browser runtime.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { GitBranch } from "lucide-react";
import type { GraphNode, GraphPayload, NodeKind } from "@/lib/cae-graph-state";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { ExplainTooltip } from "@/components/ui/explain-tooltip";
import { GraphCanvas } from "./graph-canvas";
import { NodeDrawer } from "./node-drawer";
import { GraphFilters } from "./graph-filters";
import { RegenerateButton } from "./regenerate-button";
import { EmptyState, EmptyStateActions } from "@/components/ui/empty-state";

const ALL_KINDS: readonly NodeKind[] = ["phases", "agents", "notes", "PRDs"];

function toggleSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export interface GraphPaneProps {
  /**
   * Optional callback wired by Wave 5's MemoryClient. When present, the
   * NodeDrawer (08-05) renders the "When this changed" button and pipes
   * the clicked node's `source_file` into this callback, which in turn
   * opens the shared <GitTimelineDrawer> mounted at MemoryClient level.
   * When absent (e.g. isolated render in a test), the button hides.
   */
  onOpenGitTimeline?: (absPath: string) => void;
}

export function GraphPane({ onOpenGitTimeline }: GraphPaneProps = {}) {
  const { dev } = useDevMode();
  const L = labelFor(dev);

  const [payload, setPayload] = useState<GraphPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKinds, setSelectedKinds] = useState<Set<NodeKind>>(
    () => new Set(ALL_KINDS),
  );
  const [activeNode, setActiveNode] = useState<GraphNode | null>(null);

  const refetchGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/memory/graph", { cache: "no-store" });
      if (!res.ok) {
        setError(L.memoryLoadFailed);
        setPayload(null);
        return;
      }
      const data = (await res.json()) as GraphPayload;
      setPayload(data);
    } catch {
      setError(L.memoryLoadFailed);
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [L]);

  useEffect(() => {
    void refetchGraph();
  }, [refetchGraph]);

  const { filteredNodes, filteredLinks, kindCounts } = useMemo(() => {
    const counts: Record<NodeKind, number> = {
      phases: 0,
      agents: 0,
      notes: 0,
      PRDs: 0,
    };
    if (!payload) {
      return {
        filteredNodes: [] as GraphNode[],
        filteredLinks: [],
        kindCounts: counts,
      };
    }
    for (const n of payload.nodes) counts[n.kind] += 1;
    const keep = payload.nodes.filter((n) => selectedKinds.has(n.kind));
    const keepIds = new Set(keep.map((n) => n.id));
    const keepLinks = payload.links.filter(
      (l) => keepIds.has(l.source) && keepIds.has(l.target),
    );
    return {
      filteredNodes: keep,
      filteredLinks: keepLinks,
      kindCounts: counts,
    };
  }, [payload, selectedKinds]);

  const handleToggleKind = useCallback((k: NodeKind) => {
    setSelectedKinds((prev) => toggleSet(prev, k));
  }, []);

  const totalNodes = payload?.total_nodes ?? 0;
  const shownNodes = payload?.nodes.length ?? 0;
  const truncated = payload?.truncated ?? false;

  // Empty state — no graph generated yet OR walker found nothing.
  const isEmpty = !loading && !error && totalNodes === 0;

  return (
    <div
      className="flex h-full min-h-[500px] w-full flex-col"
      data-testid="memory-graph-pane"
    >
      {/* 500-cap banner (D-05) */}
      {truncated ? (
        <div
          className="flex items-center gap-2 border-b border-[color:var(--warning)] bg-[color:var(--warning)]/10 px-3 py-2 text-xs text-[color:var(--text)]"
          data-testid="memory-graph-node-cap-banner"
        >
          <span>{L.memoryGraphNodeCapBanner(shownNodes, totalNodes)}</span>
          <ExplainTooltip text={L.memoryExplainGraph} />
        </div>
      ) : null}

      {/* Controls row — filters (D-04) + regenerate (D-06). */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] px-3 py-2"
        data-testid="memory-graph-controls"
      >
        <div className="flex items-center gap-2">
          <GraphFilters
            selected={selectedKinds}
            onToggle={handleToggleKind}
            counts={kindCounts}
          />
          <ExplainTooltip text={L.memoryExplainGraph} />
        </div>
        <RegenerateButton
          generatedAt={payload?.generated_at}
          onRegenerated={refetchGraph}
        />
      </div>

      {/* Body */}
      <div className="relative flex-1">
        {loading ? (
          <div
            className="flex h-full flex-col items-center justify-center gap-3"
            data-testid="memory-graph-loading"
            aria-busy="true"
            aria-label="Loading memory graph"
          >
            {/* Skeleton shimmer — visually distinct from empty state */}
            <div className="flex flex-col items-center gap-2">
              <div className="h-4 w-32 animate-pulse rounded bg-[color:var(--border)] motion-reduce:animate-none" />
              <div className="h-3 w-48 animate-pulse rounded bg-[color:var(--border)] motion-reduce:animate-none" />
              <div className="h-3 w-40 animate-pulse rounded bg-[color:var(--border)] motion-reduce:animate-none" />
            </div>
            <p className="text-xs text-[color:var(--text-muted)]">{L.metricsEmptyState}</p>
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center text-xs text-[color:var(--danger)]">
            {error}
          </div>
        ) : isEmpty ? (
          <div className="flex h-full items-center justify-center p-8">
            <EmptyState
              icon={GitBranch}
              heading={L.emptyMemoryGraphHeading}
              body={L.emptyMemoryGraphBody}
              actions={
                <EmptyStateActions>
                  <RegenerateButton
                    generatedAt={payload?.generated_at}
                    onRegenerated={refetchGraph}
                  />
                </EmptyStateActions>
              }
            />
          </div>
        ) : (
          <GraphCanvas
            nodes={filteredNodes}
            links={filteredLinks}
            onNodeClick={setActiveNode}
          />
        )}
      </div>

      {/* Drawer overlay */}
      <NodeDrawer
        node={activeNode}
        links={payload?.links ?? []}
        onClose={() => setActiveNode(null)}
        onOpenGitTimeline={onOpenGitTimeline}
      />
    </div>
  );
}
