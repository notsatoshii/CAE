---
phase: 11-live-floor-pixel-agents-isometric-overlay
plan: "03"
subsystem: lib/floor + lib/hooks + components/floor
tags: [wave-2, hook, sse, refactor, tdd, d-04, d-10, d-12, d-14, d-15, d-16, t-11-05]
dependency_graph:
  requires:
    - lib/floor/event-adapter.ts (parseEvent, mapEvent) — Plan 11-01
    - lib/floor/scene.ts (createScene, Scene, StationName) — Plan 11-01
    - lib/floor/state.ts (step, MappedEffect) — Plan 11-01
    - lib/hooks/use-prefers-reduced-motion.ts — Plan 11-01
    - components/floor/floor-canvas.tsx — Plan 11-02 (refactored here)
  provides:
    - lib/floor/cb-path.ts (resolveCbPath)
    - lib/hooks/use-floor-events.tsx (useFloorEvents, UseFloorEventsOpts, UseFloorEventsResult, __test)
    - components/floor/floor-canvas.tsx (thinned; cbPath widened to string | null; onMetrics prop)
  affects:
    - Plan 11-04 imports useFloorEvents to read queueSize/effectsCount/authDrifted for toolbar
    - Plan 11-05 (pop-out) mounts FloorCanvas with cbPath from query param — same hook, no replumbing
    - Plan 13 (UI polish) references these signatures for visual/metric display
tech_stack:
  added: []
  patterns:
    - TDD red→green per task (3 tasks × 2 commits = 6 atomic commits)
    - queueMicrotask drain — decoupled from RAF cadence; caps hold even during pop-out detach
    - Ref-capture pattern for reducedMotion + paused (avoids SSE effect restarts on each flag flip)
    - sceneRef passed into hook; hook mutates, canvas reads — no React re-render per frame
    - 30s setInterval probe pattern (mirrors use-state-poll.tsx fetch + interval idiom)
key_files:
  created:
    - dashboard/lib/floor/cb-path.ts
    - dashboard/lib/floor/cb-path.test.ts
    - dashboard/lib/hooks/use-floor-events.tsx
    - dashboard/lib/hooks/use-floor-events.test.tsx
  modified:
    - dashboard/components/floor/floor-canvas.tsx
    - dashboard/components/floor/floor-canvas.test.tsx
decisions:
  - "queueMicrotask (not RAF) for drain — decouples event application from render cadence; caps enforced even when canvas is briefly unmounted (pop-out scenario)"
  - "reducedMotionRef + pausedRef capture latest values without restarting the SSE useEffect on each flag flip — one SSE per cbPath lifetime"
  - "auth-drift probes /api/state (pre-existing route, auth-gated identically to /api/tail, no new surface needed)"
  - "cbPath widened from string to string | null — null = idle scene, no network activity; consistent with resolveCbPath null return contract"
  - "canvas re-exports QUEUE_CAP/EFFECTS_CAP/MAX_LINE_BYTES from hookTest for backward compatibility with Plan 02 test assertions"
metrics:
  duration: "~6 minutes"
  completed_date: "2026-04-23"
  tasks_completed: 3
  files_created: 4
  files_modified: 2
---

# Phase 11 Plan 03: Wave 2 Hook Wiring Summary

Wave 2 of Phase 11 Live Floor: extracted SSE + event-handling into `useFloorEvents` hook; split path resolution into `lib/floor/cb-path.ts`; thinned `floor-canvas.tsx` to pure RAF + canvas + ResizeObserver. 131 tests green across all Phase 11 plans.

## What Was Built

### lib/floor/cb-path.ts — Pure Path Resolver (D-10)

Frozen signature (Plan 04 + Plan 05 import this):

```typescript
/**
 * Pure isomorphic resolver. No node: imports; safe in client hooks.
 * Strips trailing slash; no further normalization (ALLOWED_ROOTS check is /api/tail's job).
 * Never throws.
 */
export function resolveCbPath(projectPath?: string | null): string | null;
```

Behavior:
- Truthy non-empty non-whitespace string → `<path>/.cae/metrics/circuit-breakers.jsonl`
- Trailing slash normalized (stripped)
- null | undefined | "" | whitespace-only | non-string → `null`
- No path normalization (dotdot preserved — security boundary lives in `/api/tail` ALLOWED_ROOTS)

