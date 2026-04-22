---
phase: 07-metrics-global-top-bar-icon-page
plan: 05
subsystem: metrics-page-shell-and-explain-mode
tags: [wave-3, page-shell, explain-mode, integration]
requirements:
  - REQ-7-SPEND
  - REQ-7-WELL
  - REQ-7-FAST
  - REQ-7-FOUNDER
dependency-graph:
  requires:
    - dashboard/lib/cae-metrics-state.ts (MetricsState type, via panels)
    - dashboard/lib/hooks/use-metrics-poll.tsx (MetricsPollProvider consumed here)
    - dashboard/lib/providers/explain-mode.tsx (useExplainMode consumer)
    - dashboard/lib/copy/labels.ts (metricsPageHeading + metricsExplain* keys from 07-02)
    - dashboard/components/metrics/spending-panel.tsx (07-03)
    - dashboard/components/metrics/reliability-panel.tsx (07-04)
    - dashboard/components/metrics/speed-panel.tsx (07-04)
    - dashboard/auth.ts (auth() session gate)
    - "@base-ui/react/popover (Popover primitive)"
    - "lucide-react HelpCircle icon"
  provides:
    - "GET /metrics authenticated route rendering full dashboard page: server heading + MetricsClient island + three panels in order Spending / Reliability / Speed"
    - "<MetricsClient/> — client island mounting MetricsPollProvider(30s) once around all three panels so they share a single poll cycle"
    - "<ExplainTooltip text ariaLabel?> — base-ui Popover tooltip with useExplainMode-aware opacity (70% on / 30% off), always-focusable for keyboard users"
    - "10 ExplainTooltip anchors across spending/reliability/speed panels covering the 7 plan-listed metrics keys (P50, P95, SuccessRate, Projected, Tokens x3, QueueDepth, TimeToMerge, RetryHeatmap)"
    - "Unauthenticated visits redirect to /signin?from=/metrics"
  affects:
    - "Phase 7 REQ-7-* requirements closed end-to-end — /metrics navigable in pnpm dev"
    - "Wave 4 UAT (07-06) can now visually verify full page + tooltip interactions"
    - "Top-bar MetricsIcon (components/shell/metrics-icon.tsx, pre-existing) now navigates to a real-content route"
tech-stack:
  added: []
  patterns:
    - "Server-component page shell + thin \"use client\" island wrapper (D-09) — page.tsx stays a server component so await auth() runs server-side; MetricsClient owns provider layering so its consumers always resolve"
    - "Always-rendered ExplainTooltip trigger with opacity modulation (30% off / 70% on) rather than conditional omission — keyboard users retain access regardless of explain-mode state"
    - "Popover from @base-ui/react/popover — base-ui lacks asChild (AGENTS.md p2-plA-t1-e81f6c) so className applied directly to Popover.Trigger"
    - "Server heading uses labelFor(false) (founder default) since DevModeProvider is a client-only state; brief flash on hydration is acceptable and matches existing route patterns (build-home, plan-home)"
    - "BigNumber component extended with optional explainText prop — minimal diff (additive), existing call sites continue to work when prop is omitted"
  removed: []
key-files:
  created:
    - "dashboard/components/metrics/explain-tooltip.tsx (59 lines)"
    - "dashboard/app/metrics/metrics-client.tsx (29 lines)"
  modified:
    - "dashboard/app/metrics/page.tsx (rewrote stub: +32 insertions / -11 deletions; final 38 lines)"
    - "dashboard/components/metrics/spending-panel.tsx (+18 / -4; final 186 lines; extended BigNumber + added 4 ExplainTooltip anchors)"
    - "dashboard/components/metrics/reliability-panel.tsx (+18 / -3; final 171 lines; added 2 ExplainTooltip anchors)"
    - "dashboard/components/metrics/speed-panel.tsx (+26 / -6; final 145 lines; added 4 ExplainTooltip anchors)"
