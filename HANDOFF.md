# CAE Session Handoff
**Date:** 2026-04-17
**From:** Claude Opus 4.6 (1M context) — session running out of context
**To:** Next Claude session picking up CAE Phase 1 work

---

## Read these three first (in order)

1. **This file** (HANDOFF.md) — the 60-second orientation
2. **PIVOT_PLAN.md** — the 9 architectural decisions + GSD-wrap strategy
3. **PHASE_1_TASKS.md** — the 14 tasks, 13 done

Docs are viewable in browser at: `http://165.245.186.254:8765/` (Python http.server running on background task, port 8765 open in ufw).

If the viewer is down: `cd /tmp/cae-docs-viewer/site && python3 -m http.server 8765 --bind 0.0.0.0 &`

---

## What CAE is (30-second version)

Ctrl+Alt+Elite is a multi-agent coding team. Orchestrator spawns Claude Code and Gemini CLI as subprocesses (tmux panes), wraps GSD agents for Claude-side roles, ports methodology to Gemini for cross-provider adversarial review. Forge builds → Sentinel (different model) reviews → Scribe (Gemini Flash) extracts learnings → all mediated through files (PLAN.md, AGENTS.md, git).

Separate from Timmy (the user's Life OS / orchestrator, lives in `/home/timmy/.hermes/`, Phase 2 scope).

**Phase 1 goal:** build CAE correctly. Acceptance gate is a toy integration test (markdown-to-JSON converter, or similar). LEVER redeployment was dropped as Phase 1 target — see `CURRENT_STATE.md` for why.

---

## Where everything lives

```
/home/cae/ctrl-alt-elite/         ← main repo (local-only, no remote push yet)
├── HANDOFF.md                    ← this file
├── CURRENT_STATE.md              ← pre-pivot honest audit
├── PIVOT_PLAN.md                 ← R2 — active plan
├── PHASE_1_TASKS.md              ← R2 — 14 tasks
├── CONFIG_SCHEMA.md              ← public API v1 for Shift to generate
├── TIMELINE.md                   ← 15/20/25 days
├── QUESTIONS_FOR_MASTER.md       ← open blockers (Q1, Q4, Q5 still open)
├── OMC_OMX_REFERENCE.md          ← patterns from OMC/OMX (tmux etc.)
├── docs/
│   ├── WRAPPED_AGENT_CONTRACTS.md ← validated prompts for gsd-ui-checker, gsd-plan-checker
│   └── WHEN_T1_LANDS.md           ← what activates when user does T1
├── bin/
│   ├── cae                       ← orchestrator (Python, executable)
│   ├── circuit_breakers.py       ← 6 limits
│   ├── phantom.py                ← gsd-debugger integration
│   ├── sentinel.py               ← Gemini Sentinel + Claude fallback
│   ├── scribe.py                 ← Scribe (Gemini Flash primary)
│   ├── compactor.py              ← 5-layer cascade
│   └── telegram_gate.py          ← dangerous-action approval
├── adapters/
│   ├── claude-code.sh            ← tmux-spawned `claude --print`
│   └── gemini-cli.sh             ← tmux-spawned `gemini --print` (untested until T1)
├── agents/                       ← 10 persona docs + 2 Gemini-specific prompts
├── skills/                       ← 7 SKILL.md files injected into GSD agents
├── config/
│   ├── agent-models.yaml         ← role → {model, provider, invocation_mode}
│   ├── circuit-breakers.yaml     ← 6 limits
│   ├── dangerous-actions.yaml    ← 8 regex patterns
│   └── cae-schema.json           ← JSON Schema validator for all configs
└── scripts/
    ├── cae-init.sh               ← project initializer (reads agent-models.yaml)
    ├── install.sh                ← main installer
    ├── install-hooks.sh          ← Claude Code hook installer
    ├── install-branch-guard.sh   ← git pre-push hook
    ├── forge-branch.sh           ← create/merge/abandon/cleanup
    ├── multica-bridge.sh         ← (carried over, optional)
    └── t14-acceptance.sh         ← acceptance test runner (23 checks)
```

**Auto-memory:** `/root/.claude/projects/-root/memory/` has pointers — see MEMORY.md there.

---

## Phase 1 status

15 of 15 tasks complete (including T2.5 prototype + T14 acceptance). Two things the user (Master) needs to do before anything lights up:

- **T1 — Gemini CLI + OAuth.** Recommended path (per QUESTIONS_FOR_MASTER.md Q4): user OAuths on their local machine, scp-es credentials to this server. See `docs/WHEN_T1_LANDS.md` for the exact smoke test.
- **T11 — Telegram bot token.** User creates bot via @BotFather, sets env vars `CAE_TELEGRAM_BOT_TOKEN` + `CAE_TELEGRAM_CHAT_ID`. Code is already in place and running in stub mode.

Everything else runs today. **Run `bash scripts/t14-acceptance.sh` to verify — 23 checks should pass, 4 skip (awaiting T1).**

---

## The biggest-risk check that passed

**GSD-wrap strategy validated in T2.5.** The concern was that `claude --print --agent gsd-<name>` might not honor the system prompt when the workflow-expected XML wrappers weren't in the user prompt. Tested on gsd-ui-checker and gsd-plan-checker. Both produced structured output matching their declared formats — plan-checker found 7 real issues in a hastily-written test plan (6 beyond what I planted). The 3,150 lines of GSD prompt engineering inherits cleanly.

**Contracts documented** in `docs/WRAPPED_AGENT_CONTRACTS.md` — prompt structure per wrapped agent, known preamble behavior, parser strategy (scan for section markers, skip preamble).

---

## What's running on this server right now (for context)

```
port 8765  — Python http.server serving /tmp/cae-docs-viewer/site (background task)
port 8090  — Multica backend (Docker, healthy)
port 3002  — Multica frontend (Docker, healthy)
port 5433  — Multica Postgres (Docker, healthy)
ufw:       — 8765 opened this session
gh auth:   — NOT configured. Repo is local-only.
```

Plus the Lever-protocol and RECON services (unrelated to CAE, don't disturb).

---

## Unpushed commits

Local git history for `/home/cae/ctrl-alt-elite/`:
```
4167f20  T14 Phase 1 acceptance gate + T1-unlock documentation
3e1cc12  Phase 1: orchestrator wiring, Sentinel, Telegram gate, Scribe, compactor
2935027  Phase 1: adapter, branch isolation, circuit breakers, Phantom integration
b6ef815  Phase 1 pivot: drop LEVER, wrap GSD agents, orchestrator skeleton
4620292  Initial commit: Ctrl+Alt+Elite multi-agent coding team
```

Five commits, all local. `gh auth login` needed for remote push (QUESTIONS_FOR_MASTER Q5 — not yet decided if repo lives as personal or org).

---

## User's working style (preserved from this session)

Documented in auto-memory already. Highlights:
- Wants critical self-assessment, not surface-level sign-off
- Prefers decisive action and reasoned defaults over "want me to continue?" questions
- Karpathy-style rules: no gold-plating, surgical changes, explicit assumptions
- When user says "keep going" they mean really keep going; don't ask for permission at checkpoints
- Master is a non-coding founder — explain architecture/strategy level first, go deeper only on ask
- When in doubt, prefer smaller scope

**One specific rule the user stated this session:** All Claude Code subprocesses CAE spawns use `--effort max` by default (baked into adapter defaults + agent-models.yaml). Overridable per-task via task.md frontmatter.

---

## What the next session should do first

1. **Run the acceptance test** — `bash /home/cae/ctrl-alt-elite/scripts/t14-acceptance.sh`. Confirms nothing regressed during the context handoff.

2. **Check task list** — TaskList tool in the next session will show 17 tasks (#18-#34). 15 complete, 2 pending (T1, T11 — both blocked on user).

3. **Check with Master:**
   - Has T1 (Gemini CLI OAuth) been completed? If yes, proceed to PART B of T14 + wire post-phase Scribe into bin/cae (~half day work, documented in `docs/WHEN_T1_LANDS.md`).
   - Has a Telegram bot been created? If yes, set env vars and run a dangerous-action test.
   - If neither: the system is waiting. Options are (a) push the repo to GitHub (needs gh auth), (b) start designing Phase 2 (LEVER redeployment re-scoped, or Timmy integration), or (c) wait.

4. **If nothing is blocked and Master wants to proceed:** the next reasonable build target is the post-phase Scribe trigger in `bin/cae` (~5 lines, described in WHEN_T1_LANDS.md) — but it's a no-op until T1. Or start scoping Phase 2.

---

## Known quirks / gotchas

- `cae-init.sh` has BOTH Python and Node fallback paths for YAML parsing. Python (with `python3-markdown` / PyYAML) is preferred on this server.
- `forge-branch.sh create` used to refuse on untracked files; now only refuses on MODIFIED tracked files. This matters because `cae-init.sh` generates untracked files (AGENTS.md, `.claude/skills/`) which would have blocked orchestration.
- Sentinel auto-detects gemini: `subprocess.run(["which", "gemini"], ...)`. No gemini = stub with clear warning logged to `.cae/metrics/sentinel-stub.jsonl`.
- Telegram gate auto-detects bot token: env var missing → stub mode, loud stderr warnings, `CAE_GATE_STUB_AUTO` controls auto-approve vs auto-deny.
- Compactor layers (b) and (e) use Haiku (not Gemini) for summarization. They technically work today because Haiku is available via Claude Code — the T14 "skip" for them is conservative.
- The `.gitignore` has `__pycache__/` — don't commit .pyc files.
- PyYAML is installed via `apt install python3-yaml` (PEP 668 blocks `pip install` at system level).

---

## Quick reference — useful commands

```bash
# Test the whole pipeline (23 checks)
bash /home/cae/ctrl-alt-elite/scripts/t14-acceptance.sh

# Dry-run any project
/home/cae/ctrl-alt-elite/bin/cae execute-phase N --dry-run

# Initialize CAE for a new project (run AFTER gsd-new-project)
cd /path/to/project
bash /home/cae/ctrl-alt-elite/scripts/cae-init.sh .

# Smoke-test Claude adapter manually
echo '<objective>say hi</objective>' > /tmp/p.md
bash /home/cae/ctrl-alt-elite/adapters/claude-code.sh /tmp/p.md claude-sonnet-4-6 smoke \
  --system-prompt-file /home/cae/ctrl-alt-elite/agents/cae-forge.md --effort low --timeout 60

# Inspect CAE metrics after a run
ls .cae/metrics/
cat .cae/metrics/circuit-breakers.jsonl | tail
cat .cae/metrics/compaction.jsonl | tail

# View docs in browser
# http://165.245.186.254:8765/
```

---

## Final note

Everything this session was asked to ship (excluding user-gated bits) is shipped. No partial code, no TODO stubs masquerading as features. T14 acceptance gate is green on 23 checks. Stub modes are all explicit and loud about being stubs.

The wrap strategy paid off. ~3,150 lines of GSD prompt engineering inherited for free; our code surface is small. Re-read `docs/WRAPPED_AGENT_CONTRACTS.md` if the wrap approach confuses later work.

Good luck.

— The session that built Phase 1.
