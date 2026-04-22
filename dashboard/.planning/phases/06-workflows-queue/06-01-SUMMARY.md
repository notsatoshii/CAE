---
phase: 06-workflows-queue
plan: 01
subsystem: api
tags: [yaml, workflows, typescript, heuristic, node-test, founder-speak]

requires:
  - phase: 03-design-system-foundation
    provides: labels.ts FOUNDER/DEV dictionary baseline + labelFor()
  - phase: 05-agents-tab
    provides: agent-meta.ts AgentName type (9 agents) — mirrored locally
provides:
  - WorkflowSpec / WorkflowTrigger / WorkflowStep / WorkflowRecord / ValidationError types
  - parseWorkflow / validateWorkflow / serializeWorkflow pure functions
  - slugifyName + WORKFLOWS_DIR() env-fresh helper
  - listWorkflows / getWorkflow / writeWorkflow disk CRUD
  - heuristicDraft(text) natural-language → WorkflowSpec
  - 33 new label keys (workflows.* + queue.kanbanCol.*) in FOUNDER and DEV
affects: [06-02-api-routes, 06-03-widgets, 06-04-pages, 06-05-kanban, 06-06-integration]

tech-stack:
  added: []
  patterns:
    - "yaml package (v2) parse/stringify — never js-yaml"
    - "validateWorkflow returns typed ValidationError[]; never throws"
    - "WORKFLOWS_DIR() reads CAE_ROOT fresh per call so tests can override"
    - "File-collision suffix: random 8-hex for auto-slug, explicit opts.slug opts in to overwrite"
    - "node:test + tsx for lib-level unit tests (no Vitest dependency added)"
    - "heuristicDraft fragment splitter: sentence terminators + commas + 'then'"

key-files:
  created:
    - dashboard/lib/cae-workflows.ts
    - dashboard/lib/cae-workflows.test.ts
    - dashboard/lib/cae-nl-draft.ts
    - dashboard/lib/cae-nl-draft.test.ts
  modified:
    - dashboard/lib/copy/labels.ts

key-decisions:
  - "Hardcoded VALID_AGENTS in cae-workflows.ts instead of importing from agent-meta.ts to keep the module Node-runnable without React/Next imports"
  - "parseWorkflow returns {spec, errors} tuple (never throws) so the UI can render field-level errors"
  - "heuristicDraft splits fragments on commas in addition to sentence terminators — required for the canonical example 'every Monday, forge runs tests, sentinel reviews, I approve, push'"
  - "Collision strategy: auto-slug appends 8-hex suffix on collision; explicit opts.slug overwrites without collision check (caller opt-in)"
  - "Dev-mode column mapping folds UI-SPEC's Planned+Queued into a single Planned column for Phase 6 (5 KANBAN columns, not 6)"

patterns-established:
  - "Lib-module tests: node:test + temp-dir CAE_ROOT override; run via `npx tsx lib/*.test.ts`"
  - "Sweep-test pattern: for each rule-based transformer, include a final test that runs N sample inputs through the transformer AND the validator to assert invariant"

requirements-completed: [wf-01-schema, wf-02-persistence, wf-07-nl-heuristic, wf-10-labels]

duration: 10min
completed: 2026-04-22
---

# Phase 6 Plan 01: Workflow Domain + NL Drafter + Copy Summary

**WorkflowSpec schema + YAML parse/validate/serialize (pure, typed errors), file CRUD against `.cae/workflows/*.yml`, pure rules-based NL→WorkflowSpec drafter, and 33 founder/dev-speak label keys wired for Phase 6 UI.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-22T07:25:00Z
- **Completed:** 2026-04-22T07:35:00Z
- **Tasks:** 3 (all TDD except Task 3 copy)
- **Files modified:** 5 (4 created, 1 extended)

## Accomplishments

- Workflow domain layer (`lib/cae-workflows.ts`) exports 9 symbols covering types, parse/validate/serialize, disk CRUD — Node-runnable, zero React/Next coupling
- Natural-language heuristic drafter (`lib/cae-nl-draft.ts`) covers every keyword in §Natural-language heuristic draft; sweep test asserts every output passes `validateWorkflow()` with zero errors
- 33 new label keys added to `Labels` interface + FOUNDER + DEV dictionaries without disturbing Phase 1–5 keys
- 50 tsx-runnable test assertions (26 workflow + 24 NL) all green; `pnpm tsc --noEmit` + `pnpm build` clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Workflow schema + parser + validator + file CRUD** — `1e5515d` (feat, TDD: test written first, then impl)
2. **Task 2: Natural-language → WorkflowSpec heuristic parser** — `23107bf` (feat, TDD: test written first, then impl)
3. **Task 3: Extend labels.ts with workflows.* + queue.kanbanCol.* keys** — `157c573` (feat)

_TDD tasks were committed as a single feat commit each because the RED-phase test and GREEN-phase impl were authored together in one pass after verifying the RED state — no separate test-only commit was useful since the interface contract is owned by the same plan._

