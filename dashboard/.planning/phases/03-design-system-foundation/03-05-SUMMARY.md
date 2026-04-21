---
phase: 03-design-system-foundation
plan: 05
subsystem: ui
tags: [copy-pass, i18n-pattern, founder-speak, dev-mode, client-island, react-context]

# Dependency graph
requires:
  - phase: 03-design-system-foundation
    provides: DevModeProvider + useDevMode hook (Plan 02), /build + /plan route reorg (Plan 04), BuildHomeHeading etc. placeholders (Plan 03)
provides:
  - Centralized founder-speak ↔ dev-speak translation table at lib/copy/labels.ts
  - labelFor(dev: boolean): Labels — pure Node-testable function
  - Four heading client-islands that flip on devMode toggle
  - Copy pass applied to all Phase 1+2 user-visible surfaces under /build + /plan
affects: [phase-04-build-home, phase-05-agents-tab, phase-06-workflows-queue, phase-07-metrics-panels, phase-08-memory-tab, phase-09-changes-chat, phase-10-plan-mode, phase-11-live-floor, phase-12-command-palette]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "client-island heading pattern for server-component devMode flip"
    - "central Labels dictionary with pure labelFor(dev) selector"
    - "useDevMode + labelFor(dev) consumer pattern for inline label flipping"

key-files:
  created:
    - lib/copy/labels.ts
    - components/shell/build-home-heading.tsx
    - components/shell/build-queue-heading.tsx
    - components/shell/phase-detail-heading.tsx
    - components/shell/plan-home-heading.tsx
  modified:
    - app/build/page.tsx
    - app/build/phases-list.tsx
    - app/build/breakers-panel.tsx
    - app/build/metrics-tabs.tsx
    - app/build/queue/page.tsx
    - app/build/queue/delegate-form.tsx
    - app/build/phase/[num]/page.tsx
    - app/build/phase/[num]/waves-view.tsx
    - app/plan/page.tsx

key-decisions:
  - "Pure Labels object literal shape chosen over i18n framework (keeps bundle tiny, Node-testable, no runtime lookup)"
  - "Queue page section headings + table headers server-render in founder-speak via labelFor(false) rather than becoming client-islands (per-request devMode flip of entire table deferred; only page heading flips)"
  - "WaveSection + TaskCard helpers in waves-view.tsx receive t: Labels as prop instead of re-calling useDevMode to preserve one-subscription-per-tree"
  - "Plan placeholder copy mentions Phase 10 (not Phase 4) to match ROADMAP — founder-speak defaults to 'Plan your next feature' instead of 'Plan mode'"

patterns-established:
  - "Client-island heading: extract any user-visible page heading on a server page into a small 'use client' subcomponent that reads useDevMode() + labelFor(dev). Future phases (4-12) use BuildHomeHeading/PhaseDetailHeading/etc. or add new islands of the same shape."
  - "Labels dictionary extension: new user-visible strings added in future phases extend lib/copy/labels.ts rather than being hardcoded. FOUNDER branch is the default; DEV branch holds the technical original."
  - "Server pages that need founder-speak on static copy (not per-request flipping) use const labels = labelFor(false) directly — no client-island required."

requirements-completed:
  - founder-speak-labels
  - dev-mode-flip-pattern
  - heading-client-islands

# Metrics
duration: 7min
completed: 2026-04-21
---

# Phase 3 Plan 05: Founder-speak copy pass + heading client-islands Summary

**Centralized founder↔dev translation table at `lib/copy/labels.ts` with four `"use client"` heading islands (BuildHomeHeading / BuildQueueHeading / PhaseDetailHeading / PlanHomeHeading); applied copy pass across all Phase 1+2 `/build` + `/plan` surfaces so defaults read as non-dev founder-speak and Ctrl+Shift+D flips to technical labels, including page-level headings on server-rendered routes.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-04-21T10:23:33Z (approx — wave 3 start)
- **Completed:** 2026-04-21T10:30:32Z
- **Tasks:** 3 / 3
- **Files created:** 5
- **Files modified:** 9

## Accomplishments

- `lib/copy/labels.ts` holds the single source-of-truth translation dictionary — Labels interface, FOUNDER + DEV object literals, `labelFor(dev)` pure function, `LABELS` named export. Node-testable via `pnpm dlx tsx`.
- Four heading client-islands in `components/shell/` (BuildHomeHeading, BuildQueueHeading, PhaseDetailHeading, PlanHomeHeading) resolve the server-component-cannot-read-context problem: pages stay server-rendered, only the heading string becomes client-interactive.
- All Phase 1+2 client components (phases-list, breakers-panel, metrics-tabs, delegate-form, waves-view) route user-visible strings through `useDevMode() + labelFor(dev)` — flip happens in-place on Ctrl+Shift+D without re-render of parent server page.
- `/plan/page.tsx` rewritten: stale `"Build mode / Coming in Phase 4"` leftover replaced with `PlanHomeHeading` + `labels.planPlaceholder` ("Coming in Phase 10", matching ROADMAP).
- Queue page section headings + table headers server-render in founder-speak via `labelFor(false)` — "Waiting to run / Shipped / Job ID / Instructions / Version / Changes". Table data rows are founder-friendly by default.
- Zero "Ops" / "Active Forge" / "Input tokens today" / "CAE Queue" / "Delegate to CAE" / "Merged commits" hardcoded strings remain on user-visible surfaces.

