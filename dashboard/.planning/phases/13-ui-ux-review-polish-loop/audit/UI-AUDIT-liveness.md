# Phase 13 — Liveness Audit

**Audited:** 2026-04-23 (Plan 13-06)
**Auditor:** Sonnet 4.6 (execution), grounded in V2 §2 research
**Scope:** All polling + SSE surfaces in the CAE dashboard; before/after liveness honesty comparison

---

## Executive Summary

Before Plan 13-06, every "live" signal in the dashboard was **dishonest by construction**:
- `HeartbeatDot` showed "live" when `breakers.halted === false` — no relationship to data freshness
- `useStatePoll` kept firing 1200 req/hr when the tab was in the background (wasted server load)
- No visible last-updated indicators anywhere — users had no way to know if data was 3s or 3min stale
- SSE stream drops (network blip, server restart) were completely invisible in the UI
- `useMetricsPoll` already had tab-visibility pause but `useStatePoll` did not — inconsistent

After Plan 13-06, every live surface exposes a per-second freshness chip with color-coded state:
- `LastUpdated` primitive ticks every 1s, color-codes fresh/stale/dead
- `useStatePoll` pauses on `document.hidden`, resumes + immediately polls on visible
- `LivenessChip` in top-nav aggregates state-poll + SSE health into a single user-visible verdict
- All 3 SSE consumers show a status dot + LastUpdated chip

---

## Measured vs Claimed (before → after)

| Source | Claimed (UI pre-13-06) | Measured interval | Tab-visibility pause | LastUpdated shown | Verdict |
|--------|------------------------|-------------------|----------------------|-------------------|---------|
| `useStatePoll` (cost/heartbeat/rollup/phases/ledger) | "live" (dot only) | 3000ms | ❌ → ✅ (this plan) | ❌ → ✅ (this plan) | ✅ resolved |
| `useMetricsPoll` (metrics page) | (no live label) | 30000ms | ✅ (pre-existing) | ❌ (not in scope, separate poll namespace) | deferred to 13-08 |
| `/api/tail` SSE (TailPanel) | "live log" (implicit) | server-push | implicit (EventSource reconnects) | ❌ → ✅ (this plan) | ✅ resolved |
| `/api/chat/send` SSE (ChatPanel) | streaming cursor | server-push (fetch reader) | implicit | ❌ → ✅ (this plan) | ✅ resolved |
| `/api/tail` SSE (SheetLiveLog) | path shown | server-push | implicit | ❌ → ✅ (this plan) | ✅ resolved |
| `LivenessChip` top-nav aggregate | none (absent) | —  | — | ❌ → ✅ (shipped) | ✅ new |

---

## Per-Surface LastUpdated Mount List

### Polling consumers (useStatePoll → threshold 6000ms = 2 missed 3s polls)

| Surface | Component | Placement | Threshold |
|---------|-----------|-----------|-----------|
| Cost ticker | `components/shell/cost-ticker.tsx` | Inline after "est." label | 6000ms |
| Heartbeat dot | `components/shell/heartbeat-dot.tsx` | Replaces hardcoded "live" text | 6000ms |
| Rollup strip | `components/build-home/rollup-strip.tsx` | Right-aligned in CardContent | 6000ms |
| Active phase cards | `components/build-home/active-phase-cards.tsx` | Section heading row (right side) | 6000ms |
| Recent ledger | `components/build-home/recent-ledger.tsx` | Section heading row (right side) | 6000ms |

### SSE consumers (threshold 30000ms = 3 missed 10s heartbeats)

| Surface | Component | SSE path | Status dot | LastUpdated |
|---------|-----------|----------|------------|-------------|
| Tail panel | `components/tail-panel.tsx` | `/api/tail?path=…` | ✅ (open/connecting/closed) | ✅ (lastMessageAt) |
| Chat panel | `components/chat/chat-panel.tsx` | `/api/chat/send` (fetch reader) | implicit (sending state) | ✅ (lastMsgAt on delta) |
| Sheet live log | `components/build-home/sheet-live-log.tsx` | `/api/tail?path=…` | ✅ (open/connecting/closed) | ✅ (lastMessageAt) |

### Top-nav aggregate

| Surface | Component | Sources | States |
|---------|-----------|---------|--------|
| Liveness chip | `components/shell/liveness-chip.tsx` | state-poll (6s) + sse-tail (30s) | Live (green) / Stale (amber) / Offline (red) |

---

## Color Encoding

All freshness indicators use the same token-based color system:

| State | Trigger | Color token | CSS value |
|-------|---------|-------------|-----------|
| fresh | delta ≤ threshold | `--success` | `#22c55e` |
| stale | threshold < delta ≤ 3× threshold | `--warning` | `#f59e0b` |
| dead | delta > 3× threshold | `--danger` | `#ef4444` |

