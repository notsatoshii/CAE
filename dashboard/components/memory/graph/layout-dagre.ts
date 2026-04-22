/**
 * Phase 8 Wave 3 (D-08, MEM-05): pure dagre layout for the memory graph.
 *
 * Takes graph nodes/links and runs dagre's LR rank algorithm. Returns a new
 * array of nodes each enriched with `position: { x, y }` suitable for
 * @xyflow/react. The input arrays are never mutated; each returned node is
 * a fresh object so consumers can use the result in `useMemo` deps without
 * worrying about shared refs.
 *
 * The file is a PURE UTILITY — no `"use client"` directive. It's imported
 * by the client-side GraphCanvas component and runs in the browser, but
 * Next can tree-shake and statically analyse it either way.
 *
 * Re-invoke whenever the filtered-node set changes. Dagre is synchronous
 * and typically <5ms for the 500-node cap (D-05) on a typical dev machine.
 * Memoization happens in the caller (GraphCanvas `useMemo`).
 */
import dagre from "@dagrejs/dagre";
import type { GraphLink, GraphNode } from "@/lib/cae-graph-state";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 50;

export interface PositionedNode extends GraphNode {
  position: { x: number; y: number };
}

export function applyDagreLayout(
  nodes: GraphNode[],
  links: GraphLink[],
): PositionedNode[] {
  if (nodes.length === 0) return [];

  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "LR", ranksep: 80, nodesep: 40 });

  for (const n of nodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const l of links) {
    // Guard against dangling edges — dagre throws if endpoints are missing.
    if (g.hasNode(l.source) && g.hasNode(l.target)) {
      g.setEdge(l.source, l.target);
    }
  }

  dagre.layout(g);

  return nodes.map((n) => {
    const p = g.node(n.id);
    const x = typeof p?.x === "number" ? p.x - NODE_WIDTH / 2 : 0;
    const y = typeof p?.y === "number" ? p.y - NODE_HEIGHT / 2 : 0;
    return { ...n, position: { x, y } };
  });
}
