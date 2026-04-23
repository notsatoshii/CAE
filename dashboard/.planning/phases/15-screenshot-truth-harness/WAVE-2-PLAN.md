# Wave 2 — Card density + IA + Empty states (Cycle 11)

Dispatched after Wave 1 lands. Wave 2 closes the "consistency / IA / character" gap. Production-quality, no half-asses.

## 2.1 — Standardize card density

**Problem (from KANBAN-COLUMNAR-AUDIT):** Queue cards `p-3 gap-2`, Agent cards `p-4 gap-3`, Skill cards `p-3 gap-3`. Inconsistent rhythm = "tacky" perception.

**Fix:** Tailwind utility class `.card-base` in globals.css:
```css
.card-base {
  padding: var(--density-card-pad);   /* 1rem from Wave 1 token */
  gap: var(--density-card-gap);       /* 0.75rem */
  border-radius: var(--radius);
  background-color: var(--surface);
  border: 1px solid var(--border-subtle);
  transition: border-color var(--dur-quick) var(--ease-default),
              background-color var(--dur-quick) var(--ease-default);
}
.card-base:hover {
  border-color: var(--border-strong);
  background-color: var(--surface-hover);
}
.card-base:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
```

Apply to: queue-card.tsx, agent-card.tsx, skill-card.tsx, task-detail-sheet rows, recent-ledger rows.

**Atomic commit:** `style(cards): standardize density via .card-base utility`

## 2.2 — Always-visible action rows

**Problem:** AgentCard hides verbs (`opacity-0 → opacity-100 hover`). Keyboard users can't see them.

**Fix:** Replace hover-reveal with persistent compact action row at card bottom. Reduce button size (text-xs, py-1.5, px-2.5). Use --text-muted as default state, --accent on hover/focus.

Files: `components/agents/agent-card.tsx`, anywhere else with `opacity-0 group-hover:opacity-100`.

**Atomic commit:** `fix(agent-card): always-visible action row, no more hover-hidden buttons`

## 2.3 — Sidebar collapse + hover-tooltip (Linear-style)

**Problem:** No expand button per Eric. BuildRail always-expanded current. Eric wants Linear-style: collapsed by default to icons, hover-tooltip with label, click-pin to expand.

**Fix:** New component `components/shell/sidebar.tsx` replacing or wrapping BuildRail:
- Two states: `collapsed (56px)` / `expanded (224px)`
- State persists via cookie (server-readable)
- Drag-resize handle on right edge
- Each item: icon (always visible) + label (visible when expanded, in Tooltip when collapsed)
- 2px left accent line for active route
- Count badges as monospace pills
- Smooth Framer Motion width transition (motion-reduce-safe)
- Top-right: expand/collapse button with chevron icon