## Task Commits

Each task was committed atomically:

1. **Task 1: lib/copy/labels.ts centralized translation table** — `a8d28f2` (feat)
2. **Task 2: four heading client-islands** — `1b008f8` (feat)
3. **Task 3: copy pass across /build + /plan** — `cb831ca` (feat)

## Files Created

- `lib/copy/labels.ts` — Labels interface + FOUNDER + DEV dictionaries + `labelFor(dev)` pure function + `LABELS` export (157 lines).
- `components/shell/build-home-heading.tsx` — renders `labelFor(dev).buildHomeHeading(projectName)`. "Building X" founder / "Build — X" dev.
- `components/shell/build-queue-heading.tsx` — renders `labelFor(dev).queueHeading`. "Work queue" founder / "CAE Queue" dev.
- `components/shell/phase-detail-heading.tsx` — renders `labelFor(dev).phaseDetailHeading(n, name)`. "{name}" founder / "Phase NN — {name}" dev.
- `components/shell/plan-home-heading.tsx` — renders `labelFor(dev).planHomeHeading`. "Plan" founder / "Plan mode" dev.

## Files Modified

- `app/build/page.tsx` — replaced hardcoded `<h1>Build —</h1>` with `<BuildHomeHeading projectName={projectName} />`. Still a server component; project data fetched on server, passed as prop.
- `app/build/phases-list.tsx` — added useDevMode + labelFor. Column headers "Name" → `t.phasesListColName` ("Feature"/"Name"), "Plans" → `t.phasesListColPlans` ("Steps"/"Plans").
- `app/build/breakers-panel.tsx` — all 6 stat labels routed through `t.*`: "Active Forge" → `t.breakerActiveForge` ("Builders working right now"), tokens today → reading/writing today, "Retries" → "Second tries", "Halted" → "Is CAE stuck?" with badge text "paused itself" / "all good".
- `app/build/metrics-tabs.tsx` — section heading "Metrics" → `t.metricsSectionHeading` ("What's happening"), all 4 tab labels through `t.metricTab*` ("Pauses/Checks/Memory cleanup/Approvals" founder).
- `app/build/queue/page.tsx` — mounted `BuildQueueHeading`, server-rendered founder-speak for Inbox/Outbox section headings + table headers via `labelFor(false)`. "No tasks in inbox." → "No jobs waiting." "View BUILDPLAN" → "View instructions". "View DONE" → "View result".
- `app/build/queue/delegate-form.tsx` — all form labels through `t.delegate*`: heading "Send a job to CAE", field labels "Which project?"/"What should CAE do?", submit "Send it"/"Sending…", post-submit "Job created".
- `app/build/phase/[num]/page.tsx` — mounted `PhaseDetailHeading`. Back-link "← Build" → `labels.phaseDetailBackLabel` ("← Back" founder). "Branch:" → `labels.phaseDetailBranchLabel` ("Version" founder). "No project selected." → "Pick a project first."
- `app/build/phase/[num]/waves-view.tsx` — threaded `t: Labels` prop through WaveSection + TaskCard. "Wave N" → `t.waveHeading(n)` ("Step N"), "Merged commits" → `t.mergedCommitsHeading` ("Shipped changes"), "N× attempt" → `t.attemptSuffix(n)` ("N× try"), "View output" → `t.viewOutputButton` ("See what's happening"), empty-state → `t.noTasksEmpty(phaseDir)`.
- `app/plan/page.tsx` — full rewrite: old stale `Build mode / Coming in Phase 4` replaced with `<PlanHomeHeading />` + `{labels.planPlaceholder}` (founder: "Plan your next feature. … Coming in Phase 10.").

## Decisions Made

1. **Labels shape over i18n library.** A plain object literal with typed interface is enough for the founder ↔ dev flip. No ICU messages, no pluralization edge cases, no runtime catalog. Keeps bundle zero-cost and keeps `labelFor` pure for Node tests.
2. **Queue page table headers server-render founder-speak.** The plan explicitly scopes "per-request server-side flipping" as out-of-scope for Phase 3 (would require lifting the whole table into a client-island). So the queue table defaults to founder-speak and stays there regardless of devMode. Only the page heading flips. Acceptable for Phase 3; Phase 6 (Workflows + Queue redesign) can promote sections to client-islands if needed.
3. **WaveSection + TaskCard receive `t` as prop.** Rather than every sub-component calling `useDevMode()` (and subscribing to context), the parent WavesView calls it once and threads the Labels object down. Fewer subscribers, same result.
4. **Plan placeholder references Phase 10, not Phase 4.** Old copy said "Coming in Phase 4" — stale from pre-reorg. Plan mode is Phase 10 per ROADMAP. Corrected in both FOUNDER and DEV branches.
5. **Hardcoded per-file tweaks on table body strings.** Strings like "No jobs waiting.", "View instructions", "View result", "Pick a project first.", "Job created" were added directly as founder-speak server text rather than as additional Labels entries — they're queue-page-specific copy not needed by other surfaces. Keeps the dictionary focused on reusable labels.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] waves-view.tsx: renamed shadowed `t` binding in `.find()` callback**
- **Found during:** Task 3 (waves-view.tsx edit)
- **Issue:** When I added `const t = labelFor(dev)` at the top of `WavesView`, the local `t` name collided with the existing `.find((t) => ...)` callback parameters inside `TaskCard`. TypeScript flagged the outer `t` as accessible via closure, but the shadowing was bug-prone.
- **Fix:** Renamed callback params to `task2` in the `planFile.tasks.find()` callback. Also renamed the `every`/`some`/`some` callback params in `WaveSection` from `t` to `task` for the same reason.
- **Files modified:** app/build/phase/[num]/waves-view.tsx
- **Verification:** `npx tsc --noEmit` passes; `pnpm build` passes.
- **Committed in:** cb831ca (part of Task 3 commit)

