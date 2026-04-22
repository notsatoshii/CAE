---
phase: 07-metrics-global-top-bar-icon-page
plan: 04
subsystem: metrics-reliability-and-speed-panels
tags: [wave-2, panels, reliability, speed, parallel-with-07-03]
requirements:
  - REQ-7-WELL
  - REQ-7-FAST
  - REQ-7-FOUNDER
dependency-graph:
  requires:
    - dashboard/lib/cae-metrics-state.ts (MetricsState / ReliabilityState / SpeedState types)
    - dashboard/lib/hooks/use-metrics-poll.tsx (useMetricsPoll consumer)
    - dashboard/lib/copy/labels.ts (metrics.* keys with FOUNDER + DEV branches)
    - dashboard/lib/copy/agent-meta.ts (AGENT_META + agentMetaFor lookup)
    - dashboard/lib/providers/dev-mode.tsx (useDevMode hook)
    - dashboard/components/ui/sparkline.tsx (Sparkline primitive reuse)
    - node_modules/@base-ui/react/meter (Meter primitive)
    - recharts@3.8.1 (BarChart for time-to-merge histogram)
  provides:
    - "<ReliabilityPanel/> rendering per-agent SuccessGauge x 9 + RetryHeatmap + HaltEventsLog + SentinelRejectTrend; 3 render states (error/loading/loaded); sample-weighted lede"
    - "<SpeedPanel/> rendering PerAgentWallTable + QueueDepthDisplay + TimeToMergeHistogram; same 3 render states; sample-weighted overall P50 lede"
    - "Seven sub-components under components/metrics/ ready for page-shell composition in plan 07-05"
  affects:
    - "Wave 3 page shell (07-05) can now compose all three panels (spending from 07-03 + reliability + speed from 07-04)"
    - "All nine NEW components are '"use client"' islands; page shell stays a server component"
tech-stack:
  added: []
  patterns:
    - "base-ui Meter primitive with render-prop Meter.Value (not string child) — satisfies the MeterValue children signature (formattedValue, value) => ReactNode"
    - "React.Fragment with key= for row-group iteration in the 7x24 tailwind heatmap grid (keyed JSX fragment shorthand is not supported)"
    - "Sample-weighted lede math in both panels: multiply rate/latency by sample_n, divide by totalN — excludes under-sampled agents (n < 5 reliability, n == 0 speed)"
    - "AGENT_META iteration order used as the render order so gauge grid is stable even when the aggregator omits an agent"
    - "Recharts v3 Tooltip formatter: do NOT annotate value param as number (breaks Formatter<ValueType> assignability) — coerce inside the callback instead"
    - "Inline formatDuration helper in per-agent-wall-table (labels.ts keeps its copy private); matches the formatting used by metricsFastLede"
  removed: []
key-files:
  created:
    - "dashboard/components/metrics/success-gauge.tsx (82 lines)"
    - "dashboard/components/metrics/retry-heatmap.tsx (85 lines)"
    - "dashboard/components/metrics/halt-events-log.tsx (59 lines)"
    - "dashboard/components/metrics/sentinel-reject-trend.tsx (38 lines)"
    - "dashboard/components/metrics/queue-depth-display.tsx (35 lines)"
    - "dashboard/components/metrics/per-agent-wall-table.tsx (99 lines)"
    - "dashboard/components/metrics/time-to-merge-histogram.tsx (98 lines)"
    - "dashboard/components/metrics/reliability-panel.tsx (159 lines)"
    - "dashboard/components/metrics/speed-panel.tsx (121 lines)"
  modified: []
decisions:
  - "base-ui Meter subpath confirmed at @base-ui/react/meter (NOT @base-ui-components/react/meter) — the package scope on this repo is @base-ui"
  - "Meter.Value uses render-prop children `{() => L.metricsWellAgentGaugeLabel(shown, rate)}` because MeterValueProps types children as null | ((formattedValue, value) => ReactNode), NOT ReactNode directly"
  - "RetryHeatmap row iteration wrapped in React.Fragment key=... — the `<>` short-hand cannot take a key, and keys are required because each row emits a label + 24 cells"
  - "Reliability lede uses only agents with sample_n >= 5 — consistent with the SuccessGauge gating rule; agents with fewer samples contribute neither to headline nor to their own gauge"
  - "Speed lede overall P50 weighted by sample count, not a simple mean of p50_ms — matches how people intuit 'typical' when per-agent throughput differs by 10x"
  - "Tooltip formatter parameter intentionally untyped (widened to recharts ValueType | undefined) + in-body coercion to number — annotating as number broke Formatter<ValueType> assignability in recharts v3.8.1"
  - "Inline formatDuration in per-agent-wall-table.tsx rather than export from labels.ts — labels.ts keeps the helper file-local (per plan task 2 note); duplication is cheap and prevents churn in labels.ts"
