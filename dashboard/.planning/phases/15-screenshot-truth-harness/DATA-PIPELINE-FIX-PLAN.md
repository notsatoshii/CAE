# Data Pipeline Fix Plan (Cycle 12)

Discovered failures from INSTRUMENTATION-AUDIT + STATE.md retrospective (decision 13-03):

## Confirmed broken pipelines

### F1 — forge_end events missing input_tokens / output_tokens
**Status (Wave 1.5):** SKIPPED IN THIS WAVE — requires editing
`/root/.claude/get-shit-done/lib/circuit-breakers.{js,py}` (GSD source). Out of
scope for the dashboard agent because it touches the GSD harness, not the
dashboard repo.

**TODO (next session, GSD-side agent):**
1. Locate the forge_end emit point in `~/.claude/get-shit-done/lib/`.
2. Add `input_tokens`, `output_tokens`, and `model` fields read from the
   Claude API response `usage` block.
3. Confirm the schema matches `CbEvent` in `dashboard/lib/cae-types.ts`.
4. Run a test phase and grep `circuit-breakers.jsonl` for the new fields.

**Discovery:** STATE.md 13-03: "circuit-breakers.jsonl forge_end events have no input_tokens/output_tokens — recent ledger token sums always 0 (P1 logging gap, not aggregator bug; fix in plan 13-05)."
**Where the writer lives:** GSD execution agents (gsd-executor, gsd-planner, etc.). They emit forge_begin/forge_end events. The omission is in the emit code.
**Impact:** Unblocks all token-cost UI: rollup-strip, recent-ledger, agent-detail, cost-ticker, token burn-rate gauge (E3), cost-by-agent donut (E4), model-cost stacked bars (E5).

### F2 — Audit hook installed but not auto-firing for Claude session
**Status (Wave 1.5):** INSTRUMENTED. Diagnostic echo added to
`dashboard/tools/audit-hook.sh` immediately after `set -euo pipefail`. Every
hook invocation now logs to `/tmp/audit-hook-debug.log` with `CLAUDE_TOOL_NAME`
and any other `CLAUDE_*` / `TOOL_*` env vars.

**Next session action:** review `/tmp/audit-hook-debug.log` after a real
Claude session has fired Bash/Edit/Write tools. Three possible findings:
- File empty → harness isn't invoking the hook at all (harness/registration issue)
- File has rows with `tool=MISSING` → env var name mismatch; widen the matcher
  block to fall back on `TOOL_NAME` or whatever the diagnostic surfaces
- File has rows with a tool name not in `Bash|Write|Edit|MultiEdit|Agent|Task`
  → matcher case mismatch; tweak the case statement

Once root cause is confirmed and patched, remove the diagnostic block.

**Discovery:** Manually firing the hook works (writes to tool-calls.jsonl). Settings.json has the entry. But Bash calls from this Claude session don't trigger it automatically.

### F3 — Live Floor SSE source has no event stream
**Status (Wave 1.5):** SHIPPED. Synthetic heartbeat pipeline now keeps Floor
visibly alive even when no real GSD activity is firing.

Components:
- `dashboard/scripts/heartbeat-emitter.sh` — appends a `{event:"heartbeat"}`
  JSONL line to BOTH `.cae/metrics/heartbeat.jsonl` and the existing
  `.cae/metrics/circuit-breakers.jsonl` (so the existing Floor SSE source picks
  it up without changing the route).
- `install-scheduler-cron.sh` now registers the emitter twice per minute
  (`* * * * *` + `* * * * * sleep 30 && …`) for an effective 30-second cadence.
- `lib/floor/event-adapter.ts` ALLOWED_EVENTS extended to 9 entries; mapEvent
  emits a short hub pulse (TTL 0.6s) for heartbeats. NO station status change
  so heartbeats don't get the hub stuck "active".
- `lib/hooks/use-floor-events.tsx` exposes `lastHeartbeatMs` in the result.
- `components/floor/floor-liveness-badge.tsx` (new) renders
  "no agent active right now — system online, last heartbeat 12s ago" with a
  pulsing emerald dot. Switches to amber + "system unresponsive — last
  heartbeat 4m ago" after 90s of silence (3 missed beats).

Tests: 35 event-adapter tests pass (added 2 heartbeat-specific cases).

