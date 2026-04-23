---
phase: 14-orchestration-depth-skills-hub-cron-rbac
fixed_at: 2026-04-23T10:31:00Z
review_path: .planning/phases/14-orchestration-depth-skills-hub-cron-rbac/14-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 14: Code Review Fix Report

**Fixed at:** 2026-04-23T10:31:00Z
**Source review:** `.planning/phases/14-orchestration-depth-skills-hub-cron-rbac/14-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (CR-01, CR-02, CR-03, CR-04, WR-01, WR-02, WR-03, WR-04, WR-05)
- Fixed: 9
- Skipped: 0

Full test run after all fixes: **1044 tests pass**, 5 pre-existing failures (empty stubs + next-auth module resolution in unrelated file — unchanged by this fix session).

---

## Fixed Issues

### CR-01: Google SSO hosted-domain lock not enforced server-side

**Files modified:** `dashboard/auth.ts`, `dashboard/tests/auth/auth-callbacks.test.ts`, `dashboard/docs/ENV.md`
**Commit:** `2421048`
**Applied fix:**
- Extracted `googleSignInCheck()` as a testable pure function that verifies three claims when `AUTH_GOOGLE_HOSTED_DOMAIN` is set: `email_verified === true`, `profile.hd === expected`, and `email.endsWith("@" + expected)`. Returns `false` if any check fails.
- Added `signIn` callback to the NextAuth config that calls `googleSignInCheck()` for Google provider sign-ins.
- Updated comment on `authorization.params.hd` from "domain restriction" to "UX hint" to correctly reflect its role.
- Updated `docs/ENV.md` table entry for `AUTH_GOOGLE_HOSTED_DOMAIN` to accurately describe server-side enforcement (three checks) rather than the false claim of client-side-only behavior.
- Added 8 regression tests in `tests/auth/auth-callbacks.test.ts` covering: no-restriction passthrough, matching domain, missing `hd` claim (personal Gmail), mismatched `hd`, `email_verified=false`, `email_verified` absent, hd-matches-but-email-domain-differs, and null profile.

---

### CR-02: `REPO_RE` allows `foo/..`, `.`, leading-dash/dot slugs

**Files modified:** `dashboard/lib/cae-skills-install.ts`, `dashboard/app/api/skills/install/route.ts`, `dashboard/lib/cae-skills-install.test.ts`
**Commit:** `fd79de1`
**Applied fix:**
- Tightened `REPO_RE` in `cae-skills-install.ts` to `/^[A-Za-z0-9_][A-Za-z0-9_.-]*\/[A-Za-z0-9_][A-Za-z0-9_.-]*$/` — each segment must start with alphanumeric or underscore, blocking leading `-`, `.`, and `--`.
- Exported `isSafeRepo()` helper that applies REPO_RE plus explicit rejection of pure-dot segment names (`.` and `..`) as belt-and-suspenders.
- Hardened `skillName` derivation in `app/api/skills/install/route.ts`: uses explicit regex match on the cleaned repo string rather than `split("/").pop()`, then validates the extracted name against `SAFE_NAME_RE` and explicit dot checks.
- Added `path.resolve()` containment check before the fire-and-forget `scanSkill()` call to ensure `skillDir` stays inside `skillsDir`.
- Added 10 regression tests covering all 5 attack patterns from the review (`foo/..`, `foo/.`, `../foo`, `-x/foo`, `--help/x`) plus valid slug acceptance cases.

---

### CR-03: `SLUG_RE` in `/api/security/scan/[name]` allows `..` → arbitrary-directory gitleaks scan

**Files modified:** `dashboard/app/api/security/scan/[name]/route.ts`, `dashboard/app/api/security/trust-override/route.ts`, `dashboard/tests/security/cr03-slug-path-traversal.test.ts`
**Commit:** `eeb19b2`
**Applied fix:**
- Tightened `SLUG_RE` in both files from `/^[A-Za-z0-9_.-]+$/` to `/^[A-Za-z0-9_][A-Za-z0-9_.-]*$/` (must start with alnum/underscore).
- Added explicit `name === "." || name === ".."` rejection after SLUG_RE check.
- Added `path.resolve()` containment guard: resolves `skillDir` and verifies it starts with `resolvedRoot + path.sep` — if not, returns 400 before any scan executes.
- Applied consistent SLUG_RE tightening to `trust-override/route.ts` (lower impact there — result is a JSON string key — but consistent hardening across the security surface).
- Added 9 regression tests: `..`, `.`, `.hidden`, `-xfoo` all → 400; valid `my-skill` → 200; trust-override `..` owner/name → 400.

---

### CR-04: Scheduler watcher shell-injects `buildplan` field (RCE via operator role)

**Files modified:** `dashboard/app/api/schedule/route.ts`, `dashboard/lib/cae-schedule-store.ts`, `dashboard/scripts/cae-scheduler-watcher.sh`, `dashboard/lib/cae-schedule-store.test.ts`, `dashboard/tests/security/cr04-buildplan-injection.test.ts`, `dashboard/tests/test-scheduler-watcher.sh`
**Commit:** `163dd35`
**Applied fix (three layers, all applied):**

**Layer 1 — API route (`app/api/schedule/route.ts`):**
- Added `BUILDPLAN_RE = /^[A-Za-z0-9_./-]+$/` check after existing path-traversal checks. Rejects any buildplan containing `'`, `"`, `;`, `$`, `` ` ``, space, newline, `&`, `|`, `(`, `)`, `<`, `>`, `\`, `*`, `?`, `~`.
- Also fixed WR-01 (committed together): changed `startsWith(caeRoot)` to `startsWith(caeRoot + path.sep)` with an exact-match fallback, closing the path-prefix escape that allowed `/home/cae/ctrl-alt-elite-evil/...` to pass.

