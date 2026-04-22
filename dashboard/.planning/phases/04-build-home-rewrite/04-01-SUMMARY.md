---
phase: 04-build-home-rewrite
plan: 01
subsystem: build-home-data-layer
tags: [api, state-aggregator, poll-hook, types, tail-whitelist, phase-4-data-layer]
status_enum_observed: [pending, running, merged, failed]
dependency_graph:
  requires:
    - lib/cae-state.ts (listPhases, listProjects, listOutbox, tailJsonl)
    - lib/cae-phase-detail.ts (getPhaseDetail, TaskStatus enum)
    - lib/cae-config.ts (OUTBOX_ROOT)
  provides:
    - lib/cae-home-state.ts (getHomeState aggregator + 6 types)
    - /api/state extended JSON shape (backward-compat preserved)
    - /api/tail cross-project SSE
    - useStatePoll StateResponse extended type
  affects:
    - All Phase 4 plans (04-03, 04-04, 04-05, 04-06) — they read from useStatePoll().data
    - Phase 3 surfaces unaffected (breakers/metrics/phases/inbox/outbox keys untouched)
tech_stack:
  added: []
  patterns:
    - 1-second result cache (CACHE_TTL_MS) to survive 3s polling without FS thrash
    - STATUS_* typed-constants imported from TaskStatus enum for drift safety
    - Inline FOUNDER_LABEL map (04-02 will centralize; intentional duplicate to break parallel-wave dep)
    - Per-request listProjects() on /api/tail (no module-level caching)
key_files:
  created:
    - dashboard/lib/cae-home-state.ts (687 lines)
  modified:
    - dashboard/lib/cae-types.ts (+9 re-export lines)
    - dashboard/app/api/state/route.ts (+39/-11)
    - dashboard/lib/hooks/use-state-poll.tsx (+7)
    - dashboard/app/api/tail/route.ts (+21/-4)
decisions:
  - "home.phases renamed to `home_phases` in HTTP response to avoid shadowing existing `phases` top-level key"
  - "ETA heuristic: avg of prior phases' wall-time (phase-dir birthtime → CAE-SUMMARY.md mtime) × remaining_waves / wave_total; returns null if no prior phase history"
  - "agents_active derived from 30-second sliding window of forge_start events minus matching forge_done/forge_fail, grouped by (agent, taskId)"
  - "listProjects() runs per-request on /api/tail (no module-level caching); listProjects itself is cheap and per-request sidesteps invalidation"
  - "Status-enum safety: STATUS_RUNNING/MERGED/FAILED are typed constants imported against TaskStatus — drift causes TypeScript compile failure, not silent all-zero progress"
metrics:
  duration: ~35 minutes
  completed: 2026-04-22
  tasks: 4
  commits:
    - 457f924 (Task 1 — cae-home-state.ts aggregator)
    - a5b8d25 (Task 2 — /api/state merge)
    - e0e98b7 (Task 3 — StateResponse type)
    - fc12ac9 (Task 4 — /api/tail cross-project)
---

# Phase 4 Plan 01: Data layer + cross-project tail Summary

Extended `/api/state` to emit the full Phase 4 JSON contract (rollup + home_phases + events_recent + needs_you + live_ops_line) via a new `getHomeState()` aggregator, and extended `/api/tail` ALLOWED_ROOTS at request time so cross-project SSE tail works. Backward-compat preserved for every Phase 3 consumer.

## What was built

### 1. `dashboard/lib/cae-home-state.ts` (687 lines, new)

Central aggregator reading `.planning/` + `.cae/metrics/` + outbox across all projects. Exports:

- `getHomeState(): Promise<HomeState>` — main entry point; cached for 1s
- Types: `Rollup`, `AgentActive`, `PhaseSummary`, `RecentEvent`, `NeedsYouItem`, `HomeState`

Internal helpers:

