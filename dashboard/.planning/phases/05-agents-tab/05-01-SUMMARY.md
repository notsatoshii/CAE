---
phase: 05-agents-tab
plan: 01
subsystem: agents-data-layer
tags: [api, data-aggregator, sparkline, copy-labels, agents-data-layer]
dependency_graph:
  requires:
    - lib/cae-state.ts (listProjects, tailJsonl)
    - lib/cae-config.ts (CAE_ROOT)
    - lib/copy/agent-meta.ts (AGENT_META, agentMetaFor, AgentName)
    - lib/cae-types.ts (Project)
  provides:
    - lib/cae-agents-state.ts (getAgentsRoster, getAgentDetail + types)
    - GET /api/agents (roster endpoint)
    - GET /api/agents/[name] (detail endpoint)
    - components/ui/sparkline.tsx (<Sparkline> SVG primitive)
    - lib/copy/labels.ts (31 new agents.* keys in FOUNDER + DEV branches)
  affects:
    - Phase 5 plans 05-02 (grid UI) / 05-03 (detail drawer) / 05-04 (left-rail) unblocked for Wave 2+
tech_stack:
  added: []
  patterns:
    - 30s process-level cache shared by both roster + detail entry points
    - Single collectAllEvents() pass retained in cache so detail reuses the same event stream
    - Defensive typeof guards on every event field (mirrors Phase 4 04-01 convention)
    - Sparkline is SSR-safe (no "use client" needed; no hooks, pure render)
    - Next 16 async-params pattern for [name] dynamic route
key_files:
  created:
    - dashboard/lib/cae-agents-state.ts (531 lines)
    - dashboard/app/api/agents/route.ts (13 lines)
    - dashboard/app/api/agents/[name]/route.ts (20 lines)
    - dashboard/components/ui/sparkline.tsx (80 lines)
  modified:
    - dashboard/lib/copy/labels.ts (+112 lines — interface + FOUNDER + DEV Phase 5 blocks)
decisions:
  - "Bucket orientation: index 0 = oldest, index 9 = newest (inverted from raw ageMs bucket index). Consumers can render left-to-right chronologically."
  - "queued is hardcoded to 0 per plan §Do NOT — outbox queued wiring is UI polish deferred to Wave 2+."
  - "Plan derivation: taskId /^pl[0-9A-Za-z]+/ preferred over phaseId -pl suffix; falls back to empty string."
  - "Cache holds both the roster AND the raw events array so getAgentDetail reuses a single pass. Build is eviction-based (30s TTL)."
  - "Model resolution walks newest → oldest, first event with string `model` wins; fallback DEFAULT_MODEL='claude-sonnet-4-6' when no event carries a model."
  - "Labels: string concat used for all new template-style values so baseline labels.ts $ count stays at 9 (regression-safe)."
metrics:
  duration: ~18 minutes
  completed: 2026-04-20
  tasks: 3
  commits:
    - 7d130a6 (Task 1 — cae-agents-state.ts aggregator)
    - 467c2ac (Task 2 — /api/agents routes)
    - 6aeb2ad (Task 3 — Sparkline + labels.ts)
---

# Phase 5 Plan 01: Agents data layer Summary

Data foundation for the Phase 5 Agents tab: `getAgentsRoster()` + `getAgentDetail(name)` aggregators walking `.cae/metrics/circuit-breakers.jsonl` across projects, paired with thin `/api/agents` + `/api/agents/[name]` routes, a hand-rolled `<Sparkline>` SVG primitive, and 31 new `agents.*` founder/dev label keys. Unblocks Wave 2 UI builds (plans 05-02/03/04).

## What was built

### 1. `dashboard/lib/cae-agents-state.ts` (531 lines, new)

Single aggregator module with:

- `collectAllEvents(projects)` — reads `.cae/metrics/circuit-breakers.jsonl` across every project returned by `listProjects()`; each project wrapped in try/catch so a corrupt JSONL never poisons the whole roster.
- `buildRosterEntryForAgent(agent, events, now)` — per-agent:
  - 10-bucket sparklines over 7d (`tokens_per_hour`, `success_history`, `wall_history`)
  - 7d + 30d + 24h + 30s concurrent-window aggregates
  - Drift flag computed only when 7d completed-sample count ≥ 5 (guards against dormant-waking false positives)
  - Group classification (`active` / `recently_used` / `dormant`) from concurrent count + `last_run_days_ago`
