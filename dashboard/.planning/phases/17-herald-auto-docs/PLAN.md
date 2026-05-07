---
phase: 17
plan: Herald auto-docs integration — fresh docs on every phase
wave: 1
name: Phase 17 Wave 1 — Post-Phase Hook + Git Push
---

<task id="1" owner="ARCH">
### Task 1: Design post-phase execution hook

**Input:**
- ROADMAP.md lines 402-409 (Herald requirement)
- Current phase completion workflow (no hooks yet)
- CAE phase structure (.planning/phases/NN-*/SUMMARY.md)

**Deliverable:**
ARCHITECTURE-amendments.md covering:
1. **Hook point:** Where in the phase workflow do we run Herald?
   - Option A: Post-Sentinel (after review approval, before merge)
   - Option B: Post-Scribe (after learnings extraction)
   - Option C: Post-merge-to-main (after phase branch merged)

2. **Execution mechanism:**
   - Shell script wrapper or CAE builtin?
   - Error handling if Herald fails (block vs warn vs continue)
   - Parallelizable with other post-phase tasks?

3. **Git push integration:**
   - When does `git push origin main` run? (same hook, separate?)
   - SSH config validation (github.com-cae deploy key)
   - Failure modes (network down, auth failed, merge conflict)

4. **Docs to auto-generate:**
   - README.md (project overview, phase status)
   - ARCHITECTURE.md (system design, current state)
   - CHANGELOG.md (recent phase summaries + dates)

**Acceptance:**
- Hook point decided + documented
- Execution mechanism chosen (shell vs builtin)
- Error handling defined
- Git push timing locked in
</task>

<task id="2" owner="FORGE">
### Task 2: Implement post-phase hook (shell script)

**Input:**
- Architecture decision from Task 1
- Herald CLI (`cae herald <doc-type>`)
- Phase completion flow (Sentinel review → merge → next phase)

**Change:**
1. Create `.planning/hooks/post-phase-complete.sh`
   - Run after SUMMARY.md written
   - Execute: `cae herald README && cae herald ARCHITECTURE && git push origin main`
   - Exit codes: 0 (success), 1 (herald failed), 2 (git push failed)

2. Wire into CAE workflow:
   - Call from phase completion script (TBD: which one?)
   - OR: Add to `SUMMARY.md` as final task
   - OR: Manual trigger from Timmy after verifying phase

3. Test cases:
   - Happy path: both commands succeed
   - Herald fails (bad syntax in docs): script exits 1, push blocked
   - Git push fails (auth denied): script exits 2, manual retry
   - Network down: both fail, manual retry possible

**Test:**
- Run on a completed phase (Phase 16)
- Verify README/ARCHITECTURE refreshed
- Verify commit pushed to origin
- Check git log for Herald changes

**Acceptance:**
- Script runs without error on Phase 16
- README + ARCHITECTURE updated with fresh data
- Main branch updated on origin
- Script handles errors gracefully
</task>

<task id="3" owner="SCRIBE">
### Task 3: Wire Herald into CAE phase state machine

**Input:**
- Post-phase hook from Task 2
- Current phase execution flow
- CAE binary (claude --print --agent gsd-*)

**Change:**
1. Update `.planning/config.json` (if exists) or `.planning/phase-template.md`:
   - Add `post_phase_hook: .planning/hooks/post-phase-complete.sh`
   - Document timing (when it runs relative to Sentinel/Scribe)

2. Inline hook documentation in PLAN.md templates:
   - Add note: "Post-phase: Herald auto-docs + git push origin main"
   - Link to `.planning/hooks/post-phase-complete.sh` for impl details

3. Update AGENTS.md with Herald pattern:
   - When does Herald run? (post-phase, timing)
   - What docs does it update? (README, ARCHITECTURE, CHANGELOG)
   - Failure modes and recovery

**Test:**
- Next phase (Phase 18+) runs with hook wired
- Verify README updated after phase completion
- Verify git push successful

**Acceptance:**
- Config reflects post-phase hook
- Pattern documented in AGENTS.md
- Next phase runs with Herald auto-update
</task>