- `buildRollup(projects, phases, needsYou)` — shipped_today/tokens_today/in_flight/blocked/warnings
- `buildPhases(projects)` — for each project, listPhases → for each active phase call getPhaseDetail, derive wave_current/wave_total/progress_pct/eta_min/tokens_phase/agents_active
- `buildEventsRecent(projects)` — tail circuit-breakers.jsonl across projects, keep forge_done/forge_fail events, map to RecentEvent, sort desc, slice 20
- `buildNeedsYou(projects)` — blocked tasks (>=3 fails/24h + STATUS_FAILED) + dangerous (APPROVAL.md w/o DONE.md) + plan_review (`*-REVIEW-READY.md` markers)
- `composeLiveOpsLine(agents, taskLabels)` — CONTEXT §Live Ops line composition (0/1/2/3+ agent cases)
- `buildGlobalActiveAgents(projects)` — 30s sliding window across all projects; returns AgentActive[] + per-agent task label map

### 2. `dashboard/lib/cae-types.ts` (+9 lines)

Appended re-export block for the 6 home state types for convenience.

### 3. `dashboard/app/api/state/route.ts` (+39/-11)

Added `getHomeState()` to the existing `Promise.all`, wrapped in `.catch` that returns a zeroed HomeState (route never 500s on aggregator failure). Response gains 5 new top-level keys; Phase 3 keys preserved.

### 4. `dashboard/lib/hooks/use-state-poll.tsx` (+7)

Extended `StateResponse` interface with 5 new fields. Runtime logic untouched.

### 5. `dashboard/app/api/tail/route.ts` (+21/-4)

Introduced `STATIC_ALLOWED_ROOTS` + async `computeAllowedRoots()` which appends per-project `.cae/logs`, `.cae/metrics`, `.planning/phases` from `listProjects()` at request time. `isAllowed` → `isAllowedPath(path, roots)` for clarity. `path.resolve` + `startsWith` traversal guard preserved.

## Observed TaskStatus enum values

`"pending" | "running" | "merged" | "failed"` — confirmed at `lib/cae-phase-detail.ts:47`.

The aggregator imports the `TaskStatus` type and declares `STATUS_RUNNING`, `STATUS_MERGED`, `STATUS_FAILED` typed constants. If the enum ever drifts, TypeScript compilation fails at these declarations — no silent all-zero progress.

## ETA formula chosen

For each project, for each phase:

```
if no prior phase has a CAE-SUMMARY.md:
  eta_min = null
else:
  prior_durations_minutes = for each completed phase: (SUMMARY.mtime - phase_dir.birthtime) / 60000
  avg = mean(prior_durations_minutes)
  remaining_waves = max(0, wave_total - wave_current)
  eta_min = round(avg * remaining_waves / wave_total)
```

Uses directory birthtime (creation) → SUMMARY.md mtime (completion) as the duration estimate. If a project has zero completed phases yet, ETA is null and the UI will render `ETA ~?m` or hide it.

## agents_active derivation (30s sliding window)

For each phase:
1. Read last 500 entries of `.cae/metrics/circuit-breakers.jsonl`
2. Filter to entries with `phaseId === phaseDirName` AND timestamp within 30 seconds of now
3. Maintain `Map<"agent::taskId", {agent, count}>` — increment on `forge_start`, decrement on `forge_done`/`forge_fail`
4. Aggregate remaining open starts by `agent`, sum to `concurrent`
5. Default `agent` field to `"forge"` when missing (current CAE tooling always emits forge for Builder tasks)

A separate global version (`buildGlobalActiveAgents`) runs once across all projects to feed the Live Ops line, plus carries a task-label map (first taskId per agent) for rendering `"{builder} is on {task}"`.

## Caveats / deviations from CONTEXT §State API extension

- **`home.phases` → HTTP key `home_phases`** (deliberate rename to avoid shadowing the existing per-project `phases` top-level key from `listPhases(project)`). This is called out explicitly in the route comment and in the StateResponse typedef. Downstream plans must read `data.home_phases`, not `data.phases`.
- **`events_recent[].commits` always 0 in v1.** CONTEXT §State API extension's shape includes `commits: number` but current circuit-breakers.jsonl events don't record commit counts. v1 sets this to 0; a later plan can run `git log --oneline forge/{branch}..HEAD` per event if real counts are needed.
- **`needs_you[].actions[].href`** uses `/build?project=…&sheet=open&phase={N}&plan=…&task=…` scheme per CONTEXT §URL scheme (LOCKED by Plan 04-03). `project` is preserved on sheet close by contract.

