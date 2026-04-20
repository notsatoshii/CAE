---
phase: 1
plan: A
wave: 4
name: Wave 4 — wire layout + README + build check
---

# Wave 4 — Wire + Ship

**Depends on:** Waves 1–3.

<task id="5">
<name>Wire TopNav into layout + README + build check</name>
<files>/home/cae-dashboard/app/layout.tsx, /home/cae-dashboard/README.md</files>
<action>
1. Modify `app/layout.tsx`:
   - Make it `async` to call `auth()` from `@/auth`
   - If session exists AND the current route is not `/signin`, render `<TopNav session={session} />` above `{children}` inside `<body>`
   - If no session OR route is `/signin`, render `{children}` alone
   - Keep existing global CSS import + metadata

   (Since layout.tsx can't read pathname directly, use a SessionProvider pattern OR just always render TopNav when session exists — the `/signin` page won't be reached by authed users because of the root redirect, so this simplification is fine.)

2. Create `README.md`:
   - Title + one-paragraph pitch (pull from `.shift/PRD.md`)
   - "What it is" section: Build mode / Ops mode
   - "Stack" section: list the stack (Next.js 15, TypeScript, Tailwind v4, shadcn/ui, NextAuth v5)
   - "Setup" section, numbered steps:
     1. Create GitHub OAuth app at https://github.com/settings/developers (callback http://localhost:3000/api/auth/callback/github)
     2. Copy `.env.example` → `.env.local` and fill in AUTH_SECRET (`openssl rand -hex 32`), AUTH_GITHUB_ID, AUTH_GITHUB_SECRET
     3. `pnpm install`
     4. `pnpm dev`
   - "Project docs" section: link `.shift/PRD.md` and `.shift/ROADMAP.md`
   - "Relationship to CAE + Shift": short paragraph

3. Run `pnpm build` one last time. Must pass.

4. Commit: `feat(shell): wire top-nav + README + Phase 1 done`.
</action>
<verify>
cd /home/cae-dashboard && grep -q TopNav app/layout.tsx && test -f README.md && grep -q "cae-dashboard" README.md && pnpm build 2>&1 | tail -5
</verify>
</task>
