---
phase: 20
plan: plWB
wave: 2
name: Pixel agents shared workspace + idle animations
---

# plWB — Pixel Agents Shared Workspace

## Context
The Live Floor currently has 10 stations scattered across a 16x16 grid — each agent in its own
isolated room. This was already partially fixed (stations clustered to center) but the renderer
still shows them spread out with separate room labels. The floor should show ONE shared open-plan
workspace with all agents at adjacent desks. When no agents are actively working, show idle
pixel sprites at their stations.

## Task

<task>
<name>Shared workspace rendering + idle sprites</name>

<files>
lib/floor/renderer.ts
lib/floor/scene.ts
lib/floor/state.ts
lib/floor/pixel-agent-state.ts
components/floor/floor-canvas.tsx
</files>

<action>
1. In renderer.ts: The station labels currently render as individual room names
   ("The conductor's desk", "The builder's forge", etc). Change to render ONE room label
   "THE WORKSHOP" centered at (8, 5) in large text, with smaller agent-name labels at each desk.
   Remove the individual room title rendering.

2. In state.ts: Add idle sprite generation. When a station has no active agent (no forge_begin
   without matching forge_end), spawn a "resting" pixel agent at that station with state="idle".
   The step() function should create idle agents for all stations that don't have an active task.
   Idle agents face "down" and use the "idle" animation state.

3. In scene.ts: Verify stations are clustered (they should be from our prior fix). The hub at (8,8),
   all others within 2 tiles. If not already, re-apply the clustering.

4. In the renderer's station label section: Draw desk furniture (a small dark rectangle representing
   a desk) at each station position. Draw the idle/active agent sprite ON TOP of the desk area.
   
5. Remove the "waiting for first heartbeat" status text. Replace with "Workshop idle" when no agents
   are actively building.
</action>

<verify>
1. Navigate to /floor — should see a clustered workspace with one "WORKSHOP" label
2. All 9 agent positions should show idle pixel sprites at desks
3. No separate room names — just small agent name labels
4. Status should say "Workshop idle" not "waiting for first heartbeat"
</verify>
</task>
