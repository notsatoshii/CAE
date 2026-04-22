---
phase: 07-metrics-global-top-bar-icon-page
plan: 06
subsystem: metrics-phase-verification
tags: [wave-4, verification, lint-script, usd-guard, phase-signoff, human-uat]

# Dependency graph
requires:
  - phase: 07-metrics-global-top-bar-icon-page
    provides: "All 5 prior plans (07-01…07-05) shipped: adapter token emission, schema-drift fix, aggregator, /api/metrics, useMetricsPoll, metrics.* labels, three panels (Spending / Reliability / Speed), page shell, ExplainTooltip"
provides:
  - "dashboard/scripts/lint-no-dollar.sh — permanent D-07 enforcement (exits 1 on literal `$` in app/metrics, components/metrics, or the Phase 7 metrics.* block of lib/copy/labels.ts)"
  - "dashboard/.planning/phases/07-metrics-global-top-bar-icon-page/07-VERIFICATION.md — plan-by-plan coverage + 17/17 automated check log + 5 Manual Gates drafted for Eric's UAT + PASS/PENDING-UAT sign-off"
  - "Phase 7 automated verification GREEN; Phase 7 locked-pending-UAT — all prerequisites for Phase 8 kickoff satisfied once Eric signs off"
affects:
  - "Phase 8 (Memory tab) can begin once Manual Gates all PASS"
  - "Future phases: lint-no-dollar.sh can be added to pre-commit / CI to permanently prevent currency regressions (scoped to Phase 7 surface — safe to extend)"

# Tech tracking
tech-stack:
  added: []  # No new dependencies in this plan — verification-only
  patterns:
    - "Scoped lint guard (lint-no-dollar.sh) greps a named subdirectory set with Perl regex lookaround (`(?<!\\)\\$(?!\\{)`) — keeps literal `$` out while allowing `${…}` templates"
    - "Verification document structure: Summary → Build → per-plan coverage tables → full automated log → Manual Gates → Gaps → Sign-off — mirrors Phase 6 VERIFICATION"

key-files:
  created:
    - "dashboard/scripts/lint-no-dollar.sh (68 lines, executable)"
    - "dashboard/.planning/phases/07-metrics-global-top-bar-icon-page/07-VERIFICATION.md (327 lines)"
  modified: []

key-decisions:
  - "Lint script scope restricted to app/metrics + components/metrics + Phase 7 labels.ts block only — does NOT scan repo-wide to avoid false positives in legitimate shell + template files outside the metrics surface"
  - "labels.ts block extraction via awk matching `=== Phase 7: Metrics ===` marker rather than line-range — resilient to future key additions inside the block"
  - "Sign-off split into Automated (PASS) + Manual-pending rather than blocking on UAT — lets parallel work start while Eric reviews visually"
  - "Verification doc lists 17/17 checks + per-plan coverage tables rather than just pass/fail totals — future re-verifies can diff against this as the authoritative baseline"
  - "Manual Gate 5 (no-\$ visual scan) paired with the lint script rather than replaced by it — script catches files at CI time; gate catches runtime rendering from any new code path"

patterns-established:
  - "Phase-scoped lint guards: per-phase scripts enforcing a design constraint (USD-free copy) that survives into future phases — precedent for Memory-guard / Changes-guard if similar invariants emerge"
  - "VERIFICATION.md sign-off split (Automated first, Manual after) — lets parallel work start while Eric reviews visually"

requirements-completed:
  - REQ-7-SPEND
  - REQ-7-WELL
  - REQ-7-FAST
  - REQ-7-FOUNDER
  - REQ-7-W0-ADAPTER
  - REQ-7-W0-SCHEMA
  - REQ-7-W0-TICKER

# Metrics
duration: 5 min
completed: 2026-04-22
---

# Phase 7 Plan 6: Verification + USD-Guard + UAT Checkpoint Summary

**One-liner:** Shipped the permanent D-07 `lint-no-dollar.sh` USD-guard script (68 lines, executable, greps app/metrics + components/metrics + the Phase 7 metrics.* labels block for literal `$` excluding `${…}` templates — exits 0 on current codebase) and a 327-line `07-VERIFICATION.md` capturing 17/17 automated checks GREEN, plan-by-plan must-have coverage for 07-01 through 07-05, and 5 Manual Gates drafted for Eric's UAT before Phase 7 is locked as shipped.

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-22T11:34:34Z
- **Completed:** 2026-04-22T11:39:25Z
- **Tasks executed autonomously:** 1 (Task 1 — script + automated sweep + VERIFICATION draft). Task 2 (Manual Gates UAT) returned as a checkpoint to the orchestrator.
- **Files created:** 2
- **Files modified:** 0

