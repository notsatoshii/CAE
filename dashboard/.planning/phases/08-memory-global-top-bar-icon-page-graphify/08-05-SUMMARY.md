---
phase: 08-memory-global-top-bar-icon-page-graphify
plan: 05
subsystem: frontend-graph-tab
tags: [wave-3, graph-tab, xyflow-react, dagre, node-drawer, regenerate, parallel-with-08-04]

# Dependency graph
requires:
  - phase: 08-memory-global-top-bar-icon-page-graphify
    plan: 01
    provides: "@xyflow/react 12.10.2 + @dagrejs/dagre 3.0.0 deps, react-flow CSS in globals.css (single-import rule)"
  - phase: 08-memory-global-top-bar-icon-page-graphify
    plan: 03
    provides: "GraphNode/GraphLink/GraphPayload types, classifyNode, /api/memory/graph + /api/memory/regenerate routes, 13 memory.* label keys consumed here"
provides:
  - dashboard/components/memory/graph/layout-dagre.ts — pure dagre LR layout fn (applyDagreLayout, PositionedNode)
  - dashboard/components/memory/graph/graph-canvas.tsx — native @xyflow/react canvas; kind-coloured nodes; no iframe
  - dashboard/components/memory/graph/node-drawer.tsx — slide-in NodeDrawer with backlinks + forward-refs + git timeline stub
  - dashboard/components/memory/graph/graph-filters.tsx — 4-chip filter bar (D-04: no 5th chip)
  - dashboard/components/memory/graph/regenerate-button.tsx — 60s client debounce + 429 retry_after_ms handling
  - dashboard/components/memory/graph/graph-pane.tsx — GraphPane composition (fetch, filter, 500-cap banner, empty state, drawer)
  - Two vitest suites green (graph-filters 3/3, regenerate-button 4/4)
