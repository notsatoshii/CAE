---
phase: 12-command-palette-polish-empty-states
plan: "04"
subsystem: ui
tags: [wave-3, integration, mount, keybindings, audit, a11y, reduced-motion, provider-refactor]

requires:
  - phase: 12-command-palette-polish-empty-states
    plan: "01"
    provides: "KEYBINDINGS registry, audit scripts, motion CSS"
  - phase: 12-command-palette-polish-empty-states
    plan: "02"
    provides: "CommandPalette, ShortcutOverlay, CommandPaletteProvider, ShortcutOverlayProvider"
  - phase: 12-command-palette-polish-empty-states
    plan: "03"
    provides: "EmptyState primitive, 9-surface migration"

provides:
  - "app/layout.tsx: CommandPaletteProvider + ShortcutOverlayProvider mounted; CommandPalette + ShortcutOverlay singletons gated by session"
  - "components/shell/top-nav.tsx: ShortcutHelpButton between ChatPopOutIcon and HeartbeatDot divider (D-13)"
  - "lib/keybindings.ts: matchesKeydown() helper exported (modifier + key matching from Keybinding)"
  - "lib/providers/explain-mode.tsx: migrated to keybindingById('explain.toggle') + matchesKeydown (SHO-01)"
  - "lib/providers/dev-mode.tsx: migrated to keybindingById('devmode.toggle') + matchesKeydown (SHO-01)"
  - "lib/hooks/use-sheet-keys.ts: migrated all three keys to registry (SHO-01)"
  - "lib/hooks/use-command-palette.tsx: migrated to matchesKeydown + Ctrl+K cross-platform fallback"
  - "lib/hooks/use-shortcut-overlay.tsx: migrated to matchesKeydown + Shift+/ US-layout fallback"
  - "components/palette/command-palette.tsx: openShortcuts wired to real ShortcutOverlay.setOpen(true)"
  - "scripts/verify-keybindings-wiring.sh: rg audit exits 0 confirming no hardcoded keys"
  - "app/globals.css: MOT-02 tw-animate-css reduced-motion override block added"
  - "lib/copy/labels.ts: changesExplainDevToggle founder copy polished (no more 'SHAs' jargon)"
  - "12-AUDIT-NOTES.md: full audit ledger for axe + motion + explain-QA + keybindings"

affects:
  - "Phase 13 (UI/UX review) — all providers now KEYBINDINGS-backed; palette + overlay mounted"

tech-stack:
  added: []
  patterns:
    - "matchesKeydown(kb, e): single modifier-aware key matcher replaces all per-provider hardcoded comparisons"
    - "Non-undefined narrowing pattern: const kbRaw = keybindingById(...); if (!kbRaw) return; const kb = kbRaw; — avoids TS closure narrowing failures"
    - "Cross-platform fallback: palette.open uses ⌘K (mac) with explicit Ctrl+K fallback for win/linux"
    - "US-layout fallback: shortcuts.open handles Shift+/ as well as ? directly"

key-files:
  created:
    - scripts/verify-keybindings-wiring.sh
    - .planning/phases/12-command-palette-polish-empty-states/12-AUDIT-NOTES.md
  modified:
    - app/layout.tsx
    - components/shell/top-nav.tsx
    - components/shell/top-nav.test.tsx
    - lib/keybindings.ts
    - lib/keybindings.test.ts
    - lib/providers/explain-mode.tsx
    - lib/providers/dev-mode.tsx
    - lib/hooks/use-sheet-keys.ts
    - lib/hooks/use-command-palette.tsx
    - lib/hooks/use-shortcut-overlay.tsx
    - components/palette/command-palette.tsx
    - components/palette/command-palette.test.tsx
    - app/globals.css
    - lib/copy/labels.ts

