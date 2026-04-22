---
phase: 08-memory-global-top-bar-icon-page-graphify
plan: 06
subsystem: client-ui
tags: [wave-4, why-drawer, git-timeline, diff-view, real-trace-plus-heuristic-fallback, shared-drawers]

# Dependency graph
requires:
  - phase: 08-memory-global-top-bar-icon-page-graphify
    plan: 02
    provides: /api/memory/consult/[task_id] + MemoryConsultResult shape
  - phase: 08-memory-global-top-bar-icon-page-graphify
    plan: 03
    provides: /api/memory/git-log + /api/memory/diff + getHeuristicWhyTrace + memory.* labels
  - phase: 08-memory-global-top-bar-icon-page-graphify
    plan: 04
    provides: Wave-3 Browse tab (for Wave-5 wiring, not a hard runtime dep of these drawers)
  - phase: 08-memory-global-top-bar-icon-page-graphify
    plan: 05
    provides: Wave-3 Graph tab + NodeDrawer visual pattern (matched here)
provides:
  - dashboard/components/memory/why-drawer.tsx — task-level memory-consult trace drawer with live/heuristic/empty decision ladder
  - dashboard/components/memory/git-timeline-drawer.tsx — per-file git log + 2-commit-pick diff trigger
  - dashboard/components/memory/diff-view.tsx — colored diff renderer with 2000-line cap + copy-to-clipboard
