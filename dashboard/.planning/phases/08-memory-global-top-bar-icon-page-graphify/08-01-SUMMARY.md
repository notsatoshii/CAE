---
phase: 08-memory-global-top-bar-icon-page-graphify
plan: 01
subsystem: infra
tags: [wave-0, prereqs, graphify, react-flow, vitest, explain-tooltip, tailwind-v4, install]

# Dependency graph
requires:
  - phase: 07-metrics-global-top-bar-icon-page
    provides: ExplainTooltip component (originally at components/metrics/explain-tooltip.tsx) now relocated for cross-phase reuse
provides:
  - graphifyy 0.4.29 CLI installed system-wide (pip --break-system-packages)
  - @xyflow/react@12.10.2 + @dagrejs/dagre@3.0.0 npm deps pinned
  - react-markdown@10.1.0 + remark-gfm@4.0.1 npm deps pinned
  - @xyflow/react/dist/style.css imported exactly once in app/globals.css (Tailwind-v4 pattern)
  - Vitest 1.6.1 + jsdom 24.1.3 + @testing-library/react 16.3.2 + @testing-library/jest-dom 6.9.1 as devDeps
  - vitest.config.ts with jsdom env + @ path alias mirroring tsconfig
  - tests/setup.ts registering @testing-library/jest-dom matchers
  - components/ui/explain-tooltip.tsx (relocated shared primitive)
  - /home/cae/ctrl-alt-elite/.gitignore now excludes .cae/ runtime state
  - fixtures/graphify-smoke/graph.sample.json — LIVE graphify run (144 nodes, 273 links) ground-truth schema for Wave 2
affects: [08-02, 08-03, 08-04, 08-05, 08-06, 08-07, 08-08]

# Tech tracking
tech-stack:
  added:
    - graphifyy 0.4.29 (pip, system-wide)
    - "@xyflow/react 12.10.2"
    - "@dagrejs/dagre 3.0.0"
    - react-markdown 10.1.0
    - remark-gfm 4.0.1
    - vitest 1.6.1
    - "@vitest/ui 1.6.1"
    - jsdom 24.1.3
    - "@testing-library/react 16.3.2"
    - "@testing-library/jest-dom 6.9.1"
  patterns:
    - "React-Flow v12 CSS imported in app/globals.css AFTER @import \"tailwindcss\" (Tailwind v4 pattern)"
    - "Graphify 0.4.x CLI uses subcommands (graphify update <path>) not flags; writes into target dir's graphify-out/, not cwd"
    - "Graphify networkx JSON uses links[] not edges[]; nodes have {id,label,source_file,source_location,file_type,community,norm_label}"
    - "Shared UI primitives live at components/ui/; Phase-specific composers import via @ alias"

key-files:
  created:
    - dashboard/components/ui/explain-tooltip.tsx (relocated from components/metrics/)
    - dashboard/vitest.config.ts
    - dashboard/tests/setup.ts
    - dashboard/.planning/phases/08-memory-global-top-bar-icon-page-graphify/fixtures/graphify-smoke/README.md
    - dashboard/.planning/phases/08-memory-global-top-bar-icon-page-graphify/fixtures/graphify-smoke/graph.sample.json
    - dashboard/.planning/phases/08-memory-global-top-bar-icon-page-graphify/fixtures/graphify-smoke/docs/a.md
    - dashboard/.planning/phases/08-memory-global-top-bar-icon-page-graphify/fixtures/graphify-smoke/docs/b.md
  modified:
    - /home/cae/ctrl-alt-elite/.gitignore
    - dashboard/package.json
    - dashboard/pnpm-lock.yaml
    - dashboard/app/globals.css
    - dashboard/components/metrics/speed-panel.tsx
    - dashboard/components/metrics/reliability-panel.tsx
    - dashboard/components/metrics/spending-panel.tsx
  deleted:
    - dashboard/components/metrics/explain-tooltip.tsx

key-decisions:
  - "Graphify 0.4.29 CLI uses subcommands not flags: `graphify update <path>` replaces plan's `graphify . --mode fast --no-viz --update` (D-02/research was stale)."
  - "Graphify output uses networkx `links[]` array, not `edges[]`. Wave 2 `GraphEdge` type must map from `links`."
  - "Fixture captured against dashboard/lib (144 nodes, 273 links) — not the plan's 2-file markdown fixture because graphify 0.4.x `update` is code-file-only (tree-sitter AST), not markdown-aware."
  - "Phase-6 .test.ts files use node:test format; Vitest collects them but finds 0 suites. Logged as follow-up, not a Wave-0 blocker per plan spec."

