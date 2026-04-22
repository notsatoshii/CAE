# Phase 13: UI/UX review + polish loop — Research V2 (deeper)

**Researched:** 2026-04-23 (supersedes 2026-04-22 v1 — v1 was cosmetic audit only; v2 addresses Eric's session-6 correctness critique)
**Domain:** Correctness + liveness + functionality + logging + IA + visual audit of the live CAE dashboard. Not a cosmetic pass.
**Confidence:** HIGH on correctness/logging/liveness recipes (verified against current code). MEDIUM-HIGH on IA deltas (Mission Control screenshots viewed, reference audit grounded). MEDIUM on visual rubric (carry-over from v1, no reason to rewrite).

---

## Executive summary

v1 treated Phase 13 as a cosmetic audit: Playwright screenshots → 6-pillar vision review → fixes. Eric's session-6 critique makes clear that misses the real failure mode: *the app ships, but it ships wrong numbers with no audit trail and half-dead polling, and the visual pass is last on the problem list, not first.* v2 re-orders scope to **correctness → liveness → functionality → logging → IA → visual**, and for each of the first four produces concrete implementation recipes grounded in what the current code actually does (verified by grep: `lib/hooks/use-state-poll.tsx` has no tab-visibility pause; `app/api/chat/send/route.ts` emits `randomUUID()` on every SSE frame overwriting `lastSeenMsgId`; 35 scattered `console.error`/`console.warn` calls with no correlation ID, no scope tag, no structured output). The audit tooling stays lean — global `screenshot-url` + Claude native vision + targeted scrape — with Playwright Python used only for auth and localStorage injection (no project dep). Primary recommendation: **execute correctness/liveness/functionality/logging in Wave 2-4 (fix real bugs before polish), then do IA + visual in Wave 5-6**. Budget ≈$18-25 in model tokens; 6-8 day execution; delta gate requires zero regressions, ≥95% P0 resolution.

---

<user_constraints>
## User Constraints (from 13-CONTEXT.md — locked)

### Locked Decisions
- **D-01** Scope = 6 audit axes in this order: data correctness → liveness → functionality → logging → MC IA comparison → 6-pillar visual
- **D-02** Fix order = correctness before polish (Sonnet executes P0 before P1 before P2)
- **D-03** Tooling = global `screenshot-url` + `scrape-url` CLIs + Claude native vision (Read tool on PNGs). No Playwright project dep unless correctness harness demands it
- **D-04** Opus 4.7 for all judgment (correctness verification, vision audits, critique, delta, planning). Sonnet 4.6 for Wave 0 harness + Wave 5 execution only
- **D-05** Coverage: 3 viewports (375/1280/1920) × 2 modes (founder-default / dev) × all 13 shipped page.tsx + drawer states. Skip unshipped Phase 10/11 sub-routes
- **D-06** No new features. Cosmetic + copy + a11y + logging instrumentation + aggregator bug fixes only
- **D-07** Mission Control IA wins in-scope if audit confirms clear-win: ambient clock + latency, status counter chip, Golden Signals framing, Agent card action verbs (copy only), Incident Stream panel (ONLY if reusing existing data — if new panel = defer)
- **D-08** Delta gate: ≥95% P0 `resolved`, ≥80% ALL `resolved|partial`, **zero** `regressed`, zero WCAG AA violations left
- **D-09** Run audit against production build (`pnpm build && pnpm start`), not dev — turbopack `networkidle` hangs
- **D-10** Auth = `storageState.json` from one-time manual sign-in, cookie `authjs.session-token`, chmod 0600, gitignored
- **D-11** Deterministic screenshot hygiene: disable animations/transitions/caret via injected CSS, set localStorage before navigate, use `--wait-selector` for Monaco/react-flow
- **D-12** Structured logging is a deliverable, not a side effect — ships as part of Wave 5 if audit finds current logs inadequate

### Claude's Discretion
- Screenshot dir naming (`shots/{phase}/{viewport}-{mode}/{slug}.png` recommended, gitignored)
- Vision batch size (6-8 per call recommended, §Visual pillars below)
- Correctness fixture vs live data per panel — auditor decides
- WCAG report format (markdown table recommended)
- Whether Incident Stream counts as "surface existing data" (permitted, D-06/D-07) or "new feature" (deferred)

### Deferred Ideas (OUT OF SCOPE)
- Visual regression CI (Chromatic, Percy, Playwright snapshot mode)
- Storybook / component-level visual tests
- Lighthouse runtime perf
- Cross-browser (Firefox/WebKit) — Chromium only
- Mobile-native (iOS Safari, Android Chrome) — 375 Chromium is enough
- New features surfaced by audit: ⌘K (Phase 12), Skills Hub, natural-lang cron, SOUL rebrand, RBAC, Plan-mode sub-routes (Phase 10), Live Floor (Phase 11)
- Proper Playwright test harness IF CLI approach sufficient
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | V2 Research Support |
|----|-------------|---------------------|
| REQ-P13-01 | Screenshot harness captures every shipped route × viewport × mode (~200 images) | §Tooling, §Visual pillars |
| REQ-P13-02 | **Data correctness audit** — every panel's displayed numbers verified against source-of-truth files, mismatches flagged P0 | §1 Data correctness |
| REQ-P13-03 | **Liveness audit** — polling intervals, SSE streams, cache TTLs measured against semantic claims; every live surface gets visible last-updated indicator | §2 Liveness |
| REQ-P13-04 | **Functionality completeness audit** — every interactive control click-walked, expected-vs-actual outcomes documented | §3 Functionality |
| REQ-P13-05 | **Logging audit + structured logger rollout** — scoped/correlation-ID'd logger, Incident Stream panel surfacing recent errors, debug mode toggle with breadcrumbs | §4 Logging |
| REQ-P13-06 | **Mission Control IA comparison** — route-by-route delta report with in-scope wins implementable under D-06 | §5 MC IA |
| REQ-P13-07 | 6-pillar visual rubric audit on every shipped surface | §6 Visual pillars |
| REQ-P13-08 | Self-critique pass on audit findings (bias, gaps, priority inversions) | §7 Critique pass |
| REQ-P13-09 | Delta re-audit: before/after paired verdict per finding | §8 Delta pass |
| REQ-P13-10 | No new features — diff touches `components/`, `app/globals.css`, `lib/copy/labels.ts`, `tailwind.config.*`, `lib/cae-*-state.ts` (aggregator bug fixes), `app/api/*/route.ts` (logging + hotfix only), NO new routes | D-06 constraint |
| REQ-P13-11 | All judgment passes use Opus 4.7; Sonnet banned from judgment | D-04 |

Phase 13 is not in ROADMAP.md — Eric's directive + 13-CONTEXT.md define scope. REQ-P13-02/03/04/05/06/09 are new in v2.
</phase_requirements>

---

## Gap analysis vs v1

| Gap | v1 state | v2 fix |
|-----|---------|--------|
| Treats audit as cosmetic only | "6-pillar visual rubric" dominates | 6-pillar demoted to §6; correctness §1-§4 come first |
| No recipe for verifying displayed numbers | Absent | §1 ships a paired screenshot+source-of-truth harness |
| Liveness = "measure polling intervals" handwave | Mentioned once | §2 ships a measured-claim-vs-actual table + visible LastUpdated component + health chip recipe |
| Functionality completeness = not mentioned | — | §3 ships per-route click checklist + expected-vs-actual matrix |
| Logging = not mentioned | — | §4 ships pino-backed scoped logger + correlation middleware + Incident Stream panel recipe + debug mode breadcrumbs |
| MC IA = referenced in MISSION-CONTROL-NOTES.md but no delta table | Notes file exists | §5 produces route-by-route delta table with copy/code/defer verdicts |
| Opus 4.7 vision cap | "3.75MP still correct" | Confirmed — 3.75MP cap (2576px long edge), 1920×1080@1x = 2.07MP fits. Do not use 2x retina [CITED: platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-7] |
| WR-01 (chat SSE id overwrite) | Mentioned in HANDOFF only | §1/§4 include it as a concrete P0 correctness/logging finding |
| WR-02 (shouldGate dead code) | Mentioned in HANDOFF only | §3 includes it as P1 functionality finding |
| Tab-visibility pause | v1 said "pause-when-away polling is a quick win" — didn't verify what exists | §2 verified: `use-metrics-poll.tsx` HAS it, `use-state-poll.tsx` DOES NOT. Fix is a ~15-line patch |

---

## 1. Data correctness — implementation recipe

### The failure mode

Every panel in the dashboard reads from a filesystem aggregator (`lib/cae-*-state.ts`) that tails `.jsonl` files and emits JSON. If the aggregator has a schema drift bug (as Phase 7 caught once: `inputTokens` vs `input_tokens`), the panel renders zeros or garbage, silently, forever. Eric's critique ("details incorrect, emphasized twice") means ≥2 such bugs are live *right now*.

The audit must **prove each number ships correctly**, not just screenshot it. That requires three-way agreement: (a) what the PNG shows → (b) what `/api/*` returns → (c) what the source-of-truth file contains.

### Per-panel source-of-truth map (verified 2026-04-23 via grep)

| Panel | Component | Reads via | Source of truth | Known drift risk |
|-------|-----------|-----------|-----------------|-------------------|
| Cost ticker (top nav) | `components/shell/cost-ticker.tsx` | `useStatePoll → /api/state → getCircuitBreakerState + tailJsonl(circuit-breakers.jsonl)` | `.cae/metrics/circuit-breakers.jsonl` sum of `input_tokens + output_tokens` where `ts` starts today | ✅ Already hit once (D-02 Phase 7 fix); re-verify |
| Heartbeat dot | `components/shell/heartbeat-dot.tsx` | same | `breakers.halted`, `breakers.retryCount`, `breakers.recentPhantomEscalations` | Aggregator derives retry from `forge_end` rows with `success:false` — must verify count matches grep |
| Rollup strip (5 slots) | `components/build-home/rollup-strip.tsx` | `useStatePoll → rollup.{shipped_today, tokens_today, in_flight, blocked, warnings}` | `home.rollup` assembled in `lib/cae-home-state.ts` — 725 lines | HIGH: largest aggregator, most likely to drift |
| Active phase cards | `components/build-home/active-phase-cards.tsx` | `data.home_phases[]` | `getHomeState().phases` — walks `.planning/phases/NN-*/` + metrics | wave_current / wave_total / progress_pct all derived — all potentially wrong |
| Needs-you list | `components/build-home/needs-you-list.tsx` | `data.needs_you[]` | same aggregator | `type: blocked/dangerous/plan_review` derivation is heuristic |
| Recent ledger | `components/build-home/recent-ledger.tsx` | `data.events_recent[]` | same aggregator | timestamps, agent attribution |
| Live ops line | `components/build-home/live-ops-line.tsx` | `data.live_ops_line` (string) | same aggregator | pure string, easy to regress on empty state |
| Agents grid | `components/agents/*` | `/api/agents` → `lib/cae-agents-state.ts` | `.cae/metrics/*.jsonl` cross-project aggregation | 7d success rate, avg wall time, drift flag |
| Metrics spending panel | `app/metrics` children | `/api/metrics` → `lib/cae-metrics-state.ts` | same jsonl sources, MTD + projected | projection math (linear extrapolation) vs actual |
| Changes timeline | `components/changes/*` | `/api/changes` → `lib/cae-changes-state.ts` | `git log --all --merges` + `circuit-breakers.jsonl` | timestamps + project grouping |
| Queue kanban | `components/queue/*` | `/api/queue` → `lib/cae-queue-state.ts` | `listInbox()` + `listOutbox()` | card status bucketing |
| Memory tree | `app/memory/**` | `/api/memory/tree` | filesystem walk of `AGENTS.md` + `KNOWLEDGE/` + `.claude/agents/` + `.planning/phases/*/*.md` | file count mismatches — likely tree filter bug |
| Memory graph | `components/memory/graph/*` | `/api/memory/graph` → `.cae/graph.json` (graphify) | `safishamsi/graphify --mode fast --no-viz` output | node count cap at 500, filter chips |
| Chat unread count | `components/chat/chat-rail.tsx` | `useChat → /api/chat/state` | `.cae/chat/sessions/*.jsonl` + `lastSeenMsgId` | **WR-01 CONFIRMED BROKEN** — see below |

### WR-01: concrete P0 data-correctness finding (pre-audit)

Confirmed via grep on `app/api/chat/send/route.ts`:
- Line 165: `const beginId = randomUUID();` — emitted as SSE `id:` at `assistant.begin`
- Line 213: `encodeSSE(randomUUID(), "assistant.delta", ...)` — every token delta gets a new UUID
- Line 222: `encodeSSE(randomUUID(), "unread_tick", { unread: 1 })` — every tick gets a new UUID
- Line 273: `const assistantMsgId = randomUUID();` — final assistant msg gets a DIFFERENT UUID from beginId

Client behavior (grep `lastSeenMsgId` across components/chat/):
- Overwrites `lastSeenMsgId` per SSE frame
- Persists whichever ID was last seen (which is usually an ephemeral `unread_tick` UUID, not a real message ID)
- On reload, `readTranscriptAfter(lastSeenMsgId)` returns `[]` because that UUID never existed in persisted transcript
- Therefore **unreadCount always = 0 after reload**

**Fix sketch (P0, ~20 lines):**
```typescript
// app/api/chat/send/route.ts
// Replace randomUUID() per-frame with ONE stable message ID for the whole response.
// Only emit the real persisted message ID on the `assistant.end` frame (not on every delta).
const assistantMsgId = randomUUID();  // compute ONCE at top of stream
// ... stream body ...
controller.enqueue(encodeSSE("", "assistant.delta", { text }));  // empty id on deltas
controller.enqueue(encodeSSE(assistantMsgId, "assistant.end", { msg_id: assistantMsgId }));
// unread_tick should NOT overwrite lastSeenMsgId — emit with sentinel id "" or rename the SSE field
```

This is Finding #1 for the audit's data-correctness backlog.

### Harness recipe — three-way verification

**Goal:** for each panel in the table above, produce a `VERIFY.md` entry of the form:
```
Panel: Cost ticker
PNG: shots/before/laptop-founder/build-home.png (crop: top-right 200×40)
API: GET /api/state → breakers.inputTokensToday=4214, .outputTokensToday=1832
SOURCE: sum(input_tokens + output_tokens where ts startsWith "2026-04-23") in circuit-breakers.jsonl = 6046
RENDERED: "6.0k tok today · est."
VERDICT: ✅ match within ±1 (formatTokens rounds 6046 → "6.0k")
```
or if broken:
```
VERDICT: ❌ MISMATCH — rendered "0 tok today" but source has 6046. /api/state returned inputTokensToday=0 — aggregator bug. See cost-ticker.tsx line 33 vs cae-home-state.ts aggregation.
```

**Driver script** (Python, inline in Wave 2 plan — no new dep):

```python
#!/usr/bin/env python3
"""Phase 13 data-correctness verifier. Reads live /api/* + parses source files. Emits VERIFY.md."""
import json, subprocess, datetime as dt, pathlib, urllib.request, sys
from collections import defaultdict

BASE = "http://localhost:3002"
COOKIE = pathlib.Path("storage-state.json").read_text()  # for auth
SESSION_COOKIE = next(c for c in json.loads(COOKIE)["cookies"] if c["name"] == "authjs.session-token")["value"]

def api(path: str) -> dict:
    req = urllib.request.Request(f"{BASE}{path}", headers={"Cookie": f"authjs.session-token={SESSION_COOKIE}"})
    with urllib.request.urlopen(req) as r:
        return json.load(r)

def tail_jsonl(path: pathlib.Path, n: int = 200) -> list[dict]:
    lines = path.read_text().splitlines()[-n:]
    return [json.loads(l) for l in lines if l.strip()]

# --- COST TICKER VERIFY ---
state = api("/api/state")
today = dt.date.today().isoformat()
cb = tail_jsonl(pathlib.Path(".cae/metrics/circuit-breakers.jsonl"))
expected_in = sum(r.get("input_tokens", 0) for r in cb if r.get("ts", "").startswith(today))
expected_out = sum(r.get("output_tokens", 0) for r in cb if r.get("ts", "").startswith(today))
actual_in = state["breakers"]["inputTokensToday"]
actual_out = state["breakers"]["outputTokensToday"]
match = (expected_in == actual_in) and (expected_out == actual_out)
print(f"Cost ticker: expected in={expected_in} out={expected_out}; actual in={actual_in} out={actual_out} → {'✅' if match else '❌'}")

# ... repeat for each panel in the map ...
```

Output: `audit/VERIFY.md` with a verdict row per panel. Mismatches become Wave 5 P0 fix tasks.

### Coverage: the minimum panels to verify

Prioritize by user-visible density (largest number of displayed numbers = biggest blast radius):

1. Cost ticker (3 numbers per render)
2. Rollup strip (5 numbers)
3. Active phase cards (5 numbers × N phases)
4. Needs-you list (count + per-item summary)
5. Recent ledger (20 rows, tokens + timestamps each)
6. Heartbeat dot status
7. Chat unread count (WR-01 likely broken)
8. Metrics page (all 3 panels)
9. Agents grid (per-card: tokens/hr, 7d success %, avg wall time)
10. Changes timeline (timestamps + commits count)
11. Queue columns (card counts per column)
12. Memory tree count
13. Memory graph node count

**Estimated P0 findings:** 5-8 mismatches based on Eric's "details incorrect, emphasized twice" + aggregator complexity (cae-home-state.ts is 725 lines, ample room for drift).

---

## 2. Liveness — implementation recipe

### Measured current state (verified 2026-04-23)

| Surface | Mechanism | Interval | Tab-visibility pause | Last-updated indicator | Staleness claim |
|---------|-----------|----------|---------------------|------------------------|-----------------|
| `useStatePoll` (cost ticker, heartbeat, rollup, phases, needs-you, live-ops, recent ledger, task sheet) | `setInterval(poll, 3000)` in `lib/hooks/use-state-poll.tsx:74` | **3000ms** | ❌ **NO** — verified, no `visibilitychange` listener | ❌ | "live" label in heartbeat-dot is a lie when tab is background |
| `useMetricsPoll` (metrics page) | `setInterval(poll, 30000)` in `lib/hooks/use-metrics-poll.tsx:78` | **30000ms** | ✅ YES — line 85 addEventListener | ❌ | metrics acceptable, but no UI indication of freshness |
| `/api/tail` SSE | `EventSource` in `components/tail-panel.tsx`, `chat-panel.tsx`, `sheet-live-log.tsx` | server-push | ✅ implicit (browser pauses SSE on background) | ❌ no reconnect-state indicator | SSE can silently drop — no UI |
| `/api/chat/send` SSE | same pattern | server-push | ✅ | ⚠️ force-tick setInterval + re-render, but no explicit last-updated | see WR-01 — ID regresssion |
| Regenerate graph countdown | `setInterval(..., 1000)` in `components/memory/graph/regenerate-button.tsx:79` | 1000ms | partial | ✅ (it IS a countdown) | cooldown only, not freshness |

**The three concrete liveness defects:**

1. **`useStatePoll` has no tab-visibility pause.** Background tab with dashboard open = 1,200 requests/hour → $0 cost (OAuth) but noisy logs and battery drain. More importantly when Eric returns to the tab the first visible state can be up to 3 seconds stale with no indication.
2. **No visible "last updated Xs ago" on ANY panel.** Heartbeat dot just says "live" — which is the problem Eric called out ("data not LIVE"). The UI asserts liveness; it does not prove it.
3. **SSE drops are invisible.** `/api/tail` `EventSource` error handling is not wired to a UI state — if the stream dies, log tail just freezes and the user has no idea.

### Recipe: `LastUpdated` primitive (new component, in-scope per D-12)

```tsx
// components/ui/last-updated.tsx — ~30 lines, no dep
"use client";
import { useEffect, useState } from "react";

/**
 * Visible data-freshness stamp. Pairs with any polled source.
 *
 * Green ≤ threshold*1, amber ≤ threshold*3, red > threshold*3 (stale).
 * Hover tooltip shows absolute timestamp. Screen-reader announces relative.
 *
 * @param at    — unix ms of last successful fetch
 * @param threshold_ms — semantic staleness bound for this source
 */
export function LastUpdated({ at, threshold_ms, className = "" }: { at: number | null; threshold_ms: number; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  if (!at) return <span className={`text-xs text-[color:var(--text-dim)] ${className}`}>—</span>;
  const delta = now - at;
  const rel = delta < 5_000 ? "just now"
            : delta < 60_000 ? `${Math.floor(delta / 1000)}s ago`
            : delta < 3_600_000 ? `${Math.floor(delta / 60_000)}m ago`
            : `${Math.floor(delta / 3_600_000)}h ago`;
  const state = delta <= threshold_ms ? "fresh"
              : delta <= threshold_ms * 3 ? "stale"
              : "dead";
  const color = state === "fresh" ? "var(--success)" : state === "stale" ? "var(--warning)" : "var(--danger)";
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-[10px] ${className}`} title={new Date(at).toLocaleString()}>
      <span className="inline-block size-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      <span className="text-[color:var(--text-muted)]">{rel}</span>
    </span>
  );
}
```

**Why `setInterval(setNow, 1000)`:** SWR-style libraries use absolute timestamp and compare on each render. For our 3s heartbeat, per-second refresh of the relative label is fine; larger intervals would cause the "28s ago" → "29s ago" flicker to feel sluggish. [CITED: Cloudscape timestamp UX](https://cloudscape.design/patterns/general/timestamps/) — mix relative + absolute tooltip is the accepted pattern.

### Recipe: tab-visibility pause for `useStatePoll`

```typescript
// lib/hooks/use-state-poll.tsx — patch
useEffect(() => {
  mounted.current = true;
  let lastFetchAt: number | null = null;

  async function poll() {
    const res = await fetch(url);
    if (!mounted.current) return;
    if (!res.ok) { setError(new Error(`${res.status}`)); return; }
    setData(await res.json());
    setLastUpdated(Date.now());   // NEW
    setError(null);
  }

  poll();
  let id = window.setInterval(poll, intervalMs);
  const onVisibility = () => {
    if (document.hidden) { window.clearInterval(id); }
    else { poll(); id = window.setInterval(poll, intervalMs); }
  };
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    mounted.current = false;
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}, [projectPath, intervalMs]);
```

Add `lastUpdated` to `StatePollValue` and expose via context. Mount `<LastUpdated at={lastUpdated} threshold_ms={6000} />` in every consumer: cost-ticker, heartbeat, rollup-strip, active-phase-cards, etc.

### Recipe: `Liveness` health indicator in top bar

Combines all three poll sources + SSE status into a single chip:

```tsx
// components/shell/liveness-chip.tsx
const statePoll = useStatePoll();
const metricsPoll = useMetricsPoll();  // if mounted
const sseState = useSseHealth();  // see below

