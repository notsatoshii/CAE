---
phase: 11-live-floor-pixel-agents-isometric-overlay
plan: "04"
subsystem: components/shell + components/floor + app/floor + middleware
tags: [wave-3, toolbar, page, route, icon, middleware, tdd, d-06, d-10, d-11, d-17, d-18, d-19, d-20]
dependency_graph:
  requires:
    - lib/floor/cb-path.ts (resolveCbPath) — Plan 11-03
    - lib/hooks/use-floor-events.tsx (UseFloorEventsResult) — Plan 11-03
    - components/floor/floor-canvas.tsx (FloorCanvasProps) — Plans 11-02, 11-03
    - components/floor/floor-legend.tsx (FloorLegend) — Plan 11-02
    - lib/copy/labels.ts (floor.* keyset) — Plan 11-01
    - lib/providers/explain-mode.tsx (useExplainMode) — Phase 3
    - lib/providers/dev-mode.tsx (useDevMode) — Phase 3
  provides:
    - components/shell/floor-icon.tsx (FloorIcon — top-nav link)
    - components/floor/floor-toolbar.tsx (FloorToolbar, FloorToolbarProps)
    - components/floor/floor-client.tsx (FloorClient, FloorClientProps)
    - app/floor/page.tsx (FloorPage server shell)
    - middleware.ts (extended with /floor + /floor/:path*)
    - top-nav.tsx (FloorIcon mounted as first right-cluster icon)
    - lib/copy/labels.ts (floorAuthDriftNotice key added)
  affects:
    - Plan 11-05 (pop-out window) imports FloorClient + FloorToolbar directly
    - Plan 11-05 uses the same window.open shape and feature string
    - Plan 13 (UI polish) references FloorToolbar, FloorClient, FloorPage for visual audit
tech_stack:
  added: []
  patterns:
    - TDD red→green per task (3 tasks x 2 commits = 6 atomic commits)
    - ChatPopOutIcon mirror pattern for FloorIcon (next/link + ExplainTooltip + labelFor)
    - Dynamic import with ssr:false for canvas (D-18)
    - Server-side auth double-check (middleware + page.tsx belt-and-suspenders)
    - Project resolution algorithm: explicit > most-recent Shift > first project > null
key_files:
  created:
    - dashboard/components/shell/floor-icon.tsx
    - dashboard/components/shell/floor-icon.test.tsx
    - dashboard/components/shell/top-nav.test.tsx
    - dashboard/components/floor/floor-toolbar.tsx
    - dashboard/components/floor/floor-toolbar.test.tsx
    - dashboard/components/floor/floor-client.tsx
    - dashboard/components/floor/floor-client.test.tsx
    - dashboard/app/floor/page.tsx
    - dashboard/app/floor/page.test.tsx
  modified:
    - dashboard/components/shell/top-nav.tsx (FloorIcon added as first right-cluster icon)
    - dashboard/middleware.ts (/floor + /floor/:path* added to matcher)
    - dashboard/lib/copy/labels.ts (floorAuthDriftNotice key added to FOUNDER + DEV)
decisions:
  - "FloorIcon mirrors ChatPopOutIcon exactly — same class, same ExplainTooltip wrap, same labelFor wiring; only icon and href differ"
  - "floorAuthDriftNotice added to labels.ts (new key, not in Plan 01 keyset); FOUNDER: 'Please sign in again in the main window'; DEV: 'Session expired — re-auth in main window'"
  - "FloorToolbar legend toggle wires to useExplainMode().toggle (not a local boolean) — legend state is global Explain mode"
  - "projectPath=null passed through to FloorClient on empty project list — renders idle scene with no SSE (cbPath=null)"
  - "Pause button aria-label flips between floorPause ('Pause'/'Pause animations') and 'Resume'/'Resume animations' — not a separate label key"
metrics:
  duration: "~7 minutes"
  completed_date: "2026-04-22"
  tasks_completed: 3
  files_created: 9
  files_modified: 3
---

# Phase 11 Plan 04: Wave 3 Toolbar + Page Shell Summary

Wave 3 of Phase 11 Live Floor: top-nav FloorIcon, middleware /floor guard, server page shell, FloorClient orchestrator with dynamic FloorCanvas, FloorToolbar with 5 controls + re-auth banner. All 3 TDD tasks green; 169 Phase 11 tests passing.

## What Was Built

### components/shell/floor-icon.tsx — Top-Nav 🎮 Icon (D-19)

Mirrors `ChatPopOutIcon` exactly:

```typescript
export function FloorIcon(): JSX.Element;
```

