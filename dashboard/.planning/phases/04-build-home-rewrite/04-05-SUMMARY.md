---
phase: 04-build-home-rewrite
plan: 05
subsystem: ui
tags: [task-detail-sheet, sse-tail, live-log, keyboard-shortcuts, url-state, shadcn-sheet, phase-4-ui]

# Dependency graph
requires:
  - phase: 04-build-home-rewrite (Plan 04-01)
    provides: /api/tail dynamic ALLOWED_ROOTS (cross-project log streaming), extended StateResponse with home_phases
  - phase: 04-build-home-rewrite (Plan 04-02)
    provides: sheetSection*/sheetLog*/sheetAction*/sheetMemoryStub/sheetCommentsStub copy keys
  - phase: 04-build-home-rewrite (Plan 04-03)
    provides: AgentAvatars component, URL-state scheme (?sheet=open&phase&project[&plan&task])
  - phase: 03-design-system-foundation
    provides: shadcn Sheet + ScrollArea primitives, useDevMode/labelFor, useStatePoll, design tokens

provides:
  - TaskDetailSheet — URL-state-controlled right-slide sheet with 7 sections
  - SheetLiveLog — SSE tail consumer with 500-line cap + pause scroll
  - SheetActions — 6-button stub action row (Approve/Deny/Retry/Abandon/Reassign/Edit plan)
  - useSheetKeys — Esc/Ctrl+./Ctrl+Shift+. keyboard shortcut hook

affects:
  - Plan 04-06 (build-home page assembly) — mounts <TaskDetailSheet /> on /build
  - Phase 8 (Memory tab) — will fill the Memory section placeholder
  - Phase 9 (Chat rail + real pause/abort wiring) — replaces SheetActions stubs and pauseAction/abortAction toasts

# Tech tracking
tech-stack:
  added: []
  patterns:
    - URL-state sheet open/close via ?sheet=open query param (Next.js searchParams + router.push)
    - SSR-safe keyboard hook pattern (typeof window guard + cleanup on enabled=false)
    - Ref-mirror for stale-closure access in effects (pausedRef pattern)
    - Shadcn Sheet width override via className composition (sm:max-w-[50vw])
    - Native <details>/<summary> for collapsed section placeholders (no custom JS)

key-files:
  created:
    - lib/hooks/use-sheet-keys.ts (60 lines)
    - components/build-home/sheet-live-log.tsx (104 lines)
    - components/build-home/sheet-actions.tsx (61 lines)
    - components/build-home/task-detail-sheet.tsx (214 lines)
  modified: []

key-decisions:
  - "closeSheet() explicitly does NOT delete the project URL param (automated grep guard in task-detail-sheet.tsx verify)"
  - "Log path heuristic: '<project>/.cae/logs/p<N>.log' for phase-level; '<project>/.cae/logs/p<N>-<plan>-<task>.log' when plan+task present"
  - "Double-bound Esc: hook AND shadcn Sheet both close — idempotent URLSearchParams.delete makes this safe"
  - "Memory section uses native <details>/<summary> (free a11y + collapsed-by-default without any JS state)"
  - "Pause/Abort buttons carry BOTH visible text AND aria-label for a11y redundancy (survives Plan 04-06 a11y grep)"
  - "SheetLiveLog keeps totalReceived counter separate from bounded lines array so truncation banner triggers on cumulative receipts, not just visible line count"

patterns-established:
  - "Keyboard shortcut hooks consume memoized callbacks from consumers (consumer must useCallback to avoid listener thrash)"
  - "URL-state cleanup: 4 params deleted (sheet/phase/plan/task), 1 preserved (project) — documented inline to prevent regression"
  - "SSE tail with EventSource reset on path change (close old, clear state, open new)"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-04-22
---

# Phase 4 Plan 5: Task Detail Sheet Summary

**Right-slide 7-section sheet with URL-state open/close, SSE live-log tail (500-line cap + pause scroll), and Esc/Ctrl+./Ctrl+Shift+. keyboard shortcuts — founder-speak copy flip throughout.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-22T03:26:42Z
- **Completed:** 2026-04-22T03:30:06Z
- **Tasks:** 3
- **Files created:** 4
- **Files modified:** 0

## Accomplishments

