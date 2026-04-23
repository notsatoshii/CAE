# /build/queue Diagnosis

**Date:** 2026-04-24
**Reporter:** opus-4-7 (read-only diagnosis, no edits, no playwright, no commits)
**Server:** http://localhost:3002 (turbopack dev, PID 722407)
**Scope:** `/build/queue` kanban page, the "New job" modal, queue card clicks → TaskDetailSheet, and backing API.

---

## 1. Headline

**The queue is NOT broken at the data/render layer.** The KANBAN renders all 5 columns, all 10 existing tasks bucket correctly (3 waiting + 7 shipped), and the GET /api/queue route returns live JSON. The New-Job form writes real inbox files and fires a real tmux spawn of `cae execute-buildplan`.

**What IS broken is everything the user actually WANTS to do with the queue after the task is listed.** All 8 interactive actions on a queue card's detail sheet are stubbed toasts ("wires up in a future phase"). There is no drag-and-drop. There is no per-card "run now / retry / pause / approve" wired to any backend. If Eric is clicking cards expecting to control the queue, every control is a `toast.info(...)` placeholder — that is almost certainly why he says "it doesn't work."

---

## 2. Data layer — is the queue showing tasks?

**YES.** Live API response (`curl -b authjs.session-token=<dev-token> http://localhost:3002/api/queue`):

```
counts: { waiting: 3, in_progress: 0, double_checking: 0, stuck: 0, shipped: 7 }
```

- Inbox = `/home/cae/inbox/` (3 tasks: tb-e2e-v2, tb-e2e-v3, tb-real-e2e). Source: `lib/cae-config.ts:2`, `lib/cae-state.ts:137`.
- Outbox = `/home/cae/outbox/` (7 dirs, each with DONE.md). Source: `lib/cae-config.ts:3`, `lib/cae-state.ts:160`.
- Bucketing: `lib/cae-queue-state.ts:119-176` (unit-tested, logic correct).
- Tmux probe: `lib/cae-queue-state.ts:180-194` — zero `buildplan-*` sessions currently running (confirmed via `tmux list-sessions`), so `in_progress` is correctly empty.

**Page HTML output** (curl with dev session cookie) contains all expected testids:
- `data-testid="build-queue-root"` (root)
- `data-testid="queue-kanban"` (grid)
- 5 × `queue-column-{waiting,in_progress,double_checking,stuck,shipped}`
- 5 × `queue-column-count-*`
- 3 × `queue-column-empty-*` (in_progress, double_checking, stuck)
- 7 × `queue-card-<taskId>` (3 waiting + 4 shipped rendered in first SSR pass; the other 3 shipped also present — 7 total)
- `queue-new-job-trigger` (button)

**Root dir permission anomaly (informational, NOT the bug):** `/home/cae/inbox` is owned `root:timmy` with 775 perms; dashboard process runs as `root` (uid=0), so reads work. Also spawned tmux session runs as root, which may or may not be what Eric wants (CAE was historically supposed to drop to `cae` user — see the `Class 18 sudo-u-cae migration` handoff note). That's a separate security concern — does not break the queue UI.

---

## 3. Per-control status

### 3a. Page header
| Control | Testid | File:line | Status | Notes |
|---|---|---|---|---|
| `queueHeading` text | `build-queue-heading` (unused here) / inline h1 | `app/build/queue/page.tsx:33` | working | Static label, fine. |
| "New job" button | `queue-new-job-trigger` | `app/build/queue/new-job-modal.tsx:36` | working | Opens modal. |

### 3b. New-Job modal (DelegateForm inside Dialog)
| Control | File:line | Status | Notes |
|---|---|---|---|
| `target_repo` input | `app/build/queue/delegate-form.tsx:70` | working | Optional. |
| `buildplan` textarea | `app/build/queue/delegate-form.tsx:79` | working | Required. |
| Submit button | `app/build/queue/delegate-form.tsx:88` | working (end-to-end) | Flow: submit → `useGatedAction.request()` → `ConfirmActionDialog` (auto-accepts in dev-mode, line 33-47 of that file) → `onRun` → `createDelegation(formData)` (server action). |
| Server action `createDelegation` | `app/build/queue/actions.ts:13-49` | working | Writes `/home/cae/inbox/web-<uuid>/BUILDPLAN.md` + META.yaml, then `spawn("tmux", ["new-session","-d","-s",`buildplan-${shortId}`,`cae execute-buildplan ${taskId}`], {detached:true,stdio:"ignore"})`. Fire-and-forget — if tmux/cae fail you'd never know, but both binaries exist (`/usr/bin/tmux`, `/usr/local/bin/cae`). Role-checked (operator) at line 20. `revalidatePath("/build/queue")` at line 47. |
| Toast on success | `app/build/queue/new-job-modal.tsx:47` | working | Shows taskId, closes modal. 5s poll picks up new card. |

