# Phase 3 UI Spec — pointer to project UI-SPEC

**Status:** see canonical spec at `docs/UI-SPEC.md`

Phase 3 implements foundation-layer sections of the project-wide UI-SPEC. The planner and executors MUST read `docs/UI-SPEC.md` in full, with particular focus on:

- **§1 Global chrome** — top-bar layout (implement this phase)
- **§13 Visual system** — colors, typography, motion (implement this phase — tokens only; components consume in later phases)
- **§S4.1 Mode toggle rename** — Plan / Build labels (implement this phase)
- **§S4.2 Memory + Metrics global icons** — top-bar (implement this phase)
- **§S4.6 Screen shake + explain-mode** — providers + hook (implement this phase)
- **§S4.7 Phase 2.5/3 consequences** — full scope list for this phase
- **§Audience reframe** — founder-speak translation tables (apply this phase)
- **§Dev-mode toggle spec** — DevModeProvider spec (implement this phase)

Other sections (§3 Ops Home, §6 Agents, §7 Workflows, §8 Metrics, §9 Memory, §10 Changes, §11 Live Floor, §12 Chat) are **out of scope** for Phase 3 — they are consumed by later phases (4-12).

---

## Delta from canonical spec — none

No phase-specific deviations. Implement sections above verbatim.

## Open visual decisions for planner

- Cubic-bezier curve for 150ms transitions (default `ease-out` acceptable; custom not required)
- Tooltip styling for explain-mode (shadcn `Tooltip` acceptable)
- Exact badge styling for "dev" indicator (cyan pill outline acceptable)

---

*All other design questions → answer from `docs/UI-SPEC.md`. If the spec doesn't answer, flag in plan review.*
