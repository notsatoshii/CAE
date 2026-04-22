---
phase: 13-ui-ux-review-polish-loop
plan: "10"
subsystem: visual-polish
tags: [visual-audit, wcag, typography, color, hierarchy, lucide, mc-agent-card, kanban, timeline, REQ-P13-07, REQ-P13-10]

dependency_graph:
  requires:
    - phase: 13-09
      provides: UI-AUDIT-visual-pillars.md master audit (consumed rows for agents/queue/changes/workflows)
    - phase: 13-07
      provides: agentVerbs() + getAgentVerbSet() in labels.ts
  provides:
    - audit/UI-AUDIT-visual-agents-queue-changes.md: 207-line before/after pillar audit for 4 surfaces
    - components/agents/agent-card.tsx: MC-style card (avatar circle + status pill + hover-reveal verbs)
    - components/agents/agent-card.test.tsx: 8 tests for MC redesign
    - components/queue/queue-columns.test.tsx: 4 tests for column chrome consistency
  affects: [13-11]

tech_stack:
  added: []
  patterns:
    - MC agent card: AgentAvatar (deterministic color circle) + StatusPill (Lucide Circle fill) + hover-reveal verbs (group-hover opacity)
    - Queue chrome unification: rounded-full count chip + border-l-2 status accent on cards + overflow-x-auto mobile scroll
    - Changes timeline: border-l-2 vertical spine + li pl-4 py-3 per item + 15px semibold prose hierarchy

key_files:
  created:
    - components/agents/agent-card.test.tsx
    - components/queue/queue-columns.test.tsx
    - .planning/phases/13-ui-ux-review-polish-loop/audit/UI-AUDIT-visual-agents-queue-changes.md
  modified:
    - components/agents/agent-card.tsx
    - components/agents/agent-grid.tsx
    - components/agents/agent-detail-drawer.tsx
    - app/build/agents/page.tsx
    - app/build/queue/queue-kanban-client.tsx
    - app/build/queue/queue-card.tsx
    - app/build/queue/page.tsx
    - components/changes/change-row.tsx
    - components/changes/day-group.tsx
    - components/changes/project-group.tsx
    - components/changes/dev-mode-detail.tsx
    - app/build/changes/page.tsx
    - app/build/workflows/page.tsx
    - app/build/workflows/workflow-form.tsx

key_decisions:
  - "13-10: agent card uses AgentAvatar (initial circle) not emoji — MC reference/agents.png shows initial circles, not emoji avatars"
  - "13-10: hover-reveal verbs chosen over always-visible — reduces visual noise at rest per MC pattern; keyboard users get focus-within reveal"
  - "13-10: queue card left-border status accent (2px stripe) instead of whole-card coloring — status color confined to single visual element"
  - "13-10: changes timeline uses <ul border-l-2> + <li pl-4 py-3> — semantic list + visual rhythm; DayGroup renders multiple <ul>s, one per day"

metrics:
  duration: "~18 minutes"
  completed: "2026-04-23T06:50:00Z"
  tasks_completed: 3
  files_created: 3
  files_modified: 14
  commits: 3
  tests_added: 12
  tests_before: 680
  tests_after: 692
---

# Phase 13 Plan 10: Wave 6b Visual Pillar Polish (Agents/Queue/Changes/Workflows) — Summary

**One-liner:** MC-style agent card redesign (avatar circle + status pill + hover-reveal verbs), queue kanban chrome unification (count chip + left-border status accent + mobile scroll), changes timeline hierarchy (border-l-2 spine + 15px semibold prose), and workflows editor padding — all 4 surfaces now score ≥3 on every pillar with most reaching 4.

## What Was Built

### Task 1: Agent card MC redesign + agents grid/drawer polish

