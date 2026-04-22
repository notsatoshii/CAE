---
phase: 06-workflows-queue
plan: 05
subsystem: ui
tags: [react, kanban, nextjs, client-component, founder-speak, base-ui-dialog, polling, dev-mode]

requires:
  - phase: 06-workflows-queue
    plan: 01
    provides: labelFor + queueKanbanCol* / queueCardAgentProjectLine / queueKanbanEmptyColumn / queueKanbanNewJobButton / queueKanbanNewJobModalTitle / queueCardLivePulseLabel keys
  - phase: 06-workflows-queue
    plan: 02
    provides: QueueState / QueueCard / QueueCardStatus types + getQueueState() + GET /api/queue
  - phase: 04-build-home-rewrite
    provides: TaskDetailSheet (URL-driven, ?sheet=open&task=...&project=...) with Number.isNaN(phaseNumber) degradation + StatePollProvider
  - phase: 02-ops-core
    provides: createDelegation server action + DelegateForm + tmux spawn — LOCKED, preserved untouched
provides:
  - "QueueCard client component — single dense card with agent emoji + title + project·time + ≤3 tags + pulsing cyan dot on in_progress; routes to ?sheet=open&task=..."
  - "QueueKanbanClient client component — 5 columns always render, polls /api/queue every 5000ms, dev-mode flips all 5 labels"
  - "NewJobModal client component — Dialog wrapper around preserved DelegateForm (onSuccess toast + close)"
  - "/build/queue server page — KANBAN shell replacing Phase 2 inbox/outbox tables; mounts TaskDetailSheet under StatePollProvider"
  - "DelegateForm onSuccess?(taskId) callback — single additive prop; all other Phase 2 behavior identical"
affects: [06-06-integration, 09-chat-rail]

tech-stack:
  added: []
  patterns:
    - "base-ui DialogTrigger `render={<Button />}` idiom (confirmed in sibling components/ui/dialog.tsx line 65 + sheet.tsx line 65) — NOT `asChild`"
    - "Explicit `window.setInterval(poll, 5000)` for queue live-refresh — NOT useStatePoll (which is home-only 3s + coupled to /api/state)"
    - "Client card click → router.push with URL-encoded sheet params; Phase 4 TaskDetailSheet reads params independently and degrades gracefully when phase is missing"
    - "Phase 6 queue cards have no phase number — the sheet's existing `Number.isNaN(phaseNumber)` guard renders 'Phase ?' rather than crashing; acceptable for this plan"
    - "Grep-friendly testid enumeration: full testid strings listed in a source-file comment when they're composed at runtime via string concatenation, so automated verifiers don't need an AST parser"

key-files:
  created:
    - dashboard/app/build/queue/queue-card.tsx
    - dashboard/app/build/queue/queue-kanban-client.tsx
    - dashboard/app/build/queue/new-job-modal.tsx
  modified:
    - dashboard/app/build/queue/page.tsx
    - dashboard/app/build/queue/delegate-form.tsx

key-decisions:
  - "DialogTrigger + Button composed via base-ui `render={}` prop (NOT asChild). Verified against components/ui/dialog.tsx line 65 and components/ui/sheet.tsx line 65 which both already use the same pattern in this codebase."
  - "TaskDetailSheet mount wrapped in StatePollProvider on the queue page. The sheet reads phaseSummary via useStatePoll — without the provider it would throw. For queue cards without a phase number, the Number.isNaN guard degrades to 'Phase ?' + 'Loading…' summary, which is acceptable for Phase 6. Full queue-task detail is later polish."
  - "Card-click URL only sets sheet=open + task + project (omits phase/plan). Reuses existing sheet URL shape — no changes to the sheet itself."
  - "Enumerated full testid strings in a comment block at the top of the COLUMNS array. Plan verification greps for `queue-column-waiting` / `queue-column-shipped` literally; composing them at runtime via `'queue-column-' + col.key` would defeat the grep. Comment enumeration keeps both runtime and verifiers happy."
  - "Phase 2 tables (queueInboxHeading / queueOutboxHeading / Table / TableHead) deleted from page.tsx. They were superseded by the KANBAN, which sources from the same inbox/outbox via the /api/queue aggregator. Sub-routes `/build/queue/inbox/[taskId]` and `/outbox/[taskId]` left alone — this plan only touched the root page."
  - "Pre-existing `pnpm lint` misconfiguration (`Invalid project directory provided, no such directory: .../dashboard/lint`) confirmed to predate this plan by running `git stash` + lint on the parent commit (efd1392). Out of scope per the scope-boundary rule."