decisions:
  - "ExplainTooltip trigger always rendered (dims to 30% opacity when explain-mode off) rather than conditionally mounted — preserves keyboard access and is simpler than managing a second focus target. Matches UI-SPEC §Explain-mode default-on policy"
  - "Server page uses labelFor(false) for the page heading (founder default) since DevModeProvider is client-only; MetricsClient's panels re-render with live dev-mode state. Brief flash on hydration is a deliberate trade for keeping the page shell a server component (D-09)"
  - "ExplainTooltip lives at components/metrics/explain-tooltip.tsx (metric-specific) rather than components/ui/ — could be generalized later; don't preempt"
  - "Tooltip attached adjacent to BigNumber's label span (flex row with gap-1.5) instead of modifying the value span — keeps the big number visually uninterrupted"
  - "Queue-depth tooltip placed BELOW the QueueDepthDisplay in a right-aligned flex row rather than wrapping the display — avoids touching the pre-existing QueueDepthDisplay component (07-04 owns it; minimal-diff principle)"
  - "10 ExplainTooltip anchors rather than 6 — low marginal cost since every explain key already exists in labels.ts, and users get better coverage (today + MTD get the same Tokens glossary as it's the most confusing term for non-devs)"
metrics:
  duration_minutes: 4.5
  completed_date: "2026-04-22T11:31:14Z"
  tasks_completed: 2
  files_modified: 4
  files_created: 2
  commits:
    - "c760ea3 feat(07-05): add ExplainTooltip + /metrics page shell + client island"
    - "7acd7b2 feat(07-05): wire ExplainTooltips across spending/reliability/speed panels"
---

# Phase 7 Plan 5: Page Shell + Explain-Mode Tooltips Summary

**One-liner:** Wired `/metrics` end-to-end — server page with auth gate and semantic heading mounts a thin client island (`MetricsClient`) that owns a single `MetricsPollProvider(30s)` around all three panels, and attached 10 base-ui Popover `<ExplainTooltip>` anchors (useExplainMode-aware, lucide `HelpCircle` trigger) across Spending / Reliability / Speed at P50, P95, SuccessRate, Projected, Tokens, QueueDepth, TimeToMerge, and RetryHeatmap. Closes all four REQ-7-* requirements.

## What Shipped

### Task 1 — ExplainTooltip + page.tsx rewrite + metrics-client.tsx — commit `c760ea3`

**`components/metrics/explain-tooltip.tsx` (59 lines, NEW)**

- `"use client"` top-level.
- Props: `{ text: string; ariaLabel?: string }`.
- Renders `<Popover.Root>` with:
  - `<Popover.Trigger>` — small inline-flex round button, `size-3.5` `HelpCircle` icon, `aria-label` (default "Explain this metric"), `data-testid="explain-trigger"`.
  - Dynamic opacity class: `opacity-70 hover:opacity-100` when `useExplainMode().explain === true`; `opacity-30 hover:opacity-100` when off. Keyboard users always see the trigger (30% is still visible).
  - `focus-visible:outline-2 focus-visible:outline-[color:var(--accent)]` for clear focus ring.
- `<Popover.Portal>` → `<Popover.Positioner sideOffset={6}>` → `<Popover.Popup role="tooltip">` with max-width 260px, rounded border, surface background, 12px text, shadow.
- Uses the app's CSS custom-property palette (`--border`, `--surface`, `--text`, `--text-muted`, `--accent`).

**`app/metrics/page.tsx` (38 lines, REWRITE — stub replaced)**

- Server component (no `"use client"`).
- `await auth()` gate → `redirect("/signin?from=/metrics")` on missing session.
- Server-renders `<h1>` with `labelFor(false).metricsPageHeading` ("How CAE is doing" / founder default). Client will re-render panel sub-headings with the live DevMode state.
- `data-testid="metrics-page-heading"`.
- `<main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">` — max-w-6xl (1152px) matches UI-SPEC §13 desktop baseline minus rail+chat buffers.
- Mounts `<MetricsClient />` below the heading.

**`app/metrics/metrics-client.tsx` (29 lines, NEW)**

