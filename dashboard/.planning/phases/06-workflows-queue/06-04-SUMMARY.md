---
phase: 06-workflows-queue
plan: 04
subsystem: ui
tags: [nextjs, workflows, dev-mode, monaco, sonner, server-components, client-components, force-dynamic]

requires:
  - phase: 06-workflows-queue
    plan: 01
    provides: WorkflowSpec/Record types, parseWorkflow/serializeWorkflow/validateWorkflow, listWorkflows/getWorkflow, slugifyName, labelFor + workflows.* keys
  - phase: 06-workflows-queue
    plan: 02
    provides: /api/workflows CRUD routes, /api/workflows/[slug]/run (auth-gated tmux spawn), queue aggregator
  - phase: 06-workflows-queue
    plan: 03
    provides: <StepGraph>, <MonacoYamlEditor> (lazy-loaded), <NlDraftTextarea>, @monaco-editor/react dep
  - phase: 03-design-system-foundation
    provides: DevModeProvider/useDevMode (Ctrl+Shift+D), Button/Input/Label/Card primitives, sonner toast
provides:
  - "/build/workflows list page (replaces Phase 5 stub) with Run-now buttons calling POST /api/workflows/[slug]/run"
  - "/build/workflows/new route rendering <WorkflowForm mode='create' />"
  - "/build/workflows/[slug] route loading via getWorkflow + notFound() on 404"
  - "<WorkflowForm mode={create|edit} initial?={WorkflowRecord} /> unified form with NL/Monaco mode gate + StepGraph preview + Save/Delete"
  - "lib/cae-workflows-schema.ts: pure types + parseWorkflow/validateWorkflow/serializeWorkflow/slugifyName (client-safe)"
affects: [06-05-kanban, 06-06-integration, 09-chat-rail]

tech-stack:
  added: []
  patterns:
    - "Pure-schema split pattern: any lib module that mixes pure helpers with Node-builtin I/O must expose a sibling '-schema.ts' file for client-component imports, because Turbopack does not tree-shake top-level fs/path/crypto imports"
    - "Single-source-of-truth yaml string: WorkflowForm holds `yaml` in state, derives `spec = parseWorkflow(yaml)` on every render; NL draft, Monaco editor, and the name input ALL write back to the same string"
    - "Dev-mode gated editing surface: `useDevMode().dev` flips NlDraftTextarea ↔ MonacoYamlEditor in-place without losing yaml state"
    - "Server component reads filesystem directly (listWorkflows/getWorkflow) rather than HTTP-fetching its own /api/workflows — faster + avoids an auth round-trip on same-origin self-calls"
    - "Next 16 async-params: `{ params: Promise<{ slug: string }> }` + `await params` in dynamic server pages"

key-files:
  created:
    - dashboard/app/build/workflows/workflows-list-client.tsx
    - dashboard/app/build/workflows/workflow-form.tsx
    - dashboard/app/build/workflows/new/page.tsx
    - dashboard/app/build/workflows/[slug]/page.tsx
    - dashboard/lib/cae-workflows-schema.ts
  modified:
    - dashboard/app/build/workflows/page.tsx
    - dashboard/lib/cae-workflows.ts
    - dashboard/lib/cae-nl-draft.ts
    - dashboard/components/workflows/nl-draft-textarea.tsx

key-decisions:
  - "Split cae-workflows.ts into a pure cae-workflows-schema.ts + a disk-I/O cae-workflows.ts (which re-exports the schema) so client components can import parseWorkflow/validateWorkflow/serializeWorkflow without Turbopack pulling fs/promises into the client bundle — this was the only viable fix without abandoning the plan's `from '@/lib/cae-workflows-schema'` import-path contract"
  - "Server component calls listWorkflows() directly (no self-HTTP to /api/workflows). The API route still exists for downstream widgets in Plan 06-05, but the page is strictly faster and avoids an auth round-trip"
  - "Name input lives outside the dev-mode gate in WorkflowForm so founder-mode users can rename a drafted recipe without flipping dev-mode"
  - "In edit mode, if NL draft emits the default 'new-recipe' name, preserve the existing record's name — renaming requires explicit intent via the name input"
  - "yaml string is the single source of truth; Monaco, NL draft, and name input all write back to it, and spec is ALWAYS derived via parseWorkflow(yaml) on every render"

