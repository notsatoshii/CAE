---
phase: 14-orchestration-depth-skills-hub-cron-rbac
plan: "01"
subsystem: scaffold
tags: [scaffold, fixtures, gitleaks, audit-hook, types, labels, deps]
dependency_graph:
  requires: []
  provides:
    - lib/cae-types.ts (CatalogSkill, ScheduledTask, Role, AuditEntry, TrustScore, TrustFactor)
    - lib/copy/labels.ts (skills.*, schedule.*, permissions.*, security.*)
    - tests/fixtures/skills/* (SKILL.md, SKILL-allowed-tools.md, gitleaks-report.json, HTML snapshots)
    - tests/fixtures/schedule/* (scheduled-tasks-sample.json, tool-calls-sample.jsonl)
    - tests/helpers/spawn-mock.ts (MockChildProcess helper)
    - tools/audit-hook.sh (PostToolUse JSONL writer)
    - tools/skill-install.sh (npx skills add wrapper)
    - scripts/install-gitleaks.sh (idempotent gitleaks v8.18.4 installer)
    - .cae/metrics/.gitkeep (dir scaffold)
    - scheduled_tasks.json at repo root (empty registry)
  affects:
    - Wave 1-4 plans (all import from @/lib/cae-types and use these fixtures)
tech_stack:
  added:
    - cronstrue 3.14.0
    - cron-parser 5.5.0
    - chrono-node 2.9.0
    - gitleaks 8.18.4 (system binary)
  patterns:
    - MockChildProcess with async-iterable stdout (tests/helpers/spawn-mock.ts)
    - PostToolUse JSONL audit hook pattern (tools/audit-hook.sh)
    - gitignore negation pattern for .cae/ subdirs (!.cae/metrics/ + !.cae/metrics/.gitkeep)
key_files:
  created:
    - dashboard/lib/cae-types.test.ts
    - dashboard/scripts/install-gitleaks.sh
    - dashboard/tests/fixtures/skills/SKILL.md
    - dashboard/tests/fixtures/skills/SKILL-allowed-tools.md
    - dashboard/tests/fixtures/skills/skills-sh-trending.html
    - dashboard/tests/fixtures/skills/clawhub-skills.html
    - dashboard/tests/fixtures/skills/gitleaks-report.json
    - dashboard/tests/fixtures/skills/gitleaks-report-clean.json
    - dashboard/tests/fixtures/schedule/scheduled-tasks-sample.json
    - dashboard/tests/fixtures/schedule/tool-calls-sample.jsonl
    - dashboard/tests/helpers/spawn-mock.ts
    - dashboard/tests/helpers/spawn-mock.test.ts
    - dashboard/tools/audit-hook.sh
    - dashboard/tools/audit-hook.test.sh
    - dashboard/tools/skill-install.sh
    - ctrl-alt-elite/scheduled_tasks.json
    - dashboard/.cae/metrics/.gitkeep
  modified:
    - dashboard/lib/cae-types.ts (added 5 Phase 14 types)
    - dashboard/lib/copy/labels.ts (extended Labels interface + FOUNDER/DEV with 4 namespaces)
    - dashboard/lib/copy/labels.test.ts (added 6 Phase 14 tests)
    - dashboard/package.json (3 new deps)
    - dashboard/pnpm-lock.yaml
    - dashboard/vitest.config.ts (added tests/**/*.test.ts to include)
    - dashboard/README.md (Phase 14 dev setup section)
    - dashboard/.gitignore (Phase 14 runtime state rules)
    - .gitignore (scheduled_tasks.json + .cae/metrics exceptions)
decisions:
  - "gitleaks pinned to 8.18.4 (not latest) per T-14-01-01 — stable, verified available on linux_x64"
  - "scheduled_tasks.json at repo root (not dashboard/) — owned by cron watcher, not dashboard server"
  - "vitest.config.ts extended to include tests/**/*.test.ts — spawn-mock.test.ts lives there"
  - "gitignore negation: !.cae/metrics/ + !.cae/metrics/.gitkeep required because root .gitignore has .cae/ glob that overrides dashboard/.gitignore exceptions"
  - "audit-hook.sh registration in ~/.claude/settings.json deferred to Plan 14-05 — avoids cross-wave hook collision with Phase 8 memory-consult hook"
metrics:
  duration_seconds: 580
  completed_date: "2026-04-22"
  tasks_completed: 2
  tasks_total: 2
  files_created: 17
  files_modified: 9
  tests_added: 24
  tests_passing: 24
---

# Phase 14 Plan 01: Wave 0 Scaffold Summary

