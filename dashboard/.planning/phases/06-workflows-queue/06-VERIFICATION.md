# Phase 6 — Workflows + Queue — VERIFICATION

**Verified:** 2026-04-22T08:35:00Z
**Status:** PASS (automated) + PENDING-UAT (2 human-verify flows)

## Summary

- **Shipped (Plans 06-01 through 06-05, 14 commits):** workflow domain + NL drafter + 33 founder/dev labels, `/api/workflows` CRUD + `/api/queue` aggregator + auth-gated tmux spawn for Run-now, Monaco / StepGraph / NL-draft widgets, full `/build/workflows` list/new/edit trio with dev-mode gate, 5-column KANBAN `/build/queue` with New-job modal and Phase-4 TaskDetailSheet reuse.
- **Deferred:** multi-step workflow runtime (only first step runs), real Nexus chat-drafting (Phase 9), cron/event dispatchers, drag-to-reorder queue, dedicated queue-task detail sheet (currently shows "Phase ?" — acceptable per plan decision).
- **Totals:** 5 completed plans (06-01 → 06-05), 2 tasks in 06-06, 87 unit tests (26 workflow schema + 24 NL + 18 queue + 14 route + 5 step-graph) all green, 8 Phase-6 routes emit dynamic `ƒ` in the build manifest. `pnpm tsc --noEmit` clean, `pnpm build` clean.

## Build

- `pnpm tsc --noEmit`: exit 0 (no type errors)
- `pnpm build`: exit 0. Route manifest contains all Phase-6 routes:

```
├ ƒ /api/queue
├ ƒ /api/workflows
├ ƒ /api/workflows/[slug]
├ ƒ /api/workflows/[slug]/run
├ ƒ /build/queue
├ ƒ /build/workflows
├ ƒ /build/workflows/[slug]
├ ƒ /build/workflows/new
```

Pre-existing Turbopack NFT warning on `next.config.ts` → `lib/cae-phase-detail.ts` → `lib/cae-home-state.ts` → `app/api/state/route.ts` is unrelated to Phase 6 (first flagged in 06-01 summary, scope-boundary rule applies).

## Plan 06-01: Domain layer

- [x] `npx tsx lib/cae-workflows.test.ts` exit 0 (26/26 assertions)
- [x] `npx tsx lib/cae-nl-draft.test.ts` exit 0 (24/24 assertions)
- [x] labels.ts grep — all four canonical keys present:
  - `workflowsPageHeading`: 3 hits (interface + FOUNDER + DEV)
  - `workflowsDraftBtn`: 6 hits (interface + FOUNDER + DEV with dev/founder pair variants)
  - `queueKanbanColWaiting`: 3 hits
  - `queueKanbanColShipped`: 3 hits
  - 33-key founder/dev block: `=== Phase 6: Workflows + Queue ===` marker appears 3× (interface + FOUNDER + DEV sections)
- [x] Round-trip check via `npx tsx -e "..."`:
  ```
  steps: 4
  round-trip ok: true
  ```
  Input: `"Every Monday, Forge runs pnpm test, Sentinel reviews, I approve, then push to main"`.
  Flow: heuristicDraft → serializeWorkflow → parseWorkflow → validateWorkflow. All error arrays empty; step count preserved at 4.

## Plan 06-02: API routes

- [x] `npx tsx lib/cae-queue-state.test.ts` exit 0 (18/18 assertions)
- [x] `npx tsx app/api/workflows/route.test.ts` exit 0 (14/14 assertions)
- [x] `curl http://localhost:3002/api/workflows` returns `{"workflows":[]}` (HTTP 200) — workflows dir currently empty at `/home/cae/ctrl-alt-elite/.cae/workflows/`. Route shape matches plan contract.
- [x] `curl http://localhost:3002/api/queue` returns `{"columns":{"waiting":[…],"in_progress":[…],…},"counts":{...},"fetchedAt":…}` (HTTP 200). Columns populated with `tb-e2e-v2-…` and `tb-e2e-v3-…` tasks from `/home/cae/inbox/` (INBOX_ROOT). Live bucketing confirmed.
- [x] grep confirms `spawn(` + `"tmux"` present in `app/api/workflows/[slug]/run/route.ts` (line 95-96; multi-line call). Exact match for literal `spawn("tmux"` fails only because args are on next line — the call `spawn("tmux", [...])` matches the required contract.
- [x] grep confirms `await auth()` call in `app/api/workflows/[slug]/run/route.ts` (1 hit).
- [x] Auth gating verified live: `POST /api/workflows/some-slug/run` → HTTP 401 unauthenticated (matches plan: auth-gated endpoint).
- [x] `/api/workflows` + `/api/queue` rely on global middleware only (not `auth()` in handler) — responded 200 to anonymous curl, matching `/api/state` pattern from Phase 2.

## Plan 06-03: Widgets

- [x] `@monaco-editor/react` in `package.json` dependencies (resolved to 4.7.0 from `^4.6.0` range per 06-03 decision).
- [x] `node_modules/@monaco-editor/react/package.json` exists (installed).
- [x] `npx tsx components/workflows/step-graph.test.tsx` exit 0 (5/5 assertions).
- [x] grep confirms `dynamic(() => import` + `ssr: false` in `components/workflows/monaco-yaml-editor.tsx` (founder-mode bundle never ships Monaco).
- [x] grep confirms NO `react-flow`/`dagre`/`mermaid` imports anywhere under `dashboard/` (forbidden per plan scope — the repo-wide import scan returned zero matches).

## Plan 06-04: Workflows pages

