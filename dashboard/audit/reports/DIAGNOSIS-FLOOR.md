# DIAGNOSIS — Live Floor / pixel-agents

**Date:** 2026-04-24
**Investigator:** Claude (Opus 4.7, 1M)
**Reporter:** Eric — "Live Floor / pixel-agents not working at all"
**Method:** Read-only source + runtime probing (playwright audit in flight, no file edits, no new browsers launched)

---

## 1. Verdict

**Severity:** Alive-but-idle. The rendering pipeline is healthy end-to-end; **nothing is producing new events**, so the canvas paints one brief burst of fixture activity then goes silent for the rest of the session. The "no agent active" liveness badge never ticks because the synthetic heartbeat emitter is not running.

**Root cause (one sentence):** The scheduler-cron installer (`scripts/install-scheduler-cron.sh`) was only *partially* applied — the marker block in crontab contains the scheduler-watcher line but is **missing both `heartbeat-emitter.sh` cron lines**, and the idempotency guard at line 40 (`grep -qF "$MARKER"` → early exit) means re-running the installer will never repair the omission.

---

## 2. Rendering pipeline — all green

| Stage | Status | Evidence |
| --- | --- | --- |
| `/floor` page mount + auth gate | OK | `app/floor/page.tsx:30–52` resolves projectPath then renders `FloorClient` with `cbPath = resolveCbPath(projectPath)` (`lib/floor/cb-path.ts:17`). |
| `FloorCanvas` dynamic import (`ssr:false`) | OK | `components/floor/floor-client.tsx:33`. Prior audit run produced valid screenshots under `audit/shots/healthy/live-spectator/floor--*.png`. |
| Canvas RAF loop | OK | `components/floor/floor-canvas.tsx:119–152`. `step()` + `render()` each frame, ResizeObserver wired. |
| `useFloorEvents` SSE subscription | OK | `lib/hooks/use-floor-events.tsx:151–201`. Opens `EventSource("/api/tail?path=<cbPath>")`, pushes parsed lines to queue, drains via `queueMicrotask(drain)`. |
| `/api/tail` handler + path allow-listing | OK | `app/api/tail/route.ts:40–77`. ALLOWED_ROOTS includes `<CWD>/.cae/metrics`. |
| `createTailStream` (fs.watch + byteOffset) | OK | `lib/tail-stream.ts:4–73`. Tails file and enqueues new lines as they land. |
| parseEvent allow-list | OK for the events that count | `lib/floor/event-adapter.ts:23–33`. Allows `forge_begin`, `forge_end`, `heartbeat`, + 6 more. |

**Authenticated curl against `/api/tail` returns 12 771 bytes of `data: …\n\n` frames** (excerpt):

```
HTTP=200 SIZE=12771
data: {"ts":"2026-04-23T14:59:32.575Z","event":"forge_begin","task_id":"p15-pl01-t1",...}
data: {"ts":"2026-04-23T14:59:35.575Z","event":"forge_end","task_id":"p15-pl01-t1","success":true,...}
data: {"ts":"2026-04-23T14:59:32.575Z","event":"token_usage",...}
```

**Audit truth JSON (healthy persona, captured minutes ago) agrees:**

```
/home/cae/ctrl-alt-elite/dashboard/audit/shots/healthy/live-spectator/floor--wide.truth.json
  floor.healthy            = yes
  floor-canvas.healthy     = yes
  floor.effects-count      = 10
  floor.last-heartbeat-ms  = 1776918113000   # = 2026-04-23T15:01:53Z
  floor.auth-drifted       = false
```

So the component tree, SSE stream, parser, and scene reducer all work. 10 effects were applied on initial tail catch-up.

---

## 3. Why it still looks dead — the data is stale and nobody is writing

### 3.1 circuit-breakers.jsonl is a **one-shot fixture dump**, not a live stream

```
$ stat /home/cae/ctrl-alt-elite/.cae/metrics/circuit-breakers.jsonl
  Modify: 2026-04-24 00:04:02 +0900      # 31 min ago
$ tail -1 circuit-breakers.jsonl
  {"ts":"2026-04-23T15:03:53.575Z","event":"token_usage",...}
$ wc -l circuit-breakers.jsonl
  85
$ awk -F'"event":"' '{print $2}' … | awk -F'"' '{print $1}' | sort | uniq -c
     30 forge_begin
     25 forge_end
     30 token_usage
```

85 lines, all written at once by `audit/fixtures/healthy.ts` (`writeFile(… cbLines.join("\n") + "\n")`, `dashboard/audit/fixtures/healthy.ts:204–208`). After the audit fixture seed the file is **never appended to again** — there is no live producer.

### 3.2 Effects decay to zero within ~3 seconds of mount

