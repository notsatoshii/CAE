# Phase 13 — Eric's direct critique of live FE (2026-04-23)

**Captured:** session 6 during Phase 10 planning dispatch. Eric is actively using the dashboard at http://165.245.186.254:3002.

## Reported defects

1. **Data displays broken** — "basically nothing is working properly in terms of data displays"
2. **Details incorrect** — emphasized twice, so probably multiple fields showing wrong values across multiple panels
3. **Data not live** — polling/SSE/cache staleness somewhere; users see snapshots, not current state
4. **UI too basic, not intuitive** — IA, affordances, and discoverability are weak
5. **Design mid at best** — visual language below where it needs to be
6. **Functionality partial** — features shipped but not fully wired
7. **Logs suck** — dev observability for debugging lacks

## What this means for Phase 13 scope

The original Phase 13 spec (see `phase13_ui_polish.md` memory) was **6-pillar visual audit** — Playwright screenshots → Opus 4.7 vision review → fix plan → re-audit.

**Expand scope to 4 pillars before 6:**

1. **DATA CORRECTNESS** — for each panel, screenshot + verify shown numbers against source files (`.cae/metrics/*.jsonl`, `.shift/state.json`, git log, `.planning/ROADMAP.md`). Flag every mismatch.
2. **LIVENESS** — for each time-sensitive display (cost ticker, heartbeat, queue, changes), measure polling frequency, SSE subscription status, and compare timestamps vs reality.
3. **FUNCTIONALITY COMPLETENESS** — for each interactive control (buttons, forms, drawers, modals), click through and record what actually fires vs what's expected per UI-SPEC.
4. **LOGGING / DEBUG** — inspect browser DevTools console, server stdout, cost-ticker events, SSE streams for noise/errors/gaps. Recommend structured logging where absent.

THEN proceed to the original 6 visual pillars (hierarchy, density, consistency, motion, typography, color).

## Expected first-audit findings

Given Eric's baseline critique ("F/D → should be A"), expect top-3 blockers to be:
- One or more aggregators emitting stale/mock/wrong data to displays
- At least one SSE stream silently dropped (similar to Phase 7 schema drift bug)
- Multiple buttons that no-op or throw on click but swallow the error

**Do not score these as "nice polish" — score as P0 correctness bugs.**

## Files that need the most scrutiny

Based on session 7/8/9 ship velocity, code most likely to have bugs:
- `lib/cae-metrics-state.ts` + cost-ticker flow (schema drift caught once, may be more)
- `lib/cae-changes-state.ts` aggregator (Phase 9, brand-new)
- `lib/cae-chat-state.ts` session mgmt (Phase 9, brand-new)
- `lib/cae-home-state.ts` (Phase 4, probably most-broken per Eric: "data displays")
- All `/build/*` pages' data hydration
- Heartbeat / liveness / presence indicators
