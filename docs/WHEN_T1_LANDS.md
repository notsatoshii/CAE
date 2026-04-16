# What T1 (Gemini CLI OAuth) Unblocks
**Date:** 2026-04-16

All code paths needing Gemini are in place and stub gracefully today. When you complete T1, here's exactly what lights up.

## Prerequisites (you do)

Per QUESTIONS_FOR_MASTER.md Q4 — recommended path is OAuth-on-local + scp credentials:

1. Install Gemini CLI locally on your laptop/workstation and OAuth with your Google Workspace account
2. Find the credentials cache (usually `~/.config/gemini/` or similar — verify during T1 execution)
3. `scp` the credentials to this server:
   ```
   scp -r ~/.config/gemini root@165.245.186.254:/home/cae/.config/
   ```
4. Install Gemini CLI on the server (likely `npm install -g @google/gemini-cli` — confirm exact package)
5. Verify: `sudo -u cae gemini --version` works without prompting for auth

## What auto-activates when `which gemini` succeeds

### 1. Real Sentinel (cross-provider adversarial review)
**File:** `bin/sentinel.py`
**Trigger:** `bin/cae` auto-detects gemini CLI; switches from stub to Gemini path.
**Behavior:** After each Forge task, spawns Gemini 2.5 Pro with `agents/cae-sentinel-gemini.md`. Parses structured JSON verdict. Validates `reviewer_model != builder_model`. Merges on approve, retries on reject. Falls back to `gsd-verifier` wrap after 2 Gemini JSON failures (cap in `config/circuit-breakers.yaml`).

**Test it:**
```
cd /path/to/project
cae execute-phase N
# Check .cae/metrics/sentinel.jsonl for "gemini_verdict_ok" events
```

### 2. Real Scribe (automated AGENTS.md learning loop)
**File:** `bin/scribe.py`
**Trigger:** Same — auto-detects gemini.
**Behavior:** After phase completes, Gemini Flash reads SUMMARY.md files + Sentinel verdicts + git log + current AGENTS.md + KNOWLEDGE topics. Returns JSON with additions/stale_removals/topic_updates. Merge applies with dedup + 300-line cap + overflow to KNOWLEDGE/.

**Not yet wired into the automatic post-phase trigger in `bin/cae`.** Invoke manually after a phase:
```python
from scribe import Scribe
Scribe("/path/to/project").run_for_phase("1")
```

**Next step once T1 is done:** add a post-phase Scribe call in `cmd_execute_phase` in `bin/cae` (~5 lines). Keeping it out now so missing-gemini doesn't block phase completion.

### 3. Compactor layers (b) and (e)
**File:** `bin/compactor.py`
**Trigger:** Same.
**Behavior:**
- Layer (b): files in `<files_to_read>` that exceed 500 lines get summarized once via Haiku, cached under `.cae/summaries/`, referenced by summary path in task.md.
- Layer (e): at 85% context fill, old retry_context blocks collapse into a single Haiku-generated summary.

Both use Claude Haiku, not Gemini — but Haiku availability assumes Claude is working, which it is. So these layers actually work TODAY. Marked as "needs T1" in T14 only because they're exercised most meaningfully in a long Gemini-Sentinel review loop.

### 4. PART B of the acceptance test
**File:** `scripts/t14-acceptance.sh`
**Trigger:** The script's `if command -v gemini` branch.
**TODO when T1 lands:** flesh out the PART B section with live Gemini Sentinel + Scribe verifications. Suggested tests:
- Run `execute-phase 1` on the T14 calc.py project, check `.cae/metrics/sentinel.jsonl` for a valid Gemini verdict
- Invoke `Scribe.run_for_phase("1")` and verify AGENTS.md has new entries attributed to the phase
- Confirm `reviewer_model != builder_model` in every Sentinel event

## How to validate Gemini adapter works after install

Quick smoke test (should pass after T1):
```
echo 'Reply with {"status":"ok"}' > /tmp/smoke.md
bash adapters/gemini-cli.sh /tmp/smoke.md gemini-2.5-pro smoke --format json --timeout 60
cat /tmp/smoke.md.meta
# exit_code should be 0, json_valid should be true
```

If this fails, check:
- `gemini` on PATH as `cae` user
- OAuth credentials readable at `~/.config/gemini/` or wherever the CLI looks
- The adapter's exact flag syntax (some Gemini CLI releases have changed flags; the adapter may need minor tweaks — see comments in `adapters/gemini-cli.sh`)

## What Gemini is NOT needed for

- Nexus, Arch, Forge, Phantom, Aegis, Flux — all Claude
- Circuit breakers, branch guard, Telegram gate logic — Python, no LLM
- Config generation, orchestrator routing, wave execution — Python
- Compactor layer (a) turn-budget injection, (c) turn pruning, (d) caveman activation — deterministic

So about 70% of CAE is Claude+code-only. Gemini adds the cross-provider adversarial review and cheap knowledge extraction layers.

## After T1 — updating TIMELINE.md

Phase 1 completion goes from "13 done, 1 partial" to "14 full" with ~half a day of test writing (PART B of t14-acceptance.sh) and minor integration (post-phase Scribe call in `bin/cae`). No new design work.
