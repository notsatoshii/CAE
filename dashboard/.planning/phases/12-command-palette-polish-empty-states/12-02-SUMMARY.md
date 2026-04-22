---
phase: 12-command-palette-polish-empty-states
plan: "02"
subsystem: ui
tags: [wave-1, palette, combobox, fuzzysort, shortcut-overlay, tdd, base-ui]

requires:
  - phase: 12-command-palette-polish-empty-states
    plan: "01"
    provides: "fuzzysort@3.1.0, KEYBINDINGS registry, test infra"

provides:
  - "lib/palette/types.ts: PaletteItem, PaletteGroupKey, PALETTE_GROUP_ORDER (frozen contract for 12-04)"
  - "lib/palette/fuzzy-rank.ts: rankPaletteItems() fuzzysort wrapper"
  - "lib/palette/index-sources.ts: 5 fetch functions + staticCommandItems re-export"
  - "lib/palette/actions.ts: buildStaticCommands factory (14 commands: 10 nav + 4 action)"
  - "lib/palette/build-index.ts: buildPaletteIndex() Promise.allSettled orchestration"
  - "lib/hooks/use-command-palette.tsx: CommandPaletteProvider + useCommandPalette hook"
  - "lib/hooks/use-shortcut-overlay.tsx: ShortcutOverlayProvider + useShortcutOverlay hook"
  - "components/palette/command-palette.tsx: Dialog+Combobox shell, 6-group render"
  - "components/palette/palette-trigger.tsx: optional ⌘K nav button (unmounted until 12-04)"
  - "components/ui/shortcut-overlay.tsx: ShortcutOverlay + ShortcutHelpButton"

affects:
  - "12-04 (polish + mount) — imports CommandPalette, ShortcutOverlay, PaletteTrigger, ShortcutHelpButton, CommandPaletteProvider, ShortcutOverlayProvider"

tech-stack:
  added: []
  patterns:
    - "PaletteItem shape: id/group/label/hint/icon?/run() — frozen D-07 contract"
    - "5-source Promise.allSettled: sources rejected individually, swallowed + logged"
    - "isEditableTarget() + document.activeElement dual-check for jsdom test compatibility"
    - "Combobox.Root with filteredItems= external ranker pattern (no Portal/Popup used inside Dialog)"
    - "Founder-first label rule: founderMode = !(dev && !explain)"

key-files:
  created:
    - lib/palette/types.ts
    - lib/palette/fuzzy-rank.ts
    - lib/palette/fuzzy-rank.test.ts
    - lib/palette/index-sources.ts
    - lib/palette/index-sources.test.ts
    - lib/palette/actions.ts
    - lib/palette/build-index.ts
    - lib/palette/build-index.test.ts
    - lib/hooks/use-command-palette.tsx
    - lib/hooks/use-command-palette.test.tsx
    - lib/hooks/use-shortcut-overlay.tsx
    - components/palette/command-palette.tsx
    - components/palette/command-palette.test.tsx
    - components/palette/palette-trigger.tsx
    - components/ui/shortcut-overlay.tsx
    - components/ui/shortcut-overlay.test.tsx
  modified: []

key-decisions:
  - "PALETTE_GROUP_ORDER = [projects, tasks, agents, workflows, memory, commands] — Plan 12-04 imports this constant directly for nav wiring"
  - "Provider hierarchy for Wave 3 mount: <CommandPaletteProvider><ShortcutOverlayProvider>…</ShortcutOverlayProvider></CommandPaletteProvider> (peer-safe, order doesn't matter)"
  - "Combobox inside Dialog (no Combobox.Portal/Popup) — Dialog already provides modal + focus-trap; Combobox renders List inline inside DialogContent"
  - "document.activeElement added to editable-target guard alongside e.target — required for jsdom KeyboardEvent dispatch (e.target is window, not focused input)"
  - "buildStaticCommands openShortcuts toggle is close() as placeholder — 12-04 will wire the real ShortcutOverlay toggle when both providers are mounted together"
  - "A1/A2 assumptions: palette latency and fuzzysort perf not yet measured — deferring to 12-05 audit pass"

metrics:
  duration: "~8min"
  completed: "2026-04-22"
  tasks: 3
  files_modified: 16
  tdd_cycles: 3
---

