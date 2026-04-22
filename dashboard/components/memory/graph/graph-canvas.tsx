"use client";

/**
 * Phase 8 Wave 3 (D-08, D-17, MEM-05): native @xyflow/react canvas.
 *
 * Renders memory nodes + links via react-flow v12. NO iframe (D-17) — the
 * canvas mounts directly in the dashboard. React-Flow CSS is imported once
 * in app/globals.css (D-08) — this file MUST NOT re-import it.
 *
 * Layout is precomputed by the pure `applyDagreLayout` util (dagre LR
 * rankdir). We translate our memory-graph domain types (`GraphNode`,
 * `GraphLink`) into the shapes react-flow consumes (`Node`, `Edge`).
 *
 * Node colouring by kind (D-04 palette → UI-SPEC §13 tokens):
 *   phases → cyan accent border
 *   agents → accent-muted border
 *   notes  → border-strong (default)
 *   PRDs   → success green
 *
 * `onNodeClick` is invoked with the underlying `GraphNode`, not the RF
 * shape — keeps the consumer (GraphPane / NodeDrawer) decoupled from the
 * react-flow API.
 */

import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node as RFNode,
  type Edge as RFEdge,
  type NodeMouseHandler,
} from "@xyflow/react";
import type { GraphLink, GraphNode, NodeKind } from "@/lib/cae-graph-state";
import { applyDagreLayout } from "./layout-dagre";

interface GraphCanvasProps {
  nodes: GraphNode[];
  links: GraphLink[];
  onNodeClick: (n: GraphNode) => void;
}

// Map a NodeKind to a CSS custom property for the node border. Using CSS
// vars keeps the palette owned by app/globals.css (single source of truth).
const KIND_BORDER: Record<NodeKind, string> = {
  phases: "var(--accent)",
  agents: "var(--accent-muted)",
  notes: "var(--border-strong)",
  PRDs: "var(--success)",
};

function labelFor(n: GraphNode): string {
  if (n.label && n.label.length > 0) return n.label;
  // Fallback to basename of id (absolute path).
  const i = n.id.lastIndexOf("/");
  return i < 0 ? n.id : n.id.slice(i + 1);
}

export function GraphCanvas({ nodes, links, onNodeClick }: GraphCanvasProps) {
  // Signature includes both the sorted id set AND edge count so the layout
  // recomputes when either axis changes (filter toggle, regeneration, etc.).
  const sig = useMemo(() => {
    const ids = nodes.map((n) => n.id).sort().join("|");
    return ids + "#" + links.length;
  }, [nodes, links]);

  const positioned = useMemo(() => {
    return applyDagreLayout(nodes, links);
    // Intentionally re-compute on `sig` change; nodes/links objects can be
    // stable refs whose contents changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const rfNodes: RFNode[] = useMemo(
    () =>
      positioned.map((n) => ({
        id: n.id,
        position: n.position,
        data: { label: labelFor(n) },
        type: "default",
        style: {
          border: "1px solid " + KIND_BORDER[n.kind],
          background: "var(--surface)",
          color: "var(--text)",
          fontSize: 12,
          borderRadius: 6,
          padding: "6px 10px",
          width: 180,
        },
      })),
    [positioned],
  );

  const rfEdges: RFEdge[] = useMemo(
    () =>
      links.map((l, idx) => ({
        id: l.source + "->" + l.target + "#" + idx,
        source: l.source,
        target: l.target,
        style: { stroke: "var(--border-strong)", strokeWidth: 1 },
      })),
    [links],
  );

  // Build an id -> GraphNode lookup so the RF click handler can hand the
  // consumer the original domain object (not the RF shape).
  const byId = useMemo(() => {
    const m = new Map<string, GraphNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_evt, rfNode) => {
      const domain = byId.get(rfNode.id);
      if (domain) onNodeClick(domain);
    },
    [byId, onNodeClick],
  );

  return (
    <div className="h-full w-full" data-testid="memory-graph-canvas">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodeClick={handleNodeClick}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