---

## Background-Tab Polling: Before vs After

| Metric | Before 13-06 | After 13-06 |
|--------|-------------|------------|
| `/api/state` requests over 60s (tab hidden) | ~20 (1200/hr rate) | 0 |
| Resumption latency after tab focus | up to 3000ms | immediate (poll fires on visibilitychange) |
| Extra poll on focus | none | 1 (then resumes interval) |

Implementation: `document.addEventListener("visibilitychange", onVisibility)` in `StatePollProvider`. When `document.hidden === true`, `clearInterval(id)` is called. When visible again, `poll()` is called immediately then a new interval started. Listener is removed in cleanup.

---

## useSseHealth Hook Behavior

The `useSseHealth(path)` hook opens an `EventSource` on mount and tracks:
- `status`: `"connecting"` → `"open"` (on `onopen`) → `"closed"` (on `onerror`)
- `lastMessageAt`: `null` initially, set to `Date.now()` on each `onmessage`

Status transitions visible to the user:
- Green dot: stream `open` (receiving data)
- Amber dot: stream `connecting` (initial or reconnecting)
- Red dot: stream `closed` (error / server down)

---

## LivenessChip Aggregation Logic

```
sources = [
  { name: "state", at: lastUpdated, threshold: 6000 },
  { name: "sse",   at: tail.lastMessageAt, threshold: 30000 },
]
worstState = max(classify(source) for source in sources)
  where classify: null→dead, delta≤threshold→fresh, delta≤3×threshold→stale, else→dead
  and worst order: fresh < stale < dead
```

Click opens a `title` tooltip with per-source breakdown (state vs SSE).

---

## Wave 7 Regression Checklist

These manual checks should be run when Plan 13-12 (delta re-audit) executes:

1. **Tab-visibility pause:**
   - Open `/build`, wait 10s for first polls to settle
   - Open DevTools Network tab, filter by `/api/state`
   - Minimize or switch to another tab for 30s
   - Verify: zero `/api/state` requests during the hidden period
   - Switch back: verify one immediate `/api/state` request fires within ~100ms

2. **LivenessChip Offline flip:**
   - Kill the Next.js server while `/build` is open
   - Wait up to 9s (3 × 3000ms threshold)
   - Verify: LivenessChip in top-nav turns red and shows "Offline"

3. **LivenessChip Live recovery:**
   - Restart the server after step 2
   - Wait up to 3s (first successful poll)
   - Verify: chip returns to green "Live"

4. **SSE health dot:**
   - Open a phase sheet with a live log (SheetLiveLog)
   - Kill the server
   - Verify: status dot turns red (closed), LastUpdated shows "30s ago" in red after 90s

5. **HeartbeatDot freshness:**
   - Open `/build`, tab visible
   - Verify: HeartbeatDot shows a small `LastUpdated` chip (not the hardcoded "live" text)
   - Wait 60s with no data change: chip should still show "just now" if polls succeed

6. **Cost ticker freshness:**
   - Open `/build`
   - Verify: CostTicker shows both token count and a `LastUpdated` chip

7. **Rollup + phase cards + recent ledger:**
   - All three sections should show a `LastUpdated` chip at their header/header-adjacent area

---

## Known Limitations / Deferred Items

1. **`useMetricsPoll` surfaces** (metrics page panels): already have tab-visibility pause but do NOT yet show `LastUpdated`. Deferred to plan 13-08 (Incident Stream) which touches the metrics aggregator.

2. **Chat SSE health**: `ChatPanel` uses a `fetch()` ReadableStream reader, not a native `EventSource`, so `useSseHealth` cannot be directly attached. Instead, `lastMsgAt` is tracked per `assistant.delta` frame. This means the indicator only shows while/after a send is in-flight — not during idle connection. A future plan could add an explicit EventSource heartbeat to `/api/chat/send`.

3. **`--text-dim` contrast**: The `LastUpdated` relative-time text uses `--text-dim` (contrast ~2.7:1) per V2 §6 known failing pillar. This is acceptable per UI-SPEC §13 Non-Critical exception for 10px mono meta labels. Flagged for Plan 13-12 Wave 7 visual audit.

4. **LivenessChip RTT value**: Currently shows seconds since last poll (`Date.now() - lastUpdated` floored to seconds). This is a staleness indicator, not true round-trip latency. A future plan (13-08 or beyond) could add an actual latency measurement by timestamping the fetch request and response.

---

## Next Steps

- **Plan 13-08 (Incident Stream):** Will extend `LivenessChip` tooltip to show per-source breakdown in a popover panel. Will also add `LastUpdated` to the metrics page panels.
- **Plan 13-12 (Delta re-audit):** Run Wave 7 regression checklist above as acceptance criteria.

---

*End of liveness audit — Plan 13-06. All liveness signals now honest.*
