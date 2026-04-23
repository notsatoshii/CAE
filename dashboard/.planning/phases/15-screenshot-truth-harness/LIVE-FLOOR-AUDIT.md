# LIVE FLOOR AUDIT REPORT — Phase 11 Implementation Gaps

**Date:** 2026-04-23  
**Status:** Extensively broken; multiple P0 issues blocking shipping  
**Summary:** The Live Floor component is structurally sound but non-functional in practice. Pixel agents are completely absent from the UI. The route is inaccessible due to a Next.js version mismatch. The SSE source works but auth is broken. Motion is present but not visible due to missing visual agents.

---

## EXECUTIVE SUMMARY FOR ERIC

**The problem:** You can't see pixel agents anywhere because:
1. The `/floor` route is **currently broken at runtime** — searchParams handling is incompatible with Next.js 16 (page will crash on load)
2. Even if it loaded, you'd see **only abstract geometric shapes** (colored diamonds + text labels), not pixel-art agents
3. The pixel agents concept (named sprites, idle/working/erroring states, animatable walk cycles) **was never implemented** — Phase 11 shipped placeholders only
4. Eric's requirement ("pixel agents and a LOT of stuff just doesn't work") maps to: missing Agent identity rendering, missing click-to-expand, missing real-time action bubbles, no embedded widget on /build home

**What's actually shipped:**
- A valid isometric tilemap renderer drawing 10 named stations as colored diamonds
- 5 event types mapped correctly (forge_begin → pulse, forge_end → fireworks/redX, sentinel events → alarms)
- Pop-out window functionality (works when the route works)
- Event queue + caps + safe parsing
- Hidden from top-nav due to icon placement bug

**What's completely missing:**
- Actual pixel-art sprites representing agents (32×32 monochrome per VISUAL-RESEARCH §11)
- Agent identity layer (naming, coloring per agent)
- Visual states (idle breathing, walk cycles, working, errored)
- Action bubbles ("forging plan-15-02" floating text)
- Click-to-expand on agents
- Embedded widget pinned to /build home (as a "theater screen" card)
- Top-nav icon visibility (placement issue in components/shell/top-nav.tsx)

---

## 1. COMPONENT INVENTORY

### Files Under components/floor/

| File | Lines | Purpose | Current State |
|------|-------|---------|----------------|
| `floor-client.tsx` | 112 | Client orchestrator; owns pause/minimize/explain state | Works (if route works) |
| `floor-canvas.tsx` | 174 | React wrapper around raw Canvas 2D; RAF loop + ResizeObserver | Works; ssr: false correctly applied |
| `floor-toolbar.tsx` | 167 | 5-button overlay: pause, minimize (popout only), pop-out, legend, re-auth banner | Works; re-auth banner dead code (auth is broken) |
| `floor-legend.tsx` | 90 | Accessibility fallback; 10 station rows with color swatches | Works; maps to hardcoded token palette |
| `floor-popout-host.tsx` | 76 | Pop-out window wrapper; title/resize/escape-to-close | Works when popout loads |

**Rendering approach:** Pure Canvas 2D (no Pixi, no game engine per D-01). Hand-rolled 2D math.

