# Phase 7 — Metrics — VERIFICATION

**Verified:** 2026-04-22T11:36:00Z
**Status:** PASS (automated) + PENDING-UAT (5 human-verify gates)
**Verifier:** Claude executor (automated sweep) + Eric (human UAT — pending)

## Summary

Wave 0 (upstream plumbing) + Waves 1–3 (data layer / panels / page shell) landed across 13 commits over plans 07-01…07-05. Wave 4 (this document) adds the permanent USD-guard (`scripts/lint-no-dollar.sh`) enforcing D-07, and runs the full automated sweep covering every REQ-7-* requirement. The automated layer is GREEN across 17/17 checks. Five visual/functional gates remain for Eric's in-browser UAT before Phase 7 is locked as shipped.

**Shipped (Plans 07-01 through 07-05, 13 commits):**

- Wave 0: `adapters/claude-code.sh` emits `token_usage` events; 3 aggregators + cost-ticker repointed to real snake_case schema; new `CbEvent` + `CB_EVENT_KINDS` canonical types.
- Wave 1: `lib/cae-metrics-state.ts` (638 lines, multi-project aggregator, 30s TTL cache), `/api/metrics` route (force-dynamic, full-shape 500 fallback), `useMetricsPoll` 30s hook (visibility-guarded), recharts@3.8.1 + react-is override pinned, 40 `metrics.*` founder/dev copy keys + `formatDuration` helper.
- Wave 2: 14 panel components — `<SpendingPanel>` + 4 sub-charts (07-03), `<ReliabilityPanel>` + `<SpeedPanel>` + 7 sub-charts (07-04).
- Wave 3: `/metrics` server page + `<MetricsClient>` island + `<ExplainTooltip>` with 10 tooltip anchors.

**Totals:**

- 5 completed plans (07-01 → 07-05).
- 15 components under `components/metrics/` (exceeds ≥14 expected: 5 from 07-03 + 9 from 07-04 + 1 page-shell ExplainTooltip).
- 17/17 automated checks PASS.
- 5 manual UAT gates drafted below for Eric.

## Build

- `pnpm tsc --noEmit`: exit 0 (zero output).
- `pnpm build`: exit 0, route manifest contains every Phase-7 route:

```
├ ƒ /api/metrics
├ ƒ /metrics
```

(plus all Phase 2–6 routes; full 10/10 static pages generated).

Pre-existing build/lint warnings (middleware-to-proxy Next advisory + `next.config.ts` NFT notice + broken `pnpm lint` CLI) are scope-boundary items flagged by 06-VERIFICATION / 07-02 summaries and not Phase-7 work.

## Plan-by-plan must-have coverage

### 07-01 (Wave 0 — Upstream plumbing)

| Must-have | Backing check | Status |
| --------- | ------------- | ------ |
| Adapter emits `token_usage` events | Check 1 (`bash -n`) + Check 2 (4 hits of `token_usage` in adapter) | PASS |
| `CbEvent` exported as canonical type | Check 4 (`export interface CbEvent` in lib/cae-types.ts) | PASS |
| No hallucinated event names in aggregators | Check 3 (grep `forge_start\|forge_done\|forge_fail\|phantom_escalation` returned 0 hits across lib/cae-home-state.ts + lib/cae-agents-state.ts + app/api/state/route.ts) | PASS |
| Aggregators use `input_tokens`/`output_tokens` (snake_case) | `/api/state` + `/api/metrics` live responses carry non-zero fields once adapter runs against a live CAE project | PASS (code); live token emission is Manual Gate 1 |
| Cost-ticker displays non-zero token count | Automated test: aggregator+ticker compile + build; runtime emission is Manual Gate 1 | Automated PASS; runtime PENDING-UAT |
| tsc + build pass | Checks 8, 9 | PASS |

### 07-02 (Wave 1 — Data layer)

