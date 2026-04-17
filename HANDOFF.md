# CAE Session Handoff
**Date:** 2026-04-17 (session 2, mid-Phase 2)
**From:** Claude Opus 4.7 (1M context) — context running out after Herald v0.1 + v0.2 shipped
**To:** Next Claude session picking up Phase 2 (Timmy bridge + Shift v3)

---

## Read first (in order, all short)

1. **This file (HANDOFF.md)** — 60-second orientation
2. **PHASE_2_PLAN.md** — Phase 2 scope (Herald ✅, Timmy bridge ⏳, Shift v3 ⏳)
3. **CHANGELOG.md** — full change history through 2026-04-17
4. **README.md** — just-audited, should be accurate

---

## Where we are

**Phase 1: SHIPPED** (acceptance 23/0/4 passing on Claude-only, Gemini auth'd + headless-tested but PART B acceptance-extension TODO)

**Phase 2 progress:**
- ✅ Herald v0.1 — `cae herald <doc-type>` one-shot
- ✅ Herald v0.2 — plan → user gate → write → Sentinel review → revise loop (commit `2f4ebf8`)
- ✅ Herald dogfood — generated this project's CHANGELOG.md successfully
- ✅ README factual audit — Herald mentions, Phase 2 status, comparison table, FAQ all corrected
- ✅ Repo pushed to https://github.com/notsatoshii/CAE (deploy key + SSH config at `/home/cae/.ssh/cae_deploy_key`)
- ✅ Gemini OAuth done (`/root/.gemini/oauth_creds.json` exists; `gemini -p "..."` works headless)
- ⏳ **Timmy bridge (H3)** — not started. Scope: Hermes `/delegate` skill → CAE orchestrator via file-mediated inbox/outbox.
- ⏳ **Shift v3 (hero)** — not started. Scope EXPANDED from PHASE_2_PLAN.md: proactive AI mentor, tri-interface (Claude Code skill + Telegram bot + web app), phased v3.0 → v3.1 → v3.2 rollout.

---

## What's live + working

```
cae                        # bare invocation: prints banner + help
cae banner                 # ASCII banner only
cae version                # version string
cae execute-phase <N>      # phase execution (wave parallelism, safety rails)
cae herald <doc-type>      # v0.2 plan+review+revise (DEFAULT)
cae herald <doc-type> --fast       # v0.1 one-shot
cae herald <doc-type> --plan       # outline only
cae herald <doc-type> --review <f> # Sentinel-review existing doc
cae herald <doc-type> --auto       # skip user gates (for CI)
```

Installed globally at `/usr/local/bin/cae` (symlink → `/home/cae/ctrl-alt-elite/bin/cae`).

---

## Critical context for the next session

### User's explicit decisions (honor these)

- **"Fuck estimated days plan — we are just gonna do this all today."** User wants Phase 2 shipped in this working session. No "1 day" / "2 day" estimates that push work to tomorrow.
- **Shift v3 is the hero feature.** Proactive AI mentor, not a one-shot wizard. Drives conversation, asks questions, explains every step, translates jargon, safety-gates irreversible actions. Persists state in `.shift/state.json` across sessions.
- **Shift tri-interface:** ALL THREE — Claude Code skill + Telegram bot + web app. Phased delivery v3.0 → v3.1 → v3.2 but all three are required.
- **Priority order (user confirmed 'c'):** Herald v0.2 ✅ → Timmy bridge → Shift v3.
- **Dogfood aggressively.** Use CAE to build remaining Phase 2 items (Timmy bridge + Shift). This is the validation story. Safeguard: git branch isolation + ability to `git reset --hard origin/main` if Forge wrecks something.
- **User is non-coding founder** — explain strategy/architecture before deep-diving code. Keep updates short. Save memory about decisions in `/root/.claude/projects/-root/memory/`.

### What Shift v3 needs (for the next session to scope precisely)

**Proactive mentor behavior model:**
- Always proposes next action, never leaves user with "what do you want to do?"
- Explains WHY at each step — when spawning CAE, narrates what it means in plain English
- Translates jargon on first use, references earlier definitions
- Suggests defaults when user says "I don't know"
- Safety-gates irreversible actions (git push, deploy, API key usage)
- Persistent across sessions — `/shift` on day 5 resumes where day 1 left off

**Shift modes:**
- `/shift new` — new project intake → PRD → ROADMAP → CAE runs
- `/shift` — resume existing project mentor state
- `/shift next` — proactively do the next thing (with confirm)
- `/shift help` — reads current state, explains in plain English, offers 3 fixes for any stuck state
- `/shift status` — what's done / in-progress / blocked / next
- `/shift learn <topic>` — teaches about CAE concepts (phases, Forge, Sentinel, etc.)

**Shift lifecycle (what it mentors through):**
IDEA → (Scout research) → PRD → user approves → ROADMAP decomposition → user approves → CAE execute → UAT walk-through → iterate → ship (GitHub + optional deploy).

**Interfaces (all three, same backend):**
1. Claude Code skill — terminal-native devs, existing CAE users
2. Telegram bot — reuses Telegram gate infrastructure already in CAE, notifications + chat
3. Web app — `shift.cae.dev` or similar; hosted, auth-lite, visual

**State:** `.shift/state.json` per project. Any interface reads/writes the same state file. User can start on web, Telegram-ping to approve a phase, finish on terminal.

**Technical backing:**
- Python backend `bin/shift` (mentor logic, state, proactive triggers)
- Uses CAE's Scout (Gemini 2.5 Pro) for research phase
- Uses CAE's Arch (Claude Opus via `gsd-planner` wrap) for PRD + ROADMAP drafts
- Uses sentinel_fallback (Claude Opus `gsd-verifier`) for PRD + ROADMAP review gates
- Hands off to `cae execute-phase` for build

### What Timmy bridge needs

See PHASE_2_PLAN.md H3 section. Summary:
- Hermes skill at `/home/timmy/.hermes/skills/delegate`
- Writes buildplan to `/home/cae/inbox/<task-id>/BUILDPLAN.md`
- Fires `cae execute-buildplan <task-id>` in detached tmux
- CAE runs, writes completion sentinel to `/home/cae/outbox/<task-id>/DONE.md`
- Hermes file-watcher → Telegram/WhatsApp notification to user

Entry point on CAE side: new subcommand `cae execute-buildplan <task-id>` that reads buildplan from inbox, runs like execute-phase but from a freeform plan file, writes DONE.md to outbox when finished.

---

## File landmarks

```
/home/cae/ctrl-alt-elite/           ← main repo
├── HANDOFF.md                      ← this file
├── PHASE_2_PLAN.md                 ← Phase 2 scope (Herald+Timmy+Shift)
├── PHASE_1_TASKS.md                ← Phase 1 complete record
├── README.md                       ← audited, accurate
├── CHANGELOG.md                    ← Herald-generated
├── CONFIG_SCHEMA.md                ← stable config surface
├── PIVOT_PLAN.md                   ← original architectural decisions
├── assets/banner.svg               ← retro beige keyboard (static)
├── assets/banner.txt               ← ASCII banner (terminal-only)
├── agents/
│   ├── cae-*.md                    ← 12 persona files (including new cae-herald.md)
├── skills/
│   ├── cae-herald/                 ← new (Phase 2)
│   ├── cae-*/                      ← 7 existing skill dirs
├── bin/
│   ├── cae                         ← orchestrator + herald subcommand
│   ├── sentinel.py                 ← cross-provider review (gemini primary, opus fallback)
│   ├── scribe.py                   ← knowledge extractor (gemini flash → haiku fallback)
│   ├── phantom.py                  ← debugger escalation
│   ├── compactor.py                ← 5-layer compaction cascade
│   ├── circuit_breakers.py         ← 6 hard limits
│   └── telegram_gate.py            ← dangerous-action approval gate
├── adapters/
│   ├── claude-code.sh              ← tmux-wrapped `claude --print`
│   └── gemini-cli.sh               ← tmux-wrapped `gemini -p`
├── config/
│   ├── agent-models.yaml           ← roles → {model, provider, invocation_mode}
│   ├── circuit-breakers.yaml       ← 6 limits config
│   ├── dangerous-actions.yaml      ← regex patterns
│   ├── cae-schema.json             ← JSON Schema v1
│   ├── model-profiles.json         ← quality/balanced/budget profiles
│   └── smart-contract-supplement.md
└── scripts/
    ├── install.sh
    ├── cae-init.sh
    ├── forge-branch.sh
    ├── install-branch-guard.sh
    ├── install-hooks.sh
    ├── multica-bridge.sh
    └── t14-acceptance.sh           ← 23/0/4 passing on Claude-only
```

---

## Running infrastructure on this server

```
port 8765  — Python http.server serving /tmp/cae-docs-viewer/site (may still be running)
port 8090  — Multica backend (Docker, unrelated to CAE work)
port 3002  — Multica frontend
port 5433  — Multica Postgres
```

Tools installed:
- `claude` (Claude Code CLI) — auth'd via `/root/.claude/`
- `gemini` (Gemini CLI) — auth'd via OAuth (`/root/.gemini/oauth_creds.json`)
- `gh` — NOT auth'd (repo uses deploy key via SSH alias `github.com-cae`)
- `gcloud` — installed at `/opt/google-cloud-sdk` (used for Gemini OAuth)
- `tmux`, `python3-yaml`, `rsvg-convert` (for SVG→PNG preview)

---

## Git state

```
branch: main (5 unpushed? no — all pushed)
remote: git@github.com-cae:notsatoshii/CAE.git
latest commit: 2f4ebf8 "Herald v0.2 — plan + review + revise loop with user gates"
```

SSH config at `/root/.ssh/config` has `github.com-cae` alias pointing at the deploy key. `ssh -T git@github.com-cae` returns `Hi notsatoshii/CAE!`.

---

## What the next session should do first

1. **Read PHASE_2_PLAN.md + this file** (5 min).

2. **Choose mode for remaining Phase 2 work:**
   - **Option A — Direct implement (fast):** write Timmy bridge + Shift v3.0 (Claude Code skill variant) directly, no CAE dogfooding. Ship in one session.
   - **Option B — Dogfood via CAE (validates CAE):** use `/gsd-plan-phase` to plan Timmy bridge, `cae execute-phase` to build, same for Shift. Slower but proves CAE works on its own codebase. Branch isolation + pre-push hook protects against Forge wrecking the repo.
   - User's strong preference: ship everything today. Probably Option A for speed, Option B for the one feature that most benefits from dogfooding (likely Shift since it has the most review-heavy phases).

3. **Timmy bridge** — scope is tight (~2h direct implement):
   - New `cae execute-buildplan <task-id>` subcommand in `bin/cae`
   - Reads from `/home/cae/inbox/<id>/BUILDPLAN.md`, writes to `/home/cae/outbox/<id>/DONE.md`
   - Hermes `/delegate` skill in `/home/timmy/.hermes/skills/delegate/`
   - Integration test: delegate a dummy buildplan, confirm DONE.md appears

4. **Shift v3.0** — scope is BIG (~6h direct implement for backend + Claude Code skill):
   - `bin/shift` Python backend (state, proactive triggers, CAE spawn)
   - `.shift/state.json` schema
   - Claude Code skill at `~/.claude/skills/shift/` with intake flow
   - Ideation → PRD → ROADMAP pipeline using CAE's Scout + Arch + Sentinel
   - Modes: new / resume / next / help / status / learn
   - Persistent across sessions
   - Get it to a place where user can run `/shift new` and walk a concrete project all the way through to `cae execute-phase 1` firing.

5. **Shift v3.1 (Telegram client)** and **v3.2 (web app)** — can be subsequent sessions if this one runs out of context.

---

## Known quirks / gotchas

- `claude-code.sh` adapter blocks combined `--agent` + `--system-prompt-file` (mutually exclusive). When wrapping `gsd-doc-writer` with a custom persona (as Herald does), inject persona inline at top of user prompt with `<persona>...</persona>` block. This is what Herald v0.2 does.
- SMIL animation in SVG can't smoothly interpolate between `url(#gradient)` fills — renders as black in most browsers. Keep SVG static or use opacity-overlay tricks for press effects. Banner.svg is currently static.
- GitHub aggressively caches SVG banners. When updating, add `?v=N` query param to the `<img src>` URL to force cache miss. Current README uses `?v=3`.
- Gemini CLI on this server uses OAuth personal (Code Assist free tier). `/root/.gemini/oauth_creds.json` holds the token. Don't commit this file (it's in `.gitignore` now via the .planning dir exclusion).
- When modifying bin/cae, always Read it first before Edit — hook enforces this.
- For dogfooding CAE on its own repo, the `.planning/` directory is gitignored from Phase 1 but Herald's session artifacts are NOT — they're committed for audit trail. Keep this pattern (maybe revisit if .planning grows large).

---

## Quick reference commands

```bash
# Run Herald v0.2 (plan + review + revise)
cae herald readme
cae herald changelog --auto     # non-interactive, good for dogfood

# Run Herald v0.1 (one-shot)
cae herald readme --fast

# Only propose outline
cae herald architecture --plan

# Fact-check an existing doc
cae herald readme --review README.md

# Phase execution
cae execute-phase 2 --dry-run   # see what would happen
cae execute-phase 2             # actually run

# Acceptance gate
bash scripts/t14-acceptance.sh

# Tail metrics
tail -f /path/to/project/.cae/metrics/*.jsonl

# Check infrastructure
which claude gemini tmux python3
gemini -p "reply with OK"
```

---

## Final note from this session

Phase 2 is half-shipped. Herald works end-to-end (dogfood generated this repo's CHANGELOG). Next session needs to build Timmy bridge + Shift v3 in one working session per user's directive. Shift is the biggest piece and the most user-facing — the hero of Phase 2. When the user says "just ship everything today", they mean it, so prefer direct implementation over CAE dogfooding for speed. Save dogfooding for one specific Shift sub-phase that most benefits from showing CAE reviewing itself.

Good luck.

— The session that shipped Herald.