patterns-established:
  - "Pattern: React-Flow styles live in globals.css @import chain, never re-imported in components. One grep guard: `grep -c '@xyflow/react/dist/style.css' app/globals.css` must return 1."
  - "Pattern: Shared UI primitives under components/ui/ imported via @/components/ui/* alias; Phase-specific composers in components/<phase>/ import primitives from @, siblings via relative path."
  - "Pattern: Graphify runs write to target-dir/graphify-out/, so Wave 2 server code must `mv` output atomically and clean graphify-out/ from target after each run — not from cwd."

requirements-completed:
  - MEM-W0-GRAPHIFY
  - MEM-W0-DEPS
  - MEM-W0-VITEST
  - MEM-W0-EXPLAIN
  - MEM-W0-GITIGNORE

# Metrics
duration: 6min 20s
completed: 2026-04-22
---

# Phase 8 Plan 01: Wave 0 Prereqs Summary

**Installed graphify 0.4.29 + 4 new React-Flow/markdown npm deps pinned, wired Vitest with jsdom + @ alias, added @xyflow/react CSS import to globals.css in the Tailwind-v4 position, relocated ExplainTooltip to components/ui/ with 3 Phase-7 importers rewired, excluded .cae/ from CAE-root gitignore, and captured live graphify output as fixture ground-truth for Wave 2 type freezing.**

## Performance

- **Duration:** 6 min 20 s
- **Started:** 2026-04-22T12:26:33Z (Task 1 commit)
- **Completed:** 2026-04-22T12:32:53Z (Task 3 commit)
- **Tasks:** 3 / 3
- **Files modified:** 13 (7 created, 5 modified, 1 deleted via rename)

## Accomplishments

- **Graphify installed:** `/usr/local/bin/graphify` version 0.4.29 via `pip install --break-system-packages graphifyy==0.4.29`. `pip show graphifyy` confirms version (0.4.29 doesn't support `--version` — plan's verify was wrong).
- **4 npm deps pinned (zero caret):** `@xyflow/react 12.10.2`, `@dagrejs/dagre 3.0.0`, `react-markdown 10.1.0`, `remark-gfm 4.0.1`.
- **5 Vitest devDeps installed:** `vitest 1.6.1`, `@vitest/ui 1.6.1`, `jsdom 24.1.3`, `@testing-library/react 16.3.2`, `@testing-library/jest-dom 6.9.1`. Scripts `test`/`test:watch`/`test:ui` wired.
- **React-Flow CSS imported once** in `app/globals.css` on line 2 (directly after `@import "tailwindcss"`) — guarded by a grep line-count assertion.
- **ExplainTooltip promoted** from `components/metrics/explain-tooltip.tsx` to `components/ui/explain-tooltip.tsx` byte-faithfully (one-line docstring addition marking the D-15 relocation). All 3 Phase-7 consumers (speed/reliability/spending panels) rewired from `./explain-tooltip` to `@/components/ui/explain-tooltip` in the same commit as the move. Zero remaining `./explain-tooltip` refs in `components/metrics/`.
- **`.cae/` excluded** from `/home/cae/ctrl-alt-elite/.gitignore` (CAE-root level) — the dashboard-local `.gitignore` already had it.
- **Live graphify fixture captured:** `graph.sample.json` at `.planning/phases/08-memory-global-top-bar-icon-page-graphify/fixtures/graphify-smoke/` — 144 nodes, 273 links, 22 communities. Real schema documented in fixture `README.md`.
- **Build + tsc green:** `pnpm tsc --noEmit` exits 0; `pnpm build` exits 0 (24 routes compiled).

## Task Commits