**Note:** new jobs get prefix `web-` (line 28), which `shortIdForTmux` (`cae-queue-state.ts:88`) strips before matching the session. The ONE thing that could silently misbehave: if `cae execute-buildplan` crashes immediately after spawn, the tmux session would have ended before the next 5s poll, and the card would stay "waiting" forever with no UI feedback. There's no error-reporting channel from the spawned process back to the UI.

### 3c. Kanban columns + cards
| Control | Testid | File:line | Status | Notes |
|---|---|---|---|---|
| Column render × 5 | `queue-column-*` | `queue-kanban-client.tsx:148-178` | working | All 5 always render, shows "No items" when empty. |
| Count chip × 5 | `queue-column-count-*` | `queue-kanban-client.tsx:161-164` | working | Uses `cards.length`. |
| Drag-and-drop between columns | — | — | dead (never existed) | `grep` for `onDragStart`/`onDrop` in `app/build/queue/` + `components/queue/`: zero hits. No DnD library imported. If Eric expects trello-style drag, **the feature was never built**. |
| Card click | `queue-card-<id>` | `queue-card.tsx:56-65` | working (opens sheet) | Pushes URL `?sheet=open&task=<id>&project=<proj>`. Does NOT set `phase` param (comment at line 46-48 acknowledges this). Keyboard Enter/Space also fires. |
| Pulsing live dot | `queue-card-pulse` | `queue-card.tsx:104-110` | working | Only when `status === "in_progress"`. With zero running sessions right now, invisible. |
| Per-card "run now / retry / delete" context menu | — | — | dead | No right-click handler, no per-card buttons. Only the whole-card open-sheet action. |
| 5s polling | — | `queue-kanban-client.tsx:52-76` | working | First tick fires 5s after mount, sets `setState(next)`. Errors render `<div data-testid="queue-error">` at line 182-186. |

### 3d. TaskDetailSheet (opened from card click)
| Control | Testid | File:line | Status | Notes |
|---|---|---|---|---|
| Sheet open/close | `task-detail-sheet` | `components/build-home/task-detail-sheet.tsx:98-102` | working | URL `?sheet=open`. |
| Title | inline | `task-detail-sheet.tsx:93-95` | partial ⚠ | Queue cards never set `phase`, so `phaseNumber` is NaN and the title always says **"Phase ?"**. This matches the code comment but looks broken to a founder. |
| Agent avatars | `phaseSummary && <AgentAvatars>` | `task-detail-sheet.tsx:113` | dead (for queue tasks) | `phaseSummary` is always null (no phase number), so avatars never render. |
| `TaskHeaderSummary` chips (stage/wave/ETA/cost) | inline | `task-detail-sheet.tsx:121` + `task-header-summary.tsx` | partial ⚠ | Fed `phase={null}` for queue — degrades. |
| Pause button | `sheet-pause-button` | `task-detail-sheet.tsx:124-132` | stub ⬛ | `pauseAction` = `toast.info("Pause signal sent — wiring in a future phase", ...)`. Line 61-66. |
| Abort button | `sheet-abort-button` | `task-detail-sheet.tsx:133-141` | stub ⬛ | `abortAction` = `toast.info("Abort signal sent — wiring in a future phase", ...)`. Line 68-74. |
| Summary section | `sheet-section-summary` | `task-detail-sheet.tsx:148-172` | dead (for queue tasks) | Shows a skeleton forever because `phaseSummary` never loads for a queue-card context. |
| Live log section | `sheet-section-log` | `task-detail-sheet.tsx:175-180` + `sheet-live-log.tsx` | dead (for queue tasks) | `logPath` is `""` (heuristic at line 84-91 requires phase+project, both absent for queue). `SheetLiveLog` immediately renders `"No log stream available"` at line 34-37. |
| Changes section | `sheet-section-changes` | `task-detail-sheet.tsx:183-190` | stub ⬛ | Hard-coded `"No commits yet."`. Comment line 182: "stub — data not in home state v1". |
| Memory section | `sheet-section-memory` | `task-detail-sheet.tsx:197-206` | stub ⬛ | Comment line 192-196: "ships in Phase 8". Currently Phase 15; still a stub. |
| Comments section | `sheet-section-comments` | `task-detail-sheet.tsx:209-216` | stub ⬛ | Line 208: "stub until Phase 9". |
| Action buttons (6): approve / deny / retry / abandon / reassign / edit-plan | `sheet-action-approve`, `-deny`, `-retry`, `-abandon`, `-reassign`, `-edit-plan` | `components/build-home/sheet-actions.tsx:20-58` | stub ⬛ × 6 | `invoke(key)` at line 34-39 = `toast.info(key + " — wires up in a future phase", ...)`. **Every single one.** |
| Log pause-scroll button | `sheet-log-pause-button` | `sheet-live-log.tsx:102-110` | working | Only toggles local scroll state — no backend. Irrelevant when there are no log lines. |

