# Phase 13 — UI Data Correctness Audit

**Produced by:** verify.py (Wave 1.5, plan 13-03)  
**Run date:** 2026-04-23  
**Mode:** SOURCE-ONLY (storage-state.json absent — auth deferred per session-7)  
**Panels audited:** 17 (V2 §1 source-of-truth map — complete coverage)  
**Confirmed bugs:** 1 (WR-01 — static code analysis, no auth required)  
**Auth-deferred panels:** 14 (require live API comparison after authsetup.sh)  
**Unverifiable panels:** 2 (derivation complexity would require re-implementing aggregator)

---

## Executive Summary

This audit confirms the V2 pre-finding: **the chat unread count is provably broken** without requiring a live auth session. Static code analysis of `app/api/chat/send/route.ts` reveals 4 `randomUUID()` calls within a single SSE stream — each overwrites `lastSeenMsgId` in the client, causing `readTranscriptAfter()` to always return `[]` and rendering unread count perpetually 0.

The remaining 14 panels are source-computible (we can compute expected values from `.jsonl` and git), but live API comparison requires `storage-state.json` from a headed OAuth session. Those panels are marked `AUTH-DEFERRED` with their computed source values documented. Run `bash authsetup.sh` to unblock them.

**Severity breakdown:**
- P0 confirmed: 1 (WR-01 — data is wrong, user sees 0 unread always)
- P0 auth-deferred: 5 (cost ticker, rollup tokens, rollup blocked self-consistency, agents 7d success, metrics MTD spend — predicted mismatches per V2 research)
- P1 auth-deferred: 6 (heartbeat, shipped_today, warnings, needs-you, recent ledger, changes merges)
- P2 auth-deferred: 3 (queue counts, memory tree, active phase progress)
- Unverifiable: 2 (in_flight, wave_current)

---

## Confirmed Findings

### Finding 1: Chat unread count resets to 0 on every page reload (WR-01)

**Severity:** P0  
**Status:** CONFIRMED — static code analysis, no live session required  
**Source of truth:** `.cae/chat/{session_id}.jsonl` — assistant messages have persistent UUIDs; `readTranscriptAfter(lastSeenMsgId)` returns messages after the cursor  
**Rendered value:** 0 (always, after any page reload or navigation)  
**Expected value:** Count of assistant messages since the user last viewed the chat

**Evidence — 4 culprit lines in `app/api/chat/send/route.ts`:**

| Line | Code | Problem |
|------|------|---------|
| 165 | `const beginId = randomUUID()` | beginId correctly scoped here... |
| 213 | `encodeSSE(randomUUID(), "assistant.delta", ...)` | NEW uuid per delta frame — overwrites client lastSeenMsgId on every text chunk |
| 222 | `encodeSSE(randomUUID(), "unread_tick", ...)` | NEW uuid per tick event — also overwrites lastSeenMsgId |
| 273 | `const assistantMsgId = randomUUID()` | FINAL persist uuid is yet another fresh uuid — never equals what client saw |

**Client code that makes this fatal (`components/chat/chat-panel.tsx:200`):**
```typescript
if (id) rail.setLastSeenMsgId(id);  // Called on EVERY SSE frame
```

This unconditionally updates `lastSeenMsgId` on each frame. With `assistant.delta` and `unread_tick` frames emitting random UUIDs, the client's cursor ends up pointing to a UUID that was never persisted to the `.jsonl` file.

**How `readTranscriptAfter` uses this cursor (`lib/cae-chat-state.ts:196-205`):**
```typescript
export async function readTranscriptAfter(sessionId, afterMsgId) {
  const all = await readTranscript(sessionId);
  if (!afterMsgId) return all;
  const idx = all.findIndex((m) => m.id === afterMsgId);
  if (idx < 0) return [];           // <-- ALWAYS hits this branch
  return all.slice(idx + 1);
}
```

Because the `afterMsgId` (the last delta/tick UUID) never appears in the persisted transcript, `findIndex` returns -1 and the function returns `[]`. The `/api/chat/state?last_seen=<ephemeral-uuid>` call then reports `unreadCount = 0`.

