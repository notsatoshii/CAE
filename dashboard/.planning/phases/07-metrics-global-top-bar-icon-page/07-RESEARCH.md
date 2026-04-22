# Phase 7: Metrics — Research

**Researched:** 2026-04-22
**Domain:** dashboard data-viz over `.cae/metrics/*.jsonl` + `/api/state` aggregator
**Confidence:** HIGH on data-layer findings (grepped source of truth); MEDIUM on charting-lib rec (pending bundle measurement).

## Summary

`/metrics` is THREE panels (Spending / How well / How fast) over three JSONL streams already parsed in Phase 2+5. Two surprises make this phase bigger than it looks:

1. **Token counts are currently always zero.** `.cae/metrics/circuit-breakers.jsonl` contains `forge_begin`/`forge_end` events only — no `input_tokens`/`output_tokens` fields. The Python `CircuitBreakers.record_tokens()` API exists (`bin/circuit_breakers.py:136`) but is NOT called from `adapters/claude-code.sh`. Spending panel will render empty until the adapter is extended. Options below.
2. **Existing dashboard field-name mismatches.** `cae-home-state.ts` + `cae-agents-state.ts` + `/api/state/route.ts` all read camelCase `inputTokens`/`outputTokens`/`taskId`/`wallMs` and events `forge_start`/`forge_done`/`forge_fail`/`phantom_escalation` — none of which exist in real jsonl (which uses `ts`, `task_id`, `forge_begin`, `forge_end` with `success` bool, `escalate_to_phantom`). Phase 7 aggregator MUST read the real schema.

**Primary recommendation:** Single new `/api/metrics` aggregator, three panel components, one `recharts` dependency (pinned to 3.8.1). Extend `adapters/claude-code.sh` to emit token events to `.cae/metrics/tokens.jsonl` (new file) in a Wave 0 task before Spending renders live numbers.

## User Constraints (inherited from ROADMAP.md + UI-SPEC.md + STATE.md)

### Locked Decisions (design law)
- Cost = **tokens only, never USD**. No `$` in metrics copy. Explicit grep guard in verification.
- Memory + Metrics are **global top-bar icons**, not mode-scoped. `/metrics` route stub already shipped Phase 3.
- Dark theme, Geist fonts, `#00d4ff` accent per UI-SPEC §13.
- `@base-ui/react` ^1.4.0 — NOT shadcn primitives. base-ui has NO `asChild` (AGENTS.md gotcha).
- Tailwind v4 (`@tailwindcss/postcss` ^4.2.2).
- Explain-mode default ON (Ctrl+E toggles); DevMode default OFF (⌘Shift+D toggles). Founder-speak is primary copy.
- Data source: Phase 4 `/api/state` + `.cae/metrics/*.jsonl` + `.cae/inbox` / `.cae/outbox` / tmux.

### Claude's Discretion
- Chart library choice (recommendation below).
- Shape of new `/api/metrics` JSON.
- Polling cadence per panel.
- Whether Spending ships with live-zero or waits for adapter patch.

### Deferred Ideas (OUT OF SCOPE)
- USD conversion anywhere.
- Historical data beyond 30d.
- Multi-project drill-down (stub as single-project for v0.1).
- Cost alerts / anomaly detection.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-7-SPEND | Spending panel: today + MTD + projected; stacked bar by agent; 30d line; top-10 expensive tasks; "est." disclaimer | §Token-cost source + recharts BarChart/LineChart |
| REQ-7-WELL | Reliability: per-agent gauges + retry heatmap + halt log + Sentinel reject trend | base-ui Meter + recharts AreaChart + tail of circuit-breakers.jsonl + sentinel.jsonl |
| REQ-7-FAST | Speed: P50/P95 wall + queue depth + time-to-merge dist | Computed from `forge_begin`→`forge_end` ts deltas + inbox/outbox mtime + histogram chart |
| REQ-7-FOUNDER | Founder-speak copy ("CAE is getting things right 94%") | Extend lib/copy/labels.ts with `metrics.*` keys |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| recharts | 3.8.1 | Charts (BarChart, LineChart, AreaChart, ScatterChart) | Last release 2026-03-25, React 19 compatible when react-is pinned; 140k weekly downloads; shadcn-chart defaults [CITED: github.com/recharts/recharts/releases] [VERIFIED: npm view via WebSearch] |
| @base-ui/react | ^1.4.0 (already in deps) | `Meter` primitive for per-agent gauges | 1.1.0 released 2026-01-15; Meter stable + a11y-compliant [CITED: base-ui.com/react/components/meter] |

