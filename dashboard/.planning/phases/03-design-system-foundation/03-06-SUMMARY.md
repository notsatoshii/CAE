---
phase: 03-design-system-foundation
plan: 06
subsystem: ui

tags: [shadcn, base-ui, dialog, sonner, scroll-area, toast, dark-theme, primitives]

# Dependency graph
requires:
  - phase: 03-design-system-foundation
    provides: "Plan 01 — dark theme CSS variables (bg-popover, text-muted-foreground, --border, --radius, etc.) in app/globals.css"
provides:
  - "components/ui/dialog.tsx — shadcn Dialog primitive (base-ui backed)"
  - "components/ui/sonner.tsx — shadcn sonner Toaster (dark-only, no next-themes)"
  - "components/ui/scroll-area.tsx — shadcn ScrollArea + ScrollBar (base-ui backed)"
  - "sonner npm dep available for future Toaster mounting (Plan 02 root layout)"
affects: [03-02 providers/top-bar, 04-build-home, 09-chat-scroll-messages]

# Tech tracking
tech-stack:
  added: ["sonner@^2.0.7"]
  patterns:
    - "Base-ui primitives (not Radix) matching existing shadcn components via style=\"base-nova\""
    - "Dark-only Toaster — hardcoded theme=\"dark\" instead of next-themes useTheme hook"
    - "CSS-variable theming via Plan 01 tokens (bg-popover, text-muted-foreground, --border, --radius)"

key-files:
  created:
    - "dashboard/components/ui/dialog.tsx"
    - "dashboard/components/ui/sonner.tsx"
    - "dashboard/components/ui/scroll-area.tsx"
  modified:
    - "dashboard/package.json (added sonner dep; next-themes transient)"
    - "dashboard/pnpm-lock.yaml"

key-decisions:
  - "Base-ui backing (not Radix) — generator chose base-ui due to components.json style=\"base-nova\"; matches existing Sheet / DropdownMenu / Tabs primitives"
  - "Hardcoded Toaster theme=\"dark\" instead of reading next-themes (UI-SPEC locks dark-only)"
  - "Removed next-themes from dependencies after patching — zero usages across codebase"

patterns-established:
  - "Sonner integration pattern: drop next-themes, use theme=\"dark\" as const — repeat for any future shadcn primitive that ships with useTheme"

requirements-completed:
  - shadcn-primitive-dialog
  - shadcn-primitive-sonner
  - shadcn-primitive-scroll-area

# Metrics
duration: ~9min
completed: 2026-04-21
---

# Phase 03 Plan 06: shadcn primitives (Dialog + Sonner + ScrollArea) Summary

**Three missing shadcn primitives (Dialog, sonner Toaster, ScrollArea) installed via shadcn CLI and wired to Plan 01's dark theme; sonner patched to drop next-themes and hardcode dark.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-04-21T09:56Z
- **Completed:** 2026-04-21T10:04:34Z
- **Tasks:** 2
- **Files created:** 3
- **Files modified:** 2 (package.json, pnpm-lock.yaml)

## Accomplishments

- `components/ui/dialog.tsx` — full shadcn Dialog primitive set (Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogOverlay, DialogPortal) backed by `@base-ui/react/dialog`
- `components/ui/sonner.tsx` — Toaster wrapping upstream `sonner`, hardcoded `theme = "dark"` (no next-themes)
- `components/ui/scroll-area.tsx` — ScrollArea + ScrollBar backed by `@base-ui/react/scroll-area`
- All three files use `cn` from `@/lib/utils` and CSS-variable classes (`bg-popover`, `text-muted-foreground`, `bg-border`, `var(--popover)`, `var(--radius)`) so Plan 01's dark theme applies automatically
- Phase 3's committed component library surface is now complete: Button / Card / Tabs / **Dialog** / Sheet / **Sonner** / DropdownMenu / **ScrollArea** / Separator / Avatar / Badge / Input / Label / Table / Textarea

## Task Commits

1. **Task 1: Install Dialog + Sonner + ScrollArea via shadcn CLI** — `85c6159` (feat)
2. **Task 2: Patch sonner.tsx to drop next-themes + confirm tsc clean** — `8b87380` (refactor)

## Files Created/Modified

- `dashboard/components/ui/dialog.tsx` — base-ui-backed shadcn Dialog primitive (160 lines, 10 named exports)
- `dashboard/components/ui/sonner.tsx` — sonner Toaster wrapper, dark-only, lucide icons (49 lines, exports `Toaster`)
- `dashboard/components/ui/scroll-area.tsx` — base-ui-backed ScrollArea + ScrollBar (55 lines, 2 named exports)
- `dashboard/package.json` — `sonner ^2.0.7` added; `next-themes` added by CLI then removed after patch
- `dashboard/pnpm-lock.yaml` — lock updated

## Decisions Made