### 3e. Sidebar & nav (incidental)
| Control | File:line | Status |
|---|---|---|
| Sidebar "Queue" link | `components/shell/sidebar.tsx:92` | working |
| Build-rail tab "Queue" | `components/shell/build-rail.tsx:23` | working |

---

## 4. Root causes grouped

### RC-1: Every action from a clicked queue card is a placeholder toast (P0)
Impact: 8 buttons lie to the user (Pause, Abort, Approve, Deny, Retry, Abandon, Reassign, Edit plan). Not one is wired to a backend.
Evidence:
- `components/build-home/task-detail-sheet.tsx:62` (Pause)
- `components/build-home/task-detail-sheet.tsx:70` (Abort)
- `components/build-home/sheet-actions.tsx:35` (all 6 inner actions)

### RC-2: TaskDetailSheet is phase-shaped, queue cards are task-shaped (P1)
The sheet was built for Home tab (phases). Queue cards push `?task=<id>&project=<proj>` without `phase=`. The sheet's whole right-pane assumes `phaseNumber` is a valid integer:
- Title degrades to "Phase ?" (`task-detail-sheet.tsx:93-95`).
- `phaseSummary` stays null forever → summary is a loading skeleton (`:152-171`).
- `logPath` guard requires phase + project → returns "" → live log shows "No log stream available" (`:84-91` + `sheet-live-log.tsx:34-37`).
- AgentAvatars gated on `phaseSummary` → never render (`:113`).

Comment at line 37-43 of `page.tsx` explicitly acknowledges: *"Queue cards don't supply a phase number, so the sheet's Number.isNaN(phaseNumber) guard kicks in and renders 'Phase ?' gracefully — acceptable for Phase 6. Full queue-task detail rendering is a later polish."* — that "later polish" is still owed.

### RC-3: No drag-and-drop (P2 — or non-bug if never promised)
Columns are pure render-by-status. There is no handler to move a card from e.g. "stuck" → "waiting" (would need a "resume" signal to CAE). No DnD library is imported. If Eric expects Trello-style, **it does not exist yet**.

### RC-4: No per-card quick actions on the card itself (P2)
Each card is one large button that opens the sheet. No "run now" / "delete" / "move" buttons on the card face. Users must drill into the sheet, then find all sheet actions are stubs → dead end.

### RC-5: Failed `cae execute-buildplan` spawns leave stranded "waiting" cards (P2)
`actions.ts:40-45` is fire-and-forget with `stdio:"ignore"`. If the `cae` CLI exits immediately (e.g. wrong-perm, missing $PATH for spawned tmux, OAuth broken per `bug_claude_cli_2.1.117_headless_oauth.md`), there is no UI signal — the card remains "waiting" forever until an operator manually notices.

### RC-6: Polling-only refresh is slower than operator expects (P3, minor)
5-second poll interval (`queue-kanban-client.tsx:71`). A user clicks "New job" and waits up to 5s for the card to appear. `revalidatePath` at `actions.ts:47` helps on SSR reload, but the client-side `setState` still waits for the next interval tick. Could use the returned `taskId` to optimistically insert.

### RC-7: Sheet sections 4 ("Changes"), 5 ("Memory"), 6 ("Comments") are hard-coded stubs (P3)
Comments in code refer to "ships in Phase 8", "stub until Phase 9". Project is in Phase 15 now — these were never filled in. See `task-detail-sheet.tsx:183-216`.

### RC-8: Auth coupling makes debugging awkward (informational)
`GET /api/queue` returns `{error:"unauthenticated"}` for any cookieless curl. The audit pipeline has a minted session at `audit/auth/storage-state.json`; any human reproing a bug needs to pull the token from that file. Consider an explicit DEV_AUTH_BYPASS env flag for local work (not a queue bug per se).

---

## 5. Fix recommendations (file:line precision, priority-ordered)

### P0 — Wire the sheet-actions and sheet header buttons to real endpoints
Create new API endpoints under `app/api/queue/[taskId]/` and replace the stub `toast.info` calls:

1. `app/api/queue/[taskId]/abort/route.ts` — POST. `tmux kill-session -t buildplan-<shortId>`, and/or `touch /home/cae/inbox/<taskId>/HALT`.
   - Then `task-detail-sheet.tsx:68-74` `abortAction` → `await fetch("/api/queue/"+task+"/abort", {method:"POST"})`.
2. `app/api/queue/[taskId]/pause/route.ts` — POST. Send `SIGSTOP` to tmux pane or write `PAUSE` marker. Hook up `task-detail-sheet.tsx:61-66`.
3. `app/api/queue/[taskId]/retry/route.ts` — POST. Remove HALT marker, re-spawn tmux session. Replace `sheet-actions.tsx:34-39` for key==="retry".
4. `app/api/queue/[taskId]/abandon/route.ts` — DELETE. Move `/home/cae/inbox/<taskId>` → `/home/cae/inbox/.abandoned/<taskId>`. For "abandon".
5. approve/deny/reassign/edit-plan — design per CAE's review gate protocol (out of scope for this diagnosis).

Middleware matcher `/api/queue/:path*` is already in `middleware.ts:112` so these endpoints get auth + operator-role gating for free (add to `operatorMutations` list at `:67-76`).

### P0 — Fix the sheet's phase-assumption for queue tasks
In `components/build-home/task-detail-sheet.tsx`:
- Line 38-45: when invoked from a queue context (no `phase` param), fetch the InboxTask/OutboxTask directly from `/api/queue` response (or a new `/api/queue/:taskId` endpoint) and populate a `taskSummary` sibling to `phaseSummary`.
- Line 93-95: when `phase` absent, use the task title (already provided in `QueueCard.title`) instead of "Phase ?".
- Line 84-91: log path for queue tasks should be e.g. `/home/cae/outbox/<taskId>/forge-prompt.md.output` or `.cae/logs/<taskId>.log` — whatever `cae execute-buildplan` actually writes. Audit CAE core to discover the right path.
- Line 113: skip AgentAvatars entirely when no phase.

### P1 — Add per-card quick-actions and a proper task view for queue tasks
Either:
- (a) Add in-card action buttons ("Run", "Kill", "Move to stuck") on hover (see `queue-card.tsx:52-111`), or
- (b) Redesign TaskDetailSheet to branch: queue-task view vs. phase-task view, with distinct sections.

### P2 — Surface spawn failures
In `app/build/queue/actions.ts:40-45`, upgrade from `{stdio:"ignore"}` to capturing stderr to `/home/cae/inbox/<taskId>/spawn.log`. On the UI side, when a card has a `spawn.log` but no corresponding tmux session, bucket it as "stuck" (extend `cae-queue-state.ts:computeStuckFromCircuitBreakers` or add a new check).

### P2 — Add drag-and-drop OR remove the affordance of columns-look-draggable
If DnD isn't coming, columns should not visually invite dragging (cards currently have `cursor:pointer` via `card-base--interactive`). Either ship `@dnd-kit/core` integration in `queue-kanban-client.tsx`, or ensure cards look strictly clickable (not draggable).

### P3 — Optimistic update on "New job"
In `app/build/queue/new-job-modal.tsx:46-50`, after `onSuccess` fires, push a synthetic waiting-card into kanban state via a shared context/store before the 5s poll catches up. Removes the "did it work?" pause.

### P3 — Replace stubbed detail sheet sections
`components/build-home/task-detail-sheet.tsx:183-216` — Changes/Memory/Comments sections. Either ship the real feature or delete the stubs (they add noise without value).

---

## 6. Summary table

| Group | Controls total | ✅ working | ⚠ partial | ❌ dead / ⬛ stub |
|---|---|---|---|---|
| Page header | 2 | 2 | 0 | 0 |
| New-job modal (incl. server action) | 5 | 5 | 0 | 0 |
| Kanban render/poll | 4 | 4 | 0 | 0 |
| Card → sheet open | 2 (click + keyboard) | 2 | 0 | 0 |
| Sheet header (title, avatars, chips, pause, abort) | 5 | 0 | 3 | 2 stubs |
| Sheet body sections (summary, log, changes, memory, comments) | 5 | 0 | 0 | 2 dead + 3 stubs |
| Sheet action buttons | 6 | 0 | 0 | 6 stubs |
| Per-card quick-actions | 0 | — | — | never built |
| DnD | 0 | — | — | never built |
| **Totals** | **29** | **13** | **3** | **13 non-working** |

**Bottom line for Eric:** The queue renders your data truthfully. Creating jobs works. But the moment you click a card expecting to DO something with that task, every button is a fake. The work-queue is read-only-plus-create — not a work-management surface. That's almost certainly what he means by "doesn't work."
