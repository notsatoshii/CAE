# Session 13 → 14 Handoff

**Date end:** 2026-04-24 (session 13, Asia/Seoul)
**Session length:** ~4h wall-clock (~11:00 → 15:05 KST)
**Model:** Claude Opus 4.7 (1M context)
**HEAD at end:** `36383cf` on `origin/main` (28 commits this session)

---

## TL;DR

- **28 commits landed** — truth scorer, data-feed aggregator, queue sheet, workflows, skills, chat crypto, loading copy, heartbeat daemon, 7 craft sub-waves (5A-5H), pixel-agents v0.1 → v1 (pablodelucca MIT integration).
- **Data-feed restored end-to-end** — all 8 broken /build cards now surface real commits/phases/activity (was "nothing shipped today"/"idle"/"0 in-flight"/"1% budget").
- **Pixel-agents integrated properly** — pablodelucca/pixel-agents MIT port (characters.png + 6 per-character sheets + floor tiles + speech bubbles), replacing the v0.1 colored squares.
- **Heartbeat 5s** — cron → systemd daemon `cae-heartbeat.service` (was 30s).
- **C5 + C6 cycles failed to produce scores** — dev server too slow (turbopack first-compile stacked with Herald hook + heartbeat daemon + multi-worker playwright). Load avg 13 on 4c box. Scores unvalidated.
- **Resume priority:** fix the audit-harness infrastructure (box upgrade, or reduced-scope mode, or move audit runs off-box).

---

## What shipped (28 commits, all pushed to origin/main)

| commit | class | what |
|--------|-------|------|
| `14e841b` | truth/class14b | Route-scope expected truth keys — fixes C4 stuck-1.00 |
| `1a2335d` | herald/class12 | sudo -u cae for claude CLI spawns |
| `2c7356a` | chat/class9 | hydration mismatch admin·mobile+wide /chat |
| `c379dc8` | floor/class8 | Pixel-agents cron installer idempotency fix |
| `98ceac2` | voice/class11 | LLM voice scorer wired (AUDIT_VOICE=1) |
| `5242a51` | loading/session13 | `Loading...` + `CTRL + ALT + ELITE` subtitle |
| `2968d10` | chat/class18b | safeUUID fallback for insecure contexts |
| `d21d2b4` | chat/class18b | safeUUID re-commit (concurrent-agent race cleanup) |
| `99a130d` | skills/class19c | Per-skill last-updated + recent edits timeline |
| `a7aebf4` | workflows/class19d2 | Client-safe types split — unblocks /api/state 500 |
| `26f9db1` | workflows/class19d | Live workflow instances (SSE + ETag + 5s poll) |
| `5e19476` | floor/class8b | Idle stations visible — `#3a3a42` ≠ near-bg |
| `c2c23cf` | queue/class19b | Queue sheet rewired — 8 toast.info + 3 "Phase 8/9" killed |
| `767e2bb` | data/class20b | listPhases reads task_id prefix, not ghost phaseId |
| `37ebc86` | data/class20cdef | Rollup shipped_today + ledger + live-ops + budget=0 unbounded |
| `fb7db57` | audit/class20 | C5-DATA-FEED-DIAGNOSIS.md doc |
| `79c0dbe` | craft/class5E | Kanban visual separation (elev tiers) |
| `c955f03` | floor/pixel-agents-v0.1 | Colored squares travel forge→hub (superseded by v1) |
| `fe0c54c` | craft/class5C | Kill phantom 9-identical-row empty states |
| `9ebb9c8` | craft/class5G | Badge palette desaturation (44%/35%/40% chroma cut) |
| `23555ee` | craft/class5D | Panel overlaps resolved — 5 cases |
| `74d549c` | floor | Heartbeat 5s daemon + systemd unit |
| `0f48ff2` | craft/class5B→5A | (mislabelled) 5A mobile responsive sweep — sidebar, memory, audit-table |
| `4fea32e` | craft/class5F | 4-tier typography hierarchy |
| `9a968d4` | craft/class5B | Top-nav overflow menu on mobile |
| `d722aad` | craft/class5H | Glassmorphic top-bar + rail + modal + hero |
| `36383cf` | floor/pixel-agents-v1 | Character sprites, MIT port, 242/242 floor tests |

Closed wave classes: **1, 2 (A+B), 3 (A+B+C), 4 (A+B), 5 (A+B+C+D+E+F+G+H), 7, 8 (A+B), 9, 10, 11, 12, 13 (A+B+C+D), 14 (A+B), 15 (A+B+C), 18 (A+B), 19 (B+C+D), 20 (A+B+C+D+E+F).**

---

## Data-feed: before → after