1. **Base-ui (not Radix) backing.** Plan expected `@radix-ui/react-dialog` + `@radix-ui/react-scroll-area` deps, but `components.json` declares `style="base-nova"` and existing primitives (Sheet, DropdownMenu, Tabs, Button) all use `@base-ui/react`. The CLI correctly generated base-ui-backed primitives, matching the existing project convention. Plan acceptance criteria were written against the wrong primitive library but the **truth** acceptance criteria (exports, `cn` import, CSS-variable classes, `"use client"` directive) all pass.
2. **Hardcoded `theme = "dark" as const` in sonner.tsx.** UI-SPEC locks dark-only; no theme switcher. Simpler than wiring `next-themes` for a value that will never change.
3. **Removed `next-themes` from deps entirely** (executor discretion per plan). Zero usages across the codebase after patching — dead dep. Keeps the tree lean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan acceptance criteria referenced wrong primitive library**
- **Found during:** Task 1 (reading shadcn-generated output)
- **Issue:** Plan's `<interfaces>` + `<automated>` verification expected `@radix-ui/react-dialog` and `@radix-ui/react-scroll-area` in package.json. Actual shadcn CLI output for this project (style="base-nova") uses `@base-ui/react/dialog` and `@base-ui/react/scroll-area`. `@base-ui/react` was already in deps from Phase 1+2, so no new deps were added for Dialog / ScrollArea.
- **Fix:** Verified against the plan's `must_haves.truths` (exports, cn import, CSS-variable classes, use-client directive) which are all satisfied. Adjusted verification grep targets accordingly. `sonner` dep was correctly added as expected.
- **Files modified:** None — generator output was correct for this project's configuration; the plan's assumptions were stale.
- **Verification:** `grep -E '"@base-ui/react"|"sonner"' package.json` confirms both present. All named exports (Dialog, Toaster, ScrollArea, ScrollBar, plus the full Dialog sub-primitive set) verified.
- **Committed in:** 85c6159

**2. [Rule 1 - Dead code cleanup] Removed next-themes dep after sonner patch**
- **Found during:** Task 2 (after removing `useTheme` import from sonner.tsx)
- **Issue:** Shadcn CLI auto-added `next-themes` during Task 1. After Task 2's hardcoded-dark patch, `next-themes` has zero usages project-wide (`grep -rn "next-themes"` returns empty across src).
- **Fix:** `pnpm remove next-themes` — plan explicitly authorized at executor discretion.
- **Files modified:** dashboard/package.json, dashboard/pnpm-lock.yaml
- **Verification:** `npx tsc --noEmit` exits 0; `pnpm build` completes successfully with 6/6 static pages generated.
- **Committed in:** 8b87380

---

**Total deviations:** 2 auto-fixed (1 plan-vs-reality correction, 1 dead-code cleanup)
**Impact on plan:** Both deviations align with plan intent (three primitives, dark theme, lean deps). No scope creep. Plan's truth acceptance criteria all satisfied; only the outdated Radix dep assumptions were corrected.

## Issues Encountered

- **sonner.tsx references `React.CSSProperties` inline** without an explicit `import * as React from "react"` statement. This works because Next.js + modern TypeScript provides the JSX namespace globally. tsc passes. Left as-is — matches shadcn generator output and works.
- **Pre-existing repo state unrelated to this plan** (modifications to `dashboard/AGENTS.md`, `app/page.tsx`, `next.config.ts`, etc. from prior sessions) were excluded from the task commits per scope-boundary rule. Only files directly touched by this plan were staged.

## Verification Results

- `components/ui/dialog.tsx` exists with 10 named exports — ✅
- `components/ui/sonner.tsx` exists, exports Toaster, no next-themes import — ✅
- `components/ui/scroll-area.tsx` exists, exports ScrollArea + ScrollBar — ✅
- `package.json` has sonner, `@base-ui/react` (instead of radix) — ✅ (deviation 1)
- `next-themes` absent from deps and source — ✅
- `npx tsc --noEmit` exits 0 — ✅
- `pnpm build` completes (6/6 pages generated) — ✅

## Next Phase Readiness

- **Plan 02 can mount `<Toaster />`** from `@/components/ui/sonner` in the root layout — no next-themes dep gymnastics required.
- **Phase 4 Build Home** can use `Dialog` for confirmation modals (e.g., "Are you sure you want to abort this phase?").
- **Phase 9 Chat** can use `ScrollArea` for the message pane.
- **Dark-theme tokens** from Plan 01 (`--popover`, `--popover-foreground`, `--border`, `--radius`) flow through all three primitives automatically.

No blockers.

## Self-Check: PASSED

Files verified on disk:
- FOUND: dashboard/components/ui/dialog.tsx
- FOUND: dashboard/components/ui/sonner.tsx
- FOUND: dashboard/components/ui/scroll-area.tsx

Commits verified in git log:
- FOUND: 85c6159 (Task 1 — feat add three primitives)
- FOUND: 8b87380 (Task 2 — refactor drop next-themes)

Build + typecheck verified:
- FOUND: tsc --noEmit exit 0
- FOUND: pnpm build exit 0 (6/6 static pages)

---
*Phase: 03-design-system-foundation*
*Completed: 2026-04-21*
