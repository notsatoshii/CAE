# Kanban + Columnar Layout Audit

Eric: "even the kandbans or detail expands currently suck."

## Summary

Dashboard has **one functional kanban** (Queue at /build/queue) but **static, no drag-and-drop**. Other "kanban-like" surfaces (agent grid, skills, build-home cards) are responsive grids that fail founder expectations because of:

1. Visual density + spacing inconsistency
2. No clear hierarchical grouping
3. Detail expand uses modal sheets/drawers, not inline expansion
4. Hover-reveal hides primary actions
5. Card density varies surface-to-surface (`p-3 gap-2` Queue vs `p-4 gap-3` Agents)

## Component findings

### 1. Queue kanban — `app/build/queue/queue-kanban-client.tsx` + `queue-card.tsx`
**Visual issues:** static (no DnD), small column headers, cramped cards (`p-3 gap-2`), wasted space in empty columns, silent tag truncation (`.slice(0, 3)`), fixed lg breakpoint.
**Why amateur:** looks like Jira/Linear kanban but isn't interactive. Drag-to-move is the founder muscle memory.
**Fixes:** dnd-kit drag-drop + larger headers + `p-4 gap-3` + show "+N more" on truncate + hide-empty toggle + arrow-key nav + collapsible columns.

### 2. Agent grid — `components/agents/agent-grid.tsx` + `agent-card.tsx`
**Visual issues:** hover-reveals hide actions (`opacity-0 → opacity-100`), low-contrast footer mono text, weak section separators, async drawer = spinner stare.
**Why amateur:** primary actions invisible at rest; hierarchy muddled.
**Fixes:** always-visible action row + hover preview card + section separator lines + eager-load agent details + larger card padding.

### 3. Skills catalog — `components/skills/catalog-grid.tsx` + `skill-card.tsx`
**Visual issues:** weak search input styling, crowded at 3-col, source-badge competes with name, silent description truncation, install button no feedback.
**Fixes:** larger search (`py-3 text-base` + icon), `md:grid-cols-2 xl:grid-cols-3`, source-badge as right-side pill, description preview + click-expand, install toast.

### 4. Agent lifetime stats — `components/agents/lifetime-stats.tsx`
**Visual issues:** dense stats dump, no visual tile separation, expensive-tasks table feels vestigial, mobile cramped.
**Fixes:** each stat = card with bg+border+rounded, larger tabular-nums values, color-coded per metric, sparkline replaces table for top expensive tasks.

### 5. Rollup strip — `components/build-home/rollup-strip.tsx`
**Visual issues:** auto-wrapping grid, marginal icon placement (`absolute right-3 top-3`), tiny dots (`size-1.5`), no semantic grouping.
**Fixes:** group into Health/Warnings/Cost sections, larger numbers (text-3xl), icon-with-label left-aligned, larger glow-dots for danger states.

### 6. Active phase cards — `components/build-home/active-phase-cards.tsx`
**Visual issues:** progress bar 6px (too thin), small mono meta-row, no priority sort, marginal agent avatars.
**Fixes:** h-2/h-3 progress bar with gradient, status-color left border + larger padding, badge-row with icons replaces mono separators, "X of Y" phase indicator, sort by ETA/progress.

### 7. Changes timeline — `components/changes/day-group.tsx` + `project-group.tsx`
**Visual issues:** subtle accordion header, thin border-l, instant accordion (no anim), weak day headers, accordion-in-accordion clunky.
**Fixes:** card-like project header with event-count + last-update, dot-and-line GitHub-style timeline, day-header with bg accent + colored dot, smooth Framer Motion height transition, scrollable + paginated for 100+ events.

### 8. Workflow step graph — `components/workflows/step-graph.tsx`
**Visual issues:** narrow `BOX_WIDTH=240`, no interactivity (no hover/click/edit), skeletal arrows, no color legend.
**Fixes:** interactive boxes with hover-edit-delete, dnd-kit drag-reorder, BOX_WIDTH 280 + horizontal scroll, Bézier curves with animated dash-stroke, top-of-diagram color legend, between-step "+" insert.

## Cross-cutting patterns

| Issue | Where | Fix |
|-------|-------|-----|
| No drag-and-drop anywhere | Queue, Workflows, Phase cards | Add dnd-kit |
| Card density inconsistent | Queue p-3 / Agents p-4 / Skills p-3 | Standardize `p-4 gap-3` shared utility |
| Hover-reveal hides actions | Agent cards | Always-visible compact action row |
| Detail drawers async-load | All drawers | Eager-load with 30s cache |
| Empty states generic | All empty panels | Icon + message + CTA pattern |
| Responsive breakpoints fragile | Queue / Agents / Skills | Container queries or shared mixin |

## Implementation priority

1. **High:** Queue drag-and-drop + standardize card density + Agent action reveal
2. **Medium:** Skills grid spacing, Workflow drag-reorder, eager detail-load
3. **Low:** Rollup grouping, Active-phase polish, Changes timeline visualization