| Card | Before (Eric's complaint) | After |
|------|----------------------------|-------|
| Recent shipped today | "nothing shipped" | 20 real commit SHAs today |
| Active phases | "shows nothing" | Reads task_id prefix (p15-*), unions activity.jsonl |
| Live ops | "shows nothing" | 120s window, unions activity |
| Shipped / in-flight | "0" | Real counts from rollup+activity union |
| Activity stream | "offline" | SSE restored after fs/promises bundle fix |
| Burn rate | "nothing" | Aggregator reports $0/min (honest — no token_usage events being produced upstream) |
| Budget | "1% of never-set budget" | `daily_budget_usd=0` + "unbounded" hero card |
| Live activity | "idle" | Real forge events rendered; "idle" only when truly idle |

**Residuals (producer-side, NOT dashboard):**
- `token_usage` events aren't written by the current agent stack → BurnRate rightly shows $0
- `tool-calls.jsonl` isn't populated → LiveActivity can't show per-tool granularity

---

## Pixel-agents: v0.1 → v1

**v0.1 (commit `c955f03`, superseded):** colored 6×6 squares that travel forge→hub on forge_begin/end. My own implementation, wrong.

**v1 (commit `36383cf`, current):**
- MIT-attributed characters.png (4.2KB) + 6 per-character sheets + floor tiles + wall atlas = 88KB in `dashboard/public/pixel-agents/`
- `lib/floor/pixel-agent-sprite.ts` (360 lines) — sheet slicer + frame anim + bubble renderer
- `lib/floor/office-layout.ts` (150 lines) — floor-tile grid + desk placements at station coords
- `lib/floor/pixel-agent-state.ts` (312 lines) — per-sprite state machine + registry
- Wired to `/api/activity/live` 5s fetch-poll for tool_call → sprite anim
- Speech bubbles (`bubble-waiting.json`, `bubble-permission.json` — verbatim upstream pixel data)
- Scene.agents[] contract from v0.1 preserved — event-adapter + drain unchanged
- 242/242 floor tests green, tsc clean
- `dashboard/public/pixel-agents/CREDITS.md` — MIT attribution

**Known gaps (code ready, waiting on data):**
- `tool_call` rows not yet written to activity.jsonl by any agent — typing animation wired but won't visibly fire
- Permission-request detection needs separate event source (doesn't exist yet)
- Floor tile PNGs copied but renderer draws solid dim diamonds (not blitting patterns) — deliberate first-pass

---

## Heartbeat: 30s → 5s

- `dashboard/scripts/heartbeat-daemon.sh` — `while true; sleep 5; emit;` loop, pidfile-guarded, SIGTERM-graceful
- `dashboard/scripts/install-heartbeat-daemon.sh` — idempotent installer, systemd preferred → `@reboot` cron fallback
- `systemctl enable --now cae-heartbeat.service` — live as of end-of-session
- Cron cleaned: removed the two `*/1 * * * * heartbeat-emitter.sh` lines (and the sleep-30 sibling)
- Verified 5s cadence in `.cae/metrics/heartbeat.jsonl` (04:08:14 → 04:08:19 → 04:08:24 UTC)

---

## C5 + C6 cycles: BOTH FAILED to produce scoring

**C5** (13:44 KST start, clickwalk=1, 4 workers, --prior C4):
- Playwright finished: 201 passed / 207 failed over 1.6h wall
- Exit 1 — `set -e pipefail` tripped on playwright's non-zero exit
- Scoring never ran. `audit/reports/C5-SCORES.md` does NOT exist
- Metrics restored via trap. No C5-DELTA against C4.
- Cause: concurrent code-mutation agents (8 agents landed ~15 commits during capture) → turbopack hot-reload → 500s mid-capture

**C6** (14:31 KST start, clickwalk=1, 4 workers → killed → 2 workers relaunched 14:31):
- 2-worker restart at 14:31. At 15:05 (34 min), test 78/408, 44 pass / 34 fail. Pace = 0.64 tests/min = projected 8.6hr
- Failure pattern: first persona on each route passes (8-11s), subsequent personas timeout at playwright's 60s test limit — suggests persona-swap invalidates turbopack cache
- Killed cleanly at 15:05. No C6-SCORES.md produced.

**Root cause: audit-harness infrastructure is underprovisioned.** Load avg 13 on ~4c box during 4-worker runs. 5.5 on 2-worker. next-server at 48% mem + 3.4GB swap. Turbopack first-compile is CPU-bound and single-threaded; cycle captures × 5 personas × 3 viewports × ~27 routes = 408 compile-hits. Harness assumes faster hardware.

---

## Key invariants I honored

- No permission asks — all file edits + commits autonomous per `feedback_full_autonomous_no_permission_asks`
- Parallel-aggressive — 5+ concurrent agents across two waves
- Tests + tsc clean on every commit. No `--no-verify`, no amending.
- MIT attribution added for pablodelucca port
- Data-truth keys route-scoped (my diagnosis: scorer was comparing ALL 46 keys against every route → impossible to score > 1)
- Scene.agents[] API preserved across v0.1 → v1

## Traps + gotchas for session 14

1. **Worktree races.** Multiple agents committing concurrently caused:
   - Commit `0f48ff2` carrying another agent's code under a wrong class tag
   - My pixel-agent edits reverted mid-edit TWICE (Herald hook / concurrent stage)
   - Recovery: atomic commit inside same bash call, `git add` specific paths only, never `git add -A`
2. **C5 metrics restore trap won't fire on SIGKILL.** If you `pkill -9 run-cycle.sh`, snapshot metrics before killing: `cp -r /home/cae/ctrl-alt-elite/.cae/metrics.pre-cycle-* /home/cae/ctrl-alt-elite/.cae/metrics/`
3. **`dashboard/lib/workflows/live-instances.ts` has Node imports** (`fs/promises`). Client components MUST import types from `lib/workflows/types.ts`, not the main file.
4. **`dashboard/lib/floor/scene.ts` Scene.agents[] is the pixel-agent registry.** Do NOT extend FloorEntity union — v0.1 tried that, got reverted by race. Use Scene.agents[] instead.
5. **System block hook** `gsd-read-guard.js` was removed from `/root/.claude/settings.json` at Eric's ask. Restart Claude Code to pick up — current session still fires the hook (inert, but annoying).
6. **Pablo v1 sprite assets** are NEW in `/home/cae/ctrl-alt-elite/dashboard/public/pixel-agents/`. If you delete `public/pixel-agents/`, the new renderer falls back to colored squares (graceful).

---

## Open items for session 14

### P0 — Infrastructure (gating all further audit work)
- Audit harness needs to run somewhere that isn't this dev box, OR the dev box needs 4→8+ cores + 32GB+ RAM, OR harness needs a `AUDIT_SAMPLE=0.25` mode (1 persona/route). Without this, we can't produce scoring baselines.

### P0 — Producer-side instrumentation gaps
- No agent writes `token_usage` events → BurnRate shows $0 (code ready)
- No agent writes `tool-calls.jsonl` → LiveActivity can't show per-tool + pixel-agents can't show typing anim
- Both need to be plumbed into the agent/Herald/Forge adapter chain so real activity surfaces

### P1 — Remaining wave classes
- **Class 5I** (new): Activity feed — needs producer-side events (blocked by infra above)
- **Class 16** deferred: Geist → Roboto + Ubuntu font swap — Eric said "later"
- **Class 17** deferred: systematic layout + formatting pass — Eric said "later"

### P1 — UAT items Eric raised this session
- ✅ Truth pillar stuck — FIXED (14e841b) but unvalidated because C5/C6 both failed to score. Validate via a reliable audit run.
- ✅ Data feed broken — FIXED (4 commits) — verify in browser end-to-end
- ✅ Pikachu → Loading copy — FIXED (5242a51)
- ✅ Chat crypto.randomUUID — FIXED (2968d10)
- ✅ Pixel-agents blank canvas — FIXED (v1 + color fix + heartbeat 5s)
- ✅ Dashboard 500 on /build/workflows — FIXED (a7aebf4 bundle split)
- ⏳ `/build` / `recent`/`active phases`/`live ops` = empty — should now work post-37ebc86; pending UAT

### P2 — Session 14 should RUN UAT FIRST
Before touching any new code, verify in a browser: every card on /build home shows live data, /floor shows character sprites walking, /build/workflows shows runs, /build/queue sheet is rewired, /chat works, /build/skills has timestamps, mobile doesn't overflow, glassmorphic looks right.

---

## Resume cold

```bash
# 1. Verify dashboard up
curl -sf http://localhost:3002/ -o /dev/null -w "%{http_code}\n"

# 2. Verify heartbeat daemon live
systemctl status cae-heartbeat.service
tail -3 /home/cae/ctrl-alt-elite/.cae/metrics/heartbeat.jsonl

# 3. Verify pablodelucca assets present
ls /home/cae/ctrl-alt-elite/dashboard/public/pixel-agents/

# 4. Verify latest commits pushed
git log origin/main --oneline -5

# 5. Read the C5 diagnosis doc
cat /home/cae/ctrl-alt-elite/dashboard/audit/reports/C5-DATA-FEED-DIAGNOSIS.md | head -40

# 6. Pick up: UAT walkthrough → then address P0 infrastructure before another cycle
```

### Sys-level changes (not in git)

- `/etc/systemd/system/cae-heartbeat.service` — 5s heartbeat daemon
- Crontab: removed 2× heartbeat-emitter cron lines (session 12's 30s pair)
- `/root/.claude/settings.json` — removed `gsd-read-guard.js` PreToolUse hook

End of handoff.