const sources = [
  { name: "state", at: statePoll.lastUpdated, threshold: 6000 },
  { name: "metrics", at: metricsPoll?.lastUpdated ?? Date.now(), threshold: 60000 },
  { name: "sse", at: sseState.lastMessageAt, threshold: 30000 },
];
// Health: worst of the three
const worst = sources.reduce((w, s) => {
  const d = Date.now() - (s.at ?? 0);
  const state = d <= s.threshold ? "fresh" : d <= s.threshold * 3 ? "stale" : "dead";
  return state === "dead" ? "dead" : (w === "dead" ? "dead" : (state === "stale" || w === "stale") ? "stale" : "fresh");
}, "fresh");
```

Chip copy: "Live · 28ms" when fresh (borrow MC pattern — see §5). "Stale · 12s" when amber. "Offline" when red. Click chip → tooltip showing per-source freshness.

### Recipe: SSE health tracking

```typescript
// lib/hooks/use-sse-health.ts
export function useSseHealth(path: string) {
  const [state, setState] = useState<{lastMessageAt: number | null; status: "connecting" | "open" | "closed"}>({
    lastMessageAt: null, status: "connecting"
  });
  useEffect(() => {
    const es = new EventSource(path);
    es.onopen = () => setState(s => ({ ...s, status: "open" }));
    es.onmessage = () => setState(s => ({ ...s, lastMessageAt: Date.now() }));
    es.onerror = () => setState(s => ({ ...s, status: "closed" }));
    return () => es.close();
  }, [path]);
  return state;
}
```

Each of the three SSE consumer components (tail-panel, chat-panel, sheet-live-log) gets a tiny health dot in the component header — no more silent drops.

### Measured vs claimed staleness table (ships in audit output)

| Source | Claimed (UI) | Measured (interval) | Worst observed | Verdict |
|--------|--------------|---------------------|----------------|---------|
| state (heartbeat "live") | instant | 3000ms + 1 RTT | up to 3.5s when foreground, unbounded when background | ❌ fix tab-visibility + add LastUpdated |
| metrics | not claimed | 30000ms | 30s, paused correctly when background | ✅ but no UI indicator |
| SSE tail | "live log" | server-push | unbounded if server drops (no retry) | ⚠️ add reconnect + UI status |
| SSE chat stream | streaming | server-push | unbounded if server drops | ⚠️ WR-01 is worse — invisible-ID issue |

---

## 3. Functionality completeness — implementation recipe

### The failure mode

Per Eric: "functionality partial — features shipped but not fully wired." Phase 9 code review already caught WR-02: `shouldGate()` is dead code, `ConfirmActionDialog` opens unconditionally. This pattern — test-covered logic with no caller or the wrong caller — is unlikely unique.

### Recipe: per-route click checklist

For each shipped route, produce a `FUNCTIONALITY.md` section with the table:

```markdown
## /build
| # | Control | Type | Expected | Actual | Verdict |
|---|---------|------|----------|--------|---------|
| 1 | Rollup strip slot: "shipped today" | click | no-op (display only) | no-op | ✅ |
| 2 | Active phase card click | click | opens task detail sheet | opens sheet | ✅ |
| 3 | Active phase card Why? button | click | opens WhyDrawer with memory trace | — | ⚠️ verify |
| 4 | Needs-you "Review" button | click | nav to /build/phase/N?sheet=open&task=T | — | ⚠️ verify |
| 5 | Needs-you "Deny" button | click | POST /api/needs-you/deny + toast | — | ⚠️ verify handler exists |
| 6 | Recent ledger row click | click | opens task detail sheet | — | ⚠️ verify |
| 7 | Keyboard: Ctrl+E | toggle explain-mode | toggles, respects localStorage | — | ⚠️ verify |
| 8 | Keyboard: Ctrl+Shift+D | toggle dev-mode | toggles, badge appears | — | ⚠️ verify |
| 9 | Keyboard: Esc in sheet | close sheet | closes | — | ⚠️ verify |
| 10 | Chat rail toggle | click | expands/collapses | — | ⚠️ verify |
```

### Recipe: automated click walkthrough via Playwright Python

The existing `authsetup.sh` harness (13-01-PLAN.md Wave 0) already produces `storage-state.json`. Extend into `clickwalk.py`:

```python
# Per-route: instrument every clickable element, invoke, check for console errors or thrown toasts
from playwright.sync_api import sync_playwright
with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=True)
    ctx = browser.new_context(storage_state="storage-state.json")
    page = ctx.new_page()
    console_errors: list[str] = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda exc: console_errors.append(f"pageerror: {exc}"))
    page.goto("http://localhost:3002/build", wait_until="domcontentloaded")
    page.wait_for_timeout(1000)
    # find all buttons + role=button elements
    buttons = page.query_selector_all("button, [role='button']")
    for btn in buttons:
        aria = btn.get_attribute("aria-label") or btn.text_content() or "?"
        before = len(console_errors)
        try:
            btn.click(timeout=2000)
        except Exception as e:
            print(f"⚠️ click failed {aria}: {e}")
            continue
        page.wait_for_timeout(500)
        new = console_errors[before:]
        if new:
            print(f"❌ {aria} emitted errors: {new}")
        else:
            print(f"✅ {aria}")
        # reset: Esc + re-navigate
        page.keyboard.press("Escape")
        page.goto("http://localhost:3002/build")
        page.wait_for_timeout(500)
