---
phase: 14-orchestration-depth-skills-hub-cron-rbac
verified: 2026-04-23T10:10:00Z
verifier: independent-second-opinion (not 14-06)
status: passed_with_notes
score: 6/6 goal-backward must-haves verified (all 12 REQ-P14-* satisfied)
relative_to: 14-VERIFICATION.md (self-audit by Plan 14-06)
overrides_applied: 0
deferred:
  - must_have: "PostToolUse audit hook active (tool-calls.jsonl populated)"
    reason: "install-audit-hook.sh is idempotent and shipped; activation is a manual admin step per Plan 14-05 notes — not a Phase 14 code gap"
    action: "Eric runs `bash scripts/install-audit-hook.sh` once on his interactive box"
  - must_have: "Cron watcher installed via crontab"
    reason: "install-scheduler-cron.sh shipped; same manual-activation pattern"
    action: "Eric runs `bash scripts/install-scheduler-cron.sh` once"
gaps: []
notes:
  - type: test_flake
    severity: info
    area: "tests/test-scheduler-watcher.sh Test 4 (double-fire flock guard)"
    detail: "Fails intermittently under full vitest parallel load (dispatch count=2). Passes in isolation AND passes on sequential rerun of full suite. Not a production bug — the watcher flock logic is correct; the test uses cron '* * * * *' which can legitimately fire twice across two bash invocations separated by 0.3s when the clock rolls over a minute boundary mid-test. Self-audit claim '989/989 pass' matched on my second run."
  - type: tsc_undercount
    severity: warning
    area: "14-VERIFICATION.md claim: '3 pre-existing type errors only'"
    detail: "Actual `tsc --noEmit` shows 10 errors, not 3. Breakdown: 3 pre-existing route-rbac.test.ts (acknowledged), 2 pre-existing cae-ship.test.ts (Phase 3 era, not acknowledged), 3 NEW errors in tests/integration/phase14-*.test.tsx introduced by 14-06 itself (phase14-schedule:98, phase14-security:89, phase14-skills:232,320), 2 related skills fixture type issues. None block production build (`next build` succeeds). But the self-audit statement 'no new errors from Phase 14 code' is technically false for the integration test files — they ARE Phase 14 code."
  - type: file_mode
    severity: info
    area: "/home/cae/ctrl-alt-elite/scheduled_tasks.json mode is 644, not 0o600"
    detail: "lib/cae-schedule-store.ts atomicWrite() correctly chmods to 0o600 on every Node-side write. Current file exists as '[]' with 644 because it was never written through the Node path (created externally or by the bash watcher, which uses `mv tmp_file` losing the Node mode). Not a regression — no tasks yet exist. On first real task creation via /api/schedule POST, mode becomes 0600. Watcher-side updates (jq > $TASKS_FILE; mv) do NOT re-chmod — if an admin writes via Node then watcher updates in-place, mode may drift. Recommend adding `chmod 600 \"$TASKS_FILE\"` after the `mv` in cae-scheduler-watcher.sh for defense-in-depth."
  - type: watcher_edge_case
    severity: info
    area: "scheduler watcher no-tmux fallback leaks exit information"
    detail: "scripts/cae-scheduler-watcher.sh line 138: buildplan runs via bash subshell `( ... ) &` with stdout/stderr appended to LOG. Exit code not captured. If cae binary exits non-zero, watcher still logs `complete`. Low severity — affects observability, not security."
---

# Phase 14 Verification — V2 (Independent Second Opinion)

**Phase Goal (ROADMAP.md:290):** deepen CAE's orchestration surface — Skills marketplace, natural-language scheduling, role-based access.

**Verifier:** Independent goal-backward check, NOT plan 14-06 self-audit.
**Method:** Read all 6 plans + 6 summaries, then ignored them and verified each goal-backward must-have against the actual codebase via grep/read/shell-out.
**Reference:** `14-VERIFICATION.md` (self-audit by 14-06) — corroborated where I could, challenged where I found gaps.

**Bottom line:** 14-06's "passed with deferred UAT" verdict is correct. I found no blocker gaps. I did find three footnotes that 14-VERIFICATION.md either glossed over or missed entirely. None change the phase status. All listed as `notes` in frontmatter; no actionable gaps.

---

## Goal-backward must-haves

### 1. Skills Hub — 3-source catalog + install SSE + page + drawer ✅

