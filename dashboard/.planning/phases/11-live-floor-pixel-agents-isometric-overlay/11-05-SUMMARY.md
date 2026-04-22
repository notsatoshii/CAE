---
phase: 11-live-floor-pixel-agents-isometric-overlay
plan: "05"
subsystem: app/floor + components/floor + lib/copy
tags: [wave-4, popout, route, layout, tdd, d-06, d-10, d-17]
dependency_graph:
  requires:
    - components/floor/floor-client.tsx (FloorClientProps) — Plan 11-04
    - components/floor/floor-toolbar.tsx (FloorToolbarProps) — Plan 11-04
    - app/floor/page.tsx (project resolution algorithm) — Plan 11-04
    - lib/floor/cb-path.ts (resolveCbPath) — Plan 11-03
    - lib/copy/labels.ts (floor.* keyset) — Plan 11-01
    - middleware.ts (/floor/:path* matcher) — Plan 11-04
  provides:
    - app/floor/popout/page.tsx (dedicated /floor/popout route — auth + project + chrome CSS)
    - app/floor/layout.tsx (shared floor layout, minimal pass-through)
    - components/floor/floor-popout-host.tsx (FloorPopoutHost — title + resize + Escape-to-close)
    - components/floor/floor-client.tsx (+ return-to-main-window button)
    - lib/copy/labels.ts (floorReturnToMain key added)
  affects:
    - Phase 13 (UI audit) — chrome-suppression CSS must be noted; return-to-main button visible in popout
tech_stack:
  added: []
  patterns:
    - TDD red→green per task (3 tasks x 2 commits = 6 atomic commits)
    - Route-scoped CSS for chrome suppression (dangerouslySetInnerHTML with static literal — Q1 Option C)
    - SSR-safe opener detection via useEffect + useState
    - Escape-to-close keybind bound only when window.opener != null (T-11-08)
    - document.title save/restore pattern (prevTitle in useEffect cleanup)
key_files:
  created:
    - dashboard/app/floor/layout.tsx
    - dashboard/app/floor/layout.test.tsx
    - dashboard/app/floor/popout/page.tsx
    - dashboard/app/floor/popout/page.test.tsx
    - dashboard/components/floor/floor-popout-host.tsx
    - dashboard/components/floor/floor-popout-host.test.tsx
  modified:
    - dashboard/components/floor/floor-client.tsx (hasOpener state + return-to-main button)
    - dashboard/components/floor/floor-client.test.tsx (tests 11+12 added)
    - dashboard/components/floor/floor-toolbar.tsx (pop-out URL switched to /floor/popout?project=)
    - dashboard/components/floor/floor-toolbar.test.tsx (test 3 assertion updated)
    - dashboard/lib/copy/labels.ts (floorReturnToMain added to interface + FOUNDER + DEV)
decisions:
  - "Chrome suppression uses route-scoped <style dangerouslySetInnerHTML> with static literal CSS — no user content interpolated; safe and reversible (Q1 Option C). TopNav aria-hidden also set on mount by FloorPopoutHost for a11y."
  - "Escape-to-close only binds when window.opener != null — prevents accidentally closing a bookmarked /floor/popout tab opened directly (T-11-08)"
  - "hasOpener detected via useEffect in FloorClient — no new prop needed; SSR-safe"
  - "floorReturnToMain added to labels.ts: FOUNDER 'Back to main window', DEV 'Return to main window'"
  - "FloorPopoutHostProps frozen: { cbPath: string | null; projectPath: string | null } — no additional props needed; popout=true is always forced internally"
  - "No postMessage / BroadcastChannel anywhere in Phase 11 — D-06 confirmed clean"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-04-23"
  tasks_completed: 3
  files_created: 6
  files_modified: 5
---

# Phase 11 Plan 05: Wave 4 Pop-out Route + Ergonomics Summary

Wave 4 of Phase 11 Live Floor: dedicated `/floor/popout` route, shared floor layout, FloorPopoutHost with window ergonomics (title, resize, Escape-to-close), return-to-main button in FloorClient. All 3 TDD tasks green; 189 Phase 11 tests passing across 18 test files. Final plan of Phase 11.

## What Was Built

### app/floor/layout.tsx — Shared Floor Layout

Minimal pass-through layout for both `/floor` and `/floor/popout`:

```typescript
export default function FloorLayout({ children }: { children: React.ReactNode }): JSX.Element;
```

Exists as a route boundary — allows `/floor/popout` to scope its chrome-suppression CSS without touching `app/layout.tsx`. No TopNav injected here.

### app/floor/popout/page.tsx — Dedicated Pop-out Route (D-06, D-10, D-17)

```typescript
interface PageProps { searchParams: { project?: string } }
export default async function FloorPopoutPage({ searchParams }: PageProps): Promise<JSX.Element>;
```

Key behaviors:
- Auth gate identical to `/floor` (middleware + page-level `auth()` + redirect to `/signin?from=/floor/popout`)
- Project resolution: explicit `searchParams.project` → most-recent Shift project → first project → null
- Always mounts `FloorPopoutHost` (popout=true forced internally — no `?popout=1` query param needed)
- Emits route-scoped `<style>` hiding `header[data-testid="top-nav"]` via `display: none !important` (Q1 Option C)

**Chrome suppression mechanism (for Phase 13 UI audit):** A `<style dangerouslySetInnerHTML>` tag with a static CSS literal is rendered inside the `/floor/popout` page JSX. React mounts/unmounts it with the route — no global side-effect. The string is a compile-time constant (no user data interpolated). `FloorPopoutHost` additionally sets `aria-hidden="true"` on the TopNav element on mount for accessibility.

### components/floor/floor-popout-host.tsx — Window Ergonomics (D-06)

```typescript
export interface FloorPopoutHostProps {
  cbPath: string | null;
  projectPath: string | null;
}
export function FloorPopoutHost(props: FloorPopoutHostProps): JSX.Element;
export default FloorPopoutHost;
```

Behaviors on mount:
1. Saves `prevTitle = document.title`; sets `document.title = L.floorPageTitle + " — pop out"`; restores on unmount
2. When `window.opener != null`: calls `window.resizeTo(960, 720)` (best-effort; browsers may ignore); sets TopNav `aria-hidden="true"`
3. When `window.opener != null`: binds Escape keydown to `window.opener.focus() + window.close()` — listener removed on unmount

Renders `<FloorClient cbPath={cbPath} projectPath={projectPath} popout={true} />` — popout=true is always forced.

### components/floor/floor-client.tsx — Return-to-Main Button (MODIFIED)

New addition inside `FloorClient`:

```typescript
// SSR-safe opener detection
const [hasOpener, setHasOpener] = useState(false);
useEffect(() => {
  if (typeof window !== "undefined") setHasOpener(window.opener != null);
}, []);

// Rendered when popout && hasOpener && !minimized
<button onClick={returnToMain} aria-label={L.floorReturnToMain}>
  {L.floorReturnToMain}
</button>
```

No new prop added — opener detection is internal. The `FloorClientProps` interface is unchanged from Plan 04.

### components/floor/floor-toolbar.tsx — Pop-out URL Updated (MODIFIED)

Pop-out button URL changed from `/floor?popout=1&project=X` to `/floor/popout?project=X`:

```typescript
window.open(
  "/floor/popout?project=" + encodeURIComponent(projectPath),
  "cae-live-floor",
  "width=960,height=720"
);
```

### Final Phase 11 Route Map

| Route | Auth | Chrome | Purpose |
|-------|------|--------|---------|
| `/floor` | middleware + page auth() | Full (TopNav from root layout) | Main window — primary use |
| `/floor/popout` | middleware + page auth() | Suppressed (CSS display:none + aria-hidden) | Second-monitor pop-out window |

Both routes use `app/floor/layout.tsx` (shared, minimal). Both are guarded by `middleware.ts` matcher `/floor/:path*` (from Plan 04, unchanged).

### New Label Key — floorReturnToMain

| Branch | Value |
|--------|-------|
| FOUNDER | `"Back to main window"` |
| DEV | `"Return to main window"` |

Phase 13 polish pass will pick this up.

## Test Results

```
Phase 11 full sweep — Plans 01-05:
Test Files  18 passed (18)
     Tests  189 passed (189)

Per-plan breakdown:
  Plan 01 (Wave 0 pure-lib):    76 tests
  Plan 02 (Canvas render):      33 tests
  Plan 03 (Hook wiring):        36 tests
  Plan 04 (Toolbar + Page):     38 tests (was 169 total)
  Plan 05 (Pop-out route):      20 tests (layout:2, popout-page:5, popout-host:9, floor-client:+2, toolbar:test-updated)
```