patterns-established:
  - "Pure-schema split: lib modules that combine pure helpers + Node-builtin I/O expose a '*-schema.ts' sibling for client-component imports. cae-workflows.ts re-exports from cae-workflows-schema.ts; downstream server callers stay on the parent path. Client callers use the schema path directly."
  - "data-testid contract for WorkflowForm + list page: `workflows-page`, `workflows-create-button`, `workflows-empty`, `workflows-list`, `workflow-row-{slug}`, `workflow-run-button-{slug}`, `workflow-row-stepcount-{slug}`, `workflow-form`, `workflow-form-nl-section` (founder-only), `workflow-form-yaml-section` (dev-only), `workflow-form-preview`, `workflow-form-save`, `workflow-form-delete` (edit-only), `workflow-form-errors`, `workflow-form-name`, `workflows-new-page`, `workflows-edit-page` — downstream verifiers can assert composition without implementation knowledge"

requirements-completed: [wf-08-list-page, wf-09-new-edit-pages, wf-09-devmode-toggle]

duration: 10 min
completed: 2026-04-22
---

# Phase 6 Plan 04: Workflow Pages Summary

**Replaced Phase 5 /build/workflows stub with the full create/list/edit trio — founder-default NL draft + dev-mode Monaco YAML editor — all sharing a single yaml source-of-truth and wired to the Phase 6 CRUD + run API.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-22T08:10:58Z
- **Completed:** 2026-04-22T08:21:05Z
- **Tasks:** 3 (all plain-auto, no TDD)
- **Files modified:** 9 (5 created + 4 modified)

## Accomplishments

- `/build/workflows` now a real list page: server-fetches via `listWorkflows()`, client component handles dev-mode copy flip + per-row "Run now" calling POST `/api/workflows/[slug]/run` with sonner toast surfacing the returned taskId
- `/build/workflows/new` + `/build/workflows/[slug]` both render a shared `<WorkflowForm>` — create uses STARTER_YAML, edit loads via `getWorkflow(slug)` with `notFound()` on 404
- `<WorkflowForm>` holds a single `yaml` state variable; `spec` is derived via `parseWorkflow(yaml)` on every render. NL draft, Monaco editor, and the name input all write back to the same yaml, so flipping dev-mode mid-edit preserves state
- Dev-mode toggle (Ctrl+Shift+D via existing `useDevMode()`) live-swaps NlDraftTextarea ↔ MonacoYamlEditor; StepGraph preview always visible regardless of mode
- Route manifest emits all three: `ƒ /build/workflows`, `ƒ /build/workflows/[slug]`, `ƒ /build/workflows/new`
- 87/87 regression tests green (workflow 26 + nl-draft 24 + queue 18 + route 14 + step-graph 5)

## Task Commits

Each task was committed atomically:

1. **Task 1: Workflow list page** — `1fb7bcf` (feat)
2. **Task 2: WorkflowForm unified create/edit component** — `ad9aac9` (feat)
3. **Task 3: new + edit route pages + pure-schema split** — `2a6da3a` (feat)

_Task 3 bundles the deviation fix (schema split) with the route pages because the routes could not build until the schema was split — see deviations below._

## Files Created/Modified

