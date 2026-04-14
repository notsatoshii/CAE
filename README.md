# Ctrl+Alt+Elite

A multi-agent AI coding team built on [GSD (Get-Shit-Done)](https://github.com/gsd-build/get-shit-done) and [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Give it a buildplan, it ships production code.

## How It Works

Ctrl+Alt+Elite is a team of specialized AI agents that work together like a real dev shop:

```
Buildplan → NEXUS (orchestrator)
              ├── SCOUT (researches unknowns)
              ├── ARCH (designs system before anyone codes)
              ├── FORGE × N (builds in parallel, fresh context per task)
              ├── SENTINEL (reviews with different model than builder)
              ├── SCRIBE (extracts learnings for next build)
              └── AEGIS (security audit, auto-detected for smart contracts)
```

**Key ideas:**
- **Fresh context per task** — builders spawn clean every time (no context rot)
- **Adversarial review** — reviewer uses a different model than the builder
- **File-mediated communication** — agents share knowledge through files, not conversation
- **Model diversity** — Claude Opus for decisions, Gemini for research/bulk, Sonnet for speed
- **Persistent learning** — Scribe updates AGENTS.md so the team improves over time

## Quick Start

```bash
# Prerequisites: Claude Code CLI + Node.js 18+
git clone https://github.com/YourOrg/ctrl-alt-elite.git
cd ctrl-alt-elite
chmod +x scripts/install.sh
./scripts/install.sh
```

Then in any project:
```bash
cd your-project
claude
# Use /gsd-new-project to start
```

## Agent Roster

### Core Team (every project)
| Agent | Role | Default Model |
|-------|------|--------------|
| **Nexus** | Orchestrator — receives buildplans, runs workflow, never codes | Claude Opus |
| **Scout** | Researcher — reads docs/codebases, produces condensed briefs | Gemini 2.5 Pro |
| **Arch** | Architect — system design, interfaces, task decomposition | Claude Opus |
| **Forge** | Builder — implements one atomic task with fresh context | Sonnet / Gemini |
| **Sentinel** | Reviewer — code review, different model than builder | Claude Opus |
| **Scribe** | Knowledge keeper — extracts patterns into AGENTS.md | Gemini Flash |

### Specialists (auto-detected or on-demand)
| Agent | When | Default Model |
|-------|------|--------------|
| **Aegis** | Smart contracts detected (.sol, foundry.toml) | Claude Opus |
| **Phantom** | Repeated build failures | Gemini 2.5 Pro |
| **Prism** | UI-heavy phases | Claude Opus |
| **Flux** | DevOps / infrastructure tasks | Gemini Flash |

## Model Profiles

Switch cost/quality tradeoff:

```bash
/gsd-set-profile quality    # Opus everywhere (expensive, highest quality)
/gsd-set-profile balanced   # Opus for decisions, Gemini for bulk (default)
/gsd-set-profile budget     # Sonnet + Flash (cheapest)
```

## Smart Contract Mode

Auto-activates when your project contains Solidity/Vyper files. Adds:
- Aegis security auditor after every code review
- Forge model override to Claude Opus for all contract code
- Foundry `forge test` in every verification step
- Solidity-specific patterns in AGENTS.md

## Token Optimization

- [Caveman](https://github.com/JuliusBrussee/caveman) plugin compresses builder output 65-75%
- [Karpathy Guidelines](https://github.com/forrestchang/andrej-karpathy-skills) prevent over-engineering
- Scout reads docs once → compact brief → all builders share it
- 3-layer context injection: project index → research brief → specific files only

## Architecture

Built on:
- **[GSD](https://github.com/gsd-build/get-shit-done)** — Phase-based workflow, wave execution, worktree isolation, state persistence
- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** — AI coding agent runtime
- **[Multica](https://github.com/multica-ai/multica)** — Dashboard for tracking agent status and tasks (optional)
- **[Caveman](https://github.com/JuliusBrussee/caveman)** — Token compression
- **[Karpathy Skills](https://github.com/forrestchang/andrej-karpathy-skills)** — Quality guardrails

Patterns from:
- **[Ralph](https://github.com/snarktank/ralph)** — Fresh context per task, AGENTS.md learning loop
- **[Claude-Mem](https://github.com/thedotmack/claude-mem)** — 3-layer context injection pattern

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
