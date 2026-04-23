# Cycle 22 — Phase 15 Close-out Criteria

Without explicit stop conditions, audit→fix→re-audit cycles can loop forever. This document locks the conditions under which Phase 15 is "done."

## Hard close criteria (all must be ✓)

1. **All 7 pillars × 6 personas score ≥ 4** on every route in the route inventory (per audit/reports/Cn-SCORES.md heatmap). 
2. **0 console errors / 0 React warnings / 0 SSR mismatches** captured during Cn baseline run with healthy fixture.
3. **All 15 visualization specs (E1-E15) shipped** (Mission Control, Floor pin, token gauge, cost donut, model bars, build-history flame, workflow flowchart, memory-graph-v2 [Phase 16], skills-deps tree, audit heatmap, Floor enhancements, phase-progress radial, contributions square, queue waterfall, test pass-rate strip).
4. **Eric live walkthrough passes** — Eric drives, says "yes this is the dashboard I wanted." Captured as Cn EWALK-LOG.md.
5. **3-layer test coverage gates pass** per TEST-PLAN.md: capture tests + render tests + discover tests all green.
6. **Performance budgets met** per TEST-PLAN.md: Lighthouse Perf≥90, A11y=100, BP≥95, LCP<2.5s.
7. **Bundle delta ≤ +30KB gzipped per wave** cumulative.

## Soft close criteria (encourage stop, don't block)

8. Wave 1 through Wave 9 implementation done (Phase 16 has its own close-out)
9. INSTRUMENTATION-AUDIT TODO matrix has 0 RED, ≤2 YELLOW
10. DETAIL-EXPAND-AUDIT field-utilization average ≥ 80% (currently 52%)
11. KANBAN-COLUMNAR-AUDIT severity matrix has 0 high
12. LIVE-FLOOR-AUDIT 3 P0 bugs resolved + sprite kit shipped
13. Memory-graph audit Obsidian-gap count ≤ 2 (Phase 16 closes the rest)

## Hard close blockers (override soft criteria)

A. Eric explicitly says "ship phase 15, move on" — overrides all
B. Any pillar × persona score regresses 2+ levels between Cn and Cn+1 — must stabilize before close
C. Any UAT-detected bug rated "kills trust" by Eric — must fix before close

## Stop-the-loop conditions per cycle

After each Cn capture run produces SCORES.md:
- if all hard ✓ → Phase 15 closed, write CLOSE-OUT.md
- if any pillar × persona < 4 → run wave-fix targeting the lowest-cell, then re-capture (Cn+1)
- if same pillar × persona stuck < 4 across 3 consecutive cycles → escalate to Eric for guidance (don't endless-iterate)
- if Cn+1 regresses any prior-passing pillar → revert the latest wave + investigate before re-trying

## Cycle ceiling

No predetermined ceiling per Eric's "C7+ cycles until none are ≤ 3" mandate. But:
- Every 3 cycles: write a CYCLE-RETROSPECTIVE.md noting which fixes had biggest score lift, which had none, what the methodology missed
- Every 6 cycles: bring methodology back to Eric for re-validation
- Cumulative wall time per cycle: target ≤ 1 calendar day end-to-end (capture → score → fix wave → re-capture). If cycles take longer, parallelize agents harder

## Phase 15 → Phase 16 → Phase 17 boundary

- **Phase 15:** FE app surfaces + truth harness + visualizations + audit cycles
- **Phase 16:** Knowledge layer (memory format + analyzer agent + graph rework + continuous labelling) — separate ship cadence
- **Phase 17:** "Polish + scale" — anything Phase 15+16 deferred (e.g. real sprite kit commission, anomaly detection ML, Sentinel daemon, GSD breaker schema fixes)

When Phase 15 hits hard-close, do NOT roll into Phase 16 work in same phase ledger — start fresh Phase 16 cycles with their own scoring.

## Close-out artifact

`CLOSE-OUT.md` produced when phase closes:
- Final scores per pillar × persona (heatmap)
- Wave list with commit-shas
- Outstanding deferrals (with target phase)
- Eric quote / sign-off
- Test coverage final number
- Performance final number
- Visual delta gallery (before/after PNGs from Cn baseline vs final)