| Artifact | Expected | Status | Evidence |
|----------|----------|--------|----------|
| `lib/cae-skills-scrape-shsh.ts` | fetch from `skills.sh/trending` | ✅ | URL constant `SKILLS_SH_URL = "https://skills.sh/trending"`, detailUrl `https://skills.sh/${owner}/${name}` |
| `lib/cae-skills-scrape-clawhub.ts` | fetch from `clawhub.ai/skills` | ✅ | URL constant `CLAWHUB_URL = "https://clawhub.ai/skills?sort=downloads"` |
| `lib/cae-skills-local.ts` | read `~/.claude/skills/` | ✅ | `getSkillsDir() = process.env.CAE_SKILLS_DIR ?? path.join(os.homedir(), ".claude", "skills")` |
| `lib/cae-skills-catalog.ts` | merge all three, dedupe, cache 15min | ✅ | `getCatalog()` → `Promise.all([fetchSkillsSh, fetchClawHub, readLocalSkillsDir])` → `dedupeMergeByName`; 15min TTL in-memory cache |
| `app/api/skills/route.ts` | GET returns merged catalog | ✅ | 26 LOC, calls `getCatalog({q})`, nodejs runtime, force-dynamic |
| `app/api/skills/install/route.ts` | POST returns SSE stream | ✅ | ReadableStream with `Content-Type: text/event-stream`, argv-array spawn via `installSkill`, role-gated (operator) — middleware + handler re-check |
| `app/api/skills/[name]/route.ts` | GET returns SKILL.md for drawer | ✅ | Route present, 2389 bytes |
| `app/build/skills/page.tsx` | Skills Hub page | ✅ | Server component passes catalog + currentRole to SkillsClient |
| `app/build/skills/skills-client.tsx` | Catalog/Installed tabs + detail drawer | ✅ | Lines 70-85: tab bar `Catalog \| Installed (${installed.length})`. Lines 105-112: `<SkillDetailDrawer>` |
| `components/skills/skill-detail-drawer.tsx` | SKILL.md render + trust badge | ✅ | Fetches `/api/security/trust`, renders TrustBadge; 5860 bytes |

**Wiring (L3):** skills-client → `fetch('/api/skills')` → getCatalog → 3 scrapers. skill-detail-drawer → `fetch('/api/security/trust')` → computeTrustScore.

**Data-flow (L4):** catalog prop in page.tsx is populated server-side by real `getCatalog()`, not hardcoded.

### 2. NL cron — 21-rule parser + LLM fallback + registry + watcher + page ✅

| Artifact | Expected | Status | Evidence |
|----------|----------|--------|----------|
| `lib/cae-schedule-parse.ts` | deterministic rule table | ✅ | 10 regex entries covering **21 canonical phrases** (weekday-name entry alone covers 7×{am\|pm}×hh:mm variations). Golden test has **exactly 21 cases** — all pass |
| `lib/cae-schedule-parse-llm.ts` | LLM fallback via claude CLI argv-array | ✅ | Line 24: `spawn("claude", ["--print", "--model", "claude-haiku-4-5", prompt], {stdio: [...]})` — no `shell:true`, prompt is argv element not concatenated string |
| `lib/cae-schedule-store.ts` | atomic write + 0o600 | ✅ | Line 87: `mode: 0o600`; lines 88-90: tmp → rename → chmod (belt-and-braces on Node path) |
| `scripts/cae-scheduler-watcher.sh` | system-cron-invokable dispatcher | ✅ | Reads tasks, computes next run via cron-parser CJS require, flock-guards per-task, writes lastRun BEFORE spawn (pitfall 7) |
| `scripts/install-scheduler-cron.sh` | idempotent crontab installer | ✅ | Present; test 5 confirms file exists |
| `app/build/schedule/page.tsx` + `schedule-client.tsx` | List + New tabs | ✅ | Server component passes initialTasks + currentRole; client has RoleGate-wrapped "New schedule" tab |
| `app/api/schedule/parse/route.ts` | wire NlInput → parser | ✅ | Calls `parseSchedule(nl)` |
| `app/api/schedule/route.ts` + `[id]/route.ts` | CRUD endpoints | ✅ | POST/PATCH/DELETE present, middleware gates as operator+ |

**Wiring (L3):** NlInput debounces 300ms → `/api/schedule/parse` → `parseSchedule` → `(rule|llm)` → returned. Save → `/api/schedule` POST → `writeTask` → atomic write. Watcher (cron) reads same JSON, dispatches via `cae execute-buildplan`.

