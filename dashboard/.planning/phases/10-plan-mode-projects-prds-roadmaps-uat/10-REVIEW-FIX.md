---
phase: 10-plan-mode-projects-prds-roadmaps-uat
fixed_at: 2026-04-23T02:42:00Z
review_path: .planning/phases/10-plan-mode-projects-prds-roadmaps-uat/10-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 10: Code Review Fix Report

**Fixed at:** 2026-04-23T02:42:00Z
**Source review:** `.planning/phases/10-plan-mode-projects-prds-roadmaps-uat/10-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03 — P3/Info excluded per instructions)
- Fixed: 3
- Skipped: 0

---

## Fixed Issues

### WR-01: `runShiftNew` log directory missing when tee spawns

**File modified:** `lib/cae-shift.ts`
**Commit:** `744e778`
**Added test:** `runShiftNew — log directory creation (WR-01)` (2 new cases in `lib/cae-shift.test.ts`)

**Before:** The tmux inner command was:
```
cd '<SHIFT_PROJECTS_HOME>' && SHIFT_NONINTERACTIVE=1 ... shift new '<name>' 2>&1 | tee '<projectPath>/.shift-bootstrap.log'
```
`projectPath` did not exist at the moment tmux spawned — `tee` opens the logfile on startup and immediately fails with ENOENT, taking upstream `shift new` down with a SIGPIPE.

**After:** `mkdir -p '<projectPath>'` is prepended before the `cd`:
```
mkdir -p '<projectPath>' && cd '<SHIFT_PROJECTS_HOME>' && SHIFT_NONINTERACTIVE=1 ... shift new '<name>' 2>&1 | tee '<projectPath>/.shift-bootstrap.log'
```
Matches the pattern already used by `runGhRepoCreate` and `runCaeExecutePhase`.

**Test coverage:** Two new tests intercept `spawn` via `vi.mock("child_process")` and assert (a) `mkdir -p` appears in the inner command string before `tee`, and (b) the `mkdir -p` argument is quoted and contains the project name.

---

### WR-02: `writeEnvLocal` allowed newline injection in keys/values

**File modified:** `lib/cae-ship.ts`
**Commit:** `d60becc`
**Added tests:** `writeEnvLocal — newline injection guard (WR-02)` (5 new cases in `lib/cae-ship.test.ts`)

**Before:** `writeEnvLocal` accepted any `Record<string, string>` and serialised directly to `KEY=VALUE\n` lines. A value like `"postgres://ok\nEVIL_KEY=injected"` would write two env-var lines. A key like `"FOO\nEVIL=x"` would break key formatting. No validation ran inside the function — it relied entirely on callers having already called `validateShipInput`.

**After:** Defence-in-depth guard added at the top of `writeEnvLocal` before any I/O:
- Keys must match `/^[A-Z_][A-Z0-9_]*$/` — throws `"invalid env key: ..."` otherwise.
- Values must not contain `\n` or `\r` — throws `"value for <KEY> contains newline"` otherwise.

**Test coverage:** Four rejection cases (value `\n`, value `\r`, lowercase key, key with embedded newline) plus one acceptance case (valid uppercase keys + clean values writes the file and returns the path).

---

### WR-03: `loadUatState` preserved stale `orphaned: true` on bullet re-add

**File modified:** `lib/cae-uat.ts`
**Commit:** `ceb1780`
**Added test:** `"clears orphaned flag when a previously-orphaned bullet is re-added to ROADMAP (WR-03)"` in `lib/cae-uat.test.ts`

**Before:** The merge path in `loadUatState` spread `orphaned: prior.orphaned` when a parsed ROADMAP id matched a prior saved item. Lifecycle: bullet added → id in ROADMAP → `orphaned: undefined`. Bullet removed → filtered to orphan spread → `orphaned: true` persisted to disk. Bullet re-added verbatim → same sha1 id → re-match branch runs → `orphaned: prior.orphaned` preserves `true`. The bullet appeared dead in the state file even though it was live in the ROADMAP.

**After:** The `orphaned` field is simply omitted from the re-match branch return object (not set to `false`, not spread from `prior`). Since `UatItem.orphaned` is optional, omitting it is semantically equivalent to "not orphaned" and keeps the type clean:
```ts
return {
  ...p,
  status: prior.status,
  note: prior.note,
  ts: prior.ts,
  // orphaned intentionally omitted — bullet is live in current ROADMAP
};
```

**Test coverage:** Three-step integration test using a real tmpdir: (1) load with bullet present → confirm `orphaned` is `undefined`; (2) remove bullet from ROADMAP, reload → confirm `orphaned: true`; (3) re-add bullet verbatim, reload → assert `orphaned` is `undefined` again. Test was confirmed to fail on the pre-fix code (stash verification during fix session).

---

_Fixed: 2026-04-23T02:42:00Z_
_Fixer: Claude Sonnet 4.6 (gsd-code-fixer)_
_Iteration: 1_
