<!-- generated-by: gsd-doc-writer -->
# Changelog

All notable changes to Ctrl+Alt+Elite documented here. Grouped by phase milestone (no semver yet — project is pre-1.0 alpha). Newest first.

Commit hashes reference the local repo (`/home/cae/ctrl-alt-elite`). No remote push as of 2026-04-17.

---

## [Phase 2 — In Progress] — 2026-04-17

Phase 2 picked by Master: Herald (H1), Timmy bridge (H3), Shift (normie-facing project genesis). LEVER and multi-project orchestration deferred to Phase 3+.

### Added

- **Herald agent** (`5c5ee4e`) — `cae herald <doc-type>` subcommand. Wraps `gsd-doc-writer` with `agents/cae-herald.md` persona injected into the user prompt. Maps `readme / architecture / deployment / changelog` to target filenames. Reads existing doc + AGENTS.md into context before spawning. Writes audit trail to `.planning/herald/<session>/herald-prompt.md`. Smoke tested (dry-run path); full end-to-end deferred pending target project.
  - `agents/cae-herald.md` — persona doc with doc-type contracts and verify-don't-guess rules
  - `skills/cae-herald/SKILL.md` — skill injection variant
  - `config/agent-models.yaml` — `herald:` role uncommented, wraps `gsd-doc-writer` on `claude-sonnet-4-6` with `effort=max`

- **Phase 2 plan** (`0bb6946`) — `PHASE_2_PLAN.md`: H1, H3, Shift scope. Three open scope questions documented for Master on Shift interface, output scope, and normie level.

