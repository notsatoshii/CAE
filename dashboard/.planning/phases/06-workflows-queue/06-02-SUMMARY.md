---
phase: 06-workflows-queue
plan: 02
subsystem: api
tags: [nextjs, api-routes, queue-aggregator, tmux, workflows, node-test, force-dynamic]

requires:
  - phase: 06-workflows-queue
    plan: 01
    provides: WorkflowSpec + parseWorkflow/writeWorkflow/getWorkflow/listWorkflows + WORKFLOWS_DIR env-fresh helper
  - phase: 02-ops-core
    provides: Phase 2 tmux spawn mechanic + INBOX_ROOT constant (reused verbatim from app/build/queue/actions.ts)
provides:
  - QueueCard / QueueCardStatus / QueueState types
  - bucketTasks(inbox, outbox, ctx) pure routing function
  - getQueueState() async aggregator (listInbox + listOutbox + tmux + circuit-breakers)
  - GET /api/workflows (list) + POST /api/workflows (create)
  - GET/PUT/DELETE /api/workflows/[slug]
  - POST /api/workflows/[slug]/run (auth-gated tmux spawn returning 202)
  - GET /api/queue (5-bucket KANBAN JSON)
affects: [06-03-widgets, 06-04-workflow-pages, 06-05-kanban, 06-06-integration]

tech-stack:
  added: []
  patterns:
    - "node:test + tsx for route integration tests with temp CAE_ROOT isolation"
    - "NextRequest handlers callable directly from tests (no HTTP layer needed)"
    - "exec tmux list-sessions (2s timeout) → Set<session>; swallow all errors"
    - "Circuit-breaker retry_count ≥3 OR unresolved HALT → stuckTaskIds"
    - "shortIdForTmux strips both web- and wf- prefixes so both task lineages match sessions"
    - "PUT passes explicit opts.slug to writeWorkflow for in-place overwrite (no collision suffix)"

key-files:
  created:
    - dashboard/lib/cae-queue-state.ts
    - dashboard/lib/cae-queue-state.test.ts
    - dashboard/app/api/queue/route.ts
    - dashboard/app/api/workflows/route.ts
    - dashboard/app/api/workflows/route.test.ts
    - dashboard/app/api/workflows/[slug]/route.ts
    - dashboard/app/api/workflows/[slug]/run/route.ts
  modified: []

key-decisions:
  - "Split aggregator into pure bucketTasks + async getQueueState so the routing logic can be unit-tested without disk/tmux/jsonl wiring"
  - "Short-id tmux match strips both web- and wf- prefixes — Phase 2 delegations and Phase 6 workflow runs share the same session namespace"
  - "PUT /api/workflows/[slug] passes opts.slug explicitly so an existing slug overwrites in place (no random suffix on a rename-less edit)"
  - "Run route gates with auth() even though other /api routes don't — spawning detached processes is a higher-impact operation than reading state"
  - "Outbox entries with no DONE.md AND no explicit status are skipped (not bucketed) — inbox side already counts them as waiting"

patterns-established:
  - "Route integration test pattern: set process.env.CAE_ROOT before importing route modules, call exported GET/POST/PUT/DELETE with NextRequest mocks and `{ params: Promise<T> }` ctx shape"
  - "Error-tolerant aggregators: every disk/shell call wrapped in try/catch → empty set/array default, never throws"

requirements-completed: [wf-02-persistence, wf-03-api-workflows, wf-04-api-queue, wf-06-run-now]

duration: 18 min
completed: 2026-04-22
---

# Phase 6 Plan 02: API Routes + Queue Aggregator Summary

**5 Next.js API routes (workflows CRUD + run + queue) plus the `cae-queue-state.ts` aggregator that buckets .cae inbox/outbox/tmux activity into the 5 KANBAN columns the UI plans will render against.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-04-22T08:01:00Z
- **Completed:** 2026-04-22T08:19:00Z
- **Tasks:** 3 (2 TDD, 1 plain-auto)
- **Files created:** 7 (3 implementation routes + 2 libs + 2 test files)
- **Tests added:** 32 (18 queue-state + 14 workflow route integration) — plus 50 regression tests (06-01 workflow/NL) still green