# Phase 12 Plan 02: Palette Pure Libs + CommandPalette + ShortcutOverlay Summary

**⌘K command palette pure libs (5 source fetchers + fuzzysort wrapper + index orchestrator) and React trigger hooks + CommandPalette Dialog+Combobox shell + ? ShortcutOverlay with KEYBINDINGS-backed rendering — all as standalone unmounted primitives, 49 tests green**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-22T18:50:52Z
- **Completed:** 2026-04-22T18:58:18Z
- **Tasks:** 3
- **Files created:** 16

## Accomplishments

### Task 1: Palette pure libs (TDD — 24 tests)
- `lib/palette/types.ts` — `PaletteItem`, `PaletteGroupKey`, `PALETTE_GROUP_ORDER` (frozen D-07 contract)
- `lib/palette/fuzzy-rank.ts` — `rankPaletteItems()`: empty-query short-circuit → returns input unchanged; typed query → `fuzzysort.go()` with `keys: ["label","hint"], threshold: -10000`
- `lib/palette/index-sources.ts` — 5 fetch functions (`fetchProjectItems`, `fetchTaskItems`, `fetchAgentItems`, `fetchWorkflowItems`, `fetchMemoryItems`) + `staticCommandItems` re-export; each rejects with endpoint path on non-OK response
- `lib/palette/actions.ts` — `buildStaticCommands()` factory: 10 nav commands + 4 action commands (toggle-explain, toggle-dev, open-shortcuts, regenerate-memory); `staticCommandItems()` convenience wrapper
- `lib/palette/build-index.ts` — `buildPaletteIndex()`: `Promise.allSettled` over 5 sources, group-ordered concat, id de-duplication (last-writer-wins), `console.warn` with group name on failure

### Task 2: CommandPalette trigger hook + component (TDD — 14 tests)
- `lib/hooks/use-command-palette.tsx` — `CommandPaletteProvider` + `useCommandPalette`; ⌘K / Ctrl+K listener with `isEditableTarget()` + `document.activeElement` dual guard; `keybindingById('palette.open')` sanity check
- `components/palette/command-palette.tsx` — Dialog + Combobox.Root shell; builds index on open, resets on close; 6-group render in `PALETTE_GROUP_ORDER`; `Combobox.Empty` "No matches. Try a different word."; no `asChild` (AGENTS.md)
- `components/palette/palette-trigger.tsx` — optional ⌘K nav button (unmounted until Plan 12-04)

### Task 3: ShortcutOverlay + help button (TDD — 11 tests)
- `lib/hooks/use-shortcut-overlay.tsx` — `ShortcutOverlayProvider` + `useShortcutOverlay`; `?` and `Shift+/` triggers with editable guard
- `components/ui/shortcut-overlay.tsx` — Dialog rendering `KEYBINDINGS` grouped by area; `founderMode = !(dev && !explain)` (D-15 founder-first); `<kbd>` chips from `k.keys[]`; no hardcoded key strings; `aria-labelledby` on dialog
- `ShortcutHelpButton` — HelpCircle icon button, `aria-label="Open keyboard shortcuts"`

## Task Commits

Each task was committed atomically with RED + GREEN pairs:

1. **test(12-02): add failing tests for palette pure libs** — `8ef309e`
2. **feat(12-02): implement palette pure libs** — `4f64f72`
3. **test(12-02): add failing tests for command palette** — `7d240fd`
4. **feat(12-02): CommandPalette + trigger hook** — `8c377df`
5. **test(12-02): add failing tests for ShortcutOverlay** — `b3b3744`
6. **feat(12-02): ShortcutOverlay + help button** — `23e76f9`

## Frozen Contracts (Plan 12-04 depends on these)

### PaletteItem type
```ts
interface PaletteItem {
  readonly id: string;           // e.g. "project:cae-dashboard", "agent:forge"
  readonly group: PaletteGroupKey;
  readonly label: string;        // founder-speak primary
  readonly hint: string;         // secondary, never undefined (coerced to "")
  readonly icon?: LucideIcon;
  readonly run: () => void;
}
```

### PALETTE_GROUP_ORDER
```ts
["projects", "tasks", "agents", "workflows", "memory", "commands"]
```

