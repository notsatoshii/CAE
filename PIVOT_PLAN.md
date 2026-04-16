# CAE Pivot Plan (Revision 2)
**Date:** 2026-04-16
**Supersedes:** Revision 1 (same filename, kept in git history)

## What changed in R2

1. **LEVER redeployment dropped as Phase 1 target.** Phase 1 focuses on building CAE correctly. The acceptance test is a toy integration workload that exercises every orchestrator path. LEVER becomes a Phase 2 candidate once CAE is proven on generic workloads.

2. **GSD-reuse strategy added.** After reading the 7 target GSD agent files (5,365 lines total), we wrap 4 as-is via subprocess and methodology-port 3 into Gemini prompts. Reduces Phase 1 scope.

3. **New role: Herald.** `gsd-doc-writer` is genuinely distinct from Scribe (user-facing project docs vs. internal AGENTS.md learnings). Herald is acknowledged as a real role but **deferred to Phase 2** — LEVER-style targeted work doesn't need it, and the Phase 1 toy integration test doesn't either.

4. **Scout gets a mode field.** `mode: project | phase | ad-hoc` → project uses Gemini CLI (1M context), phase wraps `gsd-phase-researcher` on Claude, ad-hoc picks by size estimate.

5. **Phantom: wrap vs. integration explicitly separated.** Wrapping is near-zero. Integration (escalation decisions, context prep, output feedback) is ~1.5 days and listed as its own Phase 1 task.

6. **Added biggest-risk flag:** GSD agents are coupled to their spawning workflows' prompt structure. Wrapping via `--agent` inherits only the system prompt, not the workflow's user-prompt assembly. Mitigation: T2.5 prototype before committing to 4 wraps.

---

## Glossary (plain language)

- **OAuth** = sign-in flow where you log into the vendor (Anthropic, Google) instead of pasting API keys.
- **Subprocess** = CAE launches the CLI (Claude Code, Gemini CLI) as a child program, feeds it a task, and reads the reply.
- **Orchestrator** = code that coordinates multiple agents, deciding who runs when, with what input, and what to do with their output.
- **JSON** = machine-readable structured text. Used for Sentinel verdicts so the orchestrator can parse reliably.
- **Merge gate** = a check before code moves from a work branch to main. Blocks if the check fails.
- **Circuit breaker** = automatic stop condition (like an electrical fuse) that prevents runaway loops or spending.
- **Compaction** = shrinking context that's getting too full, by summarizing older content or trimming tool output.
- **Wrap-GSD-agent** = CAE invokes an existing GSD agent via `claude --print --agent gsd-<name>`. Inherits system prompt; we still construct the user prompt.
- **Methodology port** = we don't wrap the agent directly (e.g., because target model is Gemini). We translate the valuable discipline from the GSD agent's markdown into a prompt we author for Gemini.
- **Implicit contract** = behavior an agent expects from its caller that isn't stated in the agent's own file but is established by the workflow file that normally spawns it.

---

## GSD Wrap Strategy (new section)

Based on reading `/root/.claude/agents/gsd-*.md`:

### Wrap as-is (Claude-side roles)
Invocation pattern: `claude --print --effort max --agent gsd-<name> "user-prompt"`

| GSD agent | CAE role | Lines inherited | Phase 1? |
|-----------|----------|----------------|----------|
| gsd-plan-checker | Arch (plan-validation step) | 867 | Yes |
| gsd-ui-checker | Prism | 300 | Yes (if UI tasks appear) |
| gsd-debugger | Phantom (on escalation) | 1,381 | Yes (wrap only — integration work separate) |
| gsd-doc-writer | **Herald (new role)** | 602 | **Phase 2** — not needed for Phase 1 acceptance test |

### Methodology port (Gemini-side roles)
Port the discipline from the GSD file into a Gemini prompt. Keep the original GSD agent as a Claude-side fallback when Gemini fails.

| GSD agent | CAE role | Port target | Phase 1? |
|-----------|----------|-------------|----------|
| gsd-verifier | Sentinel | Gemini 2.5 Pro | Yes |
| gsd-phase-researcher | Scout (mode=phase) | **Wrap on Claude** (Scout mode field) | Yes |
| gsd-project-researcher | Scout (mode=project) | Gemini CLI (1M context) | Yes |

Note the refinement: phase-researcher *wraps* (Claude-side), project-researcher *ports* to Gemini. Scout's mode field picks which path to take.

### Fallback commitment
Every wrapped or ported agent has a Claude-side fallback. If Gemini Sentinel produces bad JSON, orchestrator falls back to `claude --print --agent gsd-verifier`. If an `--agent gsd-X` wrap produces bad output due to prompt-coupling issues, we stop wrapping that agent and port it to our own prompt structure.

---

## Decision 1: OAuth-first auth

