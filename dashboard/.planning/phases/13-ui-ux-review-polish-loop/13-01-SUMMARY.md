---
phase: 13-ui-ux-review-polish-loop
plan: "01"
subsystem: audit-harness
tags: [playwright, screenshot, audit, verify, clickwalk, gitignore]
dependency_graph:
  requires: []
  provides: [audit-harness, routes.json, capture.sh, verify.py, clickwalk.py]
  affects: [13-02, 13-03, 13-04, 13-05]
tech_stack:
  added: [playwright-python-inline, routes.json-matrix]
  patterns: [inline-python-heredoc, storage-state-auth, deterministic-screenshot-css]
key_files:
  created:
    - .planning/phases/13-ui-ux-review-polish-loop/scripts/routes.json
    - .planning/phases/13-ui-ux-review-polish-loop/scripts/authsetup.sh
    - .planning/phases/13-ui-ux-review-polish-loop/scripts/capture.sh
    - .planning/phases/13-ui-ux-review-polish-loop/scripts/verify.py
    - .planning/phases/13-ui-ux-review-polish-loop/scripts/clickwalk.py
    - .planning/phases/13-ui-ux-review-polish-loop/scripts/storage-state.example.json
    - .planning/phases/13-ui-ux-review-polish-loop/shots/.gitkeep
    - .planning/phases/13-ui-ux-review-polish-loop/audit/.gitkeep
  modified:
    - .gitignore
decisions:
  - "13-01: gitignore uses shots/* + !.gitkeep negation (shots/ pattern can't unignore children)"
  - "13-01: capture.sh gracefully skips auth routes when storage-state.json absent (deferred auth)"
  - "13-01: verify.py exits 2 (fatal) vs 1 (mismatch) to distinguish auth-missing from data errors"
  - "13-01: clickwalk.py re-navigates after each click to reset drawer/modal state"
  - "13-01: storage-state.json sign-in deferred to post-P14 consolidated UAT per session-7 directive"
metrics:
  duration: "~20 minutes"
  completed: "2026-04-23T04:47:00Z"
  tasks_completed: 4
  files_created: 8
  files_modified: 1
  commits: 4
---

# Phase 13 Plan 01: Audit Harness — Wave 0 Summary

**One-liner:** Playwright-Python audit harness (routes.json + capture.sh + authsetup.sh + verify.py + clickwalk.py) scaffolded against :3003 prod-only port; public-route smoke tests green; auth sign-in deferred per session-7.

## Scripts Shipped

| Script | Lines | Purpose |
|--------|-------|---------|
| `scripts/routes.json` | 40 | Canonical 16-route + 4 drawer_state matrix: 3 viewports × 2 modes @ :3003 |
| `scripts/authsetup.sh` | 68 | One-time headed Chromium OAuth capture → storage-state.json; --dry-run safe |
| `scripts/capture.sh` | 169 | Screenshot driver: routes.json-driven, deterministic CSS, MANIFEST.tsv emitted |
| `scripts/verify.py` | 156 | Three-way data verifier scaffold: 1 worked panel (cost ticker), PANELS extensible |
| `scripts/clickwalk.py` | 193 | Per-route click walker: every button/role=button/link, console errors recorded |
| `scripts/storage-state.example.json` | 24 | Documents expected cookie jar shape for deferred sign-in |

## Smoke Tests

**capture.sh (public route):**
- Command: `bash capture.sh before --route signin --viewport laptop --mode founder`
- Result: `shots/before/laptop-founder/signin.png` (17,523B), MANIFEST.tsv with 1 row
- Server: :3003 prod build confirmed up, :3002 undisturbed throughout

**clickwalk.py (public route):**
- Command: `python3 clickwalk.py --slug signin`
- Result: `audit/working/CLICKWALK-signin.md`: 1 element (Sign in with GitHub button), 0 console errors, ✅

**verify.py:**
- Requires storage-state.json (deferred — exits 2 with clear error message)
- PANELS registry has 1 worked panel (cost ticker from /api/state vs .cae/metrics/circuit-breakers.jsonl)
- --dry-run: lists panels cleanly

**auth routes (build-home, etc.):**
- capture.sh + clickwalk.py both gracefully skip auth routes when storage-state.json absent
- Full smoke test (auth routes) deferred pending authsetup.sh run

## Auth Approach

**Deferred per session-7 directive.** The plan's Task 2 (one-time manual GitHub OAuth sign-in) is a `type="checkpoint:human-action"` task requiring a headed Chromium browser. Per session-7 directive, this interactive sign-in is auto-deferred.

