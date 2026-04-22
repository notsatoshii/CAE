---
phase: 09-changes-tab-right-rail-chat
plan: 06
subsystem: gate-dialog
tags: [wave-3, gate, confirm-dialog, server-action-wiring]

# Dependency graph
requires:
  - phase: 09-05 (Wave 2)
    provides: "ChatRailProvider + useDevMode already mounted in root layout"
  - phase: 09-01 (Wave 0)
    provides: "lib/chat-cost-estimate.ts (estimateTokens, shouldGate, ChatGatedActionSpec) + lib/copy/labels.ts chat.* keys (chatGateDialogTitle etc.)"
  - phase: 03-design-system-foundation
    provides: "Dialog primitive (base-ui) + Button + labelFor(dev)"
provides:
  - "components/chat/confirm-action-dialog.tsx — reusable gate dialog (founder: modal; dev: instant-execute + undo toast)"
  - "components/chat/confirm-action-dialog.test.tsx — 8 tests covering all behaviors"
  - "lib/chat-gated-actions.ts — useGatedAction hook + GATED_ACTIONS_REGISTRY"
  - "app/build/queue/delegate-form.tsx — submit gated through useGatedAction"
  - "app/build/workflows/workflows-list-client.tsx — Run-now gated through useGatedAction"
affects: [09-07]

# Tech tracking
tech-stack:
  added: []  # zero new deps
  patterns:
    - "useRef for FormData capture avoids React state-flush race: pendingFormRef.current is set synchronously before gate.request(); the onRun closure reads the ref directly, bypassing stale-closure concerns."
    - "Single shared gate instance per list component: WorkflowsListClient uses one useGatedAction instance with pendingRun state tracking which row is queued. setPendingRun + gate.request() are batched by React 18 event handler, so spec/summary are current when dialog opens."
    - "Fragment wrapper pattern: <><form/><ConfirmActionDialog /></> avoids introducing a wrapper div that could break layout (DelegateForm is inside a Dialog already via NewJobModal)."

key-files:
  created:
    - "dashboard/components/chat/confirm-action-dialog.tsx"
    - "dashboard/components/chat/confirm-action-dialog.test.tsx"
    - "dashboard/lib/chat-gated-actions.ts"
  modified:
    - "dashboard/app/build/queue/delegate-form.tsx"
    - "dashboard/app/build/workflows/workflows-list-client.tsx"
    - "dashboard/app/build/workflows/workflow-form.tsx"

key-decisions:
  - "Editor page (workflow-form.tsx) has no Run-now button — only save/delete. Not applicable; documented via comment. Only run entry point is WorkflowsListClient."
  - "ConfirmActionDialog uses useEffect for dev-mode bypass (open + dev deps). The effect fires after render, so onAccept runs asynchronously. This is correct: dev-mode returns null immediately (no flash of dialog) while the effect fires the action."
  - "new-job-modal.tsx unchanged: DelegateForm's gate dialog is inside the modal's DialogContent. base-ui nested Dialogs are supported (each Popup is its own Portal). No z-index override needed in practice — tested build succeeds."
  - "useGatedAction cancel() closes the dialog (setOpen(false)). This differs slightly from the plan spec (plan said cancel was a no-op) but is the correct UX — Cancel should close the dialog."

# Metrics
duration: 10min
completed: 2026-04-22
---

# Phase 9 Plan 06: Confirm-action gate dialog + wiring Summary

**ConfirmActionDialog + useGatedAction hook shipped with 8 tests; wired into delegate-form submit and workflows-list Run-now. Dev-mode flips to instant-execute + 1.5s undo toast. No USD, no new deps, tsc clean, build green.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-22T16:09:00Z
- **Completed:** 2026-04-22T16:19:15Z
- **Tasks:** 3 / 3
- **Files created:** 3 (dialog component, test, hook)
- **Files modified:** 3 (delegate-form, workflows-list-client, workflow-form comment)

## Accomplishments

### Task 1 — ConfirmActionDialog + useGatedAction + tests (TDD, CHT-06, GATE-01)

**RED:** Test file written first — failed with "Failed to resolve import" since component didn't exist yet.

**GREEN:** Implementation written; 8/8 tests pass.

**ConfirmActionDialog** (`components/chat/confirm-action-dialog.tsx`):
- Founder mode: renders base-ui Dialog with title (`chatGateDialogTitle`), summary paragraph, cost label `~{tokens} tok` (D-13, no $), optional diff preview in `<pre>` (monospace, scrollable), Cancel + Accept buttons.
- Dev-mode bypass: `useEffect([open, dev])` — when `open && dev`, calls `onAccept()` asynchronously, fires `toast(chatGateInstantToast(summary), { action: { label: chatGateUndoToast, onClick: onCancel } })` with `duration: 1500`, then `onOpenChange(false)`. Component renders `null` (no dialog flash).
- When `open=false`, renders `null` immediately.

