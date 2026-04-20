---
phase: 1
plan: A
wave: 3
name: Wave 3 — route pages only (shell already merged)
---

# Wave 3 (trimmed) — Routes

**Depends on:** Waves 1–2 (scaffold + auth merged on main). Shell components from original wave 3 also already merged. This runs only the routes task.

<task id="1">
<name>Create route pages: /signin, /build, /ops</name>
<files>/home/cae-dashboard/app/signin/page.tsx, /home/cae-dashboard/app/build/page.tsx, /home/cae-dashboard/app/build/layout.tsx, /home/cae-dashboard/app/ops/page.tsx, /home/cae-dashboard/app/ops/layout.tsx</files>
<action>
1. `app/signin/page.tsx` — server component; unauthenticated landing. Centered card with heading "CAE", short pitch paragraph, "Sign in with GitHub" button in a client component that calls `signIn('github')` from next-auth/react.

2. `app/build/page.tsx` — server component. Heading "Build mode", one-paragraph placeholder: "This is where you'll start new projects, walk through intake, approve PRDs and roadmaps, and hand off to CAE. Coming in Phase 4."

3. `app/build/layout.tsx` — async server component that passes `{ children }` through. Future phases add Build-specific side nav here.

4. `app/ops/page.tsx` — server component. Heading "Ops mode", placeholder: "This is where you'll see live CAE phase execution, the delegation queue, agent activity, and metrics. Coming in Phase 2."

5. `app/ops/layout.tsx` — pass-through wrapper.

DO NOT modify `app/layout.tsx`, `auth.ts`, `middleware.ts`, or components/shell/* — those belong to other tasks or are already merged.
</action>
<verify>
test -f /home/cae-dashboard/app/signin/page.tsx && test -f /home/cae-dashboard/app/build/page.tsx && test -f /home/cae-dashboard/app/ops/page.tsx && test -f /home/cae-dashboard/app/build/layout.tsx && test -f /home/cae-dashboard/app/ops/layout.tsx
</verify>
</task>