`lib/floor/state.ts:47–61` decrements `effect.ttl` each frame and splices expired effects out. TTLs are 0.6–2.5 s (`lib/floor/event-adapter.ts:36–44`). After the SSE catch-up burst drains ~10 effects into the scene, they all expire within a few seconds and the canvas goes blank because no fresh lines arrive.

### 3.3 The synthetic heartbeat that is supposed to keep the canvas alive is not running

The design (`scripts/heartbeat-emitter.sh:11–21`, `components/floor/floor-liveness-badge.tsx:11–22`) is: a cron-driven emitter appends `{event:"heartbeat"}` to `circuit-breakers.jsonl` every 30 s so the canvas keeps producing a gentle hub pulse (`event-adapter.ts:198–212`) and the on-screen badge can render "system online — last heartbeat Ns ago".

Actual state:

```
$ crontab -l | grep -A 10 CAE_SCHEDULER_WATCHER
# CAE_SCHEDULER_WATCHER (managed by CAE dashboard Phase 14)
* * * * * "/home/cae/ctrl-alt-elite/dashboard/scripts/cae-scheduler-watcher.sh" >> /tmp/cae-scheduler.log 2>&1
```

Only the watcher line is installed. The installer registers **three** lines (`scripts/install-scheduler-cron.sh:49–61`):

```
WATCHER_LINE="* * * * * \"$WATCHER\" …"
HEARTBEAT_LINE_A="* * * * * \"$HEARTBEAT\" …"
HEARTBEAT_LINE_B="* * * * * sleep 30 && \"$HEARTBEAT\" …"
```

and gates on the marker before appending (`install-scheduler-cron.sh:40`):

```bash
if crontab -l 2>/dev/null | grep -qF "$MARKER"; then
  echo "scheduler watcher already in crontab — skipping (idempotent)"
  exit 0
fi
```

The marker is present but the two heartbeat lines are not. Confirmation:

```
$ ls -la /tmp/cae-heartbeat.log
ls: cannot access '/tmp/cae-heartbeat.log': No such file or directory
$ tail -2 /home/cae/ctrl-alt-elite/.cae/metrics/heartbeat.jsonl
{"ts":"2026-04-23T04:06:35Z","event":"heartbeat","source":"heartbeat-emitter"}
{"ts":"2026-04-23T04:21:53Z","event":"heartbeat","source":"heartbeat-emitter"}
```

`heartbeat.jsonl` has exactly 2 entries, both from Apr 23 04:xx UTC (20+ hours ago), from an earlier manual invocation. Re-running `install-scheduler-cron.sh` will silently noop because of the marker check.

### 3.4 Eric's subjective experience

1. Navigate to `/floor` (or see `FloorPin` on `/build`).
2. SSE connects, drains 85 lines of yesterday's fixture in <1 s, `effectsCount` briefly jumps to the `EFFECTS_CAP=10` ceiling (`use-floor-events.tsx:35`).
3. Effects expire within ~3 s. Canvas clears.
4. `FloorLivenessBadge` computes age = `Date.now() − 1776918113000` ≈ 9 h → stale branch → amber dot + `"system unresponsive — last heartbeat 9h ago"` (`floor-liveness-badge.tsx:71–76`).
5. Nothing else ever happens because no producer is appending.

From the user's seat: **"not working at all"** is the correct perception. Functionally the feature is alive; experientially it is dead.

---

## 4. Secondary observations (not root cause, worth noting)

- **`token_usage` is not in the allow-list** (`event-adapter.ts:23–33`). Of the 85 fixture lines, 30 are `token_usage` and are silently dropped by `parseEvent` at line 85. Harmless today (fixture is over-specified), but if a real producer emits token-usage events expecting them to light up the floor, they won't.
- **`withLog` does not enforce auth**; the 401 on unauthenticated curl comes from `middleware.ts:35–46`, which short-circuits `/api/tail` with a JSON 401. This is correct and is NOT the reason Eric sees no activity — his browser session is signed in.
- **Data source discrepancy**: `lib/cae-state.ts:85` hard-codes `SHIFT_PROJECTS_HOME = /home/cae`, and `app/floor/page.tsx:44–51` picks the most-recent Shift project as `projectPath`. If no Shift state exists, it falls back to `projects[0]` (the hard-coded candidate list, first entry is `ctrl-alt-elite`). The resolved `cbPath` therefore points to `/home/cae/ctrl-alt-elite/.cae/metrics/circuit-breakers.jsonl` — which is exactly the file the audit fixture overwrites. So even if real GSD runs are producing data in a different project dir, /floor is not pointed at it.

---

## 5. Single-fix recommendation

**Make the floor produce visible liveness without depending on a broken cron install.**