### Supporting (already present)
| Library | Version | Purpose |
|---------|---------|---------|
| `components/ui/sparkline.tsx` | existing | 30d line trend primitive — reuse, do NOT rebuild |
| `lib/copy/labels.ts` | existing | Extend with `metrics.*` keys (founder + dev variants) |
| `lib/copy/agent-meta.ts` | existing | Already holds agent color/emoji/founder_label — reuse for stacked bar coloring |
| `lib/hooks/use-state-poll.tsx` | existing | Pattern to mirror for new `useMetricsPoll` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| recharts | visx | Lower-level; +~20KB smaller but 3× more component code per chart. Rejected — team already hand-rolls SVG (Sparkline, StepGraph), the mid-tier abstraction is the gap. |
| recharts | hand-rolled SVG (Phase 5/6 pattern) | Works for sparkline + stack bars; breaks on heatmap (24×7 grid), histogram (variable bin count), stacked multi-agent bar. Plan to keep handroll for Sparkline (already have it) and adopt recharts for everything else. |
| recharts | @nivo/core | Heavier (150KB+), SSR footguns, overkill for 3 panels. |

**Installation:**
```bash
pnpm add recharts@3.8.1
# React 19 peer-dep guard: if install warns, add to package.json → overrides: { "react-is": "19.2.4" }
```

**Version verified:** recharts@3.8.1 published 2026-03-25 per GitHub releases page (WebSearch 2026-04-22).

## Data Source Map

### JSONL Schemas (ground truth — sampled from `dashboard/.cae/metrics/`)

**`.cae/metrics/circuit-breakers.jsonl`** — produced by `bin/circuit_breakers.py:108`
```jsonc
// Fields: ts (ISO8601 Z), event, + event-specific fields.
{"ts":"2026-04-20T08:41:03Z","event":"forge_begin","task_id":"p2-plA-t1-b12bb5","attempt":1}
{"ts":"2026-04-20T08:41:03Z","event":"forge_slot_acquired"}
{"ts":"2026-04-20T08:43:07Z","event":"forge_slot_released"}
{"ts":"2026-04-20T08:43:07Z","event":"forge_end","task_id":"p2-plA-t1-b12bb5","attempt":1,"success":true}
{"ts":"2026-04-20T08:47:44Z","event":"sentinel_json_failure","count":1,"cap":2}
// Other events seen in source (not yet in sample data but emitted): limit_exceeded, escalate_to_phantom, phantom_end, halt, sentinel_fallback_triggered
```

**`.cae/metrics/sentinel.jsonl`** — produced by `bin/sentinel.py:50`
```jsonc
{"ts":"...","event":"gemini_verdict_ok","task_id":"...","approve":true,"issues":2,"reviewer_model":"gemini-2.5-pro"}
{"ts":"...","event":"gemini_json_parse_failed","task_id":"...","raw_len":0}
{"ts":"...","event":"claude_fallback_verdict_ok","task_id":"...","approve":false,"issues":3}
// Other: gemini_no_output, gemini_verdict_invalid, gemini_failed_fallback_engaged, claude_fallback_no_output, claude_fallback_verdict_invalid, sentinel_total_failure
```

**`.cae/metrics/compaction.jsonl`** — `bin/compactor.py:72`: `compacted` event only.

**`.cae/metrics/scribe.jsonl`** — `bin/scribe.py`: `gemini_scribe_failed`, `claude_haiku_scribe_ok`, `scribe_applied`.

**`.cae/metrics/approvals.jsonl`** — `bin/telegram_gate.py:63`: `gate_triggered`, `gate_decision`. (File may not exist until first gate fires.)

### Panel → Source Matrix

