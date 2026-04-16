# CAE Phase 1 Timeline
**Date:** 2026-04-16
**Scope basis:** PHASE_1_TASKS.md R2 (LEVER removed, GSD-wrap strategy applied, Herald deferred)

## Honest estimate

**Best case:** 15 working days
**Expected:** 20 working days
**Buffered:** 25 working days (≈5 working weeks)

These numbers assume **one person working focused time** on Phase 1. Two people on independent tracks could compress to ~15 working days expected, but the wrap-prototype (T2.5) and the orchestrator core (T4–T8) are sequential dependencies, so parallelism has a ceiling.

---

## Per-task breakdown

Working-day estimates are calendar days of focused work (not wall-clock). Each day = roughly 4-6 hours of productive CAE build time, assuming other priorities exist.

| Task | Best | Expected | With buffer | Notes |
|------|------|----------|-------------|-------|
| T0 Install tmux | 0.1 | 0.1 | 0.1 | Trivial |
| T1 Install Gemini CLI + OAuth | 0.5 | 1 | 2 | Risk: headless OAuth path unknown; buffer reflects that |
| T2 Extract agent-models.yaml | 0.3 | 0.5 | 0.5 | Pure refactor |
| **T2.5 Wrap-GSD-agent prototype** | **0.5** | **1** | **2** | Buffer reflects the possibility the approach needs modification; if prototype fails, add 2-3 days to T5/T11a for re-plans |
| T3 Config schema (CONFIG_SCHEMA.md + JSON Schema) | 0.8 | 1 | 1.5 | Careful work — this is the public API |
| T4 Orchestrator skeleton (dry-run) | 1 | 1.5 | 2 | Known-shape work |
| T5 Claude Code adapter (tmux + --agent) | 1 | 1.5 | 2 | `--session-id` behavior in `--print` mode may need discovery |
| T6 Gemini CLI adapter | 1 | 1.5 | 2 | JSON reliability test happens here |
| T7 Wire adapters into execute-phase | 1.5 | 2 | 3 | Parallel coordination is fragile |
| T8 Sentinel flow (methodology port + merge gate) | 1 | 1.5 | 2 | Reduced from R1 because methodology is inherited from `gsd-verifier` |
| T9 Git branch isolation | 0.5 | 1 | 1.5 | Standard git plumbing |
| T10 Circuit breakers (6 limits) | 1 | 1.5 | 2 | Token counting depends on CLI output formats |
| T11 Telegram gate | 1 | 1.5 | 2 | Bot setup + pattern matching |
| T11a Phantom integration | 1 | 1.5 | 2 | Wrap is near-zero; integration is real work |
| T12 Automated Scribe (Gemini) | 1 | 1.5 | 2 | Dedupe/cap logic + `stop` hook wiring |
| T13 Compaction cascade (5 layers) | 2 | 2.5 | 3.5 | Layer (c) turn pruning is the risk — needs prototype |
| T14 Integration test on toy workload | 1 | 1.5 | 2.5 | First real end-to-end; expect 1-2 iterations |
| **Totals** | **~15** | **~20** | **~25** | |

---

## Buffer composition

The 5-day gap between "expected" and "buffered" reflects five distinct risk categories, not a flat multiplier:

| Risk category | Buffer days | Source |
|---|---|---|
| Gemini CLI install + OAuth on headless server | 1 | T1 unknowns |
| GSD-agent-wrap prompt coupling (T2.5 result) | 1-2 | Biggest technical risk per PIVOT_PLAN |
| Claude Code `--print` + externally-managed conversation for T13 layer (c) | 1 | Compaction cascade risk |
| Gemini JSON reliability for Sentinel (Decision 9) | 0.5 | Mitigation is wired (fallback ready), but switching consumes time |
| Integration surprises in T14 (first E2E) | 0.5-1 | Standard first-run debugging |

If Gemini CLI install turns out to be trivial AND `--agent` wrap works out of the box, the 25-day buffer is too generous — expect to finish closer to 18 days.

If the wrap prototype (T2.5) shows heavy prompt-coupling, expect to push past 25 days because multiple downstream tasks (T5, T8, T11a) need replanning.

---

## Weekly milestones (expected case)

Working in 5-day blocks. "Week 1" starts when work begins, not calendar-aligned.

### Week 1 — Foundation + prototype (target: 5 working days)
- T0, T1, T2, T2.5, T3
- **End-of-week state:** Gemini CLI working. `config/agent-models.yaml` in use. Schema published. **T2.5 prototype result determines whether wrap-heavy approach holds.**
- **Go/no-go checkpoint:** if T2.5 failed, re-plan Weeks 2-4 before proceeding.

### Week 2 — Orchestrator core (target: 5 working days)
- T4, T5, T6, T7
- **End-of-week state:** `cae execute-phase` runs real subprocesses. Both adapters work. One-task workload flows end-to-end without safety layer.
- **Go/no-go checkpoint:** if parallel coordination fights us (T7), pull scope back to sequential-only, document upgrade path to Phase 2.

### Week 3 — Safety layer (target: 5 working days)
- T8, T9, T10, T11
- **End-of-week state:** Sentinel JSON flow works. Branches isolated. Circuit breakers wired. Telegram gates fire.
- **Go/no-go checkpoint:** if Gemini JSON is unreliable, switch Sentinel to fallback (`gsd-verifier` wrap). Budget half a day.

### Week 4 — Polish + acceptance test (target: 5 working days)
- T11a, T12, T13, T14
- **End-of-week state:** Phantom integrated. Scribe automated. Compaction cascade in place. **Toy workload runs end-to-end; Phase 1 acceptance criteria met.**
- **Go/no-go checkpoint:** Phase 1 passes → move to Phase 2 planning. Phase 1 has issues → iterate on T14 failures until acceptance.

### Week 5 (buffer) — Iteration / spillover
- Only used if earlier weeks hit risks.
- If unused: start Phase 2 planning, revisit LEVER redeployment as a candidate workload.

---

## What's explicitly NOT on this timeline

- **Shift integration.** Schema is published, but wiring Shift → CAE is post-Phase-1.
- **LEVER redeployment.** Phase 2 candidate, not Phase 1.
- **Herald role build.** Phase 2.
- **GitHub push of CAE repo.** Waits until Phase 1 passes.
- **Multi-project support.** Phase 2.

---

## If you want to know the single number

**Plan for 20 working days.**

If it lands at 15, great — bank the extra days for Phase 2 or a breather. If it pushes to 25, the buffer is there.

If at day 10 we're still in Week 1 tasks, **something is wrong with the decomposition, not with the plan.** Stop and replan — don't push through.

End of TIMELINE.md.
