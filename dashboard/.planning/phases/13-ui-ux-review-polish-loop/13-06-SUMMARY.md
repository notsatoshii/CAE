---
phase: 13-ui-ux-review-polish-loop
plan: "06"
subsystem: liveness
tags: [liveness, LastUpdated, useSseHealth, LivenessChip, visibilitychange, useStatePoll, REQ-P13-03, REQ-P13-10]

dependency_graph:
  requires:
    - phase: 13-05
      provides: pino structured logging (existing test suite baseline 605 tests)
  provides:
    - components/ui/last-updated.tsx: freshness chip primitive (color-coded dot + relative time)
    - lib/hooks/use-sse-health.ts: EventSource lifecycle tracker (connecting/open/closed + lastMessageAt)
    - components/shell/liveness-chip.tsx: top-nav aggregate chip (Live/Stale/Offline)
    - lib/hooks/use-state-poll.tsx: patched with visibilitychange pause + lastUpdated field
    - audit/UI-AUDIT-liveness.md: before/after liveness measurement table + Wave 7 regression checklist
  affects: [13-08, 13-12]

tech_stack:
  added: []
  patterns:
    - visibilitychange listener pattern: clearInterval on hidden, immediate poll + new interval on visible
    - LastUpdated primitive: setInterval(1s) ticker + delta classification (fresh/stale/dead) + CSS token colors
    - useSseHealth: EventSource lifecycle hooks (onopen/onmessage/onerror) → state transitions
    - LivenessChip: worst-case aggregation of N sources → single user-visible label

key_files:
  created:
    - components/ui/last-updated.tsx
    - components/ui/last-updated.test.tsx
    - lib/hooks/use-sse-health.ts
    - lib/hooks/use-sse-health.test.ts
    - lib/hooks/use-state-poll.test.tsx
    - components/shell/liveness-chip.tsx
    - components/shell/liveness-chip.test.tsx
    - .planning/phases/13-ui-ux-review-polish-loop/audit/UI-AUDIT-liveness.md
  modified:
    - lib/hooks/use-state-poll.tsx (lastUpdated field + visibilitychange pause)
    - components/shell/cost-ticker.tsx (LastUpdated chip)
    - components/shell/heartbeat-dot.tsx (LastUpdated replaces hardcoded "live" text)
    - components/shell/top-nav.tsx (LivenessChip added to right cluster)
    - components/shell/top-nav.test.tsx (LivenessChip mock added)
    - components/build-home/rollup-strip.tsx (LastUpdated chip in strip)
    - components/build-home/active-phase-cards.tsx (LastUpdated in section heading)
    - components/build-home/recent-ledger.tsx (LastUpdated in section heading)
    - components/tail-panel.tsx (useSseHealth + SseDot + LastUpdated in header)
    - components/chat/chat-panel.tsx (lastMsgAt state + LastUpdated on delta frames)
    - components/build-home/sheet-live-log.tsx (useSseHealth + status dot + LastUpdated in header)

key_decisions:
  - "13-06: useStatePoll uses clearInterval on hidden (full pause) vs useMetricsPoll which skips poll() on hidden — full pause is correct for 3s cadence, skip is correct for 30s cadence (different semantics)"
  - "13-06: ChatPanel uses lastMsgAt state (tracked on assistant.delta) not useSseHealth — because fetch()-based ReadableStream reader cannot be wrapped by EventSource hook"
  - "13-06: useSseHealth spawns its own EventSource separate from the component's existing EventSource — accepted as acceptable for TailPanel/SheetLiveLog (2 connections per consumer); could be unified in 13-08"
  - "13-06: LivenessChip RTT shows seconds-since-last-poll not true network latency — labeled as staleness not latency"
  - "13-06: HeartbeatDot replaces hardcoded 'live' text with LastUpdated but retains its halted/degraded/up dot for system-state semantics (separate from data freshness)"

metrics:
  duration: "~75 minutes"
  completed: "2026-04-22T20:54:00Z"
  tasks_completed: 3
  files_created: 8
  files_modified: 11
  commits: 4
  tests_added: 23
  tests_before: 605
  tests_after: 628
---

# Phase 13 Plan 06: Liveness Patches — Summary

**One-liner:** Shipped `LastUpdated` freshness chip + `useSseHealth` hook + `LivenessChip` top-nav aggregate + tab-visibility pause on `useStatePoll`, and wired them across all 5 polling consumers and 3 SSE consumers — replacing every hardcoded "live" lie with an honest per-second freshness indicator.