## Accomplishments

- `bucketTasks` pure routing unit-tested across 18 scenarios (empty, all 4 inbox branches including precedence, all 3 outbox branches, counts invariant, title extraction, 50-cap)
- `/api/workflows` CRUD + `/api/workflows/[slug]/run` all emit as `ƒ` (dynamic) routes in `pnpm build` manifest
- Tmux spawn pattern reused verbatim from `app/build/queue/actions.ts` — only differences are `wf-` prefix on taskId and `auth()` gate on the run endpoint
- 14 integration tests exercise GET list, POST create (collision-suffix), GET detail, PUT update (slug preservation), DELETE (both 204 and 404), plus all 400-path error shapes

## Task Commits

Each task was committed atomically with `--no-verify` (parallel-executor protocol):

1. **Task 1: Queue-state aggregator + /api/queue route** — `d728df2` (feat, TDD — test + impl authored together after RED confirmation)
2. **Task 2: /api/workflows CRUD routes** — `7cc26d5` (feat, TDD — same pattern)
3. **Task 3: /api/workflows/[slug]/run tmux spawn route** — `33fb4a7` (feat, plain-auto)

_Parallel commit `eac6aa0` by the 06-03 executor (StepGraph) landed between Task 2 and Task 3 on shared main — no overlap in files (06-03 owns `components/workflows/**`, 06-02 owns `app/api/**` + `lib/cae-queue-state.ts`)._

## Files Created/Modified

- `dashboard/lib/cae-queue-state.ts` — QueueCard/QueueState types, pure `bucketTasks`, async `getQueueState` (tmux + circuit-breakers + SENTINEL_REVIEW/HALT markers + BUILDPLAN first-line title extraction)
- `dashboard/lib/cae-queue-state.test.ts` — 18 `node:test` assertions covering every routing branch + invariants
- `dashboard/app/api/queue/route.ts` — `force-dynamic` GET, returns full QueueState JSON (500 on aggregator error)
- `dashboard/app/api/workflows/route.ts` — GET (list sorted mtime desc) + POST (create, 400 on validation errors, 201 on success)
- `dashboard/app/api/workflows/route.test.ts` — 14 `node:test` integration assertions (temp CAE_ROOT, handlers called directly)
- `dashboard/app/api/workflows/[slug]/route.ts` — GET (detail / 404), PUT (overwrite-in-place / 404 / 400), DELETE (204 / 404)
- `dashboard/app/api/workflows/[slug]/run/route.ts` — POST, `auth()`-gated, writes BUILDPLAN+META to `.cae/inbox/wf-{slug}-{ts}-{uuid4}/`, spawns detached tmux session, returns 202

## Decisions Made

- **Pure-vs-async split in cae-queue-state.** `bucketTasks(inbox, outbox, ctx)` is a synchronous pure function taking pre-computed `runningTmuxSessions`, `reviewTaskIds`, `stuckTaskIds`, `inboxTitles`. The async `getQueueState()` wires every async source and calls `bucketTasks`. Unit tests hit only the pure function; route-manifest + smoke tests validate the wiring.
- **Short-id strips both `web-` and `wf-` prefixes.** Phase 2 tasks look like `web-abc12345` and match `buildplan-abc12345`. Phase 6 workflow runs look like `wf-slug-1234-aaaa` and must match `buildplan-slug-1234-aaaa`. One regex handles both.
- **Outbox without status AND without DONE.md = skip.** Such entries are in-flight on the inbox side — counting them in outbox would double-count. Only status:success / hasDone-but-no-status go to shipped; status:error/failed go to stuck.
- **Run route is auth-gated, other routes aren't.** Matches Phase 2's server-action pattern (createDelegation gates with `auth()`). List/detail/CRUD match Phase 2 /api/state (ungated, rely on global middleware).
- **PUT preserves slug via explicit `opts.slug`.** Without this, a PUT on an existing slug would append a random suffix via writeWorkflow's collision rule — that's correct for POST but wrong for PUT (an explicit rename-in-place edit should not fork the slug).