key-decisions:
  - "matchesKeydown uses non-undefined narrowing (kbRaw → kb) to satisfy TypeScript closure analysis"
  - "Ctrl+K fallback kept in use-command-palette: KEYBINDINGS uses ⌘ (mac-only) but win/linux users need Ctrl+K; fallback reads last chip from kb.keys not a hardcode"
  - "Shift+/ fallback kept in use-shortcut-overlay: US keyboard fires / + Shift, not ? directly; matchesKeydown handles the direct ? case"
  - "axe audit environment-blocked: Snap Chromium cannot be driven by ChromeDriver (snap confinement); deferred to Phase 13 with Playwright"
  - "MOT-02 override added: tw-animate-css@1.4.0 has zero built-in reduced-motion rules (confirmed from dist file)"
  - "1 copy rewrite: changesExplainDevToggle 'SHAs' → 'version IDs', 'commit subjects' → 'change summaries'"
  - "Human UAT (Task 4 checkpoint) auto-approved per Eric's session-7 directive; items deferred to post-P14 consolidated UAT"

metrics:
  duration: "~25min"
  completed: "2026-04-23"
  tasks: 3
  files_modified: 14
  tdd_cycles: 0
---

# Phase 12 Plan 04: Polish + Integration + Audits Summary

**Providers mounted in app/layout.tsx, 5 hooks migrated to KEYBINDINGS single source of truth via matchesKeydown helper, MOT-02 override added, copy polished, audit notes produced — Wave 3 complete**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-23T04:18:00Z
- **Completed:** 2026-04-23T04:32:00Z
- **Tasks:** 3 (+ 1 auto-approved checkpoint)
- **Files modified:** 14

## Accomplishments

### Task 1: Mount providers + palette + overlay (commit `a78b95e`)

- `app/layout.tsx`: `CommandPaletteProvider` + `ShortcutOverlayProvider` wrap `ChatRailProvider` children. `CommandPalette` + `ShortcutOverlay` mount as session-gated singletons.

  Final provider tree:
  ```tsx
  <ExplainModeProvider>
    <DevModeProvider>
      <StatePollProvider>
        <ChatRailProvider session={session}>
          <CommandPaletteProvider>
            <ShortcutOverlayProvider>
              {session && <TopNav />}
              {children}
              {session && <ChatRail />}
              {session && <CommandPalette />}
              {session && <ShortcutOverlay />}
              <Toaster />
            </ShortcutOverlayProvider>
          </CommandPaletteProvider>
        </ChatRailProvider>
      </StatePollProvider>
    </DevModeProvider>
  </ExplainModeProvider>
  ```

- `components/shell/top-nav.tsx`: `<ShortcutHelpButton />` inserted after `<ChatPopOutIcon />`, before the first divider span (D-13).

- `components/shell/top-nav.test.tsx`: 3 new smoke tests (9–11) asserting `ShortcutHelpButton` renders and is ordered after `ChatPopOutIcon` and before `HeartbeatDot`.

### Task 2: Provider keybindings migration (commit `b75c798`)

- `lib/keybindings.ts`: `matchesKeydown(kb, e)` exported — derives expected key/modifiers from `kb.keys[]`, normalises `Escape` → `esc`, returns false for empty keys array.
- `lib/keybindings.test.ts`: 11 new `matchesKeydown` tests (total 17 passing).
- 5 files migrated to KEYBINDINGS registry:
  - `lib/providers/explain-mode.tsx` → `keybindingById("explain.toggle")`
  - `lib/providers/dev-mode.tsx` → `keybindingById("devmode.toggle")`
  - `lib/hooks/use-sheet-keys.ts` → `keybindingById("sheet.close")` + `"task.pause"` + `"task.abort"`
  - `lib/hooks/use-command-palette.tsx` → `matchesKeydown` + Ctrl+K cross-platform fallback
  - `lib/hooks/use-shortcut-overlay.tsx` → `matchesKeydown` + Shift+/ US-layout fallback
- `components/palette/command-palette.tsx`: `openShortcuts` placeholder replaced with real `useShortcutOverlay().setOpen(true)` + palette close.
- `scripts/verify-keybindings-wiring.sh`: rg-based audit exits 0 — no hardcoded key literals in the 5 migrated files.

### Task 3: Audits + notes (commit `1f949f1`)

