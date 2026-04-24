# HANDOFF — Session 14 → 15

**Date**: 2026-04-24 (KST).
**HEAD at close**: `2c4b361` on `origin/main`.
**Session disposition**: Eric says FE is still trash. Multiple real bugs remain; this session killed some surface issues and the data backbone but didn't rebuild the UI craft.

---

## Eric's verdict (verbatim)

> "Im completely disappointed in the current FE state. And the last 4 cycles really havent solved for much."

> "pixel agents still not working..."

> "there's a LOT more issues than just those 2 bugs."

Direction for session 15: **use CAE-proper (not direct Claude Code)** to fix + improve the FE. Treat the dashboard as a real CAE project: queue tasks through the inbox, run parallel forge agents, merge via outbox.

---

## What shipped this session (13 commits, all on origin/main)

| SHA | Title |
|---|---|
| `018c1f6` | USD → tokens on task-header chip |
| `29523dd` | USD killed from mission-control hero (`tokens_burn_per_min`→`tokens_burn_7d` rename, dropped budget concept) |
| `16cedb8` | Pixel-agent render scale 2×→3× (renderer.ts + office-layout.ts) |
| `5ad1d01` | `shipped_today` JST vs UTC timezone fix + `in_flight` counts active agents |
| `b6d7a4d` | Glass sweep — `.card-base` + `<Panel>` default `glass=true` |
| `e1118a0` | **audit-hook.sh reads stdin JSON** (new Claude Code API; `$CLAUDE_TOOL_NAME` env is gone). Unblocks `tool-calls.jsonl` writer |
| `6c851d9` | Burn tile scope 60s → 7d (`tokens_burn_per_min`→`tokens_burn_7d`) |
| `f1d8056` | `use-state-poll` test fix (fake session cookie) |
| `e1a900f` | Rollup aggregation hardened + regression tests (prevents future per-project scoping bug) |
| `460b992` | Top-nav overflow menu test uses `findBy*` for async portal |
| `95df7a9` | **Colored `ACTIVE · Nx` chip on agent cards** — pulsing, keyboard-focusable; AgentGrid sorts active first |
| `2c4b361` | `buildPhases` includes non-archived phases (was filtering to `active` only, dropped all 17) + Playwright live-smoke spec |

Ancillary:
- Disabled zombie `vigil-dashboard.service` systemd unit (34k+ crash-loop restarts stopped).
- `scripts/lint-no-dollar.sh` scope expanded from metrics-only → whole FE surface.
- New live smoke at `audit/score/session14-live-smoke.spec.ts` + config.

All 1694 unit tests green. Live Playwright smoke: 6/6 green (but see bugs below — green tests ≠ working UI).

---

## Confirmed bugs still on the FE

### B1 — Rollup strip stuck at "shipped 0 nominal" despite API returning 22

**Live smoke truth:**
- `GET /api/state` → `rollup: { shipped_today: 22, tokens_today: 27939, in_flight: 0, blocked: 0, warnings: 0 }` ✅
- `home_phases` → 17 entries ✅
- Yet DOM text on `/build` reads `"shipped 0 nominal in-flight 0 nominal warnings 0 nominal blocked 0 nominal tok 0 nominal"` (twice, mobile + desktop layouts).

**Root cause**: not yet nailed. Two candidates:
1. `useStatePoll()` not hydrating in the Playwright session (session cookie present but fetch path deferred)
2. Dev-mode HMR serving a stale compile of `rollup-strip.tsx`

**Where to look**: `components/build-home/rollup-strip.tsx:98-109`. Data path is `useStatePoll().data?.rollup`. Default fallback is all-zeros. Test rollup-strip in isolation against a hydrated StatePollProvider fixture — if that works, the bug is in live polling timing.

### B2 — Pixel agents "still not working at all"

**Live smoke truth:**
- `/floor` canvas mounts ✅
- `/pixel-agents/characters/char_0.png` returns 200 OK ✅
- Scale bump (16cedb8) committed — sprites should render 3× larger.

