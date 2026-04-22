---
phase: 11-live-floor-pixel-agents-isometric-overlay
verified: 2026-04-23T04:05:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: "n/a"
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Visual — open /floor; confirm isometric 2.5D scene with 10 diamond stations laid out per D-07 grid; z-sort looks correct (back stations paint first); labels legible"
    expected: "Dark-bg page with 10 status-colored diamond rects in isometric arrangement, labels beneath each"
    why_human: "Canvas 2D rendering is pixel output; only a human can judge that the diamond geometry and layout read as 'isometric CAE HQ scene' vs. looking broken"
  - test: "Live events — with the cae dashboard running, trigger a forge_begin and forge_end success=true; observe pulse at forge station then fireworks at hub"
    expected: "Forge station pulses (accent-tinted), then hub emits firework particles (~1.2s); forge returns to idle tint"
    why_human: "Real-time SSE + canvas animation; integration requires a running server + circuit-breakers.jsonl writer"
  - test: "Pop-out — click the Pop-out button on /floor; second browser window at 960x720 opens at /floor/popout?project=<X>; top-nav chrome hidden; scene renders"
    expected: "Same-origin child window with no TopNav visible (display:none); canvas fills the window; Escape closes the popout"
    why_human: "window.open behavior + chrome suppression + Escape handler all require a real browser runtime; unit tests stub window/document"
  - test: "Prefers-reduced-motion — enable OS reduce-motion; trigger forge_end; confirm NO fireworks appear; station tint still flips"
    expected: "Status tints update but no ephemeral effects (no fireworks, no redX, no pulse, no alarm flash, no phantom walk)"
    why_human: "matchMedia integration with real OS setting + canvas frame-level visual confirmation"
  - test: "Auth drift banner — sign out in another tab while /floor is open; within 30s the toolbar shows 're-auth in main window' banner"
    expected: "authDrifted banner appears with floorAuthDriftNotice copy; disappears after re-authentication on next probe"
    why_human: "Requires live /api/state endpoint returning 401 on expired session; timing-dependent behavior"
  - test: "Top-nav icon placement — confirm Gamepad2 icon is the FIRST icon in the top-nav right cluster, BEFORE the Memory icon"
    expected: "Icon order in right cluster: FloorIcon → MemoryIcon → MetricsIcon → ChatPopOutIcon"
    why_human: "Visual ordering + hover/focus ergonomics; already asserted by top-nav.test.tsx via DOM-order assertion, but visual confirmation requested per Eric's UI-audit-per-phase feedback"
---

# Phase 11: Live Floor (pixel-agents isometric overlay) Verification Report

**Phase Goal (ROADMAP.md):** top-bar Live Floor 🎮 toggle opens isometric CAE HQ scene per UI-SPEC §11. Canvas 2D top-down render of 10 stations, event animations (merge fireworks, reject X, phantom walk, alarm flash), pop-out window.

**Verified:** 2026-04-23T04:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