```

This finds ~80% of silent no-ops. The remaining 20% (handlers that succeed silently but do the wrong thing) require the §1 data-correctness pass because they change state.

### Keyboard shortcut matrix (from UI-SPEC grep)

- Ctrl+E → explain-mode toggle (verified wired in `ExplainModeProvider`)
- Ctrl+Shift+D → dev-mode toggle (verified wired)
- Ctrl+T → chat rail toggle (deferred to Phase 12 ⌘K — Chromium steals binding; click-toggle instead)
- Esc → close drawer/sheet (verify per-sheet via `use-sheet-keys.ts`)
- ⌘K → not shipped yet (Phase 12)
- ? → help overlay (not shipped yet)

Wave 3 functionality audit must test each shortcut at every route for conflicts.

### Recipe: form-submission audit

Three forms ship (verified via `find app components -name '*.tsx' | xargs grep -l 'onSubmit'`):
1. `/build/queue` → delegate form (was in Phase 2, now wrapped in modal)
2. `/build/workflows/new` → create form
3. `/build/workflows/[slug]` → edit form

Per form: verify (a) valid submit → 200 + toast + nav; (b) invalid submit → inline error, no submit; (c) gated action triggers ConfirmActionDialog (WR-02 means it always triggers — blocker); (d) XSRF: forms go through server actions, which Next.js protects automatically — verify.

---

## 4. Logging / debug — implementation recipe

### Measured current state

- **Total console calls (server+client+lib):** 35 (grep-verified)
- **Severity breakdown:** 26 `console.error`, 7 `console.warn`, 3 `console.info`, **0 structured logs**
- **No correlation IDs, no scope tags, no request context**
- **No structured logger (pino/winston):** `grep logger|pino|winston` returns one unrelated comment
- **Server stdout format:** `"[/api/state] getHomeState failed: Error: ..."` — that's the state-of-the-art
- **Browser console:** similar ad-hoc prefixing (`[capture:FAIL]`, `console.error("[workflow]", ...)`)

This is bad enough that Eric's "logs suck" is correct and the fix is "ship an actual logger."

### Recipe: `pino` with per-request correlation ID (App Router)

**Verified current pattern:** Next.js 16 + App Router + async headers. Pino hooks must be sync, so correlation-ID threading uses a module-level `AsyncLocalStorage` + a small middleware wrapper. [CITED: [tomfa/nextjs-pino-logging](https://github.com/tomfa/nextjs-pino-logging); [dev.to nodejs-structured-logging-pino](https://dev.to/axiom_agent/nodejs-structured-logging-in-production-pino-correlation-ids-and-log-aggregation-262m); [blog.arcjet.com/structured-logging-in-json-for-next-js](https://blog.arcjet.com/structured-logging-in-json-for-next-js/)]

```typescript
// lib/log.ts — new file
import pino from "pino";
import { AsyncLocalStorage } from "node:async_hooks";

