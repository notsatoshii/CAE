---
phase: 11-live-floor-pixel-agents-isometric-overlay
plan: "02"
subsystem: lib/floor + components/floor
tags: [wave-1, canvas, render, react, tdd, d-01, d-03, d-05, d-07, d-09, d-14]
dependency_graph:
  requires:
    - lib/floor/iso.ts (mapToScreen, TILE_W, TILE_H) — Plan 11-01
    - lib/floor/scene.ts (STATIONS, createScene, Scene) — Plan 11-01
    - lib/floor/state.ts (step, Effect, StationStatus, MappedEffect) — Plan 11-01
    - lib/floor/event-adapter.ts (parseEvent, mapEvent) — Plan 11-01
    - lib/hooks/use-prefers-reduced-motion.ts — Plan 11-01
    - lib/copy/labels.ts (floor.* keyset) — Plan 11-01
    - lib/providers/dev-mode.tsx (useDevMode) — Phase 3
  provides:
    - lib/floor/renderer.ts (render, Viewport)
    - components/floor/floor-canvas.tsx (FloorCanvas, __test, QUEUE_CAP, EFFECTS_CAP, MAX_LINE_BYTES)
    - components/floor/floor-legend.tsx (FloorLegend)
  affects:
    - Plan 11-03 imports FloorCanvas signature for hook wiring
    - Plan 11-04 imports FloorCanvas + FloorLegend into the page shell
    - Plan 11-05 (pop-out) uses the same FloorCanvas with cbPath from query param
    - Plan 13 (UI polish) will reference the STATUS_FILL token palette for visual parity
tech_stack:
  added: []
  patterns:
    - Pure canvas draw routine (no React imports; fake-ctx unit-testable)
    - useRef scene mutation — never React state (D-05)
    - Single RAF loop with explicit cancelAnimationFrame cleanup
    - SSE via EventSource with onmessage guard (length > MAX_LINE_BYTES early-return)
    - Drop-oldest queue cap (QUEUE_CAP=500, EFFECTS_CAP=10)
    - DevModeProvider wrapping in tests (established Phase 9 pattern)
    - ResizeObserver stub in jsdom beforeEach (new test pattern for canvas components)
key_files:
  created:
    - dashboard/lib/floor/renderer.ts
    - dashboard/lib/floor/renderer.test.ts
    - dashboard/components/floor/floor-canvas.tsx
    - dashboard/components/floor/floor-canvas.test.tsx
    - dashboard/components/floor/floor-legend.tsx
    - dashboard/components/floor/floor-legend.test.tsx
  modified: []
decisions:
  - "Stations drawn via diamond paths (moveTo/lineTo/fill) not fillRect — renderer tests updated to count fill() not fillRect()"
  - "safeCtx non-null alias used inside RAF closure to satisfy TypeScript (getContext returns CanvasRenderingContext2D | null)"
  - "ResizeObserver stubbed in beforeEach via vi.stubGlobal (jsdom lacks it; component uses it in useEffect)"
  - "Dollar sign in JSDoc comment of floor-legend.tsx caught by lint guard test — removed from comment text"
metrics:
  duration: "~25 minutes"
  completed_date: "2026-04-23"
  tasks_completed: 3
  files_created: 6
  files_modified: 0
---

# Phase 11 Plan 02: Canvas Render Component Summary

Wave 1 of Phase 11 Live Floor: pure canvas renderer, React RAF+SSE client component, and Explain-mode a11y legend — all TDD green (33 tests).

## What Was Built

### lib/floor/renderer.ts — Pure Canvas Draw Routine (D-01, D-03, D-09)

Frozen TypeScript signature (Wave 2+ plans depend on this):

```typescript
export interface Viewport {
  width: number;    // canvas width in CSS px
  height: number;   // canvas height in CSS px
  cx: number;       // camera x — typically width/2
  cy: number;       // camera y — typically height/2 - 80
  devLabels: boolean; // true = dev copy, false = founder copy
}

export function render(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  viewport: Viewport,
): void;
```

Draw order: (1) dark-bg fill → (2) stations z-sorted by (tx+ty) ascending → (3) effects in array order → (4) entities on top.

**STATUS_FILL token palette** (hardcoded — CSS vars unavailable to canvas ctx — D-09):