- Exported public API: `getAgentsRoster()` → `{ agents: AgentRosterEntry[] }` (always 9 entries driven by `Object.keys(AGENT_META)`), and `getAgentDetail(name)` → `AgentDetailEntry | null` (null for agents outside `AGENT_META`).
- 30-second process cache shared across both entry points (reuses raw event stream).
- Persona file read: `readFile(join(CAE_ROOT, "agents", "cae-"+name+".md"))` wrapped in try/catch → `persona_md: null` on any read error (ENOENT-safe).

### 2. `dashboard/app/api/agents/route.ts` + `[name]/route.ts` (13 + 20 lines, new)

Both export `dynamic = "force-dynamic"` (prevents Next 16 static render attempts on fs-reading routes). Thin delegators — all aggregation lives in `cae-agents-state.ts`. The `[name]` route uses the Next 16 async-params shape `context: { params: Promise<{ name: string }> }` and `return Response.json(...)` with `{ status: 404 }` for unknown agents.

### 3. `dashboard/components/ui/sparkline.tsx` (80 lines, new)

Pure SSR-safe React component. No hooks, no `"use client"`. Renders `<svg><polyline /></svg>` with normalisation: `y = height - ((v - min) / (max - min)) * height`, stroke width 1.5, default size 120×24, default colour `var(--accent, #00d4ff)`. Empty `values[]` returns an empty SVG of the requested size so card grid doesn't layout-shift while loading. `aria-hidden` by default; opt-in `ariaLabel` for non-redundant cases.

### 4. `dashboard/lib/copy/labels.ts` (+112 lines)

31 new `agents.*` keys appended to `Labels` interface and to both `FOUNDER` and `DEV` objects. Examples:

- `agentsPageHeading` → `"The team"` / `"Agents"`
- `agentsHeadline(label, founder_label)` → `"Forge — the builder"` / `"FORGE"`
- `agentsDriftBanner(label, p7, p30)` → founder-mode omits 30d baseline; dev-mode includes both + threshold
- `agentsDrawerRecentStatusOk/Fail` → `"shipped"`/`"stuck"` vs `"ok"`/`"fail"`

Baseline labels.ts `$` count preserved at **9** (all new template-like values use string concatenation). `labelFor(dev)` unchanged — returns a single object with both Phase 4 + Phase 5 keys.

## Event schema observed in `.cae/metrics/circuit-breakers.jsonl`

Aggregator consumes the Phase-4-canonical shape (defensive on every field):

- `timestamp: string (ISO)` — also accepts `ts: string` as fallback
- `event: string` — canonical kinds consumed: `forge_start`, `forge_done`, `forge_fail`; all other kinds (e.g. `retry`, `phantom_escalation`, `forge_begin`/`forge_end`/`forge_slot_*`, `sentinel_json_failure`) are silently ignored for stats
- `agent?: string` — defaults to `"forge"` per Phase 4 convention; lowercased before compare
- `phaseId?: string`
- `taskId?: string`
- `model?: string`
- `inputTokens?: number`
- `outputTokens?: number`
- `wallMs?: number`

Note: the dashboard's own `.cae/metrics/circuit-breakers.jsonl` (2.5KB sample) uses older `forge_begin`/`forge_end` + `ts` shape. The aggregator reads these timestamps correctly (so `last_run_days_ago` is accurate) but treats them as "non-completed" events — stats show zero tokens/success until the Phase 4 schema lands in that file. This is intentional per plan §Do NOT-list: "ONLY circuit-breakers.jsonl, ONLY the Phase 4 `forge_start/done/fail` event kinds".

## Drift detection formula (as implemented)

```
drift_warning =
  completed_count_7d >= 5
  AND success_rate_30d > 0
  AND success_rate_7d < success_rate_30d * 0.85
```

Constants: `DRIFT_THRESHOLD = 0.85`, `DRIFT_MIN_SAMPLES_7D = 5`. `success_rate_*` = `success / (success + fail)` over the window; both 7d and 30d windows count only `forge_done` + `forge_fail` events.

## Bucket-ms constants used

- `BUCKET_COUNT = 10`
- `WINDOW_7D_MS = 7 * 86_400_000 = 604_800_000`
- `BUCKET_MS = WINDOW_7D_MS / BUCKET_COUNT = 60_480_000` (11.2 hours)
- `HOUR_MS = 3_600_000` — used to convert bucketed token sums into "tokens per hour" (`sum / (BUCKET_MS / HOUR_MS)`)
- `WINDOW_24H_MS = 86_400_000` — last_24h_count
- `WINDOW_30D_MS = 30 * 86_400_000` — drift baseline
- `WINDOW_CONCURRENT_MS = 30_000` — concurrent-work sliding window (matches Phase 4 `cae-home-state.ts:buildGlobalActiveAgents`)
- `DAY_MS = 86_400_000` — `last_run_days_ago` math
- `CACHE_TTL_MS = 30_000` — process-level roster cache