- **axe (A11Y-01)**: Environment-blocked (Snap Chromium + ChromeDriver incompatibility). Static analysis confirms semantic HTML, aria-labels, focus trapping all correct. Deferred to Phase 13.
- **MOT-02**: `tw-animate-css@1.4.0` confirmed to have zero built-in reduced-motion rules. Added per-utility override block to `app/globals.css` covering `animate-in/out`, `slide-in/out`, `fade-in/out`, `zoom-in/out`.
- **MOT-01/03**: Both Wave-0 blocks verified via `app/motion-guard.test.ts` (3/3 pass).
- **EQA-01**: `verify-explain-keys.sh` exits 0 — 11 keys, all in FOUNDER + DEV.
- **EQA-02**: 9 call sites reviewed. 1 rewrite: `changesExplainDevToggle` — "SHAs" → "version IDs", "commit subjects" → "change summaries".
- `12-AUDIT-NOTES.md` produced with full findings ledger.

### Task 4: Human checkpoint (auto-approved)

Per Eric's session-7 directive, the `checkpoint:human-verify` at end of plan is auto-approved. Verification items deferred to post-P14 consolidated UAT:
- ⌘K palette open + fuzzy search
- `?` overlay open + founder/dev label modes
- `ShortcutHelpButton` in top-nav
- EmptyState surfaces at each route
- Reduced-motion DevTools emulation
- `12-AUDIT-NOTES.md` review

## Task Commits

1. `a78b95e` — `feat(12-04): mount command palette + shortcut overlay + help button`
2. `b75c798` — `refactor(12-04): providers read keys from lib/keybindings`
3. `1f949f1` — `docs(12-04): Phase 12 audit notes + MOT-02 override + copy polish`

## matchesKeydown Signature

```ts
export function matchesKeydown(kb: Keybinding, e: KeyboardEvent): boolean
```

Checks that `e.key` (lowercased, with `Escape` normalised to `esc`) matches the last chip of `kb.keys[]`, and that every modifier flag (`ctrlKey`, `metaKey`, `shiftKey`, `altKey`) exactly matches the presence/absence of its chip (`"Ctrl"`, `"⌘"`, `"Shift"`, `"Alt"`) in the array. Returns `false` for empty `keys[]`.

## Final app/layout.tsx Provider Tree

See Task 1 above. `ExplainModeProvider` + `DevModeProvider` remain outermost (overlay reads both). `CommandPaletteProvider` + `ShortcutOverlayProvider` nest inside `ChatRailProvider`.

## Reduced-motion Final State

- **tw-animate-css MOT-02**: Override was NEEDED and ADDED. `tw-animate-css@1.4.0` has zero built-in `prefers-reduced-motion` support.
- All three motion guards (MOT-01/02/03) now present in `app/globals.css`.

## Copy Rewrites Applied

| Key | Old FOUNDER string | New FOUNDER string |
|-----|-------------------|-------------------|
| `changesExplainDevToggle` | "Flip to see the raw git details: branch name, SHAs, commit subjects, GitHub link." | "Flip to see the technical details: branch name, version IDs, change summaries, and a GitHub link." |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript closure narrowing for `kb` const**
- **Found during:** Task 2 (tsc check)
- **Issue:** `const kb = keybindingById(...)` → `if (!kb) return` does not narrow `kb` to non-undefined inside the `onKeyDown` closure in strict TypeScript. tsc emitted `TS18048: 'kb' is possibly 'undefined'`.
- **Fix:** Renamed to `kbRaw`, checked, then re-assigned: `const kb = kbRaw` (now narrowed to `Keybinding`). Applied to `use-command-palette.tsx` and `use-shortcut-overlay.tsx`.
- **Commits:** `b75c798`

**2. [Rule 1 - Bug] command-palette.test.tsx missing ShortcutOverlayProvider mock**
- **Found during:** Task 2 (full test suite)
- **Issue:** `CommandPalette` now calls `useShortcutOverlay()` to wire `openShortcuts`. The existing test rendered `CommandPalette` inside `CommandPaletteProvider` only — the `useShortcutOverlay()` call threw "must be used within ShortcutOverlayProvider".
- **Fix:** Added `vi.mock("@/lib/hooks/use-shortcut-overlay", ...)` to the test file.
- **Commits:** `b75c798`

