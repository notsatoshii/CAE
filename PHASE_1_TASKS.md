# CAE Phase 1 Tasks (Revision 2)
**Date:** 2026-04-16
**Supersedes:** R1 (same filename, git history)

## Phase 1 definition (R2)
CAE's orchestrator + safety layer + wrapped GSD agents work end-to-end on a toy generic workload. LEVER is no longer the Phase 1 target — it returns as a Phase 2 candidate once Phase 1 acceptance passes.

**Atomicity standard:** each task below sized for one Forge instance to complete in one run. Anything larger is split.

---

## Global defaults (apply to every Claude Code subprocess CAE spawns)

- **Effort: max** (`--effort max`) unless a task's `task.md` frontmatter overrides to `medium` or `low`.
- **Non-interactive:** `claude --print` mode.
- **Model pinned per role** from `config/agent-models.yaml`.
- **Session isolation:** each task gets its own session ID.
- **Agent selection:** for wrapped GSD roles, use `--agent gsd-<name>`; for direct-prompt roles, use `--system-prompt-file` or `--append-system-prompt`.

---

## Ordering rationale

- **T0–T1:** prerequisites (tmux, Gemini CLI).
- **T2–T3:** config surface lockdown. Shift cares about this being stable.
- **T2.5 (new in R2):** prototype the wrap-GSD-agent approach. This is the single most important task because it decides whether the biggest risk (see PIVOT_PLAN) materializes. **If T2.5 fails, scope changes substantially before continuing.**
- **T4–T8:** orchestrator core.
- **T9–T11:** safety layer.
- **T12–T13:** Scribe and compaction.
- **T14:** integration test on toy workload → **Phase 1 acceptance gate.**

No T15 or T16 (LEVER tasks removed).

---

## Tasks

### T0. Install tmux (new in R2)
**Goal:** `tmux` is installed and usable by the orchestrator.
**Acceptance:** `tmux new-session -d -s test && tmux kill-session -t test` runs cleanly.
**Forge runs:** 1 (trivial; may combine with T1).
**Risk:** None.

### T1. Install and OAuth-authenticate Gemini CLI
**Goal:** `gemini --version` works on this machine with OAuth (Google Workspace), no API key in env.
**Acceptance:**
- `which gemini` returns a path
- Test: `echo 'reply with JSON only: {"ok": true}' | gemini --model gemini-2.5-pro --print` returns parseable JSON
- No `GEMINI_API_KEY` or similar in env (`env | grep -iE 'gemini|google'` shows only benign values)
**Forge runs:** 1-2 (unknown install path on headless server; allow room for discovery)
**Risk:** HIGH. If install path on headless Linux + OAuth has blockers, escalate immediately. See QUESTIONS_FOR_MASTER Q4 for the three fallback options.

### T2. Extract model mapping to `config/agent-models.yaml`
**Goal:** Model routing is config, not inline bash.
**Acceptance:**
- `config/agent-models.yaml` exists with per-role `{model, provider, invocation_mode}` entries
- `cae-init.sh` reads it instead of hardcoding
- Re-running `cae-init.sh` on a test project produces the same `.planning/config.json` as before (for Claude-only roles)
- Schema documented in top-of-file comment pointing to CONFIG_SCHEMA.md
**Forge runs:** 1
**Risk:** None.

### T2.5. Wrap-GSD-agent prototype (NEW — biggest risk mitigation)
**Goal:** Prove that `claude --print --agent gsd-<name> "<user prompt>"` works for a real wrapped role before we build 4 of them.
**Plan:**
1. Pick `gsd-ui-checker` (smallest at 300 lines, cleanest interface).
2. Construct a realistic user prompt with the XML wrappers the agent expects (study `execute-phase.md` and `gsd-ui-phase.md` workflows to understand what GSD normally produces).
3. Invoke via subprocess, capture output, validate the agent did its job (produced structured BLOCK/FLAG/PASS findings).
4. Repeat for `gsd-plan-checker` on a simple plan.
5. Document the user-prompt structure each agent needs.
**Acceptance:**
- Both wraps produce sensible output on realistic inputs
- Document `docs/WRAPPED_AGENT_CONTRACTS.md` describing the user-prompt structure per wrapped agent
- **Decision point:** if either wrap produces broken output due to prompt-coupling, downgrade the wrap strategy: mark those agents "methodology-port instead," revise remaining Phase 1 tasks accordingly, and re-estimate timeline
**Forge runs:** 1-2
**Risk:** If this fails, Phase 1 scope grows by 2-3 days (we add prompt-reimplementation work for the affected agents). No larger consequence — fallback is documented.