**Fix sketch (20 lines, `app/api/chat/send/route.ts`):**
1. Line 165: Keep `const beginId = randomUUID()` — but also declare `const assistantMsgId = randomUUID()` HERE at stream start, before the stream opens. This is the ONE UUID that will be persisted.
2. Line 165–173: `encodeSSE(beginId, "assistant.begin", ...)` — keep as-is, beginId used for de-dupe.
3. Line 213: `encodeSSE("", "assistant.delta", ...)` — emit **empty string** id (or omit the `id:` field entirely). Empty id means "don't advance lastSeenMsgId cursor".
4. Line 222: `encodeSSE("", "unread_tick", ...)` — same. The unread_tick event bumps the UI counter (`rail.bumpUnread()`), it must NOT advance the cursor.
5. Line 273: `await appendMessage(sid, { id: assistantMsgId, ... })` — use the pre-generated `assistantMsgId` (same UUID throughout this entire stream invocation).
6. Line 283–289: `encodeSSE(assistantMsgId, "assistant.end", ...)` — THIS is the only frame that should advance the client cursor, because it's the UUID that was persisted.
7. Client side (`chat-panel.tsx:200`): Only update `lastSeenMsgId` for `assistant.end` frames, not all frames:
   ```typescript
   if (id && event === "assistant.end") rail.setLastSeenMsgId(id);
   ```

**Fixed by:** plan 13-04 (Wave 2)  
**Test:** After fix — send a message, navigate away, return to /chat → unread count should be ≥1.

---

## Auth-Deferred Findings (Require Live API Session)

These panels have their source values computed but cannot be fully verified without a live API comparison. Sorted by estimated severity based on V2 §1 research.

### Auth-Deferred 1: Cost ticker token count accuracy

