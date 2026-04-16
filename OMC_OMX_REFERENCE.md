# OMC & OMX — Patterns Worth Borrowing
**Date:** 2026-04-16
**Purpose:** Document architecture patterns from `oh-my-claudecode` (OMC) and `oh-my-codex` (OMX) that CAE should adopt or deliberately avoid. Both are from the same author (Yeachan-Heo) — they share design DNA.

---

## What OMC/OMX are (short version)

**OMC** = Oh My Claude Code. Multi-agent orchestration plugin for Claude Code. v4.1.7+ uses `/team` for in-session orchestration and `omc team` for tmux-based CLI workers (claude/codex/gemini panes).

**OMX** = Oh My codeX. Sister project — same orchestration surface but wraps OpenAI Codex CLI as the primary runtime instead of Claude Code.

Both are **published CLIs distributed via npm and plugin marketplaces**, not frameworks you embed. They sit one layer above the coding CLI, add teams/hooks/skills, and pass work back down.

---

## 1. Subprocess spawning: tmux panes, not pipes

**Key pattern:** OMC/OMX spawn subprocess workers as **tmux panes**, not direct child processes with stdin/stdout pipes.

```bash
# N workers in tmux panes, each running the specified provider's CLI
omc team 2:codex "review auth module"
omc team 2:gemini "redesign UI components"
omc team 1:claude "implement payment flow"
```

**Why tmux over pipes:**
- Long-running agents stay visible and inspectable (you can `tmux attach` and watch)
- Native interactive mode of each CLI works (input prompts, slash commands, TUI)
- No reinvention of terminal multiplexing for parallel workers
- Crash of one pane doesn't take down the orchestrator

**Windows support:** OMX uses `psmux` as a tmux-compatible wrapper. Plausible for CAE if we need Windows later; ignore for Phase 1 (headless Linux).

**Lifecycle commands:**
```bash
omc team status <task-name>
omc team shutdown <task-name>
```

### For CAE

**Adopt.** This resolves an ambiguity in the current PIVOT_PLAN: our subprocess model is tmux-backed, not pipe-backed. Concrete implications:
- `adapters/claude-code.sh` spawns a tmux pane, runs `claude --print --effort max` in it
- `adapters/gemini-cli.sh` spawns a tmux pane, runs `gemini` in it
- Orchestrator reads output via `tmux capture-pane` or a shared log file the pane tees to
- Session names: `cae-<phase>-<task-id>` for discoverability

**Trade-off:** We lose some programmatic elegance (direct stdin/stdout) but gain reliability and debuggability. Worth it.

---

## 2. Pipeline stages, not agent-to-agent chat

**OMC's canonical team pipeline:**
```
team-plan → team-prd → team-exec → team-verify → team-fix (loop)
```

Each stage is a distinct phase. Handoff is **file-mediated**, not message-passing. Agents don't talk to each other; stages write outputs that subsequent stages read.

**OMX equivalent skills:**
- `$deep-interview` → clarification
- `$ralplan` → planning + human approval gate
- `$ralph` → persistent completion loop
- `$team N:role` → parallel execution

Note: `$ralplan` **requires human approval of the plan before execution proceeds**. This is OMX's safety gate — same philosophy as our Telegram approval, different implementation.

### For CAE

**Already aligned.** CAE's file-mediated approach (PLAN.md, AGENTS.md, git) matches. Our phases (plan → research → build → review → commit) map to OMC's stages.

**Borrow specifically:** The `$ralplan` pattern of hard-gating approval on the PLAN itself, not just on dangerous actions. Decision: before CAE begins execution, Nexus writes the full phase plan and Telegram sends it for approval. One gate at the top instead of many gates mid-flight where possible.

---

## 3. Skill auto-injection by keyword match

**OMC stores skills at two scopes:**

```
.omc/skills/fix-proxy-crash.md     # Project scope (git-committed)
~/.omc/skills/                      # User scope (all projects)
```

Skills are **auto-matched and auto-injected** into the current agent's context when their keywords match the prompt. The `/learner` skill extracts patterns from past runs and generates new skill files.

