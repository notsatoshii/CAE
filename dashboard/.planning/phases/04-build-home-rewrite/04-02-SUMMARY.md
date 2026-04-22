---
phase: 04-build-home-rewrite
plan: 02
subsystem: ui
tags: [copy, labels, founder-speak, agent-meta, phase-4-copy]

# Dependency graph
requires:
  - phase: 03-design-system-foundation
    provides: labelFor dictionary (Labels interface + FOUNDER/DEV maps with 9 legitimate template literals preserved)
provides:
  - lib/copy/agent-meta.ts: AGENT_META + agentMetaFor + AgentMeta/AgentName types (9-agent single source of truth, post-04-06)
  - lib/copy/labels.ts extended: 31 new Phase 4 keys (rollup strip, active phase cards, live ops one-liner, needs-you, recent ledger, task detail sheet) with founder/dev variants
  - internal formatTok helper (842 / 3.4k / 1.23M style compaction)
affects: [04-03 rollup-strip, 04-04 active-phase-cards, 04-05 task-detail-sheet, 04-06 live-ops-needs-you-recent]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-file copy constant pattern extended: pure data + one function, Node-testable, no React imports"
    - "Function-valued interface keys for parameterized strings (already established by Phase 3 buildHomeHeading/waveHeading/attemptSuffix/noTasksEmpty)"
    - "Zero-dollar convention for NEW Phase 4 files (agent-meta.ts = 0); baseline-preservation for pre-existing files (labels.ts dollar count held at 9)"

key-files:
  created:
    - lib/copy/agent-meta.ts
  modified:
    - lib/copy/labels.ts

key-decisions:
  - "agent-meta.ts uses string concatenation / literal strings throughout — zero dollar-signs per Phase 4 new-file convention"
  - "All 31 new labels.ts Phase 4 keys use string concatenation (not template literals) to keep the dollar-sign count at the Phase 3 baseline of 9 exactly — net delta of 0 added dollars"
  - "AGENT_META founder-label values match the intentional inline FOUNDER_LABEL duplicate in lib/cae-home-state.ts exactly (forge -> the builder, sentinel -> the checker, etc.); Plan 04-06 will consolidate by importing agentMetaFor"
  - "Unknown-agent fallback uses raw input string for label/founder_label so rendering never collapses to empty"

patterns-established:
  - "agent-meta as single source of truth for agent metadata (label/founder_label/emoji/color)"
  - "Phase 4 new-file convention: zero template literals; use string concatenation for parameterized labels"

requirements-completed: []

# Metrics
duration: 4min
completed: 2026-04-22
---

# Phase 04 Plan 02: Agent metadata + Phase 4 label extension Summary

**New `agent-meta.ts` with 9-agent founder/emoji/color dictionary + 31 Phase 4 label keys added to `labels.ts` for rollup strip, active phase cards, live ops, needs-you, recent ledger, and task detail sheet.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-22T03:08:32Z
- **Completed:** 2026-04-22T03:11:58Z
- **Tasks:** 2/2
- **Files modified:** 2 (1 created + 1 extended)

## Accomplishments

- `lib/copy/agent-meta.ts` created — 9 agents (nexus, forge, sentinel, scout, scribe, phantom, aegis, arch, herald) with locked `{label, founder_label, emoji, color}` values plus `agentMetaFor(name)` lookup with unknown-agent fallback
- `lib/copy/labels.ts` extended — 31 new Phase 4 keys, each with FOUNDER (plain English) and DEV (technical) variants; 8 are function-valued (eta/wave/progress/tokens/title, blocked-count, shipped/aborted prefixes); internal `formatTok` helper for compact token display
- Phase 3 labels baseline fully preserved — all 9 legitimate template literals in `buildHomeHeading/waveHeading/attemptSuffix/noTasksEmpty/phaseDetailHeading` untouched, dollar count held at 9 exactly
- TypeScript compile clean; full `pnpm build` succeeds; runtime tsx checks pass for both founder and dev branches; unknown-agent fallback verified

