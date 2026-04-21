---
phase: 03-design-system-foundation
plan: 02
subsystem: providers + shake hook + root-layout wiring
tags: [providers, hooks, layout, sonner, a11y]
dependency-graph:
  requires:
    - p3-pl01
    - p3-pl06
  provides:
    - useExplainMode hook (from @/lib/providers/explain-mode)
    - useDevMode hook (from @/lib/providers/dev-mode)
    - useScreenShake hook (from @/lib/hooks/use-screen-shake)
    - global <Toaster /> mount so any client component can call toast() from 'sonner'
  affects:
    - app/layout.tsx (provider + Toaster wrap)
tech-stack:
  added: []
  patterns:
    - React context provider + hook per file
    - useCallback on state setters so consumers stay stable
    - SSR-safe localStorage access via useEffect (not useState initializer)
    - window keydown listener with editable-target guard (input/textarea/contentEditable)
    - remove+reflow+add pattern for CSS animation restart
key-files:
  created:
    - dashboard/lib/providers/explain-mode.tsx
    - dashboard/lib/providers/dev-mode.tsx
    - dashboard/lib/hooks/use-screen-shake.ts
  modified:
    - dashboard/app/layout.tsx
decisions:
  - Stored persisted explain default uses string check `stored === "false"` so missing key falls through to default `true` (matches UI-SPEC S4.6 "default ON")
  - Stored persisted dev default uses `stored === "true"` so missing key falls through to default `false`
  - preventDefault() on matched shortcut to suppress browser's default Ctrl+E (focus address bar on some browsers) and Ctrl+Shift+D (bookmark all tabs on Chrome)
  - Toaster mounted inside DevModeProvider subtree (sonner portals to body at runtime, so z-order unaffected; placement keeps it within provider scope + hydration-deterministic after {children})
metrics:
  duration: ~8 minutes
  completed: 2026-04-20
  tasks: 3
  commits: 3
---

# Phase 03 Plan 02: Global providers + screen-shake hook Summary

Ship the two global React providers (ExplainMode default ON / Ctrl+E, DevMode default OFF / Cmd+Shift+D) plus the `useScreenShake` hook, and wrap the root layout in both providers with sonner's `<Toaster />` mounted so any component can call `toast()`.

## What Shipped

### `lib/providers/explain-mode.tsx` (63 lines, `"use client"`)
- `ExplainModeProvider` component + `useExplainMode()` hook
- Default state: `explain = true`; hydrated from `localStorage.explainMode === "false"` on mount
- Persists on every change
- Global Ctrl+E listener (no meta/shift/alt, skips input/textarea/contentEditable, calls `preventDefault`)
- Hook throws `"useExplainMode must be used inside ExplainModeProvider"` outside provider

### `lib/providers/dev-mode.tsx` (63 lines, `"use client"`)
- `DevModeProvider` component + `useDevMode()` hook
- Default state: `dev = false`; hydrated from `localStorage.devMode === "true"` on mount
- Global `(metaKey || ctrlKey) && shiftKey && !altKey && key === 'd'` listener — Cmd+Shift+D (mac) / Ctrl+Shift+D (win/linux)
- Same editable-target guard + preventDefault
- Hook throws outside provider

### `lib/hooks/use-screen-shake.ts` (31 lines, `"use client"`)
- Returns `{ shake }`; adds `.cae-shaking` class to `document.body` for 160ms (matches Plan 01 150ms keyframe + buffer)
- Restart-clean pattern: `remove` → `void body.offsetWidth` (reflow) → `add` so consecutive calls re-trigger the animation
- Early-returns under `window.matchMedia("(prefers-reduced-motion: reduce)").matches`
- SSR-safe: `typeof document/window === "undefined"` guards

### `app/layout.tsx` (diff)
- Added imports for `ExplainModeProvider`, `DevModeProvider`, `Toaster`
- Body JSX wrapped: `<ExplainModeProvider><DevModeProvider>{TopNav}{children}<Toaster /></DevModeProvider></ExplainModeProvider>`
- `<html lang="en" className="dark">` untouched (Plan 01 locked it)
- Layout remains async server component; providers + Toaster become client boundaries rendered inside the server tree

## Verification Results

- `npx tsc --noEmit` — clean (Task 1 + Task 2 runs)
- `pnpm build` — clean: "Compiled successfully in 6.7s", all 6 static pages generated, middleware builds
- Grep verification for all three tasks — all patterns matched:
  - Both providers start with `"use client"`, export Provider + `use*` hook
  - `lib/providers/explain-mode.tsx` references `explainMode` (localStorage key)
  - `lib/providers/dev-mode.tsx` references `devMode` (localStorage key)
  - `lib/hooks/use-screen-shake.ts` references `cae-shaking` + `prefers-reduced-motion`; file is 31 lines (under 40-line cap)
  - `app/layout.tsx` contains `ExplainModeProvider`, `DevModeProvider`, `Toaster`, and import paths `@/lib/providers/explain-mode`, `@/lib/providers/dev-mode`, `@/components/ui/sonner`
- Dev-server live curl:
  - `curl http://localhost:3002/signin` → HTTP 200 (port 3000 was bound by an unrelated process, Next turbopack auto-picked 3002 — expected Next behavior, not a regression)
  - Response HTML contains `antialiased` body class and `class="dark"` on `<html>` — confirms root layout is rendering through providers
- Manual checks (documented, not automated):
  - Ctrl+E in an authed page flips `localStorage.explainMode` ("true" ↔ "false") and toggles React context
  - Cmd/Ctrl+Shift+D flips `localStorage.devMode`
  - `document.body.classList.add('cae-shaking')` triggers animation in a normal session; under system `prefers-reduced-motion: reduce` the Plan 01 CSS rule and the hook's early-return both no-op
  - `import { toast } from 'sonner'; toast.success('hi')` renders a visible toast from the Plan 06 `<Toaster />`

## Commits

- `0822fa0` — `feat(03-02): add ExplainMode + DevMode global providers`
- `32edecc` — `feat(03-02): add useScreenShake hook honoring reduced-motion`
- `e2fb7ff` — `feat(03-02): wrap root layout in ExplainMode + DevMode providers`

## Deviations from Plan

None — plan executed exactly as written.

## Downstream Consumers (contracts now live)

- **Plan 03 (top-bar refactor)** — can `import { useDevMode } from "@/lib/providers/dev-mode"` to render the `dev` badge + flip labels
- **Plan 05 (heading client-islands)** — can use `useDevMode()` for label flips
- **Phase 9 (Changes + chat)** — can import `useScreenShake` and invoke `shake()` on Sentinel merge SSE events
- **Any client component** — can `import { toast } from "sonner"` + call `toast.success(...)`

## Known Stubs

None. All three files implement the full contract specified in the plan's `<interfaces>` block; no placeholder data flows to UI.

## Self-Check: PASSED

Files verified on disk:
- `FOUND: dashboard/lib/providers/explain-mode.tsx`
- `FOUND: dashboard/lib/providers/dev-mode.tsx`
- `FOUND: dashboard/lib/hooks/use-screen-shake.ts`
- `FOUND: dashboard/app/layout.tsx` (modified)

Commits verified via `git log --oneline -5`:
- `FOUND: 0822fa0` — providers
- `FOUND: 32edecc` — useScreenShake
- `FOUND: e2fb7ff` — layout wrap
