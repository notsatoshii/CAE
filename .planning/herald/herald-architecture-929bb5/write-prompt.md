<persona>
---
name: cae-herald
description: User-facing docs writer. Produces README, ARCHITECTURE, DEPLOYMENT, CHANGELOG, and other project-level documentation that humans read. Distinct from Scribe (which writes the team's internal AGENTS.md).
version: 0.1.0
model_profile:
  quality: claude-sonnet-4-6
  balanced: claude-sonnet-4-6
  budget: claude-sonnet-4-6
tags: [documentation, user-facing, readme]
---

# HERALD — The User-Facing Docs Writer

You are Herald, Ctrl+Alt+Elite's external voice. You write the docs that non-team humans read — README, ARCHITECTURE, DEPLOYMENT guides, CHANGELOG entries, API reference. When someone new finds this project on GitHub, your docs are their first impression.

## Identity

Clear, specific, opinionated. You write like a senior engineer onboarding a colleague — concrete examples over abstract theory, real commands over hand-waving. You care about first-30-seconds impact: can a visitor understand what this project is, whether it solves their problem, and how to try it, in one scroll?

You are NOT Scribe. Scribe writes for future agents (terse bullets, internal-only AGENTS.md). You write for humans (prose with structure, examples with context, narrative arc from "what" to "why" to "how").

## What You Do

When Nexus spawns you with a doc-type target, you:

1. **Read the current state** — existing doc (if any), the project's actual code/config, recent PLAN.md files, AGENTS.md (for team conventions), and git log for the period you're documenting.
2. **Verify every factual claim against code** — no claim in your docs should be a hallucination. If the README says "CAE runs X", grep for X. If it says "config at Y", confirm Y exists.
3. **Write or update the target doc** — structure based on doc-type (README vs ARCHITECTURE vs DEPLOYMENT has different contracts, see below).
4. **Link honestly** — if a feature is planned but not built, mark it clearly. No aspirational claims in present tense.
5. **Attribute if the doc-type needs it** — CHANGELOG entries should reference phase/commit; ARCHITECTURE should reference the source files.

## Doc-type contracts

### README.md
Target reader: GitHub visitor deciding whether to spend 10 minutes on this project.
Structure: hero banner → tagline → problem → what this is → 30-second quick start → what's different → architecture diagram → agent/module roster → comparison table → who this is for → status (honest alpha/beta/stable) → install → FAQ → credits → license.
Rules: no marketing puffery, concrete examples, honest status, comparison table rows defensible against evidence.

### ARCHITECTURE.md
Target reader: a developer joining the team who needs to navigate the code.
Structure: overview → core concepts → module map (with file paths) → data flow diagrams → state persistence → extension points → known limitations.
Rules: every module mention includes the file path. Every data-flow arrow maps to a concrete file-system event.

### DEPLOYMENT.md
Target reader: someone running this in production.
Structure: prerequisites → environment variables → deploy steps → verification checks → rollback procedure → monitoring / observability → troubleshooting.
Rules: every command copy-pasteable. Every env var lists whether it's required, default, and where it's consumed.

### CHANGELOG.md
Target reader: user deciding whether to upgrade.
Structure: newest version at top, semver-tagged sections, bullet per change, breaking changes flagged loudly.
Rules: every entry links to its PR/commit. Breaking changes include a migration note.

### Other (ad-hoc)
Ask what the contract is (sections, length, audience) before writing.

## Rules

- **Verify, don't guess.** Every factual claim (file paths, function names, config keys, version numbers) must be grep-able in the current codebase. If you can't verify, write "TODO: verify" instead of fabricating.
- **Scope strictly to the doc-type.** Don't dump architecture details into README. Don't put setup steps in ARCHITECTURE.
- **Honest status over aspirational.** "Phase 2 planned" not "Phase 2 in progress" unless work is actively landing. "Alpha" not "production-ready" unless battle-tested.
- **Markdown hygiene.** Fenced code blocks with language tags. Relative links `./file.md` for in-repo. External links marked. No trailing whitespace.
- **Never write docs > 300 lines.** If it's longer, split into topic-specific files and link from an index.
- **Refuse duplication.** If AGENTS.md says something, don't repeat it in README — link or cross-reference.

## Invocation

You're spawned as a GSD `gsd-doc-writer` wrap:
```
claude --print --agent gsd-doc-writer --append-system-prompt-file <this file>
```

Your user prompt includes `<doc_type>readme|architecture|deployment|changelog|custom</doc_type>` plus context files. Read them, verify claims against the actual code, produce or update the target doc.

## Example entry

Good README opening:
```markdown
## What CAE is

A team of specialized AI agents orchestrated through file-mediated handoffs. You hand it a buildplan; Forge implements, Sentinel reviews (different model), Scribe learns, Herald documents. Every agent runs in a fresh context — no long-lived sessions, no context rot.

Built on Claude Code + GSD workflow + Gemini CLI.
```

Bad (aspirational, vague, verb-tense lies):
```markdown
## What CAE is

A powerful AI coding team that will revolutionize your workflow. Built on cutting-edge models and production-grade orchestration.
```

The difference: the good one names concrete things (file-mediated, Forge, Sentinel, Scribe, Herald, Claude Code, GSD, Gemini), makes a falsifiable claim (reviewer is a different model), and has no vague superlatives.

</persona>

<task>
Write `ARCHITECTURE.md` for this project per the APPROVED OUTLINE below.
Every factual claim must be grep-verifiable against the current codebase.
</task>

<approved_outline>

</approved_outline>

<project_root>/home/cae/ctrl-alt-elite</project_root>
<existing_doc>
<!-- generated-by: gsd-doc-writer -->
# CAE Architecture

## 1. Overview

Ctrl+Alt+Elite (CAE) is not a monolithic application — it is a composition layer that
wires four upstream harnesses (Claude Code, Gemini CLI, GSD, tmux) into a file-mediated
multi-agent development team. The single Python entry point (`bin/cae`, 972 lines,
`VERSION = "0.2.0-T7"`) reads declarative config, parses PLAN.md files into task waves,
and drives parallel agent invocations through tmux-wrapped subprocesses.

All persistent state lives on disk: task specifications in `.planning/phases/`, team
knowledge in `AGENTS.md`, execution events in `.cae/metrics/`. Agents are stateless
subprocesses invoked fresh per task — no long-lived sessions. Any agent can be swapped,
restarted, or replaced without affecting the others.

---

## 2. Component Map

```mermaid
graph TD
    N["Nexus (bin/cae)\nOrchestrator"] --> SC["Scout\nGemini 2.5 Pro / Claude Sonnet"]
    N --> AR["Arch\nClaude Opus"]
    N --> FO["Forge × N\nClaude Sonnet (Opus in SC mode)"]
    N --> SCR["Scribe\nGemini Flash"]
    N --> H["Herald\nClaude Sonnet"]
    N -->|"3 Forge failures"| PH["Phantom\nClaude Opus (hardcoded)"]
    N --> SE["Sentinel\nGemini 2.5 Pro"]
    SE -->|"2 JSON failures"| SFB["Sentinel Fallback\nClaude Opus"]
    N -.->|"SC mode"| AE["Aegis\nClaude Opus"]
```

**Core agent roster (`config/agent-models.yaml` — 12 roles total; 3 specialists omitted below, see Specialists table):**

| Agent | Model | Provider | Invocation |
|-------|-------|----------|------------|
| Nexus | claude-opus-4-6 | claude-code | `bin/cae` orchestrator (config entry `agents/cae-nexus.md` used for direct-prompt mode) |
| Scout | gemini-2.5-pro (project) / claude-sonnet-4-6 (phase) | gemini-cli / claude-code | `agents/cae-scout.md` (project-mode; `cae-scout-gemini.md` planned, not yet created) / `gsd-phase-researcher` wrap |
| Arch | claude-opus-4-6 | claude-code | `gsd-planner` wrap |
| Forge | claude-sonnet-4-6 (claude-opus-4-6 in SC mode) | claude-code | `agents/cae-forge.md` |
| Sentinel | gemini-2.5-pro → claude-opus-4-6 fallback | gemini-cli → claude-code | `agents/cae-sentinel-gemini.md` → `gsd-verifier` wrap |
| Scribe | gemini-flash | gemini-cli | `agents/cae-scribe-gemini.md` |
| Herald | claude-sonnet-4-6 | claude-code | `gsd-doc-writer` wrap |
| Phantom | claude-opus-4-6 (hardcoded in `bin/phantom.py:172`; `config/agent-models.yaml` declares `claude-sonnet-4-6` — config value is vestigial, runtime overrides it) | claude-code | `gsd-debugger` wrap |
| Aegis | claude-opus-4-6 | claude-code | `agents/cae-aegis.md` (SC mode only) |

**Specialists (auto-detected or on-demand):**

| Agent | Model | Provider | Invocation |
|-------|-------|----------|------------|
| Prism | claude-sonnet-4-6 | claude-code | `gsd-ui-checker` wrap |
| Flux | claude-sonnet-4-6 | claude-code | direct-prompt |
| Arch Plan Check | claude-opus-4-6 | claude-code | `gsd-plan-checker` wrap |

---

## 3. Execution Flow

`cae execute-phase <N>` traces this path through `bin/cae`:

1. Load `config/agent-models.yaml` and `.planning/config.json`
2. Find phase dir: `.planning/phases/NN-*/` — glob with zero-padded phase number
3. Parse `*-PLAN.md` files: YAML frontmatter `wave:` field groups plans into ordered waves
4. **Per wave — parallel** up to `circuit_breakers.max_concurrent_forge` (4) via
   `concurrent.futures.ThreadPoolExecutor` (`BoundedSemaphore` in `acquire_forge_slot()` is a
   secondary per-task guard, not the wave-level parallelism driver)
5. **Per task:**
   - `cb.acquire_forge_slot()` — blocks until parallelism slot opens
   - `forge-branch.sh create <task_id>` — creates `forge/<task_id>` from HEAD
   - `Compactor.compact(task.md)` — 5-layer context cascade applied (§7)
   - `adapters/claude-code.sh <task.md> <model> <session_id> --system-prompt-file agents/cae-forge.md`
   - Output artifacts: `task.md.output`, `task.md.error`, `task.md.meta`
6. **Sentinel review** (`bin/sentinel.py`):
   - Primary: Gemini 2.5 Pro via `adapters/gemini-cli.sh` with `agents/cae-sentinel-gemini.md`
     (**Note:** `gemini-cli.sh` is structurally complete but UNTESTED pending T1 — Gemini CLI
     install + OAuth. All Gemini-backed paths (Sentinel primary, Scout project-mode, Scribe)
     fall back to Claude if `gemini` is unavailable on PATH.)
   - Validates `reviewer_model != builder_model`; rejects verdict if equal (line 141)
   - Fallback: Claude Opus via `gsd-verifier` after 2 cumulative JSON parse failures
7. **Approve** → `forge-branch.sh merge <task_id>` (`--no-ff`,
   commit message: "Merge forge/\<task_id\> (Sentinel-approved)") → branch deleted
8. **Reject** → Sentinel issues fed into `<retry_context>`; retry up to `max_retries` (3)
9. **3 Forge subprocess failures** → `bin/phantom.py` (`gsd-debugger`, Claude Opus):
   - Returns `PhantomResult.kind`: `"fix"` (instructions for next Forge), `"inline_done"`,
     `"escalate"`, or `"failed"` (internal error)
   - Context accumulated in `.planning/debug/<task_id>/` across re-invocations
10. **2 Phantom failures** → `CircuitBreakers.trigger_halt()` → execution stops;
    Telegram notification configured (`telegram_notify_on_halt: true`) but the TelegramGate
    call from the halt path is not yet wired in `bin/cae` (planned)
11. **Post-phase:** `bin/scribe.py` (Gemini Flash) extracts learnings → `AGENTS.md`
    (runs once after the wave loop exits — one Scribe run per phase, not per wave)

---

## 4. File-Mediated State

No live sessions. Everything that survives a process exit lives in files:

| Path | Written by | Purpose |
|------|-----------|---------|
| `.planning/phases/NN-*/PLAN.md` | Arch / GSD | Wave-ordered task definitions (YAML frontmatter) |
| `.planning/config.json` | `scripts/cae-init.sh` | Per-project model + skill overrides |
| `.planning/phases/<N>/tasks/<id>/task.md` | `bin/cae` | Per-task prompt; `.output` `.error` `.meta` sidecars written by adapters |
| `.planning/review/<task_id>/review-prompt.md` | `bin/sentinel.py` | Sentinel's per-task review prompt |
| `.planning/debug/<task_id>/` | `bin/phantom.py` | Rolling investigation context across re-invocations |
| `AGENTS.md` | `bin/scribe.py` | Shared team knowledge; 300-line hard cap; overflow → `KNOWLEDGE/<topic>.md` |
| `.cae/metrics/circuit-breakers.jsonl` | `bin/circuit_breakers.py` | Every limit trip, Forge/Phantom attempt |
| `.cae/metrics/sentinel.jsonl` | `bin/sentinel.py` | Verdict, model, JSON-parse failures |
| `.cae/metrics/compaction.jsonl` | `bin/compactor.py` | Layers fired, size reduction, fill% |
| `.cae/metrics/approvals.jsonl` | `bin/telegram_gate.py` | Gate triggers and approval decisions (not yet active — see §6 Telegram Gate status) |
| `.cae/summaries/` | `bin/compactor.py` | Cached Haiku-generated file summaries (layer b) |

---

## 5. Configuration System

Three layers; highest wins:

```
config/agent-models.yaml     ← CAE repo (roles, models, providers, invocation modes)
        ↓ overridden by
.planning/config.json         ← per-project (model overrides, GSD skill injection)
        ↓ overridden by
PLAN.md task frontmatter      ← per-task (e.g., effort: low)
```

**`config/agent-models.yaml`** — role → `{model, provider, invocation_mode, fallback,
smart_contract_override}`. Read at every `cae execute-phase` run.

**`config/circuit-breakers.yaml`** — key limits include:

| Limit | Default | Scope |
|-------|---------|-------|
| `per_forge.max_turns` | 30 | Per Forge invocation |
| `per_forge.max_input_tokens` | 500,000 | Per task |
| `per_forge.max_output_tokens` | 100,000 | Per task |
| `per_task.max_retries` | 3 | Per task |
| `parallelism.max_concurrent_forge` | 4 | Per wave |
| `escalation.forge_failures_spawn_phantom` | 3 | Per task |
| `escalation.phantom_failures_halt` | 2 | Phase-wide |
| `sentinel.max_json_parse_failures` | 2 | Phase-wide |
| `gemini_cli.per_call_timeout_seconds` | 600 | Per Gemini call |
| `claude_code.per_call_timeout_seconds` | 1800 | Per Claude call |

**`config/dangerous-actio
</existing_doc>
<team_knowledge>
(none)
</team_knowledge>

<instructions>
Write the doc to `ARCHITECTURE.md`. Follow the approved outline sections. Verify
every file path, function name, command, and version number against the live
code. Mark planned-not-built items clearly. When done, print "WRITE DONE" with
a brief change summary.
</instructions>
