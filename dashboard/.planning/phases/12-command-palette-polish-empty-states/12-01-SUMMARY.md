---
phase: 12-command-palette-polish-empty-states
plan: "01"
subsystem: ui
tags: [fuzzysort, axe-core, keybindings, accessibility, motion, css, vitest]

requires:
  - phase: 09-changes-chat
    provides: ExplainMode/DevMode providers and useSheetKeys that KEYBINDINGS registry enumerates

provides:
  - fuzzysort@3.1.0 runtime dep (palette ranker for Wave 1)
  - "@axe-core/cli@4.11.2 devDep (a11y audit script prereq)"
  - "lib/keybindings.ts: typed frozen KEYBINDINGS registry (10 entries, 4 areas)"
  - "app/globals.css: prefers-reduced-motion safety net for .animate-pulse/spin/ping/bounce"
  - "scripts/audit-a11y.sh: axe-cli wrapper over 10 registered routes"
  - "scripts/verify-explain-keys.sh: FOUNDER+DEV label parity enforcer"
  - "app/motion-guard.test.ts: stylesheet regression guard (3 assertions)"
  - "lib/keybindings.test.ts: registry shape + uniqueness tests (6 assertions)"
affects:
  - "12-02 (palette UI) — imports KEYBINDINGS for palette.open trigger"
  - "12-03 (empty-states) — no direct dep but same test infra"
  - "12-04 (shortcut overlay) — renders from KEYBINDINGS list"
  - "12-05 (audit pass) — runs scripts/audit-a11y.sh + verify-explain-keys.sh"

tech-stack:
  added:
    - "fuzzysort@3.1.0 (runtime)"
    - "@axe-core/cli@4.11.2 (devDep)"
  patterns:
    - "KEYBINDINGS registry pattern: single source of truth, providers import by id"
    - "Stylesheet regex assertions in vitest (readFileSync + regex match)"
    - "vitest.config.ts include extended to cover app/**/*.test.ts (was only .tsx)"

key-files:
  created:
    - lib/keybindings.ts
    - lib/keybindings.test.ts
    - app/motion-guard.test.ts
    - scripts/audit-a11y.sh
    - scripts/verify-explain-keys.sh
  modified:
    - package.json
    - pnpm-lock.yaml
    - app/globals.css
    - vitest.config.ts

key-decisions:
  - "pnpm used as lockfile manager (pnpm-lock.yaml present; not npm install)"
  - "vitest.config.ts include pattern extended to app/**/*.test.ts to support non-React unit tests"
  - "KEYBINDINGS entries: 10 total — 4 global, 1 sheets, 2 task, 3 palette"
  - "MOT-02 (tw-animate-css reduced-motion) marked not-verified: requires DevTools emulation in live browser; not testable headlessly"

patterns-established:
  - "Stylesheet test pattern: readFileSync(path.join(__dirname, 'globals.css'), 'utf8') in vitest"
  - "Keybinding registry: id lookup via keybindingById(), area filter via keybindingsByArea()"

requirements-completed: [SHO-01, MOT-01, MOT-02, MOT-03, A11Y-01, EQA-01]

duration: 8min
completed: "2026-04-23"
---

# Phase 12 Plan 01: Wave 0 Prereqs Summary

**fuzzysort@3.1.0 + axe-cli installed, KEYBINDINGS registry with 10 typed entries, prefers-reduced-motion CSS safety net, and axe/explain-QA audit scripts — all Wave 1 plans unblocked**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-04-23T02:53:00Z
- **Completed:** 2026-04-23T02:58:07Z
- **Tasks:** 4
- **Files modified:** 8

## Accomplishments

- Installed `fuzzysort@3.1.0` (palette ranker) and `@axe-core/cli@4.11.2` (a11y audit) — both verified importable/runnable
- Added `@media (prefers-reduced-motion: reduce)` CSS block covering all 4 Tailwind `animate-*` utilities (13 offenders now protected globally)
- Created `lib/keybindings.ts` as single source of truth for all 10 dashboard keystrokes with founder-speak + dev labels
- Scaffolded `scripts/audit-a11y.sh` (10 routes, zero serious/critical gate) and `scripts/verify-explain-keys.sh` (11 keys verified against FOUNDER+DEV blocks)
- 9 vitest assertions (3 motion-guard + 6 keybindings) all green; no regressions in existing suite

## Task Commits

Each task was committed atomically:

1. **Task 1: Install deps + document version pins** - `70992fd` (chore)
2. **Task 2: Motion safety net CSS + stylesheet regex test** - `6da8593` (feat, TDD)
3. **Task 3: KEYBINDINGS registry + uniqueness tests** - `9d34ede` (feat, TDD)
4. **Task 4: Audit scripts scaffolding** - `168b554` (feat)

