---
phase: 17
plan: W3-liveness-markers
wave: 3
name: Fix liveness pillar — SSE healthy markers not flipping within capture window (398/408 cells score ≤3)
---

# W3 — Liveness systemic regression

## Context

C5 liveness rollup: avg 2.01. 172 cells score 1, 70 score 2, 156 score 3. Only 10 cells hit 4. This is the worst pillar after truth. Root cause per harness docs (`audit/README.md`): SSE-driven panels render `data-truth=".loading=yes"` first, flip to `.healthy=yes` once fetch completes. If Playwright captures mid-loading, liveness scores low even when the product is healthy.

Current runner cap: `TRUTH_SETTLE_MS = 6000`. Current reality: most pages still loading past 6s because W1 issues compound (router-init error → Suspense regenerate → refetch → stall).

After W1+W2 land, liveness should naturally improve. W3 is the cleanup pass: tighten markers + settle logic so scoring is deterministic.

## Task

<task>
<name>Make SSE healthy/stale markers settle deterministically within capture window</name>

<files>
audit/runner.spec.ts
components/**/use-*-poll.ts
hooks/use-sse.ts
hooks/use-state-poll.ts
components/**/*.tsx
</files>

<action>
1. Read `audit/runner.spec.ts` TRUTH_SETTLE_MS + waitForLoadState logic.
2. For every component that emits `data-truth=".loading"` → `".healthy=yes"`, ensure the transition fires on the FIRST successful fetch, not on a debounced timer.
3. Add a `liveness` helper: `useLivenessMarker(loadingCondition, healthyCondition, staleCondition)` → renders `<span data-truth="<scope>.loading|.healthy|.stale|.empty|.paused">`. Standardize across components.
4. Ensure every route emits at least 3 of 5 liveness markers (loading, empty, healthy, stale, paused). The 3/5 threshold is the pillar-score-3 floor.
5. For pages that never reach `healthy` (genuinely broken), log the reason. These become W1/W2 followups.
6. Bump `TRUTH_SETTLE_MS` ceiling to 10s IF necessary, but prefer synchronous/instant markers.
7. Runner enhancement: wait for `data-truth="<scope>.healthy=yes"` OR `.empty=yes` OR `.paused=yes` before screenshotting (all are valid end-states; `.loading` is not).
</action>

<verify>
1. `pnpm vitest run hooks` — all green.
2. Re-run C7 audit after W1+W2 fixes land. Liveness rollup avg must be ≥3.5; cells scoring 1 must be ≤10% of total.
3. Zero cells scoring 1 on the 22 non-trivial routes (exclude 403/signin).
</verify>
</task>
