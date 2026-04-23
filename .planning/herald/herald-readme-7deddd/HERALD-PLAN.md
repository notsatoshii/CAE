# HERALD-PLAN.md — README Section Outline

**Target file:** `README.md` (project root)
**Line budget:** ≤300 (current: 321 — need to cut ~25 lines net)
**Herald run date:** 2026-04-17

---

## Ground truth verified

| Fact | Source |
|------|--------|
| `VERSION = "0.2.0-T7"` | `bin/cae` line 34 |
| Sentinel model: `gemini-2.5-pro` | `config/agent-models.yaml` |
| Sentinel fallback: `claude-opus-4-6` via `gsd-verifier` | `config/agent-models.yaml` |
| Forge model: `claude-sonnet-4-6` | `config/agent-models.yaml` |
| Smart contract override: `claude-opus-4-6` | `config/agent-models.yaml` |
| Scribe model: `gemini-flash` | `config/agent-models.yaml` |
| Circuit breakers: 6 limits defined | `config/circuit-breakers.yaml` |
| max_concurrent_forge: 4 | `config/circuit-breakers.yaml` |
| max_retries: 3 before Phantom | `config/circuit-breakers.yaml` |
| Phantom failures before halt: 2 | `config/circuit-breakers.yaml` |
| Dangerous action patterns: 8 regex rules | `config/dangerous-actions.yaml` |
| Agents dir: 10 persona `.md` files | `agents/` (cae-*.md) |
| Skills dir: cae-forge, arch, sentinel, scout, scribe, aegis, init | `skills/` |
| Adapters: claude-code.sh, gemini-cli.sh | `adapters/` |
| Orchestrator entrypoint | `bin/cae` (Python) |
| Install script | `scripts/install.sh` |
| Project init | `scripts/cae-init.sh` |
| Status: **Alpha — passed calc.py toy only** | `CURRENT_STATE.md`, README FAQ |
| Herald shipped in Phase 2 | `git log` commit `5c5ee4e` |
| Phase 1 complete | badge + `PHASE_1_TASKS.md` |

---

## Section outline (in order)

### 1. Banner + tagline
**Purpose:** Instant visual identity and single-sentence hook.
**References:** `assets/banner.svg` (already in repo), existing tagline "The AI coder that gets code-reviewed."
**Keep as-is.** Banner + 4 badges (phase, license, stack, models).
**~10 lines**

---

### 2. The problem
**Purpose:** Name the rubber-stamp failure mode — one AI builds AND verifies = no real review.
**References:** Existing prose is accurate and tight. Keep.
**~10 lines**

---

### 3. What CAE is
**Purpose:** Concrete one-paragraph answer: AI dev shop, file-mediated handoffs, agents listed by name.
**References:**
- Agent roster: Forge (`claude-sonnet-4-6`), Sentinel (`gemini-2.5-pro`, different provider), Scribe (`gemini-flash`), Phantom (debugger), Aegis (Solidity), Herald (docs) — all in `config/agent-models.yaml`
- "Built on GSD + Claude Code + Gemini CLI" — accurate, verified
- Mention Herald explicitly (Phase 2 shipped, commit `5c5ee4e`)
**~10 lines**

---

### 4. Quick start
**Purpose:** Shortest path from zero to running — copy-pasteable, honest about prerequisites.
**References:**
- `scripts/install.sh` — installs CAE + GSD + Caveman + Karpathy plugins
- `scripts/cae-init.sh` — per-project init (requires `.planning/` from `/gsd-new-project` first)
- `bin/cae execute-phase 1` — orchestrator entrypoint
- Prerequisites: Claude Code CLI, Python 3.9+, Bash, tmux, git (Gemini CLI optional)
- **Honest note:** Gemini CLI required for real cross-provider Sentinel; Claude-only fallback exists
**~20 lines**

---

### 5. What makes it different
**Purpose:** 4-5 defensible differentiators, each tied to code not convention.
**References:**
- Reviewer ≠ builder enforced: `bin/sentinel.py` rejects verdicts where `reviewer_model == builder_model`
- File-mediated: `.planning/` PLAN.md, AGENTS.md, SUMMARY.md — no session state
- 6 circuit breakers: `config/circuit-breakers.yaml` (turn budget, retry cap, concurrent Forge, tokens in/out, sentinel JSON failures)
- Branch isolation: `scripts/forge-branch.sh` + `scripts/install-branch-guard.sh` (git pre-push hook)
- Telegram gate: `config/dangerous-actions.yaml` (8 patterns: `rm -rf`, `git push main`, `forge script --broadcast`, etc.)
- Smart contract mode: auto-detects `.sol`/`.vy`/`foundry.toml` → promotes Forge to Opus, runs Aegis (`agents/cae-aegis.md`)
**~22 lines**

---

### 6. How it works (diagram)
**Purpose:** ASCII flow showing wave dispatch → Forge → Sentinel → Scribe path.
**References:**
- Existing diagram is accurate to the code — keep it
- Verify: "Every arrow is a file on disk" — accurate (`bin/cae` writes metrics to `.cae/metrics/`)
- `tail -f .cae/metrics/*.jsonl` — confirm `.cae/metrics/` path matches `bin/cae` code (yes: `_THIS.parent.parent / ".cae" / "metrics"` implied by orchestrator logic)
**~40 lines**

---

### 7. Installation
**Purpose:** Exact commands — clone, install, per-project init.
**References:**
- `git clone https://github.com/notsatoshii/CAE.git && cd CAE && ./scripts/install.sh`
- `scripts/install.sh` installs: `cae` symlink to PATH, GSD via `npx get-shit-done-cc@latest`, Caveman plugin, Karpathy plugin, agent personas to `~/.claude/agents/`, hooks
- Per-project: `gsd-new-project` (inside Claude REPL) then `cae-init .`
- `cae execute-phase 1`
- Link to `docs/WRAPPED_AGENT_CONTRACTS.md` for wrapped agent detail
**~20 lines**

