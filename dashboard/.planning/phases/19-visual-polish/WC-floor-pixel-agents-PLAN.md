---
phase: 19
plan: WC-floor-pixel-agents
wave: 3
name: Make pixel agents visible on Live Floor even when idle
---

# WC — Live Floor pixel agents always visible

## Context

The Live Floor canvas renders the isometric grid and room labels correctly (fixed in this session — canvas dimensions were wrong). However, pixel agents only appear when SSE events fire (forge_begin/forge_end). When the system is idle, the floor looks empty — no characters at their stations.

Reference: The floor has 9 rooms — conductor's desk, builder's forge, checker's watchtower, researcher's overlook, writer's library, debugger's shadow realm, guard's armory, designer's drafting table, announcer's pulpit.

## Task

<task>
<name>Show idle pixel agents at their home stations</name>

<files>
lib/floor/scene.ts
lib/floor/renderer.ts
lib/floor/pixel-agent-state.ts
components/floor/floor-canvas.tsx
</files>

<action>
1. In the scene initialization (createScene or similar), place one pixel agent sprite at each of the 9 room positions in an "idle" state.
2. The agents should be visible even without any SSE events — they sit at their home stations.
3. When a forge_begin event fires, the corresponding agent should animate (e.g., change sprite state to "working"). When forge_end fires, return to idle.
4. Each agent should have a distinct appearance matching their role (different color sprites or overlays).
5. The pixel agent registry at `getPixelAgentRegistry()` in renderer.ts likely already defines agents — ensure they're rendered on the canvas.
</action>

<verify>
1. `pnpm vitest run` — all green.
2. Visit /floor — all 9 pixel agents visible at their stations even when idle.
3. The floor should look alive and populated, not empty.
</verify>
</task>