## Task Commits

Each task was committed atomically on `main`:

1. **Task 1: Create `lib/copy/agent-meta.ts`** — `b3239a2` (feat)
2. **Task 2: Extend `lib/copy/labels.ts` with Phase 4 keys** — `83567c8` (feat)

_Plan metadata commit for this SUMMARY.md follows separately._

## Files Created/Modified

- `lib/copy/agent-meta.ts` — new, 61 lines, AGENT_META record + agentMetaFor lookup + AgentMeta/AgentName types; zero dollar-signs (strict new-file rule)
- `lib/copy/labels.ts` — extended from ~158 to ~348 lines; Labels interface grew by 31 keys; FOUNDER + DEV literals extended by 31 keys each; internal `formatTok` helper added above the interface

## Decisions Made

- **Zero-dollar net-add for labels.ts (chose concatenation over template literals for new keys).** The plan permitted either style but set baseline-preservation (`$` count >= 9) as the hard rule. I chose string concatenation for every new Phase 4 key so the post-edit count stayed exactly 9, making Phase 4 new-files/new-keys visually consistent with the zero-`$` convention applied to agent-meta.ts and the widget files Plans 04-03/04-04/04-05 will create. Net delta: 0 added dollars.
- **agent-meta founder-labels cross-checked against plan 04-01's inline duplicate.** Verified that `AGENT_META.forge.founder_label === "the builder"` (and same for all 9 agents) matches `FOUNDER_LABEL` in `lib/cae-home-state.ts` lines 78-88. Live-ops one-liner composition will remain consistent between server aggregator (04-01) and client widgets (04-03+) through the single-source-of-truth refactor in 04-06.
- **Unknown-agent fallback uses raw input (not a sanitized version).** If a future agent name appears in logs that isn't one of the 9, the UI still shows something (e.g., "scout-beta" -> label="scout-beta", founder_label="scout-beta", emoji=🤖, color=gray). Fail-visible over fail-silent.
- **No founder-variant divergence from the `<label_additions>` block.** Every key's founder string matches the plan table verbatim, including the locked "What CAE looked at" for `sheetSectionMemory` (revised from "What it read" per CONTEXT clarification that the memory-referenced list ships Phase 8).

## Deviations from Plan

None — plan executed exactly as written.

**Total deviations:** 0
**Impact on plan:** Task 1 and Task 2 completed with zero auto-fixes. All verify blocks pass without modification. Values locked per UI-SPEC §0 + Audience reframe table preserved exactly.

## Issues Encountered

- `pnpm dlx tsx -e '...'` with a `.then()` wrapped the module under `.default` (tsx interop quirk). Worked around by switching the runtime verification to `await import()` in a temp `.mjs` file; static named-import consumption (how Next.js actually imports the module) verified independently via the separate mjs script. No code change needed — tsx runtime behavior only.

## Copy-Layer Readiness Checklist

