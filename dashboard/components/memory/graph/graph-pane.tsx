"use client";

/**
 * Phase 8 Wave 3 (MEM-05, MEM-07, D-05, D-17): Graph tab composition.
 *
 * Fetches `/api/memory/graph` on mount, tracks the 4 NodeKind filters (all
 * on by default — D-04: commits excluded), renders the 500-node-cap
 * banner, the `<GraphCanvas>`, and the `<NodeDrawer>`. Filters + the
 * Regenerate button are wired in Task 2 (same plan, different task).
 *
 * This file carries `"use client"` (D-08) because react-flow and the
 * event-driven drawer need the browser runtime.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { GraphNode, GraphPayload, NodeKind } from "@/lib/cae-graph-state";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { ExplainTooltip } from "@/components/ui/explain-tooltip";
import { GraphCanvas } from "./graph-canvas";
import { NodeDrawer } from "./node-drawer";

const ALL_KINDS: readonly NodeKind[] = ["phases", "agents", "notes", "PRDs"];

export function GraphPane() {
  const { dev } = useDevMode();
  const L = labelFor(dev);

  const [payload, setPayload] = useState<GraphPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedKinds] = useState<Set<NodeKind>>(
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

  const { filteredNodes, filteredLinks } = useMemo(() => {
    if (!payload) {
      return {
        filteredNodes: [] as GraphNode[],
        filteredLinks: [],
      };
    }
    const keep = payload.nodes.filter((n) => selectedKinds.has(n.kind));
    const keepIds = new Set(keep.map((n) => n.id));
    const keepLinks = payload.links.filter(
      (l) => keepIds.has(l.source) && keepIds.has(l.target),
    );
    return {
      filteredNodes: keep,
      filteredLinks: keepLinks,
    };
  }, [payload, selectedKinds]);

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

      {/* Controls row — filters + regenerate wired by Task 2. */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--border)] px-3 py-2"
        data-testid="memory-graph-controls"
      >
        <div className="flex items-center gap-2">
          <ExplainTooltip text={L.memoryExplainGraph} />
        </div>
      </div>

      {/* Body */}
      <div className="relative flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center text-xs text-[color:var(--text-muted)]">
            {L.metricsEmptyState}
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center text-xs text-[color:var(--danger)]">
            {error}
          </div>
        ) : isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-xs text-[color:var(--text-muted)]">
            <p>{L.memoryEmptyGraph}</p>
            <p className="text-[10px] text-[color:var(--text-dim)]">
              ↑ {L.memoryBtnRegenerate}
            </p>
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
      />
    </div>
  );
}
