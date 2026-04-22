---
phase: 07-metrics-global-top-bar-icon-page
plan: 03
subsystem: metrics-spending-panel
tags: [wave-2, panels, spending, recharts, founder-speak]
requirements:
  - REQ-7-SPEND
  - REQ-7-FOUNDER
dependency-graph:
  requires:
    - dashboard/lib/cae-metrics-state.ts (SpendingState type)
    - dashboard/lib/hooks/use-metrics-poll.tsx (MetricsPollProvider + useMetricsPoll)
    - dashboard/lib/copy/labels.ts (metrics.* keys from 07-02)
    - dashboard/lib/copy/agent-meta.ts (AGENT_META + agentMetaFor)
    - dashboard/lib/providers/dev-mode.tsx (useDevMode)
    - dashboard/components/ui/sparkline.tsx (30d line reuse per D-04)
    - recharts@3.8.1 (stacked bar)
  provides:
    - "<SpendingPanel> — panel composer consuming useMetricsPoll(); mounts inside 07-05 page shell"
    - "<AgentStackedBar data={SpendingState['by_agent_30d']}> — recharts stacked BarChart, one Bar per agent"
    - "<SpendingDailyLine data={SpendingState['daily_30d']}> — Sparkline-based 30d line"
    - "<TopExpensiveTasks data={SpendingState['top_expensive']}> — top-10 ordered list"
    - "<EstDisclaimer /> — founder-speak pill-shaped 'est.' banner"
  affects:
    - "Wave 3 page shell (07-05) can mount <SpendingPanel /> inside <MetricsPollProvider>"
    - "Wave 4 UAT (07-06) has fixed data-testid hooks for visual regression"
tech-stack:
  added: []
  patterns:
    - "Three render states per panel: error-without-data, loading (data null), loaded"
    - "data-testid on every panel subregion (spending-today / spending-mtd / spending-projected / spending-panel / agent-stacked-bar / spending-daily-line / top-expensive-tasks / metrics-est-disclaimer) for Wave 4 UAT hooks"
    - "Landmark section via aria-labelledby for screen-reader navigation"
    - "Tilde (~) prefix on projected big-number value as an inline math-convention estimate marker (not in labels.ts)"
    - "Inline COLOR_MAP in AgentStackedBar mapping AGENT_META color tokens to hex (v0.1 one-off; future DRY pass may lift to agent-meta.ts)"
    - "Reuse of components/ui/sparkline for daily 30d line (NOT recharts — D-04)"
    - "Token formatting helper mirrors CostTicker (< 1k raw / < 1M k / else M)"
  removed: []
key-files:
  created:
    - "dashboard/components/metrics/est-disclaimer.tsx (32 lines)"
    - "dashboard/components/metrics/agent-stacked-bar.tsx (113 lines)"
    - "dashboard/components/metrics/spending-daily-line.tsx (45 lines)"
    - "dashboard/components/metrics/top-expensive-tasks.tsx (87 lines)"
    - "dashboard/components/metrics/spending-panel.tsx (173 lines)"
  modified: []
decisions:
  - "COLOR_MAP inlined in AgentStackedBar rather than exported from agent-meta.ts — v0.1 one-off; avoid premature DRY (documented in component header)"
  - "Projected-value tilde prefix rendered inline ('~' + formatTokens(…)) rather than adding a metrics.spending.projectedPrefix label key — keeps labels.ts clean; the tilde is a universal math symbol, not translatable copy"
  - "agent-meta 'amber' color token (used by herald) mapped to #f59e0b in COLOR_MAP — plan example only listed 8 tokens; verified against AGENT_META and added the 9th"
  - "TopExpensiveTasks imports labelFor/useDevMode and dereferences _L (suppressed via void) so future copy templates (e.g. L.metricsSpendingTopTaskRow) can be adopted without re-adding the hook — matches plan Task-2 note"
  - "Panel does NOT mount MetricsPollProvider; the page shell (07-05) owns provider layering"
  - "No recharts imports at the panel level — only the leaf AgentStackedBar pulls recharts, keeping dynamic-import escape hatches cheap if SSR ever becomes a concern"
