---
phase: 10-plan-mode-projects-prds-roadmaps-uat
plan: "01"
subsystem: plan-mode-scaffold
tags: [fixtures, types, tdd-red, wave-0]
dependency_graph:
  requires: []
  provides:
    - dashboard/.planning/phases/10-plan-mode-projects-prds-roadmaps-uat/__fixtures__/plan/
    - dashboard/lib/cae-shift.test.ts
    - dashboard/lib/cae-plan-gen.test.ts
    - dashboard/lib/cae-uat.test.ts
    - dashboard/lib/cae-ship.test.ts
    - dashboard/lib/cae-state.test.ts
    - dashboard/lib/cae-plan-home.test.ts
  affects:
    - dashboard/lib/cae-types.ts (Project type extended)
    - dashboard/.env.example (SHIFT_PROJECTS_HOME documented)
tech_stack:
  added: []
  patterns:
    - Shift state.json shape (schema_version, phase, updated, idea, prd, roadmap, history)
    - TDD RED scaffold pattern (import-error as test failure)
    - D-10 SHA1 UAT id contract (sha1(phaseN:bulletText).slice(0,8))
    - D-02 Project type extension pattern (optional fields, backward-compatible)
key_files:
  created:
    - dashboard/.planning/phases/10-plan-mode-projects-prds-roadmaps-uat/__fixtures__/plan/state-idea.json
    - dashboard/.planning/phases/10-plan-mode-projects-prds-roadmaps-uat/__fixtures__/plan/state-prd-drafting.json
    - dashboard/.planning/phases/10-plan-mode-projects-prds-roadmaps-uat/__fixtures__/plan/state-roadmap-ready.json
    - dashboard/.planning/phases/10-plan-mode-projects-prds-roadmaps-uat/__fixtures__/plan/state-waiting-plans.json
    - dashboard/.planning/phases/10-plan-mode-projects-prds-roadmaps-uat/__fixtures__/plan/PRD.md
    - dashboard/.planning/phases/10-plan-mode-projects-prds-roadmaps-uat/__fixtures__/plan/ROADMAP.md
    - dashboard/.planning/phases/10-plan-mode-projects-prds-roadmaps-uat/__fixtures__/plan/dot-env-example.txt
    - dashboard/lib/cae-shift.test.ts
    - dashboard/lib/cae-plan-gen.test.ts
    - dashboard/lib/cae-uat.test.ts
    - dashboard/lib/cae-ship.test.ts
    - dashboard/lib/cae-state.test.ts
    - dashboard/lib/cae-plan-home.test.ts
  modified:
    - dashboard/lib/cae-types.ts
    - dashboard/.env.example
decisions:
  - "Fixture files use Shift v3.0 state.json shape with schema_version, phase, updated, idea, prd, roadmap, history arrays"
  - "dot-env-example.txt named differently from .env.example to avoid Next.js serving restrictions; lib tests read by absolute path"
  - "cae-state.test.ts asserts against existing listProjects() via dynamic re-import with vi.resetModules() — same pattern as cae-chat-state.test.ts"
  - "Six test scaffold files produce genuine RED state (vitest reports 6 failed test files); no .skip or .todo used"
metrics:
  duration: "4m"
  completed_date: "2026-04-23"
  tasks_completed: 3
  tasks_total: 3
  files_created: 13
  files_modified: 2
---

# Phase 10 Plan 01: Wave 0 Scaffold — Shift Fixtures + Type Extension + Failing Test Contracts

**One-liner:** Shift v3.0 state.json fixtures (4 lifecycle phases), realistic PRD/ROADMAP/env samples, Project type extended with shiftPhase+shiftUpdated, and 6 RED Vitest test files that lock the cae-shift/plan-gen/uat/ship/state/plan-home contracts for Wave 1 builders.

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Write Shift-shaped fixtures + ROADMAP + .env.example fixture | `a07aa56` | 7 fixture files under `__fixtures__/plan/` |
| 2 | Extend Project type with shiftPhase + shiftUpdated, update .env.example | `2f3a2f9` | `lib/cae-types.ts`, `.env.example` |
| 3 | Write failing test scaffolds for all six lib modules (TDD RED) | `ca4317b` | 6 `*.test.ts` files in `lib/` |

## Fixtures Created

| File | Phase | Key assertion |
|------|-------|---------------|
| `state-idea.json` | `idea` | `"phase": "idea"`, only `idea` key populated |
| `state-prd-drafting.json` | `prd` | `"phase": "prd"`, `prd.user_approved: false` |
| `state-roadmap-ready.json` | `roadmap` | `prd.user_approved: true`, `roadmap.user_approved: false` |
| `state-waiting-plans.json` | `waiting_for_plans` | both approved, Shift parked (v3.0 gap) |
| `PRD.md` | — | Problem / User / Success criteria / Scope sections |
| `ROADMAP.md` | — | 3 phases × "Definition of done:" bullets (9 total, 3 per phase) |
| `dot-env-example.txt` | — | 5 valid keys, 2 comment lines, 1 blank, 1 inline comment |

## Type Extension

`dashboard/lib/cae-types.ts` `Project` interface extended with two backward-compatible optional fields per D-02:

```typescript
shiftPhase?: string | null   // Shift lifecycle phase; null = not a Shift project
shiftUpdated?: string | null // ISO timestamp from state.json::updated; Plan-home sort key
```

`tsc --noEmit` exits 0. No downstream files broken (both fields optional).

## Test Scaffolds — RED State Confirmed

`vitest run` reports **6 failed test files** (confirmed RED):

| Test file | Failure mode | it() count |
|-----------|-------------|-----------|
| `cae-shift.test.ts` | Import error: `./cae-shift` not found | 11 |
| `cae-plan-gen.test.ts` | Import error: `./cae-plan-gen` not found | 4 |
| `cae-uat.test.ts` | Import error: `./cae-uat` not found | 6 |
| `cae-ship.test.ts` | Import error: `./cae-ship` not found | 5 |
| `cae-plan-home.test.ts` | Import error: `./cae-plan-home` not found | 4 |
| `cae-state.test.ts` | Assertion failures (listProjects lacks Shift discovery) | 5 |

No `.skip`, no `.todo`, no placeholder `expect(true).toBe(true)` — each `it()` asserts real behavior.

## .env.example

Appended section documents `SHIFT_PROJECTS_HOME=/home/cae` per D-02.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan ships no runtime code paths. All stubs are intentional (Wave 1 fills them in plans 10-02/03/04).

## Threat Flags

None — fixtures contain only placeholder values (`sk_test_xxx`, `change-me`). `dot-env-example.txt` naming avoids Next.js `.env*` path restrictions (T-10-01-01 accepted per threat model).

## Self-Check: PASSED

All 13 created files verified present on disk. All 3 task commits verified in git log:
- `a07aa56` — fixtures (7 files)
- `2f3a2f9` — type extension + .env.example
- `ca4317b` — 6 failing test scaffolds