## Accomplishments

- **Permanent D-07 enforcement:** `scripts/lint-no-dollar.sh` is executable, documented, and smoke-passing. Future PRs touching metrics copy will fail the lint on literal `$`. Ready to hook into pre-commit / CI.
- **17/17 automated checks GREEN:** every check from the plan's Task-1 action list ran successfully (bash -n adapter, token_usage grep, hallucinated-event-name grep across 3 aggregators, CbEvent export, forge_begin/forge_end count in cae-metrics-state, recharts+react-is pins, pnpm tsc --noEmit, pnpm build, lint-no-dollar, components/metrics count ≥14 [actual: 15], use-client coverage, page.tsx is SERVER component, metricsPageHeading key, live /api/metrics curl with full D-10 shape, /metrics 307 redirect to /signin?from=%2Fmetrics).
- **Plan-by-plan coverage documented:** VERIFICATION.md has a table for each of 07-01 through 07-05 mapping every must-have truth to a specific automated check or Manual Gate, PASS/PENDING status recorded.
- **5 Manual Gates drafted:** token ingestion (Gate 1), three-panel visual render (Gate 2), ExplainTooltip behavior + Ctrl+E (Gate 3), DevMode flip ⌘⇧D across 40 labels (Gate 4), visual no-\$ scan (Gate 5). Each gate includes procedure, expected outcome, and a Status field for Eric to fill in.

## Task Commits

1. **Task 1: Create lint-no-dollar.sh + run automated sweep + write VERIFICATION.md** — `749d527` (feat)

**Task 2 (Manual Gates UAT):** not committed — pending Eric's in-browser sign-off. On PASS, Eric appends `Manual (Eric): PASS, <timestamp>` to 07-VERIFICATION.md §Sign-off (no code commit required).

## Files Created/Modified

- `dashboard/scripts/lint-no-dollar.sh` — 68 lines, +x. Greps app/metrics, components/metrics, and the Phase 7 metrics.* block of lib/copy/labels.ts for literal `$` (excluding `${…}`). Perl regex lookaround: `(?<!\\)\$(?!\{)`. Self-scoped awk extracts the Phase 7 block from labels.ts so the guard never fires on legitimate `$` elsewhere in labels. Exit 0 on current codebase.
- `dashboard/.planning/phases/07-metrics-global-top-bar-icon-page/07-VERIFICATION.md` — 327 lines. Mirrors 06-VERIFICATION structure. Sections: Summary, Build, Plan-by-plan coverage (5 subsections × table per plan), Automated check log (with live `/api/metrics` payload snapshot), Manual Gates (5), Gaps identified (none automated; UAT-pending), Sign-off.

## Decisions Made

1. **Lint script scope restricted to the metrics surface only.** Repo-wide `$` scan would false-flag shell scripts, documentation, legitimate template literals, and non-Phase-7 copy. The script greps exactly three targets: `app/metrics/**`, `components/metrics/**`, and (via awk-extracted block) the Phase 7 section of `lib/copy/labels.ts`.
2. **labels.ts scope via marker-based awk extraction** rather than line ranges — resilient to future key additions inside the `=== Phase 7: Metrics ===` block.
3. **Sign-off split (Automated PASS / Manual PENDING)** rather than all-or-nothing. Lets Phase 8 planning start the moment Eric walks through the UAT gates.
4. **Manual Gate 5 (no-\$ visual scan) preserved alongside the lint script.** Script catches files at CI time; gate catches any new runtime rendering path (e.g. a future component that interpolates copy through a transform).
5. **Verification doc format matches 06-VERIFICATION.** Provides a consistent structure future phases can template from.

## Deviations from Plan

**None — plan executed exactly as written.**

Minor in-line note (pre-documented in plan, not a deviation):

- The plan's example lint snippet only grepped `metrics[A-Z]` lines in labels.ts. I replaced that with awk-extracted-block grep so the script scans EVERY line between the two `=== Phase 7: Metrics ===` markers (FOUNDER + DEV + interface all live in the same block; only one marker pair is present in labels.ts). This is strictly more protective than the plan's pattern — catches `$` on continuation lines, multi-line template literals, or non-key lines inside the block — and it satisfies the must-have `truth 1` ("greps for literal `$` in app/metrics or components/metrics or metrics.* labels").

