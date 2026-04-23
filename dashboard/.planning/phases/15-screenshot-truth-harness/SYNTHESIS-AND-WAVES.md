# Phase 15 — Synthesis + Wave Plan (Cycle 10)

Combines findings from: INVENTORY.md, INSTRUMENTATION-AUDIT.md, DETAIL-EXPAND-AUDIT.md, KANBAN-COLUMNAR-AUDIT.md, VISUAL-RESEARCH.md, KNOWLEDGE-LAYER-DESIGN.md.

## Single root-cause framing

Eric's 30+ complaints all reduce to **3 stacked failures**:

1. **Instrumentation broken** — circuit-breakers.jsonl, tool-calls.jsonl, sentinel.jsonl, memory-consult.jsonl all missing/empty. Track D fixes.
2. **Presentation shallow** — even where data exists, only ~52% of available fields render. Detail-expand drawers hide everything useful. Track A (depth) fixes.
3. **Visual identity tacky** — Geist/cyan/default-scrollbar/p-3-or-p-4 inconsistent vibe is "amateur admin panel" not "Linear/Vercel control plane." Track A (craft) fixes.

Plus **two wholly missing surfaces** that Eric expected:
- Knowledge layer (Obsidian-grade memory + analyzer agent + button) — Track B+C
- 15 visualizations (live activity, mission control hero, sparklines, flowcharts, anomaly callouts, DVR, etc.) — Track E

## Priority order (P0 → P3)

### P0 — Lies + breaks (kills trust immediately)
1. Hydration mismatches — DONE (5 files fixed inline this session)
2. Audit hook + scheduler cron installed — DONE this session
3. RecentLedger row-click → opens TaskDetailSheet — IN-FLIGHT (agent ad9a14d)
4. TaskDetailSheet shows ETA + cost + status — IN-FLIGHT
5. Live activity panel — IN-FLIGHT (agent af198bd)
6. Verify circuit-breakers + tool-calls writers fire on real session — TODO

### P1 — Visible craft (instant signal of "this is now sleek")
7. Inter Variable + JetBrains Mono Variable swap — IN-FLIGHT (agent ae44908)
8. OKLCH semantic palette + 5-level elevation — IN-FLIGHT
9. Scrollbar-width thin styled — IN-FLIGHT
10. Density / type / motion tokens added — IN-FLIGHT
11. AgentDetailDrawer 7-day sparklines (Recharts) — IN-FLIGHT
12. Standardize card density `p-4 gap-3` across agent/queue/skills/changes
13. Always-visible action rows on agent cards (kill hover-reveal)

### P2 — Depth + IA
14. ActivePhaseCards: thicker progress, status border, badge meta-row, sort by ETA
15. Queue kanban: dnd-kit drag-drop between status columns
16. Workflow step graph: interactive boxes + drag-reorder
17. Sidebar collapse + hover-tooltip labels (Linear-style)
18. Empty / loading / error states with character per surface
19. Mission Control hero panel above /build (15 viz spec E1)
20. Build history flame timeline new route /build/history (E6)

### P3 — Knowledge layer + visualizations (Tracks B + C + E)
21. Memory file frontmatter migration — analyzer dry-run first
22. memory-analyzer.ts CLI shipped (CLI-only first)
23. /memory tab graph rework: react-flow with edge types + side panel
24. Re-analyze button + diff preview modal
25. Post-commit hook + 15-min cron + agent-invocation logger
26. Token burn-rate gauge (E3)
27. Cost-by-agent donut (E4)
28. Model-cost stacked bars (E5)
29. Workflow flowchart with live overlay (E7)
30. Live Floor sprite kit + named pixel agents (E2)
31. Logs panel v2: Shiki syntax + virtuoso virtualization + filter pills (E9)
32. Anomaly callouts on metrics (E10)
33. DVR / replay scrubber (E11)
34. Notifications drawer (E12)
35. Since-you-left card (E13)
36. Per-agent invocation timeline (E14)
37. Skills dependency tree (E15)

## Wave plan

Each wave = a single coherent ship-able unit. After every 2-3 waves, run a re-capture cycle (Eric mandate: 5-10 fix→plan→cycle iterations).

### Wave 1 — Aesthetic foundation + visible-immediately wins (THIS PUSH)
- Foundation pass (fonts, OKLCH palette, scrollbars, density/type/motion tokens) — agent ae44908 background
- Detail-expand 3 fixes (RecentLedger row-click, TaskDetailSheet ETA/cost/status, AgentDrawer sparklines) — agent ad9a14d background
- Live activity panel above rollup-strip — agent af198bd background
- Hook installs verified (audit + scheduler) — done