### For CAE

**Partial borrow.** Our AGENTS.md + KNOWLEDGE/ structure is a related solution, but OMC's skill-per-file approach is more granular. Concrete adoption:
- Treat each entry in `KNOWLEDGE/<topic>.md` as an individually loadable piece
- Task tags in PLAN.md frontmatter (`tags: [solidity, deploy]`) trigger loading of matching topic files
- Add a "learner" pattern: after Sentinel flags an issue, Scribe has the option to emit a new KNOWLEDGE entry (not just append to AGENTS.md)

This strengthens Decision 8 (Scribe consolidation) and reduces the pressure on AGENTS.md. Matches well with our 300-line cap.

**Don't borrow:** user-scope skills (`~/.omc/skills/`). Shift users are generating per-project configs; global skills leak state across projects.

---

## 4. Hook system: 6 events, template variables

**OMC defines 6 hook events:**
1. `session-start` — agent session begins
2. `stop` — agent response completes
3. `keyword-detector` — every prompt submission (for skill auto-match)
4. `ask-user-question` — agent requests human input
5. `pre-tool-use` — before tool invocation
6. `post-tool-use` — after tool invocation

**Template variables available:** `{{sessionId}}`, `{{projectName}}`, `{{prompt}}`, `{{toolName}}`.

**OMX two-layer hooks:**
- `.codex/hooks.json` (native Codex lifecycle)
- `.omx/hooks/*.mjs` (OMX-managed wrappers — Node.js modules)

### For CAE

**Adopt the 6 events as a design reference.** Our current hooks (`cae-multica-hook.js`, `cae-scribe-hook.js`) are only `PostToolUse`. We're missing `session-start`, `stop`, `pre-tool-use`, `ask-user-question`.

**Priority hook additions for Phase 1:**
- `pre-tool-use` — matches dangerous action patterns BEFORE shell execution (replaces our planned regex scan). This is where the Telegram gate fires.
- `stop` — fire Scribe automatically on phase completion instead of reminding the human.
- `session-start` — write a session marker to `.cae/metrics/` so we can correlate events to runs.

`keyword-detector` and `ask-user-question` are OMC-specific (in-session dynamics). Skip for CAE.

---

## 5. Multi-provider delegation: `/ccg` and `omc ask`

**OMC's `/ccg` skill:** Codex + Gemini advisors via `/ask codex` and `/ask gemini`, with Claude synthesizing the results.

**`omc ask` standalone:**
```bash
omc ask codex --prompt "identify architecture risks"
# Output → .omc/artifacts/ask/
```

Each provider runs independently; output files are committed artifacts. Claude reads them and produces a synthesized answer.

### For CAE

**Direct adopt.** This maps perfectly to our cross-provider Sentinel pattern:
1. Forge (Claude) writes the diff
2. Sentinel (Gemini) reads diff + plan, writes verdict JSON to `.planning/phases/<N>/tasks/<task-id>/verdict.json`
3. Orchestrator reads verdict, acts on it

The `.planning/phases/<N>/tasks/<id>/` directory is our equivalent of `.omc/artifacts/ask/`.

**Specifically borrow for CAE:** The "advisor pattern" where a secondary agent's output is always a committed artifact file, never an in-memory handoff. Makes debugging trivial, provides audit trail for free.

---

## 6. Environment variables for coordination

**OMC uses env vars to coordinate plugin with OpenClaw gateway:**
- `OMC_PLUGIN_ROOT` — resolves HUD bundle paths
- `OMC_OPENCLAW=1` — enables OpenClaw gateway
- `OPENCLAW_REPLY_CHANNEL`, `OPENCLAW_REPLY_TARGET`, `OPENCLAW_REPLY_THREAD` — delivery routing

