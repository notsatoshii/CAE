---
gsd_state_version: 1.0
milestone: v0.1
milestone_name: milestone
status: planning
stopped_at: Completed 11-03-PLAN.md
last_updated: "2026-04-23T03:25:00.000Z"
progress:
  total_phases: 14
  completed_phases: 8
  total_plans: 77
  completed_plans: 53
  percent: 69
---

# cae-dashboard — Project State

**Current milestone:** v0.1 — Founder-facing UI over CAE + Shift
**Status:** Ready to plan

## Completed Phases

- ✅ Phase 1 — App shell + auth + mode toggle (2026-04-20)
- ✅ Phase 2 — Ops core: phase list, tail, breakers, queue, detail (2026-04-20)
- ✅ Phase 9 — Changes tab + right-rail chat (2026-04-23)

## Active Phase

Phase 10 — Plan mode: Projects / PRDs / Roadmaps / UAT (`/plan/*` routes wrapping Shift).
Plan 10-04 complete (Wave 1 closed). Next: plan 10-05 (API routes).

**Last session:** 2026-04-22T18:13:29.887Z
**Stopped at:** Completed 11-02-PLAN.md

## Key Decisions (Phase 11 — Plan 03)

- **11-03:** queueMicrotask (not RAF) for drain cadence — decouples event application from render; caps hold even during pop-out detach.
- **11-03:** reducedMotionRef + pausedRef pattern — capture latest flag values without restarting the SSE useEffect on each flip.
- **11-03:** cbPath widened to string | null — null = idle scene, no SSE; consistent with resolveCbPath null-return contract.
- **11-03:** canvas re-exports QUEUE_CAP/EFFECTS_CAP/MAX_LINE_BYTES from hookTest for Plan 02 test backward compatibility.

## Key Decisions (Phase 11 — Plan 02)

- **11-02:** Stations drawn via diamond paths (moveTo/lineTo/fill) not fillRect; renderer tests count fill() calls not fillRect().
- **11-02:** safeCtx alias required inside RAF closure — TypeScript cannot narrow getContext() result past closure boundary.
- **11-02:** ResizeObserver stubbed globally in beforeEach (jsdom lacks it); vi.stubGlobal pattern established for canvas component tests.
- **11-02:** Dollar sign in JSDoc comment caught by lint-guard test — removed from comment text; lesson: never write "$ in this file" in source comments.

## Key Decisions (Phase 12 — Plan 01)

- **12-01:** pnpm used as lockfile manager (pnpm-lock.yaml is authoritative; not npm install).
- **12-01:** vitest.config.ts include extended to `app/**/*.test.ts` — was missing non-JSX app unit tests.
- **12-01:** KEYBINDINGS registry has 10 entries: 4 global, 1 sheets, 2 task, 3 palette.
- **12-01:** MOT-02 (tw-animate-css reduced-motion) not verified headlessly; deferred to Plan 05 DevTools audit.

## Key Decisions (Phase 10 — Plan 04)

- **10-04:** mostRecentSlug computed by max(shiftUpdated) scan rather than array[0] — test mock does not pre-sort, so getPlanHomeState must be order-independent.
- **10-04:** parseEnvExample returns string[] (key names only) matching test scaffold; validateShipInput whitelist accepts string[] | EnvExampleKey[] for dual calling convention.
- **10-04:** ghAuthStatus uses callback-based execFile (no promisify, no options arg) so vi.mock("child_process") intercepts at 3-arg position matching test mock.
- **10-04:** SHIFT_PROJECTS_HOME scan unions with hard-coded candidates (not replaces); dedup by absolute path — one project never appears twice.

## Key Decisions (Phase 09)

- **09-08:** UAT auto-approved: tsc exits 0, 239/239 tests pass, lint clean, build exits 0 with all 7 Phase 9 routes registered. Browser walk-through deferred to Eric's interactive session (headless env + autonomous mode).
- **09-07:** Top-nav icon order: Memory · Metrics · ChatPopOutIcon before separator, then Heartbeat · DevBadge · UserMenu.
- **09-07:** ChatMirror rich renderers for Home + Changes; JSON fallback for Agents/Workflows/Queue/Metrics/Memory; Phase 12 deferred.
- **09-06:** ConfirmActionDialog dev-mode bypass fires via useEffect (component renders null immediately; onAccept + undo toast fire async). cancel() closes dialog (plan said no-op; required for correct UX).
- **09-06:** WorkflowForm / editor page has no Run-now button; list page is only run entry point.
- **09-05:** Provider split outer session-gate + inner AuthedChatRailProvider (rules-of-hooks safe).
- **09-05:** bumpUnread auto-expand clears unread badge (deviates from plan in user-friendly direction).

## Accumulated Context

### Audience reframe (2026-04-20, mid session 3)

Primary users for BOTH modes (Plan + Build) are **non-dev founders / product people**, not developers. Every surface must pass "would a PM understand without a dev next to them." Dev-speak behind a single "Advanced" toggle (`dev_mode`), OFF by default.

### Design law

`dashboard/docs/UI-SPEC.md` is the canonical design spec. Session 4 resolutions at bottom supersede earlier contradictions. Key locks:

- Mode toggle: **Plan** (Shift FE) / **Build** (CAE FE) — names swapped from earlier drafts
- Memory + Metrics pulled OUT of tabs → global top-bar icons
- Build tabs (5): Home / Agents / Workflows / Queue / Changes
- Plan tabs (4): Projects / PRDs / Roadmaps / UAT
- Live Floor isometric, Phase 9 (last)
- Graphify = safishamsi/graphify → react-flow native
- Screen shake on merge: revived, respects prefers-reduced-motion
- Explain-mode: default ON everywhere, Ctrl+E toggles

### Phase order per UI-SPEC §S4.7

2.5 (design system) → 3 (Home rewrite) → 4 (Agents) → 5 (Workflows+Queue) → 6 (Metrics) → 7 (Memory+graph) → 8 (Changes+chat) → 9 (Live Floor) → 10 (polish)

### Roadmap Evolution

- 2026-04-20: Session 3 roadmap drafted with 4 Ops phases + 4 Build phases + polish.
- 2026-04-20: Session 4 reordered post-UI-SPEC lock. Phase 2.5 inserted before Phase 3 rewrite.