```typescript
const STATUS_FILL: Record<string, string> = {
  idle:    "#121214",  // surface
  active:  "#00d4ff",  // accent
  warning: "#f59e0b",  // warning
  alarm:   "#ef4444",  // danger
};

// Additional tokens used by effect helpers:
const BG      = "#0a0a0a";   // background fill
const SUCCESS = "#22c55e";   // fireworks sparkle
const PHANTOM = "#8b5cf6";   // phantom walk + entity dot
const BORDER  = "#1f1f22";   // station diamond border
const TEXT    = "#8a8a8c";   // station label text
```

Effect rendering by kind:
- `fireworks` → 8 arc particles at increasing radius + center arc (SUCCESS color)
- `redX` → two diagonal moveTo/lineTo strokes (DANGER color, 3px line)
- `pulse` → single arc with alpha ramp based on ttl (ACCENT color, 2px stroke)
- `alarm` → fillRect flash with sin-based alpha (DANGER color)
- `phantomWalk` → moveTo/lineTo trail from start to current lerp position + dot (PHANTOM color)

No window/document/performance/requestAnimationFrame imports — fully unit-testable with stub ctx.

### components/floor/floor-canvas.tsx — React Client Component (D-01, D-04, D-05, D-14, D-15)

Frozen props signature (Plan 03 hook wiring + Plan 04 page depend on this):

```typescript
export interface FloorCanvasProps {
  cbPath: string;   // absolute path to circuit-breakers.jsonl (ALLOWED_ROOT validated by /api/tail)
  paused?: boolean; // when true: RAF loop skips drain + step + render
}

export default function FloorCanvas(props: FloorCanvasProps): React.JSX.Element;

/** Testing seam — cap constants for assertions */
export const __test: {
  readonly QUEUE_CAP: 500;
  readonly EFFECTS_CAP: 10;
  readonly MAX_LINE_BYTES: 4096;
};
```

Queue cap + effects cap + line size numbers (for Phase 13 polish reference):
- `QUEUE_CAP = 500` — drop-oldest on overflow (D-14)
- `EFFECTS_CAP = 10` — drop-oldest on overflow (D-14)
- `MAX_LINE_BYTES = 4096` — SSE frame rejected before parseEvent (D-15)

4 useEffect hooks:
1. RAF loop — `[reducedMotion, paused, viewport]` deps; drains queueRef → mapEvent → step → render; cancelAnimationFrame cleanup
2. SSE — `[cbPath]` dep; new EventSource on mount, es.close() on unmount
3. ResizeObserver — updates viewport state on canvas resize
4. devLabels sync — syncs viewport.devLabels to useDevMode().dev

### components/floor/floor-legend.tsx — Explain-Mode A11y Legend (P11-07, D-20)

```typescript
export function FloorLegend(): React.JSX.Element;
```

Renders `<ul>` with 10 `<li>` items. Each `<li>` contains:
- `<span data-testid="floor-legend-swatch" style={{background: color}} />` — colored swatch
- `<span>` with label text from `labelFor(dev).floorStation*`

**Label keys consumed by this component** (all 10 `floorStation*` keys):
`floorStationHub`, `floorStationForge`, `floorStationWatchtower`, `floorStationOverlook`,
`floorStationLibrary`, `floorStationShadow`, `floorStationArmory`, `floorStationDrafting`,
`floorStationPulpit`, `floorStationLoadingBay`

**Label keys consumed by renderer.ts** (same 10 `floorStation*` keys via STATION_LABEL_KEY map):
Same 10 keys — both components share the same label dictionary, ensuring text parity between canvas and legend.

**Label keys for Plan 04 toolbar copy** (3 `floorExplain*` keys from Plan 01):
`floorExplainHub`, `floorExplainForge` — shipped in Plan 11-01; Plan 04 wires them into the toolbar.
`floorLegend`, `floorPause`, `floorPopOut`, `floorMinimize`, `floorReducedMotionNotice` — toolbar copy, also Plan 01.

## Test Results

```
Test Files  3 passed (3)
     Tests  33 passed (33)
```

- renderer.test.ts: 14 tests (bg fill order, station counts, status tints, z-sort, 5 effect kinds, devLabels toggle, camera offset, entity ordering, no-throw)
- floor-canvas.test.tsx: 14 tests (mount, SSE open/close, cap constants, oversize drop, invalid/unknown JSON, queue cap, effects cap, paused gate, un-pause, resize, reduced-motion, lint guard)
- floor-legend.test.tsx: 5 tests (10 founder labels, dev copy flip, 10 swatches, ul>li structure, lint guard)

## Commits