### F4 — Memory consult log missing
**Status (Wave 1.5):** INSTRUMENTED. Diagnostic echo added to
`/home/cae/ctrl-alt-elite/tools/memory-consult-hook.sh` (the script lives at
the CAE root, not in the dashboard repo). Records `pwd`, `CLAUDE_TOOL_NAME`,
`CLAUDE_SESSION_ID`, `CAE_TASK_ID`, and the opt-in dir presence to
`/tmp/memory-consult-hook-debug.log`. Does NOT touch stdin so the real hook
flow is unchanged.

**Findings before instrumentation:**
- Hook script exists, executable, syntax OK (verified `bash -n`).
- Registered in `/home/cae/ctrl-alt-elite/.claude/settings.json` PostToolUse
  matcher `Read`.
- Hook gates on `$PWD/.cae/metrics/` existing as the opt-in signal (lines
  48-51). When Claude runs from a directory without that subdir, it exits 0.
- The dashboard repo does have `.cae/metrics/`, but `/home/cae/ctrl-alt-elite/.cae/metrics/`
  also exists — so memory-consult.jsonl SHOULD be growing in the parent root
  if the hook fires. It isn't, suggesting either the harness isn't invoking
  the hook OR PWD isn't what the hook expects.

**Next session action:** review `/tmp/memory-consult-hook-debug.log` after the
next real Read tool call. If empty → harness not invoking hook (same root
cause as F2). If populated → check the `pwd` field and compare against the
opt-in gate.

### F5 — Sentinel events missing
**Status (Wave 1.5):** SKIPPED — daemon installation is out of scope for this
wave. The Sentinel Python process needs systemd or supervisor wiring; that's
infrastructure work, not data-pipeline plumbing.

**TODO (separate phase):**
1. Decide whether Sentinel is supposed to run continuously (systemd unit) or
   on-demand (invoked from the GSD execution flow).
2. If continuous: ship a `bin/install-sentinel-systemd.sh` that drops a
   `cae-sentinel.service` unit, enables and starts it, logs to
   `.cae/metrics/sentinel.jsonl`.
3. If on-demand: add a `sentinel.run()` call into the GSD wave executor.
4. Either way: add a watchdog so the dashboard surfaces a clear "Sentinel
   not running" warning instead of silent staleness.

**File:** `.cae/metrics/sentinel.jsonl` (1222 bytes, last 4/20).
**Writer:** Sentinel Python process. Status: not running (per audit).

### F6 — Skill scans stale
**Status (Wave 1.5):** SHIPPED.

Components:
- `dashboard/scripts/refresh-skill-scans.ts` (new) — walks
  `~/.claude/skills/`, runs `scanSkill()` on each via the existing
  `lib/cae-secrets-scan.ts` flow, and `appendScan()`s a fresh JSONL row per
  skill to `${CAE_ROOT}/.cae/metrics/skill-scans.jsonl`.
- `cae-scheduler-watcher.sh` — gated on `[[ $(date +%M) == 00 ]]`, runs the
  refresh script under `flock` so overlapping watcher invocations can't
  double-fire. Logs `skill_scan_refresh_start` / `_done` events to
  `scheduler.jsonl` so the UI can surface "last refreshed Nm ago".
- The watcher prefers a globally installed `tsx`, falls back to the
  dashboard's `node_modules/.bin/tsx`, then to `ts-node --transpile-only`.

## Wave 1.5 — Data pipeline fix sub-wave

Insert between current Wave 1 and Wave 2:

1.5.1 — Diagnose audit-hook auto-fire (F2): INSTRUMENTED ✅
1.5.2 — Patch GSD breaker emit to include input_tokens/output_tokens/model (F1): TODO (GSD-side)
1.5.3 — Verify memory-consult hook (F4): INSTRUMENTED ✅
1.5.4 — Synthetic heartbeat for Live Floor (F3): SHIPPED ✅
1.5.5 — Add skill-scan job to scheduler-cron (F6): SHIPPED ✅
1.5.6 — Document writer responsibility per file in `lib/cae-types.ts` JSDoc so future drift is caught: SHIPPED ✅ (see CB_EVENT_KINDS doc block)

## Acceptance

- forge_end events show input_tokens, output_tokens, model — TODO (F1)
- tool-calls.jsonl grows with every Bash from a real session — TBC after F2 diagnostic review
- Live Floor never looks frozen even when no real activity — DONE (F3)
- Skills scan refreshes every N minutes — DONE (F6, hourly)
- Memory consult logged on every memory-touching tool call — TBC after F4 diagnostic review

## Owner

Single ship-now agent: dispatch after Wave 1 lands. Production quality required because data correctness is foundational.
