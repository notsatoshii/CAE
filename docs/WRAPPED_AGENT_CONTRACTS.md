# Wrapped GSD Agent Contracts
**Date:** 2026-04-16
**Purpose:** For each GSD agent CAE wraps via `claude --print --agent gsd-<name>`, document the exact user-prompt structure the agent expects and the output format it produces.

**Source of truth:** the spawning workflow file in `~/.claude/get-shit-done/workflows/`. If GSD updates a workflow, CAE's wrap contract may need to be updated to match.

---

## Invocation template (all wraps)

```bash
claude --print --effort max --agent <agent-name> --permission-mode plan < prompt.md > output.txt
```

Notes:
- `--effort max` is CAE default; overridable per task.
- `--permission-mode plan` = read-only audit mode. Appropriate for checkers/verifiers that shouldn't write. For executor-type agents, drop this flag.
- Prompt is piped via stdin (heredoc or file redirect). Avoids quoting hell with multi-line XML.

---

## gsd-ui-checker

**Source workflow:** `~/.claude/get-shit-done/workflows/ui-phase.md` (step 7, lines 160–192)

### User prompt structure
```markdown
<objective>
Validate UI design contract for Phase {N}: {phase_name}.
Check all 6 dimensions. Return APPROVED or BLOCKED.
</objective>

<files_to_read>
- {phase_dir}/{padded}-UI-SPEC.md
- {phase_dir}/CONTEXT.md
- {phase_dir}/RESEARCH.md
</files_to_read>

<config>
ui_safety_gate: {true|false}
</config>
```

### Required context files
- `UI-SPEC.md` — primary input (the design contract being checked)
- `CONTEXT.md` — user decisions, checked for compliance
- `RESEARCH.md` — stack alignment check

### Output format
Preamble line (variable — may or may not appear), followed by structured verdict:

```
## ISSUES FOUND
**Phase:** {N} - {name}
**Status:** BLOCKED
**Blocking Issues:** {count}

### Dimension Results
| Dimension | Verdict | Notes |
| 1 Copywriting | BLOCK | ... |
...

### Blocking Issues
- **Dim N — Name:** {description}
  Fix: {fix hint}

### Recommendations
{or "None"}
```

**Happy path alternative:** `## UI-SPEC VERIFIED` at the top of output.

### Parser notes
- Skip anything before `## ISSUES FOUND` or `## UI-SPEC VERIFIED`
- Status field: regex match `\*\*Status:\*\* (BLOCKED|APPROVED)`
- Dimension table: parse markdown table after `### Dimension Results`

### Validated
Test run 2026-04-16 on `/tmp/cae-t2-5-prototype/`:
- 6 planted BLOCK issues all caught (generic CTAs, empty state, 5 font sizes, 3 weights, 10px spacing)
- 3 pass-worthy dimensions correctly passed
- Output parseable

---

## gsd-plan-checker

**Source workflow:** `~/.claude/get-shit-done/workflows/plan-phase.md` (step 10, lines 722–769) + `~/.claude/get-shit-done/workflows/import.md` (step 220+)

### User prompt structure
```markdown
<verification_context>
**Phase:** {N}
**Phase Goal:** {goal from ROADMAP}

<files_to_read>
- {phase_dir}/*-PLAN.md
- .planning/ROADMAP.md
- .planning/REQUIREMENTS.md
- {phase_dir}/CONTEXT.md
- {phase_dir}/RESEARCH.md
</files_to_read>

**Phase requirement IDs (MUST ALL be covered):** {req_ids}
</verification_context>

<expected_output>
- ## VERIFICATION PASSED — all checks pass
- ## ISSUES FOUND — structured issue list
</expected_output>
```

### Required context files
- All PLAN.md files for the phase (glob)
- ROADMAP.md and REQUIREMENTS.md (project-level)
- CONTEXT.md (user decisions)
- RESEARCH.md (technical research)

### Output format
```
## ISSUES FOUND
**Phase:** {N} ({name})
**Plans checked:** {count}
**Issues:** {N} blocker(s), {M} warning(s), {K} info

### Blockers (must fix)
**1. [dimension_name] {title}**
- Plan: {id}
- {description}
- Fix: {fix hint}

### Warnings (should fix)
{same structure}

### Structured Issues
\`\`\`yaml
issues:
  - plan: "01"
    dimension: requirement_coverage
    severity: blocker
    description: "..."
    fix_hint: "..."
\`\`\`

### Recommendation
{next action}
```

**Happy path:** `## VERIFICATION PASSED` header.

### Parser notes
- **Preferred: parse the YAML block in "Structured Issues".** This is the machine-readable canonical output.
- Header status: regex match `## (VERIFICATION PASSED|ISSUES FOUND)`
- Blocker count: regex `\*\*Issues:\*\* (\d+) blocker`

### Validated
Test run 2026-04-16 on `/tmp/cae-t2-5-prototype/`:
- Planted issue caught (R-03 not covered by any task)
- Found 6 additional real issues I hadn't planted (strict discipline — missing `must_haves` frontmatter, `<done>` elements, `files_modified` completeness, etc.)
- YAML issues block present and well-formed

---

## gsd-debugger (Phantom wrap)

**Source workflows:** `~/.claude/get-shit-done/workflows/debug.md` + `~/.claude/get-shit-done/workflows/diagnose-issues.md`

### Not yet prototyped
Phantom wrap prototype deferred until T11a (Phantom integration). The integration work is where the wrap gets exercised against realistic failure contexts. Contract will be added to this doc when validated.

Expected prompt structure (inferred from agent file):
```markdown
<debug_context>
**Symptom:** {user-reported issue}
**Observed behavior:** {what happens}
**Expected behavior:** {what should happen}

<files_to_read>
- {failing test output}
- {relevant source files}
- {previous Forge SUMMARY.md if escalated}
</files_to_read>

<mode>{interactive|autonomous}</mode>
</debug_context>
```

### Output format (inferred)
Agent produces structured returns documented in `~/.claude/get-shit-done/references/agent-contracts.md`:
- `## ROOT CAUSE FOUND` (with fix recommendation)
- `## DEBUG COMPLETE` (with reproduction steps + fix)
- `## CHECKPOINT REACHED` (needs user input)

Will validate in T11a.

---

## gsd-doc-writer (Herald wrap — PHASE 2)

Deferred to Phase 2. Contract will be added when Herald is built.

---

## Generic parser helpers

Since outputs have variable preambles (agent may chat before emitting structured output), the orchestrator's parser should:

1. Scan for known section markers: `## ISSUES FOUND`, `## VERIFICATION PASSED`, `## UI-SPEC VERIFIED`, `## ROOT CAUSE FOUND`, `## DEBUG COMPLETE`, `## CHECKPOINT REACHED`
2. Everything before the first marker = preamble, discard
3. Parse from the marker forward

This is simpler and more robust than asking the agents to suppress preambles (which would require prompt engineering against their trained behavior).

---

## Wrap vs. fallback decisions

When a wrap fails validation:
1. **Retry once** with slightly more detailed prompt (often fixes transient output issues)
2. **If second attempt fails:** fall back to the orchestrator's own `direct-prompt` implementation for that role
3. **Log the fallback** to `.cae/metrics/wrap-failures.jsonl` so we can track which agents need contract updates

The orchestrator ships with `direct-prompt` fallbacks for every wrapped role. No wrap is load-bearing.

End of WRAPPED_AGENT_CONTRACTS.md.
