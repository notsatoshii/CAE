---
phase: 17
plan: W1-router-action-init
wave: 1
name: Fix Router action dispatched before initialization (Next.js internal) — 251 console errors
---

# W1 — Router action dispatched before initialization

## Context

Auto-audit hit #1 from `FINDINGS.md`. 251 page-error events across 12+ routes (/build, /build/security/audit, /build/skills, /build/workflows/new, /floor/popout, ...). Sample error body:

```
Internal Next.js error: Router action dispatched before initialization.
```

This fires when a component calls `router.push/replace/refresh` (from `next/navigation`) in a module-level init, a `useEffect` that runs before the router context mounts, or inside a server component on the client transition. On Next.js 16 the symptom is a hard page-error that kills Suspense boundaries.

## Task

<task>
<name>Locate + fix all router.push/replace/refresh calls that fire before router mount</name>

<files>
components/**/*.tsx
app/**/page.tsx
app/**/layout.tsx
hooks/**/*.ts
lib/**/*.ts
</files>

<action>
1. `rg -n "useRouter|router\.(push|replace|refresh|back|forward)"` across components/, app/, hooks/, lib/.
2. For each hit: confirm call-site is (a) inside an event handler, (b) inside a useEffect whose deps guarantee the router is mounted, OR (c) gated by `if (typeof window !== 'undefined')`. Every other call-site is a bug.
3. Specifically audit:
   - Any module-level `router` references (should be none — useRouter is a hook).
   - `useEffect(() => router.push(...), [])` without a condition — common culprit when page mounts during Suspense fallback.
   - Redirects triggered during render (move to `redirect()` from `next/navigation` for server components, or defer to `useEffect` + optional chain for client).
4. Where a redirect is required pre-render, replace with `redirect()` from `next/navigation` (server-side) or `notFound()` where appropriate.
5. Add a `hooks/use-safe-router.ts` wrapper if recurrent: returns `{ push, replace, refresh }` that no-op until first `useEffect` tick. Migrate the busiest offenders to it.
6. Add vitest unit test stubs asserting the wrapper behavior (noop before mount, passthrough after).
</action>

<verify>
1. `pnpm vitest run` — all green.
2. `pnpm build` — no Next.js warnings about router initialization.
3. Re-run audit capture + score; C6 must show ZERO occurrences of "Router action dispatched before initialization" across `audit/shots/healthy/*/*.console.json`.
4. Per-route reliability pillar on /build, /build/security/audit, /build/skills, /build/workflows/new, /floor/popout must improve ≥1 level.
</verify>
</task>