Library: motion (Framer Motion's new package name) — already locked in VISUAL-RESEARCH.

Tests: collapsed state, expanded state, click expand toggles, tooltip appears on collapsed icon hover, persistence via cookie.

**Atomic commit:** `feat(sidebar): collapsible Linear-style sidebar with hover tooltips`

## 2.4 — ActivePhaseCards visual upgrade

**Problem:** Progress bar 6px (too thin), small mono meta-row, no priority sort, marginal agent avatars.

**Fix:**
- Progress bar h-2 with subtle inner gradient + glow on completion
- Status-color left border (4px) per card status
- Meta-row: badge pills with icons replace mono text + separators
- Phase header: bolder, larger, with "X of Y" indicator
- Agent avatars: stacked + count pill ("3 agents") + click-to-list
- Sort: by progress (asc) > by ETA (asc); stuck phases first

File: `components/build-home/active-phase-cards.tsx`

**Atomic commit:** `style(active-phase): thicker progress, status border, badge meta, sort by stuck-first`

## 2.5 — RollupStrip semantic grouping

**Problem:** 5 metric slots peer-level, no semantic grouping, tiny dots, marginal icons.

**Fix:**
- Group into Health (Shipped + In-flight) | Warnings (Warnings + Blocked) | Cost (Tokens + spend $)
- Larger value text (text-3xl tabular-nums)
- Icon-with-label left-aligned, larger (size-4 not size-3)
- Glow dots (size-2.5 with subtle blur shadow)
- Subtle dividers between groups

File: `components/build-home/rollup-strip.tsx`

**Atomic commit:** `style(rollup): semantic grouping + larger numbers + group dividers`

## 2.6 — EmptyState primitive with character

**Problem:** Generic "no data" everywhere. No character. Eric: "no character."

**Fix:** New primitive `components/ui/empty-state.tsx`:
- Props: `icon` (lucide), `title` (1 line), `description` (2 lines max), `cta` (optional button), `tip` (optional small text below)
- Layout: icon (size-12, --text-dim) > title (text-base font-medium) > description (text-sm text-muted) > CTA > tip
- Character variants by surface family:
  - Agents empty: "No agents have run yet. Spin one up via the command palette (⌘K → 'run agent')."
  - Queue empty: "Queue is clear. Either nothing's queued, or your agents are blazing fast."
  - Logs empty: "No tool calls captured. The audit-hook fires after every Bash/Edit/Write — give it a moment."
  - Memory empty: "Memory is empty. Memory files appear here as they're created or imported."
  - Workflows empty: "No workflows defined. Create one from /build/workflows/new."
  - Skills empty: "No skills installed. Browse the catalog and click Install."
  - Schedule empty: "Nothing scheduled. Add a job from /build/schedule/new."
  - Activity empty: "All quiet. Tool calls light this up the moment you start working."
  - Generic fallback: "Nothing to show right now."

Apply across all surfaces with empty-state rendering. Replace existing "no data" strings.

Test: each surface renders the new EmptyState with the right copy when its data source is empty.

**Atomic commit:** `feat(empty-state): primitive + character copy across N surfaces`

## 2.7 — Loading skeleton primitive

**Problem:** Spinners. Eric wants Vercel/Linear-style skeletons.

**Fix:** New primitive `components/ui/skeleton.tsx`:
- Props: `width`, `height`, `lines` (for multi-line text skeleton), `variant` ('text' | 'box' | 'circle')
- Animate via tw-animate-css `animate-pulse` (motion-reduce-safe per existing globals.css overrides)
- 150-300ms show-delay (don't flash on fast loads), 300-500ms minimum visible time

Skeleton patterns to ship initially:
- Card skeleton (60×80 box)
- Row skeleton (full-width × 24px text + 16px subtitle)
- Table-row skeleton (5 cells, alternating widths)
- Sparkline skeleton (full-width × 32px box)

Replace spinners in: AgentDetailDrawer, TaskDetailSheet, MetricsClient, RecentLedger, RollupStrip, FileTree, GraphPane.

**Atomic commit:** `feat(skeleton): primitive + replace spinners across N panels`

## 2.8 — 404 + 500 pages with character

**Problem:** Default Next.js error pages.

**Fix:** Custom `app/not-found.tsx` + `app/error.tsx`:
- 404: pixel-art lost-agent illustration + "Looks like that page wandered off. Here's what's nearby:" + 3 quick links (Build home, Agents, Search ⌘K)
- 500: pixel-art broken-circuit illustration + "Something tipped over. Here's the breadcrumb:" + collapsed error stack + "Try again" CTA + "Report this" mailto link

(Pixel-art placeholders are SVG circles in pixel-art style until real sprite kit lands in Wave 9.)

**Atomic commit:** `feat(error-pages): 404 + 500 with character + breadcrumb + recovery CTA`

## 2.9 — Status pills system

**Problem:** Status colors used inconsistently across surfaces (queue / agent / phase status). No shared component.

**Fix:** Shared `components/ui/status-pill.tsx`:
- Variants: `idle | running | waiting | done | failed | warning | offline`
- Each: dot (color from --success/--warning/--danger/--info) + label (text-xs uppercase tracking-wide)
- Single import everywhere; rip out 8+ inline pill implementations

Files updated: queue-card, agent-card, active-phase-cards, recent-ledger, schedule-row, audit-table.

**Atomic commit:** `refactor(status-pill): unify status visual into shared primitive`

## Wave 2 acceptance criteria

- [ ] tsc clean
- [ ] All affected component tests pass
- [ ] One screenshot per page taken showing new look (manual, headless if possible)
- [ ] Eric refresh: new fonts, consistent card density, sidebar can collapse, no hover-hidden actions, every empty state has character

## Sequencing

Sub-tasks 2.1–2.9 can largely parallelize. Suggested batches:
- Batch A (single agent): 2.1, 2.2, 2.5, 2.4 — all touch home/agents
- Batch B (single agent): 2.6, 2.7, 2.8, 2.9 — all primitives + their adoption
- Batch C (single agent): 2.3 — sidebar (own concern, big scope)

Three parallel agents can land Wave 2 in one push.