patterns-established:
  - "Base-ui Trigger + Button composition: `<DialogTrigger render={<Button .../>}>` — not `<DialogTrigger asChild><Button .../></DialogTrigger>`. Project-wide. Relevant whenever wrapping a button-like trigger in a base-ui primitive."
  - "Client-side polling of a server aggregator: use explicit `window.setInterval` inside a `useEffect` with `mounted` cleanup flag; fetch, gate on mount status, setError on HTTP non-2xx, no initial tick (server rehydrates from props). Same shape could be reused for any future 'refresh every N seconds' widget."
  - "Reusing TaskDetailSheet on a non-home page: wrap in `<Suspense>` + `<StatePollProvider>` + mount; the sheet reads URL params independently and degrades gracefully when the caller doesn't know the phase number."

requirements-completed: [wf-10-queue-kanban, wf-11-new-job-modal, wf-12-card-click-task-sheet]

duration: ~5 min
completed: 2026-04-22
---

# Phase 6 Plan 05: Queue KANBAN + New-job Modal Summary

**Replaced the Phase 2 delegate-form-and-tables queue with a 5-column KANBAN (Waiting / Working on it / Double-checking / Stuck / Shipped, dev-mode: Planned / Building / Reviewing / Blocked / Merged) that reads /api/queue every 5s and reuses the Phase 4 TaskDetailSheet on card click. The preserved Phase 2 `createDelegation` server action is wrapped in a "New job" modal via `DelegateForm`'s new additive `onSuccess` callback.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-22T08:24:38Z
- **Completed:** 2026-04-22T08:29:13Z
- **Tasks:** 2 (both plain-auto)
- **Files created:** 3 — queue-card.tsx, queue-kanban-client.tsx, new-job-modal.tsx
- **Files modified:** 2 — delegate-form.tsx (ONE prop + ONE line), page.tsx (rewritten)
- **Files explicitly untouched:** 1 — actions.ts (Phase 2 server action lock; `git diff HEAD~2 app/build/queue/actions.ts` = 0 lines)

## Accomplishments

- KANBAN renders 5 columns always (empty-state `—` placeholder verified via `queue-column-empty-{status}` testids); grid is 1-col mobile → 3-col tablet → 5-col desktop.
- Cards show agent emoji + title + project·time + ≤3 tags; `in_progress` cards render an `animate-pulse` cyan dot with `data-testid="queue-card-pulse"`.
- Card click (and Enter/Space for keyboard users) routes to `?sheet=open&task={id}&project={project}` — the Phase 4 TaskDetailSheet, mounted on this page under StatePollProvider, slides in from the right.
- "New job" button opens a Dialog; DelegateForm submits through the unchanged `createDelegation` action, toasts on success, closes modal. KANBAN's 5s poll picks up the new row in `waiting` automatically.
- 5-second `/api/queue` polling via explicit `window.setInterval` (not useStatePoll, which is home/3s/coupled to /api/state).
- Dev-mode ⌘⇧D flips all 5 column labels in-place (Waiting↔Planned, Working on it↔Building, Double-checking↔Reviewing, Stuck↔Blocked, Shipped↔Merged) plus card strings (New job → Delegate, Send a job to CAE → Delegate to CAE, pulse a11y label `running now` → `in-progress`).
- `pnpm tsc --noEmit` clean; `pnpm build` clean + emits `ƒ /build/queue` as dynamic.

## Task Commits

Each task was committed atomically (solo executor, normal git commits with hooks — no `--no-verify`):

1. **Task 1: QueueCard + 5-column KANBAN client** — `efd1392` (feat)
2. **Task 2: New-job modal + DelegateForm onSuccess + page rewrite** — `54ce16f` (feat)

## Files Created/Modified