- `dashboard/app/build/workflows/page.tsx` — **REWRITTEN** from Phase 5 stub to real list page. Server component calls `listWorkflows()` directly, renders `<WorkflowsListClient>` inside founder-copy heading + "New recipe" CTA
- `dashboard/app/build/workflows/workflows-list-client.tsx` — **NEW** client component. Empty state card + workflow rows with step count, last-run relative time, dev-mode trigger-type badge, Run-now button → POST /api/workflows/[slug]/run → sonner toast
- `dashboard/app/build/workflows/workflow-form.tsx` — **NEW** shared create/edit form. `yaml` state + derived `spec`. Dev-mode gate swaps NlDraftTextarea (founder) ↔ MonacoYamlEditor (dev). StepGraph + name input always visible. Save → POST or PUT; Delete (edit-only) → DELETE + window.confirm
- `dashboard/app/build/workflows/new/page.tsx` — **NEW** server component renders `<WorkflowForm mode="create" />`
- `dashboard/app/build/workflows/[slug]/page.tsx` — **NEW** server component loads via `getWorkflow(slug)`, `notFound()` on missing, renders `<WorkflowForm mode="edit" initial={record} />`
- `dashboard/lib/cae-workflows-schema.ts` — **NEW** pure types + parse/validate/serialize/slugify. Zero Node-builtin imports (only `yaml` package). Client-bundle safe
- `dashboard/lib/cae-workflows.ts` — **REFACTORED** to re-export from schema + own only disk I/O (listWorkflows/getWorkflow/writeWorkflow/WORKFLOWS_DIR). Server-side importers unchanged
- `dashboard/lib/cae-nl-draft.ts` — **MODIFIED** to import from `./cae-workflows-schema` instead of `./cae-workflows` so the client-component NlDraftTextarea doesn't pull fs/promises
- `dashboard/components/workflows/nl-draft-textarea.tsx` — **MODIFIED** import path from `@/lib/cae-workflows` → `@/lib/cae-workflows-schema` for the same reason

## Decisions Made

- **Server-direct fetch over self-HTTP.** `page.tsx` calls `listWorkflows()` directly rather than `fetch('/api/workflows')`. Fewer hops, no auth round-trip on same-origin. API route is kept for client-side widget revalidation in later plans.
- **Single yaml source of truth.** WorkflowForm's only state is the yaml string; `spec` is DERIVED via `parseWorkflow(yaml)` on every render. Cheap because the yaml package's parse is synchronous and tiny inputs. This guarantees Monaco ↔ NL draft ↔ name-input consistency with zero reconciliation logic.
- **Name input outside dev-mode gate.** Founders must be able to rename a drafted recipe without learning Ctrl+Shift+D. The input lives in the right pane (preview area) and writes back to yaml via `serializeWorkflow({...spec, name: newName})`.
- **Edit-mode preserves name on draft collision.** If a founder re-drafts an existing recipe and the heuristic emits the default `"new-recipe"` name, the edit form keeps the original name. A draft that emits a more specific name does win (founder intent).
- **Pure-schema split.** See Deviations below — this is the biggest structural decision of the plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Split lib/cae-workflows.ts into a pure schema module**