---

### 8. Configuration
**Purpose:** Config surface — which file controls what.
**References:**
- `config/agent-models.yaml` — role → model routing (all 10 roles defined)
- `config/circuit-breakers.yaml` — 6 limits
- `config/dangerous-actions.yaml` — 8 Telegram-gate patterns
- `config/cae-schema.json` — JSON Schema for validation
- Per-project: `.planning/config.json` (written by `cae-init.sh`)
- Per-task: frontmatter `effort: low` override
- Link to `CONFIG_SCHEMA.md`
**~15 lines**

---

### 9. Project structure
**Purpose:** Directory map so contributors know where things live.
**References (actual dirs in repo):**
- `bin/` — `cae` (orchestrator), `sentinel.py`, `scribe.py`, `phantom.py`, `circuit_breakers.py`, `compactor.py`, `telegram_gate.py`
- `adapters/` — `claude-code.sh`, `gemini-cli.sh`
- `agents/` — 10+ persona `.md` files
- `skills/` — `cae-forge/`, `cae-arch/`, `cae-sentinel/`, `cae-scout/`, `cae-scribe/`, `cae-aegis/`, `cae-init/`
- `config/` — 4 config files
- `scripts/` — 7 shell scripts
- `assets/` — SVG banner
- `docs/` — `WRAPPED_AGENT_CONTRACTS.md` + others
**~18 lines**

---

### 10. Built on / credits
**Purpose:** Honest attribution — name the three heavyweights doing the real work; credit patterns borrowed.
**References:**
- Runtime stack: Claude Code, Gemini CLI, GSD (3,150 lines of prompt engineering), tmux + Bash
- Token management: Caveman (65–75% compression), Karpathy Guidelines, Claude Haiku (compaction cascade)
- Patterns borrowed: Ralph (fresh context), Claude-Mem (3-layer injection), OMC/OMX (tmux coordination)
- Optional: Multica (`scripts/multica-bridge.sh`)
- Honest line (keep verbatim): "If you remove any of the three upstream projects, CAE doesn't exist."
**CUT:** Expand the "Peripheral" and "Patterns borrowed" sub-subsections — collapse into one flat bullet list to save 15 lines.
**~30 lines** (down from ~50)

---

### 11. FAQ
**Purpose:** Answer the 4-5 questions every evaluator will have before the README does.
**References:**
- Q: vs Aider — `bin/sentinel.py` rejects `reviewer_model == builder_model` (not convention)
- Q: vs Claude Code /agents — cross-provider (Gemini pipeline), file-mediated handoffs, circuit breakers, GSD workflow
- Q: cost — "Unknown in practice. Design target: Forge prompts ≤30k tokens via compaction. Rough: $0.50–$2/phase." Keep honest.
- Q: wrapper? — "Yes — and that's the point." Keep.
- Q: production-ready? — "No. Alpha. Phase 1 on calc.py only." Keep verbatim, it's honest.
- Q: Claude-only? — Sentinel falls back to `claude-opus-4-6` (gsd-verifier wrap), Scribe to Claude Haiku.
**CUT:** Remove Q about "Not a developer?" (Phase 2 Shift not shipped yet — outdated). Saves 5 lines.
**~35 lines** (down from ~50)

---

### 12. Contributing + License
**Purpose:** One-liner each. No bloat.
**References:**
- "Open an issue before PR — architecture still solidifying." Accurate.
- MIT, `LICENSE` file
**~8 lines**

---

### 13. Footer
**Purpose:** Author credit + issues link.
**References:** `https://github.com/notsatoshii/CAE/issues`
**~3 lines**

---

## Line count summary

| Section | Est. lines |
|---------|-----------|
| 1. Banner + badges | 10 |
| 2. Problem | 10 |
| 3. What CAE is | 10 |
| 4. Quick start | 20 |
| 5. Differentiators | 22 |
| 6. Diagram | 40 |
| 7. Installation | 20 |
| 8. Configuration | 15 |
| 9. Project structure | 18 |
| 10. Built on / credits | 30 |
| 11. FAQ | 35 |
| 12. Contributing + License | 8 |
| 13. Footer | 3 |
| **Total** | **241** |

~60 lines under cap. Headroom for actual command blocks and blank lines.

---

## What to cut from current README

| Cut | Why | Saves |
|-----|-----|-------|
| "Not a developer? Phase 2 ships Shift..." | Shift not shipped — aspirational in present tense | ~5 lines |
| "Peripheral" sub-subsection in Built on | Collapse into flat bullets | ~8 lines |
| "Patterns borrowed" sub-subsection | Same | ~10 lines |
| Verbose Multica sub-bullet | One line is enough | ~3 lines |
| FAQ: Shift/normie question (if added) | Not shipped | ~5 lines |
| **Total cut** | | **~31 lines** |

---

## What to add/fix

| Add | Why |
|-----|-----|
| Herald listed explicitly in "What CAE is" | Shipped in Phase 2 (commit `5c5ee4e`) — omitted from current prose |
| Sentinel model named: `gemini-2.5-pro` | Current prose says "Gemini 2.5 Pro" but exact model ID in config differs from prose; keep prose-level name, verify consistent |
| `bin/cae` Python entrypoint named | Currently anonymous in "cae" CLI section |
| Smart contract override models confirmed | Current text says "promotes Forge to Opus" — verify: `smart_contract_override: claude-opus-4-6` ✓ |
| Phase 2 "Alpha" status update | CURRENT_STATE.md confirms still alpha |
