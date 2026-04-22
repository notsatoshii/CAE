---
phase: 07-metrics-global-top-bar-icon-page
plan: 02
subsystem: metrics-data-layer
tags: [wave-1, data-layer, api, aggregator, polling-hook, labels, recharts-install]
requirements:
  - REQ-7-SPEND
  - REQ-7-WELL
  - REQ-7-FAST
  - REQ-7-FOUNDER
dependency-graph:
  requires:
    - dashboard/lib/cae-types.ts (Wave 0 CbEvent schema)
    - dashboard/lib/cae-state.ts (listProjects, tailJsonl, listInbox, listOutbox)
    - dashboard/lib/copy/agent-meta.ts (AGENT_META roster)
    - dashboard/lib/hooks/use-state-poll.tsx (provider pattern to mirror)
    - dashboard/.cae/metrics/circuit-breakers.jsonl (real snake_case schema)
    - dashboard/.cae/metrics/sentinel.jsonl (optional; silent fallback if missing)
  provides:
    - "dashboard/lib/cae-metrics-state.ts exports getMetricsState() + MetricsState/SpendingState/ReliabilityState/SpeedState types for Wave 2 panels"
    - "dashboard/app/api/metrics/route.ts exposes GET /api/metrics (force-dynamic) with 200 success or 500 full-shape fallback"
    - "dashboard/lib/hooks/use-metrics-poll.tsx exports MetricsPollProvider + useMetricsPoll with 30s cadence + visibility guard"
    - "dashboard/lib/copy/labels.ts has 40 metrics.* keys across FOUNDER + DEV, plus new formatDuration helper"
    - "dashboard/package.json has recharts@3.8.1 + pnpm.overrides.react-is=19.2.4"
  affects:
    - "Wave 2 panels (07-03 spending; 07-04 reliability+speed) now have a stable data contract"
    - "Wave 3 page shell (07-05) can mount MetricsPollProvider around the panels"
tech-stack:
  added:
    - "recharts@3.8.1 (charting lib — BarChart + stacked by agent + time-to-merge histogram)"
    - "pnpm.overrides.react-is=19.2.4 (React 19 peer override for recharts v3)"
  patterns:
    - "30s process-level cache TTL (CACHE_TTL_MS) mirrors Phase 5 aggregator"
    - "Multi-project aggregation via listProjects() per D-03 — no per-project filter UI in v0.1"
    - "Unknown-agent fold-to-forge in token stacking + per-agent wall (matches Phase 5)"
    - "Numpy-compat linear-interpolation percentile helper (exported for tests)"
    - "Zero-filled 30d date skeletons for daily + by_agent rows (always 30 rows, always 9 agent columns)"
    - "Defensive typeof-guards on every CbEvent field read (asString/asNumber helpers)"
    - "Separate polling namespace (MetricsPollContext) — independent of StatePollProvider to prevent shape mixing"
    - "document.visibilityState guard + visibilitychange listener — pauses when hidden, fires immediate poll on show"
  removed: []
key-files:
  created:
    - "dashboard/lib/cae-metrics-state.ts (638 lines)"
    - "dashboard/app/api/metrics/route.ts (46 lines)"
    - "dashboard/lib/hooks/use-metrics-poll.tsx (107 lines)"
  modified:
    - "dashboard/package.json (+recharts dep, +pnpm.overrides block)"
    - "dashboard/pnpm-lock.yaml (regenerated)"
    - "dashboard/lib/copy/labels.ts (+136 lines — 40 metrics.* keys × 2 branches + formatDuration helper)"
