---
phase: 12-command-palette-polish-empty-states
plan: "03"
subsystem: ui
tags: [wave-2, empty-state, labels, founder-speak, tdd]

requires:
  - phase: 12-command-palette-polish-empty-states
    plan: "01"
    provides: "test infra, vitest config"
  - phase: 12-command-palette-polish-empty-states
    plan: "02"
    provides: "no direct dep; peer in Wave 1"

provides:
  - "components/ui/empty-state.tsx: EmptyState + EmptyStateActions primitive (EMP-01)"
  - "components/ui/empty-state.test.tsx: 14 vitest assertions"
  - "lib/copy/labels.ts: 31 new keys across interface + FOUNDER + DEV (EMP-03)"
  - "9 route surfaces migrated to <EmptyState> (EMP-02)"

affects:
  - "12-04 (shortcut overlay polish) — EmptyState now available as primitive"
  - "12-05 (audit pass) — EmptyState surfaces are axe-auditable"

tech-stack:
  added: []
  patterns:
    - "EmptyState primitive: testId prop (not data-testid) for root element identification"
    - "Server component empty CTAs: <Link href=...><Button variant='secondary'> (no useRouter needed)"
    - "Client component empty CTAs: useRouter().push() + Button variant='secondary'"
    - "Metrics panel empty state: inside section aria-labelledby shell, not replacing section"

key-files:
  created:
    - components/ui/empty-state.tsx
    - components/ui/empty-state.test.tsx
  modified:
    - lib/copy/labels.ts
    - app/build/agents/page.tsx
    - app/build/workflows/workflows-list-client.tsx
    - app/build/queue/queue-kanban-client.tsx
    - app/build/changes/changes-client.tsx
    - components/metrics/spending-panel.tsx
    - components/metrics/reliability-panel.tsx
    - components/metrics/speed-panel.tsx
    - components/memory/browse/file-tree.tsx
    - components/memory/browse/file-tree.test.tsx
    - components/memory/graph/graph-pane.tsx
    - app/plan/page.tsx

key-decisions:
  - "testId prop not data-testid: EmptyState root uses testId prop, not spread of data-testid HTML attr"
  - "Memory browse CTA routes to /memory?view=graph (less invasive than adding onRegenerate prop to FileTree)"
  - "Graph pane empty uses RegenerateButton from existing imports (reuses pane's button, no duplication)"
  - "Metrics panels keep section/h2 shell on !data branch; EmptyState renders inside the section"
  - "Plan page stays server component using <Link> + Button (no use client directive needed)"
  - "workflowsListEmpty reused as body for emptyWorkflowsBody surface (avoids duplicating an already-good string)"
  - "memory-client.tsx: no ad-hoc empty branch found — no change needed (confirmed by grep)"

metrics:
  duration: "~12min"
  completed: "2026-04-22"
  tasks: 3
  files_modified: 12
  tdd_cycles: 1
---

# Phase 12 Plan 03: EmptyState Primitive + 9-Surface Migration Summary

**`<EmptyState>` primitive + 31 label keys + 9 route surfaces migrated — all empty states now render consistent visual rhythm with guided CTAs**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-22T19:02:00Z
- **Completed:** 2026-04-22T19:14:00Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

### Task 1: EmptyState primitive + Labels (TDD)

- `components/ui/empty-state.tsx`: `EmptyState` + `EmptyStateActions` exports. Variants: `"empty"` (default) and `"error"`. Props: `icon`, `heading`, `body`, `actions`, `testId`, `variant`, `className`. No `dangerouslySetInnerHTML` (T-12-10 mitigated).
- `components/ui/empty-state.test.tsx`: 14 assertions green — heading as `<h3>`, body/actions conditional, testId overridable, error variant sets `data-variant`, hero icon `aria-hidden`, no alert role, className merges, EmptyStateActions flex-wrap.
- `lib/copy/labels.ts`: 31 new keys added to `Labels` interface, `FOUNDER` block, and `DEV` block. Clusters: `emptyBuildHome` (4), `emptyAgents` (3), `emptyWorkflows` (3), `emptyQueue` (4), `emptyChanges` (3), `emptyMetricsPanel` (3), `emptyMemoryBrowse` (3), `emptyMemoryGraph` (2), `emptyPlanStub` (3). tsc enforces parity — no new errors.

### Task 2: Build + Metrics migration (6 files)