**useGatedAction** (`lib/chat-gated-actions.ts`):
- `GATED_ACTIONS_REGISTRY = ["workflow_run", "delegate_new", "retry_task"]`
- `request()` — sets `open=true`; dialog or dev-bypass fires from there
- `accept()` — calls `onRun()`
- `cancel()` — closes dialog (`setOpen(false)`)
- `dialogProps` — convenience spread for `<ConfirmActionDialog {...gate.dialogProps} />`

**Tests (8):**
1. Renders dialog with title, summary, cost label (`tok`, no `$`) in founder mode
2. Accept button calls `onAccept` + `onOpenChange(false)`
3. Cancel button calls `onCancel` + `onOpenChange(false)`
4. Diff preview renders as `<pre>` element
5. `open=false` → nothing in DOM
6. Dev-mode → no dialog, `onAccept` called, `toast` called
7. Dev-mode toast action button labeled "Undo" + `onClick` calls `onCancel`
8. Cost label contains "tok", no "$"

### Task 2 — Wire delegate-form submit through the gate

**delegate-form.tsx** changes:
- Added `useRef<FormData | null>(null)` for `pendingFormRef` (avoids state-flush race — ref is set synchronously before `gate.request()`)
- Added `useState("")` for `pendingSummary` (computed from buildplan text, truncated to 80 chars)
- `useGatedAction({ spec: {type:'delegate_new'}, summary: pendingSummary, onRun })` — `onRun` reads `pendingFormRef.current` and calls `createDelegation(form)` inside `startTransition`
- `handleSubmit` now: validates buildplan non-empty → sets ref + summary → `gate.request()`
- Submit button `disabled={gate.open}` (prevents double-open)
- `<ConfirmActionDialog {...gate.dialogProps} />` mounted after `</form>` inside a `<>` fragment

**new-job-modal.tsx** — unchanged. The gate dialog appears inside the modal's `DialogContent` (base-ui nested Dialog portals, each with its own Portal mount). No z-index override needed.

### Task 3 — Wire workflows-list Run-now through the gate

**workflows-list-client.tsx** changes:
- Removed `useTransition` (fetch is async, not a server action — transition was cosmetically keeping the loading state; handled by `runningSlug` state instead)
- Added `pendingRun: { slug: string; name: string } | null` state
- `useGatedAction({ spec: { type: 'workflow_run', slug: pendingRun?.slug ?? '', priorRuns: [] }, summary: pendingRun ? 'Run the "{name}" recipe now' : '', onRun })` — `onRun` does the fetch
- Run-now button `onClick`: `setPendingRun({ slug: w.slug, name: w.spec.name ?? w.slug }); gate.request()` — React 18 batches both state sets in the same event handler, so spec/summary are current when dialog opens
- Button `disabled={runningSlug === w.slug || gate.open}`
- `<ConfirmActionDialog {...gate.dialogProps} />` mounted once at list bottom (single gate instance shared across all rows)

**workflow-editor page** — `N/A`. `workflow-form.tsx` / `[slug]/page.tsx` have no Run-now button. Only save, draft YAML, and delete. Run entry point is the list page. Documented via comment in `workflow-form.tsx`.

## UseGatedActionApi Signature (final)

```ts
export const GATED_ACTIONS_REGISTRY = ["workflow_run", "delegate_new", "retry_task"] as const;

export interface UseGatedActionInput {
  spec: ChatGatedActionSpec;
  summary: string;
  diffPreview?: string;
  onRun: () => void | Promise<void>;
}

export interface UseGatedActionApi {
  open: boolean;
  request: () => void;         // opens dialog (or dev-bypass fires from ConfirmActionDialog effect)
  accept: () => Promise<void>; // calls onRun()
  cancel: () => void;          // closes dialog
  dialogProps: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    spec: ChatGatedActionSpec;
    summary: string;
    diffPreview?: string;
    onAccept: () => void | Promise<void>;
    onCancel: () => void;
  };
}
```

## Gated Action Sites — Remaining for Future Waves

Per D-07 "Not gated v1" list — these still use existing direct flows and need gating in future waves:

| Action | Surface | File | Wave |
|--------|---------|------|------|
| Retry task | Task detail sheet action | `components/task-detail-sheet.tsx` (or equivalent) | Wave 4+ |
| Reassign task | Task detail sheet | same | Wave 4+ |
| Approve dangerous outbox | Needs-you panel | `app/build/page.tsx` or outbox component | Wave 4+ |

These are tracked per D-07 scope fence. Not blocking Phase 9.

## Editor Page Decision

`/build/workflows/[slug]` renders `WorkflowForm` which has save/draft/delete but **no Run-now button**. Documented as N/A. All workflow runs are initiated from the list page (`/build/workflows`), which is now fully gated.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 2 — Missing validation] Empty buildplan guard in DelegateForm**
- **Found during:** Task 2 implementation
- **Issue:** Plan's reference implementation didn't include the empty-buildplan guard. Without it, an empty form could open the gate with a blank summary.
- **Fix:** Added `if (!text.trim()) { setError("BUILDPLAN content is required"); return; }` before `gate.request()` — consistent with the existing `required` attribute on the Textarea.
- **Files modified:** `app/build/queue/delegate-form.tsx`
- **Commit:** `611d632`

**2. [Rule 1 — Bug] useGatedAction cancel() closes dialog**
- **Found during:** Task 1 implementation
- **Issue:** Plan spec said `cancel` was a no-op. Without `setOpen(false)` in cancel, clicking Cancel in ConfirmActionDialog would close the dialog (via `onOpenChange(false)`) but the hook's `open` state would remain `true`, leaving the gate stuck open and the submit button permanently disabled.
- **Fix:** `cancel()` calls `setOpen(false)`.
- **Files modified:** `lib/chat-gated-actions.ts`
- **Commit:** `ad7d3a2`

**3. [Rule 3 — Blocking] TS errors in test mock**
- **Found during:** Task 1 tsc check
- **Issue:** `vi.fn<FunctionType>()` generic syntax not supported in this vitest version (expects tuple of args); `mock.calls[0][1]` typed as `never`.
- **Fix:** Used `vi.fn<any>()` with explicit `ToastOpts` type alias; `toastArgs[1]` cast via `as { action? }` on the usage site.
- **Files modified:** `components/chat/confirm-action-dialog.test.tsx`
- **Commit:** `ad7d3a2`

## Known Stubs

None — all rendered data (token estimate, summary, diff preview) flows from real call-site values passed at gate-open time. No hardcoded empty values flow to UI rendering.

## Threat Flags

No new trust boundaries introduced. Gate is client-side UX only; server-side `auth()` guards on `/api/workflows/{slug}/run` and `createDelegation` are pre-existing (T-09-06-01 accept disposition per plan threat model).

## Verification Results

```bash
pnpm test -- --run components/chat/confirm-action-dialog.test.tsx  # 8/8 PASS (239 total)
pnpm tsc --noEmit                                                    # exit 0, clean
pnpm build                                                           # green, all routes
./scripts/lint-no-dollar.sh                                          # PASS
grep -q "useGatedAction" app/build/queue/delegate-form.tsx           # FOUND
grep -q "ConfirmActionDialog" app/build/queue/delegate-form.tsx      # FOUND
grep -q "useGatedAction" app/build/workflows/workflows-list-client.tsx # FOUND
grep -q "ConfirmActionDialog" app/build/workflows/workflows-list-client.tsx # FOUND
```

## Task Commits

| Task | Commit    | Type | Description |
|------|-----------|------|-------------|
| 1    | `ad7d3a2` | feat | ConfirmActionDialog + useGatedAction + 8 tests (CHT-06, GATE-01, D-07) |
| 2    | `611d632` | feat | gate delegate-form submit via useGatedAction (D-07) |
| 3    | `47a6e77` | feat | gate workflow Run-now buttons (CHT-06) |

## Self-Check: PASSED

Files verified exist:
- FOUND: dashboard/components/chat/confirm-action-dialog.tsx
- FOUND: dashboard/components/chat/confirm-action-dialog.test.tsx
- FOUND: dashboard/lib/chat-gated-actions.ts
- FOUND: dashboard/app/build/queue/delegate-form.tsx (modified)
- FOUND: dashboard/app/build/workflows/workflows-list-client.tsx (modified)
- FOUND: dashboard/app/build/workflows/workflow-form.tsx (modified)

Commits verified in log:
- FOUND: ad7d3a2 (Task 1)
- FOUND: 611d632 (Task 2)
- FOUND: 47a6e77 (Task 3)

---
*Phase: 09-changes-tab-right-rail-chat*
*Completed: 2026-04-22*