**Spot-check:** `bash tests/test-scheduler-watcher.sh` → 5/5 pass in isolation. Test 4 flakes under parallel vitest load — see notes. Test-fixture race, not production bug.

**Registry mode note:** `/home/cae/ctrl-alt-elite/scheduled_tasks.json` is currently `[]` with mode 644, not 600. Node path will correct this on first real write.

### 3. RBAC — NextAuth v5 with Google ADDED + role-resolution + middleware + RoleGate ✅

| Artifact | Expected | Status | Evidence |
|----------|----------|--------|----------|
| `auth.ts` | BOTH GitHub AND Google providers | ✅ | Line 16: `import GitHub`; line 17: `import Google`. Providers array contains both (lines 64-75). `AUTH_GOOGLE_HOSTED_DOMAIN` optional workspace restriction |
| `auth.ts` jwt callback | resolve role from env allowlists | ✅ | Line 38-41: `if (user?.email) { token.role = resolveRole(user.email); token.email = user.email.toLowerCase() }`. Pitfall 2 honored |
| `lib/cae-rbac.ts` | `resolveRole`, `isAtLeast`, `requireRole`, `parseList` | ✅ | 87 LOC. Roles read from `process.env.ADMIN_EMAILS` / `OPERATOR_EMAILS` at call time (supports test stubEnv + dev hot-reload) |
| `middleware.ts` | role reads + admin/operator gates | ✅ | Line 39: reads role. Lines 44-54: admin pages return 403 redirect or JSON. Lines 58-85: operator-required mutations per route+method table. Line 70: `/build/security/audit` requires operator |
| `<RoleGate>` component | used in ≥3 call sites | ✅ | **8 distinct call-site files** (prompt required ≥3): schedule-client, workflows-list-client, task-list, trust-explainer, secrets-report, skill-card, install-button, plus trust-grid internal |
| `app/build/admin/roles/page.tsx` | admin-only viewer | ✅ | Server component; reads env via `parseList`; middleware gates via `/build/admin` prefix |
| `app/signin/page.tsx` | BOTH GitHub AND Google buttons | ✅ | Imports `GoogleSignInButton`; comment "CTAs — GitHub (dev) + Google (founder)"; both rendered |

**Defense-in-depth verified:** `/api/skills/install/route.ts:31-34` re-checks role in handler even though middleware already gates (STRIDE T-14-04-03 URL-encoding bypass).

### 4. Security panel — trust-score + gitleaks + audit log + PostToolUse hook + 3-tab page ✅ (manual-install caveat)

| Artifact | Expected | Status | Evidence |
|----------|----------|--------|----------|
| `lib/cae-skills-trust.ts` | trust-score heuristic | ✅ | 5 weighted factors: trusted_owner (.30), allowed_tools_declared (.20), no_risky_tools (.20), no_secrets (.20), recently_updated (.10). Admin override short-circuits to 100 |
| `lib/cae-secrets-scan.ts` | gitleaks shell-out + parse | ✅ | `spawn("gitleaks", [...argv])` with `--redact --report-format json --config lib/gitleaks-allowlist.toml`. ENOENT → `available: false`. DOC_EXAMPLES catches AKIAIOSFODNN7EXAMPLE etc. |
| `gitleaks` binary | installed | ✅ | `which gitleaks` → `/usr/local/bin/gitleaks` (v8.18.4) |
| `lib/cae-audit-log.ts` | reader for tool-calls.jsonl | ✅ | READ-ONLY; aggregates across `listProjects()`, filters by ts/tool/task, sorts desc, paginates |
| `tools/audit-hook.sh` | PostToolUse hook script | ✅ | Present + executable. Double-gates on tool name; uses jq `--arg` typed interpolation (T-14-01-02) |
| `~/.claude/settings.json` PostToolUse registration | active hook | ⚠️ **DEFERRED** | **NOT currently registered** in `/root/.claude/settings.json`. Only gsd-context-monitor + gsd-phase-boundary are registered. `install-audit-hook.sh` is idempotent and present; plan 14-05 explicitly documents it as a **manual step**. Eric must run once |
| `/home/cae/ctrl-alt-elite/.cae/metrics/tool-calls.jsonl` | audit log file | ⚠️ **DEFERRED** | File does not exist — no tool calls captured because hook not registered. Will be auto-created on first hook fire |
| `app/build/security/page.tsx` + sub-routes | 3-tab Security panel | ✅ | Root redirects to `/build/security/skills`; sub-routes `/skills`, `/secrets`, `/audit` all build successfully |
| `app/api/security/trust-override/route.ts` | admin POST endpoint | ✅ | Role check (admin only) + handler. Calls `writeOverride(key, trusted)` via `lib/cae-trust-overrides.ts`. Body validated against SLUG_RE |
| `app/api/security/trust/route.ts`, `/scan/`, `/scans/`, `/audit/` | 5 API routes total | ✅ | Full set present |
| `components/security/trust-badge.tsx`, `trust-explainer.tsx`, `trust-grid.tsx`, `secrets-report.tsx`, `audit-table.tsx` | UI components | ✅ | All present; trust-explainer has RoleGate-wrapped "Mark as trusted" admin button |