### Provider hierarchy (Wave 3 mount in app/layout.tsx)
```tsx
<CommandPaletteProvider>
  <ShortcutOverlayProvider>
    {/* rest of app */}
    <CommandPalette />
    <ShortcutOverlay />
  </ShortcutOverlayProvider>
</CommandPaletteProvider>
```
Both providers are peer-safe; order doesn't matter. `CommandPalette` and `ShortcutOverlay` can be placed anywhere inside the providers (plan 12-04 mounts them near the bottom of the layout).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `document.activeElement` added to editable-target guard**
- **Found during:** Task 2 (use-command-palette.test.tsx)
- **Issue:** When a KeyboardEvent is dispatched on `window` in jsdom, `e.target` is the `window` object (not the focused `<input>`). The `isEditableTarget(e.target)` check always returned false, allowing the palette to open even with an input focused.
- **Fix:** Added `|| isEditableTarget(document.activeElement)` to both `use-command-palette.tsx` and `use-shortcut-overlay.tsx` keydown handlers.
- **Files modified:** `lib/hooks/use-command-palette.tsx`, `lib/hooks/use-shortcut-overlay.tsx`
- **Commits:** `8c377df`, `23e76f9` (included in respective GREEN commits)

**2. [Rule 2 - Missing] React namespace import added for `React.JSX.Element`**
- **Found during:** Task 2 and Task 3 (tsc check)
- **Issue:** `JSX.Element` return types require explicit `import React` when using the `React.JSX.Element` namespace form (project tsconfig uses react-jsx transform but `React.JSX` still needs the namespace).
- **Fix:** Added `import React from "react"` to `command-palette.tsx` and `shortcut-overlay.tsx`. Alternatively used the `JSX.Element` return type — resolved by adding the React import.
- **Files modified:** `components/palette/command-palette.tsx`, `components/ui/shortcut-overlay.tsx`

## Assumption Flip Log

- **A1 (palette open latency):** Not yet measured — deferred to 12-05 audit pass. `buildPaletteIndex` runs on open; if `/api/memory/tree` is slow, the palette may lag.
- **A2 (fuzzysort ~500 items < 10ms):** Not yet measured this plan. `fuzzysort.go()` with 6 KEYBINDINGS entries ran in < 1ms in tests; real index with ~50-500 items unmeasured.

## Known Stubs

None. All 16 files implement real behavior. The `openShortcuts` toggle in `buildPaletteIndex` is wired to `close()` as a temporary placeholder — this is intentional and documented; Plan 12-04 replaces it when both providers are co-mounted.

## Threat Flags

No new security-relevant surface beyond what the plan's threat model covers:
- `fetchJson()` in `index-sources.ts` is same-origin only (no cross-origin fetch)
- All PaletteItem values are freshly constructed (T-12-04 mitigation)
- Navigation via `router.push()` traverses NextAuth middleware (T-12-03 mitigation)
- React auto-escapes all label/hint strings in render (T-12-02 mitigation)

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| lib/palette/types.ts | FOUND |
| lib/palette/fuzzy-rank.ts | FOUND |
| lib/palette/fuzzy-rank.test.ts | FOUND |
| lib/palette/index-sources.ts | FOUND |
| lib/palette/index-sources.test.ts | FOUND |
| lib/palette/actions.ts | FOUND |
| lib/palette/build-index.ts | FOUND |
| lib/palette/build-index.test.ts | FOUND |
| lib/hooks/use-command-palette.tsx | FOUND |
| lib/hooks/use-command-palette.test.tsx | FOUND |
| lib/hooks/use-shortcut-overlay.tsx | FOUND |
| components/palette/command-palette.tsx | FOUND |
| components/palette/command-palette.test.tsx | FOUND |
| components/palette/palette-trigger.tsx | FOUND |
| components/ui/shortcut-overlay.tsx | FOUND |
| components/ui/shortcut-overlay.test.tsx | FOUND |
| commit 8ef309e | FOUND |
| commit 4f64f72 | FOUND |
| commit 7d240fd | FOUND |
| commit 8c377df | FOUND |
| commit b3b3744 | FOUND |
| commit 23e76f9 | FOUND |
| 49 tests passing | CONFIRMED |
| tsc clean (no new errors) | CONFIRMED |
| no asChild in palette/overlay | CONFIRMED |
| no hardcoded keys in shortcut-overlay | CONFIRMED |
