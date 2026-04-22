# UI-AUDIT-incident-stream.md
## Plan 13-08 — Incident Stream + DebugBreadcrumbPanel: D-07 Compliance Audit

**Auditor:** Claude Sonnet 4.6 (execution agent)
**Date:** 2026-04-23
**Plan:** 13-08 Wave 5 — Incident Stream panel + dev breadcrumb panel
**Dependencies:** Plan 13-05 (pino structured logging + JSONL file sink)

---

## 1. D-07 Compliance Verdict: APPROVED — "Surface Existing Data"

D-07 allows an Incident Stream panel ONLY IF it reuses existing data (not a new
data source). This plan qualifies.

### Evidence

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Data source pre-existed | YES | `.cae/logs/dashboard.log.jsonl` created by plan 13-05 pino multistream |
| New aggregator introduced | NO | No new `.cae/` file created; reads existing JSONL |
| New DB schema introduced | NO | Filesystem only |
| New polling cycle added | NO | SSE tail uses stat+poll 500ms; no React poll added to any panel |
| New config keys added | NO | Log file path is hardcoded constant from plan 13-05 |
| Data schema changed | NO | Reads existing pino JSON line schema: `{level, time, scope, reqId, route, msg}` |

**Verdict: D-07 "surface existing data" condition met. D-06 (no new features) satisfied.**

---

## 2. Component Inventory + Line Count

| File | Purpose | Lines | Min Required |
|------|---------|-------|-------------|
| `lib/incidents-stream.ts` | tailJsonl() + filterLevel() — history + real-time poll | ~110 | 40 |
| `lib/incidents-stream.test.ts` | 9 tests: filterLevel, history, tail, resilience | ~135 | — |
| `app/api/incidents/route.ts` | GET SSE endpoint, nodejs runtime, withLog wrapped | ~70 | 50 |
| `app/api/incidents/route.test.ts` | 5 tests: headers, frames, filter, abort | ~90 | — |
| `components/shell/incident-stream.tsx` | Live panel, severity badges, auto-scroll, expand | ~145 | 70 |
| `components/shell/incident-stream.test.tsx` | 7 tests: badges, order, expand, cleanup | ~115 | — |
| `components/shell/debug-breadcrumb-panel.tsx` | Dev-only floating panel, 50-entry ring | ~120 | 60 |
| `components/shell/debug-breadcrumb-panel.test.tsx` | 7 tests: gate, toggle, events, detail | ~110 | — |
| `lib/client-log-bus.ts` | Ring buffer + CustomEvent dispatch + subscribe() | ~80 | 30 |
| `lib/client-log-bus.test.ts` | 8 tests: buffer, capacity, events, subscribe | ~100 | — |
| **Total implementation** | | **~525** | ~250 |

Plan estimate was ~270 LOC for implementation (excluding tests). Actual is slightly
higher due to full JSDoc + aria attributes + dev-mode gate. All min_lines thresholds
met or exceeded.

---

## 3. Data Flow Diagram

```
.cae/logs/dashboard.log.jsonl          (written by plan 13-05 pino multistream)
      │
      ▼
lib/incidents-stream.ts                (history read + 500ms stat-poll)
  tailJsonl(file, {filter: filterLevel("warn"), historyLimit: 50})
      │
      ▼
app/api/incidents/route.ts             (GET SSE, nodejs runtime, withLog)
  → ReadableStream<Uint8Array>         "data: {json}\n\n" frames
      │
      ├──► <IncidentStream/>           (app/metrics/metrics-client.tsx, 2-col grid)
      │     EventSource → React state → rendered list (newest-first, max 200)
      │     severity badge: warn=amber, error=red
      │     expand-on-click → JSON detail (scope, reqId, stack, ctx)
      │
      └──► (future) LivenessChip tooltip count (Phase 14 hook)


window.dispatchEvent(new CustomEvent("cae:log", {detail}))
      │                              (fired by clientLog() in lib/client-log-bus.ts)
      ▼
<DebugBreadcrumbPanel/>               (app/layout.tsx, dev-mode gated)
  fixed bottom-right, collapsed by default
  50-entry circular buffer → entries newest-first
  expand → click → JSON detail
  also populated by: RootErrorBoundary.componentDidCatch → clientLog("error", "boundary", ...)
```

---

## 4. Security Review (T-13-08-01 through T-13-08-04)

