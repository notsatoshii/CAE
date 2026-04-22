---
phase: 10-plan-mode-projects-prds-roadmaps-uat
plan: "03"
subsystem: plan-gen-uat-pipeline
tags: [plan-gen, uat, sha1, tmux, tdd-green, wave-1, security]
dependency_graph:
  requires:
    - dashboard/lib/cae-types.ts (Project type)
    - dashboard/.planning/phases/10-plan-mode-projects-prds-roadmaps-uat/__fixtures__/plan/ (ROADMAP.md fixture)
  provides:
    - dashboard/lib/cae-plan-gen.ts
    - dashboard/lib/cae-uat.ts
  affects:
    - dashboard/lib/cae-plan-gen.test.ts (now GREEN)
    - dashboard/lib/cae-uat.test.ts (now GREEN)
tech_stack:
  added: []
  patterns:
    - Sentinel-based regex for JS multiline end-of-string boundary (no \Z support in JS)
    - sha1(phaseN:bulletText).slice(0,8) stable UAT item id contract (D-10)
    - TypeScript function overloads for (string, ...) and (Project, ...) dual-calling-convention
    - Upsert semantics on patchUatState for fresh-project compatibility
    - POSIX single-quote shell escaping via quote() (matches cae-shift.ts pattern)
    - tmux new-session -d detached spawn with claude --print --append-system-prompt-file
key_files:
  created:
    - dashboard/lib/cae-plan-gen.ts
    - dashboard/lib/cae-uat.ts
  modified: []
decisions:
  - "extractPhase1 uses sentinel approach (append '## Phase 999999: sentinel') rather than \\Z workaround — cleaner JS regex, easier to understand and maintain"
  - "writeBuildplan and stubPlan are TypeScript overloaded for both (projectRoot: string, slug: string, content: string) and (proj: Project, phase1Text: string) — tests call the string overload; API routes call the Project overload"
  - "patchUatState upserts on missing id (creates item with placeholder label) rather than throwing — matches test scaffold 'If item not found (fresh project), patch creates it' expectation"
  - "loadUatState always persists state to disk after merge — ensures consistent file for subsequent reads even on first call"
  - "CAE_ARCH_PERSONA path points to /home/cae/ctrl-alt-elite/.claude/skills/cae-arch/SKILL.md — directory does not exist yet; path is runtime-only (only matters when runPlanGen is actually invoked)"
metrics:
  duration: "8m"
  completed_date: "2026-04-23"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 10 Plan 03: lib/cae-plan-gen.ts + lib/cae-uat.ts — ROADMAP → PLAN → UAT Pipeline

**One-liner:** Two server-only TypeScript libs (542 lines total) finalizing the ROADMAP → auto-PLAN → UAT checklist pipeline: `cae-plan-gen` extracts Phase 1, writes BUILDPLAN.md, spawns tmux-detached claude --print; `cae-uat` hashes DoD bullets to stable sha1 ids and persists per-phase pass/fail state with orphan detection; all 10 tests green.

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Implement cae-plan-gen.ts — extract, writeBuildplan, runPlanGen, stubPlan | `7e10256` | `lib/cae-plan-gen.ts` (235 lines, 4 exports) |
| 2 | Implement cae-uat.ts — parseSuccessCriteria + state persistence | `fe2994d` | `lib/cae-uat.ts` (307 lines, 3 public exports + 2 types) |

## Exported Symbols

### cae-plan-gen.ts

| Symbol | Kind | Contract |
|--------|------|----------|
| `PlanGenResult` | interface | `{spawned: boolean, sid?: string, planPath: string}` |
| `extractPhase1(md)` | fn | Returns `## Phase 1` section verbatim, null if absent |
| `writeBuildplan(root, slug, content)` / `writeBuildplan(proj, phase1Text)` | overloaded fn | Writes `.planning/phases/01-<slug>/BUILDPLAN.md` |
| `runPlanGen(proj)` | async fn | tmux-detached `claude --print --append-system-prompt-file` spawn; stubPlan fallback |
| `stubPlan(root, slug)` / `stubPlan(proj)` | overloaded fn | Writes WAITING FOR PLANS stub PLAN.md |

### cae-uat.ts

| Symbol | Kind | Contract |
|--------|------|----------|
| `UatItem` | interface | `{id, label, status, note?, ts?, orphaned?}` |
| `UatState` | interface | `{phase: number, items: UatItem[]}` |
| `UatPatch` | interface | `{phase, id, status, note?}` — patch object shape |
| `parseSuccessCriteria(md)` | fn | `Map<phaseNum, UatItem[]>`; sha1(phase:text) ids |
| `loadUatState(root, N)` / `loadUatState(proj, N)` | overloaded async fn | Load/init `.planning/uat/phaseN.json` with merge+orphan detection |
| `patchUatState(root, patch)` / `patchUatState(proj, N, id, status, note?)` | overloaded async fn | Update item status; upsert on missing id |

## Test Results

| Test File | Result | Tests |
|-----------|--------|-------|
| `lib/cae-plan-gen.test.ts` | PASSED | 4/4 |
| `lib/cae-uat.test.ts` | PASSED | 6/6 |
| **Total** | **PASSED** | **10/10** |

## Key Implementation Details

### extractPhase1: Sentinel-based Boundary (Wave 2 reference)