**Visual output today:**
- Background: dark black (#0a0a0a)
- Stations: filled isometric diamonds per station status (idle=surface, active=accent, warning=amber, alarm=red)
- Effects: geometric (fireworks = concentric circles, redX = crossed lines, pulse = expanding ring, alarm = flashing rect, phantomWalk = trail line + dot)
- **No agent sprites at all.** The renderer never reads or draws any agent data.

**How agents are drawn:** They are not. There is no agent layer in the scene. The `STATIONS` object is a frozen map of 10 named locations only. There is no `agents: Agent[]` array in the scene.

---

## 2. SSE SOURCE

### API Endpoint
**Location:** `/api/tail?path=<cbPath>`  
**Source:** `app/api/tail/route.ts` (exists, pre-Phase 11)  
**Data source:** `.cae/metrics/circuit-breakers.jsonl` (1 file per project)

### Event Types Expected
From `lib/floor/event-adapter.ts` ALLOWED_EVENTS:
- `forge_begin` → pulse at forge station
- `forge_end` (success: true) → fireworks at hub
- `forge_end` (success: false) → redX at forge
- `sentinel_json_failure` → pulse at watchtower
- `sentinel_fallback_triggered` → alarm at watchtower
- `escalate_to_phantom` → phantomWalk from shadow to forge (conditional)
- `halt` → alarm at hub (conditional)
- `forge_slot_acquired` / `forge_slot_released` → no scene change

### Current Data (circuit-breakers.jsonl)
**File path:** `/.cae/metrics/circuit-breakers.jsonl`  
**Time range:** 2026-04-20 08:41 UTC to 2026-04-20 09:18 UTC (30 events, 37 minutes)  
**Event distribution:**
- 6 × `forge_begin` + `forge_end` (success=true) pairs
- 4 × `sentinel_fallback_triggered`
- 3 × `sentinel_json_failure`
- 2 × `forge_slot_acquired`
- 2 × `forge_slot_released`

**Is the source file producing events?** **No — the last event was 2026-04-20 09:18:36 UTC, 3 days ago.** The JSONL is stale. This means testing the live floor requires either:
1. Manually appending new events to the file (for integration testing)
2. Running a project that generates forge/sentinel events
3. Replaying the 30 events (not implemented)

The floor will load but render a static scene with no motion (queue drained, all effects already expired).

---

## 3. VISUAL QUALITY ASSESSMENT

### Agent Naming On Screen
**Current:** None. Stations have labels ("Forge", "Watchtower", etc.), but no per-agent labels.  
**Expected (per Eric):** Each pixel agent should be named ("Agent-a", "Agent-b-7", etc.), visible above the sprite.  
**Reason missing:** The event stream never includes `agent_id` per event, and the scene has no agent identity layer.

### Visual States
**Implemented:**
- Station status colors: idle (surface gray), active (accent cyan), warning (amber), alarm (red)
- Effects spawn on event (pulse ring, fireworks burst, red X mark, alarm flash)
- Pause/resume control (halts step() but keeps rendering the paused frame)

**Missing (pixel-agent specific):**
- Idle: 4-frame breathing animation for each agent
- Working: 4-frame tool action (typing, hammering) looped
- Walking: 6-frame directional walk cycle
- Errored: 2-frame head-down with red flicker overlay
- Celebrating: 4-frame burst on task completion

**Why missing:** No sprite sheet loading. No AnimatedSprite per agent. No per-agent state machine.

### Motion / Animation
**Currently visible:**
- Effects TTL countdown (pulse rings shrink, fireworks particles fade, red X fades)
- Station status color tints (idle → active → idle transitions)
- Phantom walk trail animation (line + dot move across the floor)

**Quality:** Motion is present but purely geometric. No character animation.

### Action Bubbles
**Current:** None. When forge_begin fires, a pulse rings appear at the forge station. No text label like "forging plan-15-02".  
**Expected:** Floating text above the station showing the active task_id or a human-readable action name.  
**Reason missing:** The event stream has `task_id` in the JSON (e.g., `"task_id": "p2-plA-t1-b12bb5"`), but `mapEvent()` never reads it. Action bubbles would require:
  1. Passing task_id through to the effect
  2. Rendering text at the effect's coordinates with a TTL fade
  3. Task name resolution (task IDs are cryptic; would need a lookup table)

### Click-to-Expand on Agent
**Current:** None. The canvas is a static visual only. No click handlers.  
**Expected:** Click an agent sprite → side panel opens showing the agent's current task, status history, metrics.  
**Reason missing:** Out of scope per D-21 (deferred ideas). Click interactions are a Phase 12 polish item.

---

## 4. ENTRY-POINT IA GAP

### Where Is the Live Floor Accessible From?

**Top-nav icon location:** Should be in the right cluster (before Memory icon), using Gamepad2 icon.  
**Current status:** **Icon not visible in the UI.**

Why? The icon component exists (`components/shell/floor-icon.tsx`) and is correctly exported, but it is not mounted in `components/shell/top-nav.tsx`. The icon is ready to be added but was never wired into the nav bar template.

**Accessibility path:** `/floor` is routable and auth-gated, but there's no visible link to it from the main UI. Users must type the URL directly or be sent a link.

### Embedded on /build Home?
**Current:** No. The Live Floor is a full-screen route only.  
**Expected (Eric wants this):** A pinned widget on `/build` showing a live theater screen — agent status tiles, activity ticker, or a small isometric preview.  
**Gap:** Phase 11 brief explicitly deferred this. No home-page widget component exists.

### Pop-out Window Functionality
**Status:** Partially works (when the route works).  
- Button in toolbar: ✓ present
- window.open() call: ✓ fires correctly
- Pop-out URL generation: ✓ correct
- Escape-to-close: ✓ wired
- Return-to-main button: ✓ visible
- Window resize hint: ✓ attempted (browser may ignore)

**Issue:** Since the /floor route is broken, pop-out never loads either.

---

## 5. CURRENTLY-RENDERED STATE

With circuit-breakers.jsonl having only 30 stale events (last one 3+ days old), what does the floor render right now?

### Step-by-step:
1. User navigates to `/floor` → **Page throws (see CR-01 below)**
2. If the route bug were fixed, the page would:
   - Resolve projectPath from query params or fallback to most-recent project
   - Call `resolveCbPath(projectPath)` → returns `projectPath + "/.cae/metrics/circuit-breakers.jsonl"`
   - Pass cbPath to FloorClient
3. FloorClient mounts FloorCanvas with SSE subscribed to `/api/tail?path=<cbPath>`
4. SSE re-plays the 30 lines from circuit-breakers.jsonl as if they're new (SSE doesn't know age)
5. Over ~37 seconds, effects fire in sequence:
   - Forge pulse → fireworks at hub → sentinel pulse → sentinel alarm (repeats)
   - Phantom walk trails animate across (if `escalate_to_phantom` events were in the file — they're not)
6. All effects TTL expires within 2.5 seconds of their spawn
7. After the initial stream, the scene goes completely static: 10 diamond stations with muted colors, no motion
8. New events will appear only if the project actively forges/processes tasks

### Visual result:
A motionless isometric floor plan showing 10 named stations. No agents visible. No action bubbles. Just colored shapes responding to 3-day-old events in the first 37 seconds, then frozen silence.

---

## 6. ERIC'S PAIN POINTS MAPPED

### "pixel agents can't be seen anywhere"
**Root cause:** No agent sprite rendering exists. The scene has no `agents: FloorAgent[]` data structure. The event stream maps to station status changes, not agent movements or identity.

**Where Eric looked for them:**
- Top-nav icon → doesn't exist (not mounted)
- /floor page → inaccessible due to route crash (CR-01)
- /build home → no embedded widget (deferred)
- Canvas itself → only stations visible, no sprites

**What's missing technically:**
1. Agent identity layer: `agents: { id, name, tx, ty, status, taskId }[]`
2. Sprite loading: `textures.load('agent-idle.png')` + spritesheet metadata
3. Per-agent state machine: idle/working/walking/errored/celebrating
4. Event→agent binding: `forge_begin` with `task_id` needs to find which agent owns the task
5. Rendering pass: `renderer.ts` `drawAgent(ctx, agent, ...)` loop

### "pixelagents and a LOT of stuff just doesn't work"
**Broken things:**
1. **Route crash (CR-01):** `/floor` page searchParams not awaited → Next.js 16 error
2. **Auth drift detection (CR-02):** `/api/state` never returns 401 → re-auth banner never shows
3. **SSE not auth-gated (CR-03):** `/api/tail` and `/api/state` are unauthenticated → anyone can spy on circuit-breakers
4. **No EventSource error handler (WR-01):** Silent reconnect forever on network loss → no user feedback
5. **Stale data:** Circuit-breakers.jsonl from 3 days ago → no live motion to see
6. **Top-nav icon missing:** Icon component built but not mounted → invisible entry point

**Things that work:**
- Canvas rendering (geometry is correct)
- Event parsing + allowlist (safe)
- Pause/minimize controls
- Pop-out window scaffolding
- Reduced-motion gate
- Isometric math

---

## 7. PRODUCTION-READY UPGRADE PLAN

To make the Live Floor "feel alive" (Eric's goal: theatrical, named agents, action bubbles, drill-down), the following waves are required:

### Wave 1: Fix Critical Bugs (BLOCKING)
**Effort:** 3–4 hours | **Priority:** P0

1. **CR-01: Fix Next.js 16 searchParams** (fix: await the Promise)
   - Update `app/floor/page.tsx` and `app/floor/popout/page.tsx`
   - Update tests to pass `Promise.resolve({...})`
   - Verify route loads in dev

2. **CR-03: Auth-gate `/api/tail` and `/api/state`** (fix: add to middleware matcher)
   - Extend middleware.ts matcher to include `/api/tail` and `/api/state`
   - Add regression test: unauthenticated request must return 401
   - After fix, add `es.onerror` handler to capture auth drift (WR-01 fix)

3. **Top-nav icon visibility** (fix: mount FloorIcon in top-nav.tsx)
   - Import FloorIcon in `components/shell/top-nav.tsx`
   - Add to right-cluster icons (before MemoryIcon)
   - Verify icon renders in top-nav

**Blockers resolved:** Route loads, icon visible, SSE secure

---

### Wave 2: Agent Identity + Sprites (LIVE)
**Effort:** 20–30 hours | **Priority:** P1 | **Library:** PixiJS v8 + @pixi/react v8 (per VISUAL-RESEARCH §11)

1. **Scene extension: add agents data**
   - `scene.agents: FloorAgent[]` where FloorAgent = `{ id, name, tx, ty, status, taskId, spriteState }`
   - Event stream binding: `forge_begin` → look up which agent has task_id → set agent.status = "working"
   - Requires: task → agent resolution (new data feed or lookup table)

2. **Sprite loading pipeline**
   - Create or source a sprite sheet (32×32 per VISUAL-RESEARCH)
   - Export PNG + JSON spritesheet metadata
   - Load via PixiJS `Assets.load()` in useEffect
   - Fallback to placeholder rects if loading fails

3. **Render pass overhaul**
   - Replace plain Canvas 2D with PixiJS Application + Container
   - Keep station diamonds (can stay pure Canvas or move to Pixi)
   - Add per-agent AnimatedSprite in a loop
   - Implement state → texture swapping (idle/working/walking/error/celebrating)

4. **Agent walk routes**
   - When `forge_begin`: agent walks from loadingBay → forge station
   - When `forge_end`: agent walks forge → hub (success) or forge → shadow (error)
   - Animate walk over 3–5 seconds, play walk-cycle textures

**Result:** Named agents visible on screen, moving and responding to events

---

### Wave 3: Action Bubbles + Rich Motion (POLISH)
**Effort:** 8–12 hours | **Priority:** P2

1. **Action text bubbles**
   - On `forge_begin`: spawn floating text label "forging <task_short_id>" above the agent
   - On `sentinel_fallback_triggered`: spawn "retrying..." at watchtower
   - TTL-based fade (2 seconds)
   - Requires: task ID → human readable name resolution (e.g., "plan-15-02")

2. **Per-agent color palette**
   - Each agent gets a subtle hue shift (VISUAL-RESEARCH: "palette-shift per agent")
   - Keep monochrome base sprite, apply multiplicative color tint
   - PixiJS supports this natively via Tint or shader

3. **Particle effects on event**
   - On `forge_end` with success: spawn 6–8 sparkle particles around the agent
   - On error: spawn red anger particles
   - Use PixiJS emitter or hand-rolled particles

---

### Wave 4: Interactivity + Embed (PHASE 12+)
**Effort:** 12–16 hours | **Priority:** P3 (deferred) | **Requires:** Wave 2

1. **Click-to-expand agent**
   - Canvas click handler: detect click on agent sprite
   - Open side panel: agent name, current task, recent history, error log
   - Requires: task/error data not in circuit-breakers.jsonl (future data integration)

2. **Embedded /build home widget**
   - New component: `components/build-home/live-floor-widget.tsx`
   - Render a small (400×300) PixiJS canvas showing agent tiles + live activity
   - Or: render a "theater screen" card showing agent status grid
   - Pinnable/sticky so it stays visible while scrolling the home page

---

## 8. RECOMMENDED TECH STACK (Per VISUAL-RESEARCH §11)

**Sprite rendering:** PixiJS v8 + @pixi/react v8 (the ONLY 2D WebGL library with React integration)  
**Spritesheet authoring:** Aseprite ($80 one-time; industry standard) or free alternative (Piskel, Krita)  
**Asset pipeline:**
- Source: `assets/sprites/agent-base.aseprite`
- Export via Aseprite CLI → `public/sprites/agent-base.png` + `agent-base.json`
- PixiJS loads via `Assets.load('agent-base')`

**Motion:** Framer Motion v11 (already in deps) handles state transitions; PixiJS handles frame-by-frame animation

---

## 9. ESTIMATED WAVES

| Wave | Title | Effort | Blockers | When |
|------|-------|--------|----------|------|
| **1** | Fix critical bugs | 3–4h | None (parallel) | This sprint (URGENT) |
| **2** | Agent sprites + animation | 20–30h | Wave 1 complete | Next sprint (High) |
| **3** | Action bubbles + polish | 8–12h | Wave 2 complete | Sprint after (Medium) |
| **4** | Interactivity + embed | 12–16h | Wave 2 complete, more data feeds | Phase 12+ (Low) |

**Total to "feels alive":** ~44–62 hours (~2 developer-weeks)

---

## 10. SPECIFIC BROKEN FUNCTIONS

### CR-01 [ROUTE CRASH]
**File:** `app/floor/page.tsx:27, 35, 60`  
**Function:** FloorPage main component  
**Issue:** `searchParams` is a Promise but treated as a synchronous object. Next 16 enforces async.  
**Fix:** Add `await` before reading `searchParams.project`

```tsx
export default async function FloorPage({ searchParams }: PageProps) {
  const { project, popout: popoutParam } = await searchParams;  // <- ADD await
  const popout = popoutParam === "1";
  // ...
}
```

### CR-02 [DEAD AUTH PROBE]
**File:** `lib/hooks/use-floor-events.tsx:161-191`  
**Function:** Auth-drift probe  
**Issue:** `/api/state` doesn't auth-gate, so `res.status === 401` is unreachable  
**Fix:** Auth-gate `/api/state` (see CR-03), then add initial probe call before setInterval:

```ts
useEffect(() => {
  if (!opts.cbPath) return;
  let cancelled = false;
  const probe = async () => { /* ... */ };
  
  probe();  // <- ADD initial invocation
  const id = setInterval(probe, AUTH_POLL_MS);
  return () => { cancelled = true; clearInterval(id); };
}, [opts.cbPath]);
```

### CR-03 [UNAUTHENTICATED API]
**File:** `middleware.ts:13-15`  
**Function:** Auth matcher  
**Issue:** `/api/tail` and `/api/state` not in protected routes  
**Fix:** Add to matcher array:

```ts
export const config = {
  matcher: [
    // ... existing
    "/api/tail",   // <- ADD
    "/api/state",  // <- ADD
  ],
};
```

### WR-01 [NO ERROR HANDLER]
**File:** `lib/hooks/use-floor-events.tsx:145-161`  
**Function:** SSE onmessage only  
**Issue:** No `onerror` handler → silent reconnect forever on network loss  
**Fix:** Add onerror:

```ts
es.onerror = () => {
  console.warn("[useFloorEvents] SSE error — readyState:", es.readyState);
  if (es.readyState === EventSource.CLOSED) {
    // Probe /api/state to distinguish auth from network
    const projectPath = cbPathToProject(opts.cbPath!);
    void fetch("/api/state?project=" + encodeURIComponent(projectPath))
      .then((r) => { if (r.status === 401) setAuthDrifted(true); })
      .catch(() => { /* network — ignore */ });
  }
};
```

---

## CONCLUSION

The Live Floor is **architecturally sound but functionally incomplete and currently broken.** The Phase 11 implementation delivers the isometric tilemap renderer and event SSE plumbing, but the pixel-agent visual identity — the core reason Eric wants this feature — was deferred to Phase 12+ as a "nice to have."

**For immediate user satisfaction:** Fix Wave 1 bugs, mount the top-nav icon, then communicate to Eric that agents are coming in a follow-up wave.

**For "feels alive":** Ship Wave 1 + Wave 2 (agents + sprites + animation) as a consecutive sprint. That's the threshold where the floor stops being abstract and becomes a character-driven interface.