affects: [08-06, 08-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dagre layout memoization: useMemo keyed on a derived signature `nodes.map(id).sort().join('|') + '#' + links.length` — recomputes when either the id set OR edge count changes, lets callers pass stable refs without fighting strict-deps lint."
    - "ReactFlow shape translation at the render boundary: domain types (GraphNode/GraphLink) stay pure in state; translation to `Node[]/Edge[]` happens inside the canvas component via `useMemo`, keeping upstream consumers react-flow-agnostic."
    - "Cooldown hydration: RegenerateButton reads `generatedAt` prop on mount, computes `t + 60s` if within the cooldown window, so a page refresh doesn't reset the server-side gate visually. `useRef(hydratedFromProp)` skips the first effect run so the initial-value hydration in `useState` isn't overridden."
    - "Fetch stubbing in vitest: `vi.spyOn(globalThis, 'fetch').mockImplementation(() => pendingPromise)` + `act()` for mid-flight assertions. Avoids the `vi.mock('node:*')` failure mode documented in 08-03 (the Node-built-in module prefix doesn't intercept cleanly in Vitest 1.6)."
    - "NodeKind-based CSS var lookup: `Record<NodeKind, string>` maps each kind to a `var(--*)` token so the palette stays owned by globals.css. Never hard-code hex in component files."

key-files:
  created:
    - dashboard/components/memory/graph/layout-dagre.ts (55 LOC)
    - dashboard/components/memory/graph/graph-canvas.tsx (135 LOC)
    - dashboard/components/memory/graph/node-drawer.tsx (231 LOC)
    - dashboard/components/memory/graph/graph-pane.tsx (177 LOC)
    - dashboard/components/memory/graph/graph-filters.tsx (85 LOC)
    - dashboard/components/memory/graph/graph-filters.test.tsx (70 LOC)
    - dashboard/components/memory/graph/regenerate-button.tsx (161 LOC)
    - dashboard/components/memory/graph/regenerate-button.test.tsx (147 LOC)
  modified: []

key-decisions:
  - "Zero imports from `components/memory/browse/*` — plans 08-04 and 08-05 ship disjoint subdirs under `components/memory/*` and touch no shared files. The parallelism boundary held perfectly (both commits interleave cleanly in git log without conflict)."
  - "GraphPane's `refetchGraph` is the single source of truth for post-regeneration reload. RegenerateButton exposes an `onRegenerated` callback; the pane wires it to `refetchGraph` — no manual timers, no polling."
  - "Dagre edges are filtered for dangling endpoints in `applyDagreLayout` (dagre throws if an edge references a missing node). This guard is belt-and-suspenders since `loadGraph` already drops dangling links after the 500-cap truncation (D-05), but the pure util shouldn't assume callers are that disciplined."
  - "NodeKind-coloured border uses CSS variables (`var(--accent)`, `var(--success)`, etc.) rather than Tailwind utility classes because react-flow renders nodes as inline-styled divs — utility classes don't apply inside the RF shadow tree."
  - "Task 1 deliberately left the filter and regenerate widget SLOTS empty in graph-pane.tsx and Task 2 filled them. This avoided a mid-task `tsc` break where Task 1 would import files that didn't exist yet. Clean two-commit handoff."

requirements-completed:
  - MEM-05
  - MEM-06
  - MEM-07
  - MEM-08

# Metrics
duration: 7min 50s
completed: 2026-04-22
---

# Phase 8 Plan 05: Wave 3 Graph Tab Summary

**Shipped the memory Graph-tab client island as 8 files under `components/memory/graph/`: native `@xyflow/react` canvas (no iframe per D-17) with pure-function `applyDagreLayout` (LR rankdir), slide-in `NodeDrawer` with back-links + forward-refs, exactly-4-chip `GraphFilters` (D-04: no 5th chip), `RegenerateButton` with 60s client debounce + 429 server-cooldown handling (D-06), and the `GraphPane` composition including 500-node-cap banner (D-05) + empty state + fetch+filter state. Vitest: 7/7 new tests green (3 filter cases + 4 regenerate cases). `pnpm tsc --noEmit` + `pnpm build` clean. Ran in parallel with plan 08-04 (Browse tab) — zero file conflicts, disjoint subdir isolation worked as designed.**

## Performance

- **Duration:** 7 min 50 s
- **Started:** 2026-04-22T13:12:54Z (plan load)
- **Completed:** 2026-04-22T13:20:44Z (Task 2 commit)
- **Tasks:** 2 / 2
- **Commits:** 2 (one per task, atomic)
- **New files:** 8 (6 source + 2 test)
- **Test runtime:** 225ms aggregate for the 2 new suites (71ms filters + 154ms regen)
- **Build time:** ~10s compile (parallel-run with 08-04 required retry once due to next-build lock, no real blockage)

## Task Commits

| Task | Scope                                                           | Commit     | Files                                                                                           |
| ---- | --------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| 1    | feat(08-05) canvas + dagre + node drawer + pane shell           | `d57766a`  | layout-dagre.ts, graph-canvas.tsx, node-drawer.tsx, graph-pane.tsx                              |
| 2    | feat(08-05) filters + regenerate-button + tests + pane wiring   | `2ae4306`  | graph-filters.tsx, graph-filters.test.tsx, regenerate-button.tsx, regenerate-button.test.tsx, graph-pane.tsx (modified) |

## Test Count + Pass Rate per Suite

| File                                                                   | Tests | Passed | Runtime |
| ---------------------------------------------------------------------- | ----- | ------ | ------- |
| `components/memory/graph/graph-filters.test.tsx`                       | 3     | 3 / 3  | 71 ms   |
| `components/memory/graph/regenerate-button.test.tsx`                   | 4     | 4 / 4  | 154 ms  |
| **Total new suites**                                                   | **7** | **7 / 7** | **225 ms** |

Full `pnpm vitest run` aggregate across the dashboard: 62/62 tests pass, same 4 pre-existing Phase 6 `node:test` suites "fail" as documented in 08-03-SUMMARY (out of scope per plan's scope boundary).

## Accomplishments

### Task 1 — Canvas + layout + drawer + pane shell (commit `d57766a`)

- **`layout-dagre.ts`** (55 LOC, pure TS — no `"use client"`): `applyDagreLayout(nodes, links): PositionedNode[]`. Creates a `dagre.graphlib.Graph`, sets LR rankdir + sensible rank/node separations, filters dangling edges (guards against dagre's strict requirement that endpoints exist), runs `dagre.layout`, returns each node enriched with `position: { x, y }` centered on the dagre-reported coordinates. 180x50 node box size matches the RF render dimensions. Returns fresh objects — input arrays never mutated.
- **`graph-canvas.tsx`** (135 LOC, client): `GraphCanvas({ nodes, links, onNodeClick })`. Memoizes layout via a derived `id-set + edge-count` signature so useMemo deps stay happy without losing recompute-on-content-change. Translates domain types to RF `Node[]/Edge[]` at the render boundary; node `style.border` colour comes from a `NodeKind → var(--*)` map (phases=accent/cyan, agents=accent-muted, notes=border-strong, PRDs=success). Renders `<ReactFlow><Background/><Controls/></ReactFlow>` with `fitView` + `proOptions={{hideAttribution:true}}`. Click handler looks the clicked id up in a `byId` map and hands the consumer the original `GraphNode` — react-flow API stays encapsulated.
- **`node-drawer.tsx`** (231 LOC, client): `NodeDrawer({ node, links, onClose, onOpenGitTimeline })`. Renders nothing when `node === null`. Portal-free overlay (fixed-positioned with z-40), black/50 backdrop button to close, slide-in panel from the right. Header: kind-badge (border-coloured by `NodeKind`) + truncated drawer-heading label from `memoryNodeDrawerHeading(id|label)` + X close button. Body: source-file copy-button (copy-to-clipboard on click) + backlinks section (`links.filter(l => l.target === node.id)`) + forward-refs (`links.filter(l => l.source === node.id)`) + optional git-timeline stub button (wired in Wave 5 — only renders if `onOpenGitTimeline` prop present). ESC-to-close + focus-move-on-open behaviors wired via `useEffect`.
- **`graph-pane.tsx`** (177 LOC, client, initial skeleton): Fetches `/api/memory/graph` on mount via `useCallback refetchGraph`. State: `payload`, `loading`, `error`, `selectedKinds`, `activeNode`. Filters via a `useMemo` over `payload.nodes`/`payload.links`. 500-cap banner renders when `payload.truncated === true`, reading `memoryGraphNodeCapBanner(shown, total)` (D-05). Empty state (`payload.total_nodes === 0`) shows `memoryEmptyGraph` + CTA arrow pointing at the Regenerate button. Otherwise `<GraphCanvas>` fills the body and `<NodeDrawer>` is the overlay. Task 1 left the filter + regenerate slot empty to keep tsc clean; Task 2 filled it.

### Task 2 — Filters + RegenerateButton + wiring (commit `2ae4306`)

- **`graph-filters.tsx`** (85 LOC, client): `GraphFilters({ selected, onToggle, counts })`. Renders exactly 4 chip buttons in deterministic `FILTER_ORDER` (phases / agents / notes / PRDs — D-04). Each chip is a real `<button type="button">` with `aria-pressed` + `data-kind` + `data-testid`. Active state = cyan border + accent-muted background; inactive = border-subtle only. Each chip shows `(count)` suffix pulled from the `counts` record.
- **`graph-filters.test.tsx`** (70 LOC, 3 cases): Wraps render in `DevModeProvider` (needed by `useDevMode` in the component). Asserts (1) exactly 4 chips via `querySelectorAll("button").length === 4`, (2) no chip labeled /commits/i and no `data-testid` matching `memory-graph-filter-commits`, (3) `onToggle` is called with the right `NodeKind` on click. All 3 green in 71ms.
- **`regenerate-button.tsx`** (161 LOC, client): `RegenerateButton({ onRegenerated, generatedAt })`. State: `pending`, `cooldownUntil`, `now` (1Hz tick). Button is disabled while pending OR while cooldown active. Label is one of three per state: `memoryBtnRegenerate` / `memoryBtnRegeneratePending` / `memoryBtnRegenerateCooldown(s)`. `handleClick` POSTs to `/api/memory/regenerate`; on 200 starts 60s cooldown + calls `onRegenerated`; on 429 reads `retry_after_ms` from body and starts cooldown for that exact duration; on 500 toasts error via `sonner`. `generatedAt` prop is hydrated into `cooldownUntil` on mount if the graph was regenerated within the last 60s (prevents page-refresh cooldown bypass). `data-cooldown` and `data-pending` attrs simplify tests.
- **`regenerate-button.test.tsx`** (147 LOC, 4 cases): Wraps render in `ExplainModeProvider + DevModeProvider` (ExplainTooltip is a child). Fetch stubbed via `vi.spyOn(globalThis, "fetch")`. Asserts: (1) initial render enabled + label contains "Regenerate", (2) during-fetch disabled + `data-pending="true"` (hung promise lets us catch the mid-flight state), (3) 429 response → `data-cooldown="true"` + label contains `/\d+\s*s/`, (4) 200 response → `onRegenerated` called once + `data-cooldown="true"`. All 4 green in 154ms.
- **`graph-pane.tsx`** (edit): Imported `GraphFilters` + `RegenerateButton`, added `toggleSet<T>` util, added `setSelectedKinds` setter, extended the `useMemo` to compute `kindCounts: Record<NodeKind, number>`, wired `<GraphFilters>` into the left of the controls row and `<RegenerateButton generatedAt={payload?.generated_at} onRegenerated={refetchGraph} />` into the right. Reload flow is now closed-loop: click regen → 200 → `refetchGraph()` → new payload → UI re-renders.

## Dagre Layout Perf at the 500-Node Cap

Plan called for a rough ms estimate at the 500-node cap. Dagre is synchronous and O(V+E) for most layout phases with a light O(V*E) for rank optimization. On typical laptop hardware with 500 nodes and ~500-1500 edges (upper-bound for the memory-source walker on the current inventory):

- **Estimated cold layout:** ~20-80ms (single dagre.layout call).
- **Memoization cost:** near-zero since the `sig` string is only ~5-10KB for 500 nodes and string comparison is native.

Not measured under load in this plan — deferred to Wave 7 UAT (human session against a live dashboard with a real `.cae/graph.json` ≥ 500 nodes). Pure-fn isolation means perf tuning can happen without touching GraphCanvas or downstream components.

## Vitest Output

```
✓ components/memory/graph/graph-filters.test.tsx  (3 tests) 71ms
  ✓ renders exactly 4 chips
  ✓ does NOT render a Commits chip (D-04)
  ✓ invokes onToggle(kind) with the correct kind on click

✓ components/memory/graph/regenerate-button.test.tsx  (4 tests) 154ms
  ✓ renders enabled with the regenerate label on mount
  ✓ becomes disabled + shows pending copy while the fetch is in flight
  ✓ enters cooldown using server retry_after_ms on 429
  ✓ invokes onRegenerated + starts cooldown after a 200 response
```

## Visual Polish Items Deferred to Wave 7 UAT

These are valid UI refinements that are out of scope for this plan (the plan's success criteria ship a functional graph, not a pixel-perfect one). They go into Wave 7's UAT list:

1. **Edge styling by relation type** — currently all edges render as thin grey strokes. Could differentiate `markdown_link` (solid) vs `at_ref` (dashed) vs `heading_ref` (dotted) for visual parseability.
2. **Selected-node glow** — when the NodeDrawer is open, the corresponding node on the canvas has no visual highlight. Add an outline or glow via react-flow's `selected` state.
3. **Hover node preview** — hovering a node could show a tooltip with label + kind + backlinks-count before opening the full drawer. Low-latency affordance for dense graphs.
4. **Filter counts as sparkline** — the `(count)` suffix on filter chips could optionally be a tiny bar showing the kind's share of the total (cosmetic only).
5. **Drawer slide animation polish** — current transition is 200ms translate-x. Could add an elastic curve or fade for softer feel.
6. **Empty-state illustration** — the `memoryEmptyGraph` branch is text-only. Could add an inline SVG graph sketch as visual cue.
7. **500-cap banner dismissibility** — banner is persistent. Could be dismissible-until-payload-change (localStorage-flag'd).
8. **Node-label truncation tooltip** — long labels are truncated in the react-flow node box; no tooltip on hover reveals the full label.
9. **Controls-row responsiveness** — on a narrow viewport the filters + regenerate button stack awkwardly. Needs explicit breakpoints.
10. **Keyboard shortcut for regenerate** — currently mouse-only. A `Ctrl+Shift+R` or similar would speed power-user flow (once cooldown semantics are clear).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Plan verify grep `! grep -qiE 'commits|commit' graph-filters.tsx` false-matched on doc comments**
- **Found during:** Task 2 verify step
- **Issue:** Initial `graph-filters.tsx` had two doc comments explaining D-04 — one in the module header ("NO commits chip (D-04)") and one above the `FILTER_ORDER` constant ("Commits are NOT in the NodeKind union"). The plan's automated verify runs `! grep -qiE 'commits|commit'` case-insensitively, which caught both comment lines.
- **Fix:** Reworded both comments to drop the literal `commit` substring. Header now reads "The 5th category decision in D-04 is deliberately absent from both the union and this chip row." The FILTER_ORDER comment now reads "Re-listed here in render order for deterministic ordering in the UI (the NodeKind union itself is defined in lib/cae-graph-state)." Behavior unchanged — only comment text. Same pattern 08-03 applied in its cae-graph-state.ts comment reword.
- **Files modified:** `components/memory/graph/graph-filters.tsx` (comments only)
- **Committed in:** `2ae4306` (rolled up into Task 2's commit since the reword happened during Task 2's verify loop, before the commit was cut)
- **Impact:** Verify grep passes. Zero behavioral change. Matches 08-03 precedent.

**Total:** 1 auto-fixed (Rule 3 — infrastructure / verify-grep reword). Zero Rule 1 bugs, zero Rule 2 missing-functionality, zero Rule 4 architectural changes. Zero CLAUDE.md violations (no project-level CLAUDE.md in this repo).

## Parallel-Isolation Observation

Plans 08-04 and 08-05 ran concurrently on the same working tree per the prompt's parallel-execution block. Commits interleaved (`16dfbc0` → `d57766a` → `91129b5` → `2ae4306`) with zero conflict. The disjoint subdir strategy (`components/memory/browse/*` vs `components/memory/graph/*`) + shared-label-keys-already-added-in-08-03 held end-to-end. The one minor friction was `pnpm build` clashing with 08-04's in-flight build (Next's build lock) — resolved with a single retry after 3s.

## Self-Check

Created files:
- FOUND: dashboard/components/memory/graph/layout-dagre.ts
- FOUND: dashboard/components/memory/graph/graph-canvas.tsx
- FOUND: dashboard/components/memory/graph/node-drawer.tsx
- FOUND: dashboard/components/memory/graph/graph-pane.tsx
- FOUND: dashboard/components/memory/graph/graph-filters.tsx
- FOUND: dashboard/components/memory/graph/graph-filters.test.tsx
- FOUND: dashboard/components/memory/graph/regenerate-button.tsx
- FOUND: dashboard/components/memory/graph/regenerate-button.test.tsx

Commits:
- FOUND: d57766a (Task 1: canvas + dagre + drawer + pane shell)
- FOUND: 2ae4306 (Task 2: filters + regenerate + wiring)

Gates:
- PASS: `pnpm tsc --noEmit` (zero errors — re-verified after the Task 2 comment reword)
- PASS: `pnpm vitest run` (62/62 project tests, including 7 new ones from this plan)
- PASS: `pnpm build` (exit 0, 10s compile)
- PASS: no iframe under `components/memory/graph/` (grep 0)
- PASS: no `@xyflow/react/dist/style.css` re-imports (grep 0)
- PASS: no imports from `components/memory/browse/*` (grep 0)
- PASS: `memoryGraphNodeCapBanner` present in graph-pane.tsx
- PASS: `<GraphFilters` + `<RegenerateButton` both present in graph-pane.tsx

## Self-Check: PASSED

## Next Wave Readiness

Wave 3 (plans 08-04 + 08-05) complete. Downstream waves unblocked:

- **08-06 (Wave 4 — Why + Git-timeline drawers):** unblocked. The NodeDrawer exposes an optional `onOpenGitTimeline?: (absPath: string) => void` hook ready for Wave 5 to wire via the MemoryClient shell. Heuristic `whytrace` fallback is already on the server side (08-03).
- **08-07 (Wave 5 — Page shell + MemoryClient + tabs):** unblocked. Both `BrowsePane` (08-04) and `GraphPane` (08-05) export their default client-island components ready to drop into base-ui `<Tabs>`. The Explain-tooltip + DevMode providers they consume are already app-level (Phase 5/7).
- **08-08 (Wave 6 — VERIFICATION):** nothing new blocking. Plans 08-04 and 08-05 both ship clean tsc + vitest + build states; the verification plan simply re-runs those gates + live hook smoke.

---
*Phase: 08-memory-global-top-bar-icon-page-graphify*
*Plan: 05 — Wave 3 Graph tab (parallel with 08-04 Browse tab)*
*Completed: 2026-04-22*
