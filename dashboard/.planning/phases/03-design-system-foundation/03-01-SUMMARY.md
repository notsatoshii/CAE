---
phase: 03-design-system-foundation
plan: 01
plan_id: p3-pl01
subsystem: design-system
tags: [tokens, dark-theme, typography, motion, shadcn]
requirements_completed:
  - dark-theme-tokens
  - geist-fonts
  - shake-keyframes
dependency_graph:
  requires: []
  provides:
    - "UI-SPEC §13 dark palette as CSS variables (#0a0a0a bg, #00d4ff accent, #e5e5e5 text)"
    - "Geist Sans + Geist Mono wired through @theme inline (--font-sans, --font-mono, --font-heading)"
    - "cae-shake keyframe (150ms translate3d X-axis) + .cae-shaking class"
    - "prefers-reduced-motion: reduce override that no-ops .cae-shaking"
    - "<html className=\"dark\"> anchor for shadcn dark: variants"
  affects:
    - "All shadcn components re-theme automatically via CSS variables (no component edits)"
    - "Every route now renders with dark tokens — signin, /ops, /build"
tech_stack:
  added: []
  patterns:
    - "Tailwind v4 inline @theme block (no tailwind.config.ts)"
    - "Raw palette tokens → shadcn semantic var aliasing in one :root block"
    - ".dark block mirrors :root (single-theme app; .dark kept to satisfy shadcn dark: contract)"
key_files:
  created: []
  modified:
    - "dashboard/app/globals.css"
    - "dashboard/app/layout.tsx"
decisions:
  - "Kept :root and .dark identical — app has no light mode; mirroring prevents silent mismatches if .dark ever unset"
  - "Hex tokens (not oklch) — matches UI-SPEC §13 source of truth verbatim"
  - "--primary mapped to --accent (cyan) so shadcn Button primary becomes CTA cyan immediately"
  - "--primary-foreground / --accent-foreground set to #0a0a0a so cyan buttons use near-black ink (4.5:1 contrast vs white which is too harsh on cyan)"
  - "Dropped duplicate self-referencing --font-sans in @theme inline; rewired to var(--font-geist-sans)"
metrics:
  tasks_completed: 2
  tasks_total: 2
  duration: "~15 minutes"
  completed: "2026-04-20"
commits:
  - hash: "03967a2"
    message: "feat(03-01): dark theme tokens + cae-shake keyframes in globals.css"
  - hash: "9907f4f"
    message: "feat(03-01): assert dark class on <html> so UI-SPEC tokens apply"
---

# Phase 3 Plan 01: Design system foundation — tokens + fonts + shake Summary

Dark-theme tokens, Geist font wiring, and the `cae-shake` keyframe are now live in `app/globals.css`; `<html>` carries `className="dark"` so the tokens actually render. Every downstream Phase 3 plan (providers, top-bar, routes, copy pass) can build against the real visual system without re-theming.

## What was built

### Task 1 — `app/globals.css` rewrite (commit `03967a2`)

Replaced the shadcn-default oklch neutral palette with UI-SPEC §13 hex tokens:

- **Raw palette:** `--bg #0a0a0a`, `--surface #121214`, `--surface-hover #1a1a1d`, `--border-subtle #1f1f22`, `--border-strong #2a2a2e`, `--text #e5e5e5`, `--text-muted #8a8a8c`, `--text-dim #5a5a5c`, `--accent #00d4ff`, `--accent-hover #33deff`, `--accent-muted #00d4ff20`, semantics (`--success #22c55e`, `--warning #f59e0b`, `--danger #ef4444`, `--info #3b82f6`).
- **Shadcn aliasing:** `--background = var(--bg)`, `--primary = var(--accent)`, `--primary-foreground = #0a0a0a`, `--border = var(--border-subtle)`, `--input = var(--border-strong)`, `--ring = var(--accent)`, sidebar vars all cyan-active. All existing shadcn components (Button, Card, Tabs, etc.) re-theme automatically through the existing `@theme inline { --color-*: var(--*) }` mappings — zero component source changes needed.
- **`.dark` block** mirrors `:root` verbatim (single-theme app; kept for shadcn `dark:` variants).
- **`@theme inline`:** added `--font-sans: var(--font-geist-sans)`, `--font-mono: var(--font-geist-mono)`, `--font-heading: var(--font-geist-sans)`. Removed the dead self-referencing `--font-sans: var(--font-sans)` placeholder.
- **Shake motion** (appended at file end):
  ```css
  @keyframes cae-shake {
    0%,100% { transform: translate3d(0,0,0); }
    20%     { transform: translate3d(-3px,0,0); }
    40%     { transform: translate3d( 3px,0,0); }
    60%     { transform: translate3d(-2px,0,0); }
    80%     { transform: translate3d( 2px,0,0); }
  }
  .cae-shaking { animation: cae-shake 150ms ease-out 1; will-change: transform; }
  @media (prefers-reduced-motion: reduce) {
    .cae-shaking { animation: none !important; }
  }
  ```

