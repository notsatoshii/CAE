# CAE — Current State Audit
**Date:** 2026-04-16
**Audit type:** Brutally honest. No sugarcoating.

---

## TL;DR

**What CAE actually is right now:** A set of configuration files and prompt templates that tell GSD (Get-Shit-Done) how to spawn Claude-only subagents with specific personas and model overrides. It is **not** an orchestrator. It has no execution path of its own. When you run `/gsd-execute-phase`, GSD does the work and our configs shape how it behaves.

**What this means for the pivot:** The new direction requires cross-provider subprocess execution (Gemini CLI for Sentinel/Scout/Scribe). The current architecture cannot do this. It is Claude-only by construction because GSD's `Task()` tool only spawns Claude subagents. Making Sentinel Gemini-based is not a config change — it requires a new orchestrator that spawns CLI processes.

**Dogfood readiness:** CAE cannot safely do the LEVER redeployment today. Missing: git branch isolation, Telegram approval gates, circuit breakers, compaction cascade, cross-provider Sentinel, automated Scribe, any end-to-end test. It has never been run on a real buildplan.

---

## 1. BUILT (code exists, can be executed)

### 1.1 GSD Skill Injection Pack
**Location:** `skills/cae-*/SKILL.md` (7 files)
**What it does:** Each SKILL.md is a persona/behavior overlay that gets injected into a GSD agent's prompt via GSD's `agent_skills` config mechanism. When GSD spawns `gsd-executor`, it reads the `<agent_skills>` block pointing to `@.claude/skills/cae-forge/SKILL.md` and loads it as part of the subagent's context.
**Files:**
- `skills/cae-forge/SKILL.md` → injected into `gsd-executor`
- `skills/cae-arch/SKILL.md` → injected into `gsd-planner`, `gsd-plan-checker`
- `skills/cae-sentinel/SKILL.md` → injected into `gsd-verifier`
- `skills/cae-scout/SKILL.md` → injected into `gsd-phase-researcher`, `gsd-project-researcher`
- `skills/cae-scribe/SKILL.md` → injected into `gsd-doc-writer`
- `skills/cae-aegis/SKILL.md` → injected into `gsd-verifier` when smart contracts detected
- `skills/cae-init/SKILL.md` → standalone `/cae-init` skill for project setup
**Status:** Works. Verified via `gsd-tools agent-skills gsd-executor` returning the expected `@` references.
**Limitation:** Only active when GSD is driving the workflow. These are not executed in any other context.

### 1.2 Project Initializer
**Location:** `scripts/cae-init.sh`
**What it does:** Run inside a project directory that has `.planning/` (created by `/gsd-new-project`). Copies skill files into `.claude/skills/`, writes `.planning/config.json` with `agent_skills` and `model_overrides`, detects smart contracts, creates `AGENTS.md` template, appends smart-contract supplement if `.sol`/`foundry.toml` found.
**Status:** Works. Tested on a dummy project. Config writes correctly.
**Known issue:** All `model_overrides` are Claude model IDs (`claude-opus-4-6`, `claude-sonnet-4-6`). Does not and cannot route to Gemini because GSD's Task() won't spawn Gemini.

### 1.3 Multica Status Bridge
**Location:** `scripts/multica-bridge.sh` + `hooks/cae-multica-hook.js`
**What it does:** `multica-bridge.sh setup` authenticates with local Multica (running in Docker), creates a workspace, stores tokens. Subcommands `create-phase`, `start`, `complete`, `fail`, `comment` do issue CRUD via Multica's REST API. The hook (cae-multica-hook.js) is a PostToolUse hook that reads `.planning/STATE.md` and pushes state transitions to Multica.
**Status:** `multica-bridge.sh` — tested end-to-end (created issue CAE-1, moved through todo → in_progress → done). The hook has not been tested in a real GSD run.

### 1.4 Scribe Reminder Hook
**Location:** `hooks/cae-scribe-hook.js`
**What it does:** PostToolUse hook that looks at tool output for phase-completion signals (strings like "SUMMARY.md", "wave complete") and prints a reminder to the conversation: "Run /cae-scribe to update AGENTS.md."
**Status:** Hook is in place. It does NOT run Scribe. It only reminds you to.
**This is important:** There is no automated Scribe. AGENTS.md updates require a human to notice the reminder and manually invoke Scribe.

### 1.5 Agent Persona Documentation
**Location:** `agents/cae-*.md` (10 files)
**What it does:** Markdown files describing each persona's role, identity, constraints, and behavior.
**Status:** Documentation only. These files are not loaded by any running process. They were written as human-facing documentation and as the basis for the SKILL.md files. They are orphaned in the current architecture — useful for the README, not for execution.

