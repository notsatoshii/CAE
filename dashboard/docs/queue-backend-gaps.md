# Queue clicked-card sheet — backend gaps

**Tracking tag:** `class19b`  **Owner:** CAE FE team  **Date:** 2026-04-24

The /build/queue clicked-card sheet (`app/build/queue/queue-item-sheet.tsx`)
used to render 8 controls that all fired `toast.info("not yet wired")`. As
of class19b:

| Control      | Status | Endpoint                                                                 |
|--------------|--------|--------------------------------------------------------------------------|
| abort        | WIRED  | `POST /api/queue/item/[taskId]/action` with `{action:"abort"}`           |
| retry        | WIRED  | `POST /api/queue/item/[taskId]/action` with `{action:"retry"}`           |
| approve      | WIRED  | `POST /api/queue/item/[taskId]/action` with `{action:"approve"}`         |
| deny         | WIRED  | `POST /api/queue/item/[taskId]/action` with `{action:"deny"}`            |
| **pause**    | HIDDEN | no backend                                                               |
| **abandon**  | HIDDEN | no backend (different semantics from abort — see below)                  |
| **reassign** | HIDDEN | no backend                                                               |
| **edit-plan**| HIDDEN | no backend                                                               |

Gap count: **4**.

---

## What each missing endpoint needs

### `pause`
Suspend a running task without dropping its progress. The cae runner has no
native pause primitive — tmux `kill-session` is a hard stop, not a pause.
Options being weighed:
- Send `SIGSTOP` to the cae process inside the tmux pane. Problematic:
  SIGSTOP is unrecoverable if the orchestrator restarts and the pane dies.
- Write a `PAUSE` marker that the runner checks on each wave boundary.
  Requires a runner change in `bin/cae`.

Until a design is agreed, the Pause control is hidden.

### `abandon`
Distinct from abort. Abort writes a `HALT` marker so the kanban shows
"stuck" (retry reopens it). Abandon should permanently close the task —
move the inbox dir to outbox with `STATUS: abandoned` and record the
dashboard actor. Trivial to add (similar to abort + rename dir) but we want
to nail the audit trail shape first. Tracked as **QUEUE-ABANDON-001**.

### `reassign`
Hand a task off to a different agent mid-run. Needs the runner to accept
a mid-flight `REASSIGN:<agent>` marker. No hook exists today. Tracked as
**QUEUE-REASSIGN-001**.

### `edit-plan`
Open the BUILDPLAN.md in an inline editor and push a new revision to the
task dir. Requires either (a) embedding a rich-text editor in the sheet or
(b) linking to a dashboard route that serves a monaco/codemirror editor.
Tracked as **QUEUE-EDITPLAN-001**.

---

## Restoring a hidden control

To re-enable any of the four hidden controls:

1. Add a handler in `lib/cae-queue-item.ts` mirroring `abortTask` /
   `retryTask` — return the `MutationResult` shape.
2. Add the action name to the `ACTIONS` set and switch in
   `app/api/queue/item/[taskId]/action/route.ts`.
3. In `app/build/queue/queue-item-sheet.tsx`, add a button that invokes
   `invoke("<action>")` and gate its `show…` flag on the appropriate
   `item.status`.
4. Extend the playwright spec to click the new button and assert a non-
   error toast (or non-404 response from the stubbed endpoint).

Do not replace a hidden control with another `toast.info` stub — that is
the regression this class19b fix closes.
