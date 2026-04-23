# Cycle 14 — Phase 16 split for Knowledge Layer

## Context

Phase 15 has expanded to 4 tracks (FE app + Knowledge layer + Continuous labelling + Instrumentation) + 15 visualizations + 6 personas + 7 pillars + C1-C6+ cycles. The doc already exceeds 1500 lines across 8 audit files + 5 cycle plans + the OVERHAUL-PLAN itself.

Tracks B (knowledge layer) + C (continuous labelling) form a self-contained subsystem with its own:
- Architecture (KNOWLEDGE-LAYER-DESIGN.md, 12 sections)
- Storage layer (`.cae/knowledge/edges.jsonl` + snapshot.json)
- CLI tool (memory-analyzer.ts)
- Hook integrations (post-commit, PostToolUse)
- UI rework (9 new components for /memory tab)
- Test infra
- Migration plan
- 10-wave breakdown of its own

This is a phase, not a sub-track. Mixing it with FE craft slows both.

## Decision

**Split off as Phase 16 — Knowledge Layer + Continuous Labelling.**

- Phase 15 retained scope: FE app surfaces (Tracks A + D + E from current OVERHAUL-PLAN). Includes the truth harness, instrumentation pipeline, all 15 visualization specs (E1-E15), the 6-persona × 7-pillar audit cycles. Original screenshot-truth scope preserved.
- Phase 16 new scope: Knowledge layer + continuous labelling. Self-contained 10-wave plan from KNOWLEDGE-LAYER-DESIGN.md.

## Why split is right (not premature)

1. **Independent dependencies.** Phase 16 needs: opus-4-7 for relationship extraction, file watcher, post-commit hook, PostToolUse hook for agent invocations, edge index storage, in-app graph rework. None block Phase 15 fixes.
2. **Independent tests.** Phase 16 has its own analyzer-correctness tests, edge-stability tests, migration safety tests. Doesn't share with Phase 15 capture/render/discover tests.
3. **Independent ship cadence.** Phase 16 wave 1 (file format spec + analyzer CLI) can ship next week and run dry for a week before any UI lands. Phase 15 ships continuously.
4. **Eric clarity.** "Memory was upgraded to Obsidian-grade" deserves its own phase ledger, not buried inside an FE overhaul.

## Phase 16 wave plan (verbatim from KNOWLEDGE-LAYER-DESIGN §10)

- W1: Memory file format spec finalized + JSON Schema in repo
- W2: memory-analyzer.ts CLI shipped (no UI yet)
- W3: Dry-run on existing memory files, output diff log
- W4: Human review of analyzer quality
- W5: Apply migration (add frontmatter fields, generate initial backlinks)
- W6: Ship UI rework (force-directed graph + edge types + side panel + backlinks panel)
- W7: Re-analyze button + diff preview modal
- W8: Install hooks (post-commit + cron + PostToolUse)
- W9: Monitor for 1 week, tune
- W10: Continuous labelling pipeline polish + edge index optimizations

## Coordination between Phase 15 + 16

- Both ship to /memory tab. Phase 15 doesn't touch /memory beyond data-truth annotations + visual polish. Phase 16 owns the rework.
- Phase 16 W6 (UI rework) lands AFTER Phase 15's foundation pass + Wave 2 (so it inherits the new fonts / OKLCH / sidebar / EmptyState / Skeleton / StatusPill primitives).
- Token-cost data flowing from Phase 15 Track D feeds Phase 16 analyzer cost displays.

## Add Phase 16 to roadmap

```bash
/gsd-add-phase 16 "knowledge-layer-and-continuous-labelling"
```

Then:
```bash
/gsd-research-phase 16   # KNOWLEDGE-LAYER-DESIGN.md is research; can reuse
/gsd-plan-phase 16       # break 10 waves into atomic plans
```

## Update OVERHAUL-PLAN

Phase 15 OVERHAUL-PLAN.md → strip Tracks B + C → leave note "Knowledge layer split to Phase 16."

Tracks A + D + E remain in Phase 15.

Audit cycles (C1-C6+) remain in Phase 15 only — Phase 16 has its own simpler analyzer quality cycles (extraction precision/recall, edge dedup correctness, frontmatter migration safety).

## Status of split

- [ ] Add Phase 16 to roadmap
- [ ] Update OVERHAUL-PLAN to remove Tracks B + C
- [ ] Reference KNOWLEDGE-LAYER-DESIGN.md from Phase 16 directory
- [ ] Memory file: project_cae_phase_16_knowledge_layer.md to track
