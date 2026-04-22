# Phase 12 — Audit Notes (Wave 3)

*Produced: 2026-04-23 by Plan 12-04 Task 3*

---

## axe (A11Y-01)

**Status: ENVIRONMENT-BLOCKED — deferred to Phase 13 UI/UX review loop**

The `scripts/audit-a11y.sh` script uses `@axe-core/cli@4.11.2` via Selenium WebDriver + ChromeDriver. In the CI/headless execution environment, the installed Chromium is Snap-packaged (`chromium-browser` snap v147). ChromeDriver cannot drive Snap-packaged Chrome due to snap confinement restrictions — the `SessionNotCreatedError: DevToolsActivePort file doesn't exist` error occurs regardless of `--no-sandbox` / `--disable-gpu` flags.

**What was attempted:**
- ChromeDriver binary downloaded (v147.0.7727.57)
- `CHROME_TEST_PATH=/usr/bin/chromium-browser` set (triggers `no-sandbox` argument)
- Dev server confirmed reachable at http://localhost:3002 (HTTP 307 → /signin)
- All 3 runs failed with `SessionNotCreatedError: DevToolsActivePort file doesn't exist`

**Resolution:**
- axe audit is scheduled for Phase 13 UI/UX review loop where Playwright (browser-native) tooling will replace axe-cli
- `scripts/audit-a11y.sh` remains correct and will pass in a non-snap Chromium environment or Docker
- All architectural guards that axe would catch (semantic HTML, aria-labels, focus management) were implemented per plan — see notes below

**Static A11Y confidence:**
- `ShortcutOverlay` Dialog uses `aria-labelledby={TITLE_ID}` and base-ui Dialog focus trap
- `ShortcutHelpButton` has `aria-label="Open keyboard shortcuts"`
- `EmptyState` hero icons use `aria-hidden="true"` (Phase 12-03)
- `CommandPalette` uses `aria-label="Command palette"` on DialogContent
- `Combobox.Group` uses `aria-label={GROUP_LABEL[gkey]}`
- No `role="alert"` or incorrect landmark roles introduced

Routes audited: BLOCKED (see above)
Violations found: UNKNOWN — pending Phase 13 browser audit
Fixes applied: N/A (blocked)
Excluded selectors + reason: N/A

**Open ticket for Phase 13:** Run `scripts/audit-a11y.sh` (or a Playwright-based replacement) against all 10 routes and zero out any serious/critical findings before UAT sign-off.

---

## Reduced motion (MOT-01/02/03)

**MOT-03 (.cae-shaking): VERIFIED**
- `@media (prefers-reduced-motion: reduce) { .cae-shaking { animation: none !important; } }` present in `app/globals.css` lines 197–201
- Confirmed by `app/motion-guard.test.ts` assertion (3/3 pass)

**MOT-01 (Wave-0 global block): VERIFIED**
- `@media (prefers-reduced-motion: reduce) { .animate-pulse, .animate-spin, .animate-ping, .animate-bounce { animation: none !important; } }` present in `app/globals.css` lines 205–212
- Confirmed by `app/motion-guard.test.ts` assertion (3/3 pass)

**MOT-02 (tw-animate-css): OVERRIDE ADDED**
- Assumption A3 confirmed FALSE: `tw-animate-css@1.4.0` dist file (`dist/tw-animate.css`) contains **0** `prefers-reduced-motion` rules
- Per plan Task 3 instructions, added per-utility overrides to `app/globals.css` after the MOT-01 block:

```css
/* Phase 12 (MOT-02): tw-animate-css@1.4.0 does NOT emit prefers-reduced-motion
   overrides (confirmed — zero occurrences in dist/tw-animate.css). Add explicit
   safety net for all animate-in/out, slide-in/out, fade-in/out, zoom-in/out
   utilities used by Dialog and DropdownMenu open animations. */
@media (prefers-reduced-motion: reduce) {
  .animate-in, .animate-out,
  [class*="slide-in-"], [class*="slide-out-"],
  [class*="fade-in-"], [class*="fade-out-"],
  [class*="zoom-in-"], [class*="zoom-out-"] {
    animation: none !important;
    transform: none !important;
  }
}
```