Built-in protections preserved:

- `(?<!\\)` excludes escaped `\$`.
- `(?!\{)` excludes template expressions `${…}`.
- `-P` Perl regex for lookaround (required; POSIX grep doesn't support negative lookaround).
- Scoped to `.ts / .tsx / .md` only — avoids matching binary build outputs.
- Errors redirected to stderr, PASS/FAIL printed with an actionable D-07 reference.

## Issues Encountered

**None.** The automated sweep went clean on first run. Port 3002 already had a live `next-server` from a prior session (PID 2930216) — reused it for Check 16/17 rather than starting a new dev server, which actually made the verification faster and matches how 06-VERIFICATION operated.

## Authentication Gates

**None.** This plan is pure scripting + verification; no external services touched. The `/metrics` 307 redirect to `/signin?from=%2Fmetrics` (Check 17) is a behavioral contract from 07-05's auth gate — tested as a success criterion, not an auth gate blocking this plan's work.

## User Setup Required

None — no external service configuration introduced by this plan.

## Known Stubs

**None.** Every artifact is fully wired:

- `scripts/lint-no-dollar.sh` runs real grep against real files and exits on real hit count.
- `07-VERIFICATION.md` contains real check output copy-pasted from the terminal, real live `/api/metrics` payload (generated_at 2026-04-22T11:36:42.577Z), and real Manual Gates with real procedures (not placeholders or TODOs).
- Manual Gates 1–5 each have concrete procedures, expected outcomes, and a Status field — not placeholder "TBD" entries.

## Automated Verification Results

| Check | Result |
| ----- | ------ |
| `test -x scripts/lint-no-dollar.sh` | PASS |
| `./scripts/lint-no-dollar.sh` (exit 0) | PASS ("lint-no-dollar: PASS (no literal \$ in metrics copy)") |
| `test -f .planning/phases/07-metrics-global-top-bar-icon-page/07-VERIFICATION.md` | PASS |
| `grep -q "Manual Gate 1" VERIFICATION.md` | PASS |
| `grep -q "Manual Gate 2" VERIFICATION.md` | PASS |
| `grep -q "Manual Gate 3" VERIFICATION.md` | PASS |
| `grep -q "Manual Gate 4" VERIFICATION.md` | PASS |
| `grep -q "Manual Gate 5" VERIFICATION.md` | PASS |
| `grep -qE "PASS\|PARTIAL\|FAIL" VERIFICATION.md` | PASS |
| Lint script line count (min 25) | 68 (exceeds) |
| VERIFICATION.md line count (min 50) | 327 (exceeds) |

All task-level `<verify><automated>` assertions pass. `<done>` criteria satisfied: lint-no-dollar.sh exists + executable + exits 0; VERIFICATION.md exists with all 5 Manual Gates enumerated, plan-by-plan coverage documented, automated check log present, status line set, sign-off block present (awaiting human).

## Next Phase Readiness

- **Automated layer:** Phase 7 complete and GREEN. No structural blockers.
- **Manual layer:** Awaiting Eric's walk-through of 5 Manual Gates. On all-5-PASS, Phase 7 is locked as shipped.
- **If any gate FAILS:** VERIFICATION.md §Gaps will be updated and `/gsd-plan-phase 07 --gaps` can generate 07-07+ plans.
- **Phase 8 (Memory tab) prerequisites:** All REQ-7-* requirements closed at the code level. Phase 8 planning can start in parallel with UAT as long as it doesn't touch `app/metrics/**` or `components/metrics/**` (scope-fenced by D-12).

## Self-Check: PASSED

- File `dashboard/scripts/lint-no-dollar.sh` exists (68 lines, +x): FOUND
- File `dashboard/.planning/phases/07-metrics-global-top-bar-icon-page/07-VERIFICATION.md` exists (327 lines): FOUND
- Commit `749d527` present in `git log --oneline`: FOUND
- All 5 Manual Gates enumerated in VERIFICATION.md (`Manual Gate 1` through `Manual Gate 5`): PASS
- Status line (`PASS | PARTIAL | FAIL`) present: PASS
- Plan-by-plan coverage (07-01, 07-02, 07-03, 07-04, 07-05) all have tables: PASS
- Live `/api/metrics` curl + `/metrics` 307 redirect captured in automated log: PASS
- Lint script exits 0 on current codebase: PASS

---

*Phase: 07-metrics-global-top-bar-icon-page*
*Completed: 2026-04-22*
