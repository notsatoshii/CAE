---
phase: 10-plan-mode-projects-prds-roadmaps-uat
plan: "02"
subsystem: cae-shift-wrapper
tags: [shift, tmux, tdd-green, wave-1, security]
dependency_graph:
  requires:
    - dashboard/lib/cae-types.ts (Project type)
    - dashboard/lib/cae-state.ts (listProjects)
    - dashboard/.planning/phases/10-plan-mode-projects-prds-roadmaps-uat/__fixtures__/plan/
  provides:
    - dashboard/lib/cae-shift.ts
  affects:
    - dashboard/lib/cae-shift.test.ts (bug fixes: missing await, non-null assertion)
tech_stack:
  added: []
  patterns:
    - POSIX single-quote shell escaping via quote() helper
    - tmux new-session -d detached spawn pattern (matches chat-spawn.ts)
    - Whitelist-based path resolution (resolveProject enforces listProjects whitelist)
    - State mutation helpers (approveGate pure, approvePrdGate/approveRoadmapGate with file I/O)
key_files:
  created:
    - dashboard/lib/cae-shift.ts
  modified:
    - dashboard/lib/cae-shift.test.ts
decisions:
  - "approveGate() exported as pure state mutation (not file I/O) — matches test scaffold; approvePrdGate/approveRoadmapGate handle the file I/O"
  - "buildAnswersFile() accepts { 'idea.what', 'idea.who', 'idea.type_ok' } directly (Shift qid keys) matching test scaffold — not WizardAnswers-shaped"
  - "readShiftState test had missing async/await (RED scaffold bug) — fixed inline per Rule 1"
  - "history access in test used direct index without non-null guard — fixed with history! non-null assertion per Rule 1"
  - "quote() used 8 times (4+ required by spot-check); all shell interpolations protected"
metrics:
  duration: "8m"
  completed_date: "2026-04-23"
  tasks_completed: 3
  tasks_total: 3
  files_created: 1
  files_modified: 1
---

# Phase 10 Plan 02: lib/cae-shift.ts — Shift v3.0 Wrapper

**One-liner:** TypeScript wrapper around `/home/shift/bin/shift` v3.0.0 exporting 8 symbols — whitelist-safe project resolution, async state parsing, tmux-detached spawn, and gate approval with pure state mutation; all 11 tests green.

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Implement resolveProject + readShiftState + quote helper + types | `6c67af1` | `lib/cae-shift.ts` (created), `lib/cae-shift.test.ts` (bug fixes) |
| 2 | Implement buildAnswersFile + runShiftNew + runShiftNext with tmux spawn | `6c67af1` | `lib/cae-shift.ts` |
| 3 | Implement approvePrdGate + approveRoadmapGate + approveGate state patching | `6c67af1` | `lib/cae-shift.ts` |

Note: All three tasks were committed atomically since the implementation required all exports to be present simultaneously for the test runner to resolve the module.

## Exported Symbols

| Symbol | Kind | Contract |
|--------|------|----------|
| `ShiftPhase` | type | Union of "idea" \| "research" \| "prd" \| "roadmap" \| "waiting_for_plans" \| "executing" \| "done" |
| `ShiftState` | interface | Shape of .shift/state.json; index sig preserves unknown keys |
| `WizardAnswers` | interface | Shift qid keys: "idea.what", "idea.who", "idea.type_ok" |
| `resolveProject(slugOrPath)` | async fn | Whitelist match via listProjects(); absolute path or basename slug; null on mismatch |
| `readShiftState(projectPath)` | async fn | Parses .shift/state.json; null on ENOENT; throws on malformed JSON |
| `buildAnswersFile(answers)` | async fn | Writes /tmp/shift-answers-<uuid>.json at 0o600; returns absolute path |
| `runShiftNew(name, answersFile)` | async fn | tmux new-session -d with SHIFT_NONINTERACTIVE=1 + SHIFT_ANSWERS; returns {sid, projectPath, logFile} |
| `runShiftNext(proj)` | async fn | tmux new-session -d for shift next; returns {sid, logFile} |
| `approveGate(state, gate)` | async fn | Pure in-memory state mutation for "prd" or "roadmap" gate; returns mutated state |
| `approvePrdGate(proj)` | async fn | File I/O + approveGate("prd") + runShiftNext; returns {sid} |
| `approveRoadmapGate(proj)` | async fn | File I/O + approveGate("roadmap"); no spawn (D-09 plan-gen takes over); returns void |

## Test Results

`npx vitest run lib/cae-shift.test.ts` — **11/11 passed**:
- resolveProject: 4 tests (unknown slug → null, basename match, absolute path match, traversal rejection)
- readShiftState: 2 tests (fixture parse, ENOENT → null)
- buildAnswersFile: 2 tests (Shift qid keys written, absolute /tmp path)
- approveGate: 3 tests (prd→roadmap patch, roadmap→waiting_for_plans patch, history append)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing `await` in readShiftState test**
- **Found during:** Task 1 verification
- **Issue:** `cae-shift.test.ts` line 57-60: `readShiftState()` called without `await`; `expect(state).toBeNull()` was comparing a Promise to null (always fails)
- **Fix:** Added `async` to the `it()` callback and `await` before `readShiftState()`
- **Files modified:** `dashboard/lib/cae-shift.test.ts`
- **Commit:** `6c67af1`

**2. [Rule 1 - Bug] Missing non-null guard on `updated.history` in test**
- **Found during:** tsc --noEmit check (Task 3)
- **Issue:** TypeScript TS18048: `updated.history` is possibly undefined per ShiftState interface; test accessed `.length` and `[index]` directly
- **Fix:** `const history = updated.history!;` non-null assertion (safe: fixture guarantees history; approveGate always initializes history array)
- **Files modified:** `dashboard/lib/cae-shift.test.ts`
- **Commit:** `6c67af1`

**3. [Rule 1 - Adaptation] approveGate exported as pure mutation, not file I/O**
- **Found during:** Task 1 — reading test scaffold
- **Issue:** The test calls `approveGate(state, "prd")` with an in-memory state object (not a Project with a path), so it cannot write to disk. The plan's `approvePrdGate(proj)` / `approveRoadmapGate(proj)` signatures handle file I/O as a separate layer.
- **Fix:** Exported `approveGate(state, gate)` as the pure mutation that the tests use; `approvePrdGate` and `approveRoadmapGate` wrap it with file I/O, matching the plan's file-layer contracts.
- **Files modified:** `dashboard/lib/cae-shift.ts`

## Known Stubs

None — all functions are fully implemented. `runShiftNew` and `runShiftNext` spawn real tmux processes; no mock data flows to UI rendering.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes beyond what the plan's threat model covers (T-10-02-01 through T-10-02-05 all mitigated inline).

## Self-Check: PASSED

- `dashboard/lib/cae-shift.ts` exists: FOUND
- `dashboard/lib/cae-shift.test.ts` (modified): FOUND
- Commit `6c67af1` in git log: FOUND
- `npx vitest run lib/cae-shift.test.ts` → 11/11 passed
- `npx tsc --noEmit` → 0 new errors from this plan's files (4 pre-existing errors from other plans' missing modules)
- Line count: 289 (>180 minimum)
- `grep -c "quote("` → 8 (>4 minimum)