### 1.6 Install Scripts
**Location:** `scripts/install.sh`, `scripts/install-hooks.sh`
**What it does:** `install.sh` checks for prerequisites, installs Caveman and Karpathy plugins, copies skill files and configs to `~/.claude/`, calls `install-hooks.sh` to register the two hooks in `~/.claude/settings.json`.
**Status:** Works on this machine. Has not been tested on a fresh install.

### 1.7 Infrastructure
- **Multica** running in Docker (backend :8090, frontend :3002, Postgres :5433). Healthy, 46+ hours uptime.
- **Hermes Agent** installed for `timmy` user at `/home/timmy/.hermes/` — but this is for the Timmy project (separate from CAE). Not used by CAE.
- **Claude Code CLI** installed (version 2.1.110).
- **GSD** installed globally (`~/.claude/` with 68 skills, 18+ agent types).
- **Caveman** plugin installed. Verified present in `claude plugin list`.
- **Karpathy Skills** plugin installed. Verified present.

---

## 2. IN_PROGRESS (started but not working)

**Nothing is meaningfully in-progress.** Everything either works as designed or doesn't exist.

The only ambiguous state: `hooks/cae-scribe-hook.js` **works as designed** (prints a reminder) but the design itself is incomplete — it doesn't actually automate Scribe. Calling this "in progress" would be generous. Better classified as "insufficient design shipped as-is."

---

## 3. DESIGNED (in docs/plans, no code)

### 3.1 Nexus Orchestrator
Described in `agents/cae-nexus.md` as the lead that "runs GSD workflow." In reality, there is no Nexus process. When you run `/gsd-autonomous` or `/gsd-execute-phase`, Claude Code itself is the orchestrator, with GSD as a skill pack shaping its behavior. The "Nexus persona" is not injected anywhere because the main session has no way to inject a persona into itself.

### 3.2 10-Persona Roster (full)
Only 7 of 10 personas have SKILL.md files that actually get injected. The three that are documented but have no executable path:
- **Phantom** (debugger) — Document exists. No code path spawns it. GSD has `gsd-debugger` agent type but our persona isn't wired to it.
- **Prism** (UI) — Document exists. No code path spawns it. GSD has `gsd-ui-researcher` / `gsd-ui-checker` but our persona isn't wired to them.
- **Flux** (DevOps) — Document exists. No code path. GSD has no DevOps-specific agent type.

### 3.3 3-Layer Context Injection (project index → research briefs → specific files)
Claimed as "delivered via GSD's existing `<files_to_read>` mechanism." This is a cop-out. GSD does load some files into agent prompts, but there's no explicit CAE implementation of a 3-layer cascade. Any behavior that resembles 3-layer injection is accidental, not designed.

### 3.4 Adversarial Review Diversity
**Described:** "Sentinel must use a different model than the builder." **Implemented:** Config writes `gsd-executor: claude-sonnet-4-6` and `gsd-verifier: claude-opus-4-6`. This is different Claude tiers, not genuine model diversity. Two Claude models share most training — the adversarial value is much weaker than a true cross-provider review. The new pivot's decision to make Sentinel Gemini is the correct fix.

### 3.5 Model Profiles Config (quality/balanced/budget)
**Location:** `config/model-profiles.json`
**Reality:** This file is never read by any running code. `cae-init.sh` writes its own model_overrides directly. The model-profiles.json is documentation that was meant to illustrate tiers but was never wired into the init flow. It is orphaned.

---

## 4. UNWRITTEN (discussed, not designed)

### 4.1 Cross-Provider Execution (Claude + Gemini via subprocess)
The entire mechanism for invoking Gemini CLI as a subprocess, feeding it a task via file, parsing its stdout, and handing results back to Claude — does not exist. This is the single biggest gap between current state and the pivot direction.

### 4.2 Git Branch Isolation for Forge
No code creates `forge/<task-id>` branches. No guard prevents Forge from pushing to main. GSD has `isolation="worktree"` but that's different — worktrees are for parallel file isolation, not for branch-based access control.

### 4.3 Telegram Approval Gates
Zero code. No gate checks exist for deploy, push-to-main, force-push, modify-github, modify-deploy, or delete-files. CAE cannot currently refuse to do something without human approval.

