---
phase: 13-ui-ux-review-polish-loop
plan: "08"
subsystem: incident-stream
tags: [SSE, tail, pino, incident-stream, breadcrumb, client-log-bus, debug, REQ-P13-05, REQ-P13-10]

dependency_graph:
  requires:
    - phase: 13-05
      provides: .cae/logs/dashboard.log.jsonl pino multistream file sink
    - phase: 13-07
      provides: /metrics layout (Golden Signals panels for IncidentStream mounting slot)
  provides:
    - lib/incidents-stream.ts: tailJsonl() + filterLevel() — history read + 500ms stat-poll
    - app/api/incidents/route.ts: GET SSE endpoint filtering level>=warn, nodejs runtime
    - components/shell/incident-stream.tsx: live panel (severity badges, expand-on-click, auto-scroll)
    - lib/client-log-bus.ts: 50-entry ring buffer + CustomEvent dispatch + subscribe()
    - components/shell/debug-breadcrumb-panel.tsx: dev-mode floating panel of client log breadcrumbs
    - audit/UI-AUDIT-incident-stream.md: D-07 compliance audit + security review
  affects: [13-09, 13-10, 13-11, 13-12]

tech_stack:
  added: []
  patterns:
    - stat+poll tail (500ms interval, stat size comparison) — Linux-safe, no ENOENT risk
    - SSE ReadableStream with AbortController coordination for clean watcher teardown
    - CustomEvent 'cae:log' dispatcher — decoupled client event bus, no shared context needed
    - Dev-mode gate pattern: hooks before gate, `if (!dev) return null` after all hooks

key_files:
  created:
    - lib/incidents-stream.ts
    - lib/incidents-stream.test.ts
    - app/api/incidents/route.ts
    - app/api/incidents/route.test.ts
    - components/shell/incident-stream.tsx
    - components/shell/incident-stream.test.tsx
    - lib/client-log-bus.ts
    - lib/client-log-bus.test.ts
    - components/shell/debug-breadcrumb-panel.tsx
    - components/shell/debug-breadcrumb-panel.test.tsx
    - .planning/phases/13-ui-ux-review-polish-loop/audit/UI-AUDIT-incident-stream.md
  modified:
    - app/metrics/metrics-client.tsx (IncidentStream mounted in 2-col grid)
    - app/layout.tsx (DebugBreadcrumbPanel mounted, session-gated)
    - components/root-error-boundary.tsx (componentDidCatch now calls clientLog)

key_decisions:
  - "13-08: stat+poll (500ms) instead of fs.watch — more predictable under Linux, no ENOENT crash when file missing"
  - "13-08: AbortController coordinates req.signal + stream.cancel() + tailJsonl signal — single close() path"
  - "13-08: IncidentStream mounted in 2-col grid row with SpendingPanel; Reliability+Speed in second row"
  - "13-08: DebugBreadcrumbPanel uses hooks before dev-mode gate (React rules); returns null after"
  - "13-08: subscribe() in client-log-bus is a synchronous callback path (not CustomEvent) for test assertions"

metrics:
  duration: "~70 minutes"
  completed: "2026-04-23T06:25:00Z"
  tasks_completed: 3
  files_created: 11
  files_modified: 3
  commits: 3
  tests_added: 36
  tests_before: 644
  tests_after: 680
---

# Phase 13 Plan 08: Incident Stream + Debug Breadcrumb Panel — Summary

**One-liner:** Surfaced pino JSONL logs as a live SSE stream on /metrics with severity-badged IncidentStream panel + dev-mode floating DebugBreadcrumbPanel backed by a 50-entry client ring buffer — "logs suck" resolved with zero new data sources.

## What Was Built

### Task 1: lib/incidents-stream.ts + /api/incidents SSE route