type Ctx = { reqId: string; route?: string; userId?: string };
export const reqCtx = new AsyncLocalStorage<Ctx>();

const base = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  formatters: { level: (label) => ({ level: label }) },
  mixin: () => reqCtx.getStore() ?? {},
  redact: { paths: ["*.authorization", "*.cookie", "*.session-token", "*.*.password"], censor: "[redacted]" },
});

/** Scoped child logger — always use over console.* */
export function log(scope: string) {
  return base.child({ scope });
}
```

Add install: `pnpm add pino` (dep already viable on Node 20; published 2026 and stable).

### Recipe: request middleware (wraps every App Router route handler)

```typescript
// lib/with-log.ts — new file
import { randomUUID } from "crypto";
import { reqCtx } from "./log";
import { log } from "./log";

const l = log("http");

export function withLog<T extends (req: Request, ...rest: any[]) => Promise<Response>>(
  handler: T,
  route: string
): T {
  return (async (req: Request, ...rest: any[]) => {
    const reqId = req.headers.get("x-correlation-id") ?? randomUUID();
    return reqCtx.run({ reqId, route }, async () => {
      const start = Date.now();
      l.info({ method: req.method, url: req.url }, "req.begin");
      try {
        const res = await handler(req, ...rest);
        const ms = Date.now() - start;
        l.info({ status: res.status, ms }, "req.end");
        res.headers.set("x-correlation-id", reqId);
        return res;
      } catch (err) {
        const ms = Date.now() - start;
        l.error({ err: String(err), stack: (err as Error).stack, ms }, "req.fail");
        throw err;
      }
    });
  }) as T;
}
```

Wrap each route: `export const GET = withLog(async (req) => { /* body */ }, "/api/state");`. The 23 route files get a mechanical ~2-line change each — machine-scriptable.

### Recipe: replace console.* call sites

The 35 console calls all get mechanically converted to scoped logger calls:

```typescript
// BEFORE
console.error("[/api/state] getHomeState failed:", err);

