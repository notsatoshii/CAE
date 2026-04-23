---
phase: 14
plan: "04"
subsystem: auth
tags: [rbac, google-sso, role-gate, middleware, admin-ui]
dependency_graph:
  requires: [14-01, 14-02, 14-03]
  provides: [google-sso, 3-role-whitelist, middleware-gating, role-gate-primitive, admin-roles-page]
  affects: [skills-hub, schedule-hub, workflows, queue]
tech_stack:
  added: [google-oauth-provider, @testing-library/user-event]
  patterns: [currentRole-prop-drilling, role-gate-component, jwt-role-callback, middleware-auth-wrapper]
key_files:
  created:
    - lib/cae-rbac.ts
    - next-auth.d.ts
    - components/auth/role-gate.tsx
    - app/403/page.tsx
    - app/api/admin/roles/route.ts
    - app/build/admin/layout.tsx
    - app/build/admin/roles/page.tsx
    - app/build/admin/roles/role-editor.tsx
    - docs/ENV.md
    - lib/cae-rbac.test.ts
    - tests/auth/auth-callbacks.test.ts
    - app/signin/page.test.tsx
    - tests/middleware/middleware.test.ts
    - tests/middleware/route-rbac.test.ts
    - components/auth/role-gate.test.tsx
    - app/api/admin/roles/route.test.ts
    - app/build/admin/roles/page.test.tsx
  modified:
    - auth.ts
    - middleware.ts
    - app/build/workflows/page.tsx
    - app/build/workflows/workflows-list-client.tsx
    - app/build/schedule/page.tsx
    - app/build/schedule/schedule-client.tsx
    - app/build/skills/page.tsx
    - app/build/skills/skills-client.tsx
    - components/schedule/task-list.tsx
    - components/skills/catalog-grid.tsx
    - components/skills/install-button.tsx
    - components/skills/skill-card.tsx
    - components/skills/skill-detail-drawer.tsx
    - app/api/skills/install/route.ts
    - app/api/schedule/route.ts
    - app/api/schedule/[id]/route.ts
    - app/api/workflows/[slug]/run/route.ts
    - app/build/queue/actions.ts
    - .env.example
decisions:
  - "Prop-drilling currentRole from server component (not useSession/context) avoids SSR hydration mismatch"
  - "JWT role written once on initial sign-in (user?.email guard) prevents role erasure on token refresh"
  - "middlewareHandler exported as named function for unit testability without mocking full NextAuth"
  - "Middleware is first-line defense; each route handler re-checks role for defense-in-depth (STRIDE)"
  - "AUTH_GOOGLE_HOSTED_DOMAIN env var for optional hd= restriction on Google provider"
metrics:
  duration: "~3 hours (context-split session)"
  completed: "2026-04-23T00:01:51Z"
  tasks_completed: 3
  files_changed: 28
  tests_added: 53
---

# Phase 14 Plan 04: RBAC (Google SSO + 3-Role Whitelist + Middleware + RoleGate) Summary

Google SSO added alongside GitHub auth; 3-role whitelist (viewer/operator/admin) resolved from env vars; middleware gates all operator/admin routes; `<RoleGate>` primitive applied to all token-spending UI; `/build/admin/roles` admin page ships.

## What Was Built

### Task 1 — Google SSO + Role Callbacks + Types
- `lib/cae-rbac.ts`: `resolveRole()`, `isAtLeast()`, `requireRole()`, `parseList()` — pure functions, no I/O
- `auth.ts`: Google provider added; `authCallbacks` exported for testing; JWT callback writes role once on `user?.email`; session callback copies `token.role → session.user.role`
- `next-auth.d.ts`: Module augmentation for `Session.user.role`, `JWT.role`, `User.role` typed as `Role`
- Signin page updated to show both GitHub and Google sign-in buttons
- 24 new tests (rbac, auth-callbacks, signin page)

