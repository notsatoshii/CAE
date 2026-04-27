/**
 * Phase 8 Wave 3 (D-08, MEM-05): cluster-based force-directed layout for the
 * memory graph.
 *
 * Replaces dagre LR layout which produced a horizontal line for graphs with
 * many disconnected nodes. Instead: groups nodes by `kind` into quadrant
 * clusters, arranges each cluster in a grid, then applies a simple
 * force-directed pass to pull linked nodes closer together.
 *
 * The file is a PURE UTILITY — no `"use client"` directive.
 */
import type { GraphLink, GraphNode } from "@/lib/cae-graph-state";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 50;
const GRID_SPACING_X = 220;
const GRID_SPACING_Y = 80;

export interface PositionedNode extends GraphNode {
  position: { x: number; y: number };
}

/** Cluster center positions for each kind */
const CLUSTER_CENTERS: Record<string, { x: number; y: number }> = {
  phases: { x: -1500, y: -1000 },
  agents: { x: 1500, y: -1000 },
  notes: { x: -1500, y: 1000 },
  PRDs: { x: 1500, y: 1000 },
};

export function applyDagreLayout(
  nodes: GraphNode[],
  links: GraphLink[],
): PositionedNode[] {
  if (nodes.length === 0) return [];

  // Group nodes by kind
  const groups = new Map<string, GraphNode[]>();
  for (const n of nodes) {
    const kind = n.kind ?? "notes";
    let arr = groups.get(kind);
    if (!arr) {
      arr = [];
      groups.set(kind, arr);
    }
    arr.push(n);
  }

  // Lay out each group in a grid centered on its cluster position
  const posMap = new Map<string, { x: number; y: number }>();

  for (const [kind, group] of groups) {
    const center = CLUSTER_CENTERS[kind] ?? { x: 0, y: 0 };
    const cols = Math.max(1, Math.ceil(Math.sqrt(group.length)));

    for (let i = 0; i < group.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = center.x + (col - cols / 2) * GRID_SPACING_X;
      const y = center.y + (row - Math.floor(group.length / cols) / 2) * GRID_SPACING_Y;
      posMap.set(group[i].id, { x, y });
    }
  }

  // Simple force-directed adjustment: pull linked nodes toward each other
  // Run a few iterations to settle
  const ITERATIONS = 30;
  const ATTRACTION = 0.05;

  // Build adjacency for quick lookup
  const nodeIds = new Set(nodes.map((n) => n.id));
  const validLinks = links.filter(
    (l) => nodeIds.has(l.source) && nodeIds.has(l.target),
  );

  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (const link of validLinks) {
      const sPos = posMap.get(link.source);
      const tPos = posMap.get(link.target);
      if (!sPos || !tPos) continue;

      const dx = tPos.x - sPos.x;
      const dy = tPos.y - sPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) continue;

      // Only attract if far apart (beyond one grid cell)
      const idealDist = 250;
      if (dist <= idealDist) continue;

      const force = (dist - idealDist) * ATTRACTION;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;

      sPos.x += fx;
      sPos.y += fy;
      tPos.x -= fx;
      tPos.y -= fy;
    }
  }

  return nodes.map((n) => {
    const p = posMap.get(n.id) ?? { x: 0, y: 0 };
    return { ...n, position: { x: p.x - NODE_WIDTH / 2, y: p.y - NODE_HEIGHT / 2 } };
  });
}