// AFTER
const l = log("/api/state");
l.error({ err: String(err), stack: (err as Error).stack }, "getHomeState.failed");
```

### Recipe: Incident Stream panel (in-scope per D-07 if reusing existing data)

**Decision tree from D-06/D-07 tension:** D-06 forbids new features; D-07 permits Incident Stream "if existing data has what's needed." Post-pino rollout, the Incident Stream surfaces logs that the logger ALREADY writes — **reuses existing log stream, just renders it**. This is "surface existing data" (permitted), not "build new panel" (deferred).

```tsx
// components/shell/incident-stream.tsx
// Reads /api/incidents → server streams last-N structured log lines filtered level>=warn
// Mounted in Metrics page (Golden Signals area per MC IA §5)
```

Server side: pino's `multistream` writes to both stdout AND a rolling file `.cae/logs/dashboard.log.jsonl`. `/api/incidents` route tails that file (reuses `lib/tail-stream.ts` — already exists). Client renders as a scrollable list with severity badges.

**LOE:** ~60 lines (1 API route + 1 component + multistream wiring). Reuses infra — consistent with D-06.

### Recipe: debug-mode breadcrumbs toggle

Dev-mode is already localStorage-backed (`useDevMode`). Extend: when dev-mode on, a floating `<DebugPanel/>` (bottom-right, collapsible) subscribes to a client-side circular buffer of the last 50 events. Every scoped logger call also dispatches a `window.postMessage({ type: "dashboard:log", ...entry })`; `DebugPanel` listens and renders.

```tsx
// components/debug-panel.tsx — new, gated on useDevMode
// Shows: reqId, route, timestamp, scope, level, msg
// Click row → expand to full JSON context
```

This is debug-mode "on" Explain-mode "off" territory — it's the replacement for opening DevTools, and it gives Eric a visible "what fired when I clicked" trail.

### Client-side error capture

Add `window.onerror` + `window.onunhandledrejection` handlers in a root client layout — forward to `/api/telemetry/client-error` (new tiny route) which logs via pino. Without this, client exceptions die in the browser console and Eric never sees them.

### What ships vs what's skipped

| Item | Ship in P13 | Reason |
|------|-------------|--------|
| pino + scoped `log()` | ✅ | Core dep, ~40-line addition |
| AsyncLocalStorage correlation | ✅ | Enables everything downstream |
| `withLog()` wrapping 23 route files | ✅ | Mechanical, ~60 LOC total |
| Mechanical console.* → log() conversion | ✅ | 35 sites, ~1 hour scripted |
| Incident Stream panel | ✅ | Reuses data; D-07 permits |
| Debug breadcrumb panel (dev-mode-gated) | ✅ | No new features — just surfaces existing logs |
| Client error capture | ✅ | Small addition, high leverage |
| OpenTelemetry | ❌ defer | [CITED: medium.com harith-sankalpa] — full OTel is ≥day of work, D-06 |
| Log shipping (Datadog/Grafana Loki) | ❌ defer | Post-MVP |
| PII redaction beyond basic auth tokens | ⚠️ ship basic | `redact` paths above cover session tokens; extend if audit finds more |

---

## 5. Mission Control IA comparison — delta table

### Reference screenshots reviewed (native vision)

**`reference/overview.png`** (Gateway Control Plane):
- Top bar: left mode-indicator chip (`ow Connected`), centered `⌘K`-style global search ("Jump to page, task, agent..."), right cluster `Sessions 2/87 · Events: 0 stream · Live 09:23 · avatar`
- Alert banner under top bar: yellow-tinted with `Run Docker Fix` + `Show Details` + `X` dismiss — inline CTAs, not a toast
- KPI strip (5 large cards): `Gateway Online / Sessions 2/87 / Agent Capacity 1/total / Queue 0 / System Load 76%` — each card has an icon in upper-right corner and a colored dot, numbers are the hero content
- Two-column 50/50 below: **Gateway Health + Golden Signals** (Gateway Connected, Traffic 87, Errors 0, Saturation 0, Memory 12%, Disk 76%) and **Session Router** (active session list with latency + tokens per row) + a third thin column **Incident Stream** (currently empty with "No logs yet · Gateway incidents and warnings stream here.")
- Bottom: Task Flow + Security + Audit (event count badge) columns

**`reference/agents.png`** (Agent Squad):
- Tabs immediately under top bar: `Command · Workflows · Pipelines · Fleet` (grouped surface)
- Horizontal action row below: `Live · Sync Config · Sync Local · Show hidden · Add Agent · Refresh` — filter + command combo
- Grid of 6 agent cards: avatar circle + name + model chip + right-aligned status pill (`Offline` or `Active` with colored dot) + "Never" or "3m ago" last-active + per-card action verbs at bottom `Wake · Spawn · Hide`

### Per-route IA delta (CAE current vs MC, with verdict)

| Route | CAE state | MC equivalent | Delta | Verdict |
|-------|-----------|---------------|-------|---------|
| Top bar | Plan/Build toggle · project · cost ticker · heartbeat · avatar | mode chip · global search · Sessions · Events · Live clock + latency · alerts · avatar | CAE missing: **latency chip, live clock, session counter, global search** | Latency + clock: **ADOPT** (copy-only, no new feature if we already have a heartbeat ping we can time). Sessions/Events: DEFER (chat session count is meaningful though — see row below). Global search = Phase 12 ⌘K; **DEFER**. |
| Alert banner | Toast-based (Sonner), dismiss in corner | Persistent yellow banner + inline CTAs | Toasts self-dismiss; Eric doesn't see them after they vanish | **ADOPT persistent alert row when breakers.halted OR retryCount>0 OR recentPhantomEscalations>0**, with "Show details" + "Dismiss" CTAs. Reuses existing data. |
| /build home | Rollup strip (5 numbers, 1 row) + Active Phases cards | 5 KPI hero cards + Golden Signals + Session Router + Incident Stream + Task Flow | CAE rollup is tighter but **less visual punch**; MC's cards-with-icons read faster | Keep rollup data; **ADOPT card treatment** (5 distinct elevated cards, 1 number each, icon upper-right, colored dot). Copy-only. |
| /metrics | Spending, How-well, How-fast panels | Golden Signals (Gateway/Traffic/Errors/Saturation/Memory/Disk) | MC uses SRE canon; CAE uses founder-speak | **ADOPT Golden Signals framing** as subtitle under each existing CAE panel (no new data). "How well it's going · 94% success (Errors 24h: 1)" — founder-speak primary, SRE canon secondary. |
| /build/agents | Grid list, each row: avatar + name + sparkline + status | Grid cards: avatar + name + model chip + status pill + `Wake · Spawn · Hide` verbs | CAE uses "Start / Stop / Archive"; MC uses agentive verbs | **ADOPT verbs as copy change only**: Wake / Spawn / Hide if A/B reads better for non-dev founders (test with Eric pre-merge). Pure labels.ts change. |
| /build/queue | 5-col KANBAN | MC's Task Flow: Inbox / Assigned / In Progress / Shipped (4-col simpler) | CAE already has more columns than MC — not a fix, a preference | KEEP. Eric already signed off on 5-col in UI-SPEC §7. |
| Nothing = Incident Stream | — | Full column, streams incidents | Huge gap per Eric's "logs suck" | **ADOPT** per §4 recipe (reuses existing log data) |
| Nothing = Session Router | — | Live latency per chat session | Partial — our chat-rail has sessions, but without latency | **PARTIAL ADOPT**: add latency column to chat session list in chat-rail. Reuses existing SSE timestamp data. |
| Nothing = mode chip | — | "MODE: Gateway" always visible | We have Plan/Build toggle — same function, just bolder | KEEP. No change. |

### Naming wins

| Theirs | Ours | Adopt? |
|--------|------|--------|
| "Mission Control" product name | "CAE Dashboard" | Keep brand; consider their tagline style |
| "Session Router" | (none) | ADOPT term for chat/session routing display |
| "Golden Signals" | (none) | ADOPT as subtitle on /metrics panels |
| "Agent Squad" | "Agents" | MAYBE — A/B with Eric; "Squad" is punchier |
| "Incident Stream" | (none) | ADOPT for new panel §4 |
| "Fleet" | (none) | SKIP — we have 9 personas, not a fleet |
| "Task Flow" | "Queue" | SKIP — KANBAN works already |
| "Wake / Spawn / Hide" | "Start / Stop / Archive" | A/B test with Eric |
| "SOUL personalities" | voice personas | SKIP — our rebrand not warranted |

### Summary for audit

MC's two biggest **implementable-today** wins:
1. **Ambient clock + latency chip** in top bar (5-line addition)
2. **Persistent alert banner** replacing toasts for breaker-halt / retry / escalation events

Both are pure copy/component additions, no new features, no new data sources — D-06 compliant.

MC's biggest **architecturally-deferred** win:
1. **⌘K global search** — already Phase 12

MC's biggest **nice-but-not-worth-it** win:
1. **Fleet / Pipelines / Command tabs above agents** — their tab grouping is tighter, but our 5-tab left-rail is clearer for a single-project user

---

## 6. Visual 6 pillars — rubric with score thresholds

Carry-over from v1 with minor updates. The 6 pillars remain: **Hierarchy / Density / Consistency / Motion / Typography / Color**. (v1 had "Affordance" and "Experience Design" separate — collapsing to match Eric's original 6-pillar phrasing.)

### Scoring scale (4-point, per pillar, per screenshot)

- **4** — exemplary, sets the standard
- **3** — good, ships as-is
- **2** — mediocre, fix in a future polish pass
- **1** — actively harms UX, FIX NOW

Phase 13 must score **≥3/4 on every pillar on every shipped surface** (per 13-CONTEXT.md Must-have Truth #6).

### Pillar 1: Visual hierarchy
- Focal point exists; one element dominates via size/weight/color [CITED: Refactoring UI ch.1]
- Primary heading ≥1.5× secondary, ≥1.2× body
- ≤2 weights in view; UI-SPEC §13 locks 400/500/600 (never 700+)
- **1-point trigger:** no clear focal point, everything same size

### Pillar 2: Density / rhythm
- 8pt grid: values ∈ {4, 8, 12, 16, 24, 32, 48, 64}; arbitrary `p-[23px]` = block [CITED: UI-SPEC §13, gsd-ui-checker D5]
- Lists 12-14px padding / 32-40px rows; detail 24-32px padding
- Vertical rhythm consistent between sibling cards
- **1-point trigger:** random-looking spacing, sibling cards different gaps

### Pillar 3: Consistency
- Same action = same visual (icon, size, position)
- Lucide icons only; bare emoji / react-icons = flag
- CTA verbs routed through `lib/copy/labels.ts`
- Empty-state pattern consistent (icon + headline + CTA)
- **1-point trigger:** same action two different ways on two routes

### Pillar 4: Motion
- `prefers-reduced-motion: reduce` respected [CITED: UI-SPEC §S4.6]
- No distracting perpetual motion (pulse, shimmer) outside of strict liveness signals
- Screen shake only on Sentinel merge events
- **1-point trigger:** animation plays when `prefers-reduced-motion: reduce` set

### Pillar 5: Typography
- Fonts: Geist Sans + Geist Mono only (no Times New Roman anywhere — Phase 3 DoD)
- Scale: {13, 14, 15, 16, 20, 24, 32}px
- Weights: 400/500/600 only
- Measure: 45-75ch [CITED: Butterick, *Practical Typography*]
- **1-point trigger:** Times New Roman leakage, >4 sizes per view, text-rendering fallback artifacts

### Pillar 6: Color / contrast
- **WCAG 2.2 AA:** body ≥4.5:1, UI/large ≥3:1 [CITED: [w3.org WCAG22 SC 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)]
  - `text-muted` (#8a8a8c)/bg (#0a0a0a) = 5.1:1 ✓
  - **`text-dim` (#5a5a5c)/bg = 2.7:1 ✗** — known v1 finding, expect in audit
  - `accent` (#00d4ff)/bg = 10.1:1 ✓
- Accent restraint: `#00d4ff` reserved for primary CTA / active nav / focus ring / liveness indicator
- >10 unique accent elements per screen = flag
- **1-point trigger:** text-dim used on body copy, accent used for >5 roles on one screen