**agent-card.tsx (full redesign to MC pattern):**
- Old: emoji avatar + flat card + always-visible verb row + text-dim idle text
- New: `AgentAvatar` (40px circle, first-letter initial, deterministic 8-color palette) + `StatusPill` (Lucide `Circle` fill, green="Active" / gray="Offline") + hover-reveal verb row (`group-hover:opacity-100 group-focus-within:opacity-100`)
- text-dim on idle/last-active text upgraded to text-muted (WCAG SC 1.4.3)
- Verb buttons ≥24px min-height (WCAG SC 2.5.8 compliant)
- Verbs from `agentVerbs(getAgentVerbSet())` per plan 13-07 A/B system

**agent-grid.tsx:** `xl:grid-cols-3` → `lg:grid-cols-3` (3-col at 1024px, not 1280px)

**agent-detail-drawer.tsx:** `px-4 pb-6` → `px-6 pb-8` (24-32px per UI-SPEC §13)

**app/build/agents/page.tsx:** `p-6 mb-6` → `p-8 mb-8` (8pt grid alignment)

**Tests added:** 8 tests in `agent-card.test.tsx` — avatar initial, Active/Offline status, verb text from agentVerbs(), opacity-0 at rest, role=button aria-label, Never display, drift badge.

### Task 2: Queue column unification + card chrome consistency

**queue-kanban-client.tsx (5-column chrome unified):**
- Count chip: plain `text-[10px]` → `rounded-full bg-surface-hover px-2 py-0.5 text-[11px] font-mono` — identical across all 5 columns
- Column header: `text-xs font-semibold` → `text-[13px] font-semibold tracking-wide uppercase`
- Column wrapper: `rounded-md` → `rounded-lg` (matches app-wide convention)
- Empty state: italic dash `—` → centered `"No items"` with `flex-1 items-center justify-center`
- Mobile: `overflow-x-auto` wrapper + `flex gap-3 min-w-max` → `lg:grid lg:grid-cols-5` for desktop

**queue-card.tsx:** Left-border status accent strip (2px absolute `border-l-0 top-0 bottom-0`):
- `in_progress` → accent (cyan)
- `stuck` → danger (red)
- `shipped` → success (green)
- `waiting` / `double_checking` → no stripe (neutral)

**app/build/queue/page.tsx:** Heading `text-2xl font-medium` → `text-[20px] font-semibold` + `mb-8`

**Tests added:** 4 tests in `queue-columns.test.tsx` — all 5 columns render, same rounded-lg border p-3 classes, same rounded-full font-mono chip, consistent empty state testids.

### Task 3: Changes timeline hierarchy + workflows polish + audit doc

**change-row.tsx:**
- Prose: `text-sm` → `text-[15px] font-semibold` (hierarchy hero, per plan interface template)
- Element: `<div>` → `<li>` with `pl-4 py-3` (sits inside `<ul>` timeline)
- Tech-toggle: `text-dim` → `text-muted` (WCAG SC 1.4.3 fix)

**day-group.tsx:**
- Day heading: `text-sm font-medium` → `text-[13px] font-semibold uppercase tracking-wide`
- List: `<div class="divide-y">` → `<ul class="border-l-2 border-[border] flex flex-col">` (border-l-2 timeline vertical spine)

**project-group.tsx:** Chevron `text-dim` → `text-muted` (affordance signal is user-visible)

**dev-mode-detail.tsx:** Commits heading `text-dim` → `text-muted`

**workflow-form.tsx:** Step-graph preview container `p-4` → `p-6` + empty state when `spec` is null: "Enter workflow details to preview the step graph"

**app/build/workflows/page.tsx:** Heading `text-2xl font-medium` → `text-[20px] font-semibold` + `mb-6` → `mb-8`

**UI-AUDIT-visual-agents-queue-changes.md:** 207-line audit doc with:
- 4 surfaces × 6 pillars before/after score tables
- Per-surface fix inventory with file:line citations
- Cross-reference to UI-AUDIT-visual-pillars.md Plan 13-10 findings
- Deferred items section