**Aligns:** Nothing.
**Changes:** `install.sh` checks Claude Code OAuth status, verifies Gemini CLI OAuth status. No env var API keys anywhere.
**New:** Gemini CLI install + OAuth (T1). Remove API key references from docs.
**Obsolete:** Nothing (no API-key code exists).
**Size:** Small (1 day).
**Conflicts:** None.

---

## Decision 2: Agent-to-model mapping (OAuth-native)

**New mapping (unchanged from R1):**
- Nexus → Claude Opus (Claude Code)
- Arch → Claude Opus (Claude Code, optionally wrapping `gsd-plan-checker`)
- Forge → Claude Sonnet (Claude Code)
- Sentinel → Gemini 2.5 Pro (Gemini CLI) — cross-provider adversarial
- Scout → mode-dependent (Claude wrap for phase, Gemini for project)
- Scribe → Gemini Flash (Gemini CLI)
- Phantom → Claude Sonnet (wrapping `gsd-debugger`)
- Prism → Claude Sonnet (wrapping `gsd-ui-checker`) — deferred unless UI work appears
- Aegis → Claude Opus (own prompt, not a GSD wrap)
- Flux → Claude Sonnet (own prompt, not a GSD wrap)
- Herald → Claude Sonnet (wrapping `gsd-doc-writer`) — **Phase 2**

**Aligns:** Nexus/Arch/Forge already route to Claude in current config.
**Changes:** Extract mapping to `config/agent-models.yaml`. Each role also declares `invocation_mode`: `wrap-gsd-agent:<name>` | `direct-prompt`. See CONFIG_SCHEMA.md.
**New:** Per-task override mechanism (task.md frontmatter). Specialist routing logic.
**Obsolete:** `config/model-profiles.json`, hardcoded strings in `cae-init.sh`, `skills/cae-scribe/run-scribe.md`.
**Size:** Medium (counted in Decision 3).
**Conflicts:** Current Sentinel → `gsd-verifier` path needs replacement; fallback to `gsd-verifier` on Gemini failure stays available.

---

## Decision 3: Cross-provider handoff via subprocess

**Aligns:** Nothing.
**Changes:** New orchestrator layer (`bin/cae`). GSD produces PLAN.md; orchestrator reads it and dispatches via provider adapters.
**New work (the core of Phase 1):**
1. `bin/cae` orchestrator — reads config, iterates tasks, spawns subprocesses, collects results.
2. `adapters/claude-code.sh` — tmux pane runs `claude --print --effort max --agent <name>` (per OMC pattern).
3. `adapters/gemini-cli.sh` — tmux pane runs `gemini --model <model> --print`.
4. Task file format: `.planning/phases/<N>/tasks/<id>/{task.md,context.md,output.md,result.json}`.
5. Parallelism via file-lock semaphore (max 4 concurrent Forge).