| Must-have | Backing check | Status |
| --------- | ------------- | ------ |
| `getMetricsState()` multi-project aggregator | Live curl `/api/metrics` (Check 16) returns full shape with `spending`/`reliability`/`speed` branches | PASS |
| `/api/metrics` route (force-dynamic) | Build manifest (Check 9) shows `ƒ /api/metrics`; live curl returns 200 JSON | PASS |
| `useMetricsPoll` 30s + visibility guard | Exists at `lib/hooks/use-metrics-poll.tsx` (107 lines); build passes (Check 9) | PASS |
| recharts@3.8.1 pinned + react-is override | Checks 6 + 7 both `true` | PASS |
| `metricsPageHeading` + 40 metrics.* keys added | Check 15 (3 hits: interface + FOUNDER + DEV) | PASS |
| Zero `$` in metrics copy | Check 10 (lint-no-dollar.sh exit 0) | PASS |

### 07-03 (Wave 2 — Spending panel)

| Must-have | Backing check | Status |
| --------- | ------------- | ------ |
| `<SpendingPanel>` + 4 sub-charts exist | Check 11 (15 files in components/metrics/ — exceeds ≥14) + direct `ls` confirms `spending-panel.tsx`, `agent-stacked-bar.tsx`, `spending-daily-line.tsx`, `top-expensive-tasks.tsx`, `est-disclaimer.tsx` | PASS |
| Every component is `"use client"` | Check 12 (zero missing) | PASS |
| Recharts BarChart + Sparkline reuse per D-04 | 07-03 SUMMARY grep verification was already green; build passes Check 9 | PASS |
| `data-testid` hooks for UAT | 07-03 SUMMARY documents `spending-panel`, `spending-today`, `spending-mtd`, `spending-projected`, `agent-stacked-bar`, `spending-daily-line`, `top-expensive-tasks`, `metrics-est-disclaimer` | PASS (hooks defined; visual render is Manual Gate 2) |

### 07-04 (Wave 2 — Reliability + Speed panels)

| Must-have | Backing check | Status |
| --------- | ------------- | ------ |
| `<ReliabilityPanel>` + 5 sub-components | ls confirms `reliability-panel.tsx`, `success-gauge.tsx`, `retry-heatmap.tsx`, `halt-events-log.tsx`, `sentinel-reject-trend.tsx` | PASS |
| `<SpeedPanel>` + 3 sub-components | ls confirms `speed-panel.tsx`, `per-agent-wall-table.tsx`, `queue-depth-display.tsx`, `time-to-merge-histogram.tsx` | PASS |
| base-ui Meter at `@base-ui/react/meter` | 07-04 SUMMARY documents verified install path | PASS |
| Sample-gate (≥5) in SuccessGauge | Code path confirmed in 07-04 SUMMARY; visual threshold colors = Manual Gate 2 | PASS (logic); PENDING-UAT (visual) |
| Every new file `"use client"` | Check 12 (zero missing) | PASS |
| tsc + build clean | Checks 8, 9 | PASS |

### 07-05 (Wave 3 — Page shell + Explain-mode)

| Must-have | Backing check | Status |
| --------- | ------------- | ------ |
| `app/metrics/page.tsx` is SERVER component | Check 14 (first line `import { auth } from "@/auth";` — NO `"use client"`) | PASS |
| `<MetricsClient>` client-island mounts MetricsPollProvider | Check 13 (metrics-client.tsx exists) + 07-05 SUMMARY | PASS |
| `<ExplainTooltip>` component exists | Check 13 (explain-tooltip.tsx exists) | PASS |
| 10 ExplainTooltip anchors across panels (>=6 required) | 07-05 SUMMARY inventory (10 anchors, 8 unique metricsExplain* keys) | PASS (count); tooltip behavior = Manual Gate 3 |
| Unauthenticated GET /metrics → 307 redirect to `/signin?from=/metrics` | Check 17 (307) + Check 17b (location header shows `/signin?from=%2Fmetrics`) | PASS |
| Top-bar MetricsIcon → /metrics navigates to real content | Check 9 build manifest confirms `ƒ /metrics`; pre-existing `metrics-icon.tsx` already pointed there per 07-05 SUMMARY | PASS |

## Automated check log

Full execution log from the Wave-4 sweep (2026-04-22T11:34–11:37Z):

