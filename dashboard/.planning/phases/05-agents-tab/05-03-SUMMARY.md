---
phase: 05-agents-tab
plan: 03
subsystem: ui
tags: [agents, grid, card, sparkline, url-state, next-app-router, react-client, tailwind]

# Dependency graph
requires:
  - phase: 03-design-system-foundation
    provides: dark-theme tokens, cn() helper, Tailwind v4, Card primitive, DevModeProvider + useDevMode hook
  - phase: 04-build-home-rewrite
    provides: agent-meta canonical table, labelFor() translation seam, url-state click pattern (active-phase-cards.tsx)
  - phase: 05-agents-tab (Plan 05-01)
    provides: getAgentsRoster() aggregator, AgentRosterEntry type, agents.* copy keys, Sparkline primitive
  - phase: 05-agents-tab (Plan 05-02)
    provides: /build layout with BuildRail left nav — surrounds /build/agents at render
provides:
  - AgentCard client component (200x280, active + dormant variants, url-state click)
  - AgentGrid client component (grouped sections, locked order, responsive 1/2/3 cols)
  - /build/agents route (server component, force-dynamic, direct aggregator call)
  - AgentsPageHeading client island (founder/dev heading flip)
affects: [05-04-agents-drawer, 06-workflows, 09-changes-ledger, any-future-agent-listing-surface]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Grid route = server page (force-dynamic) + tiny client-island heading + client grid/card"
    - "Server page calls aggregator directly (not self-fetch to /api/agents) → shared cache bonus"
    - "Card uses role=button on div (not nested <button>) so future drawer trigger a11y stays clean"
    - "URL-state click pattern reused from Phase 4 active-phase-cards: router.push(pathname + '?' + params.set('agent', name))"
    - "Group-and-render: single pass groups roster by AgentRosterEntry.group, GROUP_ORDER tuple locks visual order, empty groups hidden"

key-files:
  created:
    - dashboard/components/agents/agent-card.tsx
    - dashboard/components/agents/agent-grid.tsx
    - dashboard/components/agents/agents-page-heading.tsx
    - dashboard/app/build/agents/page.tsx
  modified: []

key-decisions:
  - "Grid breakpoints: 1 col mobile, 2 cols md (≥768px), 3 cols xl (≥1280px) — matches UI-SPEC §6 '2-3 columns responsive' and Tailwind's default md/xl tokens so no custom breakpoints needed"
  - "Tokens stat shows `tokens_total` (7d total) via formatK helper, not the per-hour average — more meaningful as a summary number; the sparkline still carries the per-hour trend shape"
  - "Stats block uses fixed widths (label w-24, sparkline 90px, value w-12) to keep the three rows aligned column-wise; alternative (flexible columns) made values zig-zag"
  - "Dormant variant replaces the entire stats block but keeps the footer row (active/queued/24h counts) rendered — copy still reads 0 active · 0 queued · 0/day cleanly, and hiding the footer on dormant would make dormant cards visibly shorter and the grid jagged"
  - "Concurrency dots capped at 4 with +N overflow glyph (matches pattern in UI-SPEC §6 card-ASCII); dot max tunable via single max constant"
  - "Card is role=button div, not nested <button>, because Plan 05-04's drawer Sheet trigger will be inside the card — button-within-button is an a11y violation per ARIA spec"

patterns-established:
  - "Agent-card anatomy: header(emoji+label+concurrency) | subtitle(founder_label|model) | divider | stats|idle | divider | footer(counts) | drift-badge"
  - "Helper co-location: StatRow / ConcurrencyDots / formatK / dayOfWeekFrom kept in the same file as AgentCard — private to the card surface, not exported"
  - "Agent grid grouping: pre-allocate per-group arrays, single-pass classify, render GROUP_ORDER.map with empty-group skip"

requirements-completed: [agents-01-grid-page, agents-02-card-anatomy, agents-05-grouping, agents-06-idle-variant]

# Metrics
duration: ~5min
completed: 2026-04-22
---

# Phase 05 Plan 03: Agents grid page Summary

**`/build/agents` server route renders a grouped grid of all 9 AgentCards (active/recently_used/dormant) with founder/dev copy flip, sparkline stats, and URL-state click (`?agent={name}`) primed for the Plan 05-04 drawer.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-22T05:26:51Z
- **Completed:** 2026-04-22T05:31:44Z
- **Tasks:** 3 (all type=auto, fully autonomous)
- **Files created:** 4
- **Total lines added:** 415

## Accomplishments

- `/build/agents` route now compiles and renders; `pnpm build` emits it in the route manifest alongside `/build`, `/build/queue`, `/build/phase/[num]`, etc.
- All 9 agents from `AGENT_META` surface in the grid via `getAgentsRoster()` (called directly server-side, no self-HTTP hop)
- Card click sets `?agent={name}` URL state today; Plan 05-04 will mount the detail drawer on that state with zero changes to the card
- Founder↔dev copy flip verified end-to-end: headline (label vs LABEL), subtitle (founder_label vs model chip), stat labels ("tokens / hour" vs "tok/hr"), group headers ("Working now (N)" vs "Active (N)"), idle line ("inactive Nd · last run Mon" vs "inactive Nd · last Mon"), failed-to-load copy
- Dormant variant wired: cards where `agent.group === "dormant"` render the idle line instead of the stats block; `agentsIdleLine(days, day)` / `agentsIdleNever` copy both paths covered
- Drift badge renders when `agent.drift_warning === true`; the bigger banner copy stays in the drawer per CONTEXT split

