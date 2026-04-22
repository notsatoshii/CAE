# Phase 12 — Context & Decisions

**Phase:** 12-command-palette-polish-empty-states
**Synthesised:** 2026-04-23 (no /gsd-discuss-phase was run; Claude's Discretion from 12-RESEARCH.md promoted to locked decisions)
**Last phase shipped:** Phase 9 (2026-04-23). Phases 10 + 11 not yet started; Phase 12 is greenlit out-of-order at Eric's direction because Mission Control reference recommended pulling ⌘K forward. Phase 12 scope does NOT depend on Phase 10 (Plan mode) or Phase 11 (Live Floor) output.

## Vision

Phase 12 is the **polish phase** — no new surface area. Six work-threads land in this phase: ⌘K command palette (primary), first-class `<EmptyState>` component, `?` keyboard-shortcut overlay backed by a single keybinding registry, accessibility audit (zero serious/critical axe findings), `prefers-reduced-motion` audit covering all 13 `animate-*` offenders, and an explain-mode copy QA pass across the 9 `<ExplainTooltip>` call sites.

The palette is built on `@base-ui/react` `Combobox` (already installed — 1.4.1) + `fuzzysort@3.1.0`. No `cmdk`, no `kbar`. This keeps Phase 3's base-ui hard-lock intact and avoids the `asChild` anti-pattern codified in AGENTS.md.

## Decisions (LOCKED — sourced from RESEARCH Claude's Discretion + ROADMAP + UI-SPEC)

### Palette
- **D-01** — Palette library: `@base-ui/react` `Combobox` + `Dialog` for the modal shell. No new palette dep. Sources: RESEARCH §Standard Stack; AGENTS.md Gotchas #2 (no `asChild` on base-ui — use `render={...}`).
- **D-02** — Fuzzy ranker: `fuzzysort@3.1.0`. Multi-key over `[label, hint]`. `threshold: -10000`. Chosen for 45KB unpacked (vs fuse.js 312KB) and first-char/tight-match bonuses without typo tolerance we don't need. Source: RESEARCH §Alternatives.
- **D-03** — Palette trigger: `⌘K` (mac) / `Ctrl+K` (windows/linux). Guard: no-op when `isEditableTarget()` fires (mirror `ExplainModeProvider` pattern in `lib/providers/explain-mode.tsx:14-20`).
- **D-04** — Palette index is built ON OPEN, not at mount. 5-source `Promise.all`: `/api/state` (projects + active phases) · `/api/queue` (tasks) · `/api/agents` (agents) · `/api/workflows` (workflows) · `/api/memory/tree` (memory nodes). Plus a static `COMMANDS` list. Avoids duplicating existing SSE/poll streams.
- **D-05** — Palette groups (6): **Projects · Tasks · Agents · Workflows · Memory · Commands**. Per UI-SPEC §14 Command palette + ROADMAP Phase 12.
- **D-06** — Navigation actions use Next `router.push()` (not `window.location`) so middleware guards fire. Source: RESEARCH §Security Domain.
- **D-07** — Palette item shape (locked TS contract):
  ```ts
  interface PaletteItem {
    id: string;                    // unique: "project:cae-dashboard" / "agent:forge" / etc.
    group: "projects" | "tasks" | "agents" | "workflows" | "memory" | "commands";
    label: string;                 // primary display; founder-speak if applicable
    hint?: string;                 // secondary one-liner under label (fuzzy key #2)
    icon?: LucideIcon;             // lucide-react glyph
    run: () => void;               // closes palette + executes
  }
  ```
- **D-08** — Palette keyboard contract inherited from `Combobox` out-of-box: ↑/↓ to navigate, Enter to execute, Esc to close. Additionally: Tab/Shift+Tab move between groups. No custom key handler required beyond `⌘K` toggle.

### Empty states
- **D-09** — Introduce `<EmptyState>` primitive at `components/ui/empty-state.tsx`. Variants: `"empty"` | `"error"`. Never used for loading (existing skeleton pattern stays). Exact API per RESEARCH §Code Examples.
- **D-10** — Empty-state copy lives in `lib/copy/labels.ts` FOUNDER + DEV blocks. The `Labels` TS interface enforces parity — adding a key to FOUNDER without DEV (or vice-versa) fails tsc.
- **D-11** — Page-level empty-state surface mapping (per RESEARCH §Empty states per page):
  | Route | Empty condition | Action buttons |
  |-------|-----------------|----------------|
  | `/build` | no active phases AND no recent | [Go to Plan] [New job] |
  | `/build/agents` | `agents.length === 0` | [Send a job] |
  | `/build/workflows` | `workflows.length === 0` | [New recipe] |
  | `/build/queue` | all 5 columns empty | [New job] [Open Workflows] |
  | `/build/changes` | Phase 9 shipped; only needed if project filter matches nothing | [Clear filter] |
  | `/metrics` | panel has no samples | [Send a test job] |
  | `/memory` Browse | tree empty | [Regenerate graph] |
  | `/memory` Graph | no graph.json | already present — migrate into `<EmptyState>` |
  | `/plan` | Phase 10 stub | [Go to Build] |

### Shortcut overlay
- **D-12** — `?` opens `<ShortcutOverlay>` modal (base-ui `Dialog`). Guard: `isEditableTarget()` — matches existing provider pattern.
- **D-13** — Second trigger: keyboard-only is a poor founder affordance (RESEARCH Open Q2). Add a `?`-labelled `<button>` in the top nav between `ChatPopOutIcon` and the `HeartbeatDot` divider. Lucide `HelpCircle` icon, 16px.
- **D-14** — **Single source of truth for keybindings: `lib/keybindings.ts`.** Both the overlay AND the providers read from this one list. Providers must NOT hardcode keys. Contract:
  ```ts
  export interface Keybinding {
    id: string;
    keys: readonly string[];           // rendered as kbd badges
    area: "global" | "sheets" | "task" | "palette";
    founderLabel: string;
    devLabel: string;
  }
  export const KEYBINDINGS: readonly Keybinding[];
  ```
- **D-15** — Overlay renders `founderLabel` when ExplainMode is ON (default), `devLabel` when DevMode is ON. Both ON → still founder (founder first, UI-SPEC Audience reframe).

### Accessibility
- **D-16** — Audit tooling: `@axe-core/cli@4.11.2`. Script `scripts/audit-a11y.sh` wraps `npx @axe-core/cli http://localhost:3000/<route>` over the 10 registered routes (`/`, `/build`, `/build/agents`, `/build/workflows`, `/build/queue`, `/build/changes`, `/metrics`, `/memory`, `/plan`, `/chat`). Gate: zero `impact: serious` AND zero `impact: critical` violations.
- **D-17** — Skip `@axe-core/react` (runtime dev-mode checker). Script-based audit is reproducible + CI-able. `@axe-core/cli` accepts dev-server URLs (verify this assumption Wave 0 — RESEARCH §Assumption A4).
- **D-18** — axe palette audit runs palette OPEN and CLOSED separately. If base-ui virtual-list IDs churn after OPEN, exclude `[data-combobox-scroll]` per RESEARCH §Pitfall 5.

### Motion
- **D-19** — Single CSS safety net in `app/globals.css` (added after the existing `.cae-shaking` block):
  ```css
  @media (prefers-reduced-motion: reduce) {
    .animate-pulse, .animate-spin, .animate-ping, .animate-bounce { animation: none !important; }
  }
  ```
  Covers all 13 offenders documented in RESEARCH §Motion Audit. Future `animate-*` additions inherit the guard.
- **D-20** — Assumption A3 (`tw-animate-css@1.4.0` auto-emits reduced-motion overrides for `animate-in`/`slide-in`/`fade-in`/`zoom-in`) is verified Wave 0 via DevTools emulation on `components/ui/dialog.tsx` and `components/ui/dropdown-menu.tsx`. If it does NOT auto-emit, add per-utility rules.

### Explain-mode copy QA
- **D-21** — Scope: 9 `<ExplainTooltip>` call sites (addresses listed in RESEARCH §Explain-mode Copy QA inventory). Verify each `text` prop resolves to a key in BOTH `FOUNDER` + `DEV` blocks of `labels.ts`. Script: `scripts/verify-explain-keys.sh` (ripgrep + `node -e` label lookup).
- **D-22** — Spot-check pass (NOT a rewrite): every founder copy must pass "would a PM understand this without a dev next to them" (UI-SPEC Audience reframe). If any founder string is jargon-dense (raw dev vocabulary: SHA, merge, wave, token), rewrite it in-place. Dev copy stays technical.

### Wave structure
- **D-23** — **Wave 0 before everything else.** Research-flagged gaps (test scaffolds missing, `KEYBINDINGS` registry not enumerated, motion safety net not applied, a11y script not written) are hard blockers. Wave 0 does them in parallel.
- **D-24** — ⌘K is pulled into Wave 1 alongside `<EmptyState>` + shortcut overlay. Rationale: Mission Control notes say surface ASAP; ⌘K has NO dependencies beyond Wave 0 (index sources all ship from Phases 2-9 already). Three plans run parallel in Wave 1 with zero files_modified overlap.
- **D-25** — Wave 2 is integration + audit: mount palette + trigger + overlay into `app/layout.tsx` and `components/shell/top-nav.tsx`; wire `<EmptyState>` into the 8 surfaces from D-11; run axe + motion + explain-QA scripts; fix violations.

### Scope hard-locks (from ROADMAP + RESEARCH)
- **D-26** — Tokens only, no USD. Founder-speak defaults, dev-mode opt-in. Dark theme, Tailwind v4, base-ui — Phase 3 hard locks inherited.
- **D-27** — FINAL phase before Phase 13 review loop. No new features beyond the six work-threads listed above.
- **D-28** — Phase 10 (Plan mode) + Phase 11 (Live Floor) are NOT shipped when Phase 12 executes. Palette navigates to `/plan` stub (current page) + omits Live Floor entirely. Phase 9 IS shipped → Chat is a reachable target; palette includes "Open chat" as a command.

## Requirements (derived for this phase — no REQUIREMENTS.md yet)

Requirement IDs follow `<cluster>-<nn>` shape matching Phase 9's style.

**PALETTE cluster**
- **PAL-01** — ⌘K (Cmd+K / Ctrl+K) opens the command palette. No-op when focus is in an editable target.
- **PAL-02** — Palette index populated from 5 live sources + static commands on open; falls back gracefully when a source fetch fails (log, continue, omit that group).
- **PAL-03** — Fuzzy ranker ranks prefix matches above contains matches above fuzzy matches (verified via `fuzzysort.go()` behavior).
- **PAL-04** — Selecting an item calls `.run()` and closes the palette. Navigation items use `router.push()`.
- **PAL-05** — Empty query shows all 6 groups (Projects · Tasks · Agents · Workflows · Memory · Commands).
- **PAL-06** — No matches render `<Combobox.Empty>` with founder-speak "No matches. Try a different word."
- **PAL-07** — Palette closes on Esc. Focus returns to the previously focused element.
- **PAL-08** — Top-nav `?` button + `?` keystroke both open the shortcut overlay. Overlay lists all `KEYBINDINGS`, grouped by `area`, showing founder OR dev labels based on mode.

**EMPTY cluster**
- **EMP-01** — `<EmptyState>` renders heading + optional body + optional actions + optional hero icon (lucide 48px).
- **EMP-02** — Each of the 8 empty surfaces from D-11 uses `<EmptyState>`. Ad-hoc empty `<div>`s removed.
- **EMP-03** — Every empty-state copy string lives in `labels.ts` FOUNDER + DEV blocks; tsc enforces parity.

**SHORTCUT cluster**
- **SHO-01** — `lib/keybindings.ts` is the single source of truth. Providers import their keys from `KEYBINDINGS` by `id`.
- **SHO-02** — Overlay lists keys from `KEYBINDINGS` verbatim; no hardcoded strings.

**A11Y cluster**
- **A11Y-01** — `scripts/audit-a11y.sh` exits 0 (zero serious/critical violations) across all 10 audited routes.
- **A11Y-02** — Palette is keyboard-navigable top to bottom (Tab, ↑/↓, Enter, Esc). `aria-activedescendant` provided by base-ui.
- **A11Y-03** — Shortcut overlay has `role="dialog"` + `aria-labelledby`. Focus trapped on open, returned on close.

**MOTION cluster**
- **MOT-01** — `@media (prefers-reduced-motion: reduce)` disables all four `animate-{pulse,spin,ping,bounce}` utilities project-wide via one CSS block.
- **MOT-02** — `tw-animate-css` `animate-in`/`slide-in`/`fade-in`/`zoom-in` verified to respect reduced-motion. If not, per-utility rules added.
- **MOT-03** — `.cae-shaking` reduced-motion guard (already present) remains intact and tested.

**EXPLAIN-QA cluster**
- **EQA-01** — Every `<ExplainTooltip text={L.key}>` resolves to a `Labels` key present in BOTH `FOUNDER` + `DEV`. Script `scripts/verify-explain-keys.sh` enforces.
- **EQA-02** — Founder copy for all 9 call sites passes the "PM would understand without a dev" test (human pass during Wave 2).

## Deferred Ideas (OUT OF SCOPE)
- Multi-user, cloud deploy, mobile apps, plugin API, billing, advanced metrics drill-downs (from ROADMAP §What we'll defer).
- Project-scoped palette routes (RESEARCH Open Q1 — deferred to v2; palette routes are global, "Open {project-name}" is a separate group item today).
- Mission Control's ⌘K-in-top-bar visual (centred search field). We ship `⌘K` as keystroke + palette trigger ONLY. Visual top-bar search bar deferred to Phase 13's UI review.
- Natural-language cron / Incident Stream / Golden Signals framing / role-based access — Phase 13+ candidates.

## Open questions parked for Phase 13 review
1. Should the top nav add a visible `⌘K` chip-button next to the `?` button? (Parked — Phase 13 decides.)
2. Should empty states include a secondary "Why is this empty?" link wiring into the Phase 8 Why-trace? (Deferred.)
3. Should the palette support `@agent` + `#project` prefix filters (like Slack)? (Deferred — v2.)

## Claude's Discretion (micro-decisions)

These are small things the planner/executor picks without asking:
- Which lucide icons back each empty state hero + command item (pick semantically honest ones: `Inbox` for empty queue, `GitBranch` for projects, `Cpu` for agents, etc.).
- Exact founder-speak wording of palette placeholder ("Search or jump to…" baseline from RESEARCH).
- Axe `tags` arg (if any) — default `["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]` unless noise warrants pruning.
- How to express key badges in the overlay (`<kbd>` with a consistent style) — mirror the existing `kbd` conventions if present, else introduce a tiny style.

## Decision coverage matrix

| Dec | Plan | Plan task | Coverage |
|-----|------|-----------|----------|
| D-01, D-02, D-04, D-05, D-07, D-08 | 02 | 1-3 | Full |
| D-03 | 02 + 05 | palette trigger + integration | Full |
| D-06 | 02 | 2 | Full |
| D-09, D-10, D-11 | 03 | 1-2 | Full |
| D-12, D-13 | 04 | 1-2 | Full |
| D-14, D-15 | 01 + 04 | keybindings registry + overlay render | Full |
| D-16, D-17, D-18 | 05 | 2 | Full |
| D-19, D-20 | 01 | 2 | Full |
| D-21, D-22 | 05 | 3 | Full |
| D-23, D-24, D-25 | wave structure across 01-05 | — | Full |
| D-26, D-27, D-28 | all plans (constraints) | — | Full |

Every D-XX has a plan. No PHASE SPLIT required.