decisions:
  - "Cache TTL = 30 000 ms — matches polling cadence so a fresh poll never hits stale cache"
  - "Per-project JSONL tail limits: circuit-breakers.jsonl → 10 000 lines; sentinel.jsonl → 2 000 lines (covers 30d on an active repo without O(n) blow-up)"
  - "top_expensive.title = task_id in v0.1 — cross-project BUILDPLAN title derivation deferred to Wave 2 polish (plan comment)"
  - "queue_depth_now is a single snapshot; rolling-history sparkline belongs in the client panel, not the aggregator"
  - "time_to_merge requires inbox task to still exist (ephemeral); documented caveat — subset only"
  - "Unknown agents (not in AGENT_META) fold under 'forge' for both token stacking and wall percentile buckets to avoid legend sprawl while preserving totals"
  - "Aggregator emits ALL 9 agents in per_agent_7d with sample_n; UI applies the ≥5 sample gate — not the aggregator (cleaner separation of data vs UX policy)"
  - "500 response carries the FULL MetricsState shape so UI never has to branch between error and success shapes"
  - "MetricsPollProvider is independent of StatePollProvider — different namespace so consumers can't mix StateResponse with MetricsState"
  - "document.visibilityState guard pauses polling when tab hidden; visibilitychange listener resumes with immediate poll on show"
metrics:
  duration_minutes: 12
  completed_date: "2026-04-22T11:15:00Z"
  tasks_completed: 5
  files_modified: 3
  files_created: 3
  commits:
    - "94996fe chore(07-02): install recharts@3.8.1 + pnpm override for react-is@19.2.4"
    - "85492aa feat(07-02): add cae-metrics-state.ts aggregator + MetricsState types"
    - "d209548 feat(07-02): add /api/metrics route delegating to getMetricsState"
    - "e2b3364 feat(07-02): add useMetricsPoll provider hook (30s + visibility guard)"
    - "d443f1c feat(07-02): add metrics.* copy keys to labels.ts (FOUNDER + DEV)"
---

# Phase 7 Plan 2: Data Layer — Aggregator + /api/metrics + useMetricsPoll + Copy Summary

**One-liner:** Shipped the complete Phase 7 foundation — a 638-line multi-project aggregator (`lib/cae-metrics-state.ts`) computing Spending/Reliability/Speed from real snake_case JSONL, a thin `/api/metrics` route with a full-shape 500 fallback, a 30-second `MetricsPollProvider` hook with tab-hidden pausing, 40 metrics.* founder/dev copy keys with zero `$` signs, and recharts@3.8.1 pinned alongside a React-19 peer override. Wave 2 panels can now build with zero further data-layer work.

## What Shipped

### Task 1 — recharts@3.8.1 + pnpm overrides — commit `94996fe`

- `pnpm add recharts@3.8.1` → 35 new packages resolved, recharts pinned in `dependencies`.
- Added top-level `pnpm.overrides.react-is: "19.2.4"` block to `package.json` (D-04 + research §Pitfall 3).
- `pnpm install` reapplied the override; `pnpm build` exited 0 with all 10 static pages generated (no peer warnings promoted to errors).

### Task 2 — `lib/cae-metrics-state.ts` (638 lines) — commit `85492aa`

**Exports (public API):**
```ts
export interface SpendingState        // 6 fields
export interface ReliabilityState     // 4 fields
export interface SpeedState           // 3 fields
export interface MetricsState         // { generated_at, spending, reliability, speed }
export async function getMetricsState(): Promise<MetricsState>
export function percentile(sorted: number[], p: number): number
```

