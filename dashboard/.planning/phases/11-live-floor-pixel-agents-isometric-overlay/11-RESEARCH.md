# Phase 11: Live Floor (pixel-agents isometric overlay) — Research

**Researched:** 2026-04-22
**Domain:** Canvas 2D rendering in Next.js — isometric scene driven by SSE events
**Confidence:** HIGH stack + wiring; MEDIUM sprites; LOW pop-out DX

## Summary

Phase 11 wants an isometric 2.5D "CAE HQ" scene reachable from a top-bar 🎮 icon, optionally popped out. The brief says "fork pablodelucca/pixel-agents (MIT)". Research shows this is the wrong frame: pixel-agents is (a) a VS Code extension whose webview is tangled into the extension's postMessage/terminal management, and (b) **top-down, not isometric**. Asset reuse is also limited — sprites come from JIK-A-4 Metro City, a top-down pack that doesn't survive a perspective change.

Correct call: **re-implement, inspired by pixel-agents**. Build a small isometric renderer on raw Canvas 2D (no game engine), drive it from the existing `/api/tail` SSE on `.cae/metrics/circuit-breakers.jsonl`, ship at `/floor`, and let 🎮 navigate there (or pop it out via `window.open`). State in one React hook — no Zustand, no Pixi, no Phaser. ~10 new files + assets dir.

**Primary recommendation:** raw Canvas 2D, diamond isometric math, vanilla `requestAnimationFrame`, SSE opened by BOTH parent and child (no cross-window plumbing). Take the *idea* from pixel-agents (FSM, z-sort, Matrix spawn), not its code.

## User Constraints (from CONTEXT.md)

No CONTEXT.md exists. Constraints below lifted from phase brief + UI-SPEC §11/§S4.4 + Phase 3-10 hard locks.

### Locked Decisions
- Isometric 2.5D (not top-down) — §S4.4
- Fork pixel-agents ONLY if MIT **and** portable — both must hold
- Event source = existing SSE (no new bus)
- `prefers-reduced-motion` respected
- NO iframe to upstream — port native
- Overlay / separate `/floor` route — not a core surface
- Dark theme + base-ui + Tailwind v4 (locked Phases 3-10)
- Ships AFTER Phases 1-10 (polish, not core)

### Claude's Discretion
- Renderer (Canvas 2D vs Pixi vs Phaser) — justify bundle cost
- Asset approach
- State mgmt
- Pop-out mechanism
- Scene composition

### Deferred Ideas (OUT OF SCOPE)
- Electron / native popup
- Visual regression (defer Phase 13)
- Rich click interactions — scene is ambient (§11 "never blocks work")
- Multi-project HQs
- Sound

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| P11-01 | Top-bar 🎮 opens Live Floor | Mirror `components/shell/memory-icon.tsx` |
| P11-02 | Isometric scene, 10 stations | clintbellanger diamond math |
| P11-03 | SSE-driven animations | Reuse `/api/tail` + circuit-breakers.jsonl |
| P11-04 | Pop-out | `window.open('/floor?popout=1')` + child-SSE |
| P11-05 | `prefers-reduced-motion` | Mirror `useScreenShake` matchMedia pattern |
| P11-06 | Dark theme, base-ui | Shell/controls only; canvas is pixels |

## Project Constraints (from AGENTS.md)

- base-ui does NOT support `asChild` — use `Link` + className
- Circuit-breaker readers must time-window filter — unbounded is a known bug (Phase 2)
- SSE paths must be in `ALLOWED_ROOTS` — `.cae/metrics` already covered [VERIFIED: app/api/tail/route.ts lines 8-13]

## Standard Stack