### T3. Config schema as public API (`config/cae-schema.json`)
**Goal:** CONFIG_SCHEMA.md describes the stable config surface that Shift generates. Schema file validates any CAE project config.
**Acceptance:**
- `config/cae-schema.json` exists and validates against JSON Schema draft 2020-12
- Version declared: `cae_config_version: 1`
- Covers: `agent-models.yaml`, `circuit-breakers.yaml`, `dangerous-actions.yaml`, inline additions to `.planning/config.json`
- Test: write a sample config, validate with `ajv validate -s config/cae-schema.json -d sample.json`
- Public-API comment block at top of `CONFIG_SCHEMA.md` documenting stability commitments
**Forge runs:** 1
**Risk:** Medium. Schema decisions made here lock in Shift's interface. Sentinel review matters.

### T4. Orchestrator skeleton (`bin/cae`)
**Goal:** Entry point that loads config, parses PLAN.md, prints dispatch plan. Dry-run only.
**Acceptance:**
- `bin/cae` is executable, runs without error on a sample project
- `cae execute-phase N` reads `.planning/phases/N-*/PLAN.md`, parses tasks, prints: for each task → which agent, provider, model, branch, invocation_mode
- Handles missing `.planning/` with clear error message
- No subprocess execution yet (scaffolding only)
**Forge runs:** 2
**Risk:** None.

### T5. Claude Code adapter (`adapters/claude-code.sh`)
**Goal:** Spawn Claude Code in a tmux pane, pass task, capture output.
**Acceptance:**
- Called as `adapters/claude-code.sh <task_file> <model> <session_id> [--agent <name>] [--effort <level>]`
- Spawns `tmux new-session -d` with `claude --print --effort max --model <model> --agent <name>` (effort overridable per task)
- Reads task content, pipes to Claude Code's stdin
- Captures stdout to `<task_file>.output`, stderr to `<task_file>.error`
- Honors `--agent` flag correctly (verified via test invocation of `gsd-ui-checker`)
- Non-zero exit codes logged cleanly
**Forge runs:** 1-2
**Risk:** Medium. `--session-id` behavior in `--print` mode needs verification. If not supported, we manage sessions via file state.

### T6. Gemini CLI adapter (`adapters/gemini-cli.sh`)
**Goal:** Analogous to T5, for Gemini CLI.
**Acceptance:**
- Called as `adapters/gemini-cli.sh <task_file> <model> [--format json]`
- Invokes Gemini CLI with correct flags
- For Sentinel tasks (format=json), validates output parses as JSON; fails loudly if malformed
- **Prototype test:** construct a Sentinel-like review prompt, confirm Gemini produces valid JSON 5 times in a row on different inputs
- If JSON unreliable → document failure mode, activate Decision 9 contingency (fallback to Claude-side `gsd-verifier` wrap)
**Forge runs:** 1-2
**Risk:** Medium-high. Gemini JSON reliability is the Decision 9 risk; we find out here.

### T7. Orchestrator: wire adapters into `cae execute-phase`
**Goal:** Replace dry-run with real execution.
**Acceptance:**
- `cae execute-phase N` for each task: creates task.md + context.md, invokes adapter, reads result
- Up to 4 parallel Forge tasks via file-lock semaphore
- Sequential waves (match PLAN.md `wave` frontmatter)
- On subprocess failure: logs, continues remaining tasks in wave, reports all failures at wave end
- Writes SUMMARY.md per task
**Forge runs:** 3
**Risk:** Medium. Parallel coordination without a real job queue is fragile. Simple file locks only; upgrade to real queue in Phase 2 if flaky.

### T8. Sentinel flow: methodology port + merge gate
**Goal:** Port `gsd-verifier`'s methodology to Gemini Sentinel. Enforce reviewer ≠ builder. Merge on approve.
**Acceptance:**
- Sentinel prompt (Gemini 2.5 Pro) includes: goal-backward verification, 3-level checks (exists/substantive/wired), structured JSON output
- Returns `{approve: bool, reviewer_model: string, builder_model: string, issues: []}`
- Orchestrator rejects verdicts where `reviewer_model == builder_model` and re-spawns with fallback
- On approve: merge `forge/<task-id>` branch into phase branch
- On reject: re-run Forge with issues embedded (retry cap from T10)
- If Gemini JSON fails validation twice in a row: fall back to `gsd-verifier` wrap automatically, log the fallback
**Forge runs:** 2-3 (methodology port + JSON parser + retry wiring)
**Risk:** Medium. Fallback is wired from T2.5 (we know wrap works for Claude-side). Methodology transfer from gsd-verifier is straightforward text work.