**`lib/incidents-stream.ts`** (186 lines)
- `filterLevel(min)` — predicate passing warn/error/fatal (or error/fatal only)
- `tailJsonl(file, opts)` — async function that:
  1. Reads last `historyLimit` (default 50) matching lines using readline (memory-efficient)
  2. Starts 500ms stat+poll loop, emitting new lines appended since last check
  3. Skips malformed JSON lines silently (no crash)
  4. Handles missing file gracefully (history read skipped, polling begins from offset 0)
  5. Returns `close()` fn; also wires to `opts.signal` AbortSignal
- **9 tests**: filterLevel both variants, history limit, real-time tail, info-skip, malformed-skip, file-not-exist, close-after-stop

**`app/api/incidents/route.ts`** (83 lines)
- `export const runtime = "nodejs"` — required for AsyncLocalStorage + fs APIs
- GET endpoint returning `text/event-stream`, `cache-control: no-cache, no-transform`
- Opens `tailJsonl` with `filterLevel("warn")`, `historyLimit: 50`
- AbortController wires `req.signal` + `stream.cancel()` → single clean close path
- Wrapped with `withLog` from plan 13-05 for correlation ID + structured logging
- **5 tests**: status 200, content-type, SSE frame content, filter arg check, abort wiring

### Task 2: IncidentStream panel + /metrics mount

**`components/shell/incident-stream.tsx`** (239 lines)
- `EventSource` opened to `/api/incidents` on mount, closed on unmount
- State: accumulates max 200 entries, newest-first
- Severity badges: warn=amber (`var(--warning)`), error/fatal=red (`var(--danger)`)
- Click row → expand JSON detail (`scope`, `reqId`, `route`, full ctx)
- Empty state: "No incidents since {HH:mm:ss}. Gateway healthy." with check icon
- Auto-scroll to top on new entry; `isPausedRef` set on `mouseenter`, cleared on `mouseleave`
- **7 tests**: empty state, warn badge, error badge, newest-first order, expand detail, detail fields, unmount cleanup

**`app/metrics/metrics-client.tsx`** — restructured to 2-row layout:
- Row 1: SpendingPanel + IncidentStream (2-col grid, stacks on mobile)
- Row 2: ReliabilityPanel + SpeedPanel

### Task 3: Client log bus + DebugBreadcrumbPanel + audit

**`lib/client-log-bus.ts`** (114 lines)
- Module-level ring buffer (capacity 50, oldest drops on overflow)
- `clientLog(level, scope, msg, ctx)` — pushes to buffer + notifies subscribers + dispatches `CustomEvent('cae:log', {detail: entry})`
- `getBuffer()` — returns shallow copy (caller mutation safe)
- `clearBuffer()` — empties buffer (test utility + future "clear" UI)
- `subscribe(cb)` — synchronous callback path for testing; returns unsubscribe fn
- Server-safe: `typeof window !== "undefined"` guard around dispatchEvent
- **8 tests**: push order, copy semantics, all fields, capacity 50, clearBuffer, CustomEvent, subscribe, unsubscribe

**`components/shell/debug-breadcrumb-panel.tsx`** (156 lines)
- `useDevMode()` gate — returns null when dev-mode off; all hooks run before gate (React rules)
- Fixed `bottom-2 right-2 z-50` position, collapsed by default
- Toggle button shows entry count (`breadcrumbs (N)`) so activity visible while collapsed
- Expanded: 50 entries newest-first, level indicator (E/W/I/D) with severity color
- Click entry → JSON detail; click same entry again → close detail
- Live-updates via `window.addEventListener('cae:log', ...)` + `setEntries(prev => [...prev, entry].slice(-50))`
- Mounted in `app/layout.tsx` inside DevModeProvider, session-gated
- **7 tests**: dev-off returns null, toggle button, collapsed default, expand entries, empty state, entry detail, live cae:log event

**`components/root-error-boundary.tsx`** — `componentDidCatch` now also calls `clientLog("error", "boundary", error.message, {stack, componentStack})` so React render errors appear in the breadcrumb panel in addition to being POSTed server-side.

