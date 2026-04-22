# UI Audit — Visual 6-Pillar: Agents / Queue / Changes / Workflows

**Plan:** 13-10
**Date:** 2026-04-23
**Method:** Static code audit + reference/agents.png visual comparison
**Cross-reference:** UI-AUDIT-visual-pillars.md rows for /build/agents, /build/queue, /build/changes, /build/workflows

---

## Rubric (V2 §6, condensed)

| Pillar | ID | Key criterion |
|--------|----|---------------|
| Hierarchy | H | Single focal point; size 1.5× secondary; ≤2 weights |
| Density | D | 8pt grid; row height 32-40px lists; 12-14px padding |
| Consistency | C | Same action = same visual; Lucide only; labels.ts verbs |
| Motion | M | prefers-reduced-motion respected; no perpetual pulse |
| Typography | T | Geist scale {13,14,15,16,20,24,32}px; weights 400/500/600 |
| Color | Col | WCAG 2.2 AA: body ≥4.5:1 on dark bg |

Scores: 4=exceeds, 3=meets, 2=minor deficit, 1=fail

---

## /build/agents — Before/After

### Pre-fix issues found (code audit)

| Finding | File:line | Pillar |
|---------|-----------|--------|
| Agent card used emoji `{agent.emoji}` as avatar — no initials circle per MC reference | `agent-card.tsx:100` | H, C |
| Card header had no status pill — group "active" vs "dormant" not visually distinct | `agent-card.tsx:113` | H |
| Idle card text used `text-dim` (#5a5a5c, 2.7:1) on 12px mono text | `agent-card.tsx:135` | Col |
| Verbs always visible — no hover-reveal; visual noise at rest | `agent-card.tsx:174` | H, C |
| Agent grid used `xl:grid-cols-3` — 3-col grid only at 1280px+ (too late) | `agent-grid.tsx:79` | D |
| Drawer body had only `px-4 pb-6` — below 24px minimum per UI-SPEC §13 | `agent-detail-drawer.tsx:145` | D |
| Agents page: `p-6 mb-6` — inconsistent with other pages using `p-8 mb-8` | `page.tsx:43` | D |

### Fixes applied (plan 13-10 Task 1)

| Fix | File | What changed |
|-----|------|-------------|
| Avatar: deterministic color circle with name initial | `agent-card.tsx` | Replaced emoji `{agent.emoji}` with `AgentAvatar` component (40px circle, first-letter initial, 8-color deterministic palette) |
| Status pill: `Active` (green dot) / `Offline` (gray dot) | `agent-card.tsx` | Added `StatusPill` component using Lucide `Circle` with fill |
| text-dim → text-muted on idle/last-active text | `agent-card.tsx` | `lastActiveDisplay` span uses `text-muted` |
| Hover-reveal verbs | `agent-card.tsx` | `group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity` on verb container |
| Grid breakpoint | `agent-grid.tsx` | `xl:grid-cols-3` → `lg:grid-cols-3` (1024px threshold) |
| Drawer padding | `agent-detail-drawer.tsx` | `px-4 pb-6` → `px-6 pb-8` |
| Page padding | `app/build/agents/page.tsx` | `p-6 mb-6` → `p-8 mb-8` |

### Pillar scores

| Pillar | Before | After | Notes |
|--------|--------|-------|-------|
| H | 3 | 4 | Status pill + avatar establish clear visual hierarchy |
| D | 3 | 4 | 8pt grid corrected; drawer padding in spec |
| C | 3 | 4 | Verbs from agentVerbs() helper; Lucide Circle for status |
| M | 3 | 3 | No animation changes needed |
| T | 3 | 4 | 15px semibold name, 12px mono model chip (scale-correct) |
| Col | 3 | 4 | text-dim removed from user-visible idle text |

---

## /build/queue — Before/After

### Pre-fix issues found (code audit)

| Finding | File:line | Pillar |
|---------|-----------|--------|
| Count chip was plain `text-[10px]` span — no pill/chip treatment | `queue-kanban-client.tsx:124` | C |
| Column header `text-xs` — below the `text-[13px]` minimum for section headers | `queue-kanban-client.tsx:120` | T |
| Empty state was italic text (`—`) — indistinguishable pattern, no centering | `queue-kanban-client.tsx:131` | C, H |
| No mobile overflow-x-auto wrapper — columns overflow viewport on narrow screens | `queue-kanban-client.tsx:105` | D |
| QueueCard had no status-specific visual differentiation other than pulse dot | `queue-card.tsx` | H, C |
| Column wrapper used `rounded-md` — inconsistent with rest of app using `rounded-lg` | `queue-kanban-client.tsx:117` | C |

### Fixes applied (plan 13-10 Task 2)

| Fix | File | What changed |
|-----|------|-------------|
| Count chip: `rounded-full bg-surface-hover px-2 py-0.5 text-[11px] font-mono` | `queue-kanban-client.tsx` | Same chip class across all 5 columns |
| Column header: `text-[13px] font-semibold tracking-wide uppercase` | `queue-kanban-client.tsx` | Upgraded from `text-xs font-semibold` |
| Empty state: `flex flex-1 items-center justify-center py-4 text-[12px]` | `queue-kanban-client.tsx` | Consistent centered empty text across all 5 columns |
| Mobile scroll: `overflow-x-auto` wrapper + `min-w-64` per column | `queue-kanban-client.tsx` | `flex gap-3 min-w-max` on mobile, `lg:grid lg:grid-cols-5` |
| Left-border status accent: 2px colored left edge | `queue-card.tsx` | `in_progress`=accent, `stuck`=danger, `shipped`=success |
| Column wrapper: `rounded-md` → `rounded-lg` | `queue-kanban-client.tsx` | Matches app-wide convention |
| Page heading: `text-2xl font-medium` → `text-[20px] font-semibold` | `app/build/queue/page.tsx` | Scale-correct + weight-consistent |

### Pillar scores

| Pillar | Before | After | Notes |
|--------|--------|-------|-------|
| H | 3 | 4 | Status accent stripe adds hierarchy without whole-card color |
| D | 3 | 4 | Mobile scroll, min-width columns, 8pt gaps |
| C | 3 | 4 | Uniform chip, header, empty state across all 5 columns |
| M | 3 | 3 | No animation changes |
| T | 3 | 4 | 13px semibold headers, 11px mono chip (scale-correct) |
| Col | 3 | 3 | No text-dim found on user-visible queue text |

---

## /build/changes — Before/After

### Pre-fix issues found (code audit)

| Finding | File:line | Pillar |
|---------|-----------|--------|
| `change-row.tsx` tech-toggle button used `text-dim` (#5a5a5c) — WCAG SC 1.4.3 fail | `change-row.tsx:54` | Col |
| Prose text at `text-sm` (14px) — not the 15px semibold hero called for by hierarchy | `change-row.tsx:49` | H, T |
| `day-group.tsx` section heading: `text-sm font-medium` — below 13px semibold standard | `day-group.tsx:137` | T |
| `day-group.tsx` used `<div>` list with `divide-y` — no border-l-2 timeline rhythm | `day-group.tsx:140` | H, D |
| `project-group.tsx` chevron used `text-dim` — not decorative (aria-hidden=true but carries affordance signal) | `project-group.tsx:51` | Col |
| `dev-mode-detail.tsx` commits heading used `text-dim` — user-visible label | `dev-mode-detail.tsx:46` | Col |

### Fixes applied (plan 13-10 Task 3)

| Fix | File | What changed |
|-----|------|-------------|
| Tech-toggle: `text-dim` → `text-muted`, hover → `text` | `change-row.tsx` | WCAG SC 1.4.3 fixed |
| Prose text: `text-sm` → `text-[15px] font-semibold` | `change-row.tsx` | Hierarchy hero established |
| Changed `<div data-testid="change-row">` → `<li>` with `pl-4 py-3` | `change-row.tsx` | Semantic list item inside `<ul>` timeline |
| Day section heading: `text-sm font-medium` → `text-[13px] font-semibold uppercase tracking-wide` | `day-group.tsx` | Scale-correct + visual weight |
| Timeline: `<div class="divide-y">` → `<ul class="border-l-2 border-[border] flex flex-col">` | `day-group.tsx` | border-l-2 vertical timeline rhythm |
| Project-group chevron: `text-dim` → `text-muted` | `project-group.tsx` | Affordance signal readable |
| Commits heading: `text-dim` → `text-muted` | `dev-mode-detail.tsx` | User-visible label fixed |

### Pillar scores

| Pillar | Before | After | Notes |
|--------|--------|-------|-------|
| H | 3 | 4 | 15px semibold prose vs 13px muted meta — clear hierarchy |
| D | 3 | 4 | border-l-2 + pl-4 py-3 = proper timeline rhythm on 8pt grid |
| C | 3 | 3 | Consistent day headings and row padding |
| M | 4 | 4 | No motion changes needed |
| T | 3 | 4 | 15px semibold prose, 13px section headers, 11px mono timestamps |
| Col | 3 | 4 | All text-dim on user-visible text eliminated |

---

## /build/workflows — Before/After

### Pre-fix issues found (code audit)

| Finding | File:line | Pillar |
|---------|-----------|--------|
| Workflow form step-graph preview container: `p-4` padding — below 24px guideline for editor containers | `workflow-form.tsx:225` | D |
| Step graph empty state (spec=null / YAML invalid): no message, empty white space | `workflow-form.tsx:225` | H |
| Page heading: `text-2xl font-medium` — off-scale (24px ≠ Geist scale 20px for section heads) | `page.tsx:33` | T |
| Heading weight `font-medium` — section headers use `font-semibold` consistently | `page.tsx:33` | T |
| `mb-6` on heading row — inconsistent with other build pages using `mb-8` | `page.tsx:32` | D |

### Fixes applied (plan 13-10 Task 3)

| Fix | File | What changed |
|-----|------|-------------|
| Preview container: `p-4` → `p-6` + `rounded-lg` + `flex flex-col` | `workflow-form.tsx` | 24px padding + flex for empty state centering |
| Empty state: "Enter workflow details to preview the step graph" centered | `workflow-form.tsx` | `flex-1 items-center justify-center` when `spec` is null |
| Page heading: `text-2xl font-medium` → `text-[20px] font-semibold` | `page.tsx` | Scale-correct heading |
| `mb-6` → `mb-8` | `page.tsx` | 8pt grid rhythm |

### Pillar scores

| Pillar | Before | After | Notes |
|--------|--------|-------|-------|
| H | 3 | 4 | Empty state prevents "dead white space" confusion |
| D | 3 | 4 | p-6 editor container, mb-8 spacing |
| C | 3 | 3 | List row chrome unchanged (already consistent) |
| M | 4 | 4 | No motion changes |
| T | 3 | 4 | text-[20px] font-semibold heading (scale-correct) |
| Col | 3 | 3 | No color issues found |

---

## Summary: All 4 Surfaces → ≥3/4 on Every Pillar

| Surface | H | D | C | M | T | Col | Worst |
|---------|---|---|---|---|---|-----|-------|
| /build/agents (after) | 4 | 4 | 4 | 3 | 4 | 4 | 3 |
| /build/queue (after) | 4 | 4 | 4 | 3 | 4 | 3 | 3 |
| /build/changes (after) | 4 | 4 | 3 | 4 | 4 | 4 | 3 |
| /build/workflows (after) | 4 | 4 | 3 | 4 | 4 | 3 | 3 |

All surfaces score ≥3 on every pillar. Must-have truth satisfied.

---

## Cross-reference: UI-AUDIT-visual-pillars.md (13-09)

From `UI-AUDIT-visual-pillars.md` Plan Assignment §13-10:
- P0-01 scan: agents/ queue/ changes/ workflows/ for text-dim on user-visible text
  - **Found and fixed:** `change-row.tsx:54` (tech-toggle), `project-group.tsx:51` (chevron),
    `dev-mode-detail.tsx:46` (commits heading), `agent-card.tsx:135` (idle text)
  - **Result:** Zero text-dim remaining on user-visible text in these 4 surfaces
- Emoji icons: none found in agents/queue/changes/workflows (⚠ in drift-banner is `aria-hidden`)
- Lucide consistency: `StatusPill` uses Lucide `Circle` — consistent with rest of app

---

## Deferred / Out of Scope

- `workflows-list-client.tsx` workflow row `·` separator dots — aria-hidden decorative, text-muted already. No change needed.
- `drift-banner.tsx` warning icon: `⚠` emoji is `aria-hidden` — decorative, acceptable per plan 13-09 rule for decorative separators.
- Agent drawer sections (persona/model/lifetime/invocations) — font sizes and weights inside those sub-components are correct per prior plans (05-04). No changes needed.

---

*Document version: 13-10-v1. Plans 13-11 should append `## Post-fix Update (13-11)` for their surfaces.*