Note: Per Eric's session-7 directive, `human_needed` items are auto-approved and deferred to the consolidated post-P14 UAT. This verification does NOT block Phase 12 or the autonomous cascade. A dedicated `11-HUMAN-UAT.md` companion file is intentionally omitted — the `human_verification` frontmatter block above is the UAT checklist.

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                      | Status     | Evidence                                                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Top-bar 🎮 FloorIcon links to `/floor` and mounts BEFORE MemoryIcon (D-19, P11-01)                         | VERIFIED   | `components/shell/floor-icon.tsx:29` uses `Link href="/floor"`; `components/shell/top-nav.tsx:41-44` order: FloorIcon, MemoryIcon, MetricsIcon, ChatPopOutIcon; `top-nav.test.tsx` asserts DOM order, test passes |
| 2   | 10 stations keyed exactly per D-07 (hub, forge, watchtower, overlook, library, shadow, armory, drafting, pulpit, loadingBay) with correct (tx,ty,persona) | VERIFIED   | `lib/floor/scene.ts:46-58` matches D-07 line-for-line; 10 Object.freeze'd entries; `scene.test.ts` has 20 tests verifying each coord                                                                              |
| 3   | 7 event types mapped to synthesized effects per D-08 (forge_begin→pulse@forge, forge_end success→fireworks@hub, forge_end !success→redX@forge, sentinel_json_failure→pulse@watchtower, sentinel_fallback_triggered→alarm@watchtower, escalate_to_phantom→phantomWalk shadow→forge, halt→alarm@hub) | VERIFIED   | `lib/floor/event-adapter.ts:92-186` switch statement matches D-08 synthesis table exactly; `event-adapter.test.ts` has 31 tests covering all cases + invalid inputs                                               |
| 4   | Pop-out at dedicated `/floor/popout` route (NOT `?popout=1`) per Plan 05                                   | VERIFIED   | `app/floor/popout/page.tsx` exists (77 lines, full auth + project resolution); `components/floor/floor-toolbar.tsx:64` uses `"/floor/popout?project=" + encodeURIComponent(projectPath)`; old `?popout=1` removed |
| 5   | prefers-reduced-motion respected at hook (usePrefersReducedMotion) AND event-adapter (filters effects), per D-13 | VERIFIED   | `lib/hooks/use-prefers-reduced-motion.ts` SSR-safe matchMedia hook; `lib/hooks/use-floor-events.tsx:73,105` reads and passes into `mapEvent`; `lib/floor/event-adapter.ts:199-201` filters effect entries; 5 hook tests + reduced-motion assertions in event-adapter and hook tests all pass |
| 6   | `/floor/:path*` middleware guard enforces auth (D-17)                                                       | VERIFIED   | `middleware.ts:14` matcher: `["/plan/:path*", "/build/:path*", "/memory", "/metrics", "/floor", "/floor/:path*"]`; both `/floor` and popout covered; page.tsx + popout/page.tsx ALSO redirect unauthenticated users |
| 7   | QUEUE_CAP=500, EFFECTS_CAP=10, MAX_LINE_BYTES=4096 enforced (D-14, D-15)                                    | VERIFIED   | `lib/hooks/use-floor-events.tsx:31-33` defines constants; `:147-149` enforces QUEUE_CAP drop-oldest; `:112-114` enforces EFFECTS_CAP drop-oldest; `:139` rejects oversize before parse; 16 hook tests cover cap behavior |
| 8   | Canvas 2D render pipeline: bg→z-sorted stations→effects→entities; pure (no window/document/performance); RAF loop in FloorCanvas owns step+render | VERIFIED   | `lib/floor/renderer.ts:259-331` pure draw routine; tested with stub ctx across 14 tests (bg order, z-sort, 5 effect kinds, entity ordering, devLabels flip); `components/floor/floor-canvas.tsx:107-140` RAF loop with cancelAnimationFrame cleanup |
| 9   | Phase 11 full test sweep green (189 tests across 18 files); no regressions from Plan 01 baseline            | VERIFIED   | `npx vitest run lib/floor lib/hooks/use-prefers-reduced-motion lib/hooks/use-floor-events components/floor components/shell/floor-icon components/shell/top-nav app/floor` → **18 Test Files passed, 189/189 tests passed**                  |

**Score:** 9/9 truths verified (all observable truths PASSED)

### Required Artifacts