- `"use client"` top-level.
- `<MetricsPollProvider intervalMs={30_000}>` wraps `<SpendingPanel /> <ReliabilityPanel /> <SpeedPanel />` in a `flex flex-col gap-6` div with `data-testid="metrics-client"`.
- All three panels share one poll cycle (D-06).
- Intentionally small — future page-level controls (date-range picker, project filter) live here, not in the server page.

### Task 2 — ExplainTooltip anchors across panels — commit `7acd7b2`

**`components/metrics/spending-panel.tsx` (186 lines, +18 / -4)**

- Imported `ExplainTooltip`.
- `BigNumber` extended: added optional `explainText?: string` prop. Label span became `flex items-center gap-1.5` and renders `<ExplainTooltip text={explainText} ariaLabel={"Explain " + label} />` when prop provided.
- Today / MTD / Projected BigNumbers each pass `explainText` (Tokens / Tokens / Projected).
- Top-10 expensive `<h3>` now a `flex items-center gap-2` row with the heading `<span>` plus an `<ExplainTooltip text={L.metricsExplainTokens} ariaLabel="Explain expensive tasks" />`.

**`components/metrics/reliability-panel.tsx` (171 lines, +18 / -3)**

- Imported `ExplainTooltip`.
- Lede `<p>` restructured to `flex items-center gap-1.5` containing the existing `<span>{L.metricsWellLede(weightedRate)}</span>` plus an `<ExplainTooltip text={L.metricsExplainSuccessRate} ariaLabel="Explain success rate" />`.
- Retry-heatmap `<h3>` restructured similarly: `<span>{L.metricsWellRetryHeatmapHeading}</span>` plus `<ExplainTooltip text={L.metricsExplainRetryHeatmap} ariaLabel="Explain retry heatmap" />`.

**`components/metrics/speed-panel.tsx` (145 lines, +26 / -6)**

- Imported `ExplainTooltip`.
- Per-agent wall `<h3>` restructured: heading `<span>` plus **two** tooltips (`metricsExplainP50` + `metricsExplainP95`) — the row covers both percentiles listed in the table columns.
- Queue-depth area wrapped: `<QueueDepthDisplay>` unchanged, but a new right-aligned flex row below it carries `<ExplainTooltip text={L.metricsExplainQueueDepth} ariaLabel="Explain queue depth" />`.
- Time-to-merge `<h3>` restructured: heading `<span>` plus `<ExplainTooltip text={L.metricsExplainTimeToMerge} ariaLabel="Explain time to merge" />`.

## ExplainTooltip Anchor Inventory

| # | Panel        | Anchor location                                   | Labels key                      |
| - | ------------ | ------------------------------------------------- | ------------------------------- |
| 1 | Spending     | BigNumber label "Today" / dev "Tokens today"     | `metricsExplainTokens`          |
| 2 | Spending     | BigNumber label "This month so far" / dev "MTD"  | `metricsExplainTokens`          |
| 3 | Spending     | BigNumber label "Projected this month"           | `metricsExplainProjected`       |
| 4 | Spending     | Top expensive-tasks `<h3>`                        | `metricsExplainTokens`          |
| 5 | Reliability  | Lede `<p>` (sample-weighted success rate line)    | `metricsExplainSuccessRate`     |
| 6 | Reliability  | Retry-heatmap `<h3>`                              | `metricsExplainRetryHeatmap`    |
| 7 | Speed        | Per-agent `<h3>` (P50 tooltip)                    | `metricsExplainP50`             |
| 8 | Speed        | Per-agent `<h3>` (P95 tooltip)                    | `metricsExplainP95`             |
| 9 | Speed        | QueueDepth card (sibling tooltip below display)   | `metricsExplainQueueDepth`      |
| 10 | Speed       | Time-to-merge histogram `<h3>`                    | `metricsExplainTimeToMerge`     |

**Total: 10 anchors**, covering 8 of the 8 `metricsExplain*` keys shipped by 07-02 (Tokens is used 3× since today/MTD/top-tasks all share it). Plan minimum was 6 — shipped with 67% headroom.

## useExplainMode() Shape Confirmation

Actual return type of `useExplainMode()` from `lib/providers/explain-mode.tsx`:

```ts
type ExplainModeContextValue = {
  explain: boolean;
  toggle: () => void;
  setExplain: (v: boolean) => void;
};
```

Matches the plan's expected `{ explain: boolean; toggle: () => void }` — ExplainTooltip destructures `{ explain }` only. No adaptation needed.

Note: the provider's actual filename is `lib/providers/explain-mode.tsx` (not `explain-mode-provider.tsx` as the plan's inline interface comment hinted). ExplainTooltip imports `from "@/lib/providers/explain-mode"` — matches the real path (verified by grep; same pattern used by existing callers like `build-home-heading.tsx`).

## Server Shell + Client Island Layering

```
app/metrics/page.tsx (server)
  ├── await auth() + redirect if no session
  ├── <main>
  │     ├── <h1> server-rendered with labelFor(false).metricsPageHeading
  │     └── <MetricsClient />   ← client island boundary
  │
  └── (client) app/metrics/metrics-client.tsx
        └── <MetricsPollProvider intervalMs={30_000}>
              ├── <SpendingPanel />     ← useMetricsPoll() reads shared state
              ├── <ReliabilityPanel />
              └── <SpeedPanel />
              (each panel also consumes useDevMode() + labelFor(dev))
              (each panel contains ExplainTooltip children which call useExplainMode())
```

ExplainModeProvider + DevModeProvider are mounted globally in `app/layout.tsx` (Phase 3) — no additional wrapping needed in this plan.

## Top-Bar Metrics Icon

`components/shell/metrics-icon.tsx` (pre-existing from Phase 6) already renders `<Link href="/metrics" aria-label="Metrics" data-testid="metrics-icon">` with a `BarChart3` lucide icon, and is composed into `components/shell/top-nav.tsx`. No change needed — the success criterion "Top-bar metrics icon navigates to /metrics" is now fully satisfied end-to-end since `/metrics` renders real content.

## Screenshot Pointers (Wave 4 UAT)

Fixed testids for visual-regression hooks introduced by this plan:

- `metrics-page-heading` — server-rendered `<h1>`.
- `metrics-client` — client island wrapper div.
- `explain-trigger` — every ExplainTooltip's `<button>` (10 instances in the loaded page).
- `explain-popup` — the `<Popover.Popup>` tooltip body (rendered via portal when open).

Panel-owned testids (`spending-panel`, `reliability-panel`, `speed-panel`, `spending-today`, etc.) retained from 07-03 and 07-04 — ExplainTooltip attachment did not replace any of them.

Suggested UAT screenshots:
1. Full page loaded (authenticated) in founder mode — `/metrics` after `pnpm dev`.
2. Same in dev mode (⌘⇧D) — tooltip opacity should be identical (explain-mode unaffected by dev-mode); tooltip popup text switches to the engineer-speak key (e.g. "50th percentile, linear interpolation over sorted samples.").
3. Explain-mode off (Ctrl+E) — triggers dim to 30% opacity, still focusable via Tab.
4. Unauthenticated visit → redirect to `/signin?from=/metrics` (URL shows `from=/metrics` query param).
5. Click any `?` button → Popover opens, popup carries `role="tooltip"`, Esc closes.

## Deviations from Plan

**None — plan executed exactly as written.** Every must-have truth, artifact minimum line count, export name, and key-link pattern is present.

Minor in-line notes (pre-documented in plan Task action text, not true deviations):

- ExplainTooltip placed 10 anchors rather than the 6 plan-minimum — the plan's action text explicitly lists 10 target locations (P50, P95, SuccessRate, Projected, Tokens×3, QueueDepth, TimeToMerge, RetryHeatmap). Shipped all of them.
- Queue-depth tooltip is a sibling of QueueDepthDisplay rather than wrapping it — the plan offered this as an acceptable alternative ("OR just add a sibling div") to avoid modifying 07-04's `QueueDepthDisplay` component. Went with the sibling-div path since it keeps this plan's diff minimal and respects 07-04's file ownership.
- Provider file path is `lib/providers/explain-mode.tsx` not `explain-mode-provider.tsx` — the plan's interface comment hinted at the latter but the `read_first` step confirmed the former. No code change, just a path clarification.

