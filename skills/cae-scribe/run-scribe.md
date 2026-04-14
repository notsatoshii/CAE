---
name: cae-run-scribe
description: Run Scribe learning loop — reads phase summaries and reviews, updates AGENTS.md with patterns and gotchas.
version: 0.1.0
---

# /cae-scribe — Run Learning Loop

Spawns a Scribe agent to read completed phase artifacts and update AGENTS.md.

## When to Run

After `/gsd-execute-phase` and `/gsd-verify-work` complete for a phase. Scribe reads:
- All SUMMARY.md files from the completed phase
- All verification/review output
- Recent git log for the phase's commits

## Process

1. Read `AGENTS.md` (current state of team knowledge)
2. Read `.planning/STATE.md` to identify which phase just completed
3. Read all SUMMARY.md files in the completed phase directory
4. Read git log for recent commits (last 20)
5. Extract new patterns, conventions, and gotchas
6. Update AGENTS.md with concise, actionable entries
7. Commit the updated AGENTS.md

## Execution

Spawn a doc-writer subagent with the Scribe skill:

```
Task(
  subagent_type="gsd-doc-writer",
  model="claude-haiku-4-5",
  prompt="
    You are Scribe. Read the following files and update AGENTS.md with new learnings:
    
    <files_to_read>
    - AGENTS.md
    - .planning/STATE.md
    - .planning/phases/[latest]/*SUMMARY*.md
    </files_to_read>
    
    Rules:
    - Max 5 lines per entry
    - Code examples over prose  
    - Delete stale entries
    - Attribute gotchas to their phase
    
    Commit the updated AGENTS.md when done.
  "
)
```