### Core
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| **No new runtime deps** | — | Canvas + game loop | `requestAnimationFrame` + Canvas 2D are native. Zero bundle cost. [VERIFIED: MDN] |
| React 19.2 | installed | Shell + hooks | [VERIFIED: package.json:24] |
| Next.js 16.2 | installed | `/floor/page.tsx` | [VERIFIED: package.json:22] |
| lucide-react 0.510 | installed | `Gamepad2` icon | [VERIFIED: package.json:21] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| raw Canvas 2D | Pixi.js 8.18.1 (MIT, 71 MB unpacked) | +~450 KB gzipped for one overlay. SSR-unsafe; needs dynamic import. [CITED: pixijs.com/blog/pixi-v8-launches] |
| raw Canvas 2D | @pixi/react 8.0.5 | React 19 OK but Next.js 15 bugs in 2024 (issue #551). Extra peer risk. [CITED: github.com/pixijs/pixi-react/issues/551] |
| raw Canvas 2D | Phaser 3000.1.17 (MIT) | 1.2 MB — overkill, don't need physics/audio/scenes |
| raw Canvas 2D | Kaboom / Excalibur | Not widely used in Next.js dashboards; integration risk |
| raw Canvas 2D | Three.js WebGL | Massive overkill for flat iso |

**Decision:** raw Canvas 2D. Iso math ~30 lines. Game loop ~40 lines. Re-implementing beats paying 450 KB for a feature users dismiss 95% of the time.

**Version verification (npm registry, 2026-04-22):** pixi.js 8.18.1 MIT, @pixi/react 8.0.5, kaboom 3000.1.17 MIT, excalibur 0.32.0 BSD-2. [VERIFIED: npm view]

## Architecture Patterns

### Recommended Project Structure

```
app/floor/
├── page.tsx                 # server shell, handles ?popout=1
└── floor-client.tsx         # "use client" — canvas + controls + SSE

components/floor/
├── floor-canvas.tsx         # canvas ref + RAF + renderer + event queue
├── floor-controls.tsx       # pop-out, minimize, pause
└── floor-legend.tsx         # explain-mode overlay (a11y fallback)

lib/floor/
├── iso.ts                   # map <-> screen coord (diamond math)
├── scene.ts                 # static scene: 10 stations + tile map
├── renderer.ts              # draw tiles + z-sort entities + effects
├── state.ts                 # character FSM
└── event-adapter.ts         # SSE frame → animation

components/shell/floor-icon.tsx    # new top-bar 🎮 (mirrors memory-icon)
public/floor/{tiles,characters,furniture,effects}/  # sprite assets
```

### Pattern 1: Diamond Isometric Projection

```typescript
// lib/floor/iso.ts — [CITED: clintbellanger.net/articles/isometric_math]
const TILE_W = 64, TILE_H = 32; // 2:1 diamond

export function mapToScreen(tx: number, ty: number, cx = 0, cy = 0) {
  return { x: (tx - ty) * (TILE_W / 2) + cx, y: (tx + ty) * (TILE_H / 2) + cy };
}
export function screenToMap(sx: number, sy: number, cx = 0, cy = 0) {
  const x = sx - cx, y = sy - cy;
  return { tx: (y / TILE_H) + (x / TILE_W), ty: (y / TILE_H) - (x / TILE_W) };
}
```

### Pattern 2: React + Canvas Game Loop

Scene lives in `useRef` — NEVER `useState` for per-frame updates. One RAF loop; cancel on unmount.

```typescript
// components/floor/floor-canvas.tsx — [CITED: css-tricks RAF + React hooks]
const canvasRef = useRef<HTMLCanvasElement>(null);
const sceneRef = useRef(createScene());
const queueRef = useRef<FloorEvent[]>([]);
const rafRef = useRef<number | null>(null);
const reduced = usePrefersReducedMotion();

useEffect(() => {
  const ctx = canvasRef.current!.getContext("2d")!;
  let lastTs = performance.now();
  const tick = (ts: number) => {
    const dt = Math.min((ts - lastTs) / 1000, 0.1);
    lastTs = ts;
    drainEvents(queueRef.current, sceneRef.current, { reduced });
    step(sceneRef.current, dt);
    render(ctx, sceneRef.current);
    rafRef.current = requestAnimationFrame(tick);
  };
  rafRef.current = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafRef.current!);
}, [reduced]);

useEffect(() => {
  const es = new EventSource(`/api/tail?path=${encodeURIComponent(cbPath)}`);
  es.onmessage = (e) => queueRef.current.push(parseEvent(e.data));
  return () => es.close();
}, []);
```

### Pattern 3: Child-SSE for Pop-Out (not postMessage)

Child window opens its own EventSource. Parent forwards nothing. Session cookie inherited via same-origin.

```typescript
const popOut = () => window.open("/floor?popout=1", "cae-live-floor", "width=960,height=720");
```

Simpler than postMessage/BroadcastChannel. Two SSE subscribers to the same JSONL is cheap. User manually drags to their second monitor (Chromium often ignores `screenX/screenY` cross-display). [CITED: MDN window.open, dev.to multi-window JS]

### Pattern 4: Reduced-Motion Gate

Mirror `lib/hooks/use-screen-shake.ts` (lines 7-10). Check `matchMedia` before each animation spawn; fall back to status tint (no frame cycling).

```typescript
if (prefersReducedMotion()) {
  scene.stations[id].status = "active";  // tint only
  return;
}
scene.effects.push({ kind: "fireworks", at: hubPos, ttl: 1.2 });
```

### Anti-Patterns

- **React state for per-frame updates.** 60 fps × setState = re-render death. Use `useRef`.
- **Re-rendering canvas from JSX.** One `<canvas>`, redrawn imperatively. Nothing below it in the tree.
- **Synchronous sprite load in render.** Use `Image()` + `onload`; show tile-only until resolved. Dynamic-import floor-canvas with `{ ssr: false }`.
- **Forking pixel-agents webview.** It depends on VS Code extension postMessage + terminal spawn — not extractable. Cherry-pick *ideas* only. [VERIFIED: upstream CLAUDE.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSE route | new `/api/floor-events` | **existing `/api/tail?path=…`** | Already in ALLOWED_ROOTS, battle-tested [VERIFIED] |
| Reduced-motion hook | new | **copy `useScreenShake`** | Same matchMedia idiom |
| Event types | custom | **reuse `ForgeBeginEvent` from `lib/cae-home-state.ts:300`** | Same source, same schema |
| Top-bar icon | custom style | **mirror `components/shell/memory-icon.tsx`** | Keep chrome consistent |
| Isometric math | experiment | **clintbellanger formulas** | 30-yr validated, ~8 lines |
| Pop-out sync | postMessage / BroadcastChannel | **independent child SSE** | Child inherits cookie; extra complexity buys nothing |

**Key insight:** Every sub-problem is either solved in-repo or is textbook-math short. Restraint keeps surface area tiny so a polish feature doesn't grow maintenance debt.

## Runtime State Inventory

Additive phase (new route + components + assets). Nothing to migrate.

| Category | Items | Action |
|----------|-------|--------|
| Stored data | None | — |
| Live service config | None | — |
| OS-registered state | None | — |
| Secrets/env vars | None | — |
| Build artifacts | `public/floor/` sprites ship in build output | Size budget |

## Environment Availability

| Dependency | Required By | Available | Fallback |
|------------|------------|-----------|----------|
| Node 20+ / Next 16 | build | ✓ | — |
| Canvas 2D API | renderer | ✓ (all browsers) | — |
| `EventSource` | SSE | ✓ | — |
| `window.open` w/ cookie | pop-out | ✓ (same-origin) | — |
| `matchMedia` reduced-motion | a11y | ✓ | assume false |
| Sprite assets | renderer | **✗ must source** | **Blocker — see Open Questions** |

## Common Pitfalls

1. **`@pixi/react` Next.js SSR crash.** Pixi needs browser globals at construct. Don't use @pixi/react; if forced, dynamic-import with `{ ssr: false }`. [CITED: issue #551]

2. **RAF leak on unmount.** Next dev's Strict Mode double-mounts. Store ID in `useRef`, cancel in cleanup.

3. **Re-render storm.** Scene must be `useRef`. Only coarse UI state (`paused`, `popout`, `reduced`) allowed in React state.

4. **Sprite 404s silent.** Register `onerror`; fall back to solid-color placeholder + dev console warn.

5. **Event queue unbounded.** Same class of bug AGENTS.md flags for Phase 2 `recentFailures`. Cap queue at 500; drop oldest. Cap active effects at 10.

6. **Pop-out auth drift.** `EventSource` 401s aren't exposed well. Child polls `/api/state` every 30s; banner "re-auth in main window" on 401.

## Code Examples

### Event → animation mapping

```typescript
// lib/floor/event-adapter.ts
// Event vocabulary VERIFIED against all project circuit-breakers.jsonl (2026-04-22 grep):
//   forge_begin, forge_end, forge_slot_acquired, forge_slot_released,
//   sentinel_fallback_triggered, sentinel_json_failure
// Brief asks merge/reject/phantom_escalate/halt — synthesize from present events (see Assumptions).

export function mapEvent(e: CircuitBreakerEvent) {
  switch (e.event) {
    case "forge_begin":                 return { station: "forge", effect: "pulse" };
    case "forge_end":                   return e.success
                                          ? { station: "hub",   effect: "fireworks" }  // merge proxy
                                          : { station: "forge", effect: "redX" };      // reject proxy
    case "sentinel_json_failure":       return { station: "watchtower", effect: "pulse" };
    case "sentinel_fallback_triggered": return { station: "watchtower", effect: "alarm" };
    // phantom_escalate / halt absent upstream — add cases when Phase 9 emits them
    default: return null;
  }
}
```

### Scene (static, 16×16 grid)

```typescript
export const STATIONS = {
  hub:        { tx: 8,  ty: 8,  persona: "nexus" },     // center
  forge:      { tx: 12, ty: 6,  persona: "forge" },
  watchtower: { tx: 13, ty: 2,  persona: "sentinel" },
  overlook:   { tx: 2,  ty: 2,  persona: "scout" },
  library:    { tx: 4,  ty: 12, persona: "scribe" },
  shadow:     { tx: 10, ty: 14, persona: "phantom" },
  armory:     { tx: 14, ty: 10, persona: "aegis" },
  drafting:   { tx: 6,  ty: 4,  persona: "arch" },
  pulpit:     { tx: 8,  ty: 13, persona: "herald" },
  loadingBay: { tx: 1,  ty: 8,  persona: null },
} as const;
```

## State of the Art

| Old | Current | Impact |
|-----|---------|--------|
| Pixi v7 + @inlet/react-pixi | Pixi v8 single-import + tree-shake | Smaller bundles (if using Pixi) [CITED: pixijs.com/blog/pixi-v8-launches] |
| postMessage popup bridges | BroadcastChannel (same-origin) / child-SSE | We pick child-SSE |
| CSS-only reduced-motion | Explicit `matchMedia` in canvas JS | [CITED: joshwcomeau.com/react/prefers-reduced-motion] |

**Deprecated:** `@inlet/react-pixi` → `@pixi/react`. pixel-agents-as-library — it's a VS Code extension, not a published module.

## Assumptions Log

| # | Claim | Section | Risk |
|---|-------|---------|------|
| A1 | JIK-A-4 Metro City pack is free-for-commercial with attribution appreciated | Assets | MEDIUM — itch.io listing reads permissively but full license text not fetched (WebFetch denied); if stricter, reroute to OpenGameArt CC0 |
| A2 | Child window inherits NextAuth session cookie on same origin | Pattern 3 | LOW — standard browser behavior; confirm on first run |
| A3 | `forge_end success=true` is an acceptable "merge" proxy, `false` = "reject" | Event adapter | MEDIUM — JSONL has no explicit merge/reject events; revisit when Phase 9 ships richer vocab |
| A4 | `phantom_escalate` / `halt` not currently in circuit-breakers.jsonl | Event adapter | LOW — confirmed by grep 2026-04-22; UI-SPEC desires them but upstream emitter missing |
| A5 | Raw Canvas 2D handles ~30 sprites + ~5 effects at 60 fps | Architecture | LOW — well below established benchmarks |
| A6 | User-gesture `window.open` isn't popup-blocked | Pattern 3 | LOW — gesture requirement satisfied |
| A7 | SSR pattern (server shell + client canvas) works here | Architecture | LOW — identical to `/memory` and `/metrics` already shipped |

## Open Questions

1. **Sprites: source or commission?** JIK-A-4 is top-down; no single free pack covers 9 themed rooms. **Recommend:** Wave 0 ships placeholder colored tiles + text labels. Art is separate polish pass. Don't block Phase 11 on art.

2. **Which project's circuit-breakers?** Each project has its own JSONL. **Recommend:** tail the currently-selected project (consistent with dashboard); pop-out pins to the project it opened from.

3. **🎮 = overlay or separate route?** **Recommend:** always navigate to `/floor`. Full-bleed dark-bg route satisfies "overlay" metaphor without modal plumbing.

4. **Loading bay visualization.** No per-task stream exists. **v1:** static crate pile + badge = `queue_depth` from `/api/state`; animate-on-change only if new delegation in last 5s. Wait for Phase 6 queue SSE for richer behavior.

5. **Reduced-motion = pause scene or skip effects?** **Recommend:** skip ephemeral (fireworks/walks/shake), keep passive station tint. A frozen scene conveys less than a static one.

## Validation Architecture

`workflow.nyquist_validation` absent in config → treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 1.6.1 + @testing-library/react 16.3.2 + jsdom 24.1.3 [VERIFIED: package.json devDeps] |
| Config | `vitest.config.ts` (exists) [VERIFIED] |
| Quick run | `npm run test -- lib/floor components/floor` |
| Full suite | `npm run test` |

### Phase Requirements → Test Map
| Req | Behavior | Type | Command | Exists |
|-----|----------|------|---------|--------|
| P11-01 | 🎮 Link → `/floor` | unit | `npm run test -- components/shell/floor-icon` | Wave 0 |
| P11-02 | `mapToScreen`/`screenToMap` inverse | unit | `npm run test -- lib/floor/iso` | Wave 0 |
| P11-03 | `mapEvent(forge_end,true)` → fireworks@hub | unit | `npm run test -- lib/floor/event-adapter` | Wave 0 |
| P11-03 | unknown events → null | unit | (same) | Wave 0 |
| P11-04 | `?popout=1` hides chrome | RTL integration | `npm run test -- app/floor` | Wave 0 |
| P11-05 | reduced-motion → effects list empty | unit | `npm run test -- lib/floor/event-adapter` | Wave 0 |
| P11-06 | canvas mounts without error (jsdom) | RTL smoke | `npm run test -- components/floor/floor-canvas` | Wave 0 |

Visual regression deferred to Phase 13 per brief.

### Sampling Rate
- **Per task commit:** `npm run test -- lib/floor components/floor components/shell/floor-icon app/floor`
- **Per wave merge:** `npm run test`
- **Phase gate:** full green + manual smoke (open `/floor`, see forge_end animation, pop-out works)

### Wave 0 Gaps
- [ ] `lib/floor/iso.test.ts` — math roundtrip
- [ ] `lib/floor/event-adapter.test.ts` — mapping + reduced-motion
- [ ] `components/floor/floor-canvas.test.tsx` — mount smoke (mock `getContext` since jsdom returns null)
- [ ] `components/shell/floor-icon.test.tsx` — renders Link
- [ ] `app/floor/floor-client.test.tsx` — popout query toggles chrome
- [ ] Placeholder 32×32 PNGs in `public/floor/` — or solid `fill()` rects in v1

## Security Domain

| ASVS | Applies | Control |
|------|---------|---------|
| V2 Authn | yes | `/floor` added to `middleware.ts` protected-routes matcher |
| V3 Session | yes | Popped window inherits HTTP-only cookie (same origin) |
| V4 Access | yes | `/api/tail` continues enforcing `ALLOWED_ROOTS` — already correct |
| V5 Input validation | partial | SSE: `JSON.parse` in try/catch + allowlist `event` string set; never spread parsed payload |
| V6 Crypto | no | No new crypto surface |

### Threat Patterns
| Pattern | STRIDE | Mitigation |
|---------|--------|-----------|
| Malicious JSON in JSONL | Tampering | try/catch + allowlist event field + no `Object.assign` from parsed |
| Popup phishing | Spoofing | Same-origin own route — no 3rd-party content |
| DoS via huge JSONL lines | DoS | Reject lines >4 KB in SSE; cap queue at 500, effects at 10 |

## Sources

### Primary (HIGH)
- `package.json` versions [VERIFIED: direct read]
- `app/api/tail/route.ts` SSE endpoint [VERIFIED: full read]
- `lib/hooks/use-screen-shake.ts` reduced-motion idiom [VERIFIED: full read]
- `components/shell/memory-icon.tsx` top-bar icon pattern [VERIFIED: full read]
- `.cae/metrics/circuit-breakers.jsonl` event vocab [VERIFIED: grep across all projects]
- `npm view` for pixi.js, @pixi/react, kaboom, excalibur [VERIFIED: 2026-04-22]

### Secondary (MEDIUM)
- [pablodelucca/pixel-agents GitHub](https://github.com/pablodelucca/pixel-agents) — MIT, canvas 2D, **top-down**, VS Code webview coupled to extension
- [pixel-agents CLAUDE.md](https://github.com/pablodelucca/pixel-agents/blob/main/CLAUDE.md) — "webview cannot be easily extracted as standalone web app"
- [pixijs.com/blog/pixi-v8-launches](https://pixijs.com/blog/pixi-v8-launches) — tree-shakeable single-root import
- [pixi-react issue #551](https://github.com/pixijs/pixi-react/issues/551) — Next.js 15 / React 19 history
- [clintbellanger isometric math](https://clintbellanger.net/articles/isometric_math/) — diamond formulas
- [pikuma isometric projection](https://pikuma.com/blog/isometric-projection-in-games)

### Tertiary (LOW — needs validation)
- [itch.io JIK-A-4 Metro City](https://jik-a-4.itch.io/metrocity-free-topdown-character-pack) — license text not fetched first-hand
- [joshwcomeau prefers-reduced-motion](https://www.joshwcomeau.com/react/prefers-reduced-motion/)
- [css-tricks RAF + React hooks](https://css-tricks.com/using-requestanimationframe-with-react-hooks/)

## Metadata

**Confidence breakdown:**
- Stack choice (raw Canvas 2D): HIGH — benchmarks + npm data confirm sufficiency
- Architecture & event wiring: HIGH — maps cleanly to existing SSE + top-bar idioms
- pixel-agents portability: HIGH — upstream CLAUDE.md confirms webview is VS-Code-coupled
- Isometric math: HIGH — 30-year-old technique
- Sprite licensing: MEDIUM — itch.io reads permissively; full license text not verified
- Event vocab coverage: MEDIUM — only 6 of desired triggers actually emitted upstream
- Pop-out DX on 2nd monitor: LOW — browser behavior varies; needs physical test

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (30d — stack stable; sprite situation could shift)