There are two defensible layers; do both, small:

### Fix A — Repair the cron install (authoritative fix, persistent)

The installer's idempotency guard is too greedy. It bails whenever the marker is present, regardless of whether all three lines are present. Change the guard to re-check each line individually, or have it remove the marker block and re-append. Touch:

- `/home/cae/ctrl-alt-elite/dashboard/scripts/install-scheduler-cron.sh` — replace the `grep -qF "$MARKER"` early-exit (lines 40–44) with per-line idempotency (or an explicit `--repair` flag that rewrites the block).

Then run the installer once. The two `HEARTBEAT_LINE_A/B` cron entries land, `/tmp/cae-heartbeat.log` starts growing, and fresh `heartbeat` events append to `circuit-breakers.jsonl` every 30 s. The canvas will produce a subtle hub pulse each tick and `FloorLivenessBadge` will flip to green ("system online — last heartbeat 4s ago").

### Fix B — Decouple liveness badge from producer health (defensive)

Even with Fix A, a fresh clone of the repo with no `heartbeat.jsonl` still looks dead for the first 30 s after mount. Optional: when `lastHeartbeatMs === null` AND `effectsCount === 0`, render a tighter "demo" pulse loop from the client (pure canvas, no SSE required) or show a clearly labeled "standby — awaiting first event" state instead of the current "waiting for first heartbeat…" which reads as a bug. Touch:

- `components/floor/floor-liveness-badge.tsx` — adjust the `lastHeartbeatMs === null` branch copy, or
- `components/floor/floor-canvas.tsx` — emit an idle-pulse on mount when `cbPath !== null && effectsCount === 0`.

### Out of scope but worth filing separately

- Add `token_usage` to `ALLOWED_EVENTS` (or deliberately decide not to and remove from the fixture).
- Audit fixture should *append* rather than overwrite `circuit-breakers.jsonl`, OR the audit should write to an isolated project root so it doesn't clobber the dev/demo data.
- Real GSD adapter must be pointed at `/home/cae/ctrl-alt-elite/.cae/metrics/circuit-breakers.jsonl` (or whichever project `/floor` resolves to) so live activity actually flows.

---

## 6. Evidence index (absolute paths)

- `/home/cae/ctrl-alt-elite/dashboard/app/floor/page.tsx` — server shell / project resolution
- `/home/cae/ctrl-alt-elite/dashboard/app/floor/popout/page.tsx` — popout variant
- `/home/cae/ctrl-alt-elite/dashboard/app/api/tail/route.ts` — SSE handler
- `/home/cae/ctrl-alt-elite/dashboard/components/floor/floor-client.tsx` — orchestrator, liveness state machine
- `/home/cae/ctrl-alt-elite/dashboard/components/floor/floor-canvas.tsx` — canvas + RAF loop
- `/home/cae/ctrl-alt-elite/dashboard/components/floor/floor-liveness-badge.tsx` — badge copy + stale threshold
- `/home/cae/ctrl-alt-elite/dashboard/lib/hooks/use-floor-events.tsx` — SSE consumer + queue
- `/home/cae/ctrl-alt-elite/dashboard/lib/floor/event-adapter.ts` — parse + map + allow-list
- `/home/cae/ctrl-alt-elite/dashboard/lib/floor/state.ts` — step()/TTL decay
- `/home/cae/ctrl-alt-elite/dashboard/lib/floor/cb-path.ts` — cbPath resolver
- `/home/cae/ctrl-alt-elite/dashboard/lib/cae-state.ts` — listProjects / SHIFT_PROJECTS_HOME
- `/home/cae/ctrl-alt-elite/dashboard/lib/tail-stream.ts` — fs.watch tail
- `/home/cae/ctrl-alt-elite/dashboard/middleware.ts` — auth gate on /floor + /api/tail
- `/home/cae/ctrl-alt-elite/dashboard/scripts/heartbeat-emitter.sh` — synthetic heartbeat
- `/home/cae/ctrl-alt-elite/dashboard/scripts/install-scheduler-cron.sh` — buggy installer (the bug)
- `/home/cae/ctrl-alt-elite/dashboard/audit/fixtures/healthy.ts` — fixture that overwrites circuit-breakers.jsonl
- `/home/cae/ctrl-alt-elite/.cae/metrics/circuit-breakers.jsonl` — stale data (last ts 2026-04-23T15:03:53Z)
- `/home/cae/ctrl-alt-elite/.cae/metrics/heartbeat.jsonl` — 2 entries, both from 2026-04-23T04:xx
- `/home/cae/ctrl-alt-elite/dashboard/audit/shots/healthy/live-spectator/floor--wide.truth.json` — empirical healthy run