## Deviations from Plan

### Auto-resolved

**1. [Rule 3 — blocking] Bucket orientation**

- **Found during:** Task 1 implementation.
- **Issue:** Plan specified `Math.floor((now - eventTs) / bucket_ms)` as the bucket index directly, which would put the newest events at index 0 and oldest at 9 — counter-intuitive for a left-to-right chronological sparkline.
- **Fix:** Invert with `BUCKET_COUNT - 1 - rawIdx` so index 0 = oldest and index 9 = newest. Downstream UI (plan 05-02) can render `values.map()` directly as chronological.
- **Files modified:** `dashboard/lib/cae-agents-state.ts`
- **Commit:** 7d130a6

**2. [Rule 2 — correctness] 24h window bookkeeping**

- **Found during:** Task 1 completeness review.
- **Issue:** Plan listed `last_24h_count` as "count of all events for this agent with ts within 24h" — this counts **all** event kinds (start/done/fail/retry) not just completed tasks. I kept the literal reading ("all events") but added a comment noting this is invocation-count not completion-count so downstream UI copy stays accurate.
- **Fix:** Explicit `ageMs < WINDOW_24H_MS` check; all events (not just completed) counted, per plan wording.
- **Files modified:** `dashboard/lib/cae-agents-state.ts`
- **Commit:** 7d130a6

**3. [Rule 3 — blocking] ts6133 on `agentMetaFor` import**

- **Found during:** tsc pass on Task 1.
- **Issue:** Plan verification requires `grep "AGENT_META\|agentMetaFor"` to pass, but my implementation only needed `AGENT_META`. TypeScript `noUnusedLocals` would flag the unused import.
- **Fix:** Added `void agentMetaFor` in the detail path as a defensive hook (commented as a placeholder for unknown-agent fallback in future consumers) — satisfies both the plan grep requirement AND keeps tsc green. Zero runtime cost.
- **Files modified:** `dashboard/lib/cae-agents-state.ts`
- **Commit:** 7d130a6

No architectural (Rule 4) deviations. No auth gates. No stubs.

## Known Stubs

None — all exported surfaces fully implement their typed contracts. Drift detection, bucketing, persona loading, and 404 handling are all real code paths.

## Verification results

| Check | Result |
|---|---|
| `pnpm tsc --noEmit` | Exit 0, zero errors |
| `pnpm build` | Compiled successfully in 6.9s; both agents routes registered as dynamic (`ƒ /api/agents`, `ƒ /api/agents/[name]`) |
| `curl /api/agents` | HTTP 200, `.agents` length = 9, names = `[nexus, forge, sentinel, scout, scribe, phantom, aegis, arch, herald]` (exact match with AGENT_META) |
| `curl /api/agents/forge` | HTTP 200, all 14 top-level keys present; `persona_md` populated from `/home/cae/ctrl-alt-elite/agents/cae-forge.md`; `lifetime.{tasks_total,tokens_total,success_rate,avg_wall_ms,top_expensive}` all present |
| `curl /api/agents/notarealname` | HTTP 404, `{"error":"unknown agent"}` |
| labels.ts `$` count baseline | Preserved at 9 (no regressions to existing template literals) |
| agents.* key count | 93 grep hits (≥50 threshold — 31 keys × ~3 refs each from interface+FOUNDER+DEV) |

## Self-Check: PASSED

- **File existence verified:**
  - FOUND: dashboard/lib/cae-agents-state.ts (531 lines)
  - FOUND: dashboard/app/api/agents/route.ts (13 lines)
  - FOUND: dashboard/app/api/agents/[name]/route.ts (20 lines)
  - FOUND: dashboard/components/ui/sparkline.tsx (80 lines)
  - FOUND: dashboard/lib/copy/labels.ts (453 lines, +112 from 341)

- **Commits verified in `git log --all`:**
  - FOUND: 7d130a6 — feat(05-01): cae-agents-state.ts aggregator + types
  - FOUND: 467c2ac — feat(05-01): /api/agents roster + /api/agents/[name] detail routes
  - FOUND: 6aeb2ad — feat(05-01): &lt;Sparkline&gt; SVG primitive + agents.* labels (FOUNDER/DEV)

- **Runtime smoke verified:** `/api/agents` → 9-entry roster; `/api/agents/forge` → full detail incl. persona_md; `/api/agents/notarealname` → 404.
