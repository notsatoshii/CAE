# Phase 12: Command palette + polish + empty states — Research

**Researched:** 2026-04-22
**Domain:** Command-palette UX, empty-state system, a11y + reduced-motion audit
**Confidence:** HIGH (npm + filesystem verified) · MEDIUM (axe tooling choice)

## Summary

Polish phase, not new surface area. The dashboard already has 13 pages, a founder-speak label dictionary with DEV/FOUNDER parity, Ctrl+E and ⌘Shift+D providers, a `prefers-reduced-motion`-respecting shake keyframe, and `<ExplainTooltip>` mounted in 9 places. Missing: global fuzzy palette, first-class empty-state component (today's empties are ad-hoc `<div>`s), `?` shortcut overlay with single-source keybind registry, formal axe + motion audits.

Biggest strategic finding: **`@base-ui/react@1.4.1` (installed) ships a full `Combobox`** with grouped items, `useFilter`, `Combobox.Empty`, portal/popup, WAI-ARIA behavior. Combined with `fuzzysort@3.1.0` for ranked ordering, we build the palette WITHOUT adding `cmdk` or `kbar`. Keeps us consistent with Phase 3 base-ui hard-lock and avoids the `asChild` gotcha in `AGENTS.md`. [VERIFIED: `node_modules/@base-ui/react/combobox/` has 32 sub-primitives including `empty`, `group`, `list`, `popup`, `portal`]

**Primary recommendation:** `<CommandPalette>` on top of `Combobox` from `@base-ui/react`, with `fuzzysort` as ranker via `<Combobox.Root filteredItems={...}>`. No new palette lib.

## User Constraints (from CONTEXT.md)

No CONTEXT.md yet. Constraints inferred from ROADMAP §Phase 12 + UI-SPEC:

### Locked Decisions
- Palette scope: projects / tasks / agents / workflows / memory / commands.
- Empty-state copy per tab with 1-3 guided actions.
- `?` shortcut overlay. Axe clean. Reduced-motion audit. Explain-copy QA.
- Dark theme, base-ui, Tailwind v4, founder-speak defaults — Phase 3-11 hard locks.
- Tokens only, no USD.
- FINAL phase — no new features.

### Claude's Discretion
- Palette library (stay in base-ui if feasible).
- Fuzzy ranker, shortcut-map structure, axe tooling (runtime vs CLI).

### Deferred Ideas (OUT OF SCOPE)
Multi-user, cloud deploy, mobile apps, plugin API, billing, advanced metrics drill-downs.

## Phase Requirements

No REQUIREMENTS.md entries yet. Expected clusters: `PALETTE-` (open, 6 groups, rank, nav, execute) · `EMPTY-` (one `<EmptyState>` + 7 surfaces) · `SHORTCUT-` (`?` overlay + single registry) · `A11Y-` (zero serious/critical axe) · `MOTION-` (every `animate-*` proven reduced-motion safe) · `EXPLAIN-QA-` (9 tooltips, founder + dev parity).

## Standard Stack

### Runtime (zero new runtime deps — Combobox is already in the bundle)
| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| `@base-ui/react` | 1.4.1 | `Combobox` (palette), `Dialog` (overlay) | [VERIFIED: npm view] |
| `fuzzysort` | 3.1.0 | Weighted ranker — 45KB unpacked, zero deps | [VERIFIED: npm view; dist.unpackedSize=45608] |
| `lucide-react` | ^0.510.0 | Empty-state hero icons, palette glyphs | already installed |

### Dev-time
| Library | Version | Purpose |
|---------|---------|---------|
| `@axe-core/react` | 4.11.2 | Dev-mode runtime a11y checker (console) [VERIFIED: npm view] |
| `@axe-core/cli` | 4.11.2 | CI audit over dev-server URLs [VERIFIED: npm view] |

**Skip `axe-playwright`** — we use Vitest + jsdom + RTL (package.json devDependencies); adding Playwright for one phase is scope creep.

### Alternatives rejected
| Instead of | Could Use | Why Rejected |
|------------|-----------|--------------|
| base-ui Combobox | `cmdk@1.1.1` | Adds 82KB; duplicates Combobox a11y already shipped. React-19 peer ✓ but redundant. [VERIFIED: npm view cmdk peerDependencies] |
| base-ui Combobox | `kbar@0.1.0-beta.48` | Still beta after 4 years (last 2025-07-29); no formal React-19 peer declaration. [VERIFIED: npm view kbar time] |
| `fuzzysort` | `fuse.js@7.3.0` | 7× bundle (312KB vs 45KB). Don't need typo tolerance. [VERIFIED: npm view] |
| `fuzzysort` | `String.includes` | Acceptable <50 items; index crosses 5 sources, ~500 entries. |

### Install
```bash
npm install fuzzysort
npm install --save-dev @axe-core/react @axe-core/cli
```

## Architecture Patterns

### Module layout
```
components/palette/  command-palette.tsx · palette-trigger.tsx · palette-section.tsx · palette-item.tsx
components/ui/       empty-state.tsx (NEW) · shortcut-overlay.tsx (NEW)
lib/palette/         index-sources.ts · build-index.ts · fuzzy-rank.ts · actions.ts
lib/                 keybindings.ts (SINGLE SOURCE OF TRUTH)
lib/hooks/           use-command-palette.ts · use-shortcut-overlay.ts
scripts/             audit-a11y.sh · audit-motion.sh · verify-explain-keys.sh
```

### Pattern 1: Build index on open (not at mount)
5-source `Promise.all` of projects (`/api/state`) · tasks (`/api/queue`) · agents (`/api/agents`) · workflows (`/api/workflows`) · memory (`/api/memory/tree`) + static commands. Avoids duplicating existing SSE/poll streams.

### Pattern 2: Combobox with external ranker
```tsx
// Source: @base-ui/react/combobox/root/AriaCombobox.d.ts — filteredItems, items, Group
<Combobox.Root
  items={items}
  filteredItems={query.trim() ? fuzzysort.go(query, items, { keys: ["label", "hint"], threshold: -10000 }).map((r) => r.obj) : items}
  onValueChange={(item) => { item.run(); setOpen(false); }}>
  <Combobox.Input placeholder="Search or jump to…" />
  <Combobox.Portal><Combobox.Popup>
    <Combobox.Empty>No matches. Try a different word.</Combobox.Empty>
    <Combobox.List>{GROUPS.map((g) => <Combobox.Group key={g.key}>…</Combobox.Group>)}</Combobox.List>
  </Combobox.Popup></Combobox.Portal>
</Combobox.Root>
```

### Pattern 3: Keybindings registry drives providers AND overlay
```ts
// lib/keybindings.ts
export const KEYBINDINGS = [
  { id: "palette.open",   keys: ["⌘","K"],          area: "global", founderLabel: "Jump to anything",      devLabel: "Command palette" },
  { id: "shortcuts.open", keys: ["?"],              area: "global", founderLabel: "See all shortcuts",     devLabel: "Shortcut overlay" },
  { id: "explain.toggle", keys: ["Ctrl","E"],       area: "global", founderLabel: "Show/hide explanations",devLabel: "Toggle explain-mode" },
  { id: "devmode.toggle", keys: ["⌘","Shift","D"],  area: "global", founderLabel: "Advanced (dev) mode",   devLabel: "Toggle dev-mode" },
  { id: "sheet.close",    keys: ["Esc"],            area: "sheets", founderLabel: "Close panel",           devLabel: "Close sheet/drawer" },
  { id: "task.pause",     keys: ["Ctrl","."],       area: "task",   founderLabel: "Pause this job",        devLabel: "Pause running task" },
  { id: "task.abort",     keys: ["Ctrl","Shift","."], area: "task", founderLabel: "Stop this job",         devLabel: "Abort running task" },
  // …enumerate all existing bindings (see Open Q5)
] as const;
```

### Anti-Patterns
- **DON'T `asChild` on base-ui primitives.** Not polymorphic — silently drops props. Use `render={...}` (AGENTS.md Gotchas).
- **DON'T write ad-hoc empty-state divs.** Consolidate behind `<EmptyState>`.
- **DON'T register Ctrl+T for chat.** Chromium steals it (known decision, UI-SPEC §12).
- **DON'T add new animations.** Every motion triggers another audit.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Combobox a11y | roving-tabindex popover | `@base-ui/react` Combobox | ~200 LOC of `aria-activedescendant`, virtual focus; base-ui ships it tested |
| Weighted fuzzy | `.includes` + manual score | `fuzzysort` | first-char bonus, tight-match bonus, multi-key weights; 45KB |
| A11y detection | manual axe wiring | `@axe-core/react` + `@axe-core/cli` | 60+ rules WCAG 2.1 AA, maintained by Deque |
| Keyboard dispatch | per-component keydown | extend existing providers | `ExplainModeProvider` already has `isEditableTarget()` guard — mirror it |
| Portal/focus-trap | custom createPortal | `@base-ui/react` Dialog | already used in `components/ui/dialog.tsx` |

**Key insight:** Base-ui IS the palette lib. `cmdk` would duplicate Combobox a11y machinery already in the bundle.

## Common Pitfalls

1. **Focus escapes on palette open.** `Dialog` + `Combobox` stacked without `initialFocus` race. Fix: pass `initialFocus={inputRef}` to `Dialog.Popup`; assert `document.activeElement` in vitest.
2. **Fuzzysort crashes on nullish keys.** Coerce in index builder: `hint: raw.description ?? ""`.
3. **`prefers-reduced-motion` defeated by Tailwind `animate-pulse`.** Tailwind utilities aren't `motion-safe:` by default. Fix: global CSS rule disabling `.animate-pulse`/`.animate-spin`/`.animate-ping`/`.animate-bounce` inside `@media (prefers-reduced-motion: reduce)` (one-line safety net; see offender list below). Per-call-site `motion-safe:` prefix also works but misses future additions.
4. **Shortcut overlay lists stale keys.** Providers must import from `KEYBINDINGS[id].keys`, not hardcode. Overlay renders from same registry.
5. **Axe false-positives on base-ui virtual-list IDs.** Audit palette CLOSED and OPEN separately; if churn remains, `axe.run({ exclude: ["[data-combobox-scroll]"] })`.
6. **Empty-state confused with loading.** `<EmptyState>` variant is `"empty" | "error"` only — loading uses existing skeleton pattern.

## Runtime State Inventory

Phase 12 is additive UI only — no rename, no refactor, no migration.

| Category | Items | Action |
|----------|-------|--------|
| Stored data | None — palette state in-memory | None |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | None — no rename | None |

## Environment Availability

| Dep | Required By | Available | Fallback |
|-----|------------|-----------|----------|
| Node / npm | build + tests + npm view | ✓ | — |
| Chromium headless | `axe-cli` default driver | likely ✓ on linux dev box | rely on `@axe-core/react` dev-time warnings only |
| Dev server :3000 | `axe-cli` targets | ✓ (already required for dev) | — |

No blocking deps.

## Code Examples

### `<EmptyState>` component
```tsx
// components/ui/empty-state.tsx — NEW
import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";

interface Props {
  icon?: LucideIcon;
  heading: string;
  body?: string;
  actions?: ReactNode;
  testId?: string;
  variant?: "empty" | "error";
}
export function EmptyState({ icon: Icon, heading, body, actions, testId, variant = "empty" }: Props) {
  return (
    <div data-testid={testId ?? "empty-state"}
      className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-8 text-center">
      {Icon && <Icon aria-hidden="true" className={variant === "error"
        ? "size-12 text-[color:var(--danger)]"
        : "size-12 text-[color:var(--text-dim)]"} />}
      <h3 className="text-sm font-medium text-[color:var(--text)]">{heading}</h3>
      {body && <p className="text-xs text-[color:var(--text-muted)]">{body}</p>}
      {actions && <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}
```

### Empty states per page (founder copy + guided actions)
| Page | Empty Condition | Founder Copy | Actions |
|------|----------------|--------------|---------|
| `/build` | no active phases AND no recent | "Nothing in flight. Start a feature in Plan or send a job to CAE." | [Go to Plan] [New job] |
| `/build/agents` | `agents.length === 0` | (tighten existing) "No agent activity yet." | [Send a job] |
| `/build/workflows` | `workflows.length === 0` | (reuse `workflowsListEmpty`) | [New recipe] |
| `/build/queue` | all 5 columns empty | "Nothing queued. CAE's inbox is clear." | [New job] [Open Workflows] |
| `/build/changes` | Phase 9 stub | "Changes timeline ships with Phase 9." | [Open Home] |
| `/metrics` | panel has no samples | (reuse `metricsEmptyState`) + add action | [Send a test job] |
| `/memory` Browse | tree empty | (reuse `memoryEmptyBrowse`) | [Regenerate graph] |
| `/memory` Graph | no graph.json | (reuse `memoryEmptyGraph`) | already present |
| `/plan` | Phase 10 stub | (reuse `planPlaceholder`) | [Go to Build] |

Note: all new copy lands in `lib/copy/labels.ts` FOUNDER + DEV blocks (TS `Labels` interface enforces parity).

## Motion Audit — concrete offender list (verified 2026-04-22 via rg)

**13 offender call sites across 10 files — NONE wrapped in `motion-safe:`:**

| File | Line | Class | Purpose |
|------|------|-------|---------|
| `app/build/queue/queue-card.tsx` | 92 | `animate-pulse` | Live-pulse dot on running cards |
| `components/ui/sonner.tsx` | 27 | `animate-spin` | Toast loader spinner |
| `components/shell/heartbeat-dot.tsx` | 33 | `animate-pulse` | Live heartbeat dot |
| `components/build-home/active-phase-cards.tsx` | 77 | `animate-pulse` | Running-phase progress bar |
| `components/agents/agent-detail-drawer.tsx` | 153-155 | `animate-pulse` ×3 | Loading skeletons |
| `components/memory/diff-view.tsx` | 121 | `animate-pulse` | Loading skeleton |
| `components/memory/why-drawer.tsx` | 222 | `animate-pulse` | Loading skeleton |
| `components/memory/git-timeline-drawer.tsx` | 226 | `animate-pulse` | Loading skeleton |
| `components/memory/browse/markdown-view.tsx` | 125 | `animate-pulse` | Loading skeleton |
| `components/memory/browse/search-bar.tsx` | 102 | `animate-pulse` | Searching dot |
| `components/memory/graph/regenerate-button.tsx` | 152 | `animate-spin` | Regenerating spinner |

**`animate-in`/`slide-in`/`fade-in`/`zoom-in`** (via `tw-animate-css@1.4.0`) appear 5× — at `components/ui/dialog.tsx` (2) and `components/ui/dropdown-menu.tsx` (2) (plus 1 other). Library is assumed to auto-emit `prefers-reduced-motion` overrides; **must confirm in DevTools emulation in Wave 0**.

**Shake keyframe** `globals.css` 184-201: `.cae-shaking` already guarded. ✓

**Recommended fix — single CSS block in `globals.css`** (after existing `.cae-shaking` block):
```css
@media (prefers-reduced-motion: reduce) {
  .animate-pulse, .animate-spin, .animate-ping, .animate-bounce { animation: none !important; }
}
```
Reason: future `animate-*` additions inherit protection; no per-call-site rebase risk.

## Explain-mode Copy QA — inventory

`<ExplainTooltip>` mounted at **9 call sites** (verified via grep):
1. `app/memory/memory-client.tsx:177`
2. `components/metrics/reliability-panel.tsx:113, 146`
3. `components/metrics/speed-panel.tsx:110, 114, 124, 136`
4. `components/metrics/spending-panel.tsx:151, 178`
5. `components/memory/graph/regenerate-button.tsx:158`
6. `components/memory/graph/graph-pane.tsx:131, 146`
7. `components/memory/browse/search-bar.tsx:108`

Per-site QA: `text` prop must reference a `labels.ts` key (not literal); key must exist in BOTH `FOUNDER` + `DEV`; founder copy readable without dev co-pilot. Spot-check of `labels.ts` 492-499 + 524-527 confirms all 8 existing explain keys have both variants. **Phase 12 action: a QA read-through, not a rewrite.**

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `vitest@1.6.1` + `@testing-library/react@16.3.2` + `jsdom@24.1.3` |
| Config | `vitest.config.ts` (Phase 8 wired) |
| Quick | `npm run test -- <filename>` |
| Full | `npm run test` |

### Requirements → Tests
| Req (proposed) | Behavior | Type | Command | Exists? |
|----------------|----------|------|---------|---------|
| PALETTE-01 | ⌘K opens palette (ignore inputs) | unit | `npm run test -- command-palette` | ❌ Wave 0 |
| PALETTE-02 | Fuzzy prefix rank first | unit | `npm run test -- fuzzy-rank` | ❌ Wave 0 |
| PALETTE-03 | Selecting item calls `.run()` + closes | unit | `npm run test -- command-palette` | ❌ Wave 0 |
| PALETTE-04 | Empty query shows all 6 groups | unit | `npm run test -- command-palette` | ❌ Wave 0 |
| PALETTE-05 | No matches → `<Combobox.Empty>` | unit | `npm run test -- command-palette` | ❌ Wave 0 |
| EMPTY-01 | `<EmptyState>` renders heading/body/actions | unit | `npm run test -- empty-state` | ❌ Wave 0 |
| SHORTCUT-01 | `?` opens overlay (ignore inputs) | unit | `npm run test -- shortcut-overlay` | ❌ Wave 0 |
| SHORTCUT-02 | Overlay swaps founder/dev label | unit | `npm run test -- shortcut-overlay` | ❌ Wave 0 |
| MOTION-01 | `@media (prefers-reduced-motion: reduce)` disables all 4 `animate-*` | unit (stylesheet assert) | `npm run test -- motion-guard` | ❌ Wave 0 |
| A11Y-01 | Zero serious/critical axe violations per route | integration | `bash scripts/audit-a11y.sh` | ❌ Wave 0 |
| EXPLAIN-QA-01 | Every `ExplainTooltip text={L.key}` resolves in `Labels` | lint-style | `bash scripts/verify-explain-keys.sh` | ❌ Wave 0 |

### Sampling
- Per commit: `npm run test -- <scope>`
- Per wave: `npm run test`
- Phase gate: full suite green + `audit-a11y.sh` green before `/gsd-verify-work`.

### Wave 0 gaps
- [ ] `components/palette/command-palette.test.tsx`
- [ ] `lib/palette/fuzzy-rank.test.ts`
- [ ] `components/ui/empty-state.test.tsx`
- [ ] `components/ui/shortcut-overlay.test.tsx`
- [ ] `app/motion-guard.test.ts`
- [ ] `scripts/audit-a11y.sh` (axe-cli wrapper + route list)
- [ ] `scripts/verify-explain-keys.sh` (rg `ExplainTooltip` → key in `labels.ts`)

## Security Domain

Client-only polish — no auth surface, no new server routes.

| ASVS | Applies | Control |
|------|---------|---------|
| V2 Authentication | no | existing NextAuth guards untouched |
| V3 Session | no | — |
| V4 Access | no | middleware still gates `/build` + `/plan` |
| V5 Input Validation | yes (palette query) | React auto-escape on labels; no `dangerouslySetInnerHTML`; query is read-only input to `fuzzysort.go()` |
| V6 Crypto | no | — |

| Threat | STRIDE | Mitigation |
|--------|--------|------------|
| XSS via result label | Tampering | React escaping; no HTML interpolation |
| Protected-route bypass via palette item | Elevation | palette "Go to…" uses `router.push()` which traverses middleware |
| Prototype pollution via query | Tampering | static keys in `fuzzysort.go()`; query is read-only |

## Project Constraints (from AGENTS.md)

- `asChild` FORBIDDEN on any base-ui primitive — use `render={...}` or className-on-trigger.
- Branch pattern `forge/p{N}-pl{letter}-t{id}-*` — executor handles; plans must match.
- Poll cadences 3s/5s — palette index is build-on-open (independent of polls).

## Assumptions Log

| # | Claim | Section | Risk |
|---|-------|---------|------|
| A1 | Palette opens <50ms (5-source Promise.all) | Pattern 1 | [ASSUMED] — if `/api/memory/tree` slow, palette laggy. Mitigation: lazy-load memory behind "Search memory…" prefix. |
| A2 | `fuzzysort.go()` ~500 items multi-key <10ms | Stack | [ASSUMED from fuzzysort README] — measure Wave 1. |
| A3 | `tw-animate-css@1.4.0` auto-emits reduced-motion overrides | Motion audit | [ASSUMED] — confirm DevTools emulation Wave 0. |
| A4 | `axe-cli` accepts dev-server URLs | Validation | [ASSUMED] — verify `npx @axe-core/cli http://localhost:3000/build` in Wave 0. |
| A5 | All 8 current explain keys' founder copy acceptable | Explain QA | [ASSUMED from spot-read] — full QA is part of phase. |
| A6 | Phase 9 chat IS shipped by Phase 12 execution | Module layout | Per ROADMAP Phase 9 is `[ ]`; if not shipped, palette omits "Chat" group. |

## Open Questions

1. **Project-scoped palette routes?** `project-selector.tsx` writes `?project=<path>`. Palette "Go to agents" — project-scoped or global? **Rec:** global routes; "Open {project-name}" is a separate group.
2. **`?` overlay trigger: keyboard-only or also top-nav button?** **Rec:** both (keyboard-only = poor founder affordance).
3. **`/metrics` empty: per-panel or page-level?** **Rec:** per-panel (existing pattern via `metricsEmptyState`); no page-level empty.
4. **Phase 9 interleave?** Assume shipped. If not, omit Chat group and Changes uses current stub.
5. **Complete KEYBINDINGS registry.** Current list in Pattern 3 is illustrative — Wave 0 must enumerate ALL global/sheet/task/page keys from `use-sheet-keys.ts`, `node-drawer.tsx`, `why-drawer.tsx`, `git-timeline-drawer.tsx`, etc.

## Sources

### Primary (HIGH)
- `node_modules/@base-ui/react/combobox/` — 32 sub-primitives incl. `empty`, `group`, `list`, `popup`, `portal`.
- `…/combobox/root/AriaCombobox.d.ts` — `filter`, `filteredItems`, `items`, `Group` type.
- `…/combobox/root/ComboboxRoot.d.ts` — props typedef.
- `npm view cmdk peerDependencies` → React 19 peer ok but redundant.
- `npm view kbar peerDependencies time` → beta-48 (2025-07-29); no formal R19 peer.
- `npm view fuzzysort version dist.unpackedSize` → 3.1.0, 45608 B.
- `npm view fuse.js dist.unpackedSize` → 311620 B (7× larger).
- `npm view @axe-core/react version` → 4.11.2.
- `npm view @axe-core/cli version` → 4.11.2.
- `rg` offender scan — 13 `animate-*` sites across 10 files (table above).
- `grep` ExplainTooltip — 9 sites across 7 files (table above).
- `dashboard/.planning/ROADMAP.md` §Phase 12.
- `dashboard/docs/UI-SPEC.md` §14 "Command palette (⌘K)" + "Help overlay (?)".
- `dashboard/AGENTS.md` Gotchas (`asChild` forbidden).
- `dashboard/app/globals.css` 184-201 (existing `.cae-shaking` reduced-motion rule).
- `dashboard/lib/copy/labels.ts` — `Labels` interface enforces DEV/FOUNDER parity.

### Secondary (MEDIUM)
- Base-ui docs URL `https://base-ui.com/react/components/combobox` — referenced in installed jsdoc; not fetched this session (typedef is authoritative).
- `tw-animate-css` reduced-motion behavior — inferred from package; requires DevTools emulation in Wave 0.

### Tertiary (LOW)
- Fuzzysort "~500 items <10ms" — README reputation, not measured. Confirm Wave 1.

## Metadata

**Confidence:**
- Standard stack: HIGH — every version `npm view`-verified; Combobox verified in installed `node_modules`.
- Architecture: HIGH — grounded in existing provider/label/testid conventions.
- Motion audit: HIGH — rg snapshot is concrete.
- Pitfalls: HIGH — `asChild` and motion gotchas codebase-verified.
- Axe tooling: MEDIUM — runtime vs CLI argued; execution reveals which is more ergonomic.
- Open questions: LOW until CONTEXT.md decides scope.

**Research date:** 2026-04-22
**Valid until:** ~2026-05-22 (base-ui moves fast; cmdk/fuzzysort stable).