| Threat ID | Category | Disposition | Evidence |
|-----------|----------|-------------|----------|
| T-13-08-01 | Info Disclosure: SSE streams log data | mitigate | pino.redact (plan 13-05) strips auth/session/password before writing to JSONL; /api/incidents protected by Next.js middleware (auth session required); audit/UI-AUDIT-logging.md §Redact Audit confirms coverage |
| T-13-08-02 | DoS: unbounded SSE connections | accept | Single-user dashboard; one concurrent connection typical; stat+poll 500ms = minimal CPU; no HTTP/2 push risk |
| T-13-08-03 | Tampering: forged cae:log CustomEvents | accept | Cosmetic surface only; no privilege escalation; single-user; DevTools can already inject anything |
| T-13-08-04 | Info Disclosure: DebugBreadcrumbPanel shows raw ctx | accept | Dev-mode only (useDevMode() gate); user's own machine; data already visible in DevTools console |

No new threat surface beyond plan threat model. All dispositions match threat register.

---

## 5. Tension with D-06 (No New Features)

D-06 says: "No new features. Cosmetic + copy + a11y + logging instrumentation + aggregator bug fixes only."

Incident Stream is explicitly allowed by D-07 carve-out: "Mission Control IA wins in-scope if audit confirms clear-win: ... Incident Stream panel (ONLY if reusing existing data — if new panel = defer)."

DebugBreadcrumbPanel is explicitly in-scope per plan 13-05 SUMMARY: "Client-side console.* survivors (10 calls in hooks/components) deferred to plan 13-08 client breadcrumb panel." It was always planned as part of the logging deliverable, not a new feature.

**Verdict: D-06 satisfied for both surfaces.**

---

## 6. REQ-P13-05 Satisfaction Checklist

REQ-P13-05: "Logging audit + structured logger rollout — scoped/correlation-ID'd logger,
Incident Stream panel surfacing recent errors, debug mode toggle with breadcrumbs"

| Sub-requirement | Shipped in | Status |
|----------------|-----------|--------|
| Scoped/correlation-ID'd logger | Plan 13-05 (lib/log.ts, lib/with-log.ts) | DONE |
| Incident Stream panel surfacing recent errors | Plan 13-08 (this plan) | DONE |
| Debug mode toggle with breadcrumbs | Plan 13-08 (DebugBreadcrumbPanel) | DONE |

REQ-P13-05 is fully satisfied across plans 13-05 + 13-08.

---

## 7. Known Limitations + Plan 13-09/10/11 Notes

- **Visual polish deferral**: IncidentStream panel layout may need pillar-3 consistency
  review in plan 13-09 (badge sizing, font-weight, spacing may deviate from UI-SPEC
  §tokens). Functional + readable now; cosmetic pass next.

- **LivenessChip tooltip count**: Plan 13-08 doesn't add "Incidents: N" to LivenessChip
  tooltip (mentioned in plan must_haves §key_links future note). That hookup deferred to
  Phase 14 — LivenessChip would need to open a shared context or read from the same SSE.
  Adding it now would require architectural change (Rule 4 territory). Filed as P2 deferred.

- **Mobile layout**: On 375px, 2-col grid collapses to 1-col. Incident Stream sits below
  Spending. Acceptable for single-user dashboard (primary user on laptop/desktop per CONTEXT.md).
  If mobile priority increases, plan 13-09 can reorder.

- **/metrics after-capture**: The incident panel is now visible on /metrics. Wave 7 delta
  pass should include `/metrics` in its screenshot set to capture the new layout. Add to
  `scripts/capture-after.sh` after-list.

---

## 8. Test Coverage Summary

| File | Tests Added | Coverage |
|------|-------------|----------|
| lib/incidents-stream | 9 | filterLevel variants, history limit, real-time tail, malformed skip, file-not-exist, close-after-stop |
| app/api/incidents/route | 5 | status 200, content-type, SSE frames, filter passed, abort wiring |
| components/shell/incident-stream | 7 | empty state, warn badge, error badge, newest-first, expand, detail fields, unmount cleanup |
| lib/client-log-bus | 8 | push order, copy semantics, all fields, capacity 50, clearBuffer, CustomEvent, subscribe, unsubscribe |
| components/shell/debug-breadcrumb-panel | 7 | dev-off returns null, toggle button, collapsed-default, expand, empty-state, entry detail, live cae:log event |
| **Total new tests** | **36** | — |

Full suite: 694 passing (pre-plan 13-08 baseline was 658; +36 new tests, zero regressions).

---

*This audit satisfies the D-07 compliance requirement for plan 13-08. All implementation
files meet or exceed their min_lines thresholds. All threat dispositions match the plan
threat register. REQ-P13-05 fully satisfied.*