## Task Commits

Each task committed atomically on main:

1. **Task 1: AgentCard (active + idle variants)** — `990fe68` (feat)
2. **Task 2: AgentGrid (grouped responsive layout)** — `d2cab36` (feat)
3. **Task 3: /build/agents page + AgentsPageHeading island** — `302a0cd` (feat)

## Files Created/Modified

Created:
- `dashboard/components/agents/agent-card.tsx` (246 lines) — 200×280 card, two variants, URL-state click, concurrency dots, drift badge, Enter/Space keyboard
- `dashboard/components/agents/agent-grid.tsx` (89 lines) — grouped layout, locked order active→recently_used→dormant, empty-group hide, error state
- `dashboard/components/agents/agents-page-heading.tsx` (24 lines) — tiny client island for founder↔dev h1 flip
- `dashboard/app/build/agents/page.tsx` (56 lines) — server component, force-dynamic, direct `getAgentsRoster()` call, caught aggregator failure → `loadError` prop

## Responsive Grid Breakpoints

- **mobile (<768px):** `grid-cols-1`
- **md (≥768px):** `grid-cols-2`
- **xl (≥1280px):** `grid-cols-3`

Rationale: UI-SPEC §6 specifies "2-3 columns responsive" for the agent grid; the md/xl Tailwind defaults align with the standard Build-route widths (the left-rail is 48px, so main content typically has ~720/1232px of width at md/xl). No custom breakpoint needed; sticking with Tailwind defaults keeps this consistent with Phase 4 card layouts.

## Decisions Made

See frontmatter `key-decisions` for the full list. Most impactful:

1. **Grid breakpoints = Tailwind defaults** (not custom). One source of truth across Build routes.
2. **Tokens stat = 7d total (not per-hour average).** Per-hour lived only on the sparkline shape; the numeric label now reads something a founder actually cares about ("12k tokens this week").
3. **Dormant keeps footer row.** Rendering the footer even for zero-activity agents keeps dormant cards the same height as active cards → grid doesn't jag.
4. **Card is a `<div role="button">`, not `<button>`.** Plan 05-04's Sheet trigger must nest inside the card without producing a button-in-button a11y violation.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

**Smoke test: middleware 307 on unauthenticated request.** Running `curl http://localhost:PORT/build/agents` against a fresh `pnpm start` returns HTTP 307 redirecting to `/signin?from=%2Fbuild%2Fagents` (expected — `middleware.ts` gates every `/build/*` path before routing). This is acknowledged in the plan's success criteria: "returns 200 (or auth 307)". Confirmed via:

- `pnpm build` emitted `ƒ /build/agents` in the App routes manifest
- Route chunks `.next/server/app/build/agents/page.js` + `page_client-reference-manifest.js` generated
- Client testid strings (`agent-card-`, `agent-grid-error`, `AgentsPageHeading`) present in bundled `.next/static/chunks/*.js` and SSR chunks

Because no test session is available in this environment (GitHub OAuth only), rendered HTML couldn't be asserted via grep. The ask to snapshot a card's HTML for forge + scribe is therefore deferred to the Plan 05-04 execution session (where a drawer-state test harness naturally requires an authenticated session).

## Self-Check: PASSED

Verified claims:
- `/home/cae/ctrl-alt-elite/dashboard/components/agents/agent-card.tsx` FOUND
- `/home/cae/ctrl-alt-elite/dashboard/components/agents/agent-grid.tsx` FOUND
- `/home/cae/ctrl-alt-elite/dashboard/components/agents/agents-page-heading.tsx` FOUND
- `/home/cae/ctrl-alt-elite/dashboard/app/build/agents/page.tsx` FOUND
- commit `990fe68` FOUND in `git log`
- commit `d2cab36` FOUND in `git log`
- commit `302a0cd` FOUND in `git log`
- `pnpm tsc --noEmit` exited 0 at each task
- `pnpm build` succeeded; `/build/agents` in route manifest

## Next Phase Readiness

- URL state `?agent={name}` is set by card click today with no visible effect → Plan 05-04 reads that state, fetches `/api/agents/[name]`, and mounts the Sheet drawer. All drawer-side work remains isolated from this plan's shipped components.
- `data-testid` anchors emitted: `agents-page`, `agents-page-heading`, `agents-page-empty`, `agent-grid`, `agent-grid-error`, `agent-group-{active|recently_used|dormant}`, `agent-card-{name}`, `agent-card-{name}-{headline|subtitle|stats|idle|concurrency|drift-indicator}`.
- `AgentsPageHeading` client island pattern can be reused by Plan 05-04 if the drawer gains its own founder/dev-flipped title outside the Sheet content.

---
*Phase: 05-agents-tab*
*Completed: 2026-04-22*