metrics:
  duration_minutes: 4
  completed_date: "2026-04-22T11:21:00Z"
  tasks_completed: 3
  files_modified: 0
  files_created: 5
  commits:
    - "370fff4 feat(07-03): add EstDisclaimer + AgentStackedBar + SpendingDailyLine"
    - "320894b feat(07-03): add TopExpensiveTasks top-10 list"
    - "ff97053 feat(07-03): add SpendingPanel composer"
---

# Phase 7 Plan 3: Spending Panel + Sub-Charts Summary

**One-liner:** Shipped the complete `<SpendingPanel>` plus four sub-components under `components/metrics/` — a recharts stacked BarChart for by-agent 30d tokens, a Sparkline-reused daily 30d trend, a top-10 expensive-tasks `<ol>`, and a founder-speak "est." disclaimer pill — all rendered through `labelFor(dev)` with zero currency signs anywhere, consuming the SpendingState contract delivered by 07-02.

## What Shipped

### Task 1 — Three sub-charts — commit `370fff4`

**`components/metrics/est-disclaimer.tsx` (32 lines)**

- Pill-shaped banner matching CostTicker's uppercase "est." tag visual pattern.
- Uses `labelFor(dev).metricsSpendingDisclaimer` — founder: "Estimated from local logs. Subscription covers the bill." / dev: "est. — from .cae/metrics/circuit-breakers.jsonl".
- `data-testid="metrics-est-disclaimer"`.
- Tailwind classes use the existing CSS custom-property palette (`--border`, `--surface`, `--text-muted`, `--accent`).

**`components/metrics/agent-stacked-bar.tsx` (113 lines)**

- Recharts `BarChart` with one `<Bar stackId="a" />` per `AgentName` in `AGENT_META` iteration order (9 bars: nexus / forge / sentinel / scout / scribe / phantom / aegis / arch / herald).
- Bar fill resolved via inlined `COLOR_MAP` covering every color token present in `AGENT_META`: `cyan / orange / sentinel-cyan / yellow / purple / gray / red / blue / amber` → hex.
- Chromed `CartesianGrid` + `XAxis` + `YAxis` + `Tooltip` + `Legend` using `var(--*)` CSS custom properties so the chart reads the app's dark theme automatically.
- `ResponsiveContainer` at `h-60 w-full` (240 px tall; fills container width).
- Explicit empty state when `data.length === 0` OR every row has all agents at 0 tokens — renders `<div data-testid="agent-stacked-bar-empty">` with "No token data in the last 30 days yet." message.
- `data-testid="agent-stacked-bar"` on the non-empty render.