- `useSheetKeys` hook binds Esc/Ctrl+./Ctrl+Shift+. with editable-target guard and SSR safety
- `SheetLiveLog` streams `/api/tail?path=...` via EventSource, caps at 500 lines with truncation banner, toggles auto-scroll via pause button (aria-labeled)
- `TaskDetailSheet` mounts on `?sheet=open` URL param, reads `phase/project/plan/task`, derives log path, renders 7 sections (Header + Summary + Live log + Changes + Memory + Comments + Actions), and closes via overlay/Esc/URL change
- `SheetActions` renders 6 stub buttons (Approve/Deny/Retry/Abandon/Reassign/Edit plan) wired to `toast.info()` pending Phase 9
- **Project URL param preserved on close** — automated grep guard confirms `params.delete("project")` count is 0 in task-detail-sheet.tsx
- Memory section is a Phase-8-placeholder `<details>`/`<summary>` collapsed by default with "ships in Phase 8" subtext

## Task Commits

1. **Task 1: use-sheet-keys.ts** — `78bc395` (feat)
2. **Task 2: sheet-live-log.tsx** — `07c84d1` (feat)
3. **Task 3: sheet-actions.tsx + task-detail-sheet.tsx** — `6cb5d86` (feat)

## Files Created/Modified

### Created
- `lib/hooks/use-sheet-keys.ts` — 60-line keyboard shortcut hook. SSR-safe (`typeof window` guard), skips editable targets, calls `preventDefault + stopPropagation` on matched events. Handles Esc (no modifier), Ctrl/Cmd+. (pause), Ctrl/Cmd+Shift+. (abort). Only active when `config.enabled === true`.
- `components/build-home/sheet-live-log.tsx` — 104-line SSE tail panel. Opens `new EventSource("/api/tail?path=" + encodeURIComponent(path))` on mount, closes on unmount. Bounded array at `MAX_LINES = 500` with `slice(next.length - MAX_LINES)` trim. Separate `totalReceived` counter drives truncation banner (`t.sheetLogTruncatedNote` when `totalReceived > 500`). Pause button uses `pausedRef` to skip `scrollIntoView` while paused, flips label via `t.sheetLogPauseScroll`/`t.sheetLogResumeScroll`, carries explicit `aria-label`. Graceful error fallback on `onerror` → "No log stream available". Empty path short-circuits to error state. `data-testid="sheet-live-log"` on wrapper and `sheet-log-pause-button` on toggle.
- `components/build-home/sheet-actions.tsx` — 61-line 6-button action row. Array-driven render with per-button `testid` (`sheet-action-approve/deny/retry/abandon/reassign/edit-plan`). Deny + Abandon use `variant: "outline"` (non-destructive v1); others use default. Each button emits `toast.info("{key} — wires up in a future phase", { description: "phase=X plan=Y task=Z ..." })`.
- `components/build-home/task-detail-sheet.tsx` — 214-line shell + URL-state + 7-section composition.
  - Reads `searchParams?.get("sheet" | "phase" | "project" | "plan" | "task")`
  - `phaseSummary` lookup in `data.home_phases` matched by phaseNumber + project
  - `closeSheet()` builds fresh URLSearchParams, deletes only `sheet/phase/plan/task`; project preserved (inline comment + automated grep guard)
  - `pauseAction` → `toast.info` + `console.info("[sheet] pause", {...})`
  - `abortAction` → `window.confirm("Abort this task?")` gate, then toast + console
  - `useSheetKeys({ enabled: open, onClose: closeSheet, onPause: pauseAction, onAbort: abortAction })`
  - Log path heuristic: `project + "/.cae/logs/p" + phaseNumber + ("-" + plan + "-" + task)? + ".log"`
  - Overrides shadcn width: `sm:max-w-[50vw] w-full flex flex-col p-0`
  - Pause + Abort buttons in header with both testids AND aria-label
  - Section 5 (Memory) uses `<details><summary>` collapsed by default, renders `t.sheetMemoryStub` subtext + `data-collapsed="true"`

## Decisions Made