**Eric impact:** browser refresh shows new fonts, new colors, real scrollbars, live tile of activity, clickable recent-ledger rows opening rich sheets, sparklines on agent detail.

### Wave 2 — Card density + IA pass
- Standardize all card density to `p-4 gap-3` shared utility
- Always-visible action rows on agent cards
- Sidebar collapse + hover-tooltip labels (Linear-style)
- Larger / status-bordered ActivePhaseCards
- Empty/loading state pass (skeleton + character copy across N panels)

**Eric impact:** consistent rhythm app-wide; every panel breathes; sidebar feels modern; loading is intentional not generic.

### Wave 3 — Mission control hero + Live Floor pinned
- Mission Control hero (E1) above /build
- Live Floor pinned 240px embed on /build (E2)
- Token burn-rate gauge (E3) in nav
- Cost-by-agent donut (E4) on /metrics

**Eric impact:** "what's happening now" answered at a glance; pixel agents finally visible; cost/token clearly surfaced.

### Wave 4 — Drag-drop kanban + workflow flowchart
- Queue kanban drag-drop with dnd-kit
- Workflow step graph: interactive + drag-reorder
- Build history flame timeline at /build/history
- Skills dependency tree visualization

**Eric impact:** kanban "behaves like a kanban"; workflows visualizable; history clickthrough exists.

### Wave 5 — Logs panel v2 + Notifications + Since-you-left
- Logs v2 (Shiki + virtuoso + filter pills)
- Notifications drawer with bell icon
- Since-you-left card on /build for returning founder

**Eric impact:** logs become useful; state changes are announced; returning is informative.

### Wave 6 — Knowledge layer Phase 1 (file format + analyzer CLI)
- Memory frontmatter migration spec finalized
- memory-analyzer.ts CLI shipped (no UI yet)
- Dry-run on existing memory files, output diff log
- Privacy guards verified

**Eric impact:** invisible (CLI only) but unlocks Wave 7.

### Wave 7 — Knowledge layer Phase 2 (in-app graph rework)
- /memory tab graph v2 (react-flow + edge types + side panel)
- Backlinks panel
- Search highlights paths
- "Re-analyze" button + diff preview modal

**Eric impact:** memory tab finally feels like Obsidian.

### Wave 8 — Continuous labelling pipeline
- Post-commit hook
- Agent-invocation logger
- 15-min cron
- Live edge index pulse on graph (nodes pulse when written)

**Eric impact:** the graph self-organizes over time without manual button presses.

### Wave 9 — Anomaly callouts + DVR + remaining viz
- Anomaly callouts on metrics
- DVR replay scrubber
- Per-agent invocation timeline (replace text-row list with stacked-bar timeline)
- Model-cost stacked bars (E5)

**Eric impact:** metrics get smart; DVR enables "what happened while I was away" beyond just card.

### Wave 10 — Voice + character pass
- Empty states rewritten with personality (Resend-style)
- Error states rewritten ("here's what happened, here's how to recover")
- Loading shimmer with branded animation
- 404/500 pages with character

**Eric impact:** the system feels written by a human for humans.

## Re-capture cycle protocol

After every 2-3 waves:
1. Take screenshots of all routes (capture matrix)
2. Re-score 7 pillars × 6 personas
3. Compare to baseline
4. Update C-cycle scores in `Cn-SCORES.md`
5. Eric checkpoint optional but encouraged
6. Plan next wave from delta

## Estimated wave durations

- Wave 1: 1 day (3 agents currently running)
- Wave 2-3: 2 days each
- Wave 4: 3 days (drag-drop is fiddly)
- Wave 5: 2 days
- Wave 6-7: 4 days (knowledge layer)
- Wave 8: 1 day
- Wave 9: 3 days
- Wave 10: 2 days

Total: ~22 work-days. Compressible 2-3× via parallel agent execution (already proven in this session — 3 agents running concurrently).

## Re-cycling Eric's "5-10 fix→plan→cycle"

Each wave IS a cycle (fix happens, then re-plan from result). 10 waves = 10 cycles. Within waves, intra-wave critique cycles refine before commit. Eric's bound is met by the wave structure itself.

## Status (post-Cycle-10)

- Wave 1 in flight (3 background agents)
- Waves 2-10 specified, ready to dispatch as Wave 1 lands
- No human gates needed — all auto-defaults locked