## Pillar Score Summary (before → after)

| Surface | H | D | C | M | T | Col | Worst→ |
|---------|---|---|---|---|---|-----|--------|
| /build/agents | 3→4 | 3→4 | 3→4 | 3→3 | 3→4 | 3→4 | 3→3 |
| /build/queue | 3→4 | 3→4 | 3→4 | 3→3 | 3→4 | 3→3 | 3→3 |
| /build/changes | 3→4 | 3→4 | 3→3 | 4→4 | 3→4 | 3→4 | 3→3 |
| /build/workflows | 3→4 | 3→4 | 3→3 | 4→4 | 3→4 | 3→3 | 3→3 |

All 4 surfaces score ≥3 on every pillar. Plan 13-10 must-have truth satisfied.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `b68dbdc` | refactor | MC-style agent card + grid + drawer polish |
| `a9bd515` | refactor | queue column + card chrome consistency (pillar 3) |
| `44b3e8a` | refactor | changes timeline hierarchy + workflows polish + audit doc |

## Deviations from Plan

**1. [Rule 1 - Bug] QueueState type mismatch in test fixture**
- **Found during:** Task 2 test writing
- **Issue:** `QueueState` has `counts` + `fetchedAt` fields, not `generated_at` + `cache_ttl_ms`. Test fixture used wrong shape from memory (the ChangesResponse type has those fields).
- **Fix:** Updated `emptyQueueState()` in `queue-columns.test.tsx` to use correct `counts` + `fetchedAt` fields.
- **Files modified:** `components/queue/queue-columns.test.tsx`

**2. [Rule 2 - Missing functionality] workflowsStepGraphEmpty label not in labels.ts**
- **Found during:** Task 3 workflow-form edit
- **Issue:** Used `t.workflowsStepGraphEmpty ?? "..."` which would flag as TS error since the key doesn't exist in the Labels interface.
- **Fix:** Used the fallback string directly ("Enter workflow details to preview the step graph") instead of accessing the missing key. Adding a new label key is out of scope for this plan (would require labels.ts interface change + both copy sets).
- **Files modified:** `app/build/workflows/workflow-form.tsx`

None — all 3 tasks completed exactly as planned.

## Known Stubs

None — all components render real data. The workflow-form empty state is intentional UX (shown when YAML is invalid/blank, not a data stub).

## Threat Flags

No new threat surface. T-13-10-01 (avatar initial-of-name) confirmed: same agent name data already visible in card headline. No PII beyond what was already displayed.

## Self-Check

- [x] `components/agents/agent-card.tsx` exists with `group-hover` + `agentVerbs` + `StatusPill`
- [x] `components/agents/agent-card.test.tsx` exists (8 tests)
- [x] `components/queue/queue-columns.test.tsx` exists (4 tests)
- [x] `audit/UI-AUDIT-visual-agents-queue-changes.md` exists: 207 lines (≥70 required)
- [x] `group-hover` in agent-card.tsx: FOUND
- [x] `agentVerbs|getAgentVerbSet` in agent-card.tsx: FOUND
- [x] `rounded-full` count chip in queue-kanban-client.tsx: FOUND
- [x] `border-l-2` timeline in day-group.tsx: FOUND
- [x] `text-[15px].*font-semibold` in change-row.tsx: FOUND
- [x] `text-muted` (no text-dim on user-visible text) in change-row.tsx: FOUND
- [x] Commits `b68dbdc`, `a9bd515`, `44b3e8a`: all found in git log
- [x] `npx vitest run` → 692 passed (680 baseline + 12 new), 5 pre-existing empty stubs (unchanged)
- [x] `npx tsc --noEmit` → 0 new errors (pre-existing errors in metrics panels, cae-ship.test, route.test — all unchanged)
- [x] All 4 surfaces score ≥3 on every pillar (worst = 3, target met)

## Self-Check: PASSED