- `next/link` to `/floor`
- `Gamepad2` lucide icon (size-4)
- 7x7 rounded hover target, text-muted → text transition
- `ExplainTooltip` with `labelFor(dev).floorExplainHub`
- `aria-label` + `title` from `labelFor(dev).floorPageTitle`
- `data-testid="floor-icon"`

### middleware.ts — Auth Guard Extended (D-17)

Matcher after edit:

```typescript
matcher: ["/plan/:path*", "/build/:path*", "/memory", "/metrics", "/floor", "/floor/:path*"]
```

Both `/floor` (exact) and `/floor/:path*` (sub-routes) now redirect unauthenticated users.

### components/floor/floor-toolbar.tsx — 5-Control Overlay (D-06, D-20)

Frozen signature for Plan 05:

```typescript
export interface FloorToolbarProps {
  paused: boolean;
  onTogglePause: () => void;
  popout: boolean;
  minimized?: boolean;
  onToggleMinimize?: () => void;
  /** Absolute project path for pop-out URL building. */
  projectPath: string | null;
  legendOpen: boolean;
  onToggleLegend: () => void;
  metrics: { effectsCount: number; queueSize: number; authDrifted: boolean };
}

export function FloorToolbar(props: FloorToolbarProps): JSX.Element;
```

Controls:

| # | Control | Condition | Behavior |
|---|---------|-----------|----------|
| 1 | Pause toggle | always | Flips `paused`; aria-label = `floorPause`/`Resume animations` |
| 2 | Minimize | `popout=true` only | `onToggleMinimize()`; `floorMinimize` label |
| 3 | Pop-out | `popout=false` only | `window.open(...)` (D-06); disabled when `projectPath=null` |
| 4 | Legend | always | `aria-pressed={legendOpen}`; `onToggleLegend()` |
| 5 | Re-auth banner | `authDrifted=true` | `role="alert"` with `floorAuthDriftNotice` copy |

**Pop-out window.open exact invocation (Plan 05 reuse):**

```typescript
window.open(
  "/floor?popout=1&project=" + encodeURIComponent(projectPath),
  "cae-live-floor",
  "width=960,height=720"
);
```

Dev-mode counter strip (hidden in founder mode):
```tsx
{dev && <span data-testid="floor-debug-strip">q:{queueSize} fx:{effectsCount}</span>}
```

### components/floor/floor-client.tsx — Client Orchestrator (D-18)

Frozen signature for Plan 05:

```typescript
export interface FloorClientProps {
  cbPath: string | null;
  projectPath: string | null;
  popout: boolean;
}

export default function FloorClient(props: FloorClientProps): JSX.Element;
```

Key implementation details:

```typescript
// Dynamic import — ssr: false (D-18)
const FloorCanvas = dynamic(() => import("./floor-canvas"), { ssr: false });

// State owned by FloorClient
const [paused, setPaused] = useState(false);
const [minimized, setMinimized] = useState(false);
const [metrics, setMetrics] = useState({ effectsCount: 0, queueSize: 0, authDrifted: false });

// Legend wired to global Explain mode (not local boolean)
const { explain, toggle: toggleExplain } = useExplainMode();

// Toolbar hidden when popout=true AND minimized=true
{!(popout && minimized) && <FloorToolbar ... />}

// Legend as floating aside when explain=ON (P11-07)
{explain && <aside className="absolute bottom-4 right-4 w-60 ..."><FloorLegend /></aside>}
```

### app/floor/page.tsx — Server Shell (D-10, D-11, D-17)

Page prop shape (Plan 05 inherits this):

```typescript
interface PageProps {
  searchParams: { project?: string; popout?: string };
}

export default async function FloorPage({ searchParams }: PageProps): Promise<JSX.Element>;
```

**Project resolution algorithm** (for Plan 05 — when inheriting from `?project=`):

1. If `searchParams.project` is truthy → use it directly (trusted path; `/api/tail` enforces ALLOWED_ROOTS)
2. Else: call `listProjects()` → filter to `shiftUpdated != null` → sort by `shiftUpdated` desc → pick `[0].path`
3. Else: fall back to `projects[0].path` (first project, any type)
4. Else: `null` (empty project list or `listProjects()` threw) → idle scene, no SSE

```typescript
// Layout class selection (D-11)
<main className={popout ? "h-screen" : "h-[calc(100vh-40px)]"}>
```

### New Label Key — floorAuthDriftNotice (added to labels.ts)

| Branch | Value |
|--------|-------|
| FOUNDER | `"Please sign in again in the main window"` |
| DEV | `"Session expired — re-auth in main window"` |

## Test Results

