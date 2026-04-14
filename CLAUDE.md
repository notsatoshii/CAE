# Ctrl+Alt+Elite — Multi-Agent Coding Team

A multi-agent AI development system built on GSD (Get-Shit-Done) and Claude Code. Ships production-quality code through specialized agent personas with adversarial review, fresh context per task, and persistent learning.

## Architecture

```
Buildplan → NEXUS (orchestrator, Claude Opus)
              ├── SCOUT (researcher, Gemini 2.5 Pro)
              ├── ARCH (architect, Claude Opus)
              ├── FORGE × N (builders, Sonnet/Gemini, parallel waves)
              ├── SENTINEL (reviewer, Claude Opus, different model than builder)
              ├── SCRIBE (knowledge keeper, Gemini Flash)
              └── AEGIS (security, Claude Opus, auto-detected for smart contracts)
```

## Core Principles

1. **Fresh context per task.** Every builder spawns clean. No context rot. Learning persists through files (AGENTS.md, git history, research briefs), not conversation history.

2. **Adversarial review.** The reviewer MUST use a different model than the builder. Different models have different blind spots — this catches errors any single model would miss.

3. **File-mediated communication.** Agents never talk to each other. All inter-agent knowledge flows through files: PLAN.md, AGENTS.md, research briefs, SUMMARY.md, REVIEW.md. Auditable, persistent, zero token cost.

4. **Right-sized tasks.** Every task must fit in a single context window. If it doesn't, the architect broke it down wrong. Re-plan, don't force.

5. **Model diversity for cost optimization.** Claude Opus for decisions (architecture, review). Gemini 2.5 Pro for bulk (research, large implementations). Sonnet/Flash for speed (standard builds, docs, knowledge extraction).

## Agent Roster

### Core Team (every project)
| Agent | Role | Model | Files Owned |
|-------|------|-------|-------------|
| Nexus | Orchestrator, runs GSD workflow | Claude Opus | STATE.md, ROADMAP.md |
| Scout | Research before building | Gemini 2.5 Pro | .planning/research/*.md |
| Arch | System design, interface contracts | Claude Opus | ARCHITECTURE.md, PLAN.md |
| Forge | Implement single atomic task | Sonnet/Gemini (per task) | Source code, tests |
| Sentinel | Code review, test verification | Claude Opus | REVIEW.md |
| Scribe | Extract learnings post-task | Gemini Flash | AGENTS.md |

### Specialists (auto-detected or on-demand)
| Agent | Trigger | Model |
|-------|---------|-------|
| Aegis | .sol files, foundry.toml, hardhat.config | Claude Opus |
| Phantom | Test failures Forge can't fix | Gemini 2.5 Pro |
| Prism | Frontend components, UI-heavy phases | Claude Opus |
| Flux | CI/CD, Docker, deployment configs | Gemini Flash |

## Workflow

Uses GSD's phase-based workflow with our persona overlay:

1. `/gsd-new-project` — Nexus receives buildplan, Scout researches unknowns
2. `/gsd-plan-phase` — Arch designs system, creates task dependency graph
3. `/gsd-execute-phase` — Forge instances execute in parallel waves (worktree isolation)
4. Post-wave: Sentinel reviews, Scribe extracts learnings
5. `/gsd-verify-work` — Integration verification
6. `/gsd-ship` — PR creation

## Context Injection (3-Layer Pattern)

When spawning a builder agent:
- **Layer 1:** Project index (PROJECT.md + compact state summary, ~500 tokens)
- **Layer 2:** Relevant research briefs from Scout (~1000-2000 tokens)
- **Layer 3:** Only the specific files referenced in the plan

Never dump the full codebase. Feed the minimum viable context.

## Smart Contract Mode

Auto-activated when project contains Solidity/Vyper files. Adds:
- Aegis security auditor runs after every Sentinel review on .sol/.vy changes
- Forge model override: smart contract tasks always use Claude Opus
- Extended AGENTS.md with Solidity-specific patterns and known pitfalls
- Foundry `forge test` mandatory in verification steps
- Slither/Mythril integration when available

## Token Optimization

- Caveman plugin active on all Forge instances (65-75% output token savings)
- Karpathy guidelines loaded on all agents (prevents over-engineering)
- Scout reads docs once → produces compact brief → all builders share it
- Scribe uses Gemini Flash (cheapest available model)

## File Structure

```
.planning/                 # GSD state (survives context resets)
  PROJECT.md               # Vision, scope, context
  ROADMAP.md               # Phase breakdown
  STATE.md                 # Current progress
  config.json              # Model profiles, workflow settings
  research/                # Scout's research briefs
  phases/
    N-name/
      PLAN.md              # Task definitions (XML structured)
      SUMMARY.md           # Completion report
      REVIEW.md            # Sentinel's review
AGENTS.md                  # Team knowledge base (patterns, gotchas, conventions)
ARCHITECTURE.md            # System design (Arch's output)
```