1. **Task 1: Install graphify + npm deps + .gitignore + CSS import** — `9f96a1b` (feat)
2. **Task 2: Relocate ExplainTooltip to components/ui/** — `959973d` (refactor, git detected rename)
3. **Task 3: Vitest install + live graphify fixture + smoke-test** — `640a031` (feat)

## Files Created / Modified

**Created**
- `dashboard/components/ui/explain-tooltip.tsx` — shared ExplainTooltip primitive (Task 2, rename target)
- `dashboard/vitest.config.ts` — Vitest jsdom env + @ path alias (Task 3)
- `dashboard/tests/setup.ts` — @testing-library/jest-dom matchers registration (Task 3)
- `dashboard/.planning/phases/08-memory-global-top-bar-icon-page-graphify/fixtures/graphify-smoke/README.md` — fixture provenance + schema docs (Task 3)
- `dashboard/.planning/phases/08-memory-global-top-bar-icon-page-graphify/fixtures/graphify-smoke/graph.sample.json` — 140 KB live graphify output (Task 3)
- `dashboard/.planning/phases/08-memory-global-top-bar-icon-page-graphify/fixtures/graphify-smoke/docs/a.md` + `docs/b.md` — seed markdown (kept for future markdown-aware retries)

**Modified**
- `/home/cae/ctrl-alt-elite/.gitignore` — added `.cae/` exclusion
- `dashboard/package.json` — 4 new deps (pinned), 5 new devDeps, 3 new scripts
- `dashboard/pnpm-lock.yaml` — lockfile regenerated
- `dashboard/app/globals.css` — 4-line comment + `@import "@xyflow/react/dist/style.css"` after tailwindcss import
- `dashboard/components/metrics/speed-panel.tsx` — import path changed to `@/components/ui/explain-tooltip`
- `dashboard/components/metrics/reliability-panel.tsx` — same
- `dashboard/components/metrics/spending-panel.tsx` — same

**Deleted (via rename)**
- `dashboard/components/metrics/explain-tooltip.tsx` — git detected 96% similarity, tracked as rename

## Decisions Made

1. **Graphify 0.4.29 uses subcommands, not flags.** 08-RESEARCH.md and 08-CONTEXT.md D-02 both reference `graphify . --mode fast --no-viz --update` — this flag syntax does NOT exist in graphify 0.4.29. The real 0.4.x CLI is subcommand-based: `graphify update <path>` (AST-only, no LLM key needed). Wave 2 server-module planning must update its `execFile` invocation accordingly.
2. **Graphify writes `links[]`, not `edges[]`.** Plan's verification command and 08-RESEARCH.md's expected schema both assumed `edges`. Live output uses networkx's `links[]` plus a separate `hyperedges[]` field. Wave 2 `GraphEdge` type must map from `links`.
3. **Graphify writes into target dir, not cwd.** Even when cwd is elsewhere, `graphify update /some/dir` creates `/some/dir/graphify-out/graph.json`. Wave 2 server code must `mv` output from target dir AFTER the run and clean up `graphify-out/` from the target — the plan's gotcha #9 said "relative to CWD" which is wrong.
4. **Fixture source escalated to dashboard/lib** (not the plan's 2-file markdown). Graphify 0.4.x `update` subcommand uses tree-sitter AST extraction on CODE files; it prints "No code files found" and exits non-zero on markdown-only input. The plan's escalation order (docs/ → agents/ → CAE root) also lists markdown-only dirs; I escalated to `dashboard/lib` as the first dir in the CAE tree with real code. Result: 144 nodes, 273 links, 22 communities — substantive ground-truth for Wave 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Graphify CLI shape changed vs. research assumption**
- **Found during:** Task 1 verify step, Task 3 fixture run
- **Issue:** Plan Task 1 verify command `graphify --version` fails (not a supported flag in 0.4.29). Plan Task 3 command `graphify . --mode fast --no-viz --update` does not match the 0.4.29 CLI surface at all.
- **Fix:** Used `pip show graphifyy | grep Version` for version assertion (confirmed 0.4.29). Used `graphify update <path>` subcommand for Task 3 fixture run. Documented full schema + CLI discovery in `fixtures/graphify-smoke/README.md` for downstream waves.
- **Files modified:** fixtures/graphify-smoke/README.md (documentation), no code changes needed — plan's deps already support the real CLI.
- **Verification:** `command -v graphify` resolves; `graphify update /home/cae/ctrl-alt-elite/dashboard/lib` produced 140 KB of real JSON.
- **Committed in:** `640a031` (Task 3 commit)

**2. [Rule 3 — Blocking] Fixture escalation — markdown-only input produces empty graph**
- **Found during:** Task 3
- **Issue:** Plan specified `./docs/a.md` + `./docs/b.md` 2-file markdown fixture, expecting `graphify . --mode fast --no-viz --update` to extract cross-links. Graphify 0.4.29 `update` is code-file-only (tree-sitter AST), printed `[graphify watch] No code files found - nothing to rebuild.` on the fixture.
- **Fix:** Per plan's escalation clause, escalated through candidate dirs. `/home/cae/ctrl-alt-elite/docs/` and `/home/cae/ctrl-alt-elite/agents/` are also markdown-only (no code). Escalated one step further to `/home/cae/ctrl-alt-elite/dashboard/lib/` (dense TypeScript). Produced 144 nodes / 273 links / 22 communities — real ground truth.
- **Files modified:** fixtures/graphify-smoke/graph.sample.json (144 nodes from dashboard/lib).
- **Verification:** `node -e 'const g=require("./fixtures/graphify-smoke/graph.sample.json"); process.exit(g.nodes.length<1||!Array.isArray(g.links)?1:0)'` exits 0.
- **Committed in:** `640a031` (Task 3 commit)

**3. [Rule 3 — Blocking] Pre-existing Phase-6 tests are node:test, not Vitest-compatible**
- **Found during:** Task 3 smoke-test
- **Issue:** `lib/cae-workflows.test.ts`, `lib/cae-queue-state.test.ts`, `lib/cae-nl-draft.test.ts`, `components/workflows/step-graph.test.tsx` all import from `node:test`. Vitest collects them, finds zero Vitest-format suites, reports `Error: No test suite found`. `pnpm test` exits 1.
- **Fix:** Per plan Task 3 spec ("if Phase-6 tests reveal legit bugs surfaced by first real execution, document those bugs in SUMMARY.md as KNOWN-ISSUE pointers for a later --gaps plan"), NOT converting them in Wave 0. Vitest IS working (config loaded, jsdom env active, file collection succeeded, zero infrastructure errors). The framework mismatch is logged as a follow-up.
- **Verification:** `pnpm test` starts Vitest cleanly; failure is test-content-level, not infrastructure-level.
- **Committed in:** `640a031` (documented in commit message)

---

**Total deviations:** 3 auto-fixed (all Rule 3 blocking — graphify CLI surface vs. research assumption, graphify fixture escalation, and Phase-6 test-framework mismatch).
**Impact on plan:** All deviations are documentation + escalation — zero code scope creep. Wave 2 planning benefits directly: the live schema + real CLI shape are now known, preventing a second regeneration later.

## Issues Encountered

- **Graphify pollutes target dir:** running `graphify update /path/to/dir` writes `/path/to/dir/graphify-out/{graph.json,graph.html,GRAPH_REPORT.md,cache/}` into the target dir, regardless of cwd. First attempted run against `dashboard/lib` left artifacts in the source tree; cleaned up with `rm -rf`. Wave 2 server code must either (a) point graphify at a copy/symlink, or (b) always `rm -rf {target}/graphify-out/` after `mv graph.json`.

## Known Follow-ups (for --gaps plan)

- **Phase-6 tests framework conversion.** 4 test files (`lib/cae-workflows.test.ts`, `lib/cae-queue-state.test.ts`, `lib/cae-nl-draft.test.ts`, `components/workflows/step-graph.test.tsx`) currently use `node:test` — would need conversion to `describe`/`it` + `expect` for Vitest pickup. Not blocking Wave 0 (plan Task 3 explicitly declared this out-of-scope).
- **Plan 08-02 CLI update.** Wave 1's adapter wiring references `graphify` invocations that Wave 2 will refine; Wave 2 planners must read `fixtures/graphify-smoke/README.md` before touching server-module spec.

## Self-Check

Created files:
- FOUND: dashboard/components/ui/explain-tooltip.tsx
- FOUND: dashboard/vitest.config.ts
- FOUND: dashboard/tests/setup.ts
- FOUND: dashboard/.planning/phases/08-memory-global-top-bar-icon-page-graphify/fixtures/graphify-smoke/README.md
- FOUND: dashboard/.planning/phases/08-memory-global-top-bar-icon-page-graphify/fixtures/graphify-smoke/graph.sample.json

Deleted file:
- ABSENT (as expected): dashboard/components/metrics/explain-tooltip.tsx

Commits:
- FOUND: 9f96a1b (Task 1)
- FOUND: 959973d (Task 2)
- FOUND: 640a031 (Task 3)

## Self-Check: PASSED

## User Setup Required

None — all installs handled autonomously (pip + pnpm). No external services, no env vars, no API keys. Wave 2 will spawn graphify via `execFile` from server code using the CLI surface documented in the fixture README.

## Next Phase Readiness

Wave 0 complete. All Phase 8 requirements MEM-W0-* satisfied. Downstream blockers cleared:

- **08-02 (Wave 1):** memory-consult hook plumbing — unblocked (no Wave-0 dep beyond `.cae/` gitignore which is done).
- **08-03 (Wave 2):** server modules + graph API routes — unblocked, with one adjustment: `lib/cae-graph-state.ts` types MUST follow the real schema in `fixtures/graphify-smoke/graph.sample.json` (`links[]` not `edges[]`, networkx format). 08-RESEARCH.md and 08-CONTEXT.md D-02 should be annotated with the CLI-shape correction before Wave 2 execution.
- **08-04/08-05 (Wave 3):** Browse/Graph tab clients — unblocked; React-Flow CSS available globally.
- **08-07 (Wave 5):** Memory components — unblocked; `@/components/ui/explain-tooltip` canonical path now in place.

---
*Phase: 08-memory-global-top-bar-icon-page-graphify*
*Completed: 2026-04-22*
