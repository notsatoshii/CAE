---
phase: 11-live-floor-pixel-agents-isometric-overlay
plan: "01"
subsystem: lib/floor
tags: [wave-0, pure-lib, tdd, iso-math, event-adapter, scene, labels, reduced-motion]
dependency_graph:
  requires: []
  provides:
    - lib/floor/iso.ts (mapToScreen, screenToMap, TILE_W, TILE_H)
    - lib/floor/scene.ts (STATIONS, StationName, StationDef, Scene, createScene)
    - lib/floor/state.ts (StationStatus, Effect, MappedEffect, step)
    - lib/floor/event-adapter.ts (parseEvent, mapEvent, ALLOWED_EVENTS, FloorMapEventOpts)
    - lib/hooks/use-prefers-reduced-motion.ts (usePrefersReducedMotion, prefersReducedMotionInitial)
    - lib/copy/labels.ts (floor.* keyset — 18 keys)
  affects:
    - Plans 11-02 and 11-03 (canvas render + hook wiring) import all 5 lib/floor modules
    - Plan 11-04 (pop-out route) consumes label keys
tech_stack:
  added: []
  patterns:
    - Diamond isometric projection (clintbellanger formulas: 2:1 diamond, TILE_W=64 TILE_H=32)
    - TDD red→green per task (failing import error confirmed before implementation)
    - matchMedia SSR guard (typeof window + typeof window.matchMedia)
    - Exhaustive switch on allowlisted event names (no runtime property spread from parsed payload)
key_files:
  created:
    - dashboard/lib/floor/iso.ts
    - dashboard/lib/floor/iso.test.ts
    - dashboard/lib/floor/scene.ts
    - dashboard/lib/floor/scene.test.ts
    - dashboard/lib/floor/state.ts
    - dashboard/lib/floor/state.test.ts
    - dashboard/lib/floor/event-adapter.ts
    - dashboard/lib/floor/event-adapter.test.ts
    - dashboard/lib/hooks/use-prefers-reduced-motion.ts
    - dashboard/lib/hooks/use-prefers-reduced-motion.test.tsx
  modified:
    - dashboard/lib/copy/labels.ts
decisions:
  - "STATIONS frozen with Object.freeze() — both outer record and each inner StationDef"
  - "prefersReducedMotionInitial() guards typeof window.matchMedia (not just typeof window) — jsdom lacks matchMedia by default"
  - "effect-adapter default target for escalate_to_phantom = STATIONS.forge (no task_id stream in v1; see D-12)"
  - "step() uses splice in reverse-index loop for in-place removal (avoids index skipping)"
metrics:
  duration: "~7 minutes"
  completed_date: "2026-04-22"
  tasks_completed: 3
  files_created: 10
  files_modified: 1
---

# Phase 11 Plan 01: Wave 0 Pure-Lib TDD Scaffold Summary

Wave 0 pure-lib scaffold for Phase 11 Live Floor: diamond iso math, static station scene, FSM step reducer, SSE event parser + synthesizer, reduced-motion hook, and floor.* label keyset — all TDD green.

## What Was Built

### lib/floor/iso.ts — Diamond Isometric Projection Math (D-03)

Clintbellanger 2:1 diamond formulas. Mutual inverses verified to 1e-9 precision.

```typescript
export const TILE_W = 64;
export const TILE_H = 32;

export function mapToScreen(tx: number, ty: number, cx = 0, cy = 0): { x: number; y: number };
export function screenToMap(sx: number, sy: number, cx = 0, cy = 0): { tx: number; ty: number };
```

### lib/floor/scene.ts — Static Station Map + Scene Factory (D-07)

Station coordinate table (exact D-07 coords, frozen):

| Station    | tx | ty | persona   |
|------------|----|----|-----------|
| hub        | 8  | 8  | nexus     |
| forge      | 12 | 6  | forge     |
| watchtower | 13 | 2  | sentinel  |
| overlook   | 2  | 2  | scout     |
| library    | 4  | 12 | scribe    |
| shadow     | 10 | 14 | phantom   |
| armory     | 14 | 10 | aegis     |
| drafting   | 6  | 4  | arch      |
| pulpit     | 8  | 13 | herald    |
| loadingBay | 1  | 8  | null      |

```typescript
export const STATIONS: Readonly<Record<StationName, StationDef>>;  // Object.freeze'd
export function createScene(): Scene;  // fresh deep-copy; each call returns distinct references
```

`Scene` interface (frozen signature — Wave 1 plans 02+03 depend on this):

```typescript
export interface Scene {
  stations: Record<StationName, StationDef & { status: StationStatus }>;
  effects: Effect[];
  entities: FloorEntity[];
  queueDepth: number;
  paused: boolean;
  lastDelegationTs: number;
}
```

### lib/floor/state.ts — StationStatus + Effect Unions + step() (D-13)

```typescript
export type StationStatus = "idle" | "active" | "warning" | "alarm";

export type Effect =
  | { kind: "fireworks"; atTx: number; atTy: number; ttl: number }
  | { kind: "redX"; atTx: number; atTy: number; ttl: number }
  | { kind: "pulse"; atTx: number; atTy: number; ttl: number }
  | { kind: "alarm"; atTx: number; atTy: number; ttl: number }
  | { kind: "phantomWalk"; fromTx: number; fromTy: number; toTx: number; toTy: number; ttl: number };

export type MappedEffect =
  | { kind: "effect"; effect: Effect }
  | { kind: "status"; station: StationName; status: StationStatus };

export function step(scene: Scene, dt: number): void;
// Decrements ttl on all effects by dt; removes expired (ttl <= 0); no-op when paused or dt === 0
```