| Artifact                                             | Expected                                        | Status      | Details                                                                                        |
| ---------------------------------------------------- | ----------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| `lib/floor/iso.ts`                                   | Diamond iso math (mapToScreen, screenToMap)     | VERIFIED    | 44 lines; exports TILE_W=64, TILE_H=32, both functions; wired into renderer.ts + event-adapter |
| `lib/floor/scene.ts`                                 | STATIONS + createScene                          | VERIFIED    | 108 lines; 10 frozen stations, createScene factory; imported by event-adapter, renderer, hook  |
| `lib/floor/state.ts`                                 | StationStatus/Effect/MappedEffect + step()      | VERIFIED    | 61 lines; exhaustive unions + pure step reducer                                                |
| `lib/floor/event-adapter.ts`                         | parseEvent + mapEvent + 8-entry allowlist       | VERIFIED    | 204 lines; full synthesis table + reduced-motion filter                                        |
| `lib/floor/cb-path.ts`                               | resolveCbPath pure resolver                     | VERIFIED    | Imported by both `/floor` and `/floor/popout` pages                                            |
| `lib/floor/renderer.ts`                              | Pure render(ctx, scene, vp)                     | VERIFIED    | 331 lines; bg + z-sort + 5 effect helpers + entities; imported by FloorCanvas                  |
| `lib/hooks/use-prefers-reduced-motion.ts`            | matchMedia reduced-motion hook                  | VERIFIED    | Imported by use-floor-events.tsx                                                               |
| `lib/hooks/use-floor-events.tsx`                     | SSE + caps + reduced-motion + auth-drift probe  | VERIFIED    | 194 lines; real EventSource, fetch, setInterval                                                |
| `components/floor/floor-canvas.tsx`                  | React canvas shell (RAF + ResizeObserver)       | VERIFIED    | 173 lines; consumes useFloorEvents; NO inline SSE (refactored in Plan 03)                      |
| `components/floor/floor-legend.tsx`                  | Explain-mode a11y legend                        | VERIFIED    | 89 lines; 10 swatches + labels from labelFor                                                   |
| `components/floor/floor-toolbar.tsx`                 | 5 controls + re-auth banner                     | VERIFIED    | 158 lines; Pause/Minimize/Pop-out/Legend/banner; URL routes to `/floor/popout`                 |
| `components/floor/floor-client.tsx`                  | Client orchestrator (dynamic import, return-to-main) | VERIFIED | 111 lines; dynamic import with `ssr: false` (D-18); return-to-main button gated by hasOpener   |
| `components/floor/floor-popout-host.tsx`             | Pop-out ergonomics (title/resize/Escape)        | VERIFIED    | 75 lines; resizeTo + Escape handler + aria-hidden top-nav                                      |
| `components/shell/floor-icon.tsx`                    | Top-nav Gamepad2 link                           | VERIFIED    | 40 lines; next/link + ExplainTooltip + labelFor                                                |
| `app/floor/page.tsx`                                 | Server shell (auth + project resolution)        | VERIFIED    | 64 lines; auth() + redirect + listProjects + resolveCbPath                                     |
| `app/floor/popout/page.tsx`                          | Dedicated popout route (D-06, D-10, D-17)       | VERIFIED    | 77 lines; route-scoped `<style>` chrome suppression; `/floor/popout` path                      |
| `app/floor/layout.tsx`                               | Shared floor layout (pass-through)              | VERIFIED    | 13 lines; minimal pass-through for route boundary                                              |
| `middleware.ts`                                      | `/floor` + `/floor/:path*` in matcher           | VERIFIED    | Line 14 includes both patterns                                                                 |
| `lib/copy/labels.ts`                                 | floor.* keys in both FOUNDER + DEV branches     | VERIFIED    | 20 keys across both branches (floorPageTitle through floorReturnToMain)                        |
| `components/shell/top-nav.tsx`                       | FloorIcon mounted first in right cluster        | VERIFIED    | Lines 41-44 show FloorIcon → MemoryIcon → MetricsIcon → ChatPopOutIcon                         |

All artifacts exist, are substantive (none < ~40 lines except layout.tsx which is intentionally a 13-line pass-through), and are wired into importing callers.

### Key Link Verification

| From                                     | To                                                          | Via                                                                  | Status | Details                                                                      |
| ---------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| `components/floor/floor-canvas.tsx`      | `lib/hooks/use-floor-events.tsx`                            | `import { useFloorEvents, __test as hookTest } from "@/lib/hooks/use-floor-events"` | WIRED  | Line 29 import; line 93 invocation with `{cbPath, paused, sceneRef}`       |
| `lib/hooks/use-floor-events.tsx`         | `/api/tail`                                                 | `new EventSource("/api/tail?path=" + encodeURIComponent(opts.cbPath))`              | WIRED  | Line 135                                                                     |
| `lib/hooks/use-floor-events.tsx`         | `lib/floor/event-adapter.ts`                                | `import { parseEvent, mapEvent } from "@/lib/floor/event-adapter"`                  | WIRED  | Line 24; used at 142, 105                                                    |
| `lib/hooks/use-floor-events.tsx`         | `/api/state`                                                | `fetch("/api/state?project=" + encodeURIComponent(projectPath))`                    | WIRED  | Line 172 inside 30s setInterval probe                                        |
| `lib/hooks/use-floor-events.tsx`         | `lib/hooks/use-prefers-reduced-motion.ts`                   | `usePrefersReducedMotion()`                                          | WIRED  | Line 73                                                                      |
| `components/floor/floor-canvas.tsx`      | `lib/floor/renderer.ts`                                     | `render(safeCtx, sceneRef.current, viewport)` in RAF tick            | WIRED  | Line 124                                                                     |
| `components/floor/floor-client.tsx`      | `components/floor/floor-canvas.tsx`                         | `dynamic(() => import("./floor-canvas"), { ssr: false })`            | WIRED  | Line 30 (satisfies D-18)                                                     |
| `components/floor/floor-toolbar.tsx`     | `window.open("/floor/popout?project=...")`                  | handlePopOut handler                                                 | WIRED  | Lines 61-68; exact feature string "width=960,height=720" + name "cae-live-floor" |
| `app/floor/page.tsx`                     | `components/floor/floor-client.tsx`                         | `<FloorClient cbPath={cbPath} projectPath={projectPath} popout={popout} />`         | WIRED  | Line 61                                                                      |
| `app/floor/popout/page.tsx`              | `components/floor/floor-popout-host.tsx`                    | `<FloorPopoutHost cbPath={cbPath} projectPath={projectPath} />`      | WIRED  | Line 73; forces popout=true internally                                       |
| `components/shell/top-nav.tsx`           | `components/shell/floor-icon.tsx`                           | `<FloorIcon />` before `<MemoryIcon />`                              | WIRED  | Lines 41-42                                                                  |
| `middleware.ts`                          | `/floor/:path*`                                             | matcher array includes both literals                                 | WIRED  | Line 14                                                                      |
| `components/floor/floor-popout-host.tsx` | `components/floor/floor-client.tsx`                         | `<FloorClient cbPath={...} projectPath={...} popout={true} />`       | WIRED  | Line 72                                                                      |

