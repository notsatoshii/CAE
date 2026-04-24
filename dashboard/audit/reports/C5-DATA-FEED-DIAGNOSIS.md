# C5 data-feed diagnosis — 8 broken /build cards

Date: 2026-04-24
Session: P0 data-feed audit + fix
Class tag: class20[a-f]

## TL;DR

Eric reported 8 cards on `/build` rendering empty/offline/idle/0 while the
jsonl data layer was objectively healthy. The root cause was a **client-
bundle module resolution error** in `lib/workflows/live-instances.ts` —
a Node-only reader imported transitively by a `"use client"` component.
Turbopack rejected `fs/promises` for the browser bundle, which cascaded
into a compile error that 500'd every server route, including
`/api/state`. Every card depending on `useStatePoll()` (the primary home
data channel) was rendering against `data = null` forever.

After unblocking that, four downstream aggregator bugs surfaced. All
six classes were fixed in four commits.

## Commits landed

| SHA | Class | Scope | Summary |
|---|---|---|---|
| `a7aebf4` | 20a | bundle | Split `live-instances.ts` → `types.ts` so client components don't drag `fs/promises` into the browser bundle. (Landed concurrently via parallel agent — verified correct.) |
| `767e2bb` | 20b | aggregator | `listPhases` matches phase number from `task_id` prefix (real schema), not the phantom `phaseId` field (never existed). |
| `37ebc86` | 20c/d/e/f | aggregators + UI | Rollup shipped-today counts activity.jsonl commits. RecentLedger unions activity.jsonl commits. Live Ops line reads activity.jsonl. Budget tile renders "unbounded" when env unset. |

## Per-card diagnosis

### 1. RecentLedger — "nothing shipped today"

- **Component**: `components/build-home/recent-ledger.tsx`
- **Data path**: `useStatePoll()` → `/api/state` → `home.events_recent` from `buildEventsRecent()` in `lib/cae-home-state.ts`
- **Endpoint**: `GET /api/state`
- **Root cause**: The reader only ingested `forge_end` rows from
  `circuit-breakers.jsonl`. Those rows are fixture data (last session's
  test harness). Real commits land in `activity.jsonl` as `type:"commit"`
  and were invisible to this aggregator.
- **Before**: 20 rows, all `p15-*` fixture forge_end entries from 03:15.
- **Fix (class20d)**: `buildEventsRecent` now unions activity.jsonl
  `type:"commit"` rows after the forge_end pass. Each commit becomes a
  `RecentEvent` with `status:"shipped"`, plan = "`{short_sha} {subject}`".
- **After**: Top of ledger shows real git commits with human-readable
  subjects, e.g. `79c0dbe feat(craft/class5E): kanban visual separation`.

### 2. ActivePhaseCards — "active phases shows nothing"

- **Component**: `components/build-home/active-phase-cards.tsx`
- **Data path**: `useStatePoll()` → `/api/state` → `home.phases`
  (`buildPhases` → `listPhases` per project)
- **Endpoint**: `GET /api/state`
- **Root cause (a)**: The route was 500'ing because of the bundle bug
  (class20a). `data` was never populated.
- **Root cause (b)**: After the bundle fix, `listPhases` in
  `lib/cae-state.ts` was comparing a non-existent `rec.phaseId` field.
  Every phase without a `CAE-SUMMARY.md` was silently tagged "idle",
  `buildPhases` filtered those, ActivePhaseCards rendered empty.
- **Fix (class20b)**: `listPhases` derives phase number from `task_id`
  prefix (`p15-pl01-t1` → 15) and unions rows from both
  circuit-breakers.jsonl AND activity.jsonl. Activity window widened to
  24h so intra-day work is captured.
- **Residual**: `home_phases = []` still renders in the current
  environment because the running agents aren't emitting `task_id`
  events to either jsonl — the dashboard's `.cae/metrics/` has fixture
  data from Apr 20, and the CAE_ROOT activity.jsonl has git-post-commit
  rows without `task_id`. Marked as follow-up — a later class should
  instrument the real agent loop to emit `workflow_start{workflow_id}`
  or re-derive active phases from file-mtime heuristics.