### lib/floor/event-adapter.ts — parseEvent + mapEvent (D-08, D-13, D-16)

```typescript
export const ALLOWED_EVENTS: readonly [...8 entries...];
export function parseEvent(rawLine: string): CbEvent | null;
export interface FloorMapEventOpts { reducedMotion: boolean; }
export function mapEvent(e: CbEvent, opts: FloorMapEventOpts): MappedEffect[];
```

Synthesis rules implemented:

| Event | Effect | Status |
|-------|--------|--------|
| forge_begin | pulse@forge (ttl 2.0s) | forge→active |
| forge_end success=true | fireworks@hub (ttl 1.2s) | forge→idle |
| forge_end success=false | redX@forge (ttl 0.8s) | forge→warning |
| sentinel_json_failure | pulse@watchtower (ttl 2.0s) | watchtower→warning |
| sentinel_fallback_triggered | alarm@watchtower (ttl 1.5s) | watchtower→alarm |
| escalate_to_phantom | phantomWalk shadow→forge (ttl 2.5s) | shadow→active |
| halt | alarm@hub (ttl 1.5s) | hub→alarm |
| forge_slot_acquired / released | [] | (no change) |

**Reduced-motion semantics (D-13, Wave 1 plan 02 dependency):**
When `opts.reducedMotion === true`, all `{ kind: "effect" }` entries are filtered out before return. Only `{ kind: "status" }` entries survive. Canvas glue in plan 02 checks this to skip effect spawning while preserving station tint updates.

### lib/hooks/use-prefers-reduced-motion.ts (D-13)

```typescript
export function prefersReducedMotionInitial(): boolean;  // SSR-safe; guards window + window.matchMedia
export function usePrefersReducedMotion(): boolean;      // matchMedia-backed; re-renders on change
```

### lib/copy/labels.ts — floor.* Keyset (D-20)

18 keys added to both FOUNDER and DEV branches of `labelFor()`:
`floorPageTitle`, `floorPopOut`, `floorMinimize`, `floorPause`, `floorLegend`,
`floorReducedMotionNotice`, `floorStation{Hub,Forge,Watchtower,Overlook,Library,Shadow,Armory,Drafting,Pulpit,LoadingBay}`,
`floorExplainHub`, `floorExplainForge`.

## Test Results

```
Test Files  5 passed (5)
     Tests  76 passed (76)
```

- iso.test.ts: 14 tests (origin, edge cases, 5-pair roundtrip with + without camera)
- scene.test.ts: 20 tests (all 10 D-07 coords, freeze, createScene isolation)
- state.test.ts: 6 tests (step decrement/expiry/paused/noop + StationStatus exhaustive switch)
- event-adapter.test.ts: 31 tests (parseEvent safety, ALLOWED_EVENTS, mapEvent synthesis, reducedMotion gate)
- use-prefers-reduced-motion.test.tsx: 5 tests (SSR helper, mount, change event, cleanup)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing guard] `prefersReducedMotionInitial()` guards typeof window.matchMedia**
- **Found during:** Task 2 GREEN run
- **Issue:** jsdom environment provides `window` but not `window.matchMedia`. The function called `window.matchMedia(QUERY).matches` after only checking `typeof window === "undefined"`, which threw "window.matchMedia is not a function" in the SSR test.
- **Fix:** Added `if (typeof window.matchMedia !== "function") return false;` guard — correctly returns false in both SSR (no window) and jsdom (no matchMedia) environments.
- **Files modified:** `lib/hooks/use-prefers-reduced-motion.ts`, `lib/hooks/use-prefers-reduced-motion.test.tsx` (mock type fix)
- **Commits:** 157317c

**2. [Rule 2 - Type correction] Test mock type annotations for vi.fn() mocks**
- **Found during:** Task 2 tsc --noEmit check
- **Issue:** `ReturnType<typeof vi.fn>` resolves to `Mock<any[], unknown>` but explicit parameter types on the mock callback narrowed it to an incompatible signature (TS2322).
- **Fix:** Used `ReturnType<typeof vi.fn<any[], void>>` in the mm object type annotation.
- **Files modified:** `lib/hooks/use-prefers-reduced-motion.test.tsx`
- **Commit:** 157317c

### Pre-existing Issues (Out of Scope)

- `lib/cae-ship.test.ts` has 5 TS2345 errors (Project.hasPlanning missing in test mocks) — pre-existing, not caused by this plan.
- ESLint `@eslint/eslintrc` package missing — `pnpm lint` fails at project level. Pre-existing issue; `lint-no-dollar.sh` script passes (no `$` in new source).

## Known Stubs

None — all pure math/data functions. No UI rendering, no data sources wired.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All new files are pure TypeScript libraries with no side effects at module load time. `parseEvent` adds the `lib/floor` trust boundary (JSONL line → client), which is documented in the plan's `<threat_model>` (T-11-01, T-11-02-a, T-11-16). No unregistered threats found.

## Self-Check: PASSED

All 10 source files found at exact paths in files_modified.
All 5 commits verified in git log: d9868a4, bf93e41, 0702f38, 157317c, 05fc121.
76/76 tests green. No TypeScript errors in new lib/floor or lib/hooks files.