### Task 2 — Middleware Gating + RoleGate Primitive + 403 Page + Route Hardening
- `middleware.ts`: `middlewareHandler` named export wraps auth; admin routes → redirect /403 (HTML) or 403 JSON (API); operator mutations → 403 JSON for viewers; matcher extended to cover all protected API paths
- `components/auth/role-gate.tsx`: Pure prop-based component — renders children if `isAtLeast(currentRole, role)`, else fallback; no `useSession` call
- `app/403/page.tsx`: Founder-friendly "You don't have access to this" with Back link
- 5 route handlers hardened: skills/install, schedule POST, schedule/[id] PATCH+DELETE, workflows/[slug]/run, queue actions
- 22 new tests (middleware, route-rbac, role-gate)

### Task 3 — RoleGate Wired to All Token-Spending UI
- `SkillCard`: Install button gated (operator+); viewer sees disabled "Read-only" with tooltip
- `InstallButton`: RoleGate wraps trigger button
- `CatalogGrid`, `SkillDetailDrawer`: `currentRole` prop forwarded down chain
- `TaskList`: Toggle and Delete gated; viewer sees dimmed read-only toggle indicator
- `WorkflowsListClient`: Run button gated; viewer sees disabled "Read-only"
- Server pages (`/build/skills`, `/build/schedule`, `/build/workflows`): each calls `auth()` once, passes `currentRole` down
- Admin UI: `/build/admin/roles` shows admin/operator email lists (read-only, env-sourced); `/api/admin/roles` GET returns lists (admin-only)
- `docs/ENV.md`: Documents all new env vars
- 7 pre-existing component tests updated to pass `currentRole="operator"` where functional buttons expected

## Verification

Full test suite: **891 tests pass / 5 pre-existing suite failures** (unchanged from before this plan).

Pre-existing failures (out of scope, confirmed via git stash):
- `lib/cae-nl-draft.test.ts` — empty suite
- `lib/cae-queue-state.test.ts` — empty suite
- `lib/cae-workflows.test.ts` — empty suite
- `components/workflows/step-graph.test.tsx` — empty suite
- `app/api/workflows/route.test.ts` — `next/server` module resolution (next-auth + vitest jsdom)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Functionality] Pre-existing route tests needed auth mock after hardening**
- Found during: Task 2/3
- Issue: Adding `auth()` calls to 3 route handlers broke their existing tests (no auth mock)
- Fix: Added `vi.mock("@/auth", ...)` with operator session to `schedule/route.test.ts`, `schedule/[id]/route.test.ts`, `skills/install/route.test.ts`
- Files modified: 3 test files
- Commit: 675f455

**2. [Rule 1 - Bug] Component tests broke after RoleGate added to UI**
- Found during: Task 3
- Issue: Existing tests for TaskList, InstallButton, SkillCard rendered without `currentRole` → RoleGate showed fallback, buttons not found
- Fix: Added `currentRole="operator"` to renders that assert functional buttons exist
- Files modified: task-list.test.tsx, install-button.test.tsx, skill-card.test.tsx
- Commit: 675f455

**3. [Rule 1 - Bug] vi.mock hoisting: `Cannot access 'signInMock' before initialization`**
- Found during: Task 1 test authoring
- Issue: vi.mock factory referenced outer `const` variable (hoisting prevents this)
- Fix: Used `vi.fn()` directly in factory, `vi.mocked()` after import
- Files modified: auth-callbacks.test.ts

**4. [Rule 3 - Blocker] `@testing-library/user-event` not installed**
- Found during: Task 1
- Fix: `pnpm add -D @testing-library/user-event`

## Known Stubs

- `app/build/admin/roles/role-editor.tsx`: Email lists are read-only (env-sourced). Adding/removing emails requires editing env vars and redeploying. Intentional — env-managed RBAC was the spec. Future plan may add DB-backed role management if needed.
- `skill-detail-drawer.tsx` trust score placeholder div (`trust-slot-placeholder`) ships in Plan 14-05. Not a stub for this plan's goal.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | eb40249 | Google SSO + role callbacks + RoleGate types + signin 2-provider |
| 2 | 017d4da | middleware role gating + RoleGate + 403 page + harden 5 routes |
| 3 | 675f455 | wire RoleGate to all token-spending UI, harden routes |

## Self-Check: PASSED

All 7 key files verified on disk. All 3 task commits verified in git log.
