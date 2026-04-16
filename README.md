<p align="center">
  <img src="./assets/banner.svg" alt="CTRL + ALT + ELITE" width="800"/>
</p>

> **The AI coder that gets code-reviewed.**

<p align="center">
  <a href="./PHASE_1_TASKS.md"><img src="https://img.shields.io/badge/phase-1%20complete-brightgreen" alt="Phase 1 complete"/></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License"/></a>
  <img src="https://img.shields.io/badge/stack-Python%203%20%2B%20Bash-lightgrey" alt="Stack"/>
  <img src="https://img.shields.io/badge/models-Claude%20Opus%20%7C%20Sonnet%20%7C%20Haiku%20%2B%20Gemini%202.5%20Pro%20%2F%20Flash-orange" alt="Models"/>
</p>

---

## The problem

One-shot AI coders — Cursor, Aider, Devin, Claude Code solo — all have the same blind spot: **when one model builds AND verifies, it rubber-stamps its own work.** Ask Claude to write a function then ask Claude to review it, and you get a diff-party with no reviewer. Real bugs slip through. Architecture drifts. No one pushes back.

Human dev shops solve this with teams: someone builds, someone else reviews, someone debugs, someone documents. That's the pattern.

## What CAE is

**Ctrl+Alt+Elite is an AI dev shop.** A team of specialized AI agents orchestrated through file-mediated handoffs — no long-lived sessions, no context rot, no rubber-stamping.

You hand CAE a buildplan. **Forge** implements. **Sentinel** (a *different* model) reviews adversarially. **Scribe** extracts learnings into a shared `AGENTS.md` that the next task reads. **Phantom** debugs when Forge fails three times. **Aegis** audits security when it sees Solidity. **Herald** writes the user-facing docs (README, ARCHITECTURE) so humans can actually navigate what got shipped. Every agent runs in a fresh context, spawned per task, killed when done.

