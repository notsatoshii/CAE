---
phase: 14-orchestration-depth-skills-hub-cron-rbac
plan: "03"
subsystem: cron-scheduler
tags: [cron, nl-parse, scheduler, watcher, scheduled-tasks, chrono-node, rule-parser, llm-fallback]
dependency_graph:
  requires:
    - 14-01 (cae-types.ts ScheduledTask, cronstrue/cron-parser/chrono-node deps, scheduled_tasks.json empty registry)
    - 14-02 (BuildRail 6-tab base, /build/* page pattern)
  provides:
    - lib/cae-schedule-parse.ts (parseSchedule: 21-rule deterministic + LLM fallback)
    - lib/cae-schedule-parse-llm.ts (defaultLlm: claude shell-out + test guard)
    - lib/cae-schedule-describe.ts (describeCron: cronstrue + cron-parser next-run)
    - lib/cae-schedule-store.ts (readTasks/writeTask/deleteTask/toggleTask atomic r/w)
    - app/api/schedule/route.ts (GET list, POST create with path-traversal guard)
    - app/api/schedule/parse/route.ts (POST NL→cron, 10/min/IP rate-limit)
    - app/api/schedule/[id]/route.ts (PATCH toggle, DELETE remove)
    - app/api/schedule/next-run/route.ts (GET ?cron=&tz=)
    - app/build/schedule/page.tsx (/build/schedule server page)
    - components/schedule/nl-input.tsx (300ms debounce + CronPreview)
    - components/schedule/cron-preview.tsx (english + next-run pill + source pill)
    - components/schedule/task-list.tsx (table with toggle/delete/expand)
    - components/shell/build-rail.tsx (7-tab BuildRail with Schedules)
    - scripts/cae-scheduler-watcher.sh (every-minute watcher daemon)
    - scripts/install-scheduler-cron.sh (idempotent crontab installer)
  affects:
    - 14-04 (RBAC middleware will gate /api/schedule/parse POST to operator+)
    - 14-05 (watcher.jsonl + scheduler events visible in Security panel)
tech_stack:
  added: []
  patterns:
    - "21-rule deterministic NL parser (regex table + RuleHandler) — zero cost, zero latency"
    - "LLM fallback via claude shell-out with argv array (injection-safe)"
    - "Hand-rolled Zod-free validator (cron via CronExpressionParser, tz via Intl.supportedValuesOf)"
    - "Atomic file write: writeFile(tmp, 0o600) + rename + chmod(0o600)"
    - "In-memory rate-limit bucket (Map<IP, {count, resetAt}>) — resets on server restart"
    - "flock -n per-task in watcher subshell prevents double-fire (pitfall 7)"
    - "lastRun written BEFORE spawn (pitfall 7 mitigation)"
    - "DASHBOARD_DIR env var allows watcher to find cron-parser in any CAE_ROOT"
key_files:
  created:
    - dashboard/lib/cae-schedule-parse.ts
    - dashboard/lib/cae-schedule-parse.test.ts
    - dashboard/lib/cae-schedule-parse-llm.ts
    - dashboard/lib/cae-schedule-parse-llm.test.ts
    - dashboard/lib/cae-schedule-describe.ts
    - dashboard/lib/cae-schedule-describe.test.ts
    - dashboard/lib/cae-schedule-store.ts
    - dashboard/lib/cae-schedule-store.test.ts
    - dashboard/app/api/schedule/parse/route.ts
    - dashboard/app/api/schedule/parse/route.test.ts
    - dashboard/app/api/schedule/route.ts
    - dashboard/app/api/schedule/route.test.ts
    - dashboard/app/api/schedule/[id]/route.ts
    - dashboard/app/api/schedule/[id]/route.test.ts
    - dashboard/app/api/schedule/next-run/route.ts
    - dashboard/app/build/schedule/page.tsx
    - dashboard/app/build/schedule/schedule-client.tsx
    - dashboard/app/build/schedule/new/page.tsx
    - dashboard/components/schedule/nl-input.tsx
    - dashboard/components/schedule/nl-input.test.tsx
    - dashboard/components/schedule/cron-preview.tsx
    - dashboard/components/schedule/task-list.tsx
    - dashboard/components/schedule/task-list.test.tsx
    - dashboard/scripts/cae-scheduler-watcher.sh
    - dashboard/scripts/install-scheduler-cron.sh
    - dashboard/scripts/README.md
    - dashboard/tests/test-scheduler-watcher.sh
  modified:
    - dashboard/lib/cae-types.ts (added createdAt + createdBy to ScheduledTask)
    - dashboard/lib/cae-types.test.ts (updated fixtures with new required fields)
    - dashboard/components/shell/build-rail.tsx (7th tab: Schedules, Clock icon)
    - dashboard/components/shell/build-rail.test.tsx (updated to assert 7 tabs + locked order)
decisions:
  - "Hand-rolled validator instead of Zod — avoids adding new Wave 0 dependency; ~40 lines covers all cases"
  - "cron-parser v5 uses CronExpressionParser.parse() not parseExpression() — confirmed from node_modules API inspection"
  - "Watcher uses CJS require() not ESM import — avoids --input-type=module heredoc quoting issues in bash"
  - "DASHBOARD_DIR env var added to watcher for cron-parser path — decouples from CAE_ROOT which varies in tests"
  - "install-scheduler-cron.sh NOT auto-run during pnpm install — manual step per plan; Plan 14-06 VERIFICATION checklist item"
  - "In-memory rate-limit (Map, not Redis) — sufficient for v0.1 solo-user; documented limitation"
  - "ScheduledTask extended with createdAt+createdBy (Rule 2) — plan spec required them; 14-01 scaffold had omitted them"
metrics:
  duration_seconds: 943
  completed_date: "2026-04-23"
  tasks_completed: 3
  tasks_total: 3
  files_created: 27
  files_modified: 4
  tests_added: 69
  tests_passing: 69
  bash_tests_added: 5
  bash_tests_passing: 5
---

# Phase 14 Plan 03: NL Cron Scheduler Summary

Deterministic-first NL scheduler shipped end-to-end: 21-rule regex parser covers 80%+ of founder phrases without LLM, LLM fallback via claude shell-out with argv injection guard, cronstrue+cron-parser describe+next-run, atomic Zod-free registry store, 4 API routes with rate-limit and path-traversal guards, /build/schedule page with live preview, every-minute watcher daemon with flock double-fire protection, idempotent crontab installer. BuildRail extended to 7 tabs.

## Tasks Completed

| # | Name | Commit | Key Outputs |
|---|------|--------|-------------|
| 1 | NL parser + describer + store | 8ddd274 | 4 lib files, 42 tests green |
| 2 | API routes + /build/schedule + components + BuildRail 7-tab | 1c1e857 | 17 files, 27 tests green |
| 3 | Watcher + installer + bash test | db1cbf9 | 4 script files, 5 bash tests pass |
| fix | ScheduledTask type + fixture update | 3e9591c | cae-types.ts + cae-types.test.ts |

## Verification Results

- `pnpm test lib/cae-schedule app/api/schedule components/schedule components/shell/build-rail` — **69/69 pass** (10 test files)
- `bash tests/test-scheduler-watcher.sh` — **prints "scheduler watcher OK"** (5/5 pass)
- `pnpm build` — **clean** (✓ Compiled successfully, TypeScript pass)
- New routes built: `/api/schedule`, `/api/schedule/parse`, `/api/schedule/[id]`, `/api/schedule/next-run`, `/build/schedule`, `/build/schedule/new`

## Security Mitigations Applied

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-14-03-01: Injection via buildplan path | `path.normalize` + `startsWith(CAE_ROOT)` + `..` check | Applied in POST /api/schedule |
| T-14-03-02: Tampering via direct file write | `writeFile(tmp, 0o600)` + `rename` + `chmod(0o600)` | Applied in cae-schedule-store.ts |
| T-14-03-03: DoS via LLM cost abuse | 10/min/IP in-memory rate-limit on /api/schedule/parse | Applied; operator gate deferred to 14-04 |
| T-14-03-04: Injection via task id in shell | `^[a-z0-9-]+$` regex at write-time; watcher single-quotes id | Applied at store + watcher layers |
| T-14-03-05: Direct file edit | chmod 0o600 owned by dashboard user | Accepted risk (shell access = worse options) |
| T-14-03-06: Repudiation | scheduler.jsonl has id+ts; createdBy on ScheduledTask | Applied |
| T-14-03-07: Double-fire | flock -n + lastRun before spawn | Applied in watcher |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Fields] ScheduledTask missing createdAt/createdBy**

- **Found during:** Task 1 store implementation
- **Issue:** Plan spec (must_haves.truths) states `{id,nl,cron,timezone,buildplan,enabled:true}` but also references `createdAt` and `createdBy` in the context `<interfaces>` block. The 14-01 scaffold ScheduledTask type only had 7 fields; `createdAt` and `createdBy` were absent.
- **Fix:** Added both fields to `ScheduledTask` interface, updated `cae-types.test.ts` fixtures, and all store/route code uses them.
- **Files modified:** `lib/cae-types.ts`, `lib/cae-types.test.ts`
- **Commit:** 3e9591c

**2. [Rule 1 - Bug] cron-parser v5 API is `CronExpressionParser.parse()` not `parseExpression()`**

- **Found during:** Task 1 implementation — plan action showed `CronParser.parseExpression()` which is the v4 API
- **Issue:** cron-parser v5 exports `CronExpressionParser` class with `.parse()` static method; the old `parseExpression()` function no longer exists
- **Fix:** All parse calls use `CronExpressionParser.parse(cron, { tz })` throughout
- **Files modified:** `lib/cae-schedule-parse.ts`, `lib/cae-schedule-describe.ts`, `lib/cae-schedule-store.ts`
- **Commit:** 8ddd274

**3. [Rule 1 - Bug] Watcher compute_next_run failed silently with wrong CRON_PARSER_DIR**

- **Found during:** Task 3 bash test — watcher ran but dispatched 0 tasks
- **Issue:** Original watcher computed `CRON_PARSER_DIR="$CAE_ROOT/dashboard/..."` — wrong when `CAE_ROOT` is a temp dir in tests. Also used `--input-type=module` heredoc which had quoting issues with `cron` variable containing spaces (`* * * * *`).
- **Fix:** Added `DASHBOARD_DIR` env var (defaults to `/home/cae/ctrl-alt-elite/dashboard`) as separate config; switched from ESM heredoc to CJS `node -e` with `require()` for cleaner variable substitution.
- **Files modified:** `scripts/cae-scheduler-watcher.sh`, `tests/test-scheduler-watcher.sh`
- **Commit:** db1cbf9

### Out-of-scope Pre-existing Failures (deferred)

Pre-existing test failures NOT introduced by this plan:
- `app/api/workflows/route.test.ts` — ERR_MODULE_NOT_FOUND for next-auth (pre-Phase 14)
- `lib/cae-workflows.test.ts` — empty test suite (pre-Phase 14)
- `components/workflows/step-graph.test.tsx` — empty test suite (pre-Phase 14)
- `components/metrics/metrics-panels-loading.test.tsx` — VitestUtils type mismatch (pre-Phase 14)
- `lib/cae-ship.test.ts` — missing `hasPlanning` in Project fixture (pre-Phase 14)

## Known Stubs

**1. createdBy hardcoded as "unknown" in POST /api/schedule**

- **File:** `app/api/schedule/route.ts` line with `createdBy: "unknown"`
- **Reason:** RBAC middleware (`session.user.email`) ships in Plan 14-04. Comment: `// TODO(14-04): populate from session.user.email after RBAC`
- **Impact:** Schedule entries have `createdBy: "unknown"` until 14-04 wires the session.

**2. Crontab not auto-installed**

- **File:** `scripts/install-scheduler-cron.sh`
- **Reason:** Plan explicitly marks this as manual setup (IMPORTANT note in plan). Watcher will not run on schedule until `bash scripts/install-scheduler-cron.sh` is executed by the admin.

## Threat Flags

None — all new endpoints are within the existing /api/* surface. No new auth paths or schema changes at trust boundaries beyond what is already covered by the plan's threat model.

## Self-Check: PASSED