```
Phase 11 full sweep — Plans 01-04:
Test Files  14 passed (14)
     Tests  169 passed (169)

Per-plan breakdown:
  Plan 01 (Wave 0 pure-lib):   76 tests
  Plan 02 (Canvas render):     33 tests
  Plan 03 (Hook wiring):       36 tests (was 131 total including 01+02 regression)
  Plan 04 (Toolbar + Page):    38 tests (floor-icon:7, top-nav:2, toolbar:14, client:10, page:7)
```

## Commits

| Hash | Type | Message |
|------|------|---------|
| 82b7e04 | test RED | test(11-04): add failing tests for FloorIcon + top-nav mount |
| a381a6b | feat GREEN | feat(11-04): add FloorIcon + top-nav mount + middleware /floor guard |
| 2a261e9 | test RED | test(11-04): add failing tests for FloorToolbar |
| 5795cec | feat GREEN | feat(11-04): implement FloorToolbar with 5 controls + re-auth banner |
| 6aa0b2b | test RED | test(11-04): add failing tests for FloorClient + /floor page |
| f8c0add | feat GREEN | feat(11-04): add /floor page + FloorClient orchestrator |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing label key] floorAuthDriftNotice added to labels.ts**
- **Found during:** Task 2 implementation
- **Issue:** Plan 11-01 shipped 18 floor.* label keys but `floorAuthDriftNotice` was not in the set. The toolbar re-auth banner needs this key.
- **Fix:** Added `floorAuthDriftNotice` to the `Labels` interface + both FOUNDER and DEV branches.
- **Files modified:** `lib/copy/labels.ts`
- **Commit:** 5795cec

**2. [Rule 1 - Test path fix] lint-guard test used `import.meta.url` which jsdom resolves without drive prefix**
- **Found during:** Task 1 GREEN run
- **Issue:** `new URL("./floor-icon.tsx", import.meta.url).pathname` resolved to `/components/shell/floor-icon.tsx` (missing `/home/cae/ctrl-alt-elite/dashboard` prefix) in jsdom environment.
- **Fix:** Changed to `resolve("/home/cae/ctrl-alt-elite/dashboard/components/shell/floor-icon.tsx")` — absolute path avoids the jsdom URL resolution issue.
- **Files modified:** `floor-icon.test.tsx`
- **Commit:** a381a6b (included in GREEN commit after fix)

### Pre-existing Issues (Out of Scope)

- `lib/cae-ship.test.ts` 5 TS2345 errors (Project.hasPlanning missing in test mocks) — pre-existing since Plan 11-01.
- 5 empty test stubs (`cae-nl-draft.test.ts`, `cae-queue-state.test.ts`, `cae-workflows.test.ts`, `step-graph.test.tsx`, `api/workflows/route.test.ts`) report "No test suite found" — pre-existing since Phase 6.

## Known Stubs

None. All files are fully functional:

- `floor-icon.tsx` — real link with real icon, real labelFor wiring
- `floor-toolbar.tsx` — all 5 controls implemented with real window.open, real aria attributes
- `floor-client.tsx` — real dynamic import, real state, real FloorToolbar + FloorLegend wiring
- `app/floor/page.tsx` — real auth check, real project resolution, real FloorClient mount

The visual output is a real canvas rendered by Plans 01-03 infrastructure; Plan 11-04 provides the navigation + toolbar shell to reach it.

## Threat Surface Scan

T-11-03 (Spoofing — /floor?popout=1): Mitigated. `middleware.ts` now includes `/floor` and `/floor/:path*` in the auth matcher. `page.tsx` double-checks via `auth()` + redirect (belt-and-suspenders). Pop-out window opens same-origin only; no third-party content; session cookie inherited.

T-11-07 (Tapjacking — pop-out button): Mitigated. `window.open` called only from user gesture (click handler). No third-party content loaded; same-origin.

No new unregistered threat surfaces introduced.

## Self-Check: PASSED

Files exist at exact paths:
- dashboard/components/shell/floor-icon.tsx — FOUND
- dashboard/components/shell/floor-icon.test.tsx — FOUND
- dashboard/components/shell/top-nav.test.tsx — FOUND
- dashboard/components/floor/floor-toolbar.tsx — FOUND
- dashboard/components/floor/floor-toolbar.test.tsx — FOUND
- dashboard/components/floor/floor-client.tsx — FOUND
- dashboard/components/floor/floor-client.test.tsx — FOUND
- dashboard/app/floor/page.tsx — FOUND
- dashboard/app/floor/page.test.tsx — FOUND

All 6 task commits verified in git log: 82b7e04, a381a6b, 2a261e9, 5795cec, 6aa0b2b, f8c0add.
169/169 Phase 11 tests green. Zero TypeScript errors in new files (5 pre-existing in cae-ship.test.ts excluded). Zero dollar signs in all 4 new source files.
