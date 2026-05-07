# Phase 17 Architecture — Post-Phase Hook Design

## Hook Point Decision: **Post-Scribe (Option B)**

**Why this timing:**
- ✅ All phase work complete (Forge built, Sentinel reviewed, Scribe extracted learnings)
- ✅ SUMMARY.md is written (phase closure is final)
- ✅ No risk of re-running Herald on aborted phases (happens after completion, not before)
- ✅ Docs reflect current AGENTS.md state (Scribe already updated it)
- ❌ Alternative A (post-Sentinel): too early, skips Scribe learnings
- ❌ Alternative C (post-merge): overkill, main already has changes

**Phase workflow with hook:**
```
Forge finishes → Sentinel reviews → Scribe extracts → SUMMARY.md written
                                                            ↓
                                                    [POST-PHASE HOOK]
                                                    herald README
                                                    herald ARCHITECTURE
                                                    herald CHANGELOG
                                                    git push origin main
                                                            ↓
                                                    Phase complete ✅
```

## Execution Mechanism: **Shell Script (.planning/hooks/post-phase-complete.sh)**

**Why shell, not CAE builtin:**
- Herald is a separate tool (`cae herald` wrapper or standalone)
- Git push is CLI-based (not part of CAE orchestration)
- Decoupled = testable independently
- Easy to retry manually if network fails
- POSIX-portable (runs on any CI/CD system)

**Script location:** `.planning/hooks/post-phase-complete.sh`
**Trigger:** After SUMMARY.md written in .planning/phases/NN-*/SUMMARY.md
**Owner:** Timmy (manual trigger) or CI/CD (automated)

## Error Handling

| Scenario | Exit Code | Behavior |
|----------|-----------|----------|
| All succeed | 0 | Continue, phase complete |
| Herald README fails | 1 | Print error, **block git push**, manual fix required |
| Herald ARCHITECTURE fails | 1 | Print error, **block git push**, manual fix required |
| Git push auth fails | 2 | Print error, **block** (user must fix SSH auth), retry cmd provided |
| Git push network timeout | 3 | Print error, **block**, user can retry |
| Both fail | 1 or 2 | Print all errors, user fixes and re-runs |

**Rationale:** Herald + git push are linked — if Herald generates bad markdown, we must NOT push. User intervention required. Better to fail loud than ship broken docs.

## Git Push Integration

**Timing:** After Herald succeeds
**Branch:** Always `origin main` (docs always push to main, never to phase branches)
**Config:** SSH key at `/home/timmy/.ssh/cae_deploy_key` (from memory: deploy key for `git@github.com-cae`)

**SSH config entry (must exist):**
```
Host github.com-cae
    HostName github.com
    IdentityFile ~/.ssh/cae_deploy_key
    IdentitiesOnly yes
```

**Git remote:** `git@github.com-cae:notsatoshii/CAE.git`

**Verification:** Script tests SSH access before push:
```bash
ssh -i ~/.ssh/cae_deploy_key -T git@github.com-cae 2>/dev/null && echo "SSH OK" || echo "SSH FAIL"
```

## Docs Auto-Generated

### 1. README.md
**Content:** Project overview, setup, quick start, roadmap status
**Updated by Herald:** Phase completion section + latest phase summary
**Source:** Phase status from ROADMAP.md + latest SUMMARY.md

### 2. ARCHITECTURE.md
**Content:** System design, component overview, key decisions
**Updated by Herald:** Current state + Phase NN link + recent changes
**Source:** AGENTS.md + current phase PLAN.md + SUMMARY.md

### 3. CHANGELOG.md (optional, Phase 2)
**Content:** Timeline of major milestones + phase summaries
**Updated by Herald:** Append latest phase with date + summary
**Source:** All SUMMARY.md files (reverse chronological)

## Implementation Checklist

- [ ] Task 2: Write `.planning/hooks/post-phase-complete.sh`
- [ ] Task 2: Test on Phase 16 (already closed)
- [ ] Task 3: Add hook path to `.planning/config.json` (create if missing)
- [ ] Task 3: Document pattern in AGENTS.md
- [ ] Task 3: Phase 18+ runs with hook wired

## Failure Recovery

**If Herald fails:**
```bash
# User fixes AGENTS.md or ROADMAP.md
vim dashboard/AGENTS.md
# Re-run Herald manually
cae herald README && cae herald ARCHITECTURE
# Verify output, then push
git push origin main
```

**If git push fails:**
```bash
# Check auth
ssh -T git@github.com-cae
# If key expired, re-add to agent
ssh-add ~/.ssh/cae_deploy_key
# Retry
git push origin main
```

## Success Criteria

✅ Script runs without error on Phase 16
✅ README + ARCHITECTURE updated with fresh content
✅ Commit message clear ("docs(phase-17): Herald auto-update")
✅ origin/main reflects local state
✅ Next phase wired to run hook automatically