- [x] Route manifest contains `ƒ /build/workflows`, `ƒ /build/workflows/new`, `ƒ /build/workflows/[slug]` (all 3 dynamic server routes).
- [x] Phase 5 stub copy `"Coming in Phase 6"` GONE from `app/build/workflows/page.tsx` (grep returns 0 matches).
- [x] `workflow-form.tsx` contains both `data-testid="workflow-form-nl-section"` AND `data-testid="workflow-form-yaml-section"` plus `useDevMode()`, `<MonacoYamlEditor>` import, and `<NlDraftTextarea>` import → dev-mode toggle gates founder ↔ dev surfaces in-place sharing the single `yaml` state.
- [x] Client-component import path correctly points to `@/lib/cae-workflows-schema` (the pure-schema module without `fs/promises`) in:
  - `app/build/workflows/workflow-form.tsx`
  - `components/workflows/nl-draft-textarea.tsx`
  - `lib/cae-nl-draft.ts`
  Confirms the 06-04 auto-fixed "pure-schema split" deviation is in place and stable.

## Plan 06-05: Queue KANBAN

- [x] Route manifest contains `ƒ /build/queue`.
- [x] `app/build/queue/page.tsx` source contains: `QueueKanbanClient` ✓, `NewJobModal` ✓, `TaskDetailSheet` ✓.
- [x] `app/build/queue/page.tsx` source does NOT contain: `queueInboxHeading` ✓, `TableHead` ✓, `<Table>` ✓. Phase 2 table UI fully deleted.
- [x] `actions.ts` Phase-2-locked: `git log -- app/build/queue/actions.ts` shows only one post-Phase-2 change, a pure directory rename refactor `36a9fab refactor(03-04): rename app/ops -> app/build, app/build -> app/plan`. No Phase-6 logic changes; `git diff efd1392..HEAD -- app/build/queue/actions.ts` returns an empty diff across all 06-05 commits.
- [x] 5 columns in `queue-kanban-client.tsx`: COLUMNS array has 5 `key:` entries (grep count = 6 including non-COLUMNS matches; runtime testids composed as `queue-column-{key}` + enumerated in comment block for grep-friendliness). Column keys: `waiting`, `in_progress`, `double_checking`, `stuck`, `shipped`. Verified by inspection of lines 24-28.

## Runtime smoke (live dev server on :3002)

- [x] Dev server already running on port 3002 (`next-server` pid 2930216, listening).
- [x] `GET /` → 307 (redirects to signin, expected for unauth request).
- [x] `GET /build/workflows` → 307 redirect to `/signin?from=%2Fbuild%2Fworkflows` (auth-gated, expected).
- [x] `GET /build/queue` → 307 redirect to `/signin?from=%2Fbuild%2Fqueue` (auth-gated, expected).
- [x] `GET /api/workflows` → 200 `{"workflows":[]}` (no auth gate, matches Phase 2 pattern).
- [x] `GET /api/queue` → 200 with 5-bucket shape + live inbox data (no auth gate).
- [x] `POST /api/workflows/some-slug/run` → 401 unauthenticated (auth gate enforced).

## End-to-end round-trip (human-verify gate)

See checkpoint Task 2 — requires signed-in browser session; two UAT flows below pending user sign-off.

### Flow 1 — Workflow creation round-trip (pending)

User to visit http://localhost:3002/build/workflows, click "New recipe", type the canonical NL draft (`Every Monday, Forge runs pnpm test, Sentinel reviews, I approve, then push to main`), press "Draft it", rename to `test-recipe`, toggle dev-mode (Ctrl+Shift+D) to swap textarea → Monaco and back, save, verify list row appears, click Run-now, confirm toast + inbox file created at `.cae/inbox/wf-test-recipe-*/`, then click row → lands on edit page → click Delete recipe → list empties.

### Flow 2 — Queue KANBAN (pending)

User to visit http://localhost:3002/build/queue, verify 5 founder-speak columns (Waiting / Working on it / Double-checking / Stuck / Shipped), toggle dev-mode to flip labels (Planned / Building / Reviewing / Blocked / Merged) and back, observe existing inbox tasks in Waiting + any active tmux sessions in Working-on-it with cyan pulse dot, click "New job" → modal opens, submit a test BUILDPLAN → toast + within 5s card appears in Waiting column, click the card → TaskDetailSheet slides in (sheet reads `?sheet=open&task=...&project=...`, title shows "Phase ?" per 06-05 decision), close with Esc.

## Gaps / blockers

None detected during the automated sweep. Every must-have from Plans 06-01 through 06-05 has a concrete command / grep / live-curl confirming it. The two remaining items are intentional human-verify gates, not gaps:

1. **Visual UAT of Flow 1 (Workflow creation round-trip)** — requires signed-in session in a browser; cannot be scripted end-to-end without a GitHub-OAuth headless harness (out of scope).
2. **Visual UAT of Flow 2 (Queue KANBAN)** — same reasoning.

If UAT surfaces any discrepancy, the orchestrator will route to `/gsd-plan-phase 06-workflows-queue --gaps` and the discrepancy will be appended to this file under a new `## Gaps discovered during UAT` section.

### Pre-existing (scope-boundary, not Phase-6 work)

- `pnpm lint` fails with `Invalid project directory provided, no such directory: .../dashboard/lint` — confirmed pre-existing in 06-05 via `git stash` + lint on parent commit. Likely a `next lint` CLI arg regression from a Next.js 16 upgrade. Separate polish plan should own the fix.
- Turbopack NFT warning on `next.config.ts` → `lib/cae-phase-detail.ts` → `lib/cae-home-state.ts` → `app/api/state/route.ts`. Pre-existing since Plan 06-01; first flagged there.

---
*Phase: 06-workflows-queue*
*Automated sweep completed: 2026-04-22T08:35:00Z*