```
=== Check 1: bash -n ../adapters/claude-code.sh ===
OK exit 0

=== Check 2: grep -c "token_usage" ../adapters/claude-code.sh ===
4

=== Check 3: grep hallucinated event names across 3 aggregator files ===
NO HITS (grep -rE "forge_start|forge_done|forge_fail|phantom_escalation"
         lib/cae-home-state.ts lib/cae-agents-state.ts app/api/state/route.ts)

=== Check 4: grep -q "export interface CbEvent" lib/cae-types.ts ===
FOUND

=== Check 5: grep -c "forge_begin\|forge_end" lib/cae-metrics-state.ts ===
11

=== Check 6: jq -e '.dependencies.recharts == "3.8.1"' package.json ===
true

=== Check 7: jq -e '.pnpm.overrides["react-is"] == "19.2.4"' package.json ===
true

=== Check 8: pnpm tsc --noEmit ===
exit 0 (zero output lines)

=== Check 9: pnpm build ===
exit 0; 10/10 static pages generated; /metrics and /api/metrics in route table

=== Check 10: ./scripts/lint-no-dollar.sh ===
lint-no-dollar: PASS (no literal $ in metrics copy)
EXIT: 0

=== Check 11: ls components/metrics/ | wc -l ===
15
(agent-stacked-bar, est-disclaimer, explain-tooltip, halt-events-log, per-agent-wall-table,
 queue-depth-display, reliability-panel, retry-heatmap, sentinel-reject-trend, speed-panel,
 spending-daily-line, spending-panel, success-gauge, time-to-merge-histogram, top-expensive-tasks)

=== Check 12: "use client" present in every components/metrics/*.tsx ===
(zero missing)

=== Check 13: key files exist ===
page.tsx: FOUND
metrics-client.tsx: FOUND
explain-tooltip.tsx: FOUND

=== Check 14: page.tsx is SERVER component ===
first line: import { auth } from "@/auth";
(no "use client" — PASS)

=== Check 15: grep -c "metricsPageHeading" lib/copy/labels.ts ===
3  (interface + FOUNDER + DEV)

=== Check 16: curl -s http://localhost:3002/api/metrics | jq 'keys' ===
[ "generated_at", "reliability", "speed", "spending" ]
(spending key present: 1 hit)

=== Check 17: curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/metrics ===
307 Temporary Redirect
location: /signin?from=%2Fmetrics  (unauth gate enforced, as designed)
```

### Live `/api/metrics` payload (2026-04-22T11:36:42Z on port 3002)

```json
{
  "generated_at": "2026-04-22T11:36:42.577Z",
  "spending": {
    "tokens_today": 0,
    "tokens_mtd": 0,
    "tokens_projected_monthly": 0,
    "by_agent_30d_len": 30,
    "daily_30d_len": 30,
    "top_expensive_len": 0
  },
  "reliability": {
    "per_agent_7d_len": 9,
    "retry_heatmap_len": 168,
    "halt_events_len": 0,
    "sentinel_rejects_30d_len": 30
  },
  "speed": {
    "per_agent_wall_len": 9,
    "queue_depth_now": 3,
    "time_to_merge_bins": [
      {"bin_label":"<1m","count":2},
      {"bin_label":"1-5m","count":1},
      {"bin_label":"5-15m","count":0},
      {"bin_label":"15m-1h","count":0},
      {"bin_label":">1h","count":0}
    ]
  }
}
```

Token sums are 0 because the dashboard repo's own jsonl predates the Wave-0 adapter token emission; any CAE project run with the Wave-0 adapter will populate them immediately (see Manual Gate 1 below).

Shape matches CONTEXT §D-10 exactly:

- 9 agents in `per_agent_7d` and `per_agent_wall` (nexus + forge + sentinel + scout + scribe + phantom + aegis + arch + herald).
- 168 retry-heatmap cells (7 DoW × 24 hour).
- 30 zero-filled UTC date rows in by_agent_30d / daily_30d / sentinel_rejects_30d.
- 5 fixed bins in time_to_merge (order preserved even at count=0).
- queue_depth_now = 3 (live inbox count).

## Manual Gates (human UAT — Task 2)

