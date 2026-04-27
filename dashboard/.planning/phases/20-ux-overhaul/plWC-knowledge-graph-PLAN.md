---
phase: 20
plan: plWC
wave: 3
name: Knowledge graph force-directed layout + link enrichment
---

# plWC — Knowledge Graph Force-Directed Layout

## Context
The memory knowledge graph has 228 nodes but only 11 links (all from phase 14 summary files).
Dagre LR layout makes it a useless horizontal line. The layout-dagre.ts was partially updated
to cluster by kind but needs more work. The graph state generator needs to produce meaningful
links between agents and their phases.

## Task

<task>
<name>Graph layout and link enrichment</name>

<files>
components/memory/graph/layout-dagre.ts
lib/cae-graph-state.ts
components/memory/graph/graph-canvas.tsx
</files>

<action>
1. In layout-dagre.ts: Replace dagre LR layout with a clustered grid approach:
   - Group nodes by kind: phases, agents, notes, PRDs
   - Position each cluster in a different quadrant:
     * agents: top-left (centered at -400, -300)
     * phases: right side (centered at 400, 0) — arranged in a grid since there are ~180
     * notes: bottom-left (centered at -400, 300)
     * PRDs: bottom-right (centered at 400, 400)
   - Within each cluster, arrange nodes in a grid with 200px horizontal, 80px vertical spacing
   - Nodes with links to other clusters get positioned on the EDGE of their cluster (closer to the linked cluster)
   - Keep the function signature: applyDagreLayout(nodes, links) => PositionedNode[]

2. In cae-graph-state.ts: Find the function that generates GraphPayload (probably `regenerateGraph` or similar).
   Add link generation:
   a. Agent → Phase links: For each agent node, find all phase nodes whose path contains that agent's
      persona name (e.g., "forge", "sentinel", "scout"). Create a link with relation="works_on".
   b. Same-group phase links: Phases in the same phase group (e.g., all "04-build-home-rewrite/*")
      should link to each other. Extract the phase group from the path (the directory containing the file).
      Create links between the first file in each group and all others in that group (star topology, not full mesh).
   c. Notes → Phase links: Notes in KNOWLEDGE/ folder link to phases they reference (if the note filename
      appears in any phase file's content — but this is expensive so skip for now. Instead link all KNOWLEDGE
      notes to the AGENTS.md node if it exists).

3. In graph-canvas.tsx: Increase node size from 180px to 200px. Make agent nodes slightly larger (220px)
   with bold text. Add a subtle glow effect to nodes that have many links (>5 connections).
</action>

<verify>
1. Navigate to /memory?view=graph — graph should show 4 distinct clusters
2. Agents cluster should have lines connecting to phase nodes
3. Phase clusters should have internal connections within each group
4. Total links should be 100+ (not 11)
5. Graph should be navigable with ReactFlow zoom/pan
</verify>
</task>