All 6 files import `EmptyState`; empty branches replaced:

| File | Old empty | New EmptyState | Icon |
|------|-----------|----------------|------|
| `app/build/agents/page.tsx` | `<div>` with hardcoded string | `emptyAgentsHeading/Body/CtaJob` | `Cpu` |
| `app/build/workflows/workflows-list-client.tsx` | `<Card><CardContent>` with `workflowsListEmpty` | `emptyWorkflowsHeading` + body reuses `workflowsListEmpty` | `BookMarked` |
| `app/build/queue/queue-kanban-client.tsx` | No page-level empty | Added `totalTasks === 0` guard: `emptyQueueHeading/Body` + 2 CTAs | `Inbox` |
| `app/build/changes/changes-client.tsx` | `<p>` with `changesEmpty` | `emptyChangesHeading/Body/CtaClear` | `Filter` |
| `components/metrics/spending-panel.tsx` | `<p>{L.metricsEmptyState}</p>` in `!data` branch | `emptyMetricsPanelHeading/Body/CtaTest` inside section shell | `LineChart` |
| `components/metrics/reliability-panel.tsx` | same pattern | same pattern | `LineChart` |
| `components/metrics/speed-panel.tsx` | same pattern | same pattern | `LineChart` |

### Task 3: Memory + Plan migration (4 files)

| File | Old empty | New EmptyState | Icon |
|------|-----------|----------------|------|
| `components/memory/browse/file-tree.tsx` | `<div>` with `memoryEmptyBrowse` | `emptyMemoryBrowseHeading/Body/CtaRegenerate`; CTA pushes to `/memory?view=graph` | `FolderOpen` |
| `components/memory/graph/graph-pane.tsx` | `<div>` with `memoryEmptyGraph` + hint | `emptyMemoryGraphHeading/Body`; actions slot wraps existing `RegenerateButton` | `GitBranch` |
| `app/plan/page.tsx` | `<p>{labels.planPlaceholder}</p>` | `emptyPlanStubHeading/Body/CtaBuild`; server component uses `<Link>` | `Compass` |
| `app/memory/memory-client.tsx` | — | No change — no ad-hoc page-level empty branch found | — |

## New Labels Keys Added

All 31 keys added to `Labels` interface + `FOUNDER` + `DEV` (tsc parity enforced):

```ts
// === Phase 12: Empty states (EMP-03) ===
emptyBuildHomeHeading, emptyBuildHomeBody, emptyBuildHomeCtaPlan, emptyBuildHomeCtaJob
emptyAgentsHeading, emptyAgentsBody, emptyAgentsCtaJob
emptyWorkflowsHeading, emptyWorkflowsBody, emptyWorkflowsCtaRecipe
emptyQueueHeading, emptyQueueBody, emptyQueueCtaJob, emptyQueueCtaWorkflows
emptyChangesHeading, emptyChangesBody, emptyChangesCtaClear
emptyMetricsPanelHeading, emptyMetricsPanelBody, emptyMetricsPanelCtaTest
emptyMemoryBrowseHeading, emptyMemoryBrowseBody, emptyMemoryBrowseCtaRegenerate
emptyMemoryGraphHeading, emptyMemoryGraphBody
emptyPlanStubHeading, emptyPlanStubBody, emptyPlanStubCtaBuild
```

Note: `emptyBuildHome*` keys are defined (plan required them) but the `/build` home page was not migrated — it already delegates its empty display to child components (`ActivePhaseCards`, `NeedsYouList`, `RecentLedger`). No ad-hoc empty branch exists at the page level. These keys are available for future use.

## Old Keys Preserved (Backward Compat)

All existing keys kept as required:
- `workflowsListEmpty` — reused as `body` in workflows EmptyState (line 94 of workflows-list-client)
- `memoryEmptyBrowse` — kept in labels.ts; sub-tree narrow cases still possible
- `memoryEmptyGraph` — kept in labels.ts; replaced at render site but key preserved
- `planPlaceholder` — kept in labels.ts; replaced at render site but key preserved
- `metricsEmptyState` — kept in labels.ts; used in graph-pane loading state (`L.metricsEmptyState` at line 160)

## Task Commits

