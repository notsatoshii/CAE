# Phase 7: Metrics — Context (locked decisions)

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Source:** UI-SPEC.md §8 Metrics + §Audience reframe + 07-RESEARCH.md + session-4 lock-ins
**Primary users:** non-dev founders (Explain-mode default ON, Dev-mode opt-in ⌘Shift+D)

## Phase Boundary

Ship `/metrics` as a single page with 3 panels (Spending / How well it's going / How fast) sourced from a new `/api/metrics` aggregator that reads the REAL `.cae/metrics/*.jsonl` schema (snake_case + `forge_begin`/`forge_end`/`escalate_to_phantom`). Two critical upstream fixes ship in Wave 0 before panel work begins.

**In scope (Phase 7):**
- Wave 0: adapter token-plumbing fix (cross-subtree — touches `/home/cae/ctrl-alt-elite/adapters/claude-code.sh` + `bin/circuit_breakers.py` usage) + Phase 4 aggregator schema-drift repair + cost-ticker repoint.
- Wave 1: `/api/metrics` route, `lib/cae-metrics-state.ts` aggregator, `useMetricsPoll` 30s hook, recharts@3.8.1 install, labels.ts `metrics.*` keys.
- Wave 2: three panel components (spending / reliability / speed) as parallel client islands.
- Wave 3: `/metrics/page.tsx` shell composing the panels + Explain-mode tooltips.
- Wave 4: 07-VERIFICATION.md + human UAT checkpoint.

**Out of scope (explicit):**
- Memory tab (Phase 8)
- Changes tab / chat rail (Phase 9)
- Plan mode routes (Phase 10)
- USD conversion anywhere
- Historical data beyond 30d
- Cost alerts / anomaly detection
- Multi-project drill-down UI (data IS multi-project-aggregated; no per-project filter UI)

---

## Locked Decisions (non-negotiable; cite by D-XX in tasks)

### D-01 — Wave 0 includes cross-subtree adapter token-plumbing fix
The Python `CircuitBreakers.record_tokens(task_id, input_tokens, output_tokens)` API at `bin/circuit_breakers.py:136` exists but is NOT called from `adapters/claude-code.sh`. Spending panel numbers are always 0 until this is wired. Phase 7 Wave 0 patches the adapter to extract token counts from Claude CLI output and emit `token_usage` events into `.cae/metrics/circuit-breakers.jsonl` (same file as the other breaker events — simpler than a new file).

**Scope note — cross-subtree:** `adapters/claude-code.sh` lives at `/home/cae/ctrl-alt-elite/adapters/`, OUTSIDE the `dashboard/` subtree. The commit from this phase WILL touch files via relative paths (`../adapters/claude-code.sh`). Flag this explicitly in the plan file's `files_modified` list.

### D-02 — Phase 4 aggregator schema-drift fix is part of Wave 0
The real JSONL schema uses `ts` (not `timestamp`), `task_id` (not `taskId`), `input_tokens` / `output_tokens` (not `inputTokens` / `outputTokens`), and events `forge_begin` / `forge_end` (with `success: bool`) + `escalate_to_phantom` — NOT `forge_start` / `forge_done` / `forge_fail` / `phantom_escalation`.

Four files currently read the hallucinated camelCase schema and silently return zero for everything:
- `dashboard/lib/cae-home-state.ts`
- `dashboard/lib/cae-agents-state.ts`
- `dashboard/app/api/state/route.ts`
- `dashboard/components/shell/cost-ticker.tsx` (consumer of the broken fields)

Wave 0 MUST repoint all four to the real schema. A new shared event-type `CbEvent` MUST be exported from `lib/cae-types.ts` and consumed by all aggregators (single source of truth).

### D-03 — Multi-project aggregation
`/api/metrics` aggregator mirrors the Phase 5 `cae-agents-state.ts` pattern: call `listProjects()` and walk each project's `.cae/metrics/circuit-breakers.jsonl` + `.cae/metrics/sentinel.jsonl`. Return aggregated multi-project stats; NO per-project filter UI in v0.1.

### D-04 — Chart library locked: recharts@3.8.1
- Stacked bar (by-agent 30d) → recharts `<BarChart><Bar stackId />`
- 30d line (daily tokens) → reuse existing `components/ui/sparkline.tsx` primitive (NOT recharts — matches Phase 5 hand-roll).
- Time-to-merge histogram → recharts `<BarChart>` with pre-binned data.
- Per-agent success gauge → `@base-ui/react` `Meter` primitive (already installed).
- Retry heatmap → plain Tailwind `<div>` grid (7×24 = 168 divs; no library).
- Sentinel reject trend → reuse `Sparkline`.

**Install:** `pnpm add recharts@3.8.1`. Add `pnpm.overrides.react-is: "19.2.4"` to `package.json` to suppress React 19 peer warning.

### D-05 — New API route + aggregator
- New route: `dashboard/app/api/metrics/route.ts` (force-dynamic, JSON response).
- New aggregator: `dashboard/lib/cae-metrics-state.ts` exporting `getMetricsState()` returning `MetricsState` (typed per D-10).
- Separate from `/api/state` — different cadence, different fields, independent cache.

### D-06 — Polling cadence: 30s
- New hook: `dashboard/lib/hooks/use-metrics-poll.tsx` — provider + `useMetricsPoll()` consumer.
- 30s interval (NOT piggy-backed on 3s `useStatePoll`).
- `document.visibilityState === "visible"` guard — pause when tab hidden.
- Process-level cache TTL in aggregator = 30 000 ms (mirrors Phase 5 pattern).

### D-07 — COST IS TOKENS ONLY (grep-guarded)
Zero `$` sign anywhere in:
- `app/metrics/**`
- `components/metrics/**`
- The `metrics.*` keys added to `lib/copy/labels.ts`

Enforcement: a lint script `dashboard/scripts/lint-no-dollar.sh` runs in Wave 4 verification. It greps for `\$` excluding template-literal expressions (`${`) and exits 1 on hit. The `"est."` disclaimer is about token-count-to-cost estimation, NOT currency — copy it exactly as UI-SPEC §8 specifies.

### D-08 — Founder-speak copy default ON with dev-mode flip
New `metrics.*` keys added to BOTH `FOUNDER` and `DEV` objects in `lib/copy/labels.ts` — NOT a separate namespace. `labelFor(dev)` returns the merged shape. Copy values sourced verbatim from 07-RESEARCH.md §Founder-Speak Copy Keys. Both branches MUST exist (enforced by the TypeScript `Labels` interface).

### D-09 — Page structure: server shell + client islands
- `app/metrics/page.tsx` = server component (session check via `await auth()` + redirect to `/signin`, mirror pattern of existing `app/metrics/page.tsx` stub).
- All three panels under `components/metrics/*.tsx` carry `"use client"` at top.
- Recharts-using components MAY additionally use `dynamic(() => import(...), { ssr: false })` IF hydration mismatches appear at dev time; default to `"use client"` only (simpler, matches Monaco pattern in `components/workflows/monaco-yaml-editor.tsx`).

### D-10 — MetricsState shape (locked)
```ts
// In lib/cae-metrics-state.ts
export interface MetricsState {
  generated_at: string;  // ISO8601
  spending: {
    tokens_today: number;
    tokens_mtd: number;
    tokens_projected_monthly: number;
    by_agent_30d: Array<{ date: string; [agentName: string]: number | string }>;
    daily_30d: Array<{ date: string; tokens: number }>;
    top_expensive: Array<{ task_id: string; title: string; tokens: number; agent: string; ts: string }>;
  };
  reliability: {
    per_agent_7d: Array<{ agent: string; success_rate: number; sample_n: number }>;
    retry_heatmap: Array<{ dow: number; hour: number; count: number }>;
    halt_events: Array<{ ts: string; reason: string; task_id?: string }>;
    sentinel_rejects_30d: Array<{ date: string; rejects: number; approvals: number }>;
  };
  speed: {
    per_agent_wall: Array<{ agent: string; p50_ms: number; p95_ms: number; n: number }>;
    queue_depth_now: number;
    time_to_merge_bins: Array<{ bin_label: string; count: number }>;
  };
}
```

### D-11 — Explain-mode default ON for metric tooltips
Each panel has per-metric "?" buttons that render an Explain tooltip (e.g. "P95 = 95% of tasks finish faster than this"). They consume `useExplainMode()` from Phase 3 providers. No new provider. Tooltips use base-ui `<Popover>` primitive (already in deps).

### D-12 — Zero scope creep
Phase 7 MUST NOT touch:
- Memory tab / `/memory` route (Phase 8)
- Changes tab / chat rail (Phase 9)
- Plan mode routes `/plan/*` (Phase 10)
- Workflow files `/build/workflows/*`

Only `/metrics` + `/api/metrics` + its data layer + Wave 0 upstream fixes listed above.

---

## Requirements (maps to ROADMAP Phase 7 + REQ IDs from RESEARCH.md)

| ID | Description | Implemented By |
|----|-------------|----------------|
| `REQ-7-SPEND` | Spending panel: today + MTD + projected; stacked bar by agent; 30d line; top-10 expensive tasks; "est." disclaimer | Wave 1 aggregator + Wave 2 spending panel |
| `REQ-7-WELL` | Reliability: per-agent gauges + retry heatmap + halt log + Sentinel reject trend | Wave 1 aggregator + Wave 2 reliability panel |
| `REQ-7-FAST` | Speed: P50/P95 wall + queue depth + time-to-merge distribution | Wave 1 aggregator + Wave 2 speed panel |
| `REQ-7-FOUNDER` | Founder-speak copy ("CAE is getting things right 94% of the time this week") | Wave 1 labels.ts extension + Wave 3 page shell |
| `REQ-7-W0-ADAPTER` | Adapter emits token events to circuit-breakers.jsonl | Wave 0 task (cross-subtree) |
| `REQ-7-W0-SCHEMA` | Existing aggregators read real snake_case + real event names | Wave 0 task (dashboard-local) |
| `REQ-7-W0-TICKER` | Top-bar cost ticker shows non-zero tokens with real data | Wave 0 consequence of above |

---

## Decision Coverage Matrix

| D-XX | Plan | Task | Full/Partial |
|------|------|------|--------------|
| D-01 (adapter plumbing) | 07-01 | 1 | Full |
| D-02 (schema-drift fix) | 07-01 | 2, 3 | Full |
| D-03 (multi-project) | 07-02 | 1 | Full |
| D-04 (recharts 3.8.1) | 07-02 | 3 | Full |
| D-05 (api + aggregator) | 07-02 | 1, 2 | Full |
| D-06 (30s polling) | 07-02 | 4 | Full |
| D-07 (no-$ guard) | 07-02, 07-06 | labels in 02; lint in 06 | Full |
| D-08 (founder-speak) | 07-02 | 5 | Full |
| D-09 (server shell + client islands) | 07-05 | 1 | Full |
| D-10 (MetricsState shape) | 07-02 | 1, 2 | Full |
| D-11 (explain-mode tooltips) | 07-05 | 2 | Full |
| D-12 (scope creep fence) | 07-06 | 1 (lint script) | Full |

Every D-XX is covered in full — no partials, no splits required.

---

## Gotchas Carried from 07-RESEARCH.md (planner MUST honor)

1. Real jsonl is snake_case: `ts`, `task_id`, `input_tokens`, `output_tokens` — NEVER camelCase.
2. Events are `forge_begin` / `forge_end` (with `success: bool`) — NEVER `forge_start` / `forge_done` / `forge_fail`.
3. `escalate_to_phantom` — NEVER `phantom_escalation`.
4. Recharts v3 needs `"use client"`; never import into a server component.
5. Recharts + React 19 requires `pnpm.overrides.react-is = "19.2.4"`.
6. base-ui does NOT support `asChild` (AGENTS.md `p2-plA-t1-e81f6c`) — use `className` or `cn()`.
7. Copy default = founder-speak; dev-mode flips.
8. NO `$` in metrics copy or components — enforced by lint script.
9. Separate polling context `useMetricsPoll`; don't piggy-back on 3s `useStatePoll`.
10. Reuse `<Sparkline>` for 30d line; don't pull in recharts for it.
11. Page shell = server component; panels = `"use client"` islands.
12. Every new `metricsXxx` label needs BOTH founder and dev variants.
13. Project-level cache TTL in aggregator = 30 000 ms.

---

## Wave Plan

| Wave | Plans | Autonomous | Purpose |
|------|-------|-----------|---------|
| 0 | 07-01 | yes | Upstream plumbing (adapter + schema drift + ticker repoint) — unblocks Wave 1 |
| 1 | 07-02 | yes | Data layer: aggregator + api + hook + recharts install + labels |
| 2 | 07-03, 07-04 (parallel), 07-05 sequential with 07-06 | yes | Panels (2 parallel plans + page shell sequentially, see note) |
| 3 | 07-05 | yes | Page shell composes panels |
| 4 | 07-06 | no | Verification + human sign-off |

**Parallelism note:** Wave 2 has THREE panels but to keep the "≥2 parallel plans in Wave 2" rule with zero files_modified overlap, plans 07-03 and 07-04 each ship TWO panels' components in disjoint directories (e.g. spending+speed in one plan, reliability in another) OR each ships one panel with the third folded into the page shell plan. Final split: 07-03 ships Spending panel + its sub-charts; 07-04 ships Reliability + Speed panels + their sub-charts. No file overlap. Page shell plan 07-05 composes all three.