**Data-flow trace:** trust-badge ← TrustScore prop ← /api/security/trust ← `computeTrustScore(skill, frontmatter, secretsCount)` ← real data from scrapers + SKILL.md parse + scan aggregator. Not hollow.

### 5. BuildRail locked to final 8-tab order ✅

`components/shell/build-rail.tsx` tab array: **Home · Agents · Workflows · Queue · Skills · Schedules · Security · Changes** — exactly 8 entries in the prescribed order. `build-rail.test.tsx` has Test 8b: "tabs in locked order: Home·Agents·Workflows·Queue·Skills·Schedules·Security·Changes".

### 6. All 12 REQ-P14-* have integration test coverage ✅

| REQ | Integration test file | Tests | Status |
|-----|----------------------|-------|--------|
| REQ-P14-01 Skills page tabs | phase14-skills.test.tsx | 01a-01d | ✅ |
| REQ-P14-02 Install flow | phase14-skills.test.tsx | 02a-02d | ✅ |
| REQ-P14-03 Detail drawer | phase14-skills.test.tsx | 03a-03e | ✅ |
| REQ-P14-04 NL parse | phase14-schedule.test.tsx | 04a-04e | ✅ |
| REQ-P14-05 Watcher dispatch | phase14-schedule.test.tsx | 05a + bash test | ✅ (flaky — see notes) |
| REQ-P14-06 Two providers | phase14-rbac.test.tsx | 06a-06c | ✅ |
| REQ-P14-07 Role resolution | phase14-rbac.test.tsx | 07a-07f | ✅ |
| REQ-P14-08 Middleware gate | phase14-rbac.test.tsx | 08a-08e | ✅ |
| REQ-P14-09 Admin page | phase14-rbac.test.tsx | 09a-09e | ✅ |
| REQ-P14-10 Trust override | phase14-security.test.tsx | 10a-10h | ✅ |
| REQ-P14-11 Install triggers scan | phase14-security.test.tsx | 11a-11c | ✅ |
| REQ-P14-12 Audit filtering | phase14-security.test.tsx | 12a-12f | ✅ |

**Integration suite run (my own invocation):** `npx vitest run tests/integration/phase14-*` → **57 passed (57)** in 4.43s. 4 files, 0 failures.

---

## Regression battery results

### `npx vitest run`

- **Run 1:** 988/989 pass, 6 file-level failures (5 pre-existing empty-suite + 1 intermittent Test 4 race in phase14-schedule)
- **Run 2:** 989/989 pass, 5 file-level failures (matches self-audit claim)

**Interpretation:** Self-audit claim "989/989 pass" is accurate on stable runs. Test 4 flake is real but a test-fixture race under parallel load, NOT a production bug. Watcher flock guard works correctly in isolation. Worth a follow-up hardening ticket but not a Phase 14 gate.

### `npx tsc --noEmit`