- DevTools emulation not possible in headless environment; CSS override is unconditional and correct by inspection
- Dialog open (`data-state="open"`) + DropdownMenu open animations use `animate-in` + `zoom-in-95` (confirmed by grepping `components/ui/dialog.tsx` and `components/ui/dropdown-menu.tsx`)

---

## Explain-mode QA (EQA-01/02)

**Parity (EQA-01): PASS**
- `./scripts/verify-explain-keys.sh` exits 0
- 11 keys verified in both FOUNDER and DEV blocks

**Copy spot-check (EQA-02):**

All 9 ExplainTooltip call sites reviewed:

| Key | FOUNDER copy (before) | FOUNDER copy (after) | Status |
|-----|----------------------|----------------------|--------|
| `floorExplainHub` | "Nexus routes work to agents — merge fireworks appear here" | (unchanged) | APPROVED — descriptive enough for non-devs |
| `chatExplainRail` | "Chat stays with you across tabs. Click the edge to expand." | (unchanged) | APPROVED |
| `changesExplainDevToggle` | "Flip to see the raw git details: branch name, SHAs, commit subjects, GitHub link." | "Flip to see the technical details: branch name, version IDs, change summaries, and a GitHub link." | REWRITTEN — "SHAs" replaced with "version IDs"; "commit subjects" → "change summaries" |
| `changesExplainTimeline` | "Every time CAE ships something, it lands here — newest first, grouped by project." | (unchanged) | APPROVED |
| `chatExplainSuggestions` | "Quick questions CAE can answer about this tab." | (unchanged) | APPROVED |
| `memoryExplainGraph` | "Arrows show which notes mention which." | (unchanged) | APPROVED |
| `memoryExplainSearch` | "Full-text search across every memory file." | (unchanged) | APPROVED |
| `memoryExplainRegenerate` | "Rebuilds the knowledge graph from current memory files." | (unchanged) | APPROVED |
| `memoryExplainWhy` | "These are the memory entries CAE actually read during this task." | (unchanged) | APPROVED |

1 rewrite applied (`changesExplainDevToggle`). 8 approved unchanged.

---

## Keybindings wiring (SHO-01)

- `./scripts/verify-keybindings-wiring.sh`: **PASS**
- Providers migrated: `explain-mode`, `dev-mode`, `use-sheet-keys`, `use-command-palette`, `use-shortcut-overlay`
- `matchesKeydown()` helper added to `lib/keybindings.ts` with 11 unit tests
- Cross-platform fallbacks preserved: Ctrl+K (win/linux) in `use-command-palette`, Shift+/ (US layout) in `use-shortcut-overlay`
- `openShortcuts` placeholder in `command-palette.tsx` wired to real `ShortcutOverlay.setOpen(true)`

---

## Open tickets for Phase 13

1. **axe audit blocked**: Run `scripts/audit-a11y.sh` (or Playwright equivalent) against all 10 routes in Phase 13 browser environment. Zero serious/critical required before UAT sign-off.
2. **MOT-02 DevTools confirmation**: Visually verify `animate-in` + `zoom-in-*` animations are suppressed under `prefers-reduced-motion: reduce` in Phase 13's Playwright screenshot loop.
3. **EQA-02 human sign-off**: Eric to review 9 ExplainTooltip founder strings (especially `floorExplainHub` — "merge fireworks" metaphor) during Phase 13 UAT walkthrough.
4. **palette.open cross-platform**: KEYBINDINGS registry uses "⌘" for palette.open — win/linux users get Ctrl+K via a fallback but the overlay shows "⌘K". Phase 13 should consider adding a second KEYBINDINGS entry `palette.open.win` or updating the chip rendering to show Ctrl on non-mac.