### T9. Git branch isolation
**Goal:** Forge runs on `forge/<task-id>` branches, cannot push to main without orchestrator-set `CAE_MERGE_TOKEN`.
**Acceptance:**
- Orchestrator creates branches before Forge spawn
- Pre-push hook (installed per-worktree) blocks pushes to `main`/`master` unless `CAE_MERGE_TOKEN` env is set
- On Sentinel approve: orchestrator sets token, performs merge, unsets token immediately
- On failure: branch kept for inspection (no auto-delete)
- On success + merge: branch deleted locally
**Forge runs:** 2
**Risk:** Low. Git plumbing. Hook must not break normal developer use of the repo outside CAE runs.

### T10. Circuit breakers
**Goal:** All 6 limits from Decision 6 enforced and logged.
**Acceptance:**
- Orchestrator tracks per-Forge: turns, retries, parallel count, input/output tokens
- Each limit halts the offender with clear reason
- 3 Forge failures on one task → Phantom escalation (see T11a)
- 2 Phantom failures → global halt flag + Telegram ping
- All events logged to `.cae/metrics/circuit-breakers.jsonl`
**Forge runs:** 3
**Risk:** Medium. Token counting depends on which CLI reports usage and in what format; Gemini CLI's output format may not expose this. Document unknown fields in the jsonl as `token_count: null`.