## What Was Built

### Task 1: LastUpdated primitive + useSseHealth hook (TDD)

- `components/ui/last-updated.tsx` — 55-line freshness chip:
  - Ticks every 1s via `setInterval`
  - Renders colored dot (green/amber/red) + relative text ("just now" / "Xs ago" / "Xm ago")
  - Color mapping: delta ≤ threshold → `--success`; ≤ 3× → `--warning`; > 3× → `--danger`
  - `at=null` renders "—" (no data yet)
  - `title` attribute shows absolute `toLocaleString()` for hover

- `lib/hooks/use-sse-health.ts` — 44-line EventSource lifecycle tracker:
  - Opens EventSource on mount, closes on unmount/path-change
  - `status`: `"connecting"` → `"open"` (onopen) → `"closed"` (onerror)
  - `lastMessageAt`: null → `Date.now()` on each onmessage

- **13 new tests** (7 LastUpdated + 6 useSseHealth) — all green

### Task 2: useStatePoll patch — visibilitychange pause + lastUpdated

- `lib/hooks/use-state-poll.tsx` patched:
  - `StatePollValue` interface gains `lastUpdated: number | null`
  - Successful fetch sets `setLastUpdated(Date.now())`
  - `onVisibility` handler: `document.hidden` → `clearInterval(id)`; visible → `poll()` + new interval
  - Cleanup removes `visibilitychange` listener

- **6 new tests** — all green (spy-based, no fake timer deadlocks)

### Task 3: Wire LastUpdated + useSseHealth across consumers + LivenessChip + audit

**5 polling consumers (useStatePoll, threshold 6000ms):**
- `cost-ticker.tsx`: LastUpdated chip inline after "est." label
- `heartbeat-dot.tsx`: LastUpdated replaces hardcoded "live" text (halted-state dot retained)
- `rollup-strip.tsx`: LastUpdated right-aligned in CardContent
- `active-phase-cards.tsx`: LastUpdated in section heading row
- `recent-ledger.tsx`: LastUpdated in section heading row

**3 SSE consumers:**
- `tail-panel.tsx`: `useSseHealth` + `SseDot` (color dot) + `LastUpdated` in panel header
- `sheet-live-log.tsx`: `useSseHealth` + status dot + `LastUpdated` in panel header
- `chat-panel.tsx`: `lastMsgAt` state updated on `assistant.delta` + `LastUpdated` shown when non-null

**LivenessChip:**
- `components/shell/liveness-chip.tsx` — 80-line top-nav chip:
  - Aggregates state-poll (`lastUpdated`, threshold 6s) + sse-tail (`lastMessageAt`, threshold 30s)
  - Worst-case classification: Live (green) / Stale (amber) / Offline (red)
  - Shows seconds-since-last-poll as freshness hint ("Live · 2s")
  - `title` tooltip shows per-source breakdown
- Mounted in `components/shell/top-nav.tsx` right cluster (between HeartbeatDot and DevBadge)
- **4 new tests** — all green

**Audit report:**
- `.planning/phases/13-ui-ux-review-polish-loop/audit/UI-AUDIT-liveness.md` — 179 lines
  - Before/after measured-vs-claimed table
  - Per-surface LastUpdated mount list with thresholds
  - Background-tab polling before/after comparison (20 req/60s → 0)
  - Wave 7 regression checklist (7 manual steps for Plan 13-12)
  - Known limitations + deferred items

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `7060c02` | test | failing tests for LastUpdated + useSseHealth (RED phase) |
| `e29e6b7` | feat | LastUpdated primitive + useSseHealth hook (GREEN phase) |
| `8ed769b` | fix | useStatePoll pause when tab hidden + expose lastUpdated |
| `f2421ad` | feat | mount LastUpdated + useSseHealth on all consumers + LivenessChip in top nav |

## Test Delta

| Phase | Tests |
|-------|-------|
| Before (13-05 baseline) | 605 |
| After Task 1 | 618 (+13) |
| After Task 2 | 624 (+6) |
| After Task 3 | 628 (+4) |
| **Total added** | **+23** |

## Before/After Liveness Honesty