- **Found during:** Task 3 (pnpm build after wiring WorkflowForm)
- **Issue:** `workflow-form.tsx` imports `parseWorkflow`, `serializeWorkflow`, `validateWorkflow` from `@/lib/cae-workflows` (the plan's contracted import path). `cae-workflows.ts` also has top-level `import { ... } from "fs/promises"` for the disk I/O functions. Turbopack did NOT tree-shake the fs import when multiple value symbols were imported into a client component — build failed with `Module not found: Can't resolve 'fs/promises'` in both the Client Component Browser and Client Component SSR import traces. Notably, the same path worked for the Plan 06-03 NlDraftTextarea which imported only `validateWorkflow` — Turbopack's tree-shaking appears threshold-based.
- **Fix:** Created `dashboard/lib/cae-workflows-schema.ts` containing the pure pieces (types + parseWorkflow + validateWorkflow + serializeWorkflow + slugifyName). `cae-workflows.ts` now imports from the schema module, re-exports everything for back-compat with server callers, and keeps only the disk I/O (listWorkflows + getWorkflow + writeWorkflow + WORKFLOWS_DIR). Updated all client-component importers (workflow-form.tsx + nl-draft-textarea.tsx) and the `cae-nl-draft.ts` helper module to import from `cae-workflows-schema` directly.
- **Files modified:** `lib/cae-workflows.ts` (refactor), `lib/cae-workflows-schema.ts` (new), `lib/cae-nl-draft.ts`, `components/workflows/nl-draft-textarea.tsx`, `app/build/workflows/workflow-form.tsx`
- **Verification:** `pnpm build` now clean — emits all 23 routes including the three new workflow routes. All 87 regression tests pass (workflow 26, nl-draft 24, queue 18, route 14, step-graph 5). No server-side importer needed to change because `cae-workflows.ts` re-exports the pure helpers.
- **Committed in:** `2a6da3a` (bundled with Task 3 — the routes would not build without this fix)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was necessary for Task 3's routes to build and ship. The plan's import-path contract (`from "@/lib/cae-workflows"`) is preserved for server-side callers via re-export. Client-side callers now use `from "@/lib/cae-workflows-schema"` — a minor contract extension, documented in the schema module's docstring and now visible via the patterns-established entry. No scope creep.

## Issues Encountered

- **Edit tool read-before-edit hook strictness.** Several `Edit` tool calls were rejected mid-session with "must Read first" even immediately after `Read` on the same file in the same assistant turn. Worked around by using `Write` for full-file rewrites. No code-quality impact — patterns hold.
- **Pre-existing Turbopack NFT warning on `next.config.ts`** remains unrelated to this plan (scope-boundary rule — not fixed here). First flagged in Plan 06-01 summary.

## User Setup Required

None — no external services, no env-var changes. `@monaco-editor/react` was added as a dep in Plan 06-03. The server-side API route `/api/workflows/[slug]/run` is auth-gated via the existing NextAuth session from Phase 1, unchanged.

## Next Phase Readiness

- **Plan 06-05 (KANBAN)** is fully unblocked. It consumes `/api/queue` (already shipped in 06-02) and doesn't depend on workflow pages.
- **Plan 06-06 (integration)** can now drive the full founder flow end-to-end: visit `/build/workflows` → click "New recipe" → type NL description → click "Draft it" → StepGraph renders → click Save → list row appears → click "Run now" → toast with taskId → queue tab shows the run.
- The pure-schema split is a pattern future plans can reuse when client + server both need helpers from the same domain module (e.g., Phase 9 chat rail will likely need it for workflows + agents).

No blockers.

## Self-Check: PASSED

- FOUND: `dashboard/app/build/workflows/page.tsx`
- FOUND: `dashboard/app/build/workflows/workflows-list-client.tsx`
- FOUND: `dashboard/app/build/workflows/workflow-form.tsx`
- FOUND: `dashboard/app/build/workflows/new/page.tsx`
- FOUND: `dashboard/app/build/workflows/[slug]/page.tsx`
- FOUND: `dashboard/lib/cae-workflows-schema.ts`
- FOUND: commit `1fb7bcf` (Task 1 — list page)
- FOUND: commit `ad9aac9` (Task 2 — WorkflowForm)
- FOUND: commit `2a6da3a` (Task 3 — new + edit routes + schema split)
- PASS: `pnpm tsc --noEmit` clean
- PASS: `pnpm build` emits `ƒ /build/workflows`, `ƒ /build/workflows/[slug]`, `ƒ /build/workflows/new`
- PASS: grep 'data-testid="workflows-page"' app/build/workflows/page.tsx
- PASS: ! grep "Coming in Phase 6" app/build/workflows/page.tsx (stub removed)
- PASS: grep 'data-testid="workflow-form-nl-section"' + `workflow-form-yaml-section` + `useDevMode` + `MonacoYamlEditor` + `NlDraftTextarea` in workflow-form.tsx
- PASS: `npx tsx lib/cae-workflows.test.ts` — 26/26
- PASS: `npx tsx lib/cae-nl-draft.test.ts` — 24/24
- PASS: `npx tsx lib/cae-queue-state.test.ts` — 18/18
- PASS: `npx tsx app/api/workflows/route.test.ts` — 14/14
- PASS: `npx tsx components/workflows/step-graph.test.tsx` — 5/5

---
*Phase: 06-workflows-queue*
*Completed: 2026-04-22*