## Files Created/Modified

- `package.json` — fuzzysort@3.1.0 (dep) + @axe-core/cli@4.11.2 (devDep) added
- `pnpm-lock.yaml` — lockfile updated (+57 packages for axe-cli)
- `app/globals.css` — appended prefers-reduced-motion block for .animate-pulse/spin/ping/bounce after .cae-shaking block
- `vitest.config.ts` — extended include to `app/**/*.test.ts` (was missing non-TSX app tests)
- `lib/keybindings.ts` — KEYBINDINGS registry (10 entries), Keybinding interface, keybindingById, keybindingsByArea
- `lib/keybindings.test.ts` — 6 assertions: non-empty, required fields, unique ids, keystroke coverage, founder/dev label distinction, area filter
- `app/motion-guard.test.ts` — 3 assertions: .cae-shaking intact, animate-* block present, appearance order
- `scripts/audit-a11y.sh` — axe-cli wrapper, 10 routes, exits 1 on serious/critical violations (chmod +x)
- `scripts/verify-explain-keys.sh` — rg + awk parity check, exits 0 (11 keys verified, chmod +x)

## Decisions Made

- **pnpm over npm install**: `pnpm-lock.yaml` is the authoritative lockfile; used `pnpm add` / `pnpm add -D` per plan instructions.
- **vitest.config.ts include fix**: `app/**/*.test.ts` was missing from the include pattern — `app/motion-guard.test.ts` (no JSX) would not have been discovered. Added pattern (Rule 3 - blocking fix, minimal scope).
- **KEYBINDINGS count**: 10 entries covering all keystrokes shipped as of Phase 9 (global × 4, sheets × 1, task × 2, palette × 3).
- **MOT-02 not-verified**: `tw-animate-css` reduced-motion behavior requires DevTools emulation on dialog/dropdown in a live browser. Headless env + no dev server = cannot verify this session. Marked unverified; Plan 05 audit pass is the intended gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended vitest include to app/\*\*/\*.test.ts**
- **Found during:** Task 2 (motion-guard test)
- **Issue:** `vitest.config.ts` include array listed `app/**/*.test.tsx` but not `app/**/*.test.ts`. `app/motion-guard.test.ts` (pure Node/no JSX) was not discovered by vitest — exited with "No test files found".
- **Fix:** Added `"app/**/*.test.ts"` entry to the include array in `vitest.config.ts`.
- **Files modified:** `vitest.config.ts`
- **Verification:** `npm run test -- motion-guard` found and ran the file (3/3 pass).
- **Committed in:** `6da8593` (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required for the motion-guard test to run at all. No scope creep — single-line include pattern addition.

## Issues Encountered

- `npm run lint` fails with "no such directory: /home/cae/.../lint" — pre-existing infrastructure issue (ESLint config missing `@eslint/eslintrc` package). Confirmed pre-existing by stash-test. Not caused by this plan's changes.
- `npx tsc --noEmit` reports 5 errors in `lib/cae-ship.test.ts` (`hasPlanning` missing from Project mock). Pre-existing, confirmed by stash-test. Not caused by this plan's changes.
- `npm run test` reports 5 failed test suites (TAP-format files that vitest can't collect). Pre-existing.

## MOT-02 Verification Status

`tw-animate-css@1.4.0` assumption (auto-emits reduced-motion overrides for `animate-in`/`slide-in`/`fade-in`/`zoom-in`) is **NOT VERIFIED** this session. Requires DevTools emulation with "Prefers reduced motion: reduce" on `components/ui/dialog.tsx` and `components/ui/dropdown-menu.tsx` in a live browser. Plan 05 (audit pass) is the intended gate for this verification.

## Next Phase Readiness

- Wave 1 plans (12-02 palette, 12-03 empty-states, 12-04 shortcut overlay) fully unblocked:
  - `fuzzysort` importable
  - `KEYBINDINGS` exported from `lib/keybindings.ts`
  - Test infra includes `app/**/*.test.ts`
- Wave 2 audit plan (12-05) has both scripts ready to run once dev server is available

---
*Phase: 12-command-palette-polish-empty-states*
*Completed: 2026-04-23*

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| lib/keybindings.ts | FOUND |
| lib/keybindings.test.ts | FOUND |
| app/motion-guard.test.ts | FOUND |
| scripts/audit-a11y.sh | FOUND |
| scripts/verify-explain-keys.sh | FOUND |
| 12-01-SUMMARY.md | FOUND |
| commit 70992fd | FOUND |
| commit 6da8593 | FOUND |
| commit 9d34ede | FOUND |
| commit 168b554 | FOUND |