**Aggregator behavior:**
- Calls `listProjects()` → walks each project's `.cae/metrics/circuit-breakers.jsonl` (tail 10 000 lines) + `.cae/metrics/sentinel.jsonl` (tail 2 000 lines). Per-project reads wrapped in try/catch; one bad project cannot poison the result.
- Process-level cache — `CACHE_TTL_MS = 30_000`. Cached object returned by-reference; arrays sorted in copies (never mutated).
- `spending.tokens_today` / `tokens_mtd` scan all cb events for `(input_tokens + output_tokens)` with `ts` starting with today / current UTC month.
- `spending.tokens_projected_monthly = Math.round(tokens_mtd × (daysInMonth / Math.max(1, dayOfMonth)))` — exactly matches must-have #3 in the plan frontmatter.
- `spending.by_agent_30d` — 30 zero-filled UTC date rows × 9 agent columns. Unknown agents fold into `forge`.
- `spending.daily_30d` — 30 zero-filled UTC date rows `{date, tokens}`.
- `spending.top_expensive` — grouped by `task_id` across all projects; sorted descending; top 10. `agent` = most-frequent agent on the task's events; `title = task_id` (v0.1 — BUILDPLAN title lookup deferred).
- `reliability.per_agent_7d` — emits ALL 9 agents (sample_n may be 0); `success_rate = successes / total` over `forge_end` rows in last 7d; UI applies the ≥5 gate.
- `reliability.retry_heatmap` — 7 DoW × 24 hour = 168 always-present cells. Retry signal = `forge_end(success:false) ∪ limit_exceeded(limit == "max_retries")` in last 7d, bucketed by UTC DoW × hour.
- `reliability.halt_events` — all `event == "halt"` rows, newest-first, capped at 20.
- `reliability.sentinel_rejects_30d` — 30 zero-filled UTC date rows. Reject = `approve === false ∨ event matches /verdict_invalid|total_failure/`; approval = `approve === true`.
- `speed.per_agent_wall` — pairs `forge_begin / forge_end` by `(project.name, task_id, attempt)` (project-scoped to prevent cross-project collisions). Skips negative / zero / >10h deltas. `p50_ms` / `p95_ms` via linear-interpolation percentile (numpy-compat).
- `speed.queue_depth_now` — single snapshot of inbox length via `listInbox().length`.
- `speed.time_to_merge_bins` — fixed 5-bin histogram `["<1m","1-5m","5-15m","15m-1h",">1h"]`, always returned in that order even when zero. Compute = `outbox DONE.md mtime − inbox task createdAt.getTime()`; tasks no longer in inbox are skipped (ephemeral — documented caveat).

**Defensive helpers:** `asString()` / `asNumber()` typeof-guards fronting every CbEvent read. No assumption any field is present.

### Task 3 — `app/api/metrics/route.ts` (46 lines) — commit `d209548`

- `export const dynamic = "force-dynamic"` — no caching layer (aggregator has the 30s TTL).
- `await getMetricsState()` → `Response.json(state)`.
- 500 catch block returns the FULL `MetricsState` shape with zero values + top-level `error: "aggregator_failed"`. UI can render the zero state uniformly instead of branching on error-vs-success shapes.
- Auth handled by existing middleware (Phase 3 pattern; no per-route gate).

### Task 4 — `lib/hooks/use-metrics-poll.tsx` (107 lines) — commit `e2b3364`

- `"use client"` at top.
- `MetricsPollContext` is independent of `StatePollContext` by design (D-06) so consumers can't accidentally get `StateResponse` when expecting `MetricsState`.
- `intervalMs = 30_000` default.
- Poll body:
  1. Skip if `document.visibilityState === "hidden"`.
  2. `fetch("/api/metrics")` → on !ok set error + still parse the 500 fallback body as `MetricsState`.
  3. On 200, set data + clear error.
  4. `mounted` ref + early-return on every async step (prevents state updates after unmount).
- Lifecycle: immediate `poll()` call → `window.setInterval(poll, intervalMs)` → `visibilitychange` listener fires an immediate repoll when the tab becomes visible again.
- Cleanup: unsets mounted, clears interval, removes listener.
- `useMetricsPoll()` throws if used outside the provider.

### Task 5 — `lib/copy/labels.ts` (+136 lines) — commit `d443f1c`

- Added `// === Phase 7: Metrics ===` block inside the `Labels` interface with 40 new keys (page heading, 3 panel headings + ledes + sub-headings, per-agent column labels, queue-depth, time-to-merge, empty/failed-to-load states, 8 Explain-mode tooltip blurbs).
- FOUNDER branch uses founder-speak: `"How CAE is doing"`, `"CAE is getting things right 94% of the time this week."`, `"Most jobs finish in about 3.2s."`, `"nothing waiting"`.
- DEV branch uses engineer-speak: `"Metrics"`, `"7d success rate: 94.3%"`, `"P50 wall: 2380ms"`, `"3 inbox"`.
- New `formatDuration(ms)` helper (placed next to `formatTok`) renders 450→`"450ms"`, 3400→`"3.4s"`, 75000→`"1.3m"`, 5400000→`"1.5h"`; used in FOUNDER `metricsFastLede`.
- **Zero `$` signs** in any Phase 7 copy value — grep-verified (Wave 4 lint will re-enforce).