- **README overhaul** (`5c8e4fd` → `ba335e1`, 9 commits) — Multiple iterations of SVG banner (retro mechanical keyboard aesthetic), Herald narrative section, harness + context-saving documentation, expanded credits. Final: trapezoidal keycaps, no animation (SMIL can't interpolate `url(#gradient)` fills — browsers render black mid-press).

### Planned (not built)

- **Timmy bridge (H3)** — `/delegate` skill for Hermes that writes buildplan to `/home/cae/inbox/<task-id>/BUILDPLAN.md`, fires `cae execute-buildplan`, polls `/home/cae/outbox/<task-id>/DONE.md`, sends Hermes notification. No code yet.
- **Shift** — `/shift-start` Claude Code skill for non-technical founders. Chat flow → GitHub repo + `.planning/` artifacts + `.env.example`. No code yet.

---

## [Phase 1 — Complete] — 2026-04-16 / 2026-04-17

Goal: build CAE correctly on Claude-only infrastructure. Acceptance gate: 23/27 checks pass; 4 reserved for Gemini-dependent paths that unlock when Gemini CLI OAuth (T1) is configured.

### Added

- **`bin/cae` orchestrator** (`3e1cc12`) — Python executable. `execute-phase` subcommand: `ThreadPoolExecutor` bounded by circuit-breaker semaphore, per-task forge branch creation, compactor cascade, adapter spawn, `SUMMARY-attemptN.md` capture, Sentinel review, merge on approve, retry with issues in context, Phantom escalation after 3 Forge failures, halt after 2 Phantom failures. Post-phase Scribe call wired in.

- **Claude Code adapter** (`2935027`) — `adapters/claude-code.sh`: tmux-spawned `claude --print` invoker. `--agent` (wrap) and `--system-prompt-file` (direct-prompt) modes. Captures stdout/stderr/meta to files. Exit codes: 0=ok, 1=err, 2=timeout, 3=bad args. Validated: 3 parallel invocations, timeout kill, cwd inheritance.

- **Gemini CLI adapter** (`3e1cc12`) — `adapters/gemini-cli.sh`: mirrors `claude-code.sh` interface. tmux-spawned. `--format json` with fence extraction and validation. **Untested until T1 (Gemini OAuth) is installed** — code path exists, activation blocked on credentials.

- **Sentinel** (`3e1cc12`, `34e3c71`) — `bin/sentinel.py`: goal-backward review methodology ported from `gsd-verifier`. Gemini Flash primary (when installed), Claude `gsd-verifier` wrap as fallback. Strict JSON output schema. Parser tolerates preamble and code-fence wrapping. Enforces reviewer ≠ builder model. Auto-approve stub removed (`34e3c71`) — Sentinel is always real; Gemini path activates when `which gemini` succeeds. Separate persona doc: `agents/cae-sentinel-gemini.md`.

- **Circuit breakers** (`2935027`) — `bin/circuit_breakers.py` + `config/circuit-breakers.yaml`: 6 limits (max turns, max input/output tokens, max retries before Phantom, Phantom-to-halt, Sentinel JSON fallback, parallelism semaphore). Thread-safe. Logs to `.cae/metrics/circuit-breakers.jsonl`.

- **Phantom integration** (`2935027`) — `bin/phantom.py`: `gsd-debugger` wrap. `should_escalate()` delegates to circuit breakers. Rolling `context.md` with numbered investigations. Parses `ROOT CAUSE FOUND / CHECKPOINT REACHED / DEBUG COMPLETE` markers. Persistent debug state at `.planning/debug/<task_id>/`.

- **Telegram gate** (`3e1cc12`) — `bin/telegram_gate.py` + `config/dangerous-actions.yaml`: 8 dangerous-action patterns (`broadcast_transaction`, `git_push_main`, `force_push`, `modify_github_settings`, `delete_files_recursive`, `deploy_command`, `drop_database`, `chmod_777`). Real mode via `CAE_TELEGRAM_BOT_TOKEN` + `CAE_TELEGRAM_CHAT_ID`; stub mode prints warnings and auto-approves/denies per `CAE_GATE_STUB_AUTO`. All decisions logged to `metrics/approvals.jsonl`. **Real bot token (T11) not yet configured** — stub mode active.

- **Scribe** (`3e1cc12`) — `bin/scribe.py` + `agents/cae-scribe-gemini.md`: Gemini Flash primary, Claude Haiku fallback. Reads SUMMARY.md files, Sentinel reviews, git log, current AGENTS.md. Merge logic: substring + Jaccard dedup, stale entry removal. JSON output schema.

- **Compactor** (`3e1cc12`) — `bin/compactor.py`: 5-layer cascade for context compression before Forge spawns.

- **Git branch isolation** (`2935027`) — `scripts/install-branch-guard.sh` + `scripts/forge-branch.sh`: pre-push hook blocks `main`/`master` without `CAE_MERGE_TOKEN`. `forge-branch.sh` create/merge/abandon/cleanup subcommands. Full cycle tested: blocked-push, token-bypass, no-ff merge, unmerged-branch retention on failure.

- **Phase 1 acceptance gate** (`4167f20`) — `scripts/t14-acceptance.sh`: 23 checks pass across all Phase 1 components (install, config, orchestrator dry-run, real Forge execution end-to-end, metrics logs, branch guard, Telegram pattern matching, Scribe merge logic, Phantom parser). 4 checks skip pending Gemini CLI + Telegram token.

- **Pivot documentation** (`b6ef815`) — `CURRENT_STATE.md` (pre-pivot honest audit), `PIVOT_PLAN.md` (9 architectural decisions), `PHASE_1_TASKS.md` (14 tasks), `CONFIG_SCHEMA.md` (public API v1 for Shift), `TIMELINE.md`, `docs/WRAPPED_AGENT_CONTRACTS.md`, `OMC_OMX_REFERENCE.md`.

- **Session handoff** (`cd8832f`) — `HANDOFF.md` for context continuity across Claude sessions.

### Changed

- **Sentinel always real** (`34e3c71`) — **Breaking internal behavior**: previously `bin/cae` had a stub branch that auto-approved every task when Gemini CLI was absent. Now always calls `bin/sentinel.py` which falls back to Claude `gsd-verifier`. Auto-approve path removed entirely.

- **`config/agent-models.yaml`** (`b6ef815`) — Extracted from per-file model IDs into a central role table with `provider`, `invocation_mode`, `mode`, and `gsd_bridge` sections.

### Known gaps at Phase 1 close

- Gemini CLI not installed (T1 — user-dependent, OAuth setup required). Gemini adapter, Sentinel Gemini path, Scribe Gemini path are all code-complete but untested. See `docs/WHEN_T1_LANDS.md` for activation steps.
- Telegram bot token not configured (T11 — user-dependent). Gate runs in stub mode.
- `config/model-profiles.json` exists but is not read by any running code — orphaned reference doc. `cae-init.sh` writes model overrides directly.
- Phantom persona (`cae-flux.md`, `cae-prism.md`) — not wired to any GSD agent type. Documents only.

---

## [Phase 0 — Foundation] — 2026-04-14

Initial project creation and GSD integration.

### Added

- **10 agent persona docs** (`4620292`) — `agents/cae-nexus.md`, `cae-scout.md`, `cae-arch.md`, `cae-forge.md`, `cae-sentinel.md`, `cae-scribe.md`, `cae-aegis.md`, `cae-phantom.md`, `cae-prism.md`, `cae-flux.md`. Roles, model assignments, behavior rules. These are documentation + skill-injection source, not runtime processes.

- **GSD skill injection pack** (`4f907eb`) — 7 `skills/cae-*/SKILL.md` files. Injected into GSD agents via `agent_skills` config mechanism: Forge→`gsd-executor`, Arch→`gsd-planner`/`gsd-plan-checker`, Sentinel→`gsd-verifier`, Scout→`gsd-phase-researcher`/`gsd-project-researcher`, Scribe→`gsd-doc-writer`, Aegis→`gsd-verifier` (smart contract trigger), Init→`cae-init` skill.

- **Project initializer** (`4f907eb`) — `scripts/cae-init.sh`: run inside any `.planning/`-enabled project. Copies skill files, writes `.planning/config.json` with `agent_skills` + `model_overrides`, detects `.sol`/`foundry.toml` for smart contract mode, creates `AGENTS.md` template.

- **Multica status bridge** (`4f907eb`) — `scripts/multica-bridge.sh` + `hooks/cae-multica-hook.js`: REST API push to local Multica issue tracker. `create-phase`, `start`, `complete`, `fail`, `comment` subcommands. Hook tested end-to-end (CAE-1 created, moved todo→in_progress→done). PostToolUse hook not yet tested in a real GSD run.

- **Scribe reminder hook** (`4f907eb`) — `hooks/cae-scribe-hook.js`: PostToolUse hook. Detects phase-completion signals in tool output and prints "Run /cae-scribe to update AGENTS.md." Does not run Scribe automatically.

- **Install scripts** (`4f907eb`) — `scripts/install.sh` (prerequisites, Caveman/Karpathy plugins, skill copy), `scripts/install-hooks.sh` (registers hooks in `~/.claude/settings.json`).

- **Model profiles** (`4620292`) — `config/model-profiles.json`: quality/balanced/budget tier definitions. **Note:** not read by any running code as of Phase 1 close — use `config/agent-models.yaml` for authoritative routing.

- **MIT License** (`4620292`)

---

*CAE is alpha. Phase 1 core is functional on Claude-only infrastructure. Gemini paths are code-complete, untested. Phase 2 in progress.*