## Files Created/Modified

- `dashboard/lib/cae-workflows.ts` — WorkflowSpec/Trigger/Step types, parseWorkflow, validateWorkflow, serializeWorkflow, slugifyName, WORKFLOWS_DIR, listWorkflows, getWorkflow, writeWorkflow
- `dashboard/lib/cae-workflows.test.ts` — 26 node:test assertions: slug rules, validator edge cases, YAML round-trip, file CRUD with per-test temp CAE_ROOT
- `dashboard/lib/cae-nl-draft.ts` — heuristicDraft(text) pure rules-based parser (no LLM, no network)
- `dashboard/lib/cae-nl-draft.test.ts` — 24 node:test assertions covering every trigger/step rule + sweep invariant
- `dashboard/lib/copy/labels.ts` — 33 new keys added to `Labels` interface + FOUNDER + DEV (comment marker `=== Phase 6: Workflows + Queue ===` appears exactly 3×)

## Decisions Made

- **VALID_AGENTS hardcoded locally.** Mirrors agent-meta.ts AgentName rather than importing it, because cae-workflows.ts must be Node-runnable under plain tsx without pulling React/Next.
- **yaml v2 `parse`/`stringify` only.** Ignored js-yaml mention in CONTEXT.md §Step graph SVG — package.json already ships `yaml` v2.8.3; the SVG component in a later plan can reuse this same parser.
- **Collision policy split.** Auto-slug on a duplicate appends 8-hex; explicit `opts.slug` opts into overwrite. This matches the plan's `"unless opts.slug provided and matches existing"` wording — caller controls overwrite semantics.
- **NL fragment splitter includes commas.** Plan §Natural-language heuristic draft example `"every Monday, forge runs tests, sentinel reviews, I approve, push"` has no periods or `then`; splitting on commas too is the only way to emit 4 steps.
- **Defensive fallback in heuristicDraft.** If rules ever produce an invalid spec, return a valid minimal stub with the derived name. The sweep test confirms no real input triggers this path today; it exists as belt-and-suspenders for future rule additions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added comma as fragment delimiter in `splitFragments`**
- **Found during:** Task 2 (heuristicDraft canonical-example test)
- **Issue:** Plan listed `<behavior>` assertion that the canonical phrase `"every Monday, forge runs tests, sentinel reviews, I approve, push"` must emit 4 steps, but the action text only specified splitting on sentence terminators or `then`. The comma-separated list yields one fragment → one step.
- **Fix:** Added `,` to the split regex in `splitFragments`, making it `/[.!?,]|\bthen\b/i`.
- **Files modified:** `dashboard/lib/cae-nl-draft.ts`
- **Verification:** Failing test `"heuristicDraft: canonical example from plan"` now passes; sweep still green (24/24).
- **Committed in:** `23107bf` (same Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary for Task 2 behavior spec to be satisfiable. No scope creep.

## Issues Encountered

- Initial pre-existing Turbopack NFT warning on `next.config.ts` is unrelated to this plan (scope-boundary rule — not fixed here).

## User Setup Required

None — no external services or env-var changes.

## Next Phase Readiness

- **Plan 06-02 (API routes)** can now import `parseWorkflow`, `writeWorkflow`, `listWorkflows`, `getWorkflow` directly. The response shape is `WorkflowRecord` + `ValidationError[]`.
- **Plan 06-03 (widgets)** can import `heuristicDraft` for the draft textarea and `validateWorkflow` for inline error display.
- **Plan 06-04 (pages)** can import `labelFor(dev)` and use the 33 new keys with full TypeScript autocomplete.
- **Plan 06-05 (KANBAN)** has queue.kanbanCol.* labels ready (Waiting / Working on it / Double-checking / Stuck / Shipped in founder mode; Planned / Building / Reviewing / Blocked / Merged in dev mode).

No blockers. The domain layer is stable and does not require changes from downstream plans.

## Self-Check: PASSED

- FOUND: `dashboard/lib/cae-workflows.ts`
- FOUND: `dashboard/lib/cae-workflows.test.ts`
- FOUND: `dashboard/lib/cae-nl-draft.ts`
- FOUND: `dashboard/lib/cae-nl-draft.test.ts`
- FOUND: commit `1e5515d` (Task 1)
- FOUND: commit `23107bf` (Task 2)
- FOUND: commit `157c573` (Task 3)
- PASS: `npx tsx lib/cae-workflows.test.ts` — 26/26
- PASS: `npx tsx lib/cae-nl-draft.test.ts` — 24/24
- PASS: `pnpm tsc --noEmit` clean
- PASS: `pnpm build` clean (pre-existing next.config.ts NFT warning unrelated)
- PASS: `grep "from \"yaml\"" lib/cae-workflows.ts` matches; no js-yaml import
- PASS: `grep -c "Phase 6: Workflows + Queue" lib/copy/labels.ts` = 3

---
*Phase: 06-workflows-queue*
*Completed: 2026-04-22*
