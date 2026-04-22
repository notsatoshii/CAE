---
phase: 13-ui-ux-review-polish-loop
plan: "03"
subsystem: audit
tags: [correctness-audit, verify, WR-01, chat-unread, data-correctness, static-analysis]

dependency_graph:
  requires:
    - phase: 13-01
      provides: verify.py scaffold, audit harness
    - phase: 13-02
      provides: BASELINE.md, capture baseline
  provides:
    - verify.py with 17 panels (V2 §1 complete coverage)
    - audit/VERIFY.md (17-row machine-generated table, WR-01 confirmed)
    - audit/UI-AUDIT-correctness.md (277-line ranked P0→P2 findings)
  affects: [13-04, 13-05, 13-07, 13-09, 13-10, 13-11]

tech_stack:
  added: []
  patterns:
    - source-only-audit-mode (auth-deferred fallback with computed source values)
    - static-code-analysis-confirmation (WR-01 confirmed without live session)

key_files:
  created:
    - .planning/phases/13-ui-ux-review-polish-loop/audit/VERIFY.md
    - .planning/phases/13-ui-ux-review-polish-loop/audit/UI-AUDIT-correctness.md
  modified:
    - .planning/phases/13-ui-ux-review-polish-loop/scripts/verify.py

key_decisions:
  - "13-03: verify.py SOURCE-ONLY mode runs full source analysis + WR-01 static confirmation when storage-state.json absent; 14 panels show AUTH-DEFERRED with computed source values"
  - "13-03: WR-01 confirmed via static code analysis (no live auth required): 4 randomUUID() calls in send/route.ts stream — lines 165, 213, 222, 273 — each overwrites client lastSeenMsgId via chat-panel.tsx:200"
  - "13-03: 2 panels (in_flight, wave_current) marked UNVERIFIABLE — derivation requires re-implementing cae-phase-detail.ts task-status logic; recommendation: add /api/state?debug=1"
  - "13-03: Pre-auth discovery: circuit-breakers.jsonl forge_end events have no input_tokens/output_tokens — recent ledger token sums always 0 (P1 logging gap, not aggregator bug)"
  - "13-03: chat-panel.tsx:200 unconditionally calls setLastSeenMsgId(id) on every SSE frame — this is the client-side amplifier of the WR-01 UUID overwrite bug"

requirements-completed: [REQ-P13-02]

metrics:
  duration: "~35 minutes"
  completed: "2026-04-23T05:10:00Z"
  tasks_completed: 2
  files_created: 2
  files_modified: 1
  commits: 2
---

# Phase 13 Plan 03: Wave 1.5 Data Correctness Audit — Summary

**One-liner:** verify.py expanded to 17 panels with full V2 §1 source-of-truth map coverage; WR-01 (chat unread always 0) confirmed via static code analysis; UI-AUDIT-correctness.md produced with ranked P0→P2 findings grounded in source evidence.

## Panel Coverage

| Metric | Count |
|--------|-------|
| Total panels audited | 17 |
| Confirmed bugs (static analysis) | 1 (WR-01) |
| Auth-deferred (need live API) | 14 |
| Unverifiable (derivation too complex) | 2 |
| Source values computed pre-auth | 14 |

## Mismatch Summary + Severity Breakdown

| Severity | Count | Status |
|----------|-------|--------|
| P0 CONFIRMED | 1 | WR-01: chat unread always 0 |
| P0 AUTH-DEFERRED | 5 | cost-ticker, rollup-tokens, blocked-self-consistency, agents-7d-guard, metrics-mtd |
| P1 AUTH-DEFERRED + discovered | 7 | heartbeat, shipped-today, warnings, needs-you, recent-ledger, changes, **token-logging gap** |
| P2 AUTH-DEFERRED | 3 | queue, memory-tree, active-phase-progress |

## Pre-Confirmed Findings That Surfaced

**WR-01** surfaced as ❌ CODE-BUG — static analysis confirmed 4 randomUUID() calls in stream (lines 165/213/222/273 of `app/api/chat/send/route.ts`). This matches V2 §1 pre-finding exactly.

## Pre-Confirmed Findings That Did NOT Surface (Limitations)