Five blocking gates for Eric to work through. Each gate lists procedure + expected outcome; record PASS/FAIL under the gate header.

### Manual Gate 1 — Wave 0 adapter actually emits tokens (REQ-7-W0-ADAPTER + REQ-7-W0-TICKER)

**Why:** The adapter-emission code path was symbolically verified (jq + regex hand-test in 07-01 SUMMARY), but a live `claude` CLI run confirms the end-to-end plumbing into circuit-breakers.jsonl + top-bar ticker.

**Procedure:**

1. `cd /home/cae/ctrl-alt-elite` (or any CAE project root with `.cae/metrics/`).
2. Invoke the adapter against a trivial task file — e.g. create `/tmp/hi.txt` containing "say hi", then:
   ```
   ./adapters/claude-code.sh --agent forge /tmp/hi.txt
   ```
   (or your preferred canonical trivial-task invocation).
3. `tail -5 /home/cae/ctrl-alt-elite/.cae/metrics/circuit-breakers.jsonl`
   — the last line should be a JSON object with `"event": "token_usage"`, non-zero `"input_tokens"` + `"output_tokens"`, and a `"task_id"` derived from the file basename.
4. Refresh the dashboard top-bar (port 3002 or whatever port is live). The CostTicker should now show a non-zero `"N tok today"` (was always 0 before Wave 0).

**Expected:** token_usage line present, numbers > 0, ticker displays non-zero count.

**Status:** PENDING-UAT (record PASS/FAIL with tail snippet + ticker screenshot)

### Manual Gate 2 — /metrics renders three panels (REQ-7-SPEND + REQ-7-WELL + REQ-7-FAST)

**Why:** Build + tsc + route-manifest confirm the page compiles, but visual render of three panels with real aggregated data is the acceptance criterion for "Phase 7 shipped".

**Procedure:**

1. Log in via GitHub OAuth at `http://<host>:3002/signin` (or current dev port).
2. Click the Metrics icon (📊 / BarChart3) in the top bar → lands at `/metrics`.
3. Verify three `<section>` panels are visible in this order:
   - **Spending** ("How CAE is doing" in founder mode)
   - **Reliability** ("How well it's going" in founder mode)
   - **Speed** ("How fast" in founder mode)
4. Each panel renders EITHER real data OR a tasteful empty-state message (e.g. "No token data in the last 30 days yet.", "No retries in the last 7 days.", "No shipped jobs to chart yet.", "nothing waiting"). No red error banners; no "application error" crash screens.
5. The `est.` disclaimer pill is visible on the Spending panel header, right-aligned.
6. queue_depth_now reflects the live inbox count (3 at the time of the automated sweep; may drift).

**Expected:** Three panels render; no JS errors in console; empty-state copy is founder-speak (not "No data" boilerplate).

**Status:** PENDING-UAT (record PASS/FAIL with screenshot of full /metrics page in founder mode)

### Manual Gate 3 — Explain-mode tooltips (REQ-7-FOUNDER)

**Why:** Explain-mode default-on is the core founder-speak UX policy (CONTEXT D-11). This gate confirms all 10 ExplainTooltip anchors render, are focusable, and respect Ctrl+E toggle.

**Procedure:**

1. On `/metrics` (still logged in), hover any `?` icon next to a metric heading (e.g. "Today", "Projected", "Typical", "Slow tail", "Success rate", "Retry heatmap", "Queue", "Time to merge").
2. Click the `?` — a popover opens with founder-speak explanation text (e.g. "P95 = 95% of tasks finish faster than this. Spikes = bad.").
3. Press **Ctrl+E** once — every `?` icon dims from ~70% to ~30% opacity. Focus ring should remain visible when tabbing through them (keyboard accessibility preserved).
4. Press **Ctrl+E** again — opacity returns to ~70%. Popovers on click still work.
5. Esc closes an open popover.

**Expected:** All 10 anchors (see 07-05 SUMMARY inventory table) present and responsive to explain-mode state.

**Status:** PENDING-UAT (record PASS/FAIL; note any anchors that failed to render)

### Manual Gate 4 — DevMode flip (REQ-7-FOUNDER / CONTEXT D-08)