### 3. RollupStrip — "live ops shows nothing shipped, inflight 0"

- **Component**: `components/build-home/rollup-strip.tsx`
- **Data path**: `useStatePoll()` → `/api/state` → `home.rollup` from
  `buildRollup()`
- **Endpoint**: `GET /api/state`
- **Root cause**: Same bundle bug blocked `data` entirely. After unblock,
  `shipped_today` only counted outbox `DONE.md` files with
  `status:"success"` + forge/* merge commits. This repo commits directly
  to main, so both sources were empty.
- **Fix (class20c)**: `buildRollup` unions activity.jsonl
  `type:"commit"` SHAs for today's UTC date window. Deduped via
  `Set<sha>`.
- **Before**: `rollup.shipped_today = 0`
- **After**: `rollup.shipped_today = 20` (matches real commit count)

### 4. ActivityFeed — "activity stream shows offline"

- **Component**: `components/build-home/activity-feed.tsx`
- **Data path**: `useStatePoll()` → `/api/state` → `recent_activity`
  from `getActivityFeed()` in `lib/cae-activity-feed.ts`
- **Endpoint**: `GET /api/state` (also `/api/tail/activity` for SSE,
  but the card renders from the poll)
- **Root cause**: Pure collateral damage from the bundle bug. When
  `/api/state` 500'd, `useStatePoll().error` went truthy, and the
  component rendered its `variant="error"` EmptyState — `"Activity
  stream offline."`.
- **Fix**: class20a unblocked the route. The feed now returns 20 real
  rows (`{'commit': 16, 'other': 4}`).
- **Before**: `HTTP 500` — offline state.
- **After**: `HTTP 200` — 20 rows with real commits.

### 5. BurnRate — "burn shows nothing"

- **Component**: Tile inside `components/build-home/mission-control-hero.tsx`
  (label "burn")
- **Data path**: `GET /api/mission-control` →
  `lib/cae-mission-control-state.ts` → `costFromTokenUsage()` over the
  last 60s of `circuit-breakers.jsonl` `token_usage` events.
- **Endpoint**: `GET /api/mission-control`
- **Root cause**: The dashboard's current metrics writers do not emit
  `token_usage` events during real agent runs. The only `token_usage`
  rows in `circuit-breakers.jsonl` are fixture data from 03:11 (~10h
  stale relative to now).
- **Status**: **NOT FIXED in this pass**. The dashboard layer is
  correctly computing $0/min from an empty window — the aggregator is
  honest. The producer side (circuit_breakers.py or equivalent Python
  adapter) must start emitting `token_usage` rows keyed to real model
  calls. Documented as an upstream instrumentation gap.

### 6. Budget — "shows 1% but we never set a budget"

- **Component**: Tile inside `components/build-home/mission-control-hero.tsx`
  (label "budget") + `CostRadial`
- **Data path**: `GET /api/mission-control` → `daily_budget_usd`
- **Endpoint**: `GET /api/mission-control`
- **Root cause**: `dailyBudget()` fell back to a hardcoded `$50` when
  `CAE_DAILY_BUDGET_USD` env was unset. `projectMissionControl()` then
  coerced 0 back to $50 a second time. The Cost tile rendered
  `Math.round(pct * 100)%` which came out to "1%" off trivial spend.
- **Fix (class20f)**:
  - `dailyBudget()` returns 0 when env unset (no more hardcoded $50).
  - `projectMissionControl()` preserves 0 as the "unbounded" signal.
  - `mission-control-hero.tsx` renders a new `<CostUnbounded>` view
    (raw $ today + "unbounded" hint + `data-truth="mission-control.
    budget-unbounded": yes`) in place of the radial gauge when
    `budget <= 0`.
  - `TokenBurnBar` hides its budget marker line when unbounded.
  - Tile aria-label drops the budget percentage claim.
- **Before**: `daily_budget_usd: 50`, `cost_pct_of_budget: 0.0258`, UI
  showed "1% of budget".
- **After**: `daily_budget_usd: 0`, `cost_pct_of_budget: 0`, UI shows
  cost-today + "unbounded".

### 7. LiveActivityPanel — "idle"

- **Component**: `components/build-home/live-activity-panel.tsx`
- **Data path**: `GET /api/activity/live` →
  `lib/cae-activity-state.ts` → tool-call bucketing from
  `tool-calls.jsonl`
- **Endpoint**: `GET /api/activity/live`
- **Root cause**: Two independent issues conflated.
  1. The `isActive` check is `Date.now() - last_event_at <
     ACTIVE_WINDOW_MS (30s)`. `last_event_at` is the most recent
     tool-call timestamp. Nothing writes to `tool-calls.jsonl` today,
     so `last_event_at` is stale by hours.
  2. The endpoint itself was 200'ing fine before and after the fixes
     — this card was never truly "broken" at the transport layer.
- **Status**: The aggregator is honest. If `tool-calls.jsonl` isn't
  being written by the audit-hook, the panel correctly shows idle.
  Upstream instrumentation gap, same class as #5.
- **API evidence (post-fix)**:
  ```
  last_event_at: 1777000563471  (2026-04-24T03:16 — stale)
  last_24h_count: 120
  tools_per_min_now: 0
  ```

### 8. Live Ops line — "idle right now"

- **Component**: `components/build-home/live-ops-line.tsx`
- **Data path**: `useStatePoll()` → `/api/state` → `home.live_ops_line`
  from `composeLiveOpsLine(activeAgents, taskLabels)`.
- **Endpoint**: `GET /api/state`
- **Root cause**: `buildGlobalActiveAgents` only consumed
  `circuit-breakers.jsonl` forge_begin/forge_end within a 30s window.
  Real agent activity leaves no such events under the current producer
  stack.
- **Fix (class20e)**: Added a second pass over activity.jsonl within a
  120s window. Synthesises a per-source agent label (git/audit/chat/
  activity) from `r.actor` / `r.source`, and a task label from
  `meta.task_id` / `meta.label` / `r.summary` / `r.type`. When any
  recent-enough activity row is found, the Live Ops line surfaces it.
- **Residual**: When zero activity rows land inside 120s (e.g. idle
  gap between commits) the line still reads "Idle right now." That's
  accurate behaviour.

## What remains

Two cards (BurnRate, LiveActivityPanel) depend on producers that are
not currently emitting. Those are instrumentation gaps, not dashboard
bugs. Recommend a follow-up class that:

1. Wires Python circuit-breakers adapter (bin/circuit_breakers.py) to
   emit `token_usage` events per model call, inside real agent runs.
2. Ensures the Claude Code audit-hook writes `tool-calls.jsonl` for
   every PostToolUse.

With those in place, all 8 cards will light up naturally.

## API evidence — before/after

### Before (bundle bug, any /build card)

```
GET /api/state
HTTP/1.1 500 Internal Server Error
Content-Type: text/html; charset=utf-8
{... "err":{"message":"./lib/cae-state.ts:1:1\n
Module not found: Can't resolve 'fs/promises'\n..."} ...}
```

### After

```
GET /api/state
HTTP/1.1 200 OK
Content-Type: application/json

{
  "rollup": {
    "shipped_today": 20,
    "tokens_today": 144376,
    "in_flight": 0,
    "blocked": 0,
    "warnings": 0
  },
  "events_recent": [
    {
      "ts": "2026-04-24T12:49:15+09:00",
      "status": "shipped",
      "plan": "79c0dbe feat(craft/class5E): kanban visual separation",
      "agent": "CAE Build System",
      ...
    },
    ...
  ],
  "live_ops_line": "Idle right now.",
  "recent_activity": [...16 commits + 4 other...],
  ...
}

GET /api/mission-control
HTTP/1.1 200 OK
{
  "daily_budget_usd": 0,         // was 50 (phantom)
  "cost_pct_of_budget": 0,       // was 0.0258 → "1%"
  "cost_today_usd": 1.29,
  "token_burn_usd_per_min": 0,   // upstream producer gap
  ...
}
```