## Commits

| Hash | Type | Message |
|------|------|---------|
| 276e282 | test RED | test(11-05): add failing tests for /floor/popout route + update toolbar URL assertion |
| a7c7720 | feat GREEN | feat(11-05): add /floor/popout route + layout + toolbar URL update |
| a79e7a7 | test RED | test(11-05): add failing tests for FloorPopoutHost |
| f7b537a | feat GREEN | feat(11-05): add FloorPopoutHost with title + resize + Escape-to-close |
| ce012f1 | test RED | test(11-05): add failing tests for return-to-main-window affordance |
| 65445e0 | feat GREEN | feat(11-05): add return-to-main-window button in FloorClient |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing label key] floorReturnToMain added to labels.ts**
- **Found during:** Task 3 setup
- **Issue:** Plan 11-01 shipped 18 floor.* label keys; `floorReturnToMain` was not in the set. The return-to-main button needs this key.
- **Fix:** Added to `Labels` interface + FOUNDER branch ("Back to main window") + DEV branch ("Return to main window").
- **Files modified:** `lib/copy/labels.ts`
- **Commit:** ce012f1 (RED commit, included with test changes)

**2. [Rule 3 - Blocking import] Stub floor-popout-host.tsx created in Task 1 GREEN**
- **Found during:** Task 1 GREEN run
- **Issue:** `app/floor/popout/page.tsx` imports `@/components/floor/floor-popout-host` but that file didn't exist yet (Task 2 creates it). Vite resolves real imports even when vi.mock() is set — the test suite errored before tests could run.
- **Fix:** Created a minimal stub `floor-popout-host.tsx` in the Task 1 GREEN commit, then replaced it with the full implementation in Task 2 GREEN.
- **Files modified:** `components/floor/floor-popout-host.tsx` (stub → real)
- **Commit:** a7c7720 (stub), f7b537a (full implementation)

### Pre-existing Issues (Out of Scope)

- `lib/cae-ship.test.ts` 5 TS2345 errors (Project.hasPlanning missing in test mocks) — pre-existing since Plan 11-01.

## Known Stubs

None. All files are fully functional:

- `app/floor/layout.tsx` — real pass-through layout; route boundary for CSS scoping
- `app/floor/popout/page.tsx` — real auth gate, real project resolution, real chrome suppression
- `components/floor/floor-popout-host.tsx` — real title/resize/Escape logic; not a placeholder
- `components/floor/floor-client.tsx` — real hasOpener detection, real return-to-main button

## Threat Surface Scan

T-11-03-b (Spoofing — /floor/popout): Mitigated. Middleware `/floor/:path*` covers the new route. `page.tsx` double-checks via `auth()` + redirect. Pop-out window is same-origin only; no third-party content.

T-11-08 (Unintended action — Escape-to-close): Mitigated. Escape listener only bound when `window.opener != null`. Direct navigation / bookmarked URL → `window.opener === null` → keybind disabled → user's tab is safe.

No new unregistered threat surfaces introduced.

## D-06 Compliance Confirmation

Zero `postMessage` or `BroadcastChannel` calls anywhere in the Phase 11 codebase. Pop-out window communicates with parent only via `window.opener.focus()` and `window.close()` — both are the only permitted cross-window calls per D-06.

## Self-Check: PASSED

Files exist at exact paths:
- dashboard/app/floor/layout.tsx — FOUND
- dashboard/app/floor/layout.test.tsx — FOUND
- dashboard/app/floor/popout/page.tsx — FOUND
- dashboard/app/floor/popout/page.test.tsx — FOUND
- dashboard/components/floor/floor-popout-host.tsx — FOUND
- dashboard/components/floor/floor-popout-host.test.tsx — FOUND

All 6 task commits verified in git log: 276e282, a7c7720, a79e7a7, f7b537a, ce012f1, 65445e0.
189/189 Phase 11 tests green across 18 test files. Zero TypeScript errors in new files. Zero dollar signs in all new source files.

Phase 11 total commits (Plans 01-05): 26 atomic commits.