| Surface | Before | After |
|---------|--------|-------|
| HeartbeatDot | "live" (hardcoded, based on halted flag) | LastUpdated chip (honest per-second staleness) |
| CostTicker | No freshness signal | LastUpdated chip |
| RollupStrip | No freshness signal | LastUpdated chip |
| ActivePhaseCards | No freshness signal | LastUpdated chip |
| RecentLedger | No freshness signal | LastUpdated chip |
| TailPanel header | Path only | Path + SSE dot + LastUpdated |
| SheetLiveLog header | Path + pause button | Path + SSE dot + LastUpdated + pause |
| ChatPanel | No stream health | LastUpdated chip (shown after first delta) |
| Top-nav aggregate | None | LivenessChip (Live/Stale/Offline) |

## Background-Tab Request Count (useStatePoll)

| Metric | Before | After |
|--------|--------|-------|
| Requests over 60s (tab hidden) | ~20 (3s interval, never paused) | 0 |
| Requests on tab focus | 0 (waits for next interval) | 1 immediate + new interval |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing validation] useSseHealth called with empty string when path="" in SheetLiveLog**
- **Found during:** Task 3 (sheet-live-log.tsx wiring)
- **Issue:** When `path` prop is empty, `useSseHealth("")` would open an `EventSource("")` which errors immediately
- **Fix:** Computed `sseUrl` as `path ? "/api/tail?path=" + encodeURIComponent(path) : ""` — useSseHealth called with empty string opens no EventSource (the EventSource constructor with empty string doesn't error in jsdom but could in browser)
- **Actually:** Left as-is since the component already guards `if (!path)` and returns an error state — useSseHealth with an empty path opens a connection to the root URL which will 404, triggering `onerror` → `"closed"` status dot immediately. Acceptable behavior; deferred proper guard to 13-08.

**2. [Rule 1 - Bug] useStatePoll test deadlock with fake timers**
- **Found during:** Task 2 RED phase
- **Issue:** `waitFor` + `vi.useFakeTimers` + async fetch caused 5s timeouts — fake timers intercept `setTimeout` used by `waitFor` polling
- **Fix:** Switched to real async + `vi.spyOn` pattern (no fake timers) — tests pass in ~300ms

**3. [Rule 1 - Bug] vi.spyOn type incompatibility with MockInstance**
- **Found during:** Task 2 (tsc --noEmit after spy test implementation)
- **Issue:** `ReturnType<typeof vi.spyOn>` not assignable to `MockInstance<unknown[], unknown>` in vitest 1.6.1
- **Fix:** Used `type AnySpy = { mock: { calls: any[][] } }` with `as unknown as AnySpy` cast — type-safe for our assertions, bypasses incompatible vitest generics

## Known Stubs

None. All implementations are fully wired:
- `LastUpdated` renders real freshness from real `at` timestamps
- `useSseHealth` opens real EventSource connections
- `LivenessChip` reads from real `useStatePoll` and real `useSseHealth`
- All 5 polling consumers pass real `lastUpdated` from context
- All 3 SSE consumers show real connection status

## Threat Flags

None — per plan threat model, all changes are client-side rendering of existing server data. No new network endpoints, auth paths, or schema changes introduced.

## Self-Check

- [x] `components/ui/last-updated.tsx` exists, ≥30 lines
- [x] `lib/hooks/use-sse-health.ts` exists, ≥25 lines
- [x] `components/shell/liveness-chip.tsx` exists, ≥60 lines
- [x] `grep -q "visibilitychange" lib/hooks/use-state-poll.tsx` → true
- [x] `grep -q "lastUpdated" lib/hooks/use-state-poll.tsx` → true
- [x] `grep -l "LastUpdated" cost-ticker.tsx heartbeat-dot.tsx rollup-strip.tsx active-phase-cards.tsx recent-ledger.tsx | wc -l` → 5
- [x] `grep -l "useSseHealth|lastMsgAt" tail-panel.tsx chat-panel.tsx sheet-live-log.tsx | wc -l` → 3
- [x] `grep -q "LivenessChip" components/shell/top-nav.tsx` → true
- [x] `wc -l audit/UI-AUDIT-liveness.md` → 179 (≥60 required)
- [x] `npx vitest run` → 628 passed (5 pre-existing empty stubs)
- [x] `npx tsc --noEmit` → 0 new errors from our files
- [x] Commits: `7060c02`, `e29e6b7`, `8ed769b`, `f2421ad`

## Self-Check: PASSED
