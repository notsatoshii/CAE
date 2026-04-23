# Wave 4 — Drag-drop kanban + Workflow flowchart + Build history + Skills tree (Cycle 16)

Closes Eric's "kanban doesn't behave like a kanban" + "no clickthrough on recent builds" + "workflows look like garbage" complaints.

## 4.1 — Queue kanban drag-drop with dnd-kit (Wave 2 Batch missed item)

**File:** `app/build/queue/queue-kanban-client.tsx`

**Library:** dnd-kit/core + dnd-kit/sortable (industry standard, react-beautiful-dnd is dead per VISUAL-RESEARCH §9).

**Behavior:**
- Cards draggable between columns (Waiting / Working / Double-checking / Stuck / Shipped)
- Only legal transitions allowed (Waiting → Working → Done; Working → Stuck; etc.) — illegal drops snap back with toast
- Optimistic UI update + POST to `/api/queue/move` (new endpoint)
- Drag preview: card shadow elevates, source slot greys
- Drop zone highlight: column gets accent border on hover-over
- Keyboard nav: arrow keys move focus between cards; Space picks up; arrows move; Space drops; Escape cancels
- Reduced-motion: instant snap, no spring

**Auth:** must be operator+ (RBAC gate already in middleware for /api/queue/*)

**Tests:** dnd integration test using @dnd-kit/core's testing utilities; verify legal moves, illegal-move rejection, keyboard nav.

**Commit:** `feat(queue): drag-drop with dnd-kit + kbd nav + RBAC gate`

## 4.2 — Workflow step graph interactive (E7)

**File:** `components/workflows/step-graph.tsx`

**Changes:**
- Replace SVG-only render with react-flow (already in project for memory graph)
- Each step = react-flow node (custom React component): icon + label + task description + status badge
- Edges: Bézier curves with animated dash-stroke when step in-flight
- BOX_WIDTH 240 → 280 + horizontal scroll on mobile
- Hover: actions row appears (edit / delete / re-run from-here)
- Click: opens inline editor in side panel
- Drag-reorder: dnd-kit on the step list (mirror to graph layout)
- Color legend at top of diagram
- Between-step "+" buttons to insert new step

**Live overlay:** when workflow is mid-run, current step gets accent halo + animated dash-stroke on outgoing edge. Completed steps go green. Failed → red.

**SSE source:** `app/api/workflows/[slug]/run/stream/route.ts` (new) — pushes step-state events from circuit-breakers.jsonl filtered by current run-id.

**Tests:** node renders, hover-actions show, drag-reorder updates state, live overlay reflects SSE events.

**Commit:** `feat(workflow-graph): react-flow + interactive nodes + drag-reorder + live overlay`

## 4.3 — Build history flame timeline (E6)

**Route:** new `app/build/history/page.tsx`
**Component:** `components/build-history/flame-timeline.tsx`

**Layout:** Horizontal Gantt-like timeline. Y-axis = phases. X-axis = time. Each phase = bar; bars stacked by wave; color by status (running/done/failed). Hover = tooltip with phase summary. Click = expand row to show wave-level detail with screenshots from `.planning/phases/NN-*/audit/shots/` if any.

**Data:** walk `.planning/STATE.md` + each `.planning/phases/*/VERIFICATION.md` + `git log --pretty=format` per phase commit range.

**Filters:** date-range, status, project (when multi-project lands).

**Tests:** render with N-phase fixture, expand row, screenshot reveal.

**Commit:** `feat(build-history): /build/history flame timeline with phase drill`

## 4.4 — Skills dependency tree (E15)

**Component:** `components/skills/dependency-tree.tsx`
**Mount:** /build/skills — new "Dependencies" tab next to "Catalog" + "Installed"

**Render:** react-flow tree (top-down dagre). Nodes = skills + workflows. Edges = "uses" / "depends-on" relationships extracted from workflow YAML's `agents.skills` field.

**Why:** Eric — "skills surface is opaque." Show what's connected to what.

**Data:** scan workflows/*.yml, extract skill names, build adjacency list. Skills metadata from existing `getCatalog()`.

**Interaction:** click skill → opens existing SkillDetailDrawer; click workflow → opens existing workflow detail.

**Tests:** scan-extract correctness with fixture YAMLs; render tree; click handlers.

**Commit:** `feat(skills-deps): visualization of skill↔workflow dependencies`

## 4.5 — Wave 4 acceptance

- [ ] tsc clean
- [ ] All affected tests pass
- [ ] Eric: drag-drop on kanban actually works (with kbd alt) + workflows render as flowcharts (not text steps) + /build/history shows phase timeline + skills shows dependency tree

## Sequencing

3 parallel agents:
- Batch A: 4.1 Queue kanban drag-drop
- Batch B: 4.2 Workflow flowchart
- Batch C: 4.3 Build history + 4.4 Skills tree (smaller scope each, bundled)

dnd-kit dependency add coordinated across A + B (both use it).