**Explicit feature flag for teams:**
```json
// ~/.claude/settings.json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

### For CAE

**Borrow sparingly.** Env vars are fine for orchestrator-to-adapter signaling (e.g., `CAE_TASK_ID`, `CAE_PHASE`). But don't over-use them — config files (`config/*.yaml`) stay the single source of truth for durable settings.

**One specific adoption:** `CAE_MERGE_TOKEN` env var as the only way to bypass the pre-push git hook. Set ephemerally by orchestrator after Sentinel approves; unset immediately after merge. Matches OMC's pattern.

---

## 7. Smart model routing for cost

OMC documentation mentions: *"Smart model routing saves 30-50% on tokens. Haiku handles simple tasks; Opus handles complex reasoning."*

### For CAE

**Already in PIVOT_PLAN.** Our per-agent model mapping (`config/agent-models.yaml`) is this pattern. Forge uses Sonnet, not Opus, because most build tasks don't need max reasoning. Scribe uses Gemini Flash.

**Adopt additionally:** Task-level routing hints. PLAN.md frontmatter can include `complexity: simple|medium|complex`, and Forge escalates to Opus when complexity is complex. Default: medium → Sonnet.

---

## 8. What OMC/OMX do NOT solve (gaps CAE must solve itself)

Worth documenting so we don't assume OMC/OMX are a template for everything.

- **Circuit breakers** — not prominent in either README. OMC/OMX rely on user supervision. CAE's Decision 6 (token budgets, turn limits, parallel caps) is more rigorous.
- **Compaction cascade** — OMC mentions skill-based context reuse but not a layered fill-level-triggered cascade. CAE's Decision 7 is custom.
- **Sentinel-as-JSON-verdict blocking merge gate** — OMC's `/ccg` synthesizes advisor input into Claude's continuation; it doesn't gate a merge on JSON structure. CAE's Decision 5c is stricter.
- **Safety layer for non-code actions** — OMC's hook system could in theory implement dangerous-action gates but the README shows no shipped implementation. CAE's Decision 5b is custom.
- **Config-as-public-API** — OMC/OMX configs are internal. CAE's `config/cae-schema.json` (Decision 2 supporting Shift) is a design choice they don't need to make.

---

## Net adoption summary

**Adopt (affects Phase 1):**
- tmux-based subprocess workers (changes adapters design)
- `pre-tool-use` hook for dangerous action gating (replaces regex scan approach)
- `stop` hook for automated Scribe invocation (replaces reminder-only hook)
- Advisor-as-committed-artifact pattern (already in our design, confirmed)
- Per-task complexity hints for model routing
- Ephemeral env var (`CAE_MERGE_TOKEN`) for git bypass

**Skip deliberately:**
- User-scope skills (global skill leakage)
- `keyword-detector` hook (OMC-in-session only)
- OpenClaw gateway integration (we have Telegram direct)
- HUDs (visual overlays — premature for CAE)
- npm plugin-marketplace distribution (out of Phase 1 scope)

**Steal but improve:**
- Hook event taxonomy — use OMC's 6 events as baseline, add our own `dangerous-action-gated` event
- Pipeline stages — OMC's plan→prd→exec→verify→fix is close to ours; we formalize as phases

---

## Concrete Phase 1 updates from this review

1. **Task T5 (Claude Code adapter):** change from "wraps `claude --print`" to "spawns a tmux pane running `claude --print --effort max`, reads output via `tmux capture-pane`." Still one Forge run, slightly different implementation.

2. **Task T6 (Gemini CLI adapter):** same — tmux-based.

3. **Task T10 (circuit breakers) + T11 (Telegram gate):** reorganize around hooks. Instead of orchestrator checking patterns inline, it registers `pre-tool-use` hooks that fire on dangerous-action matches. Cleaner separation.

4. **Task T12 (automated Scribe):** triggered by `stop` hook fire, not by orchestrator detecting phase completion. Means Scribe runs when the last task's claude/gemini session stops, not when orchestrator polls.

5. **New micro-task T0:** Verify tmux is installed (`apt install tmux` if not). Trivial but a prerequisite.

These updates are small in code but meaningful in architecture. Worth folding into PHASE_1_TASKS.md before implementation starts.

End of OMC/OMX reference.