**Obsolete:** GSD's `gsd-execute-phase` as execution driver (kept as Claude-only fallback).
**Size:** Large (3-4 days for v1, reduced from R1's 3-5 due to wrap savings).
**Conflicts:** Keeps GSD for planning only — clearly documented for Shift.

---

## Decision 4: File-mediated communication

**Aligns:** Already the design (PLAN.md, STATE.md, SUMMARY.md, AGENTS.md, git).
**Changes:** Formalize write-ordering rules to prevent races between parallel Forge instances.
**New:** `docs/FILE_PROTOCOL.md`.
**Obsolete:** Nothing.
**Size:** Small.
**Conflicts:** None.

---

## Decision 5: Safety layer

### 5a. Git branch isolation
**Aligns:** GSD supports branching strategies; we just don't use them.
**Changes:** Orchestrator creates `forge/<task-id>` branches, installs pre-push hook that blocks main-push unless `CAE_MERGE_TOKEN` is set (orchestrator sets ephemerally post-approval).
**Obsolete:** Nothing.
**Size:** Small (1 day).
**Conflicts:** None.

### 5b. Telegram approval gate
**Aligns:** Nothing.
**Changes:** Pre-tool-use hook matches dangerous-action patterns, posts to Telegram, awaits approval.
**New:** `scripts/telegram-gate.sh`, `config/dangerous-actions.yaml`, bot setup.
**Obsolete:** Nothing.
**Size:** Medium (1-1.5 days).
**Conflicts:** None. (Open question in QUESTIONS_FOR_MASTER about whether to share Timmy's bot.)

### 5c. Sentinel JSON verdict as merge gate
**Aligns:** Sentinel persona exists (as skill, not as executor).
**Changes:** Sentinel (Gemini) returns `{approve, reviewer_model, builder_model, issues[]}`. Orchestrator enforces `reviewer_model != builder_model`, merges on approve, loops on reject (3-retry cap).
**New:** JSON parser+validator, retry wiring, methodology port from `gsd-verifier`.
**Obsolete:** `gsd-verifier` as primary (stays as fallback).
**Size:** Medium (1.5 days — reduced from R1's 2 days because methodology is inherited, not invented).
**Conflicts:** Direct conflict with current `gsd-verifier` agent_skill path. Replaced, not deleted.

---

## Decision 6: Circuit breakers

**Aligns:** None of the six limits exist in CAE code.
**Changes:** Add `config/circuit-breakers.yaml`. Orchestrator enforces: turns/Forge, retries/task, parallel Forges, token budgets, Phantom escalation, halt-on-Phantom-fail.
**New:** All six. Small individually, medium in aggregate.
**Obsolete:** Nothing.
**Size:** Medium (1.5 days).
**Conflicts:** None.

---

## Decision 7: Compaction cascade

**Aligns:** Caveman installed but not fill-triggered.
**Changes:** Add fill-% tracker per Forge. Sequentially trigger layers a-e as thresholds cross. Log firings to `.cae/metrics/compaction.jsonl`.
**New:** All five layers. Layer (c) turn-pruning is the riskiest because it requires external conversation management.
**Obsolete:** Nothing.
**Size:** Medium-large (2-3 days).
**Conflicts:** `--print` mode's context management may not cooperate with injected summaries. Must prototype early.

---

## Decision 8: Scribe consolidation

**Aligns:** AGENTS.md template exists. Scribe persona exists.
**Changes:** Scribe runs automatically (triggered by `stop` hook). 300-line AGENTS.md cap, dedupe-on-write, overflow to `KNOWLEDGE/<topic>.md`. Task tags control conditional KNOWLEDGE loading.
**New:** Automated Scribe invocation (Gemini Flash subprocess after each phase), dedupe/cap logic, KNOWLEDGE/ protocol.
**Obsolete:** `hooks/cae-scribe-hook.js` (reminder-only), `skills/cae-scribe/run-scribe.md`.
**Size:** Medium (1.5 days).
**Conflicts:** None.

---

## Decision 9: Gemini CLI structured-output risk (contingency)

Fallbacks ready:
- (a) Markdown Sentinel output + separate parser to JSON (~1 day contingency)
- (b) Claude-isolated-session Sentinel (wrap `gsd-verifier`, ~half day contingency)

**Phase 1 approach:** Prototype Sentinel JSON in T6 (Gemini adapter) before investing in tight coupling. If unreliable, switch to (b) immediately — we have the wrap ready to go since `gsd-verifier` is an installed agent we've already read.

---

## Net adds and deletes

### Adds
- `bin/cae` orchestrator
- `adapters/claude-code.sh`, `adapters/gemini-cli.sh`
- `config/agent-models.yaml`, `config/circuit-breakers.yaml`, `config/dangerous-actions.yaml`
- `config/cae-schema.json` (public API schema — see CONFIG_SCHEMA.md)
- `scripts/install-gemini-cli.sh`
- `scripts/telegram-gate.sh`
- Automated Scribe runner (Gemini Flash subprocess)
- Compaction cascade implementation
- `KNOWLEDGE/` directory protocol
- `.cae/metrics/` logging

### Deletes
- `config/model-profiles.json`
- `hooks/cae-scribe-hook.js`
- `skills/cae-scribe/run-scribe.md`
- Hardcoded model strings inside `cae-init.sh`

### Stays
- Persona skill files (injected into planning-path agents via GSD `agent_skills`)
- `scripts/multica-bridge.sh` (orthogonal observability)
- GSD installation (planning path only)
- Claude Code, Caveman, Karpathy plugins
- Updated `scripts/cae-init.sh` (reads new config files)

---

## Biggest risks (Phase 1)

1. **GSD agents' implicit contract with spawning workflows.** The `--agent` flag loads system prompt; it doesn't replicate the user-prompt XML wrappers that GSD's workflow files produce (`<objective>`, `<files_to_read>`, `<agent_skills>`). Per wrapped agent we may need custom prompt-assembly derived from its spawning workflow. Mitigation: **T2.5 prototype before committing to any wrap.**

2. **Gemini CLI install path unverified** for headless server with OAuth. Fallback plan documented in QUESTIONS_FOR_MASTER Q4.

3. **Claude Code `--print` with externally-managed conversation history** — needed for compaction layer (c). Prototype in T5 before committing to that specific layer.

4. **Sentinel JSON reliability from Gemini** — flagged. Fallback via `gsd-verifier` wrap.

5. **Subprocess timeouts on long tasks** — less important without LEVER's Foundry scripts, but still real for anything that runs tests or builds.

---

## Strategic note

Dropping LEVER as Phase 1 dogfood frees CAE to grow correctly. A toy integration test (small CLI tool with tests) exercises every path the orchestrator needs to handle, without the pressure of on-chain transactions. When LEVER comes back as a Phase 2 workload, CAE has already been proven on something lower-stakes.

The wrap-heavy GSD reuse is the other big R2 improvement. 3,150 lines of battle-tested Claude-side prompting inherited for free (assuming T2.5 prototype validates the approach), plus ~2,215 lines of methodology from Gemini-side agents ported to ~600 lines of Gemini prompts. This is a significant reduction in Phase 1 implementation work compared to R1.

End of pivot plan R2.