affects: [08-07, 08-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared drawer mount location: cross-tab drawers live at components/memory/ ROOT (not browse/ or graph/ subdirs) so Wave 5's MemoryClient can mount once and surface from either tab — mirrors the D-16 page-structure contract."
    - "Pick-state cap with drop-oldest: Set-like behavior expressed as an array in React state (Set<string> preserved via useMemo for lookup); on third click, drop [0] and append — keeps the cap at 2 without requiring explicit min/max sha ordering."
    - "Fetch router test helper: single vi.spyOn(fetch).mockImplementation that routes by URL substring lets a parent component AND its nested fetch-consuming child (DiffView inside GitTimelineDrawer) both resolve in the same test without mocking the child."
    - "Decision ladder rendering: a `renderPath` sentinel computed once from state + heuristic ('live' | 'heuristic' | 'empty' | 'error') replaces three nested conditionals, keeps the JSX flat and test-queryable via data-testid per branch."

key-files:
  created:
    - dashboard/components/memory/why-drawer.tsx
    - dashboard/components/memory/why-drawer.test.tsx
    - dashboard/components/memory/git-timeline-drawer.tsx
    - dashboard/components/memory/git-timeline-drawer.test.tsx
    - dashboard/components/memory/diff-view.tsx
  modified: []

key-decisions:
  - "Drawers live at components/memory/ root (not browse/ or graph/). Both NodeDrawer (graph/) and MarkdownView (browse/) already expose an `onOpenGitTimeline` hook — Wave 5 will pipe those to one shared <GitTimelineDrawer> instance mounted at MemoryClient level, same for WhyDrawer. Mounting in either subdir would force a cross-subdir import that the parallel-safety invariant of Wave 3 explicitly forbade."
  - "WhyDrawer renders the explain-copy inline (not via ExplainTooltip). The drawer itself IS the explain surface for the Why button; a tooltip-on-tooltip would be redundant. ExplainTooltip is reserved for terse buttons + metric labels (Phase 7 pattern). The explain body (memoryExplainWhy label) sits below the drawer title."
  - "Pick state drops OLDEST on overflow, not NEWEST. Rationale: users ratchet from 'compare A with B' toward 'wait, I meant C' — the newest click represents intent, the stale click should drop. Alternative 'reject third click' felt like fighting the user."
  - "DiffView line coloring uses CSS-variable + hex fallback (`text-[color:var(--success,#059669)]`) so the diff remains readable even if the design system's success/danger tokens aren't defined in the active theme. This is the first memory-tab component to declare a fallback."
  - "Clipboard copy emits the FULL diff (not the truncated 2000-line subset) so a user who hits the cap can still pipe the full diff elsewhere for review. Footer count disambiguates ('+ N more lines') so the truncation is visible, not silent."
  - "`found: true` path ALSO requires entries.length > 0 before rendering the live list. Defensive — the aggregator shouldn't emit `found:true` with empty entries, but if it does the drawer falls through to heuristic/empty instead of rendering an empty live-trace pill that would mislead the user."

requirements-completed:
  - MEM-09
  - MEM-10

# Metrics
duration: ~7min
completed: 2026-04-22
---

# Phase 8 Plan 06: Wave 4 Why + Git-Timeline Drawers Summary

**Shipped the two overlay drawers that close the loop on Phase 8's MEM-09 + MEM-10 requirements: the `Why?` drawer that traces which memory entries CAE actually consulted for a given task (REAL via Wave-1 hook, heuristic fallback for pre-hook tasks), and the per-file Git Timeline drawer with inline colored diff. Both live at `components/memory/` root — shared, mount-once-from-MemoryClient-in-Wave-5 drawers, reachable from either Browse or Graph tabs.**

## Performance

- **Duration:** ~7 min (start 13:24:58Z, end 13:31:55Z)
- **Tasks:** 2 / 2
- **Commits:** 2 (one per task, atomic)
- **New files:** 5 (3 components + 2 vitest suites)
- **Tests:** 9 new cases, 24 total across `components/memory/` (all green)

## Task Commits

| Task | Scope | Commit | Files |
|------|-------|--------|-------|
| 1 | feat(08-06) WhyDrawer | `a580c77` | components/memory/why-drawer.tsx + .test.tsx |
| 2 | feat(08-06) GitTimelineDrawer + DiffView | `5b7295f` | components/memory/git-timeline-drawer.tsx + .test.tsx + components/memory/diff-view.tsx |

## Accomplishments

### Task 1 — WhyDrawer (real-trace-first + heuristic-fallback)

**File:** `components/memory/why-drawer.tsx` (297 lines)

Decision ladder (D-03) implemented as a computed `renderPath` sentinel:
- **Path A (live):** fetch `/api/memory/consult/<task_id>` → `found:true` + non-empty entries → `memoryWhyLiveTracePill` + per-entry row (file basename, abs path, `toLocaleString(ts)`).
- **Path B (heuristic):** `found:false` AND `filesModified` non-empty AND `getHeuristicWhyTrace(filesModified)` returns at least one hit → `memoryWhyHeuristicPill` + filtered list (dev-mode shows `basis: files_modified_intersect` per-row + "Install the PostToolUse hook to capture real traces" footer).
- **Path C (empty):** `found:false` AND heuristic empty → `memoryWhyEmpty` centered muted copy.
- **Error:** non-200 response OR thrown fetch → `memoryLoadFailed` banner (dev-mode appends the HTTP detail).

Pill component: inline `<span>` with `data-testid` per tone (`live` = accent color, `heuristic` = warning color with hex fallback `#d97706`).

A11y: `role="dialog"` + `aria-modal="true"` + `aria-labelledby="why-drawer-heading"`, focus moved into the drawer on open, ESC + backdrop-click close.

**Test suite** (`why-drawer.test.tsx`, 5 cases, 149 ms):
1. Path A — live pill + entry rendered on `found:true`.
2. Path B — heuristic pill + filtered list (`/x/foo.txt` excluded via mocked `getHeuristicWhyTrace` return).
3. Path C — empty-state copy when `found:false` + no `filesModified`.
4. Error banner on 500 response.
5. ESC key → `onClose` called.

All 5 pass. Uses the D-13 injection pattern (`vi.spyOn(globalThis, "fetch")` + `vi.mock("@/lib/cae-memory-whytrace")`).

### Task 2 — GitTimelineDrawer + DiffView

**File:** `components/memory/git-timeline-drawer.tsx` (282 lines)

Contract (D-07 per-file scope):
- Fetches `GET /api/memory/git-log/<encoded-abs-path>` on open → `{log: GitLogEntry[]}`.
- Each commit row: checkbox + sha (7 chars) + yyyy-mm-dd date + author + subject. Picked rows get `border-accent` + surface-hover bg.
- Pick state = ordered `string[]` of sha (Set<string> lookup via `useMemo`). On third click, drops oldest (index 0), keeps the second pick, appends the new sha.
- `Show diff` button enables only when exactly 2 picks; clicking mounts `<DiffView>` below the list.
- Empty log → "No commits for this file." centered muted copy.
- Error → `memoryLoadFailed` banner.

**File:** `components/memory/diff-view.tsx` (211 lines)

Contract:
- Props `{path, shaA, shaB}`.
- POSTs `/api/memory/diff` with body `{path, sha_a: shaA, sha_b: shaB}` on mount.
- Renders mono `<pre>` with per-line coloring:
  - `+++`/`---` headers → italic muted.
  - `@@` hunk headers → italic dim.
  - `+` added → `text-[color:var(--success,#059669)]` (green, hex fallback).
  - `-` deleted → `text-[color:var(--danger,#dc2626)]` (red, hex fallback).
  - context → text-muted.
- Caps visible lines at `LINE_CAP = 2000`; remainder rendered as `+ N more line(s)` footer.
- Header row: "`<shaA-7>` → `<shaB-7>` · N line(s)" + Copy-to-clipboard button.
- Clipboard emits the FULL diff (not the truncated subset).
- NO `dangerouslySetInnerHTML` — every line is a plain React text node.

**Test suite** (`git-timeline-drawer.test.tsx`, 4 cases, 178 ms):
1. Log fetch → 3 commit rows rendered.
2. Pick one = Show-diff stays disabled; pick two = enabled.
3. Clicking Show-diff mounts `<DiffView>` (asserted via `diff-view` testid inside `git-timeline-diff-mount`).
4. ESC → `onClose` called.

Fetch router helper (`installFetchRouter`) routes by URL substring so the DiffView child's diff POST resolves in the same test without mocking DiffView itself.

## Confirmation: shared mount location

Both drawers live at `components/memory/` ROOT, NOT in `components/memory/browse/*` or `components/memory/graph/*`:

```
components/memory/
├── browse/          (Wave 3 Plan 04 — tab client island)
├── graph/           (Wave 3 Plan 05 — tab client island)
├── why-drawer.tsx            ← NEW (shared)
├── why-drawer.test.tsx       ← NEW
├── git-timeline-drawer.tsx   ← NEW (shared)
├── git-timeline-drawer.test.tsx ← NEW
└── diff-view.tsx             ← NEW (shared, composed by GitTimelineDrawer)
```

This placement means Wave 5 (plan 08-07) can mount ONE `<WhyDrawer>` and ONE `<GitTimelineDrawer>` inside `MemoryClient` and pipe state from either Browse's `onOpenGitTimeline` callback (already exposed by `MarkdownView`) or Graph's equivalent callback on `NodeDrawer` (already exposed as `onOpenGitTimeline`). Zero Wave-3 files need to change.

## Test Output

### Task 1 — WhyDrawer

```
 ✓ components/memory/why-drawer.test.tsx  (5 tests) 149ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
```

### Task 2 — GitTimelineDrawer

```
 ✓ components/memory/git-timeline-drawer.test.tsx  (4 tests) 178ms

 Test Files  1 passed (1)
      Tests  4 passed (4)
```

### Full memory-component suite (regression check)

```
 ✓ components/memory/browse/file-tree.test.tsx  (4 tests) 87ms
 ✓ components/memory/why-drawer.test.tsx  (5 tests) 149ms
 ✓ components/memory/git-timeline-drawer.test.tsx  (4 tests) 178ms
 ✓ components/memory/graph/graph-filters.test.tsx  (3 tests) 63ms
 ✓ components/memory/browse/search-results.test.tsx  (4 tests) 95ms
 ✓ components/memory/graph/regenerate-button.test.tsx  (4 tests) 102ms

 Test Files  6 passed (6)
      Tests  24 passed (24)
```

### Gates

- `pnpm tsc --noEmit` → exit 0, clean
- `pnpm build` → exit 0, all Phase-8 routes compiled as dynamic (`/api/memory/consult/[task_id]`, `/api/memory/diff`, `/api/memory/file/[...path]`, `/api/memory/git-log/[...path]`, `/api/memory/graph`, `/api/memory/regenerate`, `/api/memory/search`, `/api/memory/tree`), `/memory` page listed.
- No "Failed to compile" in build output.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Plan's Task 2 verify grep `! grep -q 'dangerouslySetInnerHTML' diff-view.tsx` false-matched on a doc comment**
- **Found during:** Task 2 verify block
- **Issue:** The plan's verification script asserts that `diff-view.tsx` must not contain the string `dangerouslySetInnerHTML`, but I had included that literal token in the Security section of the docstring explaining what the component does NOT use. The grep doesn't distinguish code from comments.
- **Fix:** Rephrased the docstring from "No `dangerouslySetInnerHTML` — every line goes through React..." to "Every line goes through React as a plain string (server-side diff is treated as untrusted text). No raw-HTML sinks anywhere in this file." The file still has NO actual `dangerouslySetInnerHTML` usage; the assertion now passes.
- **Files modified:** `components/memory/diff-view.tsx` (docstring only — zero behavior change)
- **Committed in:** `5b7295f` (same commit as the rest of Task 2, caught before the final commit)
- **Impact:** Plan's own verify passes. This is the same class of deviation as Plan 08-03 Deviations #3 and #4 (plan verify greps false-match on doc comments) — pattern is to keep code meaning + rephrase comments.

### Pre-existing Follow-ups (NOT deviations)

- **Working tree had 4 uncommitted items at plan start:** `.planning/STATE.md` (M), `.planning/ROADMAP.md` (M), `next.config.ts` (M), untracked `scripts-temp-copy-flip.ts`, and untracked `../.planning/herald/herald-readme-7deddd/`. Per the execute scope boundary ("Only auto-fix issues DIRECTLY caused by the current task's changes"), none of these were touched by this plan. Per the plan's explicit instruction ("Do NOT update STATE.md or ROADMAP.md"), the modified planning files are left for the phase orchestrator to reconcile.
- **4 Phase-6 legacy test files still fail under Vitest** (`lib/cae-nl-draft.test.ts`, `lib/cae-queue-state.test.ts`, `lib/cae-workflows.test.ts`, `components/workflows/step-graph.test.tsx` — `No test suite found`). This was flagged in 08-01-SUMMARY and 08-03-SUMMARY as a Wave 0 follow-up (node:test → Vitest conversion). Out of scope for this plan; `pnpm test` still reports these 4 as failed suites alongside the 14 passing ones — the 24 Memory-component tests are all green.

## Flag for Wave 7 UAT

**Confirm Live-trace vs Heuristic render distinction is VISIBLE during live demo.**

The drawer renders two distinct pill colors (cyan accent for "Live trace", warning amber for "Heuristic — no trace captured"), but the demo's success depends on:
1. A Forge task runs with the PostToolUse hook active → `memory-consult.jsonl` populates → `/api/memory/consult/<task_id>` returns `found:true` → Live pill renders.
2. A DIFFERENT Forge task ran before the hook was installed (or the adapter didn't export `CAE_TASK_ID`) → `/api/memory/consult/<task_id>` returns `found:false` → Heuristic pill renders IF `filesModified` is wired from the outbox DONE.md.

**Wave 5 must surface a `filesModified` prop to `<WhyDrawer>` sourced from the task's DONE.md** for the heuristic fallback to ever fire in practice. If that wiring is missing, every pre-hook task falls to Path C (empty) instead of Path B (heuristic) — a demo regression. Flagging explicitly so Wave 5 doesn't accidentally skip the `filesModified` prop.

**Secondary UAT check:** verify the diff-view color scheme is legible under both light and dark themes. I used CSS-variable-with-hex-fallback (`var(--success, #059669)`), but confirm the fallback isn't needed in production — i.e. that the dashboard's theme actually defines `--success` and `--danger`.

## Key Links Verified

| From | To | Pattern | Status |
|------|-----|---------|--------|
| `why-drawer.tsx` | `/api/memory/consult/[task_id]` | `fetch(\`/api/memory/consult/${encodeURIComponent(taskId)}\`)` | Grep-confirmed |
| `why-drawer.tsx` | `lib/cae-memory-whytrace.ts` | `import { getHeuristicWhyTrace }` | Grep-confirmed |
| `git-timeline-drawer.tsx` | `/api/memory/git-log/[...path]` | `fetch(\`/api/memory/git-log/${encodePath(absFilePath)}\`)` | Grep-confirmed |
| `diff-view.tsx` | `/api/memory/diff` | `fetch("/api/memory/diff", { method: "POST", body: ... })` | Grep-confirmed |
| `git-timeline-drawer.tsx` | `diff-view.tsx` | `import { DiffView } from "./diff-view"` | Present |
| `why-drawer.tsx` | `browse/*` or `graph/*` | Cross-subdir import | ABSENT (shared-layer invariant preserved) |
| `git-timeline-drawer.tsx` | `browse/*` or `graph/*` | Cross-subdir import | ABSENT (shared-layer invariant preserved) |

## Self-Check

Created files:
- FOUND: dashboard/components/memory/why-drawer.tsx
- FOUND: dashboard/components/memory/why-drawer.test.tsx
- FOUND: dashboard/components/memory/git-timeline-drawer.tsx
- FOUND: dashboard/components/memory/git-timeline-drawer.test.tsx
- FOUND: dashboard/components/memory/diff-view.tsx

Modified files:
- (none — plan was additive)

Commits:
- FOUND: a580c77 (Task 1 — WhyDrawer)
- FOUND: 5b7295f (Task 2 — GitTimelineDrawer + DiffView)

Gates:
- PASS: pnpm exec vitest run components/memory/ (24/24 tests, includes the 9 new cases)
- PASS: pnpm tsc --noEmit
- PASS: pnpm build (all routes registered, no "Failed to compile")

## Self-Check: PASSED

## Next Phase Readiness

Wave 4 complete. Both MEM-09 (real + heuristic Why trace) and MEM-10 (per-file git timeline + diff) requirements have their UI surfaces shipped. Downstream:

- **08-07 (Wave 5 page shell + MemoryClient):** unblocked. MemoryClient will:
  1. Mount `<WhyDrawer open onClose taskId filesModified onSelectFile>` ONCE at the MemoryClient level.
  2. Mount `<GitTimelineDrawer open onClose absFilePath>` ONCE at the MemoryClient level.
  3. Pipe Browse's `onOpenGitTimeline` callback (already exposed by `MarkdownView`) to the shared timeline drawer.
  4. Pipe Graph's `onOpenGitTimeline` callback (already exposed by `NodeDrawer`) to the same drawer.
  5. Surface a "Why?" button somewhere in the shell (header or per-task context) that sets `open=true` + `taskId` + optionally `filesModified` from the selected task's DONE.md.
- **08-08 (Wave 6 VERIFICATION):** no new blocking work. The plan-specific assertions (five `why-drawer` tests + four `git-timeline` tests green + tsc + build clean) are already exercised.

---
*Phase: 08-memory-global-top-bar-icon-page-graphify*
*Plan: 06 — Wave 4 Why + Git-timeline drawers*
*Completed: 2026-04-22*
