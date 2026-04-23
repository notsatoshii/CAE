# Data Pipeline Fix Plan (Cycle 12)

Discovered failures from INSTRUMENTATION-AUDIT + STATE.md retrospective (decision 13-03):

## Confirmed broken pipelines

### F1 — forge_end events missing input_tokens / output_tokens
**Discovery:** STATE.md 13-03: "circuit-breakers.jsonl forge_end events have no input_tokens/output_tokens — recent ledger token sums always 0 (P1 logging gap, not aggregator bug; fix in plan 13-05)."
**Status:** Plan 13-05 was supposed to fix it. Verify by reading current circuit-breakers.jsonl and grepping for input_tokens/output_tokens fields. If still missing on recent events, the fix never landed or didn't take effect.
**Where the writer lives:** GSD execution agents (gsd-executor, gsd-planner, etc.). They emit forge_begin/forge_end events. The omission is in the emit code.
**Fix:** Find the emit point (likely `~/.claude/get-shit-done/lib/circuit-breakers.{js,py}` or similar), add input_tokens + output_tokens + model fields to forge_end payload. These come from Claude API response usage block.
**Impact:** Unblocks all token-cost UI: rollup-strip, recent-ledger, agent-detail, cost-ticker, token burn-rate gauge (E3), cost-by-agent donut (E4), model-cost stacked bars (E5).

### F2 — Audit hook installed but not auto-firing for Claude session
**Discovery:** Manually firing the hook works (writes to tool-calls.jsonl). Settings.json has the entry. But Bash calls from this Claude session don't trigger it automatically.
**Possible causes:**
- CLAUDE_TOOL_NAME env var not injected by harness (different harness fork?)
- Hook timeout=3s too aggressive
- Matcher regex not matching tool name as Claude sends it
**Diagnosis:**
1. Add debug echo to audit-hook.sh: `echo "$(date) tool=$CLAUDE_TOOL_NAME" >> /tmp/audit-debug.log`
2. Fire a Bash; check /tmp/audit-debug.log
3. If empty: hook isn't being invoked at all → harness issue
4. If has entries with empty CLAUDE_TOOL_NAME: var not injected → harness has different name (e.g. `TOOL_NAME` or `TOOL`)
5. If has entries with name not matching matcher case → matcher tweak
**Fix sequence:** identify root cause, patch hook to read alternative env var if primary missing, add fallback default.

### F3 — Live Floor SSE source has no event stream
**Discovery:** floor depends on circuit-breakers.jsonl events; existing 30 events are from 4/20 (stale). SSE endpoint reads file but if file isn't growing, no live events.
**Fix:** Once F1 lands and Eric runs phases (or audit hook fires), events flow → SSE pushes them → Floor renders.
**Interim:** Add a synthetic "heartbeat" event every 30s so Floor doesn't look dead. Or render an explicit "no live activity right now — last event at <ts>" state.

### F4 — Memory consult log missing
**File:** `.cae/metrics/memory-consult.jsonl` doesn't exist (per audit).
**Writer:** PostToolUse hook `memory-consult-hook.sh` (Phase 8). Likely registered in settings.json — check.
**Fix:** Same diagnosis as F2 — verify hook is firing, debug if not.

### F5 — Sentinel events missing
**File:** `.cae/metrics/sentinel.jsonl` (1222 bytes, last 4/20).
**Writer:** Sentinel Python process. Status: not running (per audit).
**Fix:** If Sentinel is supposed to run continuously, install via systemd or supervisor. If on-demand, add to GSD execution flow.

### F6 — Skill scans stale
**File:** `.cae/metrics/skill-scans.jsonl` exists but appears sample/stale.
**Writer:** `tools/skill-install.sh` or skill-discovery subprocess. Run on cadence?
**Fix:** Add to scheduler-cron job that just installed (Wave D in original plan).

## Wave 1.5 — Data pipeline fix sub-wave

Insert between current Wave 1 and Wave 2:

1.5.1 — Diagnose audit-hook auto-fire (F2): instrument, test, patch
1.5.2 — Patch GSD breaker emit to include input_tokens/output_tokens/model (F1): trace emit point, add fields, document schema delta
1.5.3 — Verify memory-consult hook (F4): same protocol as F2
1.5.4 — Synthetic heartbeat for Live Floor (F3 interim): new event source emits {ts, event:"heartbeat", active_count} every 30s while no real events
1.5.5 — Add skill-scan job to scheduler-cron (F6): one-line cron entry
1.5.6 — Document writer responsibility per file in `lib/cae-types.ts` JSDoc so future drift is caught

## Acceptance

- forge_end events show input_tokens, output_tokens, model
- tool-calls.jsonl grows with every Bash from a real session
- Live Floor never looks frozen even when no real activity
- Skills scan refreshes every N minutes
- Memory consult logged on every memory-touching tool call

## Owner

Single ship-now agent: dispatch after Wave 1 lands. Production quality required because data correctness is foundational.