### lib/hooks/use-floor-events.tsx — SSE Wiring Hook (P11-03, D-04, D-14, D-15, D-16, T-11-05)

Frozen signatures (Plan 04 + Plan 05 depend on these):

```typescript
export interface UseFloorEventsOpts {
  /** Absolute path to circuit-breakers.jsonl. null = no SSE opened (idle). */
  cbPath: string | null;
  /** When true: events are queued but not applied to scene until paused flips false. */
  paused: boolean;
  /** Hook mutates sceneRef.current (effects push, status updates). Canvas reads each RAF tick. */
  sceneRef: MutableRefObject<Scene>;
}

export interface UseFloorEventsResult {
  effectsCount: number;          // active effects in scene (React state mirror)
  queueSize: number;             // pending events in queue (not yet applied)
  lastEventTs: number | null;    // epoch ms of most-recently-applied event
  authDrifted: boolean;          // true when /api/state returned 401 on 30s probe
}

export function useFloorEvents(opts: UseFloorEventsOpts): UseFloorEventsResult;

export const __test: {
  QUEUE_CAP: 500;
  EFFECTS_CAP: 10;
  MAX_LINE_BYTES: 4096;
  AUTH_POLL_MS: 30_000;
};
```

Internal implementation details (for Plan 05 pop-out reuse understanding):
- `reducedMotionRef` + `pausedRef` — capture latest values without restarting SSE effect
- `useEffect([cbPath])` — opens/closes EventSource; old SSE torn down on cbPath change
- `queueMicrotask(drain)` — drain called per-message receipt, not per-RAF tick
- `useEffect([cbPath])` — starts 30s `setInterval` for `/api/state` probe; cleared on unmount + cbPath→null

**Auth-drift semantics (T-11-05):**
- Probe fires every `AUTH_POLL_MS = 30_000` ms while `cbPath` is non-null
- `401` response → `authDrifted = true`
- `200/ok` response → `authDrifted = false` (self-healing)
- Network errors (fetch throws) → silent ignore; `authDrifted` unchanged
- Interval cleared on unmount AND when `cbPath` becomes null (no orphaned timers)

**Why queueMicrotask (not RAF) for drain cadence:**
Events are applied in the microtask queue, not the animation frame queue. This means:
1. Caps (QUEUE_CAP=500, EFFECTS_CAP=10) are enforced immediately on receipt, even if the RAF loop is slow or the canvas is briefly unmounted during the pop-out window detach (Plan 05).
2. The hook is safe to reuse in a pop-out window that has its own RAF context — drain is not entangled with any specific canvas's animation loop.
3. `paused=true` defers drain (events accumulate in queue) until the flag flips false — microtask drain is then invoked by the `useEffect([paused])` dep.

### components/floor/floor-canvas.tsx — Thinned Canvas Shell (Plan 11-03 refactor)

Updated frozen signature (Plan 04 + Plan 05 depend on this):

```typescript
export interface FloorCanvasProps {
  cbPath: string | null;   // widened from string — null = idle scene, no SSE
  paused?: boolean;
  /** Optional — parent (Plan 04 toolbar) opts in to read live counters. */
  onMetrics?: (m: { effectsCount: number; queueSize: number; authDrifted: boolean }) => void;
}

export default function FloorCanvas(props: FloorCanvasProps): React.JSX.Element;

/** Backward-compat re-exports from useFloorEvents.__test */
export const __test: {
  QUEUE_CAP: 500;
  EFFECTS_CAP: 10;
  MAX_LINE_BYTES: 4096;
};
```

Canvas now owns ONLY:
- `canvasRef`, `sceneRef`, `rafRef` — mutable refs
- RAF loop: `step(scene, dt)` + `render(ctx, scene, viewport)` each tick; skips on `paused`
- `ResizeObserver` — recomputes viewport on canvas resize
- `devLabels` sync from `useDevMode()`
- `useFloorEvents({ cbPath, paused, sceneRef })` call + `onMetrics` forwarding