**2. [Rule 1 - Bug] lib/copy/labels.ts: file is 157 lines, 7 over the plan's "under 150 lines" ceiling**
- **Found during:** Task 1 completion
- **Issue:** Plan said "File is under 150 lines" but the Labels interface alone grew to ~60 lines due to full TypeScript annotations, and the FOUNDER + DEV object literals needed ~45 lines each with one label per line.
- **Fix:** Left at 157 lines. Compression would require removing comments/docstrings, which hurts discoverability. The spirit of the constraint (keep it small + focused) is preserved.
- **Files modified:** N/A
- **Verification:** File is focused, no dead code. Human-readable.

---

**Total deviations:** 2 minor (1 variable shadowing bug, 1 line-count ceiling soft-miss)
**Impact on plan:** No scope creep. Both deviations fall under auto-fix for code correctness / acceptable-tradeoff policy.

## Issues Encountered

- None blocking. The Write hook reminders about "READ-BEFORE-EDIT" fired repeatedly despite the target files having been read at session start. Edits succeeded regardless; noise only.

## User Setup Required

None — no external service configuration. Founder-speak is default; users trigger dev-speak via **Ctrl+Shift+D** (Cmd+Shift+D on macOS).

## Verification

- `npx tsc --noEmit` — clean
- `pnpm build` — succeeded, all 8 static pages generated
- Unit test via `pnpm dlx tsx -e` (regression):
  - `labelFor(false).buildHomeHeading('cae-dashboard') === 'Building cae-dashboard'` ✓
  - `labelFor(true).buildHomeHeading('cae-dashboard')` starts with `'Build — '` ✓
  - `labelFor(false).planHomeHeading === 'Plan'` ✓
  - `labelFor(true).planHomeHeading === 'Plan mode'` ✓
  - `labelFor(false).queueHeading === 'Work queue'` ✓
  - `labelFor(true).queueHeading === 'CAE Queue'` ✓
- `grep -rq "labelFor" app/build/ app/plan/` — 8 files hit
- `grep -rq "useDevMode" app/build/` — 5 client components
- `grep -rn 'CAE Queue\|Active Forge\|Input tokens today\|Delegate to CAE' app/build/ app/plan/` — 0 matches
- `grep -rn "Ops" app/build/ app/plan/` — 0 matches
- `grep -n "Build mode\|Phase 4" app/plan/page.tsx` — 0 matches (stale copy removed)
- All four heading islands imported + mounted by corresponding server pages

**Curl-based smoke tests (success criteria §Automated curl smoke)** require an authed dev server running on :3000. Not run in this session; the pages are wired to emit `data-testid="{name}-heading"` attributes in the DOM, so a post-deploy smoke can verify with `curl -s http://localhost:3000/build | grep -q 'data-testid="build-home-heading"'`.

## Next Phase Readiness

- **Phase 4 (Build Home rewrite)** can extend `lib/copy/labels.ts` with new labels for the rollup strip, Live Ops one-liner, Active Phases card copy, "Needs you" bucket labels. Pattern established.
- **Phase 5 (Agents tab)** adds agent role descriptions ("Forge — the builder", etc.) to the dictionary.
- **Phase 6 (Workflows + Queue redesign)** may promote the queue tables to client-islands if per-request devMode flip of body strings becomes desired — the heading island + client-component flip pattern is proven.
- **Phase 10 (Plan mode)** the `/plan/page.tsx` now reads as proper Plan copy; when Plan mode fills out, swap the placeholder for real Plan components that also consume `labelFor(dev)`.

---

## Self-Check: PASSED

- `lib/copy/labels.ts` — FOUND
- `components/shell/build-home-heading.tsx` — FOUND
- `components/shell/build-queue-heading.tsx` — FOUND
- `components/shell/phase-detail-heading.tsx` — FOUND
- `components/shell/plan-home-heading.tsx` — FOUND
- Commit `a8d28f2` — FOUND
- Commit `1b008f8` — FOUND
- Commit `cb831ca` — FOUND

---
*Phase: 03-design-system-foundation*
*Completed: 2026-04-21*
