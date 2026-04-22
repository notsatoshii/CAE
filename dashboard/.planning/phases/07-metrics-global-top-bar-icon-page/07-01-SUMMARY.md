---
phase: 07-metrics-global-top-bar-icon-page
plan: 01
subsystem: metrics-data-layer
tags: [wave-0, schema-drift, adapter, cross-subtree, aggregator-fix, token-plumbing]
requirements:
  - REQ-7-W0-ADAPTER
  - REQ-7-W0-SCHEMA
  - REQ-7-W0-TICKER
dependency-graph:
  requires:
    - bin/circuit_breakers.py (Python _log format is the ground-truth schema)
    - adapters/claude-code.sh (pre-patch baseline)
    - dashboard/.cae/metrics/circuit-breakers.jsonl (sample data)
    - dashboard/lib/cae-state.ts::tailJsonl (already-correct parser)
  provides:
    - "adapters/claude-code.sh emits `token_usage` events into `.cae/metrics/circuit-breakers.jsonl` after each successful claude run"
    - "dashboard/lib/cae-types.ts exports canonical CbEvent + CB_EVENT_KINDS + CbEventKind"
    - "dashboard/lib/cae-home-state.ts reads real snake_case schema (forge_begin/forge_end/escalate_to_phantom/token_usage)"
    - "dashboard/lib/cae-agents-state.ts reads real schema; wall time derived from forge_begin→forge_end ts deltas"
    - "dashboard/app/api/state/route.ts token-sum loop uses input_tokens/output_tokens; retryCount from forge_end(success:false)"
    - "dashboard/components/shell/cost-ticker.tsx is unblocked — camelCase response-envelope boundary documented"
  affects:
    - Wave 1 plans (07-02…07-06) — Spending panel now has live numbers once the adapter runs against any CAE project
tech-stack:
  added: []
  patterns:
    - "snake_case internal + camelCase API-envelope boundary (D-02)"
    - "timestamp-delta wall computation paired by (task_id, attempt)"
    - "task_id-prefix phase derivation (p{N}-...) replacing missing phaseId field"
key-files:
  created: []
  modified:
    - adapters/claude-code.sh                            # +78 lines
    - dashboard/lib/cae-types.ts                         # +61 lines
    - dashboard/lib/cae-home-state.ts                    # +145 / -108 (net +37 insertions/−37 deletions-ish per git show)
    - dashboard/lib/cae-agents-state.ts                  # +175 / -70
    - dashboard/app/api/state/route.ts                   # +20 / net minor edits
    - dashboard/components/shell/cost-ticker.tsx         # +4 comment
decisions:
  - "Fold token_usage into circuit-breakers.jsonl rather than a new tokens.jsonl file — aggregator reads ONE file"
  - "Adapter writes token_usage line from bash (no Python shell-out) for robustness"
  - "Preserve API-envelope camelCase names (inputTokensToday/outputTokensToday/retryCount) — consumers unchanged"
  - "Wall time = forge_begin→forge_end ts delta paired by (task_id, attempt); null if unmatched"
  - "Phase tag derived from task_id prefix 'p{N}-' since real jsonl has no phaseId field"
metrics:
  duration_minutes: 10
  completed_date: "2026-04-22T10:56:49Z"
  tasks_completed: 3
  files_modified: 6
  commits:
    - "4313244 adapter(07-01): emit token_usage events to circuit-breakers.jsonl"
    - "89b1e80 dashboard(07-01): add canonical CbEvent type for real jsonl schema"
    - "e346ad8 dashboard(07-01): repoint aggregators to real jsonl schema"
---

# Phase 7 Plan 1: Wave 0 Upstream Plumbing — Adapter Token Emission + Schema Drift Repair Summary

**One-liner:** Unblocked Phase 7's data layer by (1) extending the claude-code adapter to emit `token_usage` events with real token counts into `.cae/metrics/circuit-breakers.jsonl`, and (2) repointing every existing aggregator + the cost-ticker from the hallucinated camelCase schema to the real snake_case schema emitted by `bin/circuit_breakers.py`.

## What Shipped