| Hash | Type | Message |
|------|------|---------|
| ad3a3d0 | test RED | test(11-02): add failing tests for lib/floor/renderer |
| c7c9aeb | feat GREEN | feat(11-02): implement pure canvas renderer for scene |
| 5fffea9 | test RED | test(11-02): add failing tests for floor-canvas component |
| 89093d0 | feat GREEN | feat(11-02): implement FloorCanvas with RAF + SSE + queue caps + reduced-motion gate |
| 1dec030 | test RED | test(11-02): add failing tests for FloorLegend |
| 25ca114 | feat GREEN | feat(11-02): implement FloorLegend a11y fallback |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test adjustment] Station drawing uses path fill() not fillRect()**
- **Found during:** Task 1 GREEN run
- **Issue:** Plan behavior doc says "ctx.fillRect call count >= 11" for stations, but the action step specifies diamond geometry via moveTo/lineTo/closePath/fill — not fillRect. Tests asserted fillRect; implementation uses fill().
- **Fix:** Updated test assertions to count `fill()` calls (>= 10 for 10 stations) and `moveTo` calls (>= station count) rather than fillRect. fillRect is correctly used only for: bg fill, alarm effect flash, entity rect.
- **Files modified:** lib/floor/renderer.test.ts
- **Commit:** c7c9aeb

**2. [Rule 2 - Missing type guard] safeCtx alias for non-null canvas context in RAF closure**
- **Found during:** Task 2 tsc --noEmit
- **Issue:** TypeScript cannot prove `ctx` is non-null inside the RAF tick closure despite the `if (!ctx) return` guard (the closure captures the variable, not the narrowed type). TS error: "CanvasRenderingContext2D | null is not assignable to CanvasRenderingContext2D".
- **Fix:** Added `const safeCtx: CanvasRenderingContext2D = ctx` after the guard, used `safeCtx` in the render call.
- **Files modified:** components/floor/floor-canvas.tsx
- **Commit:** 89093d0

**3. [Rule 2 - Missing stub] ResizeObserver not defined in jsdom**
- **Found during:** Task 2 test run (mount smoke immediately threw)
- **Issue:** jsdom lacks ResizeObserver; floor-canvas.tsx uses it in useEffect #3. All tests failed with "ReferenceError: ResizeObserver is not defined".
- **Fix:** Added `vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} })` to beforeEach in the test file.
- **Files modified:** components/floor/floor-canvas.test.tsx
- **Commit:** 89093d0

**4. [Rule 1 - Lint bug] Dollar sign in JSDoc comment of floor-legend.tsx**
- **Found during:** Task 3 GREEN run (test 5 lint guard failed)
- **Issue:** The comment `* No $ in this file (lint-no-dollar.sh guard).` contained the very character it was warning about, causing the lint guard test to fail.
- **Fix:** Changed comment to `* No dollar signs in this file (lint-no-dollar.sh guard).`
- **Files modified:** components/floor/floor-legend.tsx
- **Commit:** 25ca114

### Pre-existing Issues (Out of Scope)

- `lib/cae-ship.test.ts` has 5 TS2345 errors (Project.hasPlanning missing in test mocks) — pre-existing, documented in Plan 11-01 SUMMARY.

## Known Stubs

None — all three files are fully functional:
- `renderer.ts` draws real geometry using iso math and hardcoded tokens
- `floor-canvas.tsx` wires real SSE + real RAF loop + real scene mutations
- `floor-legend.tsx` renders real label dictionary keys

The visual output is "placeholder" only in the D-09 sense (colored-rect stations instead of sprite art), but that is intentional per the plan and documented in CONTEXT.md D-09.

## Threat Surface Scan

No new network endpoints introduced. `/api/tail` was pre-existing (Plan 11-01 established it as the SSE source). The SSE onmessage handler is the T-11-02-b/c mitigations from the plan threat register:
- Frame size cap (MAX_LINE_BYTES = 4096) — implemented and tested (test 5)
- Queue overflow cap (QUEUE_CAP = 500 drop-oldest) — implemented and tested (test 8)
- Effects overflow cap (EFFECTS_CAP = 10 drop-oldest) — implemented and tested (test 9)
- Parsed payload never spread into scene — only enumerated MappedEffect kinds applied

No unregistered threat surfaces found.

## Self-Check: PASSED

All 6 source files found at exact paths in files_modified.
All 6 commits verified in git log: ad3a3d0, c7c9aeb, 5fffea9, 89093d0, 1dec030, 25ca114.
33/33 tests green. No TypeScript errors in new lib/floor or components/floor files.
Zero dollar signs in all 3 source files (renderer.ts, floor-canvas.tsx, floor-legend.tsx).