Wave 0 scaffold complete: cronstrue/cron-parser/chrono-node installed, gitleaks 8.18.4 on PATH, five shared TypeScript types (CatalogSkill, ScheduledTask, Role, AuditEntry, TrustScore) compiled, four label namespaces (skills/schedule/permissions/security) in both FOUNDER and DEV speech, eight fixture files frozen for TDD, spawn-mock helper wired, audit-hook emitting JSONL, skill-install wrapper ready.

## Tasks Completed

| # | Name | Commit | Key Outputs |
|---|------|--------|-------------|
| 1 | Install deps + gitleaks + types + labels | fcc0652 | package.json, cae-types.ts, labels.ts, install-gitleaks.sh, .cae/metrics/.gitkeep |
| 2 | Fixtures + spawn-mock + audit hook + skill-install | c40ece1 | 8 fixture files, spawn-mock.ts, audit-hook.sh, skill-install.sh |

## Verification Results

- `pnpm test lib/cae-types lib/copy/labels tests/helpers/spawn-mock` — **24/24 pass**
- `bash tools/audit-hook.test.sh` — **prints "audit-hook.sh OK"**
- `gitleaks version` — **8.18.4**
- `cat /home/cae/ctrl-alt-elite/scheduled_tasks.json` — **[]**
- `ls .cae/metrics/` — **.gitkeep present**
- `package.json` — **cronstrue 3.14.0, cron-parser 5.5.0, chrono-node 2.9.0** pinned
- `tsc --noEmit` — **no new errors** (pre-existing errors in route.test.ts, metrics-panels-loading.test.tsx, cae-ship.test.ts are out of scope)

## Type Contracts (for downstream waves)

```typescript
// lib/cae-types.ts — import these in Wave 1-4 libs
import type { CatalogSkill, ScheduledTask, Role, AuditEntry, TrustScore, TrustFactor } from "@/lib/cae-types"

// lib/copy/labels.ts — use these namespaces in Wave 1-4 components
labelFor(dev).skills.tab         // "Skills" | "Skills"
labelFor(dev).schedule.tab       // "Schedules" | "Schedules"
labelFor(dev).permissions.tab    // "Permissions" | "Permissions"
labelFor(dev).security.tab       // "Security" | "Security"
```

## Fixture Paths (for Wave 1-4 tests)

```
tests/fixtures/skills/SKILL.md                     — full frontmatter sample (disable-model-invocation: true)
tests/fixtures/skills/SKILL-allowed-tools.md       — dangerous tool scope sample
tests/fixtures/skills/skills-sh-trending.html      — 3 skill cards, .skill-card[data-name]
tests/fixtures/skills/clawhub-skills.html          — 3 skill cards, .skill-card[data-stars]
tests/fixtures/skills/gitleaks-report.json         — 2 findings (aws-access-token, openai-api-key)
tests/fixtures/skills/gitleaks-report-clean.json   — [] (clean scan)
tests/fixtures/schedule/scheduled-tasks-sample.json — 3 entries (daily, weekday, hourly)
tests/fixtures/schedule/tool-calls-sample.jsonl    — 20 lines, tasks t1+t2, tools Bash/Write/Edit/MultiEdit
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] vitest.config.ts include did not cover tests/**

- **Found during:** Task 2 verification
- **Issue:** `pnpm test tests/helpers/spawn-mock` returned "No test files found" because `vitest.config.ts` only included `lib/**`, `components/**`, `app/**`
- **Fix:** Extended `include` array with `tests/**/*.test.ts` and `tests/**/*.test.tsx`
- **Files modified:** `dashboard/vitest.config.ts`
- **Commit:** c40ece1 (bundled with Task 2)

**2. [Rule 1 - Bug] Root .gitignore `.cae/` glob blocked dashboard/.cae/metrics/.gitkeep**

- **Found during:** Task 1 git staging
- **Issue:** Root `.gitignore` has `.cae/` which matches `dashboard/.cae/` — making the exception in `dashboard/.gitignore` ineffective
- **Fix:** Added `!dashboard/.cae/`, `!dashboard/.cae/metrics/`, `!dashboard/.cae/metrics/.gitkeep` exceptions to root `.gitignore`
- **Files modified:** `.gitignore` (root)
- **Commit:** fcc0652

## Known Stubs

None — this is a scaffold-only plan. No UI components with data sources wired.

## Threat Flags

None — no new network endpoints or auth paths introduced. Shell scripts download from GitHub HTTPS (T-14-01-01 accepted with version pin).

## Self-Check: PASSED