metrics:
  duration_minutes: 10
  completed_date: "2026-04-22T11:45:00Z"
  tasks_completed: 3
  files_modified: 0
  files_created: 9
  commits:
    - "9e2dd53 feat(07-04): add reliability sub-components + queue-depth display"
    - "b0e32cf feat(07-04): add speed sub-components (per-agent wall + time-to-merge)"
    - "f5158e4 feat(07-04): compose ReliabilityPanel + SpeedPanel"
---

# Phase 7 Plan 4: Reliability + Speed Panels Summary

**One-liner:** Shipped seven sub-components (five reliability + two speed) plus the two composer panels that consume `useMetricsPoll()`, round out REQ-7-WELL and REQ-7-FAST, and leave the page shell (07-05) as the only remaining Phase 7 work — base-ui Meter import path verified at `@base-ui/react/meter`, zero `$` signs across nine files, `tsc` + `build` both clean, executed parallel with 07-03 on the same working tree with zero file overlap.

## What Shipped

### Task 1 — Reliability sub-components + queue-depth — commit `9e2dd53`

Five client islands, each a pure-renderer (props in, JSX out):

- **`success-gauge.tsx`** (82 lines): base-ui `Meter.Root / Meter.Label / Meter.Track / Meter.Indicator / Meter.Value` composition. 5-sample gate renders a non-gauge card with the founder-speak "not enough jobs yet" copy when `sampleN < MIN_SAMPLES`. Thresholds: ≥0.85 green (`var(--success)`), ≥0.70 yellow (`var(--warning)`), else red (`var(--danger)`). Meter.Value uses render-prop form (see Deviations below).
- **`retry-heatmap.tsx`** (85 lines): plain tailwind CSS-grid with `gridTemplateColumns: "28px repeat(24, minmax(0, 1fr))"`. Renders 7 row-groups × (1 label + 24 cells) = 175 divs. Alpha scales `0.15 + (count / max) * 0.85`; empty cells are fully transparent. Shows "No retries in the last 7 days." below the grid when every count is zero.
- **`halt-events-log.tsx`** (59 lines): flex list; each row is reason + locale timestamp. Dev-mode appends ` - task_id` when present. Founder empty-state copy: "Nothing paused this month. Nice." Dev empty-state: "no halts 30d".
- **`sentinel-reject-trend.tsx`** (38 lines): reuses the hand-rolled `<Sparkline>` primitive (D-04 — no recharts). 30d reject counts plot against a 240×36 px sparkline at `var(--warning)`; trailing span shows total push-backs.
- **`queue-depth-display.tsx`** (35 lines): big-number card. `metricsFastQueueDepthValue` handles the plural cases (founder: "nothing waiting" | "N waiting"; dev: "N inbox").

### Task 2 — Speed sub-components — commit `b0e32cf`

Two client islands:

- **`per-agent-wall-table.tsx`** (99 lines): filters out agents with `n === 0` (hiding silent agents; a blank-row-per-agent buries the signal) and sorts by sample count descending. Uses `agentMetaFor(row.agent)` for the emoji + label/founder_label flip. Inlines `formatDuration` (450 → "450ms", 3400 → "3.4s", 75_000 → "1.3m", 5_400_000 → "1.5h") rather than depending on labels.ts internal helper. Empty-state when every agent has `n == 0`: "No completed jobs yet."
- **`time-to-merge-histogram.tsx`** (98 lines): recharts `<BarChart>` over `time_to_merge_bins`. Fixed 5-bin label axis (from aggregator — never re-binned client-side). `var(--accent)` fill, cartesian grid at 40% opacity, tooltip using `L.metricsFastTimeToMergeBinLabel(bin, count)`. Empty-state: "No shipped jobs to chart yet."

### Task 3 — Compose ReliabilityPanel + SpeedPanel — commit `f5158e4`

- **`reliability-panel.tsx`** (159 lines): three render states (error-no-data / loading / loaded). Loaded render emits header with sample-weighted `metricsWellLede(weightedRate)` where `weightedRate = Σ(rate × n) / Σ(n)` across agents with `n ≥ 5`. Iterates `AGENT_META` keys so every one of the 9 agents renders even if the aggregator omits one (defensive; aggregator currently emits all 9). Sub-sections use `<h3>` headings bound by the panel's `aria-labelledby`.
- **`speed-panel.tsx`** (121 lines): same three render states. Lede is the sample-weighted overall P50 across agents with `n > 0`. Layout is a `grid-cols-1 lg:grid-cols-3` card — wall-table spans cols 1–2, queue-depth occupies col 3; time-to-merge histogram drops below full-width.

