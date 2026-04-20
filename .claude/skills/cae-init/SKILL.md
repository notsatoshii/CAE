---
name: cae-init
description: Initialize Ctrl+Alt+Elite for the current project. Run AFTER /gsd-new-project. Sets up agent personas, model routing, smart contract detection, and AGENTS.md.
version: 0.1.0
---

# /cae-init — Initialize Ctrl+Alt+Elite

Run this after `/gsd-new-project` to activate Ctrl+Alt+Elite agent personas and model routing.

## What This Does

1. Copies CAE skill files into the project (`.claude/skills/cae-*`)
2. Detects smart contracts (`.sol`, `foundry.toml`, etc.) and activates Aegis security auditor
3. Configures `.planning/config.json` with:
   - `agent_skills` — maps GSD agent types to CAE personas
   - `model_overrides` — Opus for planning/review, Sonnet for building (adversarial diversity)
4. Creates `AGENTS.md` template for the team knowledge base
5. If smart contracts detected: loads Solidity supplement, overrides builder to Opus

## Usage

```
/cae-init
```

Or manually:
```bash
bash /home/cae/ctrl-alt-elite/scripts/cae-init.sh .
```

## After Initialization

The GSD workflow now uses Ctrl+Alt+Elite personas automatically:
- `/gsd-plan-phase` spawns Arch (architect persona, Claude Opus)
- `/gsd-execute-phase` spawns Forge instances (builder persona, Claude Sonnet)
- `/gsd-verify-work` spawns Sentinel (reviewer persona, Claude Opus)
- Research phases spawn Scout (researcher persona)

Run `/cae-scribe` after each phase to update AGENTS.md with learnings.