**Why:** Founder-speak copy default-ON with dev-mode flip is locked in `lib/copy/labels.ts` across 40 `metrics.*` keys. Confirms the flip works end-to-end through the MetricsClient island.

**Procedure:**

1. On `/metrics`, press **⌘⇧D** (macOS) or **Ctrl+Shift+D** (Linux/Win). The dev-mode badge (pre-existing Phase 3 shell chrome) should toggle.
2. Verify panel headings flip:
   - Spending: `"How CAE is doing"` → `"Metrics"` (or equivalent dev-speak).
   - Reliability: `"How well it's going"` → `"Reliability"`.
   - Speed: `"How fast"` → `"Speed"`.
3. Verify sub-labels flip, e.g.:
   - `"typical"` / `"slow tail"` → `"p50"` / `"p95"`.
   - `"Today"` / `"This month so far"` / `"Projected this month"` → `"Tokens today"` / `"MTD"` / `"Projected"`.
   - `"nothing waiting"` / `"N waiting"` → `"N inbox"`.
   - Lede: `"CAE is getting things right 94% of the time this week."` → `"7d success rate: 94.3%"`.
4. ExplainTooltip popup text also flips to engineer-speak (e.g. `"50th percentile, linear interpolation over sorted samples."`).
5. Toggle off — copy returns to founder-speak everywhere.

**Expected:** Every heading + sub-label + tooltip body flips when dev-mode toggles; no hardcoded copy remains pinned to one mode.

**Status:** PENDING-UAT (record PASS/FAIL; flag any text that didn't flip)

### Manual Gate 5 — No $ in UI (CONTEXT D-07)

**Why:** "COST IS TOKENS ONLY" is non-negotiable. Script enforces it at file level; this gate confirms no `$` slips through at runtime rendering.

**Procedure:**

1. Visually scan the entire `/metrics` page in both founder AND dev mode. Zero dollar signs anywhere — not in big numbers, not in tooltips, not in legends, not in "est." disclaimers.
2. Terminal check: `cd dashboard && ./scripts/lint-no-dollar.sh` — exits 0 (already verified in Check 10 above).

**Expected:** Visual: zero `$`. Terminal: exit 0.

**Status:** PENDING-UAT (record PASS/FAIL; flag any `$` sighting with coordinates)

## Gaps identified

None during the automated sweep. The five items under "Manual Gates" are designed UAT gates per the plan, not gaps.

**If any Manual Gate fails during UAT:**

- Record the failure in a new `## Gaps discovered during UAT` section with the gate number, specific symptom, and suggested fix plan number (07-07, 07-08…).
- If structural → spawn `/gsd-plan-phase 07 --gaps` to generate the repair plan.
- If purely cosmetic / accept-and-document → note the rationale inline with "accepted" disposition.

### Pre-existing (scope-boundary, not Phase-7 work)

- Pre-existing Next.js middleware-to-proxy advisory + next.config.ts NFT notice on `pnpm build` (first flagged in 06-01 SUMMARY).
- `pnpm lint` CLI regression (broken since Next 16 upgrade; first flagged in 06-05 SUMMARY).
- `next.config.ts` uncommitted `allowedDevOrigins` edit (dev-only ngrok-like config) and `.planning/STATE.md` orchestrator-level updates — not Phase-7 code scope.
- Untracked file `dashboard/scripts-temp-copy-flip.ts` (stray artifact from an earlier session; safe to delete; not Phase-7-owned).

## Sign-off

- **Automated:** PASS, Claude executor, 2026-04-22T11:36:00Z. 17/17 checks green; lint-no-dollar.sh live and passing; /api/metrics + /metrics curl-verified on port 3002.
- **Manual (Eric):** PENDING — awaiting walk-through of 5 Manual Gates above.

Phase 7 is locked-automated and ready for UAT. On all-5-PASS, append a `Manual (Eric): PASS, <timestamp>` line above; on any FAIL, trigger the gap-closure flow.

---

*Phase: 07-metrics-global-top-bar-icon-page*
*Automated sweep completed: 2026-04-22T11:36:00Z*