### Composite (cross-pillar)
- Loading / error / empty states present on every data-reading component
- Destructive actions use `ConfirmActionDialog` [CITED: Phase 9 plan 09-06]
- Click targets ≥ 24×24 CSS px [CITED: WCAG 2.2 SC 2.5.8]
- **Phase-gate:** average across 6 pillars ≥ 3.0; NO pillar scores 1 on any shipped surface

---

## 7. Tooling recommendations (screenshot → vision → analysis)

### Primary pipeline (per 13-CONTEXT.md D-03)

```
screenshot-url <url> --viewport WxH --wait-selector CSS --wait-ms N -o path.png
         ↓
Claude native vision (Read tool on .png)
         ↓
findings → audit/UI-AUDIT-{axis}.md
```

`screenshot-url` (at `/usr/local/bin/screenshot-url`) = Playwright Python wrapper. Does NOT support cookies or localStorage injection natively. **Therefore the main `capture.sh` can't wrap it** — it uses inline Playwright Python (see 13-01-PLAN.md Task 3). `screenshot-url` remains for one-off spot-check captures and the MC reference shots that are already in place.

### Vision prompt template (reused across waves 2/3/4/6)

```
You are auditing screenshots of the CAE Dashboard against a locked design contract:
{inline: colors, typography, density, accent reservations from UI-SPEC §13}

For EACH image attached (labeled image-1, image-2, ...), emit JSON:
{
  "image": "image-1",
  "route": "<url>",
  "viewport": "...",
  "mode": "founder|dev",
  "pillar_scores": { hierarchy: N, density: N, consistency: N, motion: N, typography: N, color: N },
  "findings": [{
    "severity": "P0|P1|P2",
    "pillar": "...",
    "element": "<specific DOM/visual reference — e.g., 'Rollup strip: Warnings slot'>",
    "defect": "<what is wrong, specific pixel-level reference>",
    "fix": "<concrete change — e.g., 'change text-dim (2.7:1) to text-muted (5.1:1) for rollup values'>",
    "wcag_sc": "1.4.3 | null"
  }],
  "strengths": ["..."]
}

Be critical. Eric has said no surface-level passes. Do not inflate to be nice.
Examples of CRITICAL observations, not nitpicks:
- "Cost ticker renders '0 tok today' but circuit-breakers.jsonl has 6046 tok since 00:00 — P0 data correctness bug"
- "Heartbeat dot says 'live' but actual last-fetch was 47s ago — P0 liveness lie"
- "Rollup strip 'Warnings' slot uses red before warnings>0 — default state looks broken"

NOT critical (don't waste tokens):
- "Accent color is vibrant" — not actionable
- "I notice there are buttons" — not a finding
```

### Batch size

Per v1 (and confirmed by no counter-evidence in v2 research): 6-8 images per call. Sharper judgment, cross-references within batch. Serial batches (parallel degrades judgment). ~25 calls for full 195-shot matrix.

### Opus 4.7 image budget