### 4.4 Circuit Breakers
- Max 30 turns per Forge: not enforced. (GSD has `max_iterations: 50` in Hermes delegation config for Timmy, but that's Hermes, not CAE. CAE has no equivalent limit.)
- Max 3 retries per task: not enforced.
- Max 4 parallel Forges: partially available (GSD has `max_parallel_executors` setting but it's not set in our config).
- Token budgets (500k input / 100k output per task): not enforced.
- Auto-escalate to Phantom on 3 failures: not implemented (Phantom isn't spawned by anything anyway).
- Halt-and-ping on 2 Phantom failures: not implemented (no halt mechanism, no ping channel wired to CAE).

### 4.5 Compaction Cascade
None of the 5 layers exist:
- Tool output budgets: not enforced.
- File summaries for >500 lines: not implemented.
- Old turn pruning beyond 15 exchanges: not implemented.
- Caveman at 60% fill: Caveman is installed but not triggered by fill level — it's either on or off globally.
- Hard summarization at 85%: not implemented.
- Metrics logging to `.cae/metrics/`: not implemented; `.cae/` directory doesn't exist.

### 4.6 Scribe Consolidation (300-line cap, overflow to KNOWLEDGE/)
Not designed. Current Scribe skill (SKILL.md) tells the agent to update AGENTS.md without a cap, without dedupe logic, without overflow handling. KNOWLEDGE/ directory is not referenced anywhere.

### 4.7 Automated Scribe Execution
Scribe runs only if a human sees the hook reminder and manually invokes it. There's no automation. No cron. No post-phase trigger.

### 4.8 Config Schema as Public API (for Shift integration)
Not documented. `.planning/config.json` is written by cae-init.sh using inline Node inside the bash script. The schema is implicit. There's no JSON schema file, no version, no stability commitments. Shift cannot reliably generate this config without reverse-engineering cae-init.sh.

### 4.9 End-to-End Test
**Zero.** CAE has never been run on a real buildplan. The "dogfood" mentioned in earlier phase completion messages was a config-write verification, not an execution test. No agent has ever built anything under CAE control.

### 4.10 Hermes/Timmy Bridge Integration (for context)
Timmy's `/delegate` skill is described in its SKILL.md but has never been invoked. The handoff path (write BUILDPLAN.md → spawn claude subprocess) is documentation. No test has validated it works.

---

## 5. Divergences from what I previously reported

These are things I claimed were done that are actually weaker or incomplete than implied:

- **"3-layer context injection: complete"** — this was a cop-out. I marked it done because GSD's `<files_to_read>` does something vaguely similar. There's no CAE-specific 3-layer implementation.
- **"Adversarial review with model diversity"** — I wrote Sonnet-vs-Opus and called it adversarial diversity. Two Claude models are not meaningfully diverse. The pivot's decision to use Gemini for Sentinel is the first time real diversity enters the system.
- **"End-to-end dogfood verified"** — I verified config writes and Multica lifecycle calls. No agent execution. No actual build occurred. Calling it dogfood was sloppy.
- **"Scribe learning loop"** — I shipped a reminder hook and called it a learning loop. A loop implies automated iteration. What exists is a notification.

---

## 6. Hard-blocking incompatibility with the pivot

**The entire current architecture depends on GSD's `Task()` tool, which only spawns Claude subagents.** Every piece of model routing we've built (`model_overrides` in config.json, agent_skills injection) runs inside this constraint.

The pivot requires:
- Sentinel = Gemini 2.5 Pro via Gemini CLI
- Scout = Gemini 2.5 Pro via Gemini CLI
- Scribe = Gemini Flash via Gemini CLI

This cannot be achieved via config. It requires a new component: an orchestrator that spawns Claude Code and Gemini CLI as child processes, passes tasks via files, and reads results from stdout. This component does not exist.

**Two strategic options:**

**Option A: Build the orchestrator, keep GSD for planning only.** Use GSD to produce PLAN.md files (planning and plan-checking stay in Claude/Opus via GSD). Then our new orchestrator reads PLAN.md and invokes subprocess-based Forge (Claude Code), Sentinel (Gemini CLI), etc. for execution. GSD becomes a planning aid, not the execution engine.

**Option B: Abandon GSD entirely.** Build CAE's own planner, executor, and reviewer loops from scratch. More work upfront, but no conceptual impedance mismatch.

My recommendation: **Option A.** GSD's planning and state-management infrastructure is valuable and works. We only need to replace the execution layer. This also preserves `.planning/` as the shared state interface that Shift can generate config for.

**Additional note:** Gemini CLI is NOT installed on this machine. `which gemini` returns nothing. Installing it and authenticating via Google OAuth is a Phase 1 prerequisite.

---

## 7. Things that stay useful

Despite the pivot, these existing pieces remain valuable:
- Agent persona definitions in `agents/*.md` → become the prompts fed to subprocess invocations
- Skill injections for GSD planning → keep these, they shape Arch (planner) and Aegis (security) behavior
- Multica bridge → orthogonal to execution path, useful for tracking
- Install scripts → need updates but the structure stays
- Smart contract detection logic → reusable as-is
- LEVER redeployment handoff → already exists, just needs to be CAE's first real buildplan

## 8. Things that should be deleted

- `config/model-profiles.json` → never used, orphaned. Delete.
- `hooks/cae-scribe-hook.js` reminder-only design → delete, replace with real automated Scribe.
- "3-layer context injection" claims in README/CLAUDE.md → delete until actually implemented.
- `skills/cae-scribe/run-scribe.md` → contains an outdated Task() spec. Delete.

---

End of audit.