### Task 1 — `adapters/claude-code.sh` (+78 lines) — commit `4313244`

Cross-subtree change (D-01). The adapter now:

1. **Auto-adds `--output-format json`** to `CLAUDE_ARGS` (only if caller didn't set one; today no caller sets one). This causes claude CLI to emit a single JSON document to stdout with `.usage.input_tokens` / `.usage.output_tokens` / `.usage.cache_*` fields.
2. **After a successful run (EXIT_CODE=0 and OUT_FILE non-empty)**, extracts `input_tokens` and `output_tokens` from `OUT_FILE` using **jq** when available, falling back to a **pure-bash regex** path otherwise. Numeric guards coerce malformed values back to 0.
3. **Appends a `token_usage` JSONL line** to the invoker's `<cwd>/.cae/metrics/circuit-breakers.jsonl` — but **only** when that metrics dir already exists (signal that the invoker is a CAE project). This avoids ever creating `.cae/metrics/` silently.
4. **Swallows all logging errors** via `|| true` + `2>/dev/null` so a broken metrics path can never crash the adapter.
5. Top-of-file comment block now documents the `.cae/metrics/circuit-breakers.jsonl` side effect.

**Event shape** (matches `bin/circuit_breakers.py` `_log()` field-order convention: `ts`, `event`, then alphabetical):

```json
{"ts": "2026-04-22T10:51:03Z", "event": "token_usage", "agent": "forge", "input_tokens": 1234, "model": "claude-sonnet-4-6", "output_tokens": 567, "task_id": "p2-plA-t1-xyz"}
```

- `task_id`: derived from `$(basename $TASK_FILE | sed -E 's/\.(txt|md)$//')`
- `agent`: `wrap:X` → `X`; `direct:*` → `"direct"`; otherwise `"forge"`

**Hand-tested token extraction** end-to-end against a simulated JSON envelope: jq path extracted `input=1234 output=567` correctly; numeric-guard regex matched `^[0-9]+$` on the extracted values. (Real adapter invocation against live `claude` CLI will be Wave-4 UAT — adapter is passive during test runs.)

### Task 2 — `dashboard/lib/cae-types.ts` (+61 lines) — commit `89b1e80`

Additive (zero existing exports touched). New exports:

- `interface CbEvent` — required `ts: string`, `event: string`; all other fields optional. Covers token_usage (`input_tokens`, `output_tokens`, `model`, `agent`), forge lifecycle (`task_id`, `attempt`, `success`), limits (`limit`, `detail`, `value`), sentinel (`count`, `cap`, `failures`), phantom (`forge_attempts`), halt (`reason`, `telegram_notify`).
- `const CB_EVENT_KINDS` — frozen tuple of 11 known event names including the new `"token_usage"`.
- `type CbEventKind = typeof CB_EVENT_KINDS[number]`.

### Task 3 — Repoint three aggregators + cost-ticker (+237 / -107) — commit `e346ad8`

**Field-rename substitutions applied (JSONL level):**

| Old (hallucinated)       | New (real schema)                                  |
| ------------------------ | -------------------------------------------------- |
| `e.timestamp`            | `e.ts`                                             |
| `e.taskId` (on CbEvent)  | `e.task_id`                                        |
| `e.inputTokens`          | `e.input_tokens`                                   |
| `e.outputTokens`         | `e.output_tokens`                                  |
| `e.wallMs`               | derived from `forge_begin→forge_end` ts delta      |
| `e.phaseId`              | derived from `task_id` prefix (`p{N}-...` → `p{N}`) |

**Event-name substitutions:**

| Old                     | New                                                 |
| ----------------------- | --------------------------------------------------- |
| `forge_start`           | `forge_begin`                                       |
| `forge_done`            | `forge_end && e.success === true`                   |
| `forge_fail`            | `forge_end && e.success === false`                  |
| `phantom_escalation`    | `escalate_to_phantom`                               |
| `retry` (never existed) | `forge_end && e.success === false` (for retryCount) |

**Per-file:**

- `lib/cae-home-state.ts` — rollup tokens/warnings loop; `computeAgentsActiveForPhase` concurrency tracking; `tokensForPhase`; `buildEventsRecent` (status now from `success` bool); `buildNeedsYou` failure-count loop; `buildGlobalActiveAgents` forge-lifecycle pairing. Added helpers `eventTaskId`, `eventPhasePrefix`. Old camelCase helpers rewritten on CbEvent.
- `lib/cae-agents-state.ts` — roster build pre-computes a `Map<task_id::attempt, beginTs>` from forge_begin rows, then pairs it with forge_end for wall-time derivation. Concurrency tracker swapped to forge_begin / forge_end. `getAgentDetail` lifetime pass + recent_invocations do the same pairing. Removed `eventWallMs` + `derivePlanFromPhase` helpers; added `eventTaskId`, `eventAttempt`, `eventPhasePrefix`, `wallMsFromDelta`, `derivePlanFromTaskId`.
- `app/api/state/route.ts` — token-sum loop reads `e.ts`, `e.input_tokens`, `e.output_tokens`; retryCount counts `forge_end` rows with `success === false`. **Response envelope keys remain camelCase** (`inputTokensToday`, `outputTokensToday`, `retryCount`) — documented inline as the intentional boundary between snake_case JSONL internals and camelCase API contract. Consumers unchanged.
- `components/shell/cost-ticker.tsx` — sole change is an inline comment documenting the camelCase envelope boundary; the read `data.breakers.inputTokensToday + data.breakers.outputTokensToday` is preserved because `/api/state` now returns real sums under those keys.

**Wall-time TODO:** the per-attempt pairing is simple and correct for well-formed streams. Edge cases (rerun with same attempt number on different days, missed forge_end, etc.) are left for the Phase 7 Wave 1 `cae-metrics-state.ts` aggregator which will own canonical wall-time math. Flagged with a `TODO(Phase 7 Wave 1...)` comment in `cae-agents-state.ts`.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Blocker] TS2352 on `Record<string, unknown> → CbEvent` casts in cae-agents-state.ts**
- **Found during:** Task 3 after initial tsc run
- **Issue:** TypeScript rejected direct `p.ce.event as CbEvent` cast (insufficient overlap, `ts`/`event` required on target).
- **Fix:** 6 casts rewritten to `as unknown as CbEvent`. Behavior unchanged — defensive typeof guards on every field read prevent crashes on malformed rows (matches the "aggregators MUST use typeof-guards" rule documented in CbEvent's JSDoc).
- **Commit:** `e346ad8`

**2. [Rule 2 — Critical correctness] Wall-time derivation** (explicitly called for by plan task 3 §C)
- **Fix:** Pre-pass builds `(task_id::attempt → beginTs)` map on a ts-ascending scan, used during the main pass to compute `Date.parse(endTs) - Date.parse(beginTs)` for each `forge_end`. Negative/NaN deltas return null and are skipped.

### Non-auto-fixed (intentional preservation, called out by plan)

**3. API-envelope camelCase names preserved**
- `/api/state` response still returns `inputTokensToday`, `outputTokensToday`, `retryCount` (camelCase).
- **Reason:** Breaking the envelope would cascade into cost-ticker, use-state-poll type, and future consumers. The plan explicitly mandates this (D-02 boundary).
- **Orchestrator-criterion collision noted:** the orchestrator's bare `grep 'inputTokens\|forge_start\|forge_done'` check counts substring matches inside `inputTokensToday` — 7 such hits remain across `app/api/state/route.ts` (envelope assignment) and `components/shell/cost-ticker.tsx` (envelope read) + comments explaining the boundary. All 7 are the intentional envelope surface, not CbEvent-field reads. The plan's own success-criterion wording ("ZERO CbEvent-field reads using taskId/inputTokens/outputTokens/wallMs") is the authoritative success gate and IS satisfied — no CbEvent-field reads use the old names anywhere.

**4. `phaseNumberFromDir` helper in cae-home-state.ts**
- Still defined but no longer called (old code path used it to parse phaseId strings). Not removed to keep this plan's diff scoped; future hygiene cleanup OK.
- TypeScript noUnusedLocals is not aggressive enough here to block the build — confirmed via `pnpm tsc --noEmit` passing.

## Authentication Gates

None — this plan is pure plumbing / rewrites; no external auth needed.

## Verification Results

| Check                                                                           | Result                                    |
| ------------------------------------------------------------------------------- | ----------------------------------------- |
| `bash -n adapters/claude-code.sh`                                               | ✓ exit 0                                  |
| `grep` for `token_usage`, `input_tokens`, `output_tokens`, `CB_JSONL`, `\|\| true`, `output-format json` in adapter | ✓ all present                  |
| `grep` for `export interface CbEvent` / `CB_EVENT_KINDS` / every event name in cae-types.ts | ✓ all present                             |
| Hand-tested token extraction against fake JSON envelope (jq path)               | ✓ input=1234 output=567                   |
| `grep -rnE "forge_start\|forge_done\|forge_fail\|phantom_escalation"` across 3 aggregator files | ✓ 0 hits                                  |
| `grep -rnE "\.taskId\|\.inputTokens\|\.outputTokens\|\.wallMs"` on CbEvent-field reads in aggregators | ✓ 0 CbEvent-field hits (only OutboxTask/InboxTask/TaskStatus field hits remain, which are legitimate TS-declared fields on other types) |
| `pnpm tsc --noEmit`                                                             | ✓ exit 0                                  |
| `pnpm build`                                                                    | ✓ exit 0 — all 10 static pages generated  |
| Cost-ticker still compiles (camelCase envelope preserved)                       | ✓ renders unchanged                       |

**Non-zero-token smoke (deferred to Wave 4 UAT):** requires a real adapter run against a live `claude` CLI session in a CAE project. Adapter code paths verified symbolically + by end-to-end jq/regex hand-test on synthetic JSON envelope.

## Known Stubs

None. Every modified file is fully wired end-to-end:
- Adapter: real extraction, real file write (not a no-op)
- cae-types.ts: full type surface
- Aggregators: real computation; wall time now derived instead of stubbed
- cost-ticker: consumes real (non-zero) data once the adapter runs against a live project

## Plan-checker Watch Items

| # | Item                                                                         | Status                                                                 |
| - | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1 | Adapter `--output-format json` injection + jq extract                        | ✓ unconditional injection (guarded by `CALLER_SET_OUTPUT_FORMAT=0` default); jq+regex paths both implemented; hand-tested with fake envelope producing `input=1234 output=567` |
| 2 | Task 3 BigNumber `~` prefix in labels.ts                                     | N/A — labels.ts not touched this plan; deferred to 07-02               |
| 3 | `lucide-react` referenced in 07-05                                           | N/A — not touched this plan; non-blocking                              |
| 4 | Manual-gate curl/auth-redirect (07-06)                                       | N/A — deferred to 07-06                                                |

## Commits

| Task | Scope            | Commit   | Files                                                                                  | Insert/Delete |
| ---- | ---------------- | -------- | -------------------------------------------------------------------------------------- | ------------- |
| 1    | `adapter(07-01)` | 4313244  | adapters/claude-code.sh                                                                 | +78 / 0       |
| 2    | `dashboard(07-01)` | 89b1e80  | dashboard/lib/cae-types.ts                                                              | +61 / 0       |
| 3    | `dashboard(07-01)` | e346ad8  | dashboard/lib/cae-home-state.ts, dashboard/lib/cae-agents-state.ts, dashboard/app/api/state/route.ts, dashboard/components/shell/cost-ticker.tsx | +237 / -107   |

## Self-Check: PASSED

- Adapter file present, parses, contains every required token: ✓
- cae-types.ts contains `CbEvent` + `CB_EVENT_KINDS` + `CbEventKind`: ✓
- Three aggregator files contain `forge_begin` + `forge_end` (and `escalate_to_phantom` in home-state), zero hallucinated event names: ✓
- `pnpm tsc --noEmit` passes: ✓
- `pnpm build` passes: ✓
- Three commit hashes exist in `git log --oneline --all`: ✓
- Commit scopes follow plan rules (`adapter(07-01)` for cross-subtree, `dashboard(07-01)` for dashboard files): ✓