All key links confirmed. No NOT_WIRED, no PARTIAL.

### Data-Flow Trace (Level 4)

| Artifact                                | Data Variable     | Source                                                                            | Produces Real Data | Status   |
| --------------------------------------- | ----------------- | --------------------------------------------------------------------------------- | ------------------ | -------- |
| `FloorCanvas`                           | `sceneRef.current` | Mutated by `useFloorEvents` via `mapEvent(parseEvent(SSE frame))` from `/api/tail` | Yes (real SSE)     | FLOWING  |
| `useFloorEvents` → `effectsCount/queueSize/authDrifted` | React state counters | Mirrors `sceneRef.current.effects.length` + queue size + /api/state probe response | Yes                | FLOWING  |
| `FloorClient` → `metrics`               | onMetrics callback | Forwarded from FloorCanvas `{ effectsCount, queueSize, authDrifted }`             | Yes                | FLOWING  |
| `FloorToolbar` debug strip              | `metrics.queueSize` + `metrics.effectsCount` | Flows from FloorClient `metrics` prop (not hardcoded 0)                        | Yes                | FLOWING  |
| `FloorPage` / `FloorPopoutPage` → `cbPath` | `resolveCbPath(projectPath)` | listProjects() + searchParams.project; null when no project                  | Yes (conditional)  | FLOWING  |

Re-auth banner in toolbar receives `metrics.authDrifted` from the 30s `/api/state` probe. Counter strip receives real queue/effect counts. No hollow props (`[]`, `{}`, `null` hardcoded at call sites) found in the data path.

### Behavioral Spot-Checks

| Behavior                                            | Command                                                                                                               | Result                                                            | Status |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------ |
| Phase 11 test suite passes                          | `npx vitest run lib/floor lib/hooks/use-prefers-reduced-motion lib/hooks/use-floor-events components/floor components/shell/floor-icon components/shell/top-nav app/floor` | `18 Test Files passed, 189 passed (189)` in 9.75s                 | PASS   |
| Full dashboard test suite                           | `npx vitest run`                                                                                                      | `47 passed (52)` — 5 pre-existing empty-stub suites fail identically to prior phases; 482 tests pass | PASS   |
| TypeScript check                                    | `npx tsc --noEmit`                                                                                                    | 5 pre-existing errors in `lib/cae-ship.test.ts` (Project.hasPlanning mocks, documented in every Plan 11 SUMMARY); zero Phase-11 new errors | PASS   |
| D-07 station coordinates exact match                | `grep -E "tx: [0-9]+, ty: [0-9]+" lib/floor/scene.ts`                                                                 | 10 lines, coords match D-07 line-for-line                         | PASS   |
| D-06 no cross-window RPC                            | `grep -rn "postMessage\|BroadcastChannel" lib/floor components/floor lib/hooks/use-floor-events.tsx`                  | empty — no matches                                                | PASS   |
| No TODO/FIXME/placeholder in Phase 11 source        | `grep -rn "TODO\|FIXME\|XXX\|HACK\|placeholder\|coming soon" <phase 11 non-test files>`                               | empty                                                             | PASS   |
| No stub returns (`return null$`, `return <></>`)    | targeted grep across phase 11 non-test files                                                                          | empty                                                             | PASS   |
| Caps constants at exact values                      | `grep "QUEUE_CAP\|EFFECTS_CAP\|MAX_LINE_BYTES" lib/hooks/use-floor-events.tsx`                                        | QUEUE_CAP=500, EFFECTS_CAP=10, MAX_LINE_BYTES=4096 confirmed      | PASS   |
| Popout URL uses dedicated route                     | `grep "/floor/popout" components/floor/floor-toolbar.tsx`                                                             | Line 64 matches `"/floor/popout?project=" + ...`                  | PASS   |
| Middleware guards /floor/:path*                     | `grep "/floor" middleware.ts`                                                                                         | matcher contains both `/floor` and `/floor/:path*`                | PASS   |