**Recharts components used:** `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `Legend`, `ResponsiveContainer`, `CartesianGrid`. All imported from the single top-level `"recharts"` package (no subpath imports).

**`components/metrics/spending-daily-line.tsx` (45 lines)**

- Reuses the existing hand-rolled `<Sparkline>` primitive (`components/ui/sparkline.tsx`) — NOT recharts, per CONTEXT D-04.
- `<Sparkline values={...} width={260} height={40} color="var(--accent, #00d4ff)" ariaLabel="Daily token usage, last 30 days" />`.
- Empty state: when all values are 0, renders a small dim "No data in the last 30 days." caption next to the sparkline; the sparkline itself still renders (stays a flat line) so card layout doesn't shift.
- `data-testid="spending-daily-line"`.

### Task 2 — Top-10 expensive tasks — commit `320894b`

**`components/metrics/top-expensive-tasks.tsx` (87 lines)**

- Renders `<ol>` for semantic keyboard/SR ordering. Per-row layout:
  - Zero-padded rank (01, 02, …, 10) in monospace.
  - Agent emoji from `agentMetaFor(row.agent).emoji` (marked `aria-hidden` — the adjacent text names the agent).
  - Truncated task title (`truncate` class).
  - Token count (k/M-compacted) + agent label — founder mode → `founder_label` ("the builder"), dev mode → `label` ("Forge").
- Defensive `data.slice(0, 10)` even though the aggregator already caps at 10 (CONTEXT §D-10).
- Empty state when `data.length === 0` → dashed-border div with "No recorded jobs yet."
- `data-testid="top-expensive-tasks"` / `"top-expensive-tasks-empty"`.
- Imports `labelFor` + `useDevMode` (dereferenced as `_L`, suppressed via `void _L`) so future copy-template work (`L.metricsSpendingTopTaskRow`) can adopt without re-adding the hook plumbing — matches plan Task-2 note.
- Inline `formatTokens` helper mirrors the CostTicker formatter exactly.

### Task 3 — SpendingPanel composer — commit `ff97053`

**`components/metrics/spending-panel.tsx` (173 lines)**

- Consumes `useMetricsPoll()` + `useDevMode()` + `labelFor(dev)`.
- Three render states, all wrapped in `<section aria-labelledby="spending-heading">`:
  1. **error-without-data** (`error && !data`) → heading + `metricsFailedToLoad` copy; `data-testid="spending-panel-error"`.
  2. **loading** (`!data`) → heading + `metricsEmptyState` copy; `data-testid="spending-panel-loading"`.
  3. **loaded** → full render; `data-testid="spending-panel"`.
- Loaded layout (top-down, `gap-6`):
  1. Header: `<h2 id="spending-heading">` (`metricsSpendingHeading`) + right-aligned `<EstDisclaimer />`.
  2. Big-number grid (3 columns at `sm:`): today / MTD / projected — each a `<BigNumber>` with uppercase label above, monospace 2xl value below. Projected value has a `~` prefix to signal "estimate" (inline, not a label key).
  3. By-agent 30d section: `<h3>` + `<AgentStackedBar data={s.by_agent_30d} />`.
  4. Daily 30d section: `<h3>` + `<SpendingDailyLine data={s.daily_30d} />`.
  5. Top-10 expensive: `<h3>` + `<TopExpensiveTasks data={s.top_expensive} />`.
- No `MetricsPollProvider` mounted here — the page shell (07-05) owns provider layering. `useMetricsPoll()` throws if the provider isn't above in the tree.
- No recharts imports at the panel level — isolated to `agent-stacked-bar.tsx`.
- Local `BigNumber` sub-component keeps the markup single-file (three instances, low reuse value across files).

## Data-testid Surface (Wave 4 UAT hooks)

| testid | Component | Purpose |
| ------ | --------- | ------- |
| `metrics-est-disclaimer` | `<EstDisclaimer>` | Verify the "est." banner renders with the correct founder/dev copy |
| `agent-stacked-bar` | `<AgentStackedBar>` (loaded) | Visual regression on the recharts stacked bar |
| `agent-stacked-bar-empty` | `<AgentStackedBar>` (empty) | Empty-state verification |
| `spending-daily-line` | `<SpendingDailyLine>` | Sparkline wrapper verification |
| `sparkline` / `sparkline-empty` | `<Sparkline>` (inherited) | Phase 5 primitive's own testids |
| `top-expensive-tasks` | `<TopExpensiveTasks>` (loaded) | Top-10 list verification |
| `top-expensive-tasks-empty` | `<TopExpensiveTasks>` (empty) | Empty-state verification |
| `spending-panel` | `<SpendingPanel>` (loaded) | Whole-panel regression hook |
| `spending-panel-loading` | `<SpendingPanel>` (loading) | Loading-state verification |
| `spending-panel-error` | `<SpendingPanel>` (error) | Error-state verification |
| `spending-today` | `<BigNumber>` | Today big-number card |
| `spending-mtd` | `<BigNumber>` | MTD big-number card |
| `spending-projected` | `<BigNumber>` | Projected big-number card (tilde-prefixed value) |

## Recharts Usage Summary

```tsx
// components/metrics/agent-stacked-bar.tsx
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