- `authsetup.sh` is written and executable (--dry-run + --help safe to run without X)
- `storage-state.example.json` documents the expected `authjs.session-token` cookie jar shape
- When real audit runs begin (post-P14 UAT), operator runs: `bash authsetup.sh` to produce `storage-state.json`
- All four scripts are wired to read `storage-state.json` and will work once it exists

## Gitignore

```gitignore
.planning/phases/13-ui-ux-review-polish-loop/shots/*
!.planning/phases/13-ui-ux-review-polish-loop/shots/.gitkeep
.planning/phases/13-ui-ux-review-polish-loop/scripts/storage-state.json
.planning/phases/13-ui-ux-review-polish-loop/audit/working/
```

Note: `shots/` pattern (trailing slash) cannot unignore children — switched to `shots/*` + negation for `.gitkeep`. `audit/` itself is tracked (for `UI-AUDIT-*.md` reports); only `audit/working/` scratch is ignored.

## Port Safety

- `routes.json` base_url: `http://localhost:3003` (hardcoded audit port)
- :3002 (Eric's dev server) verified UP before and after all work — never touched
- Production build used existing `.next/` bundle; `PORT=3003 pnpm start` launched clean

## Deferred Items

| Item | Reason | Resolution |
|------|--------|------------|
| storage-state.json sign-in capture | Task 2 requires headed browser / X display; session-7 auto-defer | Run `authsetup.sh` before first Wave 1 audit |
| Auth-route smoke tests (build-home PNG, VERIFY.md) | Requires storage-state.json | Unblock by running authsetup.sh |
| Pre-existing tsc errors in `lib/cae-ship.test.ts` | `hasPlanning` missing in Project type stubs (Phase 10 commits ca4317b/d60becc) | Out-of-scope for 13-01; fix in Phase 10 review |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] gitignore `shots/*` instead of `shots/`**
- **Found during:** Task 1
- **Issue:** `.gitignore` pattern `shots/` (directory) prevents git from unignoring `shots/.gitkeep` even with negation pattern — git ignores all files inside an ignored directory
- **Fix:** Switched to `shots/*` (contents glob) + `!shots/.gitkeep` negation — allows `.gitkeep` to be tracked while all PNG files remain ignored
- **Files modified:** `.gitignore`
- **Commit:** `5f103fd`

**2. [Rule 2 - Missing critical functionality] capture.sh graceful degradation when no storage-state.json**
- **Found during:** Task 3 implementation
- **Issue:** Plan's smoke test used `--route build-home` (auth-required) but storage-state.json is deferred. Without graceful handling, capture.sh would crash on every auth route.
- **Fix:** Added `HAS_AUTH` check; auth routes skip with `[capture:SKIP]` log message; public routes still capture normally. --dry-run flag added for pre-flight checks.
- **Files modified:** `capture.sh`
- **Commit:** `5bef09b`

**3. [Rule 2 - Missing critical functionality] verify.py exit code distinction (2 vs 1)**
- **Found during:** Task 4 implementation
- **Issue:** Plan only specified "exits non-zero on mismatch". Conflating auth-absent (fatal config error) with data-mismatch (expected audit finding) would make CI gates useless.
- **Fix:** Exit 2 for fatal (no storage-state.json / no cookie), exit 1 for data mismatches, exit 0 for clean. --dry-run flag added.
- **Files modified:** `verify.py`
- **Commit:** `b3160fe`

## Production Code Changes

None. `git diff --name-only app/ lib/ components/ auth.ts middleware.ts` returns empty.

## Self-Check: PASSED

- [x] `scripts/routes.json` exists, 16 routes + 4 drawer states, base_url :3003
- [x] `scripts/authsetup.sh` exists, executable, --dry-run passes
- [x] `scripts/capture.sh` exists, executable, smoke-test produced PNG + MANIFEST
- [x] `scripts/verify.py` exists, executable, PANELS has cost ticker panel
- [x] `scripts/clickwalk.py` exists, executable, produced CLICKWALK-signin.md
- [x] `shots/.gitkeep` and `audit/.gitkeep` exist
- [x] `git check-ignore shots/x.png` confirms PNGs ignored
- [x] `git check-ignore scripts/storage-state.json` confirms secret ignored
- [x] :3002 verified UP throughout; no production code modified
- [x] Commits: 5f103fd, b1f53cd, 5bef09b, b3160fe