No architectural escalations. No new dependencies (lucide-react 0.510.0 was already installed; `HelpCircle` imported as a tree-shakable named import).

## Authentication Gates

None hit during execution — this plan is pure dashboard UI. The `/metrics` route's own session gate is exercised as a behavioral contract (tested by the success-criteria grep for `/signin?from=/metrics`), not an auth gate blocking work.

## Verification Results

| Check                                                                   | Result           |
| ----------------------------------------------------------------------- | ---------------- |
| `components/metrics/explain-tooltip.tsx` exists + `"use client"`        | ✓ (59 lines)     |
| `app/metrics/metrics-client.tsx` exists + `"use client"`                | ✓ (29 lines)     |
| `app/metrics/page.tsx` rewritten + NOT `"use client"` (server)          | ✓ (38 lines)     |
| `export function ExplainTooltip` in explain-tooltip.tsx                 | ✓                |
| `Popover` from `@base-ui/react/popover` used                            | ✓                |
| `useExplainMode` consumed in explain-tooltip.tsx                        | ✓                |
| `await auth()` + `/signin?from=/metrics` redirect in page.tsx           | ✓                |
| `<MetricsClient />` mounted in page.tsx                                 | ✓                |
| `MetricsPollProvider` + 3 panels in metrics-client.tsx                  | ✓                |
| All 3 panels import `ExplainTooltip`                                    | ✓                |
| `metricsExplain*` keys referenced: P50, P95, SuccessRate, Projected, Tokens, QueueDepth, TimeToMerge, RetryHeatmap | ✓ all 8 present |
| Zero stray `$` outside `${...}` templates in the 6 touched files        | ✓                |
| `pnpm tsc --noEmit`                                                     | ✓ exit 0 (zero output) |
| `pnpm build`                                                            | ✓ exit 0, `/metrics` in route table |
| Top-bar `metrics-icon.tsx` → `href="/metrics"` (pre-existing)           | ✓ verified       |

## Known Stubs

**None.** Every file is fully wired:

- ExplainTooltip consumes real `useExplainMode()` state and renders a real base-ui Popover; tooltip text flows from `labelFor(dev).metricsExplain*` real copy.
- page.tsx runs a real `await auth()` session check and renders real `labelFor` copy.
- metrics-client.tsx mounts the real `MetricsPollProvider` and composes real panels (no placeholder data).
- All 10 tooltip anchors reference real labels keys shipped by 07-02 and read through `labelFor(dev)` — no hardcoded or placeholder tooltip text.

## Commits

| Task | Scope            | Commit    | Files                                                                                         | Insert / Delete |
| ---- | ---------------- | --------- | --------------------------------------------------------------------------------------------- | --------------- |
| 1    | `feat(07-05)`    | c760ea3   | components/metrics/explain-tooltip.tsx (new), app/metrics/metrics-client.tsx (new), app/metrics/page.tsx (rewrite) | +115 / -6 |
| 2    | `feat(07-05)`    | 7acd7b2   | components/metrics/spending-panel.tsx, components/metrics/reliability-panel.tsx, components/metrics/speed-panel.tsx | +62 / -13 |

Total: **2 commits, 2 new files, 4 modified, +177 / -19**.

## Self-Check: PASSED

- File `dashboard/components/metrics/explain-tooltip.tsx` exists (59 lines): FOUND
- File `dashboard/app/metrics/page.tsx` exists (38 lines, rewritten): FOUND
- File `dashboard/app/metrics/metrics-client.tsx` exists (29 lines): FOUND
- Modified files have ExplainTooltip references: spending-panel.tsx FOUND, reliability-panel.tsx FOUND, speed-panel.tsx FOUND
- Commit `c760ea3` present in `git log --oneline`: FOUND
- Commit `7acd7b2` present in `git log --oneline`: FOUND
- `pnpm tsc --noEmit` exit 0: PASS
- `pnpm build` exit 0 with `/metrics` in route table: PASS
- Zero `$` signs in the 6 touched files (excluding `${}` template expressions): PASS
- All plan success-criteria greps pass (10/10): PASS