### Requirements Coverage

Phase 11 declared requirement IDs: **P11-01 through P11-07**. REQUIREMENTS.md in this project uses in-line P11-* IDs (verified from PLAN frontmatter). Mapping:

| Requirement | Source Plan     | Description                                             | Status       | Evidence                                                                            |
| ----------- | --------------- | ------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------- |
| P11-01      | 04              | Top-bar 🎮 Link opens Live Floor at `/floor`            | SATISFIED    | FloorIcon (link to /floor) mounted in top-nav before MemoryIcon; 7 icon tests pass  |
| P11-02      | 01, 02          | Isometric 2.5D scene with 10 named stations             | SATISFIED    | 10 stations rendered via diamond iso projection; scene + renderer tests green       |
| P11-03      | 01, 03          | SSE-driven event animations sourced from `/api/tail`    | SATISFIED    | useFloorEvents opens SSE on /api/tail; parseEvent + mapEvent synthesize 7 effects   |
| P11-04      | 04, 05          | Pop-out to separate browser window for second monitor   | SATISFIED    | `/floor/popout` route + window.open from toolbar + FloorPopoutHost ergonomics       |
| P11-05      | 01, 03          | Respects prefers-reduced-motion (status tints only)     | SATISFIED    | Hook + adapter both gate on reducedMotion; filter removes effect entries            |
| P11-06      | 02, 04, 05      | Dark theme + base-ui for shell/controls; canvas pixels  | SATISFIED    | `bg-[color:var(--bg)]` shell; canvas uses hardcoded tokens (#0a0a0a etc.)           |
| P11-07      | 01, 02, 04      | Explain-mode legend overlay (a11y fallback)             | SATISFIED    | FloorLegend rendered when `useExplainMode().explain === true` in floor-client       |

All 7 requirements SATISFIED. No orphaned requirements.

### Anti-Patterns Found

None. Specifically scanned:

| File                                   | Pattern Searched                        | Result | Severity |
| -------------------------------------- | --------------------------------------- | ------ | -------- |
| All phase 11 source files              | TODO / FIXME / XXX / HACK / placeholder | 0      | —        |
| All phase 11 source files              | `return null` / `return <></>` stubs    | 0      | —        |
| lib/floor, components/floor, hook      | `postMessage` / `BroadcastChannel`      | 0      | —        |
| All phase 11 source files              | `$` (lint-no-dollar guard per Phase 9)  | 0      | —        |
| `floor-toolbar.tsx`                    | Old `/floor?popout=1` URL               | 0      | —        |

### Human Verification Required

See `human_verification` block in frontmatter above. 6 items:

1. Visual isometric scene confirmation
2. Live event animation flow (forge_begin → forge_end fireworks)
3. Pop-out window behavior (window.open, chrome hide, Escape close)
4. prefers-reduced-motion integration with OS setting
5. Auth drift banner 30s timing
6. Top-nav icon visual ordering

**Per Eric's session-7 directive and `feedback_full_autonomous_no_permission_asks.md`, these are auto-approved and deferred to the post-P14 consolidated UAT.** No blocking gate. Phase 12 (command palette + polish) is cleared to start.

### Gaps Summary

No gaps. Every Phase 11 must-have is satisfied by real, wired, substantive code:

- **Observable truths:** 9/9 VERIFIED
- **Artifacts:** 20/20 exist, substantive (40+ lines except the intentional 13-line layout), and wired
- **Key links:** 13/13 WIRED (no orphans, no partials)
- **Data flows:** All 5 checked paths FLOWING (no hardcoded empty props)
- **Behavioral spot-checks:** 10/10 PASS
- **Requirements:** 7/7 SATISFIED (P11-01 through P11-07)
- **Anti-patterns:** 0 found
- **Regressions:** None (482 tests pass across dashboard suite — pre-existing stub failures and pre-existing cae-ship.test.ts type errors documented since Plan 11-01 and unchanged)

The status is `human_needed` only because the core "does it look and feel right in a real browser?" questions (visual geometry, motion, window behavior, OS integration) cannot be verified via unit tests with mocked canvas/EventSource/matchMedia/window.open. Unit coverage is high (189 Phase 11 tests) but canvas pixel output and cross-window popup behavior demand human eyes.

Phase 11 is functionally complete and ready to proceed. Under Eric's autonomous directive, the human verification items are logged here and deferred; they do not block Phase 12.

---

_Verified: 2026-04-23T04:05:00Z_
_Verifier: Claude (gsd-verifier, Opus 4.7 1M context)_
