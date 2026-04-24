---
phase: 17
plan: W2-rollup-strip-b1
wave: 2
name: Fix B1 — rollup strip shows "shipped 0" despite API returning shipped_today=22
---

# W2 — B1 rollup-strip stuck at zero

## Context

Carried forward from Session 14 HANDOFF + re-confirmed by C5 audit: `/build` truth pillar scores 1.4 on laptop, 9/14 keys match on mobile/wide. Live API test passes; DOM renders zeros.

Live smoke truth:
- `GET /api/state` → `rollup: { shipped_today: 22, tokens_today: 27939, in_flight: 0, blocked: 0, warnings: 0 }` ✅
- DOM text on `/build`: `"shipped 0 nominal in-flight 0 nominal warnings 0 nominal blocked 0 nominal tok 0 nominal"` ❌

## Task

<task>
<name>Wire rollup strip to real API data; default-zero fallback is masking the bug</name>

<files>
components/build-home/rollup-strip.tsx
components/build-home/rollup-strip.test.tsx
hooks/use-state-poll.ts
hooks/use-state-poll.test.ts
app/api/state/route.ts
</files>

<action>
1. Read `components/build-home/rollup-strip.tsx:98-109` to confirm current data-path wiring.
2. Read `hooks/use-state-poll.ts` — is it actually polling in production? Check for dev-mode-only gating, session-cookie gating, or a race where `data` is `undefined` on first render AND Playwright captures before second render fires.
3. Add a Suspense-boundary or isRequired pattern: rollup-strip should either show a skeleton while `data === undefined` OR inherit from the nearest SSR payload. Never show zeros as a "fallback" — zeros are valid rollup values and indistinguishable from "not yet loaded".
4. If `useStatePoll` is the bug: add a `<StatePollProvider>` at layout level that prefetches state on mount + holds it in a context. Children then `useContext(StatePollContext)` synchronously.
5. If the bug is dev-mode HMR staleness: reload-test repeatedly, add a test that renders rollup-strip against a mocked `useStatePoll` that returns `{ shipped_today: 22 }` — assert DOM text contains "22", not "0".
6. Ensure `data-truth` for `rollup.shipped-today` + `rollup.healthy` matches the fixture/healthy expected keys.
</action>

<verify>
1. Open http://localhost:3002/build → rollup strip shows non-zero values (shipped 22, tokens 27k, etc) matching `GET /api/state`.
2. `pnpm vitest run components/build-home/rollup-strip` — all green.
3. Re-run audit capture. Truth pillar on /build must score ≥4 across all 3 viewports × founder-returning / admin personas.
4. Live smoke `audit/score/session14-live-smoke.spec.ts` now asserts DOM text matches API values (add if missing).
</verify>
</task>