## Deviations from Plan

None — plan executed exactly as written. All three tasks followed their `<action>` blocks verbatim. Pattern from `app/build/queue/actions.ts` reused unchanged in the run route. No auto-fix deviation rules triggered.

**Total deviations:** 0
**Impact on plan:** Zero scope creep; the plan's behavior spec was complete and the domain layer from 06-01 provided every import needed.

## Issues Encountered

- None. No build errors, no test flakes, no auth gates hit. The `next.config.ts` NFT warning flagged in 06-01 is pre-existing and remains unrelated (scope-boundary rule — not fixed here).
- Parallel commit contention was avoided via `--no-verify` per the parallel-executor protocol. Zero `index.lock` retries needed during the session.

## User Setup Required

None — no external services, no env-var changes. The run route relies on an authenticated NextAuth session, which is already configured from Phase 1.

## Next Phase Readiness

- **Plan 06-04 (workflow pages)** can now fetch `/api/workflows` for the list page, `/api/workflows/[slug]` for detail/edit, `/api/workflows/[slug]/run` for the Run-now button, and wire PUT/DELETE into the dev-mode editor. The response shapes match the 06-01 `WorkflowRecord` type.
- **Plan 06-05 (KANBAN)** consumes `/api/queue` directly: `state.columns.waiting`, `.in_progress`, `.double_checking`, `.stuck`, `.shipped` each already contain `QueueCard[]` with `title`, `agent`, `project`, `status`, `ts`, `tags`.
- **Plan 06-06 (integration)** can rely on the tmux-session → in_progress bucketing working for both Phase 2 `web-` tasks and Phase 6 `wf-` tasks without changes.

No blockers. Both the domain layer (06-01) and the contract surface (06-02) are now stable and will not require backward-incompatible changes from downstream UI plans.

## Self-Check: PASSED

- FOUND: `dashboard/lib/cae-queue-state.ts`
- FOUND: `dashboard/lib/cae-queue-state.test.ts`
- FOUND: `dashboard/app/api/queue/route.ts`
- FOUND: `dashboard/app/api/workflows/route.ts`
- FOUND: `dashboard/app/api/workflows/route.test.ts`
- FOUND: `dashboard/app/api/workflows/[slug]/route.ts`
- FOUND: `dashboard/app/api/workflows/[slug]/run/route.ts`
- FOUND: commit `d728df2` (Task 1 — queue aggregator + /api/queue)
- FOUND: commit `7cc26d5` (Task 2 — /api/workflows CRUD)
- FOUND: commit `33fb4a7` (Task 3 — /api/workflows/[slug]/run)
- PASS: `npx tsx lib/cae-queue-state.test.ts` — 18/18
- PASS: `npx tsx app/api/workflows/route.test.ts` — 14/14
- PASS: regression `npx tsx lib/cae-workflows.test.ts` — 26/26
- PASS: regression `npx tsx lib/cae-nl-draft.test.ts` — 24/24
- PASS: `npx tsc --noEmit` clean
- PASS: `pnpm build` emits `ƒ /api/queue`, `ƒ /api/workflows`, `ƒ /api/workflows/[slug]`, `ƒ /api/workflows/[slug]/run`
- PASS: `grep 'spawn(' app/api/workflows/[slug]/run/route.ts` matches (Phase 2 reuse)
- PASS: `grep 'await auth()' app/api/workflows/[slug]/run/route.ts` matches (session gate)

---
*Phase: 06-workflows-queue*
*Completed: 2026-04-22*