- **Project URL param preservation:** `closeSheet` deletes only 4 params (sheet/phase/plan/task). Dropping project would lose the founder's selected context. Enforced with automated grep: `grep -c 'params.delete("project")' === 0`. Rationale: UI-SPEC and CONTEXT explicitly lock this contract.
- **Log path heuristic:** Phase-level fallback is `p<N>.log`; when URL carries `plan` + `task`, append them: `p<N>-<plan>-<task>.log`. Matches PLAN.md's heuristic. Empty project/NaN phase short-circuits to empty path → SheetLiveLog renders "No log stream available".
- **Shadcn Sheet width override:** Default `sm:max-w-sm` is ~24rem, too narrow for a 7-section task sheet. Override with `sm:max-w-[50vw]` on desktop; `w-full` falls through on very narrow screens. Matches CONTEXT §Task detail sheet "50% viewport width on desktop, full width on narrow screens."
- **Memory section = `<details>/<summary>`:** Native disclosure element gives free keyboard focus, toggle behavior, and screen-reader announcement as a disclosure widget. Collapsed-by-default by omitting `open` attribute. No custom JS/state needed. Satisfies "collapsed by default" UI-SPEC §5 requirement.
- **Double-bound Esc (hook + shadcn):** Shadcn Sheet already closes on Esc via base-ui `onOpenChange(false)`. `useSheetKeys` also binds Esc. Both paths call `closeSheet()` which does `router.push(...)` with project preserved. `URLSearchParams.delete` is idempotent, so the double-bind is safe. Rationale: ensures URL-state cleaner fires even if focus is NOT inside SheetContent (e.g., user pressed Esc while hovering outside).
- **`pauseAction` / `abortAction` stubbed via toast:** Per CONTEXT §Deferred, real pause/abort signal wiring lands in Phase 9 or later. Phase 4 ships keyboard + button UI surface with testids and URL-state so future phases only wire behaviour. `abortAction` still carries a `window.confirm()` gate so even the stub has the destructive-action double-check pattern in place.
- **Auto-scroll pause uses ref mirror (`pausedRef`):** `useEffect` that scrolls-to-bottom fires on `lines` change, but reading `paused` state directly would capture a stale closure. Mirror `paused` into `pausedRef` on every render and read via `pausedRef.current` inside the effect. Matches the `tail-panel.tsx` pattern from Phase 2.

## Deviations from Plan

None — plan executed exactly as written.

All three tasks implemented per the `<action>` blocks in 04-05-PLAN.md. No bugs found, no missing critical functionality uncovered, no blocking issues. No architectural changes needed.

## Issues Encountered

**Minor grep false-negative in Task 3 verify (not a code issue):** The plan's `<verify>` block has `grep -cE 'data-testid="sheet-action-(approve|deny|...)"'` which expects inline literal `data-testid="sheet-action-approve"` strings. My implementation (matching the plan's own `<action>` block) renders `data-testid={b.testid}` in JSX with testid values in an array — the runtime DOM emits the correct testids, but the literal-string grep returns 0. Verified independently with `grep -oE 'sheet-action-(approve|deny|retry|abandon|reassign|edit-plan)'` which returns all 6 unique testids. The plan's grep pattern is flawed for its own reference implementation; semantic requirement is fully met.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

**Ready for Plan 04-06 (build-home page assembly):**
- `<TaskDetailSheet />` can be mounted anywhere inside StatePollProvider; it self-manages URL state
- URL click-to-open wired by Plan 04-03's active-phase-cards + Plan 04-04's needs-you-list (both already navigate to `?sheet=open&phase=N&project=...`)
- Log streaming works cross-project thanks to Plan 04-01 Task 4's dynamic ALLOWED_ROOTS
- 6 action buttons and Pause/Abort buttons are `toast.info()` stubs; Phase 9 wires real signals

**Deferred cleanly to future phases:**
- Real pause/abort signal wiring (Phase 9)
- Memory referenced list + click-through (Phase 8)
- Comments thread (Phase 9)
- Changes section data (Phase 9 owns git log integration)

**No blockers or concerns.**

## Self-Check: PASSED

- [x] `lib/hooks/use-sheet-keys.ts` exists (60 lines)
- [x] `components/build-home/sheet-live-log.tsx` exists (104 lines)
- [x] `components/build-home/sheet-actions.tsx` exists (61 lines)
- [x] `components/build-home/task-detail-sheet.tsx` exists (214 lines)
- [x] Commit `78bc395` present in git log
- [x] Commit `07c84d1` present in git log
- [x] Commit `6cb5d86` present in git log
- [x] `pnpm tsc --noEmit` → 0 errors
- [x] `pnpm build` → compiled successfully
- [x] `grep -c 'params.delete("project")' task-detail-sheet.tsx === 0` (project preservation guard)
- [x] `tail-panel.tsx` + `tail-sheet.tsx` untouched (parallel ecosystem preserved)

---
*Phase: 04-build-home-rewrite*
*Completed: 2026-04-22*