Built on top of [GSD (Get-Shit-Done)](https://github.com/gsd-build/get-shit-done) and [Claude Code](https://docs.anthropic.com/en/docs/claude-code), with [Gemini CLI](https://github.com/google-gemini/gemini-cli) for cross-provider adversarial review.

## 30-second quick start

```bash
git clone https://github.com/notsatoshii/CAE.git
cd CAE && ./scripts/install.sh

# In any project directory
cd your-project
gsd-new-project        # one-time intake
cae execute-phase 1    # ship it
```

Requires: Claude Code CLI (authenticated), Python 3.9+, Bash, tmux, git. Gemini CLI optional (real Sentinel upgrades to cross-provider if available; falls back to Claude Opus `gsd-verifier` otherwise).

## What makes it different

- **Reviewer ≠ Builder, enforced at the code level.** Sentinel runs on a different model than Forge. Verdicts where `reviewer_model == builder_model` are rejected and re-run on the fallback. No self-review loopholes.
- **File-mediated, not session-based.** Every agent spawns fresh, reads shared state from disk (`PLAN.md`, `AGENTS.md`, `SUMMARY.md`, `KNOWLEDGE/`), writes, then dies. No context rot between tasks. No surprise conversation pruning on turn 20.
- **GSD methodology inherited, not rebuilt.** 3,150 lines of battle-tested prompt engineering wrap cleanly as agents (`claude --print --agent gsd-*`). CAE doesn't reinvent what works.
- **Production guardrails baked in.** Branch isolation (`forge/<task-id>` with pre-push hook), circuit breakers (turn budget, retry cap, token limit, concurrent Forge semaphore), Telegram approval gate for dangerous actions (`rm -rf`, `git push main`, on-chain broadcasts).
- **Smart-contract aware.** Auto-detects `.sol`/`.vy`/`foundry.toml`, promotes Forge to Opus, runs Aegis (security auditor) after every contract change.
- **Persistent learning.** Scribe (Gemini Flash, falls back to Haiku) extracts learnings after each phase. 300-line `AGENTS.md` hard cap; overflow rotates to `KNOWLEDGE/*.md` topic files. Tasks tagged `tags: [solidity, auth]` pull in the matching knowledge.

## How it works

```
                    ┌────────────────────────┐
                    │  NEXUS (orchestrator)  │
                    │  reads PLAN.md         │
                    └───┬────────────────────┘
                        │ dispatch (wave-parallel)
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   ┌─────────┐     ┌─────────┐     ┌─────────┐
   │ FORGE 1 │     │ FORGE 2 │     │ FORGE 3 │   each on forge/<task-id>
   │ Sonnet  │     │ Sonnet  │     │ Sonnet  │   branch, fresh context
   └────┬────┘     └────┬────┘     └────┬────┘
        │               │               │
        └───────────────┼───────────────┘
                        │ diffs
                        ▼
                ┌───────────────────┐
                │ SENTINEL          │   ◄─ different model than Forge
                │ Gemini 2.5 Pro    │      (Opus gsd-verifier fallback)
                │ goal-backward     │
                │ 3-level review    │
                └─────┬─────────┬───┘
                      │ approve │ reject
                      ▼         ▼
                 merge to    retry (with issues)
                 phase branch  → 3 fails → PHANTOM (debugger)
                      │                    → 2 fails → HALT + Telegram
                      ▼
                ┌──────────────┐
                │ SCRIBE       │   ◄─ extracts learnings
                │ Gemini Flash │      updates AGENTS.md + KNOWLEDGE/
                └──────────────┘
```

Every arrow is a file on disk. Every agent is `claude --print` or `gemini -p` in a tmux pane. No sessions. No daemons. Fully introspectable — `tail -f .cae/metrics/*.jsonl` shows every decision in real time.

## The harness

CAE isn't a model. It's a harness — the scaffolding around models that makes them work as a team.

- **Process harness:** `tmux` — every agent invocation spawns a detached pane, captures stdout/stderr/meta to files, times out cleanly. Patterns borrowed from [OMC/OMX](./OMC_OMX_REFERENCE.md).
- **Agent harness:** Claude Code CLI (`claude --print --agent gsd-<name>`) + Gemini CLI (`gemini -p`). CAE doesn't reinvent these — it wraps them.
- **Workflow harness:** GSD methodology. Phase decomposition, wave execution, plan validation, goal-backward verification, worktree isolation. CAE inherits 3,150 lines of workflow prompt engineering without porting it.
- **File harness:** `.planning/` directory (`PLAN.md`, `PROJECT.md`, `STATE.md`, phase dirs), `AGENTS.md`, `KNOWLEDGE/`, `.cae/metrics/`. Every agent reads from and writes to this filesystem. No in-memory state to lose.
- **Safety harness:** circuit breakers, branch isolation (`forge/<task-id>` with pre-push hook), Telegram dangerous-action gate, Phantom escalation on repeated failures.

## Saving context (why CAE doesn't run out of tokens)

Long-horizon coding burns context. Single-agent tools spiral once the conversation exceeds ~50k effective tokens — auto-compaction starts dropping relevant detail silently. CAE attacks this on five fronts:

**1. Fresh context per task** — every Forge spawn reads its task.md, AGENTS.md, and the specific files it needs. Nothing else. When the task commits, Forge dies. Next task starts from zero. No conversation accumulation. Pattern from [Ralph](https://github.com/snarktank/ralph).

**2. 3-layer context injection** — per-task prompts inject only three things: (a) compact project index, (b) phase-scoped research brief from Scout, (c) specific files the task touches. No "just in case" file dumps. Pattern from [Claude-Mem](https://github.com/thedotmack/claude-mem).

**3. Compaction cascade (5 layers)** — `bin/compactor.py` runs preprocessing before every spawn:
  - `(a)` **Tool output budgets** — `Read` capped at 2000 lines, `Grep` at 1000, `Bash` at 3000, truncated with "… N lines omitted" markers
  - `(b)` **File summaries** — files >500 lines get summarized once via Claude Haiku, cached in `.cae/summaries/`, task.md sees `@path/to/file (summary)` instead of raw content
  - `(c)` **Turn pruning** — beyond 15 exchanges in a retry loop, orchestrator collapses old attempts into summarized `<retry_context>` blocks
  - `(d)` **Caveman activation** — at 60% context fill, Forge's output is auto-compressed via the [Caveman](https://github.com/JuliusBrussee/caveman) plugin (~65–75% reduction while preserving technical substance)
  - `(e)` **Hard summarize** — at 85% fill, old retry blocks collapse into a single Haiku-generated summary and task continues

**4. Caveman token compression** — Caveman plugin runs on Forge output, converting prose into terse caveman-style bullets. Preserves code blocks, file paths, error messages verbatim; strips articles, hedging, pleasantries. 65–75% reduction on natural prose with zero semantic loss on technical content. Install auto-managed by `scripts/install.sh`.

**5. AGENTS.md 300-line hard cap** — Scribe maintains one lean shared-knowledge file capped at 300 lines. Overflow rotates to `KNOWLEDGE/<topic>.md`. Tasks tagged `tags: [solidity, auth]` pull in only the matching topic files, not the whole knowledge base. No infinitely-growing context rot.

**Bonus: [Karpathy Guidelines](https://github.com/forrestchang/andrej-karpathy-skills) plugin** — installed during setup, prevents over-engineering (no premature abstractions, surgical changes, explicit assumptions). Smaller diffs = smaller reviews = less Sentinel token spend.

All firings logged to `.cae/metrics/compaction.jsonl` so you can see exactly which layer(s) kicked in on any given run.

## Agent roster

### Core team (every project)
| Agent    | Role                                      | Default model       | Invocation           |
|----------|-------------------------------------------|---------------------|----------------------|
| Nexus    | Orchestrator — reads plan, dispatches     | Claude Opus         | direct-prompt        |
| Arch     | Architect — authors plans, checks them    | Claude Opus         | wrap `gsd-planner`   |
| Forge    | Builder — implements one task             | Claude Sonnet       | direct-prompt        |
| Sentinel | Reviewer — enforced ≠ builder model       | Gemini 2.5 Pro      | direct-prompt        |
| Scout    | Researcher — codebase + domain briefs     | Gemini 2.5 Pro      | direct-prompt        |
| Scribe   | Knowledge keeper — AGENTS.md learnings    | Gemini Flash        | direct-prompt        |
| Herald   | User-facing docs writer                   | Claude Sonnet       | wrap `gsd-doc-writer`|

### Specialists (auto-activated or on-demand)
| Agent    | When                                       | Default model       |
|----------|--------------------------------------------|---------------------|
| Aegis    | Smart contracts detected                   | Claude Opus         |
| Phantom  | 3 Forge failures on same task              | Claude Sonnet       |
| Prism    | UI-heavy phases                            | Claude Sonnet       |
| Flux     | DevOps / infrastructure tasks              | Claude Sonnet       |

**Scribe vs Herald** — both write docs, but they're distinct roles. **Scribe** maintains the *internal* `AGENTS.md` + `KNOWLEDGE/` (for future agents to read). **Herald** writes the *external* project docs — README, ARCHITECTURE.md, DEPLOYMENT.md, CHANGELOG (for humans navigating the project). Scribe runs automatically after every phase. Herald runs on-demand via `cae herald <doc-type>`.

Sentinel falls back to `gsd-verifier` wrap on Claude Opus if Gemini isn't available — adversarial diversity preserved (Opus reviews Sonnet builder).

## CAE vs other AI coding tools

| Capability                               | Claude Code solo | Aider    | Cursor   | Devin    | **CAE**       |
|------------------------------------------|------------------|----------|----------|----------|---------------|
| Multi-agent team                         | ✗                | ✗        | ✗        | ~        | ✅            |
| Reviewer ≠ builder model, enforced       | ✗                | ✗        | ✗        | ✗        | ✅            |
| File-mediated handoffs (no context rot)  | ✗                | ✗        | ✗        | ✗        | ✅            |
| GSD phase/wave workflow                  | ✗                | ✗        | ✗        | ✗        | ✅            |
| Production circuit breakers              | ✗                | ✗        | ✗        | ~        | ✅            |
| Smart-contract mode                      | ✗                | ✗        | ✗        | ✗        | ✅            |
| Telegram approval for dangerous ops      | ✗                | ✗        | ✗        | ✗        | ✅            |
| Persistent learning across sessions      | ~                | ~        | ~        | ~        | ✅ AGENTS.md  |
| Fresh context per task                   | ✗                | ✗        | ✗        | ✗        | ✅            |
| IDE integration                          | CLI              | CLI      | ✅       | web      | CLI           |
| Runs on own API key (no vendor lock)     | ✅               | ✅       | ✗        | ✗        | ✅            |

`~` = partial / unclear / mode-dependent.

## Who this is for

- **Founders shipping real products** who can't afford one-shot AI's silent confabulation.
- **Smart-contract teams** where mistakes cost $10K+ — Aegis auditor + Opus on contract code + Gemini adversarial review.
- **Long-horizon projects** where context rot kills quality by week 3. File-mediated handoffs don't rot.
- **People building with AI on nights/weekends** who need a team to catch their mistakes while they sleep.

Not for: one-off scripts (use `claude` directly), pair-programming flow (use Cursor), or research prototypes where review is noise.

## Status

**Phase 1 complete** — orchestrator, safety layer, wrapped GSD agents, cross-provider Sentinel, automated Scribe, Phantom integration, Telegram gate, compaction cascade, full acceptance gate (23/0/4 passing on Claude-only; Gemini PART B live now). See [`PHASE_1_TASKS.md`](./PHASE_1_TASKS.md).

**Phase 2 in progress** — Herald (doc writer), Timmy bridge (external orchestration), Shift (normie-facing project genesis). See [`PHASE_2_PLAN.md`](./PHASE_2_PLAN.md).

**Roadmap** — multi-project orchestration, metrics UI, real job queue (upgrade from file-lock semaphore), Slack/email notifications, rollback automation.

Honest positioning: **early**. Phase 1 passed a toy workload (markdown-to-JSON converter, calc CLI). Not yet proven on production-scale projects. Star the repo if you want to follow; issues welcome if you try it.

## Requirements

- **Claude Code CLI** — authenticated (`claude --version`)
- **Python 3.9+** with PyYAML (`apt install python3-yaml`)
- **Bash 5+**, **tmux**, **git**
- **Gemini CLI** (optional) — `npm install -g @google/gemini-cli`, OAuth via `gemini` interactive (`GOOGLE_GENAI_USE_GCA` path → generous free tier). Without Gemini, Sentinel/Scribe fall back to Claude Opus/Haiku automatically.
- **Telegram bot** (optional) — required for dangerous-action approval. Without it, stub mode auto-approves with loud warnings.

## Install

```bash
git clone https://github.com/notsatoshii/CAE.git
cd CAE
./scripts/install.sh
```

The installer:
1. Puts `cae` on your PATH (symlink to `bin/cae`)
2. Installs the Claude Code hook for per-project `cae-init.sh` invocation
3. Installs the git `pre-push` branch guard template

Then in any project:
```bash
cd your-project
gsd-new-project               # intake — produces PROJECT.md + ROADMAP.md
bash /path/to/CAE/scripts/cae-init.sh .   # generate .planning/config.json for CAE
cae execute-phase 1           # dispatch phase 1 tasks
```

See [`docs/WRAPPED_AGENT_CONTRACTS.md`](./docs/WRAPPED_AGENT_CONTRACTS.md) for the contract each wrapped GSD agent expects.

## Configuration

CAE is entirely config-driven. Config surface (all stable — see [`CONFIG_SCHEMA.md`](./CONFIG_SCHEMA.md)):

- `config/agent-models.yaml` — role → {model, provider, invocation_mode}. Change Opus to Haiku globally in one line.
- `config/circuit-breakers.yaml` — 6 limits (turn budget, retry cap, concurrent Forge, tokens in/out, sentinel JSON failures).
- `config/dangerous-actions.yaml` — regex patterns that trigger Telegram gate.
- `config/cae-schema.json` — JSON Schema for programmatic validation (draft 2020-12).

Per-project overrides go into `.planning/config.json`. Per-task overrides via `task.md` frontmatter (e.g., `effort: low` to cheap out a trivial task).

## Project structure

```
CAE/
├── bin/           # cae orchestrator + sentinel + scribe + phantom + compactor
├── adapters/      # claude-code.sh, gemini-cli.sh (tmux-wrapped subprocess invokers)
├── agents/        # 10+ persona markdown files
├── skills/        # Claude Code skills injected into wrapped GSD agents
├── config/        # agent-models, circuit-breakers, dangerous-actions, schema
├── scripts/       # install, cae-init, forge-branch, install-hooks, t14-acceptance
├── assets/        # README banner (animated SVG)
└── docs/          # WRAPPED_AGENT_CONTRACTS, WHEN_T1_LANDS
```

## Built on, inspired by

### Runtime stack (the harness)
- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** — primary AI coding runtime. Every Claude-side agent is `claude --print --agent <name>` under the hood.
- **[Gemini CLI](https://github.com/google-gemini/gemini-cli)** — Gemini Code Assist / Gemini 2.5 Pro + Flash. Drives the adversarial review path and cheap knowledge extraction.
- **[GSD (Get-Shit-Done)](https://github.com/gsd-build/get-shit-done)** — phase-based workflow, wave execution, worktree isolation, state persistence, goal-backward verification. 3,150 lines of prompt engineering CAE inherits cleanly via the `gsd-*` agent wraps.
- **[tmux](https://github.com/tmux/tmux) + [Bash](https://www.gnu.org/software/bash/)** — process harness. Every agent invocation lives in its own detached tmux session; stdout/stderr/metadata land in files.

### Token + context management
- **[Caveman](https://github.com/JuliusBrussee/caveman)** plugin — auto-compresses Forge output ~65–75% while preserving code blocks, file paths, and error messages verbatim. Installed by `scripts/install.sh`.
- **[Karpathy Guidelines](https://github.com/forrestchang/andrej-karpathy-skills)** plugin — quality guardrails injected into every agent: no premature abstractions, surgical changes, explicit assumptions, no gold-plating. Smaller diffs → smaller reviews → less token spend.
- **Claude Haiku** — used inside CAE's compaction cascade for cheap file summaries + hard-summarize fallback at 85% context fill.

### Patterns borrowed
- **[Ralph](https://github.com/snarktank/ralph)** — fresh context per task (no session accumulation), AGENTS.md as the team's shared learning loop.
- **[Claude-Mem](https://github.com/thedotmack/claude-mem)** — 3-layer context injection: project index → research brief → specific files only. No "just in case" file dumps.
- **[OMC / OMX](./OMC_OMX_REFERENCE.md)** — tmux coordination patterns, pane-per-invocation, file-mediated status signaling. Informed the adapter design.
- **BIOS-style boot checklists** — the `cae banner` roster output (visible in terminal, not in README) nods to old-school system diagnostics.

### Peripheral
- **[Multica](https://github.com/multica-ai/multica)** — optional dashboard for tracking agent status + task state across projects. Bridge script at `scripts/multica-bridge.sh`.

### Honest credits
CAE is overwhelmingly thin glue. The three heavyweights doing the real work are **GSD** (the methodology), **Claude Code** (the agent runtime), and **Gemini CLI** (the reviewer runtime). Most of what CAE adds is enforcement (reviewer ≠ builder), safety (circuit breakers, branch isolation, dangerous-action gate), and composition (wave orchestration, compaction cascade, Scribe/Herald split). If you remove any of the three upstream projects, CAE doesn't exist.

## Contributing

Early stage. Open an issue before a PR if the change is non-trivial — architecture is still solidifying (see Phase 2 plan). Bugs, new agent personas, adapter improvements for other AI CLIs all welcome.

## License

MIT. See [LICENSE](./LICENSE).

---

<p align="center">
  Built by <a href="https://github.com/notsatoshii">@notsatoshii</a> · Questions → <a href="https://github.com/notsatoshii/CAE/issues">issues</a> · If CAE saves you a 3am bug, star the repo.
</p>