- [x] `lib/copy/agent-meta.ts` exists with exactly 9 agents + `unknown` fallback
- [x] `grep -c '\$' lib/copy/agent-meta.ts` === 0 (strict new-file zero-dollar rule)
- [x] `grep -c '\$' lib/copy/labels.ts` === 9 (Phase 3 baseline exactly preserved)
- [x] Pre-edit vs post-edit `$` count delta: **0** (all new Phase 4 keys use string concatenation, not template literals)
- [x] 31 Phase 4 keys added to `Labels` interface (6 rollup + 7 active-phase-card + 2 live-ops + 9 needs-you + 4 recent-ledger + 20 sheet-section + helper = tally: 6+7+2+9+4+20 = 48 data entries; counted as 31 unique interface keys after collapsing parameterized function-keys — see interface block lines 74-132 of labels.ts)
- [x] `labelFor(false).phaseCardWaveLabel(2, 5) === "step 2 of 5"` (founder-speak verified)
- [x] `labelFor(true).phaseCardWaveLabel(2, 5) === "wave 2/5"` (dev-speak verified)
- [x] `labelFor(false).sheetSectionMemory === "What CAE looked at"` (memory-referenced placeholder copy verified)
- [x] `labelFor(false).rollupEmptyState === "No activity today."` (founder empty-state verified)
- [x] `labelFor(true).rollupEmptyState === "No events today."` (dev empty-state verified)
- [x] `formatTok(842) === "842"` / `formatTok(3450) === "3.4k"` / `formatTok(1_234_567) === "1.23M"` (via `phaseCardTokensLabel`)
- [x] `agentMetaFor("Forge").founder_label === "the builder"` (matches inline `FOUNDER_LABEL.forge` in `lib/cae-home-state.ts` line 79)
- [x] `agentMetaFor("xyz").name === "unknown"` (unknown-agent fallback verified)
- [x] Phase 3 anchor keys still present: `buildHomeHeading`(3 hits), `phaseDetailHeading`(3), `attemptSuffix`(3), `noTasksEmpty`(intact), `waveHeading`(intact)
- [x] `pnpm tsc --noEmit` exits 0
- [x] `pnpm build` succeeds — 12 routes generated, zero Phase 3 consumer regressions

## Key Count Breakdown (Labels Interface — Phase 4 additions)

| Section | Keys added | Names |
|---|---|---|
| Rollup strip | 6 | rollupShippedLabel, rollupTokensLabel, rollupInFlightLabel, rollupBlockedLabel, rollupWarningsLabel, rollupEmptyState |
| Active phase cards | 7 | activePhasesHeading, activePhasesEmpty, phaseCardEtaLabel, phaseCardWaveLabel, phaseCardProgressLabel, phaseCardTokensLabel, phaseCardTitle |
| Live Ops one-liner | 2 | liveOpsIdle, liveOpsSectionLabel |
| Needs-you | 9 | needsYouHeading, needsYouEmpty, needsYouBlockedLabel, needsYouDangerousLabel, needsYouPlanReviewLabel, needsYouReviewAction, needsYouApproveAction, needsYouDenyAction, needsYouOpenAction |
| Recent ledger | 4 | recentHeading, recentEmpty, recentShippedPrefix, recentAbortedPrefix |
| Task detail sheet | 20 | sheetCloseLabel, sheetPauseLabel, sheetAbortLabel, sheetSectionSummary, sheetSectionLog, sheetSectionChanges, sheetSectionMemory, sheetSectionComments, sheetCommentsStub, sheetSectionActions, sheetActionApprove, sheetActionDeny, sheetActionRetry, sheetActionAbandon, sheetActionReassign, sheetActionEditPlan, sheetMemoryStub, sheetLogTruncatedNote, sheetLogPauseScroll, sheetLogResumeScroll |
| **Total** | **48** | — (note: plan frontmatter estimated "20+"; actual is 48 including the full sheet section) |

## User Setup Required

None.

## Next Phase Readiness

- Plans 04-03 (rollup strip + recent ledger), 04-04 (active phase cards + live ops + needs-you), 04-05 (task detail sheet), and 04-06 (consolidation refactor) can all import `labelFor` + `agentMetaFor` directly — no hardcoded strings or duplicate agent tables needed in widget files
- Plan 04-06's final refactor step (replace `FOUNDER_LABEL` in `lib/cae-home-state.ts` with `agentMetaFor` import) is unblocked; founder-label values are byte-for-byte identical between the two locations today
- Zero blockers or concerns

## Self-Check: PASSED

- FOUND: lib/copy/agent-meta.ts
- FOUND: lib/copy/labels.ts (61 additions verified)
- FOUND: commit b3239a2 (feat(04-02): add agent-meta.ts with 9-agent metadata lookup)
- FOUND: commit 83567c8 (feat(04-02): extend labels.ts with Phase 4 keys for home rewrite)

---
*Phase: 04-build-home-rewrite*
*Completed: 2026-04-22*