## base-ui Meter Import Path — Verified

Import path used: `@base-ui/react/meter` — the `@base-ui/react` package ships 1.4.0 on this repo with the `./meter` subpath exporting a `Meter` namespace (via `export * as Meter from "./index.parts.js"`). The research doc's `@base-ui-components/react/meter` alternative was checked — `@base-ui-components` scope does NOT exist in `node_modules`; the sole base-ui scope is `@base-ui`.

```bash
$ ls node_modules/@base-ui/
react

$ ls node_modules/@base-ui/react/meter/
index.d.ts  index.js  index.parts.d.ts  index.parts.js  indicator  label  root  track  value

$ cat node_modules/@base-ui/react/meter/index.d.ts | head -1
export * as Meter from "./index.parts.js";
```

## Sample-Gate Visibility in Dev

Live aggregator on this repo currently reports every agent's `sample_n` as 0 on the dashboard's own metrics (only the ephemeral `forge_begin`/`forge_end` lifecycle events populate this; the dashboard's own jsonl has a limited window). Therefore **all 9 gauges will render the insufficient-samples banner** right now — which visually demonstrates the gate is wired but will not show the green/yellow/red thresholds until a downstream CAE project with ≥5 completed jobs per agent seeds real data.

For verification that the threshold logic itself is correct, the code paths are exercised by the conditional cascade in `success-gauge.tsx` lines 52–56; they can be smoke-tested by injecting a fake entry in the `byAgent` lookup inside `reliability-panel.tsx` during dev.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Meter.Value children must be a render-prop, not a string**
- **Found during:** Task 1 tsc verify.
- **Issue:** Plan snippet `<Meter.Value>{L.metricsWellAgentGaugeLabel(shown, rate)}</Meter.Value>` triggered `TS2322: Type 'string' is not assignable to type '(formattedValue: string, value: number) => ReactNode'`. base-ui's `MeterValueProps` types children as `null | ((formattedValue, value) => ReactNode) | undefined` — it always expects a render prop.
- **Fix:** Wrap the string call in an arrow function: `<Meter.Value>{() => L.metricsWellAgentGaugeLabel(shown, rate)}</Meter.Value>`.
- **Files modified:** `dashboard/components/metrics/success-gauge.tsx` line 74.
- **Commit:** `9e2dd53`.

**2. [Rule 1 — Bug] React fragment shorthand cannot carry a key**
- **Found during:** Task 1 write.
- **Issue:** Plan snippet for `retry-heatmap.tsx` used `<>…</>` inside `.map()` with `key` inside — but the `<>` shorthand does not accept props. Would have triggered a React "each child in a list should have a unique key" warning.
- **Fix:** Imported `React` and swapped in `<React.Fragment key={"row-" + dow}>…</React.Fragment>`. Inner children keys removed (Fragment takes the key; the label div and 24 cells each already carry their own `key`).
- **Files modified:** `dashboard/components/metrics/retry-heatmap.tsx` line 46.
- **Commit:** `9e2dd53`.

**3. [Rule 3 — Blocking] Recharts v3 Tooltip Formatter signature too loose**
- **Found during:** Task 2 tsc verify.
- **Issue:** Plan snippet `formatter={(value: number, _name, props) => [...]` triggered `TS2322 — Type 'ValueType | undefined' is not assignable to type 'number'`. Recharts v3.8.1 widened the Formatter `value` parameter to a union including `undefined`, so annotating as `number` breaks assignability against `Formatter<ValueType, NameType>`.
- **Fix:** Dropped the parameter annotation; coerce inside the body via `typeof value === "number" ? value : Number(value) || 0`. Similarly narrowed the `item` parameter via `(item as { payload?: Bin } | undefined)?.payload`.
- **Files modified:** `dashboard/components/metrics/time-to-merge-histogram.tsx` lines 82–88.
- **Commit:** `b0e32cf`.

### Import-Path Correction

**4. Dev-mode provider path is `@/lib/providers/dev-mode`, not `@/lib/providers/dev-mode-provider`**
- **Found during:** Task 1 `read_first` — the plan's context block referenced `dashboard/lib/providers/dev-mode-provider.tsx` but that file does not exist on this repo; the actual file is `dashboard/lib/providers/dev-mode.tsx` (confirmed by grepping 10 existing callers — `agents/*`, `metrics/est-disclaimer.tsx`, `build-home/*`).
- **Fix:** All five Task-1 files, both Task-2 files, and both Task-3 panels import from `@/lib/providers/dev-mode`.
- **No code change required** — plan snippets used a phantom module path, so the first write already carried the right import.

No architectural escalations, no new dependencies.

## Authentication Gates

None — this plan is pure client-island panels. Session check happens one level up in `/metrics/page.tsx` (server component, Wave 3).

## Verification Results

| Check | Result |
| ----- | ------ |
| 9 files exist under `components/metrics/` per manifest | ✓ |
| Every file starts with `"use client";` | ✓ (9/9) |
| `grep -n '\$[^{]' {9 files} \| grep -v '\${'` | ✓ zero hits across all files |
| SuccessGauge imports `Meter` from `@base-ui/react/meter` | ✓ |
| SuccessGauge uses `MIN_SAMPLES = 5` constant | ✓ |
| RetryHeatmap grid template: `repeat(24, minmax(0, 1fr))` | ✓ (7 rows × 24 cols) |
| SentinelRejectTrend reuses `@/components/ui/sparkline` | ✓ |
| TimeToMergeHistogram imports `BarChart`, `Bar`, `ResponsiveContainer` from `"recharts"` | ✓ |
| PerAgentWallTable uses `agentMetaFor` | ✓ |
| ReliabilityPanel imports all 4 sub-components + `useMetricsPoll` | ✓ |
| SpeedPanel imports all 3 sub-components + `useMetricsPoll` | ✓ |
| `pnpm tsc --noEmit` exit 0 (no `components/metrics` errors) | ✓ |
| `pnpm build` exit 0 (10/10 static pages, 1 pre-existing next.config.ts advisory unrelated) | ✓ |
| Parallel 07-03 files untouched (spending-panel, agent-stacked-bar, spending-daily-line, top-expensive-tasks, est-disclaimer) | ✓ — zero overlap |

## Known Stubs

**None.** Every file is fully wired:
- All 5 sub-components in Task 1 render real aggregator data via the props passed from `ReliabilityPanel`.
- Both speed sub-components in Task 2 render real aggregator data via props from `SpeedPanel`.
- Both composer panels consume real data from `useMetricsPoll()`; three render states (error-no-data, loading, loaded) are all implemented — no placeholder branches.
- Empty states are first-class founder-speak copy (`L.metricsWellHaltsEmpty`, `L.metricsFastQueueDepthValue(0)` → "nothing waiting", etc.), not TODO stubs.
- Sample-gate visibility section above notes the gauge banners will render until downstream data accumulates — that's expected data-lag behaviour, not a code stub.

## Commits

| Task | Scope | Commit | Files | Insert / Delete |
| ---- | ------ | ------ | ----- | --------------- |
| 1 | `feat(07-04)` | 9e2dd53 | success-gauge + retry-heatmap + halt-events-log + sentinel-reject-trend + queue-depth-display | +299 / 0 |
| 2 | `feat(07-04)` | b0e32cf | per-agent-wall-table + time-to-merge-histogram | +197 / 0 |
| 3 | `feat(07-04)` | f5158e4 | reliability-panel + speed-panel | +280 / 0 |

Total: 776 lines across 9 files, 3 atomic commits, all with `--no-verify` (per plan prompt parallel-execution note).

## Self-Check: PASSED

- File `dashboard/components/metrics/success-gauge.tsx` exists (82 lines): FOUND
- File `dashboard/components/metrics/retry-heatmap.tsx` exists (85 lines): FOUND
- File `dashboard/components/metrics/halt-events-log.tsx` exists (59 lines): FOUND
- File `dashboard/components/metrics/sentinel-reject-trend.tsx` exists (38 lines): FOUND
- File `dashboard/components/metrics/queue-depth-display.tsx` exists (35 lines): FOUND
- File `dashboard/components/metrics/per-agent-wall-table.tsx` exists (99 lines): FOUND
- File `dashboard/components/metrics/time-to-merge-histogram.tsx` exists (98 lines): FOUND
- File `dashboard/components/metrics/reliability-panel.tsx` exists (159 lines): FOUND
- File `dashboard/components/metrics/speed-panel.tsx` exists (121 lines): FOUND
- Commit `9e2dd53` (Task 1) present in `git log`: FOUND
- Commit `b0e32cf` (Task 2) present in `git log`: FOUND
- Commit `f5158e4` (Task 3) present in `git log`: FOUND
- `pnpm tsc --noEmit` exit 0: PASS
- `pnpm build` exit 0 with 10/10 static pages: PASS
- Zero `$` signs across all 9 Phase 7 Plan 4 files (excluding `${…}` template expressions): PASS
- Zero overlap with 07-03 file manifest (spending-panel.tsx, agent-stacked-bar.tsx, spending-daily-line.tsx, top-expensive-tasks.tsx, est-disclaimer.tsx): PASS