The rollup tokens_today vs cost ticker rounding quirk (V2 pre-finding "possible") could not be confirmed without live API data. The tail-size discrepancy (200 vs 500 rows in two code paths) was identified as a **structural mismatch** and documented as P0 auth-deferred.

## Pre-Auth Discovery (Not in V2 Pre-Findings)

**`circuit-breakers.jsonl` forge_end events have no token fields.** All 30 rows in `dashboard/.cae/metrics/circuit-breakers.jsonl` were inspected — none have `input_tokens` or `output_tokens`. This means:
- Recent ledger shows 0 tokens for all tasks (not an aggregator bug — data pipeline gap)
- The Python-side `circuit_breakers.py forge_end` logger must be updated to include token counts from the Claude CLI output
- Severity: P1 (logging gap, not data corruption)

## Downstream Plan Consumption

| Finding | Severity | Consumed by |
|---------|----------|-------------|
| WR-01: chat unread | P0 | plan 13-04 (Wave 2 — fix) |
| Token logging gap | P1 | plan 13-05 (logging audit — structured logger + token instrumentation) |
| Aggregator correctness (tail-size, blocked self-consistency) | P0/P1 | plans 13-09/13-10 (Wave 6 aggregator fixes) |
| debug endpoint (in_flight, wave_current) | P2 | plan 13-09 |
| Full auth-enabled audit re-run | N/A | plan 13-07 (delta re-audit, after authsetup.sh) |

## Artifacts Produced

| Artifact | Lines | Status |
|----------|-------|--------|
| `scripts/verify.py` | 450+ | UPDATED — 17 PANELS, SOURCE-ONLY mode, WR-01 static analysis |
| `audit/VERIFY.md` | 40 | GENERATED — 17-row table, 1 ❌, 14 ⚠️ AUTH-DEFERRED, 2 ⚠️ UNVERIFIABLE |
| `audit/UI-AUDIT-correctness.md` | 277 | CREATED — P0→P2 findings, fix sketches, plan mapping |

## Deviations from Plan

### Auto-determined Strategy Change: SOURCE-ONLY mode

**Found during:** Task 1 setup  
**Issue:** Plan Task 1 specification assumed storage-state.json would be present for live API comparison. It is deferred per session-7 directive.  
**Resolution (Rule 2 — missing critical functionality):** Implemented SOURCE-ONLY mode in verify.py: source values computed for all panels, API comparison skipped with `⚠️ AUTH-DEFERRED` verdict, WR-01 confirmed via static analysis path (no auth needed). This preserves full value of the audit while respecting the auth gate constraint.  
**Files modified:** `scripts/verify.py`  
**No commit needed:** Handled within Task 1 commit.

### Pre-Auth Discovery: Token Logging Gap

**Found during:** Panel 11 (recent ledger) source_fn inspection  
**Issue:** `dashboard/.cae/metrics/circuit-breakers.jsonl` has 0 token-bearing events — all forge_end rows lack `input_tokens`/`output_tokens`. This is a P1 finding not in V2 pre-research.  
**Action (Rule 2):** Documented as finding in UI-AUDIT-correctness.md under "Pre-Auth Discovery" section + added to plan 13-05 backlog.  
**Production code modified:** None.

## Known Stubs

None. This plan produces observational artifacts only — no UI code, no data wiring.

## Threat Flags

None. verify.py reads only local `.jsonl` and `.planning/` files (same trust as existing harness). UI-AUDIT-correctness.md and VERIFY.md are local audit outputs, not production code.

## Self-Check

- [x] `scripts/verify.py` exists, has ≥17 PANELS entries (`grep -c 'PANELS.append' verify.py` → 17)
- [x] `audit/VERIFY.md` exists, non-empty, has ≥17 verdict rows
- [x] `audit/VERIFY.md` contains "❌ CODE-BUG" row for WR-01
- [x] `audit/UI-AUDIT-correctness.md` exists, 277 lines (≥80 requirement met)
- [x] `audit/UI-AUDIT-correctness.md` contains "WR-01" and "Finding 1"
- [x] `audit/UI-AUDIT-correctness.md` contains "P0", "P1", "P2" severity tags
- [x] Task 1 commit: e13703b
- [x] Task 2 commit: 260fb3c
- [x] No production code modified (`git diff --name-only app/ lib/ components/` returns empty for 13-03 commits)
