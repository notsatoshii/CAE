# Session 11 → 12 Handoff

**Date end:** 2026-04-23 (session 11)
**Session length:** ~45min wall-clock, 4 commits on main, pushed
**Model:** Claude Opus 4.7 (1M context)

---

## TL;DR

Session 10's open items resolved. New Pikachu loader swapped (Eric re-
spec'd the pen). Vision scorer unblocked via `claude -p` CLI shellout —
smoke-test returned real scores against real captures. Herald post-
commit hook installed (debounced 15min, source-only, background). C2
cycle re-run: first attempt OOM'd the dev server; rerun clean 408/408.

**Session 12 main finding (inherit):**
Truth pillar is still 1.00 across all 408 cells *despite* annotations
now rendering. Root cause: runner screenshots pages while SSE streams
still in `loading` state, but fixture `readExpectedTruth()` encodes
post-fetch healthy values. Fix: `waitForSelector('[data-truth*="healthy"]')`
with a bounded timeout fallback. Expected post-fix: truth 1→4+ on most
cells. Task #6 in TaskList.

---

## Read first (in order)

1. This file.
2. `git log --oneline -10` from repo root.
3. `dashboard/audit/reports/C2-DELTA.md` — 396 improvements, 1 regression.
4. `dashboard/audit/reports/C2-SCORES.md` top rollup.
5. `/root/.claude/projects/-root/memory/project_cae_dashboard_session11.md`.

---

## What shipped (4 commits, pushed)

| commit | change |
|--------|--------|
| `cf8f77f` | feat(loading): swap cursor-trail port for arrow-key Pikachu pen |
| `0819f71` | feat(audit/vision): add claude -p CLI transport for Max-plan users |
| `f61be81` | chore(hooks): add Herald post-commit hook for auto-docs |
| `7c52364` | audit(C2): baseline re-run after annotation wave — 396 pillar lifts |

### Loader swap (cf8f77f)
Eric re-spec'd: arrow-key-controlled Pikachu replaces cursor-trail pen.
Implementation matches the pasted CodePen: right arrow +25px, left arrow
−25px, translateX on pikachu gif. Dropped RotatingVoice since the pen
has no voice layer. 6/6 tests pass.

### Vision scorer unblocked (0819f71)
api.anthropic.com rejects OAuth tokens so users on Max plan with no
separate API key couldn't run vision. New path: `scoreWithVision` shells
out to `claude -p --model claude-opus-4-7 --output-format json <prompt>`
with the PNG attached via `@path`. Parses the `result` envelope field as
ScoreResult JSON. Routing: `useCli` opt → `AUDIT_VISION_USE_CLI=1` env →
auto-on if no API key. Cache / budget / dry-run unchanged.

**Smoke test (validated):** Ran one cell against live capture:
```
score: 2
evidence:
  - Dense list of gold/red status pills with identical styling — reads as log dump, no hierarchy
  - Row labels cramped against left edge, no column headers or grouping
  - Saturated yellow + red badge combo on dark bg looks harsh, not Linear-muted
recommendations:
  - Group skills by category with section headers, add column labels
  - Desaturate badge palette — use subtle tonal chips, not full-bleed yellow/red
  - Add row dividers + consistent left padding so labels align with nav gutter
```

### Herald post-commit hook (f61be81)
`.githooks/post-commit` + `core.hooksPath=.githooks`. On each commit:
filters docs-only paths (`.planning/`, `docs/`, `audit/reports`, shots,
lockfiles), debounces 15min, fires `cae herald changelog --auto --fast`
in background. Opt-out via `CAE_SKIP_HERALD=1`. Logs at
`.planning/herald/logs/herald-post-commit-<ts>.log`. README + ARCHITECTURE
are NOT auto-regenerated per commit (too expensive); run separately via
cron (not yet installed).

### C2 cycle (7c52364)
Rollup deltas vs C1:

| pillar | C1 | C2 | notes |
|--------|------|------|-------|
| reliability | 3.98 | 4.95 | no more NavigationError floor |
| depth | 1.00 | 2.65 | annotations reading |
| liveness | 1.00 | 1.33 | small bump — loading-state capture |
| truth | 1.00 | 1.00 | STUCK — see session-12 finding |
| voice | 5.00 | 5.00 | clean |
| craft | 3.00 | 3.00 | needs vision run (now unblocked) |
| ia | 3.00 | 3.00 | needs clickwalk run |

396 improvements, 1 regression (`/signin·founder-first-time·laptop`
reliability 5→3, investigate).

---

## OOM gotcha (important for anyone re-running C2+)

First C2 playwright run crashed the Next dev server at ~4min in —
`oom-killer` in dmesg at 17:32:55. 15GB RAM, 0 swap, 4 parallel
playwright workers hammering Turbopack SSR = eventual OOM.

Mitigations for future runs:
- **Easiest**: add swap (`sudo fallocate -l 8G /swap && mkswap && swapon`)
  before running full C2+.
- Reduce workers: `AUDIT_WORKERS=2 audit/run-cycle.sh ...` (config
  currently hardcoded at 4 in `playwright.config.ts`; the env var is
  read by the config).
- Or accept the risk and rerun on failure (second attempt worked clean).

---

## BLOCKERS needing input

### BLOCKER 1: Vision retro-run across all 408 cells
Infrastructure ready. Command:
```bash
cd /home/cae/ctrl-alt-elite/dashboard
AUDIT_VISION_USE_CLI=1 AUDIT_VISION_BUDGET_USD=500 \
  npx tsx audit/vision-run.ts C2 --fixture healthy
```
One cell = ~26s CLI. 408 cells serial = ~3hr. Parallelise with a
wrapper (e.g. `xargs -P 4`) to hit ~45min. Eric's directive: speed +
quality over cost. Counts against Max plan quota.

Output: merges craft scores into `C2-SUMMARY.json`, regenerates
`C2-SCORES.md`, writes `C2-VISION-FINDINGS.md` (worst-craft cells +
LLM reasons). This is the gold.

### BLOCKER 2 (passive): Pixel-agents broken on FE
Live Floor canvas (components/floor/floor-canvas.tsx) renders from SSE
/api/tail of circuit-breakers.jsonl. "Broken" likely means cbPath=null
→ idle scene, or SSE not emitting. Needs specific repro from Eric:
which route, which persona, expected vs actual. Alternatively, visual
audit from C3+ will surface it.

---

## Next session priorities (do in this order)

1. **Fix truth-stuck finding (TaskList #6)** — runner `waitForSelector
   [data-truth*="healthy"]` with bounded timeout fallback. This
   unblocks truth pillar fully. Expected C3: truth 1→4+.
2. **Vision retro-run on C2** — see Blocker 1. Parallelise 4-way.
3. **Investigate regression** — `/signin·founder-first-time·laptop`
   reliability 5→3. Single cell, shouldn't take long.
4. **C3 cycle** — after truth-fix + vision, run next cycle:
   ```bash
   audit/run-cycle.sh C3 healthy --prior C2 --vision
   ```
5. **Swap in** for `claude -p` on live captures where necessary; CLI
   path is preferred on this box (no ANTHROPIC_API_KEY).
6. **Consider adding swap** before next long run to avoid OOM.

---

## Current working tree

```
 M dashboard/next-env.d.ts  ← auto-gen, Next 16 swapped .next/types → .next/dev/types; ignore
```

All committed work pushed to origin/main at HEAD `7c52364`.

---

## Key paths (session 12 cheat sheet)

```
# Harness (unchanged from session 10)
dashboard/audit/run-cycle.sh
dashboard/audit/vision-run.ts
dashboard/audit/score/llm-vision.ts     ← now supports CLI transport
dashboard/audit/reports/C2-*.md
dashboard/audit/runner.spec.ts:86      ← waitForSelector fix lands here
dashboard/audit/fixtures/healthy.ts     ← readExpectedTruth expected values

# Hook
.githooks/post-commit                   ← Herald dispatcher
.planning/herald/logs/                  ← herald run logs

# Dev server
pnpm dev → http://localhost:3002        ← must be up before audit/run-cycle.sh
```

End of handoff.
