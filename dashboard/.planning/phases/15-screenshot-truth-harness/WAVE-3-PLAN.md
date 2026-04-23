# Wave 3 — Mission Control hero + Live Floor pinned + Token gauge + Cost donut (Cycle 15)

Dispatched after Wave 2 lands. Closes Eric's "what's running NOW" + "pixelagents nowhere" + "no token surface" complaints.

## 3.1 — Mission Control hero (E1)

**Component:** `components/build-home/mission-control-hero.tsx`
**Mount:** /build/page.tsx — first child, ABOVE LiveActivityPanel + RollupStrip

**Layout:** Full-bleed banner, ~140px tall on desktop, collapses to grid below 1024px.

5 tiles laid out in a single row (or 2-row stack on tablet):
1. **Active count** — large animated number (Recharts AnimatedNumber or useSpring) — "3 agents working"
2. **Token burn rate** — animated bar showing tok/min vs daily-budget bar
3. **Cost-vs-budget radial** — semi-circle gauge, color band by % of daily budget
4. **60s sparkline** — last 60 seconds of event count, ticks every 1s
5. **Since-you-left chip** — visible only when last_visit > 1h, summarizes diff

**Data sources:**
- Active count: `.cae/breakers/*.jsonl` tail — count of forge_begin without matching forge_end in last 5min
- Token rate: `.cae/metrics/tool-calls.jsonl` rate × per-model cost (pending Track D F1 fix for input_tokens)
- 60s sparkline: same source, per-second buckets
- Since-you-left: diff `.cae/sessions/last-seen.json` against current state

**Interaction:** each tile clickable → drill (Active → /build/agents, Token → /metrics, etc.)

**API route:** `app/api/mission-control/route.ts` aggregates all 5 — 5s cache.

**Tests:** unit for aggregator, render tests for each tile state (idle / active / over-budget / first-visit / returning).

## 3.2 — Live Floor pinned widget (E2)

**Component:** `components/build-home/floor-pin.tsx`
**Mount:** /build/page.tsx top-right column, 240px tall × 320px wide on desktop

Embed a scoped `<FloorClient />` (existing Phase 11 component, in components/floor/) sized to fit. On click of the widget header → expand to full /floor route.

Pop-out button → opens /floor in new window (existing pop-out functionality).

**Constraint:** since real-time SSE source has no events without active phases, widget shows "online — last event Xm ago" idle state with the heartbeat dot pulsing (post-Wave-1.5 heartbeat-emitter feeds this).

**Interim sprite:** until Wave 9 PixiJS sprite kit ships, render a single "CAE alive" indicator in the canvas — a 3-dot animated waveform pulsing in the center of the isometric scene when heartbeat > 0.

**Tests:** widget renders, click → navigates, pop-out fires, idle copy shows when no events.

## 3.3 — Top-nav Floor icon (close the IA gap)

**Discovery:** Per LIVE-FLOOR-AUDIT, top-nav Gamepad2 FloorIcon is built but never mounted in TopNav.

**Fix:** Mount `<FloorIcon />` in `components/shell/top-nav.tsx` next to existing top-nav icons. Now Eric can navigate to /floor without typing the URL.

**Test:** TopNav renders FloorIcon, click → /floor.

## 3.4 — Token burn-rate gauge (E3) in top-nav

**Component:** `components/shell/token-gauge.tsx` — small pill in top-nav showing current tok/min + cost/day projection.
- 16px circular ring (svg) showing % of daily budget
- Click → opens detailed cost popover with: today's spend, projection to EOD, top 3 expensive agents, model split
- Color band: green <60%, amber 60-80%, red >80%

**Data:** API route `app/api/cost/now/route.ts` aggregates tool-calls.jsonl × model rates from lib/cae-cost-table.ts.

**Daily budget:** configurable env var `CAE_DAILY_BUDGET_USD` (default $50).

**Tests:** unit for cost calc, render at each color band.

## 3.5 — Cost-by-agent donut (E4) on /metrics

**Component:** `components/metrics/cost-by-agent-donut.tsx`
**Mount:** /metrics — new "Cost" tab section

Donut chart (Recharts PieChart). Slice per agent. Hover reveals: agent name, total cost, % of total. Click → drill to agent detail drawer.

Empty state with character: "Spend chart appears when agents start logging cost."

**Data:** group tool-calls.jsonl by agent (currently the audit-hook captures `task` but not `agent` — need to extract agent from task ID convention or extend audit-hook to capture). For interim, group by tool kind if agent unavailable.

**Tests:** render with mock agent breakdown, verify slice count, click handler.

## 3.6 — Model-cost stacked bars (E5) on /metrics

**Component:** `components/metrics/model-cost-stacked.tsx`
**Mount:** /metrics — Cost tab

Recharts BarChart, last 7 days × 4 model colors (Opus/Sonnet/Haiku/other). Hover: per-day breakdown.

**Data:** tool-calls.jsonl × per-call model attribution × cost-table rates.

**Tests:** render with 7-day fixture, verify stacking, hover tooltip.

## 3.7 — Wave 3 acceptance

- [ ] tsc clean
- [ ] All affected component tests pass
- [ ] /build home shows Mission Control hero + LiveActivityPanel + RollupStrip + Floor pin in coherent stack
- [ ] Token gauge in top-nav with 3 color bands tested
- [ ] /metrics has new Cost tab with donut + stacked bars
- [ ] FloorIcon mounted in TopNav
- [ ] Eric refresh: he sees a control room above-the-fold, pixel agents pulsing in pin widget, cost gauge in top-right of nav

## Sequencing

3 parallel agents:
- Batch A: 3.1 (Mission Control) + 3.2 (Floor pin) + 3.3 (Floor icon mount)
- Batch B: 3.4 (Token gauge) + 3.5 (Cost donut)
- Batch C: 3.6 (Model-cost bars)

Or single ship-now agent if file-conflict risk is low.