| Panel | Metric | Source | Computation |
|-------|--------|--------|-------------|
| Spending | tokens today | TBD — see §Token Gap below | sum `input_tokens`+`output_tokens` where `ts` starts with today |
| Spending | tokens MTD / projected | same | sum MTD; projected = MTD × (daysInMonth / daysElapsed) |
| Spending | stacked bar by agent | `circuit-breakers.jsonl` `task_id` → agent (via `agent-meta.ts` lookup; falls back to `forge`) | group by UTC date + agent |
| Spending | 30d line | same | daily sum |
| Spending | top 10 expensive tasks | same | sorted desc by tokens, joined with task title via existing `firstLine()` in `cae-queue-state.ts:205` |
| How well | per-agent success gauge (7d) | `circuit-breakers.jsonl` — `forge_end` events with `success` bool | grouped per agent (same inference as `cae-agents-state.ts`) |
| How well | retry heatmap (7d×24h) | `circuit-breakers.jsonl` — `forge_end` where `success:false` OR `limit_exceeded` where `limit=="max_retries"` | bucket by day-of-week + hour-of-day |
| How well | halt events log | `circuit-breakers.jsonl` `event=="halt"` | chronological, show `reason` field |
| How well | Sentinel reject trend | `sentinel.jsonl` events where `approve===false` OR `*verdict_invalid` OR `sentinel_total_failure` | daily count, 30d |
| How fast | P50/P95 wall time | `circuit-breakers.jsonl` — compute wall from `forge_begin(task_id,attempt)` → `forge_end(task_id,attempt)` timestamp delta | per-agent quantile |
| How fast | queue depth over time | derived — snapshot count of `inbox/` every poll tick, append to rolling ring | client-side accumulation, no server persistence needed v0.1 |
| How fast | time-to-merge distribution | `inbox/{taskId}/` creation mtime → `outbox/{taskId}/DONE.md` mtime | histogram (log-scale bins) |

## Architecture Patterns

### Recommended Structure

```
app/
├── api/
│   └── metrics/
│       └── route.ts          # NEW — single aggregator, returns MetricsState
└── metrics/
    └── page.tsx              # REWRITE — mounts 3 panel islands
components/
└── metrics/                  # NEW
    ├── spending-panel.tsx
    ├── reliability-panel.tsx
    ├── speed-panel.tsx
    ├── agent-stacked-bar.tsx    # recharts BarChart
    ├── retry-heatmap.tsx        # recharts (or hand-rolled div grid — cheaper)
    ├── time-to-merge-hist.tsx   # recharts BarChart with variable bins
    └── est-disclaimer.tsx
lib/
├── cae-metrics-state.ts      # NEW — aggregator, mirrors cae-agents-state.ts pattern
└── hooks/
    └── use-metrics-poll.tsx  # NEW — 30s polling (slower than state's 3s)
```

### Pattern 1: Server aggregator + client panel