**Problem:** JavaScript's multiline regex (`/gm`) treats `$` as end-of-line, not end-of-string. The `\Z` anchor (true end-of-string) from Python/Perl regex does not exist in JS. A lookahead `(?=^##\s+Phase\s+\d+\b|$)` in multiline mode matches end-of-*line* at every line, causing the match to terminate at the first line boundary.

**Solution:** Sentinel approach — append `\n## Phase 999999: sentinel\n` to the input before matching. This guarantees every phase section (including the last one) has a following `## Phase N` heading in the lookahead `(?=^##\s+Phase\s+\d+\b)`. The sentinel match is then skipped or stripped before returning.

```typescript
const sentinel = "\n## Phase 999999: sentinel";
const src = roadmapMd + sentinel;
const re = /^(##\s+Phase\s+1\b[^\n]*\n[\s\S]*?)(?=^##\s+Phase\s+\d+\b)/m;
```

Alternative considered: `(?=^##\s+Phase\s+\d+\b|(?![\s\S]))` — the "negative lookahead for any character" trick. Rejected because it reads as magic and is brittle when regex engines differ. Sentinel is explicit and testable.

### parseSuccessCriteria: Same Sentinel, Applied to All Phases

The same sentinel technique is applied in `parseSuccessCriteria` using `matchAll`. Phase 999999 is explicitly skipped in the loop body. The DoD block boundary uses `(?:\n[ \t]*\n|$)` — blank line or end-of-section-body — which correctly handles single-phase fixtures with no trailing blank line.

### patchUatState: Upsert on Missing ID

The plan interface specified `throw Error("uat item <id> not found in phase N")` on missing id. However, the test scaffold comment says "If item not found (fresh project), patch creates it" and checks `result.items.length >= 0` without expecting a throw. The test calls `patchUatState` on a fresh `/tmp` project with a hardcoded `"abc12345"` id that doesn't exist in any ROADMAP.

**Resolution:** Upsert semantics — when the id is not found, a new item is created with a placeholder label. This passes the tests and is consistent with the "fresh project" use case. The original plan's throw-on-missing contract can be enforced by callers (e.g., API routes) when operating on known-good project state.

## Deviations from Plan

### Auto-adapted Behaviors

**1. [Rule 1 - Adaptation] writeBuildplan and stubPlan signatures differ from plan spec**
- **Found during:** Reading test files before implementation
- **Issue:** Test scaffold calls `writeBuildplan(projectRoot, slug, content)` (3 string args) and `stubPlan(projectRoot, slug)` (2 string args). Plan spec defines `writeBuildplan(proj: Project, phase1Text: string)` (Project object).
- **Fix:** TypeScript function overloads — both calling conventions work. Tests use the string overload; API routes (plan 10-05) use the Project overload.
- **Files modified:** `lib/cae-plan-gen.ts`

**2. [Rule 1 - Adaptation] patchUatState uses upsert instead of throw on missing id**
- **Found during:** Reading test scaffold comment "If item not found (fresh project), patch creates it"
- **Issue:** Plan spec says throw; test expects successful result with `items.length >= 0` even when id doesn't exist.
- **Fix:** Upsert semantics (create item with placeholder label on miss). Documented above.
- **Files modified:** `lib/cae-uat.ts`

**3. [Rule 1 - Adaptation] patchUatState object-patch overload**
- **Found during:** Reading test scaffold which calls `patchUatState(projectRoot, patch)` with a `{phase, id, status, note}` object.
- **Issue:** Plan spec defines `patchUatState(proj, phaseNum, id, status, note?)` with explicit positional args.
- **Fix:** Added `UatPatch` interface and overloaded for both calling conventions.
- **Files modified:** `lib/cae-uat.ts`

## Known Stubs

None — all functions are fully implemented. `runPlanGen` spawns real tmux processes; no mock data flows to UI rendering. `CAE_ARCH_PERSONA` path (`/home/cae/ctrl-alt-elite/.claude/skills/cae-arch/SKILL.md`) doesn't exist yet but is only used at runtime when `runPlanGen` is actually invoked.

## Threat Flags

None — no new network endpoints or auth paths. T-10-03-01 (shell injection in runPlanGen) mitigated via `quote()`. T-10-03-05 (regex backtracking in parseSuccessCriteria) mitigated via anchored lookaheads and non-greedy quantifiers with sentinel boundary.

## Self-Check: PASSED

- `dashboard/lib/cae-plan-gen.ts` exists: FOUND (235 lines, ≥120 minimum)
- `dashboard/lib/cae-uat.ts` exists: FOUND (307 lines, ≥140 minimum)
- Commit `7e10256` in git log: FOUND
- Commit `fe2994d` in git log: FOUND
- `npx vitest run lib/cae-plan-gen.test.ts lib/cae-uat.test.ts` → 10/10 passed
- `grep -c "claude-opus-4-7" lib/cae-plan-gen.ts` → 1 (≥1 required)
- `grep -c "sha1" lib/cae-uat.ts` → 5 (≥1 required)
- `grep -c "WAITING FOR PLANS" lib/cae-plan-gen.ts` → 1 (≥1 required)
- `tsc --noEmit` → only 2 pre-existing errors (cae-ship.ts, cae-plan-home.ts not yet implemented); 0 new errors from this plan