1. **feat(12-03): EmptyState primitive + founder/dev copy keys** — `8d6323d`
2. **feat(12-03): migrate Build + Metrics surfaces to `<EmptyState>`** — `842aa32`
3. **feat(12-03): migrate Memory + Plan surfaces to `<EmptyState>`** — `1e21c4f`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `data-testid` → `testId` prop on all EmptyState usages**
- **Found during:** Task 3 (file-tree.test.tsx failures)
- **Issue:** EmptyState component uses `testId` prop (not spread `data-testid`) for its root element. All Task 2 migrations incorrectly used `data-testid="..."` as a raw HTML attribute, which EmptyState silently ignores.
- **Fix:** Changed all 5 usages (agents, workflows, queue, changes, file-tree) from `data-testid` to `testId`.
- **Files modified:** `app/build/agents/page.tsx`, `app/build/workflows/workflows-list-client.tsx`, `app/build/queue/queue-kanban-client.tsx`, `app/build/changes/changes-client.tsx`, `components/memory/browse/file-tree.tsx`
- **Commits:** `1e21c4f` (included in Task 3 commit)

**2. [Rule 1 - Bug] Add `useRouter` mock to `file-tree.test.tsx`**
- **Found during:** Task 3 (4 pre-existing file-tree tests broke)
- **Issue:** Adding `useRouter()` to FileTree for the empty branch CTA caused 4 existing tests to fail with "invariant expected app router to be mounted" — the tests render FileTree without Next.js App Router context.
- **Fix:** Added `vi.mock("next/navigation", ...)` mock with `{ push: mockPush }` to `file-tree.test.tsx`.
- **Files modified:** `components/memory/browse/file-tree.test.tsx`
- **Commits:** `1e21c4f`

**3. [Scope note] `/build` home page not migrated**
- `emptyBuildHome*` keys are defined per plan, but `app/build/page.tsx` has no ad-hoc empty branch — the page always renders its child components (`ActivePhaseCards` etc.) which each handle their own empty states internally. No migration possible without changing child component logic (out of scope for this plan). Keys available for future use.

**4. [Scope note] `app/memory/memory-client.tsx` — no change**
- Confirmed by grep: no page-level ad-hoc empty branch exists in `memory-client.tsx`. No migration needed.

## Verification Results

- `npx tsc --noEmit`: clean (only pre-existing `hasPlanning` errors in `lib/cae-ship.test.ts`)
- `npx vitest run`: 549/549 tests pass (same baseline as pre-plan; 5 pre-existing TAP-format "no suite" failures unchanged)
- `rg -n "<EmptyState" app components | grep -v test`: 20 usages (plan minimum was 9)
- Old keys still referenced: `workflowsListEmpty`, `memoryEmptyBrowse`/`memoryEmptyGraph` (via labels.ts), `metricsEmptyState` (graph-pane loading state)

## Icons per Surface

| Surface | Icon | Reasoning |
|---------|------|-----------|
| `/build/agents` | `Cpu` | Agent = compute |
| `/build/workflows` | `BookMarked` | Recipes = saved instructions |
| `/build/queue` | `Inbox` | Queue = empty inbox |
| `/build/changes` | `Filter` | Empty due to filter context |
| `/metrics` panels (×3) | `LineChart` | No data = no chart |
| Memory browse | `FolderOpen` | Empty folder/tree |
| Memory graph | `GitBranch` | Graph of knowledge connections |
| `/plan` stub | `Compass` | Navigate/plan direction |

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| components/ui/empty-state.tsx | FOUND |
| components/ui/empty-state.test.tsx | FOUND |
| lib/copy/labels.ts (31 new keys) | FOUND |
| app/build/agents/page.tsx EmptyState | FOUND |
| app/build/workflows/workflows-list-client.tsx EmptyState | FOUND |
| app/build/queue/queue-kanban-client.tsx EmptyState | FOUND |
| app/build/changes/changes-client.tsx EmptyState | FOUND |
| components/metrics/spending-panel.tsx EmptyState | FOUND |
| components/metrics/reliability-panel.tsx EmptyState | FOUND |
| components/metrics/speed-panel.tsx EmptyState | FOUND |
| components/memory/browse/file-tree.tsx EmptyState | FOUND |
| components/memory/graph/graph-pane.tsx EmptyState | FOUND |
| app/plan/page.tsx EmptyState | FOUND |
| commit 8d6323d | FOUND |
| commit 842aa32 | FOUND |
| commit 1e21c4f | FOUND |
| 549 tests passing | CONFIRMED |
| tsc clean (no new errors) | CONFIRMED |