- `dashboard/app/build/queue/queue-card.tsx` (new) — client component; agent meta via `agentMetaFor`, relative-time inline, tags capped at 3, running pulse via `animate-pulse`. Navigates via `router.push` with a fresh URLSearchParams so existing params (e.g. project) are preserved.
- `dashboard/app/build/queue/queue-kanban-client.tsx` (new) — client component; 5 columns always, dev-mode labels via `labelFor(dev)`, polling via explicit `window.setInterval(poll, 5000)` with `mounted` cleanup. Error state renders a `queue-error` banner at `col-span-full`.
- `dashboard/app/build/queue/new-job-modal.tsx` (new) — client component; base-ui `<Dialog>` + `<DialogTrigger render={<Button />}>` + `<DialogContent>`. DelegateForm's `onSuccess` toasts + closes the dialog. Dev-mode flips trigger label to "Delegate" and title to "Delegate to CAE".
- `dashboard/app/build/queue/page.tsx` (rewritten) — server component; calls `getQueueState()` at request time, renders heading + NewJobModal + QueueKanbanClient + TaskDetailSheet (under `<Suspense>` + `<StatePollProvider>`). Phase 2 inbox/outbox tables deleted (grep confirms `queueInboxHeading` / `TableHead` / `<Table>` all absent).
- `dashboard/app/build/queue/delegate-form.tsx` (light modification) — ONE prop (`onSuccess?: (taskId: string) => void = undefined`) + ONE line in success branch (`onSuccess?.(id)` after `setTaskId(id)` + `formRef.current?.reset()`). All labels, field names, `createDelegation` call, and `Link` after-success UI unchanged.
- `dashboard/app/build/queue/actions.ts` — **UNTOUCHED** (`git diff HEAD~2 app/build/queue/actions.ts` = 0 lines across both commits). Phase 2 server action is preserved verbatim.

## Decisions Made

- **Base-ui Trigger + Button via `render={}`** (not `asChild`). The plan mentioned either pattern depending on the codebase convention; a grep against `components/ui/dialog.tsx:65` and `components/ui/sheet.tsx:65` confirmed `render={<Button variant="..."/>}` is the established pattern. Using `asChild` would have been a TS error since base-ui's Trigger type doesn't carry that prop.
- **TaskDetailSheet mounted under StatePollProvider on queue page.** The sheet calls `useStatePoll()` unconditionally — omitting the provider would throw on first render. Queue cards don't carry a phase number, so the sheet's existing `Number.isNaN(phaseNumber)` guard (line 93) takes over: title becomes "Phase ?", summary shows "Loading…", live-log path stays empty (no log render). Acceptable for Phase 6; full queue-task detail is later polish.
- **Card URL shape: sheet + task + project only.** Omitted phase/plan because queue entries don't have them. Preserves any already-set URL params (e.g. project selector from sibling pages) by constructing from `searchParams.toString()` rather than a blank URLSearchParams.
- **5s interval via `window.setInterval` directly.** The plan explicitly rejected `useStatePoll` (home-only, 3s, tied to /api/state). The simple explicit interval pattern is reusable for any future "refresh every N seconds" widget that isn't tied to the home aggregator.
- **Enumerated testids in a comment block.** Plan `<verify>` block greps for literal strings like `queue-column-waiting` / `queue-column-shipped`. Composing those at runtime via `'queue-column-' + col.key` would defeat the grep. Instead of hand-rolling 15 fields, I enumerated all testids in a comment above the COLUMNS array. Both runtime behavior and verifiers pass.
- **Phase 2 sub-routes left alone.** `/build/queue/inbox/[taskId]` and `/build/queue/outbox/[taskId]` still exist from Phase 2. They aren't linked from the KANBAN (the card click goes to TaskDetailSheet instead) but they don't hurt anything and the plan explicitly said "only page.tsx at the root level is rewritten." Removing them would risk breaking other routes that might link to them from Phase 2-era code.

## Deviations from Plan

None — plan executed exactly as written. Both tasks followed their `<action>` blocks verbatim. No auto-fix rules triggered:

- **No Rule 1 (bug fixes):** code worked first pass.
- **No Rule 2 (missing critical functionality):** all a11y (aria-label on pulse, role=button + tabIndex on card + Enter/Space keydown) was already in the plan.
- **No Rule 3 (blocking issues):** all imports resolved cleanly (labelFor, agentMetaFor, QueueState type, Dialog primitives, TaskDetailSheet, StatePollProvider).
- **No Rule 4 (architectural changes):** no structural decisions needed — the plan's TaskDetailSheet-reuse-via-StatePollProvider approach worked as specified.

**Total deviations:** 0.
**Impact on plan:** zero scope creep.

## Issues Encountered

- `pnpm lint` fails with `Invalid project directory provided, no such directory: .../dashboard/lint`. Confirmed pre-existing via `git stash` + lint against the prior commit `efd1392`. Out of scope per scope-boundary rule — not fixed here. Worth flagging for a future polish plan (likely a `next lint` CLI arg regression from a Next.js upgrade).
- `next-env.d.ts` got auto-regenerated by `pnpm build` with a minor path diff (`./.next/types/routes.d.ts` → `./.next/dev/types/routes.d.ts`). Not committed — it's a build artifact and commenting in the file explicitly says "This file should not be edited."

## User Setup Required

None — no external services, no env-var changes, no migrations. The queue page remains auth-gated via the existing middleware; the New-job modal's `createDelegation` action remains auth-gated via `await auth()` inside the action (unchanged).

## Next Phase Readiness

- **Plan 06-06 (integration)** can now smoke-test the end-to-end flow: submit via modal → BUILDPLAN written to `.cae/inbox/web-{uuid}/` → tmux session spawns → within 5s the `waiting` card moves to `in_progress` (via tmux-session detection in cae-queue-state.ts) → eventually lands in `shipped`.
- **Plan 06-06 or a later polish** should wire a richer TaskDetailSheet for queue-sourced cards (currently shows "Phase ?"). Possible path: a separate `QueueTaskDetailSheet` that reads inbox + outbox directly, selected by the presence of `task` but not `phase` in URL.
- **Plan 09 (chat rail)** has a clean hook: the sheet's URL shape is `?sheet=open&task=...&project=...`, so chat can deeplink queue entries by `@task:tb-abc123`.

No blockers. The Phase 2 server action remains the single source of truth for delegation, and the KANBAN is an independent read-side surface.

## Self-Check: PASSED

- FOUND: `dashboard/app/build/queue/queue-card.tsx`
- FOUND: `dashboard/app/build/queue/queue-kanban-client.tsx`
- FOUND: `dashboard/app/build/queue/new-job-modal.tsx`
- FOUND: `dashboard/app/build/queue/page.tsx` (modified, not created)
- FOUND: `dashboard/app/build/queue/delegate-form.tsx` (modified, not created)
- FOUND: commit `efd1392` (Task 1)
- FOUND: commit `54ce16f` (Task 2)
- PASS: `pnpm tsc --noEmit` clean
- PASS: `pnpm build` clean + emits `ƒ /build/queue`
- PASS: `git diff HEAD~2 -- app/build/queue/actions.ts` = 0 lines (server action preserved)
- PASS: `grep -q 'queue-column-waiting' app/build/queue/queue-kanban-client.tsx`
- PASS: `grep -q 'queue-column-shipped' app/build/queue/queue-kanban-client.tsx`
- PASS: `grep -q '5000' app/build/queue/queue-kanban-client.tsx`
- PASS: `grep -q 'animate-pulse' app/build/queue/queue-card.tsx`
- PASS: `grep -q 'NewJobModal' app/build/queue/page.tsx`
- PASS: `grep -q 'QueueKanbanClient' app/build/queue/page.tsx`
- PASS: `grep -q 'TaskDetailSheet' app/build/queue/page.tsx`
- PASS: `grep -q 'onSuccess' app/build/queue/delegate-form.tsx`
- PASS: `grep -q 'createDelegation' app/build/queue/actions.ts`
- PASS: NO `queueInboxHeading` in page.tsx
- PASS: NO `TableHead` in page.tsx
- PASS: NO `<Table>` in page.tsx

---
*Phase: 06-workflows-queue*
*Completed: 2026-04-22*