<ResponsiveContainer width="100%" height="100%">
  <BarChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
    <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
    <Tooltip
      contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
      cursor={{ fill: "var(--surface-hover)", opacity: 0.3 }}
    />
    <Legend wrapperStyle={{ fontSize: 11 }} />
    {agentNames.map((name) => (
      <Bar key={name} dataKey={name} stackId="a" fill={COLOR_MAP[...]} name={AGENT_META[name].label} />
    ))}
  </BarChart>
</ResponsiveContainer>
```

## Sparkline Primitive Props (daily 30d)

```tsx
<Sparkline
  values={data.map((d) => d.tokens)}  // [number] length 30, zero-filled
  width={260}
  height={40}
  color="var(--accent, #00d4ff)"
  ariaLabel="Daily token usage, last 30 days"
/>
```

The Phase 5 `<Sparkline>` renders a single SVG `<polyline>` normalized to its min/max range; no library dependency.

## COLOR_MAP → AGENT_META cross-walk

| Agent    | `AGENT_META.color` | Resolved hex |
| -------- | ------------------ | ------------ |
| nexus    | cyan               | #00d4ff      |
| forge    | orange             | #f97316      |
| sentinel | cyan               | #00d4ff      |
| scout    | yellow             | #eab308      |
| scribe   | purple             | #a855f7      |
| phantom  | gray               | #9ca3af      |
| aegis    | red                | #ef4444      |
| arch     | blue               | #3b82f6      |
| herald   | amber              | #f59e0b      |

Note: `amber` was not in the plan's example COLOR_MAP but IS present on herald in `agent-meta.ts`; added to the map (not a deviation, just completeness).

## Deviations from Plan

None structural.

**Minor clarifications** (all pre-documented in the plan Task text or the watch items):

1. **`amber` added to COLOR_MAP.** The plan's example snippet listed 8 tokens; `AGENT_META.herald.color === "amber"`, so the map needed a 9th entry. Fallback `"#9ca3af"` would have produced the wrong color for herald's legend square.
2. **Tilde prefix is inline, not a label key.** Per the plan-checker watch item: picked "drop it from labels.ts" — the tilde is a universal math convention for "approximately", not translatable copy. Keeps labels.ts clean.
3. **TopExpensiveTasks `L` is unused.** The plan Task-2 text explicitly says: "Uses `L` label set even though this specific renderer doesn't have an interpolated label YET". Wrote it as `const _L = labelFor(dev); void _L;` to satisfy TypeScript's unused-variable lint while preserving the hook.

## Parallel-Execution Artifact (NOT a deviation)

During this plan's execution, the 07-04 parallel agent was also writing files in `components/metrics/` (disjoint file set per the `<parallel_execution>` contract). A mid-execution `pnpm build` run surfaced a TypeScript error in `components/metrics/time-to-merge-histogram.tsx` (07-04's file, not mine). Per the `<deviation_rules>` Scope Boundary: "Only auto-fix issues DIRECTLY caused by the current task's changes." I did NOT touch that file. `pnpm tsc --noEmit` confirms zero errors in my five files. 07-04's verifier will resolve its own file.

## Authentication Gates

None — pure client-component work, no external services touched.

## Verification Results

| Check | Result |
| ----- | ------ |
| All 5 files exist under `components/metrics/` | ✓ |
| Every file's first line is `"use client";` | ✓ |
| Exports: `SpendingPanel`, `AgentStackedBar`, `SpendingDailyLine`, `TopExpensiveTasks`, `EstDisclaimer` | ✓ all 5 present |
| `spending-panel.tsx` imports `useMetricsPoll` + `labelFor` + all 4 sub-components | ✓ |
| `agent-stacked-bar.tsx` imports `BarChart / Bar / …` from `"recharts"` with `stackId="a"` | ✓ |
| `spending-daily-line.tsx` imports `Sparkline` from `@/components/ui/sparkline` | ✓ |
| `top-expensive-tasks.tsx` uses `agentMetaFor(row.agent)` + `.slice(0, 10)` | ✓ |
| Zero `$` signs in `components/metrics/{est-disclaimer,agent-stacked-bar,spending-daily-line,top-expensive-tasks,spending-panel}.tsx` (excluding `${}`) | ✓ grep confirmed empty |
| `pnpm tsc --noEmit` on all 5 files | ✓ zero errors in any of our files |
| Min line counts (15/40/25/40/80) | ✓ all exceeded (32/113/45/87/173) |
| All user-facing strings via `labelFor(dev)` — no hard-coded copy | ✓ except for empty-state fallback sentences ("No token data in the last 30 days yet.", "No data in the last 30 days.", "No recorded jobs yet.") which are inline in keeping with plan example code — NOT in `labelFor` but the plan's reference code showed them inline |
| `useMetricsPoll` NOT wrapped at panel level (page shell owns provider) | ✓ |
| No recharts imports in `spending-panel.tsx` (isolated to sub-chart) | ✓ |

## Known Stubs

**None.** Every sub-component is fully wired to the real `SpendingState` shape from `useMetricsPoll()`:

- EstDisclaimer reads real label copy.
- AgentStackedBar consumes real `by_agent_30d` rows; empty-state is an explicit zero-data branch, not a stub.
- SpendingDailyLine consumes real `daily_30d`; empty-state is a zero-data branch.
- TopExpensiveTasks consumes real `top_expensive`; empty-state is a zero-data branch.
- SpendingPanel wires all four together and consumes real `MetricsState`.

No hardcoded mocks, no `[]` placeholder data flowing to UI. The `title = task_id` shortcut in `top_expensive` is a documented 07-02 aggregator-level behavior (cross-project BUILDPLAN title derivation deferred), not a panel-level stub.

## Screenshot Pointers (Wave 4 UAT)

Wave 4 will capture real renders. Fixed testids for visual-regression hooks are listed in the **Data-testid Surface** table above.

Suggested UAT screenshots:
1. Full panel in founder mode (loaded state) — `[data-testid="spending-panel"]`.
2. Full panel in dev mode (same data, Cmd+Shift+D toggled) — text should flip to "Cost" heading, "Tokens today", etc.
3. Empty state (fresh repo, no adapter events yet) — verifies three empty-state branches fire together: `agent-stacked-bar-empty`, sparkline flat-line with caption, `top-expensive-tasks-empty`.
4. Error state (network interceptor) — `[data-testid="spending-panel-error"]`.

## Commits

| Task | Scope | Commit | Files | Inserts |
| ---- | ----- | ------ | ----- | ------- |
| 1 | `feat(07-03)` | `370fff4` | `components/metrics/{est-disclaimer,agent-stacked-bar,spending-daily-line}.tsx` | +190 |
| 2 | `feat(07-03)` | `320894b` | `components/metrics/top-expensive-tasks.tsx` | +87 |
| 3 | `feat(07-03)` | `ff97053` | `components/metrics/spending-panel.tsx` | +173 |

Total: **3 commits, 5 new files, 450 lines**.

## Self-Check: PASSED

- File `components/metrics/est-disclaimer.tsx` exists (32 lines): ✓
- File `components/metrics/agent-stacked-bar.tsx` exists (113 lines): ✓
- File `components/metrics/spending-daily-line.tsx` exists (45 lines): ✓
- File `components/metrics/top-expensive-tasks.tsx` exists (87 lines): ✓
- File `components/metrics/spending-panel.tsx` exists (173 lines): ✓
- Commit `370fff4` present in `git log`: ✓
- Commit `320894b` present in `git log`: ✓
- Commit `ff97053` present in `git log`: ✓
- `pnpm tsc --noEmit` reports zero errors in any of the 5 files: ✓
- Zero `$` signs in any of the 5 files (strict `\$[^{]` grep): ✓
