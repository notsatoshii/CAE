---
phase: 17
plan: W1-hydration-mismatch
wave: 1
name: Fix SSR/CSR hydration mismatches on /, /build/security/audit, /build/workflows — 20 console errors
---

# W1 — Hydration mismatches

## Context

Auto-audit hit #4. 20 page-error events across `/`, `/build/security/audit`, `/build/workflows`. Error body:

```
Hydration failed because the server rendered text didn't match the client.
As a result this tree will be regenerated on the client.
```

Common causes in this codebase: `new Date()` / `Date.now()` / `Math.random()` called during render; client-only env reads (localStorage, window.*) without `useEffect`; timezone-aware strings formatted differently SSR vs CSR; feature flags / cookies read differently on the two sides.

## Task

<task>
<name>Diagnose + fix SSR/CSR divergence on /, /build/security/audit, /build/workflows</name>

<files>
app/page.tsx
app/build/security/audit/page.tsx
app/build/workflows/page.tsx
components/build-home/**/*.tsx
components/security/**/*.tsx
components/workflows/**/*.tsx
</files>

<action>
1. For each affected route, open the page.tsx + its component tree. Enable React's hydration-diff logging in dev (Next.js already does this) and capture the divergent tree.
2. Scan for these patterns in render paths:
   - `new Date()` / `Date.now()` / `Math.random()` (use `useEffect` state or pass through server-to-client prop)
   - `localStorage`/`sessionStorage`/`window.*`/`navigator.*` direct reads (move behind `useEffect` + `useState`)
   - `document.*`, `matchMedia`, `getComputedStyle` used during render
   - `Intl.DateTimeFormat` / `toLocaleString` without explicit locale + timezone (e.g. the JST timezone fix pattern from commit 5ad1d01)
   - `process.env.*` reads that differ client vs server (use NEXT_PUBLIC_* for client reads)
3. Fix each one. Prefer the `useEffect`+state pattern over `suppressHydrationWarning` — the warning exists to surface real bugs.
4. Where dynamic content MUST differ SSR vs CSR (e.g. relative-time labels), render the SSR placeholder + swap-in with `useEffect`. Or mark the component `"use client"` + wrap in `next/dynamic` with `ssr: false`.
5. Add a vitest test per page that renders through `renderToStaticMarkup` and asserts no "use state" hooks are referenced during render (catches new regressions).
</action>

<verify>
1. `pnpm vitest run` — all green.
2. Re-run audit capture + score. C6 page_errors for "Hydration failed" must be ZERO.
3. Reliability pillar on `/`, `/build/security/audit`, `/build/workflows` must improve ≥1 level.
</verify>
</task>