[CITED: [platform.claude.com/docs whats-new-claude-4-7](https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-7) + [karozieminski.substack Opus 4.7 review](https://karozieminski.substack.com/p/claude-opus-4-7-review-tutorial-builders)]

- Max resolution: **3.75MP** (2576px long edge)
- 1920×1080 @ 1x = 2.07MP ✓
- 1440×900 @ 2x = 5.18MP ✗ (over cap)
- **Stay at 1x deviceScaleFactor always**
- Estimated tokens: 1920×1080 ≈ 2200, 1280×800 ≈ 1800, 375×812 ≈ 700

### Total phase cost estimate (updated from v1)

| Wave | Calls | Input tokens | Output tokens | Est. USD |
|------|-------|-------------|--------------|----------|
| 1 Data correctness (text-only audit of source files + API) | 15 | 100k | 20k | $1.00 |
| 2 Liveness (text + 5 reference shots) | 5 | 30k | 10k | $0.40 |
| 3 Functionality (clickwalk log + text) | 10 | 60k | 20k | $0.80 |
| 4 Logging (grep results + text) | 5 | 30k | 10k | $0.40 |
| 5 IA comparison (text + reference pair) | 2 | 20k | 5k | $0.23 |
| 6 Visual vision audit (195 shots ÷ 7) | 28 | 500k | 100k | $5.00 |
| 7 Self-critique | 1 | 50k | 10k | $0.50 |
| 8 Delta re-audit (~40 pairs) | 40 | 280k | 50k | $2.65 |
| Planning (Opus, 3-4 plans × 20k each) | 4 | 80k | 40k | $1.40 |
| Executor (Sonnet) Wave 5 | — | 400k | 200k | $4.00 |
| **Total** | | | | **~$16-20** |

Worst-case 2× overrun still under $40. Well within budget per Eric's "keep going autonomously" directive.

---

## 8. Wave structure (V2 — correctness-first)

| Wave | Goal | Agents | Model | Plans | Input |
|------|------|--------|-------|-------|-------|
| **0** | Harness: Playwright Python env, storage-state auth, routes.json, capture.sh, gitignore | `gsd-executor` + human | Sonnet | 1 (exists: 13-01-PLAN.md) | already shipping |
| **1** | Screenshot run → `shots/before/*.png` (~200) + MANIFEST.tsv | `gsd-executor` | Sonnet | 1 | routes.json |
| **1.5** | **Data-correctness harness**: `verify.py` drives API + source-file comparison → `VERIFY.md` | `gsd-executor` + `gsd-data-auditor` (new or adapted) | Opus | 1 | §1 recipe |
| **2** | **Liveness audit** + measured polling table → `LIVENESS.md` | `gsd-executor` + judgment | Opus | 1 | §2 recipe |
| **2.5** | **Functionality clickwalk** → `FUNCTIONALITY.md` | `gsd-executor` + `gsd-click-auditor` (new) | Opus | 1 | §3 recipe |
| **3** | **Logging audit** (grep + proposal + Incident Stream panel scope) → `LOGGING.md` | Opus vision + code analysis | Opus | 1 | §4 recipe |
| **4** | **IA + visual 6-pillar vision audit** (batches of 7) → `UI-REVIEW.md` | `gsd-ui-vision-auditor` | Opus | 1 | §6, §5 |
| **5** | **Self-critique** of Waves 1.5-4 outputs → `CRITIQUE.md` | `gsd-ui-critic` (new agent) | Opus | 1 | bias/gaps/priority |
| **6** | **Fix plans** from merged backlog, P0 before P1 before P2 | `gsd-planner` + `gsd-plan-checker` | Opus | 3-6 | all audits |
| **7** | **Execute fixes** — correctness bugs first, logging instrumentation, IA adoption, visual polish | `gsd-executor` | Sonnet 4.6 | N | fix plans |
| **8** | Re-screenshot → `shots/after/`, re-run VERIFY.py, per-finding paired Opus verdict → `DELTA.md` | `gsd-executor` + `gsd-ui-vision-auditor` | Opus | 1 | before/after |
| **9** | `VERIFICATION.md` + human UAT on live app | `gsd-verifier` | Opus | 1 | delta gate |

**Key v2 changes vs v1:**
- Correctness comes BEFORE visual (was last in v1)
- Wave 1.5 (data correctness), 2 (liveness), 2.5 (functionality), 3 (logging) are NEW
- Visual 6-pillar and IA merge into Wave 4 (was 2 separate waves in v1)
- Total plan count ~12 (v1 was 8-10)

---

## 9. Pitfalls — current-state miscommunication hazards

These are concrete defects the current app exhibits that the audit must NOT miss:

1. **"live" label lies.** `HeartbeatDot` renders "live" based on whether breakers.halted is false, irrespective of how stale `data` is. Auditor must verify the label's semantic: it's "halted state" not "liveness." Fix = show actual freshness per §2 LastUpdated.

2. **Rollup strip "Warnings: 0" uses warning color always.** Verified at `rollup-strip.tsx:60` — `warning={rollup.warnings > 0}` is correct in the code, but the `Slot` component may render the label "Warnings: 0" next to an always-on amber dot. Audit the rendered pixel.

3. **Empty states look like broken states.** Several components render "— tok today" or "Idle right now." with no visual distinction from loading. Ambiguity = user assumes broken. Fix = explicit skeleton vs empty-state copy distinction.

4. **Cost ticker shows ZERO when aggregator fails silently.** `getHomeState().catch(fallback)` returns zeros — same rendering as a real zero. Fix = when fallback kicks in, /api/state includes `{warning: "aggregator_failed"}`, UI surfaces amber state.

5. **WR-01 is a data-correctness bug, not just a bug.** The "unread count" is displayed prominently in chat rail — always showing 0 after reload means Eric's been looking at a lying widget for sessions 4-6. This is the textbook of "detail is wrong" from Eric's critique.

6. **Test 239/239 green + user sees bugs = false-positive tests.** Any test that covers the WR-01 or WR-02 code path must be examined — if it's asserting on internal state that is then overwritten by another call, the test is wrong. Don't trust green alone.

7. **Screenshots under `pnpm dev --turbopack` hang on networkidle** [CITED: [playwright #19835](https://github.com/microsoft/playwright/issues/19835), v1 §9#3 confirmed].

8. **`authjs.session-token` is the v5 cookie name** — half the stale tutorials online say `next-auth.session-token` (v4). Verify in Wave 0, fail-fast if not.

9. **SSE stream is invisible when it drops.** No UI indicator means auditor has to watch network tab to catch it. Add `useSseHealth` hook per §2 and render it.

10. **Mocking /api/* for deterministic screenshots + live data pass for real verification are BOTH needed.** Mocked alone misses schema-drift bugs; live alone is non-deterministic. Wave 1 uses mocks; Wave 1.5 uses live data hitting the same-moment snapshot.

11. **Opus 4.7 vision batch attention degrades at >8 images** [CITED: v1 session-5 memory]. Don't cheap out with 15-image batches to save budget.

12. **Consoles noise buries real errors.** Current state has 26 `console.error` calls, some for "expected" warnings (graph regen cooldown, fixture fallback) — real errors drown in it. Structured logger with level filter fixes this.

13. **Phase 10/11 unshipped as of 2026-04-23** — don't enumerate /plan sub-routes or /live-floor. Re-check at Wave 0.

14. **Anthropic brand (Poppins/Lora/#d97757) does NOT apply** — dashboard has locked Geist + cyan. Auditor borrowing Anthropic cues = immediate fail.

15. **Debug-mode breadcrumb panel must not leak in production.** Gate strictly on `useDevMode` provider. If `NODE_ENV=production` + devMode=true — allowed (Eric uses dev-mode regularly), but the panel must not auto-enable.

16. **The dashboard is Eric's daily driver.** Screenshots + data-correctness passes run against the LIVE port 3002 instance — don't `kill -9` his dev server without warning. Use `pnpm build && pnpm start` on a different port (e.g. 3003) for audit, keep 3002 alive for Eric's use, OR schedule audit runs when Eric confirms idle.

17. **"5 tab kanban" is not a fix target.** Eric signed off on 5 columns in UI-SPEC §7; MC's 4 is their choice, not better. Don't over-adopt MC.

18. **PII in logs.** `pino.redact` must include any path with "token" in the name. Audit all `l.info({...})` calls for leaks.

---

## 10. Validation architecture

Phase 13 has three gate types:

### Automated gates (machine-checkable)

| Gate | Check | When |
|------|-------|------|
| Build | `pnpm build` | Every Wave 5 fix task |
| Lint | `pnpm lint` | Every Wave 5 fix task |
| Unit | `pnpm test` — 239 existing + new tests for WR-01 fix + logger | After each Wave 5 plan |
| WCAG axe | `@axe-core/playwright` scan on all routes (via capture.sh extension) | After Wave 7 |
| Data-correctness re-verify | `verify.py` re-run, all previously-failing panels now ✅ | After Wave 7 |
| Clickwalk regression | `clickwalk.py` emits zero console.errors | After Wave 7 |
| Typecheck | `tsc --noEmit` | Every plan |

### Semi-automated (Opus vision judgment)

- **Delta verdict per Wave 8:** each finding gets `resolved | partial | still_broken | regressed`. Phase-gate thresholds per D-08.

### Human gates

- Wave 9 UAT: Eric walks through `/build`, `/build/agents`, `/metrics`, `/memory`, and confirms:
  - Numbers displayed match his expectation
  - Heartbeat "live" is actually live (verifiable via LastUpdated chip)
  - Every button he clicks does what the label says
  - Incident Stream surfaces a fake-warning he triggers

### Phase-level gate (D-08)

- ≥95% of P0 findings verdict = resolved
- ≥80% of all findings verdict = resolved|partial
- Zero regressions
- Zero WCAG AA violations remaining

Below threshold = insert `13-gap-NN-PLAN.md` plans via `/gsd-insert-phase` and loop Wave 5→8 until green.

---

## 11. Environment availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 20+ | Next.js | ✓ | ≥20 | — |
| pnpm | pkg mgr | ✓ | — | npm works |
| Chromium (Playwright) | screenshot-url, capture.sh | check with `pnpm exec playwright install chromium` | — | fallback to global `screenshot-url` if project Playwright unused |
| Python 3.11+ | authsetup.sh, capture.sh inline, verify.py, clickwalk.py | ✓ | — | — |
| `playwright` Python pkg | same | **verify Wave 0** — install if missing | — | `pip install playwright` + `playwright install chromium` |
| `pino` npm pkg | §4 logger | **new — install in Wave 5/logging plan** | latest | none — P13 mandates structured logging |
| `safishamsi/graphify` CLI | /memory?tab=graph screenshot wait-selector | ✓ already shipped Phase 8 | — | — |
| `pnpm build` clean | audit run | ✓ expected | — | fix build before Wave 1 |
| Disk (~200 × 500KB ≈ 100MB per run × 2 runs = 200MB) | before+after shots | ✓ | — | gitignored |
| Port 3003 free | audit prod build | — | — | OR run audit off-hours on 3002 with Eric's OK |

No blocking gaps. Install `pino` and `playwright` Python in the respective Wave 0 / Wave 5 plans.

---

## 12. Assumptions log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Opus 4.7 image tokens ≈ 2000 for 1280×800 | §7 cost table | Budget overrun ≤30-50%; still <$40 worst case |
| A2 | 1x deviceScaleFactor visually sufficient for 6-pillar vision judgment | §6, §7 | If judgment suffers, go to 1.5x (still under 3.75MP for 1920×1080) |
| A3 | `explainMode`/`devMode` camelCase keys | §2/§3 | Wrong key = dev-mode matrix silently captures founder-mode |
| A4 | pino with AsyncLocalStorage works in Next.js 16 production | §4 | Some Next.js versions had `AsyncLocalStorage` edge-runtime issues — verify in Wave 5 |
| A5 | 15-20 images sufficient for critique pass grounding | §8 Wave 5 | Too few = critic ungrounded; too many = diffuses |
| A6 | Port 3003 usable for audit prod build | §11 | Pick any other free port; trivial |
| A7 | NextAuth v5 cookie = `authjs.session-token` | §7 Pitfall 8 | Verified in docs but v5 is beta — test early in Wave 0 |
| A8 | Batch size 7 sweet spot for Opus 4.7 vision | §7 | Drop to 5 if output quality suffers |
| A9 | ~200 screenshot count | §6 | Depends on drawer-state coverage; may swing 150-250 |
| A10 | Eric will be available for UAT Wave 9 within phase window | §10 | If unavailable, autonomous delta gate suffices per "keep going" directive |
| A11 | WR-01 fix scope is ~20 lines | §1 | If ID scheme is used elsewhere, scope grows; audit fix PR before merge |
| A12 | Incident Stream counts as "surface existing data" not "new feature" | §5 | If user disagrees, defer per D-06 |
| A13 | Pino-based logger integrates with Vercel-style log aggregation later | §4 | Not P13 scope anyway; standard pino doesn't lock us out |
| A14 | The 725-line cae-home-state.ts has ≥1 drift bug | §1 | If it's perfect, audit finds that; time well spent either way |
| A15 | Nothing in Phase 10/11/12 ships between now and Phase 13 start | §8 Wave 0 | Re-enumerate routes at Wave 0 start |

---

## 13. Open questions (for discuss-phase, if any)

1. **Incident Stream as "surface existing log stream" vs "new feature":** §5/§4 interpret as the former (reuses pino output + existing /api/tail infra). User confirmation welcome — if called a new feature, defer.
2. **Audit against live port 3002 or fresh 3003 prod build:** §11 recommends 3003 so Eric's daily driver isn't disturbed. Confirm.
3. **Agent card verbs: "Wake/Spawn/Hide" vs "Start/Stop/Archive":** A/B locally before merge. Who decides — Eric, or auditor's copy judgment alone?
4. **Mock-stubbed /api/state for Wave 1 vs live:** recommend stub for Wave 1 (deterministic visual), live for Wave 1.5 (correctness). Both sets of shots live in shots/before/.
5. **Keyboard shortcut matrix conflicts with Chromium:** Ctrl+T is deferred — what about other shortcuts the audit might want to add? (None planned — left as open-Q.)

---

## 14. Sources

### Primary (HIGH)
- `docs/UI-SPEC.md` — project design law
- `13-CONTEXT.md` — locked decisions
- `13-ERIC-CRITIQUE.md` — binding requirements
- `13-MISSION-CONTROL-NOTES.md` — comparative IA evidence
- `reference/overview.png` + `reference/agents.png` — direct visual evidence
- [WCAG 2.2 SC 2.5.8 Target Size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [Playwright Authentication docs](https://playwright.dev/docs/auth)
- [What's new in Claude Opus 4.7 — vision spec](https://platform.claude.com/docs/en/about-claude/models/whats-new-claude-4-7)
- [Pino docs](https://getpino.io) — structured logging canonical
- Live code (grep-verified): `lib/hooks/use-state-poll.tsx`, `lib/hooks/use-metrics-poll.tsx`, `app/api/state/route.ts`, `app/api/chat/send/route.ts`, `components/shell/*`, `components/build-home/*`

### Secondary (MEDIUM)
- [Structured logging for Next.js — arcjet blog](https://blog.arcjet.com/structured-logging-in-json-for-next-js/) — pino + App Router + correlation IDs
- [Node.js Structured Logging in Production — dev.to/axiom_agent](https://dev.to/axiom_agent/nodejs-structured-logging-in-production-pino-correlation-ids-and-log-aggregation-262m)
- [Better Logging with Next.js App Directory — Michael Angelo Rivera](https://michaelangelo-io.medium.com/better-logging-with-nextjs-app-directory-60a07c96d146)
- [tomfa/nextjs-pino-logging](https://github.com/tomfa/nextjs-pino-logging) — reference implementation
- [Cloudscape timestamps pattern](https://cloudscape.design/patterns/general/timestamps/) — relative + absolute tooltip UX
- [UX Movement: Absolute vs relative timestamps](https://uxmovement.com/content/absolute-vs-relative-timestamps-when-to-use-which/)
- [Pino Logging template — Vercel](https://vercel.com/templates/next.js/pino-logging)
- [SRE School Golden Signals 2026 Guide](https://sreschool.com/blog/golden-signals/)
- [SWR Revalidation docs](https://swr.vercel.app/docs/revalidation) — refreshWhenHidden default-off pattern
- [Mission Control UX patterns — UX Planet](https://uxplanet.org/mission-control-software-ux-design-patterns-benchmarking-e8a2d802c1f3) — benchmarking reference
- [NASA Open MCT](https://www.juancarlos.tech/blog/recreating-nasas-ui-for-their-mission-control-tech) — tree+canvas pattern (not our IA, useful for comparison)
- [Playwright Visual Regression — BrowserStack 2026](https://www.browserstack.com/guide/playwright-snapshot-testing)
- [Playwright Visual Regression in Next.js — Ash Connolly](https://ashconnolly.com/blog/playwright-visual-regression-testing-in-next)
- [TanStack Query vs SWR 2026 — PkgPulse](https://www.pkgpulse.com/blog/tanstack-query-vs-swr-vs-apollo-2026)
- [Anthropic Opus 4.7 review — karozieminski](https://karozieminski.substack.com/p/claude-opus-4-7-review-tutorial-builders)
- [Claude Opus 4.7 vision 2576px — ALM Corp](https://almcorp.com/blog/claude-opus-4-7/)
- [DataDog for Vercel](https://vercel.com/marketplace/datadog) — incident + log integration reference
- [Vercel Observability](https://vercel.com/products/observability)

### Tertiary (LOW — assumptions, cross-verify at Wave 0)
- Opus 4.7 image token estimates (rough, will firm up with first batch)
- Batch size 7 specifically
- pino AsyncLocalStorage compatibility with Next.js 16 edge runtime

---

## 15. Metadata

**Confidence breakdown:**
- Data correctness recipe: HIGH — verified against live code, source-of-truth map is grep-proven
- Liveness recipe: HIGH — current state measured (use-state-poll has no visibility pause, confirmed)
- Functionality recipe: MEDIUM-HIGH — Playwright clickwalk pattern standard; exact coverage tbd at execution
- Logging recipe: HIGH — pino + AsyncLocalStorage + correlation IDs is canonical pattern
- MC IA delta: MEDIUM-HIGH — screenshots reviewed, deltas concrete, but final in-scope/defer decisions need Wave 4 audit confirmation
- Visual 6-pillar rubric: HIGH (carry-over from v1, WCAG + UI-SPEC locked)
- Cost budget: MEDIUM — tokenizer uncertainty, image token rough estimate
- Wave structure: MEDIUM — 12 plans is on the high end for GSD; may need to merge

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (SWR/pino/Playwright cadence weekly; WCAG/UI-SPEC stable for years; Opus 4.7 shipping stable)
**Supersedes:** `13-RESEARCH.md` (2026-04-22) — v1 is preserved in git history and at path `13-RESEARCH.md` for reference, but Phase 13 planner consumes V2.