Mirror Phase 5 (`cae-agents-state.ts` + `/api/agents/route.ts`). Aggregator is process-level cached (30s TTL is fine; panels don't need real-time). Panels are `"use client"` islands consuming a shared `useMetricsPoll()` context.

### Pattern 2: One API, three sub-shapes

```ts
interface MetricsState {
  generated_at: string;
  spending: {
    tokens_today: number;       // 0 until adapter patched — see §Token Gap
    tokens_mtd: number;
    tokens_projected_monthly: number;
    by_agent_30d: Array<{ date: string; [agentName: string]: number | string }>;  // stacked bar rows
    daily_30d: Array<{ date: string; tokens: number }>;
    top_expensive: Array<{ task_id: string; title: string; tokens: number; agent: string; ts: string }>;
  };
  reliability: {
    per_agent_7d: Array<{ agent: string; success_rate: number; sample_n: number }>;
    retry_heatmap: Array<{ dow: 0..6; hour: 0..23; count: number }>;
    halt_events: Array<{ ts: string; reason: string; task_id?: string }>;
    sentinel_rejects_30d: Array<{ date: string; rejects: number; approvals: number }>;
  };
  speed: {
    per_agent_wall: Array<{ agent: string; p50_ms: number; p95_ms: number; n: number }>;
    queue_depth_now: number;     // current inbox count
    time_to_merge_bins: Array<{ bin_label: string; count: number }>;  // e.g. "<1m", "1-5m", "5-15m", "15m-1h", ">1h"
  };
}
```

### Anti-patterns to avoid
- **Don't render recharts in a Server Component.** Recharts needs `"use client"` (WebSearch confirmed). Panel components = client islands; page shell = server component.
- **Don't put recharts in the shared `StatePollProvider`.** 3s poll + chart re-mount = jank. Use a separate 30s `useMetricsPoll` hook.
- **Don't use `asChild`** on base-ui Meter — base-ui components don't support polymorphism (AGENTS.md gotcha, `p2-plA-t1-e81f6c`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Stacked bar by agent (multi-series + legend + responsive width) | Custom SVG | `<BarChart><Bar stackId="a" />×N</BarChart>` | Legend + hover + resize = 200 lines of SVG hell |
| 30d line with axis + tooltip | Custom SVG | `<LineChart>` with `<Tooltip>` | Date axis formatting alone is 50 lines |
| Time-to-merge histogram | Custom SVG | `<BarChart>` with pre-binned data | Variable bin widths + log scale |
| Per-agent success gauge (0-1 with band) | SVG arc math | base-ui `<Meter>` | Already-shipped dep, a11y built-in |
| Percentile math | roll-your-own | same linear-interpolation pattern as used in `cae-agents-state.ts` for sparkline buckets | Already in codebase |
| Retry heatmap (7×24) | recharts ScatterChart abuse | Plain `<div className="grid grid-cols-24">` + color-intensity bg | 7×24 = 168 divs; no library overhead, design-system-native colors |

**Key insight:** Use recharts for anything with axes/tooltips/legends. Use bare SVG or divs for fixed-grid visuals (heatmap, gauges via base-ui).

## Common Pitfalls

### Pitfall 1: Token gap ("est. — actually zero")
**What goes wrong:** Launch Spending panel; numbers stay at 0 because `circuit-breakers.jsonl` never contains token fields.
**Why:** `bin/circuit_breakers.py:136` `record_tokens()` exists but is not wired from `adapters/claude-code.sh`. Adapter captures raw stdout (see `adapters/claude-code.sh:151`) but doesn't extract token counts from Claude's metadata output.
**How to avoid:** Wave 0 task — patch `adapters/claude-code.sh` to parse the trailing usage JSON (`{"input_tokens":N,"output_tokens":M,"model":"..."}`) from `--print` mode and emit `token_usage` event into a new `.cae/metrics/tokens.jsonl` (or extend `circuit-breakers.jsonl`). Planner must decide. **Stop-gap:** render panel with "0 tok today — token logging wiring pending" explain-mode banner so v0.1 ships.
**Warning signs:** `grep -c '"input_tokens"' .cae/metrics/*.jsonl` returns 0 across all projects.

### Pitfall 2: Field name schema drift (camelCase vs snake_case)
**What goes wrong:** You reuse `cae-agents-state.ts` helpers that read `e.taskId` / `e.inputTokens` / `event=="forge_start"` and get zero rows.
**Why:** Existing dashboard code was written to a hypothetical schema. Real Python emits `task_id`, `input_tokens`, `forge_begin`/`forge_end`. The existing code "works" only because every path also falls back to 0.
**How to avoid:** New aggregator `cae-metrics-state.ts` reads REAL schema. Add a shared type `type CbEvent = { ts: string; event: string; task_id?: string; ... }` exported from `lib/cae-types.ts`. Consider a follow-up refactor (deferred) to fix `cae-agents-state.ts` + `cae-home-state.ts`.
**Warning signs:** Metrics render empty on a project that clearly has .jsonl activity.

### Pitfall 3: Recharts + React 19 peer warning
**What goes wrong:** `pnpm add recharts` → warns about `react-is` peer range.
**How to avoid:** Add to package.json:
```json
"pnpm": { "overrides": { "react-is": "^19.2.4" } }
```
[CITED: shadcn ui.com/docs/react-19 + recharts issue #4558]

### Pitfall 4: SSR pre-render of recharts
**What goes wrong:** `/metrics/page.tsx` is a server component by default; direct recharts import → hydration mismatch or build error.
**How to avoid:** Every recharts-using component has `"use client"` at top. If that causes flash-of-empty-chart, use Next.js `dynamic(import, { ssr: false })`. Prefer the former (simpler, matches Monaco pattern in `components/workflows/monaco-yaml-editor.tsx`).

### Pitfall 5: React 19 Compiler + recharts interaction
**What goes wrong:** React Compiler aggressive memoization may freeze chart data references; recharts internally mutates. 
**How to avoid:** Phase 7 opt-out if issues surface: wrap chart data in `useMemo` explicitly; if still broken, mark panel files with `// @react-compiler-disabled`. Low risk — will discover at dev time.

### Pitfall 6: Polling cost vs freshness
**What goes wrong:** Panel re-fetches every 3s like `/api/state`, recharts recomputes scales, page feels heavy on idle tab.
**How to avoid:** 30s polling for `/api/metrics` (metrics change slowly). Use `document.visibilityState === "visible"` guard — pause when tab hidden. Separate provider from `StatePollProvider`.

### Pitfall 7: Top-bar cost ticker still goes through `/api/state`
**What goes wrong:** `components/shell/cost-ticker.tsx:29` reads `data.breakers.inputTokensToday` from state poll. Current value is ALWAYS 0 for the reasons in Pitfall 2. Shipping Phase 7 without fixing this makes the ticker lie twice (wrong field names + no data source).
**How to avoid:** Wave 0 task fixes `/api/state` to read snake_case `input_tokens`/`output_tokens` from real schema, OR have cost-ticker read from new `/api/metrics` instead (cleaner split: ticker and page share aggregator). Planner decides.

### Pitfall 8: `$` appearing in copy
**What goes wrong:** Founder-speak copy includes "$ saved" or "subscription covers it, $0 per call" — violates UI-SPEC §S4.2 tokens-only lock.
**How to avoid:** Add a lint-time grep guard in verification script:
```bash
grep -rn '\$' app/metrics components/metrics lib/copy/labels.ts && exit 1
```
Only allowed `$` is in template expressions like `${var}` in actual TS code — scope grep to strings + MD comments.

## Runtime State Inventory

Not applicable — Phase 7 is greenfield route code. No rename/refactor.

## Code Examples

### Example 1: Recharts stacked bar
```tsx
// Source: CITED recharts/recharts v3 docs + shadcn-chart pattern
"use client"
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { AGENT_META } from "@/lib/copy/agent-meta"

export function AgentStackedBar({ data }: { data: MetricsState["spending"]["by_agent_30d"] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
        <YAxis stroke="var(--text-muted)" fontSize={11} />
        <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)" }} />
        <Legend />
        {Object.entries(AGENT_META).map(([name, meta]) => (
          <Bar key={name} dataKey={name} stackId="a" fill={meta.color} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
```

### Example 2: base-ui Meter gauge
```tsx
// Source: CITED base-ui.com/react/components/meter
"use client"
import { Meter } from "@base-ui/react/meter"

export function SuccessGauge({ rate, label }: { rate: number; label: string }) {
  return (
    <Meter.Root value={rate * 100} className="flex flex-col gap-1">
      <Meter.Label className="text-xs text-[color:var(--text-muted)]">{label}</Meter.Label>
      <Meter.Track className="h-2 w-full rounded bg-[color:var(--surface-hover)]">
        <Meter.Indicator
          className="h-full rounded"
          style={{ background: rate >= 0.85 ? "var(--success)" : rate >= 0.7 ? "var(--warning)" : "var(--danger)" }}
        />
      </Meter.Track>
      <Meter.Value className="text-xs font-mono">{Math.round(rate * 100)}%</Meter.Value>
    </Meter.Root>
  )
}
```

### Example 3: Retry heatmap (hand-rolled div grid)
```tsx
// No recharts needed — 7×24 static grid.
export function RetryHeatmap({ cells }: { cells: Array<{ dow: number; hour: number; count: number }> }) {
  const max = Math.max(1, ...cells.map(c => c.count))
  const map = new Map(cells.map(c => [`${c.dow}-${c.hour}`, c.count]))
  return (
    <div className="grid grid-cols-[24px_repeat(24,1fr)] gap-px text-[10px] font-mono">
      <div />{Array.from({length:24}).map((_,h)=><div key={h} className="text-center text-[color:var(--text-dim)]">{h}</div>)}
      {["S","M","T","W","T","F","S"].map((d,dow)=>(<>
        <div className="text-[color:var(--text-dim)]">{d}</div>
        {Array.from({length:24}).map((_,h)=>{
          const n = map.get(`${dow}-${h}`) ?? 0
          const alpha = n === 0 ? 0 : (0.15 + (n/max)*0.85)
          return <div key={h} title={`${n} retries`} style={{background:`rgba(239,68,68,${alpha})`}} className="h-4 rounded-sm" />
        })}
      </>))}
    </div>
  )
}
```

## Founder-Speak Copy Keys (to add to `lib/copy/labels.ts`)

```ts
// Append to Labels interface + FOUNDER/DEV objects.
// Founder / Dev:
metricsPageHeading:         "How CAE is doing"                   / "Metrics"
metricsSpendingHeading:     "Spending"                           / "Cost"
metricsSpendingTodayLabel:  "Today"                              / "Tokens today"
metricsSpendingMtdLabel:    "This month so far"                  / "MTD tokens"
metricsSpendingProjected:   "Month projected"                    / "Projected MTD"
metricsSpendingDisclaimer:  "Estimated from local logs. OAuth subscription covers the bill." / "est. — from .cae/metrics/"
metricsWellHeading:         "How well it's going"                / "Reliability"
metricsWellLede:            (r) => `CAE is getting things right ${Math.round(r*100)}% of the time this week.` / `7d success rate: ${(r*100).toFixed(1)}%`
metricsFastHeading:         "How fast"                           / "Speed"
metricsFastLede:            (p50) => `Most jobs finish in about ${formatDur(p50)}.` / `P50 wall: ${p50}ms`
metricsTopTasksHeading:     "Most expensive jobs"                / "Top 10 by tokens"
metricsHaltsHeading:        "When CAE paused itself"             / "Halt events"
metricsSentinelRejectsHeading: "Times the checker pushed back"   / "Sentinel reject trend"
metricsRetryHeatmapHeading: "When retries happen"                / "Retry heatmap (DoW × hour)"
metricsQueueDepthHeading:   "Backlog right now"                  / "Queue depth"
metricsTimeToMergeHeading:  "How long jobs take to ship"         / "Time-to-merge distribution"
```

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pnpm / npm | install recharts | ✓ (project uses pnpm) | — | npm install works too |
| `.cae/metrics/circuit-breakers.jsonl` | all panels | ✓ (30 rows in dev dashboard repo) | — | empty arrays in aggregator, panels show empty-state |
| `.cae/metrics/sentinel.jsonl` | How-well Sentinel trend | ✓ (10 rows) | — | empty trend |
| `.cae/metrics/tokens.jsonl` OR token fields in CB jsonl | Spending numbers | ✗ — producer not wired | — | Render "0 tok — wiring pending" until Wave 0 adapter patch lands |
| `.cae/inbox`, `.cae/outbox` | queue depth + time-to-merge | ✓ (`lib/cae-state.ts:92,115` already reads them) | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** token events (see Pitfall 1).

## Validation Architecture

`.planning/config.json` should be consulted by planner; based on ROADMAP/STATE there is no explicit nyquist_validation setting — assume enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No global test runner yet — Phase 5/6 committed `.test.ts` files colocated (e.g. `lib/cae-queue-state.test.ts`, `components/workflows/step-graph.test.tsx`). Resolver inferred to be `vitest` based on `*.test.ts` convention + React 19, but NOT wired in `package.json` scripts. **Wave 0 gap.** |
| Config file | none — needs `vitest.config.ts` |
| Quick run command | `pnpm vitest run lib/cae-metrics-state.test.ts` |
| Full suite command | `pnpm vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-7-SPEND | aggregator sums today's tokens correctly across projects | unit | `pnpm vitest run lib/cae-metrics-state.test.ts -t "sums tokens today"` | ❌ Wave 0 |
| REQ-7-SPEND | projected monthly = MTD × (daysInMonth/daysElapsed) | unit | same file, -t "projection math" | ❌ Wave 0 |
| REQ-7-WELL | per-agent success rate excludes agents with <5 samples | unit | -t "min-sample guard" | ❌ Wave 0 |
| REQ-7-WELL | halt events are ordered newest-first | unit | -t "halt ordering" | ❌ Wave 0 |
| REQ-7-FAST | P95 computed via linear interpolation matches numpy reference | unit | -t "p95" | ❌ Wave 0 |
| REQ-7-FOUNDER | no `$` appears in rendered founder-speak copy | grep-lint | `grep -rn '\\$' app/metrics components/metrics \| grep -v '\\${' && exit 1 \|\| exit 0` | ❌ Wave 0 (lint script) |

### Sampling Rate
- **Per task commit:** `pnpm vitest run lib/cae-metrics-state.test.ts` (< 5s).
- **Per wave merge:** `pnpm vitest run && pnpm lint && pnpm build`.
- **Phase gate:** full suite green + manual `/metrics` walkthrough with empty + populated fixtures.

### Wave 0 Gaps
- [ ] Wire `vitest` in package.json + add `vitest.config.ts` (or confirm existing test runner — inspect CI if any).
- [ ] `lib/cae-metrics-state.test.ts` — pure function tests with fixture jsonl.
- [ ] `scripts/lint-no-dollar.sh` — USD guard.
- [ ] Fixture files `tests/fixtures/metrics/{cb,sentinel,compaction}.jsonl` with deterministic rows.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Project already uses vitest convention (inferred from `*.test.ts` files) | Validation | Medium — planner may need to add test runner itself if jest/other |
| A2 | Adapter patch to emit token events is in-scope for Phase 7 Wave 0 (affects `bin/` Python + `adapters/*.sh`, outside dashboard dir) | Pitfall 1 | High — if out of scope, Spending panel ships empty and needs a follow-up phase |
| A3 | `.cae/inbox` task creation time = `stat.birthtime` (per `cae-state.ts:101`) is accurate enough for time-to-merge | Data Source Map | Low — if wrong, histogram skews, doesn't break UI |
| A4 | Recharts v3 uses React 19 cleanly when react-is is overridden | Stack | Low — verified via 2 web sources, will confirm at install |
| A5 | base-ui `Meter` is stable in 1.4.0 (we have it installed) | Stack | Low — docs confirm 1.0 stable since 2025-12 |

## Open Questions

1. **Should Phase 7 scope include patching `bin/circuit_breakers.py` + `adapters/claude-code.sh` to actually emit token counts, or is that a separate phase?**
   - What we know: Python API exists; shell adapter doesn't use it; dashboard consumes a schema that doesn't exist.
   - Recommendation: Include as Wave 0 in Phase 7 — otherwise Spending panel is vapor.

2. **Fix existing field-name bugs in `cae-home-state.ts` / `cae-agents-state.ts` / `/api/state/route.ts` now, or leave them and just do Phase 7 code correctly?**
   - Recommendation: Leave them for a follow-up hygiene phase; note in RESEARCH that the top-bar cost ticker will remain broken until that happens OR Phase 7 explicitly replaces `cost-ticker.tsx`'s data source.

3. **Multi-project: single-project scope for v0.1, OR aggregate across all from `listProjects()`?**
   - Recommendation: Aggregate (mirrors Phase 5 `cae-agents-state.ts`). Low cost.

## GOTCHAS to Honor (PLANNER MUST READ)

1. Real jsonl schema is `{ts, event, task_id, ...}` snake_case — NOT the camelCase shape assumed elsewhere.
2. Events are `forge_begin/forge_end` (with `success:bool`) — NOT `forge_start/forge_done/forge_fail`.
3. `escalate_to_phantom` — NOT `phantom_escalation`.
4. `input_tokens`/`output_tokens` fields DO NOT EXIST in real data yet. Either add a Wave 0 adapter patch or ship panel with zero-state copy.
5. Recharts requires `"use client"` on any component using it; never import into a server component.
6. Recharts v3 + React 19 needs `pnpm.overrides.react-is` set to 19.2.4.
7. base-ui does NOT support `asChild` — use className / `cn(buttonVariants())` per AGENTS.md gotcha `p2-plA-t1-e81f6c`.
8. Founder-speak default ON; copy must never contain `$`. Enforce with lint step.
9. Separate polling context (`useMetricsPoll`) — don't piggyback on 3s `useStatePoll`.
10. Reuse existing `Sparkline` primitive for the 30d line — don't pull in recharts for that.
11. Page shell = server component (redirect + session check); panels = client islands.
12. DevMode copy keys exist — every new `metricsXxx` label needs BOTH founder and dev variants.
13. Cost ticker in top bar (`components/shell/cost-ticker.tsx`) currently reads broken fields — decide whether Phase 7 also fixes it or ignores.

## State of the Art

| Old | Current | When | Impact |
|-----|---------|------|--------|
| recharts 2.x | recharts 3.8.1 | 2026-03-25 | React 19 support; migration guide exists; stackId/Tooltip APIs stable |
| Radix UI primitives (shadcn old path) | base-ui 1.x | 2025-12 stable | No `asChild`; compound-component pattern; Meter primitive native |

## Sources

### Primary (HIGH)
- `/home/cae/ctrl-alt-elite/bin/circuit_breakers.py` (L108 `_log`, L136 `record_tokens`) — ground truth for event schema.
- `/home/cae/ctrl-alt-elite/bin/sentinel.py` (L50 `_log`) — sentinel event schema.
- `/home/cae/ctrl-alt-elite/bin/compactor.py` (L72) — compaction events.
- `/home/cae/ctrl-alt-elite/bin/telegram_gate.py` (L63) — approvals events.
- `/home/cae/ctrl-alt-elite/dashboard/.cae/metrics/*.jsonl` — 49 real rows confirming schema.
- `/home/cae/ctrl-alt-elite/dashboard/lib/cae-agents-state.ts` — Phase 5 aggregator pattern to mirror.
- `/home/cae/ctrl-alt-elite/dashboard/lib/cae-state.ts` (L161 `tailJsonl`) — existing helper.
- `/home/cae/ctrl-alt-elite/dashboard/lib/hooks/use-state-poll.tsx` — provider pattern.
- `/home/cae/ctrl-alt-elite/dashboard/components/ui/sparkline.tsx` — reuse primitive.
- `/home/cae/ctrl-alt-elite/dashboard/components/shell/cost-ticker.tsx` (L29) — currently-broken top-bar ticker.
- `/home/cae/ctrl-alt-elite/dashboard/docs/UI-SPEC.md` §8 + §S4.2 + §Audience reframe.
- `/home/cae/ctrl-alt-elite/dashboard/AGENTS.md` — gotchas (base-ui `asChild`, poll cadence).

### Secondary (MEDIUM)
- base-ui.com/react/components/meter — Meter primitive API (WebSearch 2026-04-22).
- github.com/recharts/recharts/releases — v3.8.1 release 2026-03-25 (WebSearch 2026-04-22).
- github.com/recharts/recharts/issues/4558 — React 19 support thread (WebSearch).
- ui.shadcn.com/docs/react-19 — react-is peer override pattern.

### Tertiary (LOW)
- None — all critical claims cross-verified against source.

## Metadata

**Confidence breakdown:**
- Data schema + source files: HIGH — grepped + sampled real jsonl.
- Chart library recommendation: MEDIUM — confirmed React 19 compat via web, but bundle-size not measured; planner should check via `pnpm add && pnpm build` in Wave 1.
- Token-gap diagnosis: HIGH — confirmed by `grep -c input_tokens *.jsonl` returning 0.
- Founder-speak keys: MEDIUM — derived from §Audience reframe table + labels.ts pattern; may need copywriting polish.
- Validation architecture: MEDIUM — vitest assumed, not verified in package.json scripts. Wave 0 decision.

**Research date:** 2026-04-22
**Valid until:** 2026-05-22 (30 days — recharts is stable; jsonl schema only drifts when Python producers change).