**`audit/UI-AUDIT-incident-stream.md`** (164 lines) — D-07 compliance audit:
- Evidence table proving data source pre-existed (plan 13-05)
- Component inventory with line counts vs min_lines thresholds
- Data flow diagram (pino → JSONL → SSE → panel + CustomEvent → breadcrumb)
- STRIDE threat review (T-13-08-01 through T-13-08-04)
- D-06 tension resolution
- REQ-P13-05 full satisfaction checklist

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `4929010` | feat | incidents stream SSE endpoint + tail library |
| `201f1ba` | feat | IncidentStream panel + /metrics mount |
| `062e5bd` | feat | client log bus + DebugBreadcrumbPanel + IA audit |

## Data Flow Diagram

```
.cae/logs/dashboard.log.jsonl   (pino multistream, plan 13-05)
        │
        ▼
lib/incidents-stream.ts         history read (readline) + 500ms stat-poll
  tailJsonl(file, {filter: filterLevel("warn"), historyLimit: 50})
        │
        ▼
app/api/incidents/route.ts      GET SSE, nodejs runtime, withLog
  → ReadableStream               "data: {json}\n\n" frames
        │
        ├──► components/shell/incident-stream.tsx   (/metrics, 2-col row 1)
        │     EventSource → severity badges + expand + auto-scroll
        │
        └──► (Phase 14 hook: LivenessChip tooltip count "Incidents: N")


window.CustomEvent('cae:log')   (clientLog() in lib/client-log-bus.ts)
        │                       also: RootErrorBoundary.componentDidCatch
        ▼
components/shell/debug-breadcrumb-panel.tsx   (layout.tsx, dev-mode only)
  fixed bottom-right → toggle → 50 entries newest-first → JSON detail
```

## Test Delta

| Phase | Tests |
|-------|-------|
| Before (13-07 baseline) | 644 |
| After Task 1 (tail lib + SSE route) | 658 (+14) |
| After Task 2 (IncidentStream panel) | 665 (+7) |
| After Task 3 (client-log-bus + panel) | 680 (+15) |
| **Total added** | **+36** |

## Deviations from Plan

None — plan executed exactly as written.

All artifacts meet or exceed min_lines thresholds. TDD RED→GREEN cycle completed for all 3 tasks. Zero new tsc errors from our files. Zero regressions in pre-existing tests.

The only divergence: `tailJsonl` signature uses `signal` instead of separate `close()` return in the options — close() is returned AND signal is supported, so both patterns work. This is a superset of the plan spec, not a deviation.

## Known Stubs

- `IncidentStream`: auto-scroll is implemented but not tested (scroll behavior requires real DOM scroll position, which jsdom doesn't simulate). Functional at runtime; test coverage limited to state assertions.
- LivenessChip tooltip "Incidents: N" is noted as future hookup (Phase 14) — documented in audit. Panel data is available via SSE; wiring it to LivenessChip requires a shared context (Rule 4 territory, not done here).

## Threat Flags

No new threat surface beyond the plan's threat model. All four threat IDs (T-13-08-01 through T-13-08-04) have dispositions matching the plan threat register.

## Self-Check

- [x] `lib/incidents-stream.ts` exists: 186 lines (≥40 required)
- [x] `app/api/incidents/route.ts` exists: 83 lines (≥50 required)
- [x] `components/shell/incident-stream.tsx` exists: 239 lines (≥70 required)
- [x] `components/shell/debug-breadcrumb-panel.tsx` exists: 156 lines (≥60 required)
- [x] `lib/client-log-bus.ts` exists: 114 lines (≥30 required)
- [x] `audit/UI-AUDIT-incident-stream.md` exists: 164 lines (≥50 required)
- [x] `grep -q "IncidentStream" app/metrics/metrics-client.tsx` → true
- [x] `grep -q "DebugBreadcrumbPanel" app/layout.tsx` → true
- [x] `grep -q "clientLog" components/root-error-boundary.tsx` → true
- [x] `npx vitest run` → 680 passed, 5 pre-existing empty stubs (unchanged)
- [x] `npx tsc --noEmit` → 0 errors in our files (3 pre-existing in metrics panels, unchanged)
- [x] Commits: `4929010`, `201f1ba`, `062e5bd`