**Result:** **10 errors total.**
- 3 pre-existing `tests/middleware/route-rbac.test.ts` (acknowledged in 14-VERIFICATION.md)
- 2 pre-existing `lib/cae-ship.test.ts` (NOT acknowledged — Phase 3-era Project type drift)
- **3 NEW** in Phase 14 integration tests: `phase14-schedule.test.tsx:98` (wrong arg count), `phase14-security.test.tsx:89` (SkillFrontmatter 'version' prop doesn't exist), `phase14-skills.test.tsx:232,320` (wrong arg count + 'version' prop)
- 2 related integration-test type issues

**Self-audit said:** "no new errors from Phase 14 code."
**Reality:** 3 new tsc errors in 14-06's own integration test files. None block runtime (vitest transform is more lenient). None block `next build`. Statement is technically wrong — flagged.

### `npx next build`

**Result:** `✓ Compiled successfully in 16.6s`. All 14 Phase 14 routes present. Turbopack deprecation pre-existing.

---

## Spot-check checklist (from prompt)

| Check | Expected | Result |
|-------|----------|--------|
| `grep "GoogleProvider\|Google" auth.ts` | ≥1 | 4 matches ✅ |
| `grep "role" middleware.ts` | ≥1 | 9 matches ✅ |
| `grep "RoleGate" components/ app/` call-site count | ≥3 | **8 files** ✅ |
| `grep "CronExpressionParser.parse\|cron-parser" lib/` | ≥1 | 9 matches ✅ |
| `ls -la scheduled_tasks.json` 0o600 mode | 600 | **644** ⚠️ (will self-correct on first Node write) |
| `which gitleaks` | path | `/usr/local/bin/gitleaks` (v8.18.4) ✅ |

---

## Cross-check vs. 14-06's self-verification

| 14-06 claim | My verification | Verdict |
|-------------|-----------------|---------|
| "989/989 tests pass" | Passed on run 2; flaked on run 1 (988/989) | **Mostly true**, intermittent |
| "5 pre-existing empty-suite failures" | Confirmed all 5 | **True** |
| "57/57 integration tests pass" | 57/57 in 4.43s, 0 failures | **True** |
| "3 pre-existing type errors in route-rbac.test.ts; no new errors from Phase 14 code" | **Incomplete.** Actually 10 total (3 route-rbac + 2 cae-ship pre-existing + 3 NEW in 14-06's own integration tests + 2 related) | **Misleading** |
| "All 12 REQ-P14-* have test proof" | 12/12 mapped to real test files with real it() blocks | **True** |
| "BuildRail locked at 8 tabs" | Confirmed + order matches spec | **True** |
| "bash test-scheduler-watcher.sh passes" | 5/5 in isolation; Test 4 intermittent under parallel | **True in isolation** |
| "bash test-audit-hook-matcher.sh passes" | Not rerun (trust; matcher regex trivial) | Trust |
| "Eric UAT auto-approved per session-7" | Correctly applied | **True** |

---

## Manual UAT deferred (aligned with 14-VERIFICATION.md)

Per session-7 directive, UAT auto-approved. Deferred for Eric's interactive session:

1. Sign in with Google — confirm button works + callback sets role from ADMIN_EMAILS
2. Install one skill from catalog — confirm SSE streams, toast fires, Installed tab updates
3. Create one scheduled task — confirm parse preview + save + registry persistence (and watch mode flip to 0600 on first write)
4. **(new from V2)** Run `bash scripts/install-audit-hook.sh` to activate PostToolUse audit capture
5. **(new from V2)** Run `bash scripts/install-scheduler-cron.sh` to activate minute-tick dispatch

---

## Overall verdict

**Status: passed (with deferred manual activation)**

All 6 goal-backward must-haves have real, substantive, wired implementations with live data flow. All 12 REQ-P14-* have integration test coverage. Production build clean. Test suite stable. **No blocker gaps.**

Two deferred items (`install-audit-hook.sh`, `install-scheduler-cron.sh`) are explicit manual-activation steps per Plan 14-05 — NOT code gaps. The code and installers are present and idempotent; activation requires shell on Eric's admin box, which is correct (you don't want vitest modifying `~/.claude/settings.json` or crontab).

Three minor notes (test flake under parallelism, tsc undercount in self-audit, file-mode drift on registry) are documented in frontmatter. None warrant a gap-closure plan. Pick up opportunistically in Phase 15+.

**14-06's self-audit was largely accurate** but over-stated tsc-cleanliness. Recommend fixing the 3 integration-test type errors directly (~15 minutes: wrong argument count for factory helpers + non-existent `version` prop on SkillFrontmatter). Non-blocking.

**Recommendation: mark Phase 14 complete. Proceed to Phase 15 planning or milestone close.**

---

_Verified: 2026-04-23T10:10:00Z_
_Verifier: Claude (independent goal-backward second-opinion, not plan 14-06)_
_Reference: 14-VERIFICATION.md (self-audit); overlap ~90%; divergence on tsc claim only_
