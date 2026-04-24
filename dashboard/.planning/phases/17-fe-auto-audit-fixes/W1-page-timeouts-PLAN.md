---
phase: 17
plan: W1-page-timeouts
wave: 1
name: Fix 20s page.goto timeouts on /memory /plan /build/skills* /build/security /build/queue /signin — 40+ hits
---

# W1 — Page navigation timeouts

## Context

Auto-audit hit #6. 40+ `page.goto: Timeout 20000ms exceeded` failures spread across /memory, /plan, /metrics (covered in metrics plan), /build/skills, /build/skills/installed, /build/security, /build/queue, /signin. Playwright navigates with `waitUntil: "domcontentloaded"` — timing out means DOMContentLoaded never fires within 20s. Root cause is usually a blocking resource (a sync script, a stuck dynamic import, or an in-flight `fetch` that prevents the event loop from settling).

## Task

<task>
<name>Diagnose + fix blocking loads on slow routes</name>

<files>
app/memory/page.tsx
app/plan/page.tsx
app/build/skills/page.tsx
app/build/skills/installed/page.tsx
app/build/security/page.tsx
app/build/queue/page.tsx
app/signin/page.tsx
components/memory/**/*.tsx
components/plan/**/*.tsx
components/skills/**/*.tsx
components/security/**/*.tsx
components/queue/**/*.tsx
components/signin/**/*.tsx
</files>

<action>
1. For each slow route, start dev server, open in Chrome devtools → Network + Performance panels, reload with cache disabled. Identify what's pending past 20s.
2. Common culprits in this codebase:
   - A server-side `await` on a slow backend fetch (Redis, DB, subprocess) that blocks SSR.
   - A client-side dynamic `import()` of a heavy component (graphify, react-flow, monaco) with no `loading.tsx` fallback.
   - A server component that accidentally imports a Node-only module at the module top level.
3. For server-side hangs: move the slow fetch off the render path. Either (a) render a loading UI + stream the data via a route handler the client polls, or (b) use React Suspense with an isolated `<Suspense>` boundary + `loading.tsx` so the shell paints fast.
4. For dynamic imports: lazy-load via `next/dynamic` with a skeleton `loading` component. Ensure the skeleton satisfies `data-truth=".loading=yes"` so the liveness pillar reads it.
5. For the signin page: it's unauthenticated — there should be ZERO authenticated fetches. Audit for any `/api/auth/session` or equivalent that the page loads even when unauthenticated.
6. Add per-route load-time unit tests: mock the slow dependency to resolve instantly, render, assert DOM is non-empty within 100ms.
</action>

<verify>
1. `pnpm vitest run` — all green.
2. Re-run audit capture with `AUDIT_BASE_URL=http://localhost:3002 npx playwright test -c audit/playwright.config.ts`. 
3. ZERO `page.goto: Timeout` entries in `audit/shots/healthy/*/*.console.json` for the target routes.
4. All target routes visible + interactive within 5s on cold load (manual check + Lighthouse TTI ≤5s).
</verify>
</task>