## Final MetricsState Shape (as returned)

Matches CONTEXT D-10 exactly. Live sample from `curl -s http://localhost:3002/api/metrics | jq '...'` against the real running dev server on this repo:

```json
{
  "generated_at": "2026-04-22T11:12:13.975Z",
  "spending_tokens_today": 0,
  "spending_tokens_mtd": 0,
  "spending_tokens_projected_monthly": 0,
  "by_agent_30d_len": 30,
  "daily_30d_len": 30,
  "top_expensive_len": 0,
  "per_agent_7d_len": 9,
  "retry_heatmap_len": 168,
  "halt_events_len": 0,
  "sentinel_rejects_30d_len": 30,
  "per_agent_wall_len": 9,
  "queue_depth_now": 3,
  "time_to_merge_bins": [
    {"bin_label":"<1m","count":2},
    {"bin_label":"1-5m","count":1},
    {"bin_label":"5-15m","count":0},
    {"bin_label":"15m-1h","count":0},
    {"bin_label":">1h","count":0}
  ]
}
```

Observations:
- **9 agents** in both `per_agent_7d` and `per_agent_wall` (nexus + forge + sentinel + scout + scribe + phantom + aegis + arch + herald).
- **168 retry-heatmap cells** (7 DoW × 24 hour).
- **30 zero-filled dates** in `by_agent_30d`, `daily_30d`, `sentinel_rejects_30d`.
- **5 fixed bins** in time_to_merge, order preserved.
- **Real data flowing:** `queue_depth_now=3` matches the actual inbox; time-to-merge shows 2 tasks <1m + 1 task 1-5m — real outbox/inbox pairings found.
- Token sums are 0 because the dashboard repo's own jsonl predates the Wave 0 adapter token emission; any CAE project run with the Wave 0 adapter will populate these immediately.

No deviations from D-10; no camelCase drift.

## Aggregator Cache TTL + File-Read Limits

| Parameter                     | Value                  | Rationale                                                          |
| ----------------------------- | ---------------------- | ------------------------------------------------------------------ |
| `CACHE_TTL_MS`                | 30 000 ms              | Matches the hook's 30s cadence — a fresh poll never hits stale     |
| circuit-breakers.jsonl tail   | 10 000 lines / project | Covers a very active repo's 30-day window with headroom            |
| sentinel.jsonl tail           | 2 000 lines / project  | Sentinel fires at ~1 event/task; 2k covers 30d comfortably         |
| MAX_WALL_MS (speed guard)     | 10 hours               | Discards stuck-session deltas — anything over 10h is a bug, not a wall time |
| MERGE_BIN edges (ms)          | 60k / 300k / 900k / 3.6M / ∞ | Reasonable founder-facing buckets (`<1m`, `1-5m`, `5-15m`, `15m-1h`, `>1h`) |

## Bin Edges — time_to_merge

```
<1m     ≤  60 000 ms
1-5m    ≤  300 000 ms
5-15m   ≤  900 000 ms
15m-1h  ≤  3 600 000 ms
>1h     else
```

Returned in that fixed order unconditionally; UI renders all five even when count=0.

## Deviations from Plan

**None — plan executed exactly as written.** Every must-have, artifact minimum line count, and export name is present. No architectural escalations triggered.