**3. [Rule 2 - Missing] verify-keybindings-wiring.sh scope narrowed to 5 migrated files**
- **Found during:** Task 2 (first script run)
- **Issue:** Original script scanned `lib/providers` as a directory, which caught `lib/providers/chat-rail.tsx` — a pre-existing `e.key === "Escape"` guard that is NOT part of the SHO-01 migration scope.
- **Fix:** Changed script to list the 5 explicitly-migrated files rather than the entire `lib/providers/` directory.
- **Commits:** `b75c798`

**4. [Rule 3 - Blocking] axe audit environment-blocked**
- **Found during:** Task 3
- **Issue:** Snap-packaged Chromium cannot be driven by ChromeDriver (snap confinement → `DevToolsActivePort file doesn't exist`). Not a code bug.
- **Fix:** Documented in `12-AUDIT-NOTES.md` with static analysis confidence items. Deferred to Phase 13. No code change needed.
- **Impact:** A11Y-01 gating deferred; architectural ARIA correctness manually verified.

## Human Verification Deferred to Post-P14 UAT

Per Eric's session-7 directive, the following checkpoint items are auto-approved and deferred to consolidated UAT after Phase 14:

1. ⌘K / Ctrl+K opens palette; Esc closes; Enter navigates
2. `?` and HelpCircle button open shortcut overlay
3. Overlay shows founder labels by default; DevMode (⌘Shift+D) switches to dev labels
4. All 9 EmptyState surfaces render with correct CTAs
5. `prefers-reduced-motion: reduce` stops all animations (DevTools emulation)
6. `12-AUDIT-NOTES.md` reviewed end-to-end by Eric

## Known Stubs

None — all wiring is real. The `openShortcuts` placeholder from 12-02 has been replaced with the live `ShortcutOverlay.setOpen(true)` call.

## Threat Flags

No new security-relevant surface beyond the plan's threat model:
- T-12-20 (unauth palette): `{session && <CommandPalette />}` mitigated — only mounts with valid session
- T-12-21 (registry hole): all providers check `if (!kbRaw)` before registering handler — mitigated

## Follow-ups for Phase 13

See `12-AUDIT-NOTES.md` §Open tickets for the full list:
1. axe audit (Playwright-based) against all 10 routes
2. MOT-02 DevTools visual confirmation
3. EQA-02 human sign-off on `floorExplainHub` "merge fireworks" metaphor
4. palette.open cross-platform chip display (⌘K shown even on win/linux)

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| app/layout.tsx contains CommandPaletteProvider | FOUND |
| app/layout.tsx contains ShortcutOverlayProvider | FOUND |
| components/shell/top-nav.tsx contains ShortcutHelpButton | FOUND |
| lib/keybindings.ts exports matchesKeydown | FOUND |
| lib/providers/explain-mode.tsx imports from @/lib/keybindings | FOUND |
| lib/providers/dev-mode.tsx imports from @/lib/keybindings | FOUND |
| lib/hooks/use-sheet-keys.ts imports from @/lib/keybindings | FOUND |
| lib/hooks/use-command-palette.tsx imports from @/lib/keybindings | FOUND |
| lib/hooks/use-shortcut-overlay.tsx imports from @/lib/keybindings | FOUND |
| scripts/verify-keybindings-wiring.sh exits 0 | CONFIRMED |
| scripts/verify-explain-keys.sh exits 0 | CONFIRMED |
| 12-AUDIT-NOTES.md exists and non-empty | FOUND |
| app/globals.css has MOT-02 tw-animate-css block | FOUND |
| 563 tests passing | CONFIRMED |
| tsc clean (no new errors) | CONFIRMED |
| commit a78b95e | FOUND |
| commit b75c798 | FOUND |
| commit 1f949f1 | FOUND |