Canvas no longer owns: EventSource, queueRef, drain logic, parseEvent, mapEvent, cap enforcement, reducedMotion logic.

## Test Results

```
Test Files  10 passed (10)
     Tests  131 passed (131)
```

Plans 01+02+03 breakdown:
- lib/floor/cb-path.test.ts: 9 tests (new — Task 1)
- lib/hooks/use-floor-events.test.tsx: 16 tests (new — Task 2)
- components/floor/floor-canvas.test.tsx: 11 tests (updated — Task 3; was 14, trimmed 6, added 3)
- lib/floor/iso.test.ts: 14 tests (Plan 01, no change)
- lib/floor/scene.test.ts: 20 tests (Plan 01, no change)
- lib/floor/state.test.ts: 6 tests (Plan 01, no change)
- lib/floor/event-adapter.test.ts: 31 tests (Plan 01, no change)
- lib/hooks/use-prefers-reduced-motion.test.tsx: 5 tests (Plan 01, no change)
- lib/floor/renderer.test.ts: 14 tests (Plan 02, no change)
- components/floor/floor-legend.test.tsx: 5 tests (Plan 02, no change)

## Commits

| Hash | Type | Message |
|------|------|---------|
| 882e1d8 | test RED | test(11-03): add failing tests for cb-path resolver |
| ff1583d | feat GREEN | feat(11-03): add resolveCbPath pure resolver |
| 173c291 | test RED | test(11-03): add failing tests for use-floor-events hook |
| 3c9a4b5 | feat GREEN | feat(11-03): add useFloorEvents hook wrapping SSE + caps + auth-drift |
| 7535d50 | test RED | test(11-03): update floor-canvas tests for useFloorEvents refactor |
| e6b0f01 | refactor GREEN | refactor(11-03): route floor-canvas SSE through useFloorEvents hook |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Type fix] Test file TS2322 for null renderHook prop**
- **Found during:** Task 2 tsc --noEmit after GREEN
- **Issue:** `renderHook(({ cbPath }: { cbPath: string | null }) => ...)` with `initialProps: { cbPath }` inferred `cbPath` as `string` from the outer scope, making `rerender({ cbPath: null })` a TS2322 error.
- **Fix:** Changed generic annotation to `(props: { cbPath: string | null }) => ...` with explicit cast on initialProps: `{ cbPath: cbPath as string | null }`.
- **Files modified:** `lib/hooks/use-floor-events.test.tsx`
- **Commit:** 3c9a4b5 (included in the GREEN commit)

### Pre-existing Issues (Out of Scope)

- `lib/cae-ship.test.ts` 5 TS2345 errors (Project.hasPlanning missing in test mocks) — pre-existing since Plan 11-01.

## Known Stubs

None. All 3 new/modified source files are fully functional:
- `cb-path.ts` — pure resolver, zero stubs
- `use-floor-events.tsx` — real SSE + real fetch probe + real event application
- `floor-canvas.tsx` — real RAF + real ResizeObserver; all event plumbing delegated to hook

## Threat Surface Scan

No new network endpoints introduced. Two existing surfaces now centralized in the hook:
- `/api/tail?path=` SSE (pre-existing, D-04) — moved from canvas to hook; ALLOWED_ROOTS enforcement unchanged in route handler
- `/api/state?project=` auth-drift probe (pre-existing route, new consumer) — T-11-05 mitigation; interval cleared on unmount + cbPath=null

Both surfaces are documented in the plan's `<threat_model>` register. No unregistered threat surfaces found.

## Self-Check: PASSED

Files exist at exact paths:
- dashboard/lib/floor/cb-path.ts — FOUND
- dashboard/lib/floor/cb-path.test.ts — FOUND
- dashboard/lib/hooks/use-floor-events.tsx — FOUND
- dashboard/lib/hooks/use-floor-events.test.tsx — FOUND
- dashboard/components/floor/floor-canvas.tsx — FOUND (modified)
- dashboard/components/floor/floor-canvas.test.tsx — FOUND (modified)

All 6 commits verified in git log: 882e1d8, ff1583d, 173c291, 3c9a4b5, 7535d50, e6b0f01.
131/131 tests green. No new TypeScript errors. Zero dollar signs in all 3 source files.