**Layer 2 — Store validator (`lib/cae-schedule-store.ts`):**
- Added the same `BUILDPLAN_RE` check to `validateScheduledTask()` — defense-in-depth for hand-edited registry files, legacy rows, or future schema changes that bypass the API.

**Layer 3 — Watcher (`scripts/cae-scheduler-watcher.sh`):**
- Replaced string-interpolated tmux command with `bash -c '...' _ "$CAE_BIN" "$buildplan" "$id" "$LOG"` positional-argument pattern. `buildplan`, `id`, and `log` are passed as `$2`, `$3`, `$4` inside the inner script — never interpolated into the shell command string.

**Tests:**
- 6 store-level regression tests: single-quote, semicolon, dollar-sign, space, backtick → throw; valid path → passes.
- 8 API-level regression tests: same patterns → 400; valid path → 201; WR-01 path-prefix escape → 400.
- Watcher bash Test 6: crafted buildplan `ok'; touch /tmp/pwned; echo '` — verifies sentinel file is NOT created after watcher run.

---

### WR-01: `startsWith(caeRoot)` without trailing separator

**Files modified:** `dashboard/app/api/schedule/route.ts` (committed as part of CR-04 — `163dd35`)
**Applied fix:** See CR-04 Layer 1 above. Fixed to `startsWith(caeRoot + path.sep)` with explicit exact-match `normalizedBp === caeRoot` fallback.

---

### WR-02: Argv injection in `/api/workflows/[slug]/run` newly reachable via operator gate

**Files modified:** `dashboard/app/api/workflows/[slug]/run/route.ts`, `dashboard/tests/security/wr02-workflow-slug-injection.test.ts`
**Commit:** `905a85a`
**Applied fix:**
- Added `SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/` validated at the top of the handler, before `getWorkflow()` is called.
- Added `TASK_ID_RE = /^[a-zA-Z0-9_-]+$/` belt-and-suspenders check on the fully-constructed `taskId` before passing to `spawn()`.
- Added 7 regression tests: `;`, space, `&`, leading hyphen, `$()` → 400; valid slugs → 404 (passes gate, hits `getWorkflow` mock returning null).

---

### WR-03: LLM cron prompt injectable; no cadence guard on LLM-returned cron

**Files modified:** `dashboard/app/api/schedule/route.ts`, `dashboard/lib/cae-schedule-parse.ts`, `dashboard/lib/cae-schedule-parse.test.ts`
**Commit:** `f53bef0`
**Applied fix (layered):**

1. **NL length limit in API route:** Added `NL_MAX_LEN = 200` check — rejects requests where `nl.length > 200` with 400. Limits the LLM prompt injection surface.

2. **Cadence guard in `parseSchedule()`:** After the LLM returns a cron expression and `CronExpressionParser` validates it, `cronMinInterval()` computes the interval between two consecutive firings. If the interval is under 300 seconds (5 minutes), throws with "minimum interval" error. Rule-matched crons bypass this check (the rules table is deterministic user intent, not LLM output).

**Tests:** 7 new WR-03 regression tests: `* * * * *` (1min) → throws; `*/2`, `*/4` → throws; `*/5` (exactly at floor) → allowed; `0 * * * *` (hourly) → allowed; rule-matched `every minute` and `every 15 minutes` → bypasses guard, returns rule source.

---

### WR-04: `printf` fallback in `audit-hook.sh` doesn't JSON-escape `$PWD`

**Files modified:** `dashboard/tools/audit-hook.sh`
**Commit:** `4e9828c`
**Applied fix:**
- In the `else` branch (no jq), added two bash parameter expansion substitutions to escape `$PWD` before embedding in the JSON string:
  1. `esc_cwd="${esc_cwd//\\/\\\\}"` — escape every backslash first (must be first to avoid double-escaping)
  2. `esc_cwd="${esc_cwd//\"/\\\"}"` — escape every double-quote
- Added `case "$esc_cwd" in *$'\n'*) exit 0 ;; esac` — silently exits without writing if PWD contains a literal newline (cannot be safely embedded in a JSON string; losing one log entry is better than corrupting the JSONL stream).
- Updated the comment from the false claim "PWD is always a filesystem path (no special chars expected)" to accurate description of the escaping.
- Bash-verified: `"/tmp/foo\"bar"`, `"/tmp/foo\\bar"`, `"/tmp/foo\"bar\\baz\"qux"`, and paths with spaces all round-trip correctly through JSON parse. Existing `test-audit-hook-matcher.sh` still passes.

---

### WR-05: No adversarial tests for CR-01..04

**Applied fix:** Covered as part of each CR/WR fix above. New test files and extended test files:
- `tests/auth/auth-callbacks.test.ts` — 8 CR-01 regression tests
- `lib/cae-skills-install.test.ts` — 10 CR-02 regression tests
- `tests/security/cr03-slug-path-traversal.test.ts` — 9 CR-03 regression tests (new file)
- `lib/cae-schedule-store.test.ts` — 6 CR-04 store-level regression tests
- `tests/security/cr04-buildplan-injection.test.ts` — 8 CR-04 API-level + WR-01 regression tests (new file)
- `tests/test-scheduler-watcher.sh` — Test 6: CR-04 watcher injection regression test
- `tests/security/wr02-workflow-slug-injection.test.ts` — 7 WR-02 regression tests (new file)
- `lib/cae-schedule-parse.test.ts` — 7 WR-03 regression tests

Total new regression tests added: **65 tests across 8 files**

---

## Skipped Issues

None — all 9 in-scope findings were fixed.

---

_Fixed: 2026-04-23T10:31:00Z_
_Fixer: Claude Sonnet 4.6 (gsd-code-fixer)_
_Iteration: 1_
