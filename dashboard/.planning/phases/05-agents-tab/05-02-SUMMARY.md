---
phase: 05-agents-tab
plan: 02
subsystem: ui
tags: [navigation, left-rail, next-app-router, lucide-react, layout]

# Dependency graph
requires:
  - phase: 03-design-system-foundation
    provides: dark-theme tokens (--accent, --surface, --border, --text-muted), cn() helper, Tailwind v4 setup
  - phase: 04-build-home-rewrite
    provides: existing /build layout + page that must continue to render under new rail
provides:
  - BuildRail client component (48px icon-only left-rail, 5 tabs, usePathname active detection)
  - /build/* flex-row layout wrapping rail + main content
  - /build/workflows stub (Phase 6 placeholder)
  - /build/changes stub (Phase 9 placeholder)
affects: [05-03-agents-grid, 06-workflows, 09-changes-ledger, all-future-build-pages]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Left-rail shell component under components/shell/, mounted in app/build/layout.tsx"
    - "Stub-route pattern: tiny server component with data-testid anchor + phase-reference copy"
    - "Active-tab detection: exact match for /build root, prefix+slash match for sub-routes"

key-files:
  created:
    - dashboard/components/shell/build-rail.tsx
    - dashboard/app/build/workflows/page.tsx
    - dashboard/app/build/changes/page.tsx
  modified:
    - dashboard/app/build/layout.tsx

key-decisions:
  - "Used Lucide Inbox (not Package) for Queue — matches existing CAE 'inbox/outbox' language in lib/cae-state.ts"
  - "Home tab only active on pathname === '/build', not when on sub-routes — prevents always-active Home"
  - "Rail rendered in app/build/layout.tsx (below global TopNav), not in root layout — scopes rail to Build mode only"
  - "Stub pages are plain server components with no data/effects — deliberately minimal placeholders"
  - "Inline color tokens via var(--token, #fallback) rather than Tailwind class-only — matches Phase 3 build-home pattern so rail renders even if a CSS var is missing"

patterns-established:
  - "Rail component pattern: client component, usePathname from next/navigation, map over locked TABS tuple with Link+Icon, data-testid on nav + each link, data-active + aria-current on active"
  - "Active-detection helper: isActive(href) with exact-match for root, prefix-with-slash for sub-routes"
  - "Build-layout flex-row pattern: min-h-[calc(100vh-40px)] container, rail shrink-0, main flex-1 min-w-0 overflow-auto"

requirements-completed: [agents-03-left-rail, agents-08-stub-routes]

# Metrics
duration: ~12min
completed: 2026-04-22
---

# Phase 05 Plan 02: Left-rail navigation + Workflows/Changes stubs Summary

**48px icon-only BuildRail (Home · Agents · Workflows · Queue · Changes) mounted in app/build/layout.tsx with usePathname active detection, plus stub routes for Workflows (Phase 6) and Changes (Phase 9).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-22T05:12Z
- **Completed:** 2026-04-22T05:24Z
- **Tasks:** 3
- **Files modified:** 4 (3 created, 1 rewritten)
- **Total lines added:** 147

## Accomplishments

- Permanent left-rail ships ahead of /build/agents (Plan 05-03) so the new route lands next to fully-wired navigation
- All 5 UI-SPEC §2 tabs present with correct Lucide icons, locked order, cyan accent styling
- Legacy text-link `<nav>` (Overview / Queue) removed from app/build/layout.tsx
- /build/workflows and /build/changes routes no longer 404 — both render phase-reference copy
- Phase 4 build home (/build), Phase 2 queue (/build/queue), and phase detail routes all still compile and render
- `pnpm tsc --noEmit` clean · `pnpm build` emits /build, /build/queue, /build/workflows, /build/changes, /build/phase/[num]

## Task Commits

Each task committed atomically:

1. **Task 1: BuildRail client component** — `ade0969` (feat)
2. **Task 2: Rewrite app/build/layout.tsx with rail + flex layout** — `4537265` (feat)
3. **Task 3: Stub pages for /build/workflows and /build/changes** — `d745427` (feat)

## Files Created/Modified

- `dashboard/components/shell/build-rail.tsx` (72 lines, NEW) — 48px client-component left-rail, 5 Lucide tabs, usePathname active detection with exact-match Home rule, aria-label/aria-current/data-testid/data-active on every link, cyan accent left-border + tinted bg for active state.
- `dashboard/app/build/layout.tsx` (25 lines, REWRITTEN from 21) — imports BuildRail, renders `<div className="flex min-h-[calc(100vh-40px)] w-full"><BuildRail /><div className="flex-1 min-w-0 overflow-auto">{children}</div></div>`. Legacy Overview/Queue `<nav>` removed.
- `dashboard/app/build/workflows/page.tsx` (25 lines, NEW) — server-component stub, metadata title "Workflows — Coming in Phase 6", data-testid="workflows-stub", chat-drafted-routines teaser copy.
- `dashboard/app/build/changes/page.tsx` (25 lines, NEW) — server-component stub, metadata title "Changes — Coming in Phase 9", data-testid="changes-stub", plain-English-timeline teaser copy.

## Lucide Icon Selection

| Tab       | Lucide icon   | UI-SPEC emoji hint | Rationale                                                                                  |
| --------- | ------------- | ------------------ | ------------------------------------------------------------------------------------------ |
| Home      | `Home`        | ⌂                  | direct match                                                                               |
| Agents    | `Users`       | 👥                 | direct match (matches multi-agent team concept)                                            |
| Workflows | `Zap`         | ⚡                 | direct match (speed + automation)                                                          |
| Queue     | `Inbox`       | 📦                 | chose `Inbox` over `Package` — matches CAE's existing inbox/outbox language in cae-state.ts |
| Changes   | `ScrollText`  | 📜                 | direct match (scroll of history / changelog)                                               |

All icons sized at 20px per UI-SPEC §13.

## Active-Tab Detection Rule

```ts
function isActive(href: string): boolean {
  if (href === "/build") return pathname === "/build"
  return pathname === href || pathname.startsWith(href + "/")
}
```

- `/build` is **only** active when pathname is exactly `/build` — prevents Home showing active on sub-routes like `/build/agents`.
- All other tabs active when pathname === href OR pathname.startsWith(href + "/") — future nested routes like `/build/agents/forge` will correctly keep Agents highlighted.

## Route Verification

Route manifest from `pnpm build`:
```
ƒ /build
ƒ /build/changes          ← NEW this plan
ƒ /build/phase/[num]
ƒ /build/queue
ƒ /build/workflows        ← NEW this plan
```

Runtime curl (dev server on :3002, unauthenticated) — all four return 307 → `/signin?from=<route>` (auth-gated, not 404):
- `/build` → 307 → `/signin?from=%2Fbuild`
- `/build/queue` → 307 → `/signin?from=%2Fbuild%2Fqueue`
- `/build/workflows` → 307 → `/signin?from=%2Fbuild%2Fworkflows`
- `/build/changes` → 307 → `/signin?from=%2Fbuild%2Fchanges`

Per plan's success criteria ("307 to signin is acceptable as 'not 404'"), this confirms all routes exist and will return 200 once authenticated.

## Accessibility Notes

- Rail `<nav>` has `aria-label="Build navigation"` — gives screen readers a distinct landmark from the global TopNav header.
- Each tab link carries both `aria-label={tab.label}` (for screen readers) and `title={tab.label}` (for pointer tooltips on hover).
- Active tab has `aria-current="page"` (standard WAI-ARIA pattern for navigation current-location indication).
- `data-active="true|false"` duplicates the active signal for test / visual-regression tooling that doesn't want to rely on className diffs.
- Cyan accent is reinforced with a left-border bar in addition to color — accessible for users with reduced color perception because the active state has both color and shape affordance.
- Focus outlines inherit Tailwind / browser defaults on `<Link>` — Phase 3 established global focus-ring tokens, so no per-component focus styling needed.

## Decisions Made

1. **Rail mounted in `app/build/layout.tsx`, not root layout** — rail is scoped to Build mode only. Plan mode / global routes get the TopNav but not the rail. Matches UI-SPEC §2 where the rail is a Build-mode affordance.
2. **Inlined color tokens with var() fallbacks** — `bg-[color:var(--surface,#121214)]` instead of plain `bg-surface`. Matches Phase 3 build-home components; guarantees rail renders correctly even in isolation (Storybook, future testing harnesses).
3. **Stub pages as pure server components** — no "use client", no data fetching, no loading states. They are deliberately minimal until their owning phases (6, 9) replace them.
4. **Same generic div-shell for both stubs** — matches copy structure: h1 (title) + p (phase-reference blurb) + bordered empty-state card pointing back to Home/Agents. Uses identical token palette, so visual consistency is free when the real Workflows / Changes ship.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. This is a pure frontend navigation / layout plan.

## Next Phase Readiness

**Ready for Plan 05-03 (Agents grid page).** The Agents rail tab is wired and will activate the moment `/build/agents` lands. The `usePathname` active-detection logic already handles sub-routes like `/build/agents/[name]` (if 05-03 adds a detail-by-URL pattern) — no rail changes needed.

**No blockers.** Concurrency check: 05-01 (data layer) and 05-02 (shell) touch disjoint files (API + lib + sparkline vs shell + layout + stub pages). Both landed on main in Wave 1 with zero conflicts. 05-03 and 05-04 can begin.

## Self-Check: PASSED

- FOUND: dashboard/components/shell/build-rail.tsx
- FOUND: dashboard/app/build/layout.tsx (modified)
- FOUND: dashboard/app/build/workflows/page.tsx
- FOUND: dashboard/app/build/changes/page.tsx
- FOUND commit: ade0969 (Task 1)
- FOUND commit: 4537265 (Task 2)
- FOUND commit: d745427 (Task 3)
- pnpm tsc --noEmit: clean
- pnpm build: success, route manifest includes /build/workflows + /build/changes
- curl /build/workflows: 307 → /signin (not 404 — route exists, auth-gated per plan success criteria)
- curl /build/changes: 307 → /signin (not 404 — route exists, auth-gated per plan success criteria)

---
*Phase: 05-agents-tab*
*Completed: 2026-04-22*