### Task 2 — `<html className="dark">` (commit `9907f4f`)

One-line change in `app/layout.tsx`: `<html lang="en">` → `<html lang="en" className="dark">`. This anchors the `.dark` CSS block AND lets shadcn's `@custom-variant dark (&:is(.dark *));` resolve `dark:` Tailwind variants (e.g., `dark:bg-input/30` on Button). Without it, any shadcn component with `dark:*` branch renders the light branch.

Geist font loaders (body `${geistSans.variable} ${geistMono.variable} antialiased`) untouched.

## What was tested

### Automated (Task 1)
- `grep -c "#0a0a0a" app/globals.css` → **8**
- `grep -c "#00d4ff" app/globals.css` → **4**
- `grep -c "@keyframes cae-shake" app/globals.css` → **1**
- `grep -c "prefers-reduced-motion" app/globals.css` → **1**
- `grep -c '@import "tailwindcss"' app/globals.css` → **1**
- `grep "--font-sans:\s*var(--font-geist-sans)"` matches
- `npx tsc --noEmit` → clean (no output)
- `pnpm build` → `✓ Compiled successfully in 5.7s`, static pages 6/6 generated

### Automated (Task 2 dev-server gate)
Started dev server on port 3040 (port 3000 was already occupied; verified server came up with "Ready in 416ms"):

- `GET /signin` → HTTP 200
- Rendered HTML: `<html lang="en" class="dark">` ✓
- Body class: `geist_..._variable geist_mono_..._variable antialiased` ✓ (Geist font wired — body class names use Next's hashed `__variable` form, confirmed present)
- Fetched CSS chunk `/_next/static/chunks/[root-of-the-server]__06.-pfn._.css` (83 KB):
  - `#0a0a0a` → **8** occurrences ✓
  - `#00d4ff` → **4** occurrences ✓
  - `cae-shake` → **2** occurrences (keyframe def + `.cae-shaking` rule) ✓
  - `prefers-reduced-motion` → **1** occurrence ✓
  - `font-geist-sans` → **7** occurrences ✓
  - `font-family: Geist` in `@font-face` block ✓

All automated acceptance criteria from the plan pass.

### Manual visual confirmation
Not performed in this sequential run (no browser available). Manual verification deferred to user — load `http://localhost:3000/signin` in a browser and confirm near-black bg + light Geist text. Automated gate already proves the wiring reaches the rendered CSS.

## Deviations from Plan

None — plan executed exactly as written.

The pre-existing Turbopack NFT warning on `next.config.ts` was observed during `pnpm build` but is not caused by this plan's changes (it was present in `main` before Task 1). Out of scope per SCOPE BOUNDARY rule. Not logged to `deferred-items.md` because it is already tracked upstream (Phase 2 artifact).

## Issues found (out of scope)

- Middleware deprecation warning: `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.` — already deferred to Phase 12 polish per CONTEXT.md §Middleware gotcha.

## Known stubs

None. All tokens resolve to real values; no hardcoded empty arrays, no placeholder text, no components awaiting data wires. The design system is complete at this foundation layer — Plan 02+ will consume it.

## Threat flags

None. This plan touches only CSS variables and one class attribute. No new network endpoints, auth paths, file access, or schema changes.

## Self-Check: PASSED

- Modified files exist:
  - `dashboard/app/globals.css` — FOUND (195 lines, contains all required tokens + keyframes + media query)
  - `dashboard/app/layout.tsx` — FOUND (40 lines, `<html lang="en" className="dark">`)
- Commits exist in `main`:
  - `03967a2` — FOUND (`git log --oneline` shows `feat(03-01): dark theme tokens + cae-shake keyframes in globals.css`)
  - `9907f4f` — FOUND (`feat(03-01): assert dark class on <html> so UI-SPEC tokens apply`)
- Automated phase-level checks all pass (build clean, grep criteria all satisfied, dev-server CSS bundle contains all literals).