Minor in-line notes (pre-documented in plan Task action text, not true deviations):
- `top_expensive[].title = task_id` for v0.1 — cross-project BUILDPLAN title derivation explicitly deferred per plan.
- `time_to_merge_bins` subset only covers inbox-still-present tasks — ephemeral inbox caveat documented.
- Build warnings seen during `pnpm build` (`middleware-to-proxy` Next.js advisory + next.config.ts NFT notice) are pre-existing and unrelated to this plan; did not fix per Scope Boundary rule.

## Authentication Gates

None — this plan is pure dashboard data-layer; auth is handled by existing middleware (Phase 3).

## Verification Results

| Check                                                                    | Result                             |
| ------------------------------------------------------------------------ | ---------------------------------- |
| `jq -e '.dependencies.recharts == "3.8.1"' package.json`                 | ✓ true                             |
| `jq -e '.pnpm.overrides["react-is"] == "19.2.4"' package.json`            | ✓ true                             |
| `pnpm install --frozen-lockfile=false`                                   | ✓ clean                            |
| `pnpm tsc --noEmit`                                                      | ✓ exit 0 (0 output lines)          |
| `pnpm build`                                                             | ✓ exit 0, `/api/metrics` appears in route table |
| All 17 Task-2 grep assertions                                            | ✓ all pass                         |
| All 9 Task-4 grep assertions                                             | ✓ all pass                         |
| All 9 Task-5 grep assertions                                             | ✓ all pass                         |
| `grep '\$' app/api/metrics lib/cae-metrics-state.ts lib/hooks/use-metrics-poll.tsx` (excluding `${` template) | ✓ zero hits |
| Phase 7 labels block `awk | grep '\$'`                                   | ✓ zero hits                        |
| Live curl: `/api/metrics` HTTP 200 + full shape                          | ✓ confirmed on port 3002           |

## Known Stubs

**None.** Every file is fully wired:
- Aggregator computes every MetricsState field from real JSONL (no hardcoded empties).
- API route delegates to aggregator; 500 fallback is intentional uniform-shape handling, not a stub.
- Hook fetches real `/api/metrics`, parses real responses.
- Labels — every key has a real copy value in both FOUNDER and DEV branches.
- `top_expensive.title = task_id` is a documented v0.1 shortcut (task_id IS the identifier); Wave 2 may elevate but not required.

## Commits

| Task | Scope              | Commit   | Files                                                                                                   | Insert / Delete |
| ---- | ------------------ | -------- | ------------------------------------------------------------------------------------------------------- | --------------- |
| 1    | `chore(07-02)`     | 94996fe  | dashboard/package.json, dashboard/pnpm-lock.yaml                                                         | +301 / -4       |
| 2    | `feat(07-02)`      | 85492aa  | dashboard/lib/cae-metrics-state.ts                                                                       | +638 / 0        |
| 3    | `feat(07-02)`      | d209548  | dashboard/app/api/metrics/route.ts                                                                       | +46 / 0         |
| 4    | `feat(07-02)`      | e2b3364  | dashboard/lib/hooks/use-metrics-poll.tsx                                                                 | +107 / 0        |
| 5    | `feat(07-02)`      | d443f1c  | dashboard/lib/copy/labels.ts                                                                             | +136 / 0        |

## Self-Check: PASSED

- File `dashboard/lib/cae-metrics-state.ts` exists (638 lines): ✓
- File `dashboard/app/api/metrics/route.ts` exists (46 lines): ✓
- File `dashboard/lib/hooks/use-metrics-poll.tsx` exists (107 lines): ✓
- File `dashboard/lib/copy/labels.ts` has new metrics.* keys (122 "metrics" occurrences — before: minor; after: +40 keys × 2 branches + interface + helper): ✓
- `dashboard/package.json` has `recharts@3.8.1` + `pnpm.overrides.react-is=19.2.4`: ✓
- All 5 commits present in `git log --oneline -8`: ✓
- `pnpm tsc --noEmit` passes: ✓
- `pnpm build` passes: ✓
- Live `/api/metrics` returns HTTP 200 + full MetricsState shape: ✓
- Zero `$` signs in Phase 7 copy / metrics components / metrics API route: ✓