## Cross-project tail verification

Smoke test via tsx executed the route GET handler directly:

| Path | Status | Expected |
|---|---|---|
| `/home/cae/ctrl-alt-elite/.cae/logs/test.log` (cross-project) | **200** | NOT 403 — previously was 403 |
| `/home/cae/outbox/CONTRACT.md` | 200 | still allowed |
| `/etc/passwd` (traversal) | 403 | blocked (security preserved) |
| *missing path* | 400 | correct |

All 4 checks passed. Cross-project tail now works for Plan 04-05's live-log sheet.

## listProjects() cache behavior

**Per-request, not cached.** The route calls `computeAllowedRoots()` once per GET. `listProjects()` itself is cheap (a few `stat` calls on 4 candidate paths). Per-request avoids invalidation logic when a new project is registered mid-session. If `listProjects()` throws, the route falls back to `STATIC_ALLOWED_ROOTS` and logs to `console.error`.

## Deviations from Plan

### Rule 2 (auto-add correctness): Guarded against missing `inputTokens`/`outputTokens`
The plan said "sum inputTokens+outputTokens." Some events lack these fields (e.g., `phantom_escalation`). The aggregator defensively coerces via `typeof === "number"` checks rather than assuming presence. Prevents `NaN` propagation into rollup numbers.

### Rule 1 (auto-fix bug): Task 1 function signature
The plan's grep `export function getHomeState` would not match `export async function getHomeState`. The implementation uses `async` (required — function returns `Promise<HomeState>`). The grep-level acceptance check is imprecise but the semantic one (function exists and is exported as a Promise-returning callable) passes. All runtime smoke tests confirm the export is reachable.

## Automated checks (all passing)

- `pnpm tsc --noEmit` — 0 errors
- `pnpm build` — succeeds, /api/state + /api/tail routes compile
- `getHomeState()` runtime smoke — returns object with 5 top-level keys, phases=0 events=0 (no active phases on this project right now) live_ops="Idle right now."
- /api/tail cross-project smoke — 4/4 checks pass
- /api/state end-to-end smoke — all 10 top-level keys (breakers/phases/inbox/outbox/metrics + rollup/home_phases/events_recent/needs_you/live_ops_line) present

## Commits

| Task | Hash | Message |
|---|---|---|
| 1 | 457f924 | feat(04-01): add getHomeState aggregator for Phase 4 data layer |
| 2 | a5b8d25 | feat(04-01): extend /api/state to merge getHomeState output |
| 3 | e0e98b7 | feat(04-01): extend StateResponse type with Phase 4 fields |
| 4 | fc12ac9 | feat(04-01): extend /api/tail ALLOWED_ROOTS dynamically via listProjects |

## Self-Check: PASSED

- [x] `dashboard/lib/cae-home-state.ts` exists (687 lines)
- [x] `dashboard/lib/cae-types.ts` re-export block present
- [x] `dashboard/app/api/state/route.ts` imports getHomeState + exposes home_phases
- [x] `dashboard/lib/hooks/use-state-poll.tsx` extended with 5 new fields
- [x] `dashboard/app/api/tail/route.ts` has STATIC_ALLOWED_ROOTS + computeAllowedRoots + listProjects import + isAllowedPath
- [x] Commit 457f924 exists in git log
- [x] Commit a5b8d25 exists in git log
- [x] Commit e0e98b7 exists in git log
- [x] Commit fc12ac9 exists in git log
- [x] pnpm tsc --noEmit exits 0
- [x] pnpm build exits 0
- [x] Cross-project tail smoke returns NOT 403 for non-dashboard path
- [x] Traversal attack still 403 (security preserved)