**Severity:** P0 (predicted — Eric's "details incorrect" critique, twice)  
**Source computed:** `in=0 out=0 fmt=0` (no token-bearing events in circuit-breakers.jsonl today)  
**API path:** `/api/state → .breakers.inputTokensToday / .outputTokensToday`  
**Source of truth:** `.cae/metrics/circuit-breakers.jsonl` — sum `input_tokens` + `output_tokens` for events with `ts` starting with today's date  
**Known risk:** Phase 7 Wave 0 D-02 patched a `camelCase vs snake_case` schema drift. The API route (`app/api/state/route.ts:63-72`) reads `snake_case` fields from jsonl (correct), but any dashboard extension that writes `inputTokens` camelCase would silently produce 0.  
**Verify command after auth:** `python3 verify.py` — Cost ticker row will show API value vs source.

### Auth-Deferred 2: Rollup tokens_today vs cost ticker consistency

**Severity:** P0  
**Source computed:** `0` (matches cost ticker — source is same jsonl)  
**API path:** `/api/state → .rollup.tokens_today`  
**Consistency requirement:** `rollup.tokens_today` MUST equal `breakers.inputTokensToday + breakers.outputTokensToday`. The aggregator (`cae-home-state.ts:buildRollup`) reads the same `.cae/metrics/circuit-breakers.jsonl` but via a different code path (`tailJsonl(cbPath, 500)` vs `tailJsonl(metricsDir/circuit-breakers.jsonl, 200)` in the API route). The `200` vs `500` tail size means **the two tallies can diverge on high-activity days**.  
**Root cause hypothesis:** `app/api/state/route.ts` tails 200 rows for the breakers sum; `cae-home-state.ts buildRollup` tails 500 rows. If today has >200 token events, `rollup.tokens_today > breakers.inputTokensToday + outputTokensToday`.  
**Fix sketch:** Unify tail size or compute both from the same data slice.  
**Fixed by:** plan 13-09 or 13-10 (aggregator correctness wave)

### Auth-Deferred 3: Rollup blocked vs needs_you[blocked] self-consistency

**Severity:** P0 (self-inconsistent aggregator = silent data corruption)  
**Source computed:** Self-consistency check (both sides from same API response)  
**API path:** `/api/state → .rollup.blocked` vs `len(.needs_you[type=blocked])`  
**Issue:** `buildRollup` in `cae-home-state.ts` computes `blocked = needsYou.filter(n => n.type === "blocked").length` (line 239). These should be identical. BUT: the API route calls `getHomeState()` which caches for 1s. The `blocked` count from `buildRollup` is derived from the `needsYou` list that was passed in. If the cache is stale or if a code change altered the reference, the two counts could diverge.  
**Verify command:** After auth, check VERIFY.md "Rollup: blocked (self-consistency check)" row — if ❌ SELF-INCONSISTENT, that's a P0 aggregator cache corruption bug.  
**Fixed by:** Plan 13-09 if inconsistency confirmed

### Auth-Deferred 4: Agents 7d success % per agent

**Severity:** P0 (misleading health indicator for non-technical founders)  
**Source computed:** `forge=100.0%(6runs)` (6 forge_end events in circuit-breakers.jsonl, all success:true)  
**API path:** `/api/agents → .[i].stats_7d.success_rate`  
**Known risk:** `cae-agents-state.ts` builds success_rate from the same jsonl but with `CACHE_TTL_MS = 30_000`. On a fresh boot or sparse data, all 9 agents in AGENT_META appear in the roster even with 0 samples — their success_rate shows 0 (no completions), which the dashboard renders as 0% even for agents that just haven't been used.  
**Fix sketch:** UI should show "—" or "N/A" for agents with 0 samples in 7d (gated by `sample_n` field already in API response). The aggregator correctly sets `sample_n`; the UI needs to apply the ≥5 sample gate.  
**Fixed by:** Plan 13-04 or 13-10 (UI guard)

### Auth-Deferred 5: Metrics MTD spend

**Severity:** P0 (main cost tracking metric)  
**Source computed:** `0` (today's circuit-breakers.jsonl has 0 token-bearing events)  
**API path:** `/api/metrics → .spending.tokens_mtd`  
**Known risk:** Same tail-size issue as cost ticker. `cae-metrics-state.ts` uses `CB_TAIL_LINES = 10_000` (line 51) which is generous. However, `tokens_mtd` sums ALL events in `monthPrefix`, not just token-bearing events. Non-token events (forge_begin, forge_slot_acquired, etc.) contribute 0 tokens and are harmless — but confirm the field is populated correctly.

### Auth-Deferred 6: Heartbeat dot state accuracy

**Severity:** P1 (visual indicator — wrong state misleads about system health)  
**Source computed:** `halted=False retries=0 phantoms=0` (no halt/escalate events in last 24h)  
**API path:** `/api/state → .breakers.halted / .retryCount / .recentPhantomEscalations`  
**Known risk:** `app/api/state/route.ts` reads `getCircuitBreakerState(project)` which is a different code path from `buildRollup`. The `retryCount` in `/api/state` response counts `forge_end(success:false)` events TODAY (lines 71-72), while the heartbeat component might display a different count based on how `recentPhantomEscalations` is populated. The `escalate_to_phantom` event (not `escalate-to-phantom` — note the underscore vs hyphen) must match exactly.

### Auth-Deferred 7: Rollup shipped_today

**Severity:** P1  
**Source computed:** `0` (no DONE.md with status:success modified today, no forge merges today)  
**API path:** `/api/state → .rollup.shipped_today`  
**Known risk:** `buildRollup` uses outbox DONE.md mtime as primary source, git merges as fallback (lines 177-207). If outbox is cleared or DONE.md status field is missing/malformed, count drops to 0 even when work shipped. Also: git fallback only counts merges matching `grep -c "forge/"` — non-forge merges are not counted.

### Auth-Deferred 8: Rollup warnings

**Severity:** P1  
**Source computed:** `0` (no failed forge_end or escalate_to_phantom events in last 24h)  
**API path:** `/api/state → .rollup.warnings`  
**Known risk:** `buildRollup` counts `escalate_to_phantom` events within last 24h for phantom escalations. BUT the event name must be exactly `escalate_to_phantom` (snake_case). An earlier version of circuit_breakers.py may have emitted `escalate-to-phantom` (hyphen). Grep confirms: `grep -c "escalate_to_phantom"` in jsonl — if 0 despite system warnings, it's the event-name mismatch.

### Auth-Deferred 9: Needs-you count accuracy

**Severity:** P1  
**Source computed:** `0` (no failed tasks meeting 3× threshold, no review markers, no pending approvals)  
**API path:** `/api/state → len(.needs_you[])`  
**Known risk:** The 3× failure threshold uses `forge_end(success:false)` count per task_id. If task_ids rotate (each retry gets a new suffix hash), the same logical task never hits 3× under a single `task_id`. Per `bin/circuit_breakers.py` schema — verify whether retry attempts reuse the base task_id or mint new ones.

### Auth-Deferred 10: Recent ledger token sums

**Severity:** P1  
**Source computed:** `events=6 total_tokens=0` (6 forge_end events, all with 0 tokens — the circuit-breakers.jsonl has no `input_tokens`/`output_tokens` fields on these events)  
**API path:** `/api/state → .events_recent[].tokens`  
**Key finding (pre-auth):** The 6 forge_end events in `dashboard/.cae/metrics/circuit-breakers.jsonl` have NO `input_tokens` or `output_tokens` fields. This means `buildEventsRecent` will produce `tokens=0` for all rows. The ledger will show 0 for all recent tasks even if tokens were consumed. This is a **data completeness gap** — the circuit_breakers.py Python logger needs to stamp `input_tokens` + `output_tokens` on forge_end events for the ledger to be meaningful.

### Auth-Deferred 11: Changes: merges_today

**Severity:** P1  
**Source computed:** `0` (no merge commits with today's author date)  
**API path:** `/api/changes` — count of events with `ts` starting today's date  
**Known risk:** `cae-changes-state.ts` uses `--since="30 days ago"` git log (line 55) and groups by SHA. "Today" filtering is done by the API response consumer, not the aggregator. The verify.py cross-check counts events where `e.ts.startswith(today_iso())` — this should match.

### Auth-Deferred 12: Queue counts

**Severity:** P2  
**Source computed:** `inbox=3 shipped=3 stuck=0` (3 inbox task dirs, 3 shipped outbox)  
**API path:** `/api/queue → .counts.*`  
**Known risk:** The bucket logic (`cae-queue-state.ts:bucketTasks`) matches inbox tasks to tmux sessions. If tmux is not running, all inbox tasks fall to "waiting" bucket. The verify.py source counts raw dirs — the real API may classify differently based on HALT markers, SENTINEL_REVIEW files, and tmux session presence.

### Auth-Deferred 13: Memory tree leaf count

**Severity:** P2  
**Source computed:** `394` (walking D-10 glob patterns across CAE_ROOT + DASHBOARD_ROOT)  
**API path:** `/api/memory/tree → sum of .projects[].groups[].files.length`  
**Notes:** Source walk counts 394 files matching MEMORY_PATH_PATTERNS. This is likely close to or matching the API value (same glob logic). Worth verifying to confirm no off-by-one in the tree builder's MAX_PATHS_PER_PROJECT=5000 cap or SKIP_DIRS exclusion.

### Auth-Deferred 14: Active phase progress_pct

**Severity:** P2  
**Source computed:** Phase-by-phase checkbox counts from PLAN.md files (Phase 13 = 50%, Phase 5 = 100%, all others = 0%)  
**API path:** `/api/state → .home_phases[].progress_pct`  
**Notes:** The aggregator uses `cae-phase-detail.ts` task status (merged/running/failed) which is more precise than a checkbox count. The source estimate is a heuristic — tolerance is ±5%.

---

## Unverifiable Panels

These panels use derivation logic too complex to safely second-source without risking false positives. Both require re-implementing `cae-phase-detail.ts` task-status parsing.

### Unverifiable 1: Rollup in_flight

**Reason:** `in_flight = phases.filter(ph => ph.progress_pct > 0 && ph.progress_pct < 100).length` — this is derived from the live phase list that `buildPhases()` computes from task status. A second-opinion source would need to replicate the full task-status aggregation pipeline.  
**Recommendation:** Add a debug endpoint `GET /api/state?debug=1` that returns raw phase task counts alongside progress_pct. This makes the derivation verifiable without re-implementing it.

### Unverifiable 2: Active phase wave_current

**Reason:** `wave_current` derivation requires knowing which tasks are STATUS_RUNNING (in progress right now, per 30s window) vs STATUS_MERGED (completed, per SUMMARY.md presence). This logic lives in `cae-phase-detail.ts` and touches forge_begin/forge_end pairing within a 30s window — too stateful to replicate cleanly.  
**Recommendation:** Same debug endpoint as above — emit `wave_current_derivation: { running_waves: [N], max_completed_wave: M }` so the verifier can check inputs without re-implementing the derivation.

---

## Source-Computed Values (Pre-Auth Reference)

These values were computed from source files and are available for comparison once auth is enabled:

| Panel | Source value | Notes |
|-------|-------------|-------|
| Cost ticker | in=0 out=0 total=0 | No token events today in circuit-breakers.jsonl |
| Heartbeat | halted=False retries=0 phantoms=0 | System idle, all forge_end success |
| Rollup shipped_today | 0 | No DONE.md today, no forge merges |
| Rollup tokens_today | 0 | Same source as cost ticker |
| Rollup warnings | 0 | No failures or escalations in 24h |
| Needs-you count | 0 | No 3× failures, no review markers, no pending approvals |
| Recent ledger | 6 events, 0 total tokens | forge_end events lack token fields — data completeness gap |
| Agents 7d | forge: 100% (6 runs) | Only "forge" agent has activity; all others dormant |
| Metrics MTD spend | 0 | Circuit-breakers.jsonl has no token-bearing events yet |
| Changes merges | 0 | No merge commits today |
| Queue counts | inbox=3 shipped=3 stuck=0 | 3 inbox tasks in waiting, 3 outbox shipped |
| Memory tree | 394 files | D-10 glob walk across all project roots |
| Active phase progress | Phase 13=50%, Phase 5=100% | Checkbox heuristic — verify against API |

---

## Key Pre-Confirmed Finding Not Surfacing in Live Data

### Recent Ledger: Missing Token Data (Pre-Auth Discovery)

The source analysis reveals that `dashboard/.cae/metrics/circuit-breakers.jsonl` contains 6 `forge_end` events, but NONE have `input_tokens` or `output_tokens` fields. This means:

- `buildEventsRecent()` will produce `tokens: 0` for all recent ledger rows
- The ledger in the dashboard shows "0" for all tasks, making the cost-per-task view meaningless
- This is a **data pipeline gap**: the Python-side `circuit_breakers.py` logger's `forge_end` event doesn't include token counts in the current implementation

This is NOT a dashboard aggregator bug — the aggregator correctly sums what's in the jsonl. The gap is in the logging side. Severity: **P1** (data missing, not wrong).

**File evidence:** `/home/cae/ctrl-alt-elite/dashboard/.cae/metrics/circuit-breakers.jsonl` — all 30 rows examined, no `input_tokens`/`output_tokens` fields present on any row.

---

## Downstream Plan Mapping

| Finding | Severity | Plan |
|---------|----------|------|
| WR-01: Chat unread always 0 | P0 CONFIRMED | plan 13-04 (Wave 2) |
| Cost ticker accuracy | P0 AUTH-DEFERRED | plan 13-09 or 13-10 |
| Rollup tokens_today vs cost ticker | P0 AUTH-DEFERRED | plan 13-09 (aggregator tail size unification) |
| Rollup blocked self-consistency | P0 AUTH-DEFERRED | plan 13-09 |
| Agents 7d — UI zero-sample guard | P0 AUTH-DEFERRED | plan 13-04 or 13-10 |
| Recent ledger token data missing | P1 (logging gap) | plan 13-05 (logging audit) |
| Rollup shipped_today | P1 AUTH-DEFERRED | plan 13-09 |
| Rollup warnings event name | P1 AUTH-DEFERRED | plan 13-09 |
| Needs-you threshold reliability | P1 AUTH-DEFERRED | plan 13-09 |
| wave_current unverifiable | P2 | plan 13-09 (add debug endpoint) |
| in_flight unverifiable | P2 | plan 13-09 (add debug endpoint) |

---

## Backlog for Future Phases

- **Add `/api/state?debug=1`** endpoint returning raw task-status derivation inputs (wave breakdown, task counts per status) — enables mechanical verification of wave_current and in_flight without re-implementing aggregator logic. Estimated: 2h.
- **Python-side token logging:** `circuit_breakers.py forge_end` should include `input_tokens` + `output_tokens` from the Claude CLI `--print` output. Without this, the ledger, agent stats, and cost ticker all show 0 on real deployments that don't route through the Phase 7 token adapter.
- **Full auth-enabled re-run:** After `authsetup.sh` produces `storage-state.json`, re-run `python3 verify.py` to populate all 14 deferred panels. Expected: several additional ❌ findings per V2 pre-research predictions.

---

*Generated by plan 13-03 (Wave 1.5). Consumed by: plan 13-04 (WR-01 fix), plan 13-05 (logging), plans 13-09/10/11 (aggregator fixes), plan 13-07 (delta re-audit).*