**Probable cause**: no `forge_begin` events in `circuit-breakers.jsonl` → no agents in scene → renderer draws an empty floor. The scale bump is a no-op when there's nothing to render. Also `tool-calls.jsonl` producer only wrote ONE row after my `e1118a0` stdin fix — because I committed inside one session and subsequent sessions haven't fired tool calls through the new code path yet.

**Where to look**: `lib/floor/event-adapter.ts` (how circuit-breaker events become pixel agents in the scene). Check whether the scene has zero agents at steady-state and, if so, seed fake forge events in dev mode so `/floor` always has something moving.

---

## "A LOT more issues" per Eric (to triage in session 15)

Explicitly called out this session but not yet diagnosed:
- Glassmorphism unclear if visible — committed but Eric hasn't verified post-refresh.
- Pixel agents "look like trash" even at 3×; may need 4× bump or different sprite art.
- Agent tags / chips across the product (chat, queue, workflows) — currently only /build/agents has the new ACTIVE chip.
- Active-tab / active-phase surfaces show nothing.
- "Recent" feed empty.
- "Activity stream offline" indicator — despite `/api/activity/live` returning 200.
- Dashboard "basic and not intuitive", "mid at best" (standing session-13 critique).

Eric's direction: "there's a LOT more issues than just those 2 bugs." The full list lives in Eric's head; next session must start with a UAT walkthrough where he clicks through + points.

---

## Sys-level state (not in git)

- `vigil-dashboard.service`: stopped + disabled (systemd).
- Dev server: `next-server (v16.2.4)` on `:3002` as pid-of-the-day under `/home/cae/ctrl-alt-elite/dashboard`, started ~13:30 KST, dev mode / HMR on.
- `audit/auth/storage-state.json`: freshly minted admin JWE, expires 2026-05-24.
- `tool-calls.jsonl` producer: FIXED — was env-var-dependent, now reads stdin JSON. Every Claude Code tool call from this session forward writes a row.

---

## Handoff to session 15 — CAE auto-audit (UAT killed)

**Eric's directive (2026-04-24, mid-session-15):** "I built CAE so that it doesn't need UAT" + "change it so that UAT won't be necessary as a step moving forward, especially for FE." See `dashboard/AUDIT-GATE.md` for the binding protocol.

Session 15 procedure (encoded in `dashboard/AUDIT-GATE.md`):

1. **Cold start**: read this file + `dashboard/AUDIT-GATE.md`.
2. **Capture**: `AUDIT_BASE_URL=http://localhost:3002 FIXTURE=healthy AUTH_SECRET=$(grep ^AUTH_SECRET .env.local | cut -d= -f2) npx playwright test -c audit/playwright.config.ts`.
3. **Score**: `npx tsx audit/score-run.ts C<N> --fixture healthy --prior C<N-1>`.
4. **Cluster** findings into `.planning/phases/<N>-…/W<wave>-<slug>-PLAN.md` files.
5. **Execute**: `cd dashboard && cae execute-phase <N>` — wave-parallel forge agents.
6. **Re-audit** as C<N+1>. Merge-gate: see AUDIT-GATE.md for the three conditions.

**No Eric walkthrough.** No "wait for Eric to click around." Harness is the gate.

Session 15 first run (this very session): phase 17-fe-auto-audit-fixes, plans under `.planning/phases/17-fe-auto-audit-fixes/`. C5-session15 baseline at `audit/reports/C5-session15-*`. Re-audit will be C6.

---

## Resume at

- **Files**: `dashboard/HANDOFF-SESSION14.md` (this file), `dashboard/AUDIT-GATE.md` (binding protocol), `dashboard/.planning/phases/17-fe-auto-audit-fixes/FINDINGS.md` (current cycle).
- **HEAD**: `0c5e1fd` (handoff doc on top of `2c4b361`; phase 17 plans + AUDIT-GATE not yet committed at handoff write time — check `git status`).
- **First action**: `cd /home/cae/ctrl-alt-elite/dashboard && cae execute-phase 17` IF plans are committed, otherwise commit them first.