### T11. Telegram approval gate (`scripts/telegram-gate.sh`)
**Goal:** Dangerous actions require Telegram approval.
**Acceptance:**
- `config/dangerous-actions.yaml` lists action patterns
- Pre-tool-use hook (registered in Claude Code's hook system) matches patterns before shell execution
- Matches → send Telegram message with action description + one-time approval token
- Wait up to 30min (configurable) for reply containing token
- On timeout or explicit "no": halt
- All decisions logged to `.cae/metrics/approvals.jsonl`
- Telegram bot token from env, bot target channel from `config/cae-user.yaml`
**Forge runs:** 2
**Risk:** Medium. Decision in QUESTIONS_FOR_MASTER Q1 pending (dedicated CAE bot vs. share Timmy's).

### T11a. Phantom integration (NEW — separated from wrap)
**Goal:** Phantom is not just a wrap; it's a live escalation path Forge can hand off to.
**Wrap (near zero):** One-line shell: `claude --print --effort max --agent gsd-debugger "<prompt>"`.
**Integration (real cost):**
1. Decision logic: orchestrator decides when to escalate (3 Forge failures on same task, UAT failure pattern match, explicit `escalate: phantom` in task frontmatter)
2. Context prep: Phantom needs the failing diff, error messages, the PLAN.md it was executing against, any SUMMARY.md from previous Forge attempts
3. Output interpretation: Phantom produces a debug report; orchestrator either (a) translates root cause into Forge's next retry prompt, or (b) escalates to human via Telegram with Phantom's diagnosis attached
4. State persistence: Phantom's persistent-debug-file pattern (from gsd-debugger) requires file-state between invocations — orchestrator maintains `.planning/debug/<task-id>/` across retries
**Acceptance:**
- Phantom escalation can be triggered manually via `cae debug <task-id>` for testing
- On automatic escalation (3 Forge fails): orchestrator prepares context, invokes Phantom, captures report
- If Phantom identifies root cause → Forge re-runs with Phantom's fix as context
- If Phantom produces "need human" → Telegram message with diagnosis
- Debug state persists across Phantom re-invocations (file-state pattern)
**Forge runs:** 3 (decision logic, context prep, output wiring)
**Risk:** Low-medium. Phantom wrap is proven by T2.5; integration is orchestrator plumbing.

### T12. Automated Scribe (Gemini Flash)
**Goal:** Scribe runs after each phase completes, maintains AGENTS.md under 300 lines, overflows to KNOWLEDGE/.
**Acceptance:**
- Triggered by `stop` hook when last task's session ends (not by orchestrator polling)
- Scribe reads SUMMARY.md files + Sentinel verdicts + git log for the phase
- Proposes updates to AGENTS.md
- Dedupe + cap: merge, deduplicate, cap at 300 lines, overflow to `KNOWLEDGE/<topic>.md` by frontmatter tags
- Task tags in PLAN.md (`tags: [foo, bar]`) determine which KNOWLEDGE topic files load into future task contexts
**Forge runs:** 3
**Risk:** Low. Dedupe logic tests with repeated runs to confirm determinism.

### T13. Compaction cascade (5 layers)
**Goal:** All 5 layers from Decision 7 implemented; metrics log which fires.
**Acceptance:**
- Tool output budgets (Read=2000, Grep=1000, Bash=3000) enforced in adapter preprocessing
- File-summary for files >500 lines: Forge sees summary + pointer
- Turn pruning beyond 15 exchanges: orchestrator manages history externally (feeds compacted history into each subsequent task.md)
- Caveman activation at 60% fill
- Hard summarize + continue at 85% fill
- All firings logged to `.cae/metrics/compaction.jsonl`
**Forge runs:** 4
**Risk:** High. Layer (c) — turn pruning — requires external conversation management in `--print` mode. Needs a small prototype first (half a Forge run) to confirm Claude Code's `--print` mode plays nice with injected summaries.

### T14. Integration test on toy workload — **Phase 1 acceptance gate**
**Goal:** One concrete, small, non-LEVER build runs end-to-end through every CAE path.
**Candidate workload:** a small CLI tool — markdown-to-JSON converter, two phases: (1) write the converter, (2) add tests. Touches Forge, Sentinel, Scribe, at least one dangerous-action gate (the git push or deploy-like step), branch isolation, merge gate, circuit breakers (even if no limit hits, they log clean runs).
**Acceptance:**
- Every Phase 1 component exercised at least once
- Sentinel approves with Gemini as reviewer (validates cross-provider)
- AGENTS.md updated by automatic Scribe run
- At least one dangerous-action Telegram gate fires
- Circuit breakers log all runs (zero limits hit is fine)
- Git branches created and merged correctly
- **If all above pass: Phase 1 complete.** If any fail: fix and re-run until all pass.
**Forge runs:** 2-3 (set up test project + running it)
**Risk:** First real end-to-end. Will surface integration bugs. Plan for 1-2 iterations.

---

## OUT OF SCOPE for Phase 1 (R2)

Explicitly not Phase 1:

- **LEVER redeployment** (moved to Phase 2 candidate)
- **Herald** (gsd-doc-writer wrap, user-facing project docs — deferred to Phase 2 since the toy acceptance test doesn't need it)
- **GitHub push of CAE repo** (local only until Phase 1 passes)
- **Shift integration** (schema published in T3, no integration code)
- **Hermes/Timmy bridge testing** (Timmy's `/delegate` skill is a Phase 2 surface)
- **Multi-project state** (Phase 1 runs in one project dir at a time)
- **Full 10-persona roster live** — Phase 1 exercises: Nexus (implicit in orchestrator), Arch (planning via GSD-wrap), Forge (direct-prompt), Sentinel (Gemini, methodology-ported), Scribe (Gemini), Scout (modes: project=Gemini, phase=wrap), Phantom (wrap + integration). Prism, Flux, Aegis, Herald stay as configured roles but aren't exercised in T14's toy workload.
- **Caveman plugin verification during subprocess** — activation covered in T13 layer (d); if it doesn't fire via `--print`, we fall back to explicit compression prompt.
- **Non-Telegram notifications** (no Slack, Discord, email)
- **Metrics UI** (`.cae/metrics/*` are JSON logs; reading them is a human task)
- **Third-party provider adapters** (no OpenAI/Codex/OpenRouter in default build)
- **Rollback automation** (manual rollback is fine for toy workload)

---

## Phase 1 task count + complexity summary (R2)

| Category | Tasks | Est. Forge-runs | Est. working days |
|----------|-------|----------------|-------------------|
| Prerequisites | T0, T1 | 2-3 | 0.5-1 |
| Foundation | T2, T3 | 2 | 1-1.5 |
| **Risk prototype** | **T2.5** | **1-2** | **0.5** |
| Orchestrator core | T4, T5, T6, T7, T8 | 9-12 | 5-6 |
| Safety layer | T9, T10, T11, T11a | 10 | 4-5 |
| Polish & observability | T12, T13 | 7 | 3-4 |
| Validation | T14 | 2-3 | 1-2 |
| **Total** | **14 tasks** | **~35-40** | **~15-20** |

With buffer for unknowns (Gemini install, `--agent` prompt coupling, JSON reliability, compaction-layer-c turn pruning): **20-25 working days** realistic for a single person or pair to complete Phase 1. See TIMELINE.md.

End of Phase 1 tasks R2.
