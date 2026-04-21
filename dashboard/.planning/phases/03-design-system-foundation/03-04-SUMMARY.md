---
phase: 03-design-system-foundation
plan: 04
subsystem: routing
tags: [nextjs, middleware, app-router, route-reorg]

requires:
  - phase: 01-app-shell
    provides: app/ops/* routes, app/build/* Shift placeholder, middleware auth callback
  - phase: 02-ops-core
    provides: phases list, queue, phase detail server components under /ops

provides:
  - /build/* routes (Phase 1+2 Ops content relocated here)
  - /plan/* route (old Shift placeholder relocated; content unchanged)
  - /memory stub page (Phase 8 placeholder)
  - /metrics stub page (Phase 7 placeholder)
  - middleware matcher protecting /plan, /build, /memory, /metrics
  - root redirect that branches on cae-mode cookie: plan -> /plan, else -> /build

affects:
  - 03-03 (mode-toggle rename — must use new cookie values + route targets)
  - 03-05 (founder-speak copy pass — operates on renamed /build/* files)
  - 04-* (Build Home hierarchy rewrite under /build)
  - 07-* (Metrics panels fill /metrics stub)
  - 08-* (Memory browse fills /memory stub)

tech-stack:
  added: []
  patterns:
    - "Stub pages redundantly call auth() + redirect to /signin?from=<path> for defense-in-depth (middleware matcher + in-component check)"
    - "Hard-swap route rename via git mv (no backward-compat redirects; pre-launch)"

key-files:
  created:
    - dashboard/app/memory/page.tsx
    - dashboard/app/metrics/page.tsx
    - dashboard/app/plan/page.tsx (moved from app/build/page.tsx)
    - dashboard/app/plan/layout.tsx (moved from app/build/layout.tsx)
  modified:
    - dashboard/middleware.ts (matcher)
    - dashboard/app/page.tsx (redirect logic)
    - dashboard/app/build/** (13 files, all renamed from app/ops/** + internal path literals swapped)

key-decisions:
  - "Hard-swap rename with no backward-compat redirects — /ops/* now 404s, per CONTEXT.md pre-launch policy"
  - "Root redirect defaults to /build (CAE) when cookie is missing or holds legacy value — matches UI-SPEC default landing"
  - "Stubs redundantly call auth() + redirect even though middleware already protects — belt-and-suspenders against matcher regressions"
  - "Middleware uses exact-match for /memory and /metrics (no :path* suffix) — scoped tight to what exists now; expand later if subroutes appear"

metrics:
  duration: 323s
  completed: 2026-04-21T10:16:05Z

---

# Phase 3 Plan 4: Route reorg /ops -> /build, /build -> /plan, add /memory + /metrics

One-liner: Hard-swapped Ops routes to /build, moved Shift placeholder to /plan, added Memory and Metrics auth-gated stubs.

## Commits

| Hash     | Task | Message                                                                      |
| -------- | ---- | ---------------------------------------------------------------------------- |
| 36a9fab  | 1    | `refactor(03-04): rename app/ops -> app/build, app/build -> app/plan`        |
| c7419df  | 2    | `feat(03-04): add /memory + /metrics stubs, update middleware + root redirect` |

## What Was Built

**Task 1** — Atomic directory rename via `git mv`:

- `git mv dashboard/app/build dashboard/app/plan` (freed target first: 2 files of Shift placeholder)
- `git mv dashboard/app/ops dashboard/app/build` (13 files: page, layout, breakers-panel, metrics-tabs, phases-list, project-selector, phase/[num]/{page,waves-view}, queue/{page,delegate-form,actions})
- Rewrote every `/ops/` path literal inside the moved files to `/build/`:
  - `layout.tsx` Links (overview + queue)
  - `page.tsx` headline "Ops —" → "Build —" + function rename OpsPage → BuildPage
  - `project-selector.tsx` router.push(`/build?...`)
  - `phases-list.tsx` Link href `/build/phase/${n}`
  - `phase/[num]/page.tsx` backHref `/build?...`, phaseHref `/build/phase/${num}`, "← Ops" → "← Build"
  - `phase/[num]/waves-view.tsx` tail link `/build/phase/${detail.number}`
  - `queue/page.tsx` inbox/outbox links `/build/queue/...`
  - `queue/delegate-form.tsx` post-submit "view queue" link `/build/queue`
  - `queue/actions.ts` revalidatePath("/build/queue")
- Final grep: `grep -rn "/ops" app/build/` → zero matches.

**Task 2** — Middleware + page + stubs:

- `middleware.ts` matcher: `["/plan/:path*", "/build/:path*", "/memory", "/metrics"]` (drops `/ops`).
- `app/page.tsx`: cookie-aware root redirect. `cae-mode === "plan"` → `/plan`, else → `/build`. Legacy "ops" / "build" cookie values gracefully fall through to `/build`.
- `app/memory/page.tsx`: auth-gated stub, h1 "Memory", short copy pointing at Phase 8 for full content. Uses `text-[color:var(--text)]` + `text-[color:var(--text-muted)]` tokens from Plan 03-01 design system.
- `app/metrics/page.tsx`: auth-gated stub, h1 "Metrics", short copy pointing at Phase 7. Same token usage.
- Defense-in-depth: both stubs call `auth()` themselves + `redirect("/signin?from=<path>")` in case middleware matcher is ever changed.

## Verification

Phase-level checks (all pass):

- `ls app/` → `api/ build/ globals.css layout.tsx memory/ metrics/ page.tsx plan/ signin/` (no `ops/`) ✓
- `grep -rn "/ops" app/ middleware.ts` → clean except `components/shell/mode-toggle.tsx` (out of scope; Plan 03-03 handles it) ✓
- `pnpm tsc --noEmit` → zero errors ✓
- `pnpm build` → compiled + all 12 routes including `/build`, `/plan`, `/memory`, `/metrics`, `/build/queue`, `/build/phase/[num]` in output ✓
- Dev-server smoke (unauthenticated curl -sI):
  - `/memory` → `307` → `/signin?from=/memory` ✓
  - `/build` → `307` → `/signin?from=/build` ✓
  - `/plan` → `307` → `/signin?from=/plan` ✓
  - `/metrics` → `307` → `/signin?from=/metrics` ✓
  - `/build/queue` → `307` → `/signin?from=/build/queue` ✓
  - `/build/phase/2` → `307` → `/signin?from=/build/phase/2` ✓
  - `/ops` → `404` (old route gone, middleware no longer matches) ✓
  - `/` → `307` (to /signin when unauthed; cookie-driven redirect in component kicks in after auth) ✓

## Issues Found (out of scope — handed to future plans)

**1. `components/shell/mode-toggle.tsx` still references `/ops` and cookie values `"build" | "ops"`.**

The Plan 04 plan file explicitly notes Plan 03 is responsible for rewriting this component (UI-SPEC § S4.1 rename). Plan 03 has not yet been executed (only 03-01, 03-02, 03-06 are complete in this phase). Left as-is per `files_modified` scope. **This means clicking the "Ops" button in the top-bar after this plan lands (but before 03-03) will 404.** The "Build" button still works. Execute 03-03 before shipping to Eric.

**2. Several pre-existing dirty files in working tree (not touched by this plan):**

- `dashboard/app/page.tsx` — had uncommitted redirect logic from an earlier session; Plan 04 committed its final planned form as part of Task 2.
- `dashboard/AGENTS.md`, `dashboard/next-env.d.ts`, `dashboard/next.config.ts`, `dashboard/.planning/STATE.md` — uncommitted pre-existing drift, not related to Plan 04. Left unstaged.

## Deviations from Plan

**None — plan executed exactly as written.**

Minor note: the git `mv` sequence in Task 1 step 2 (`git mv app/ops app/build`) didn't produce perfect rename detection by git for `app/build/layout.tsx` and `app/build/page.tsx` — git saw them as "modify of existing build files" plus "delete of old app/ops/{page,layout}.tsx" rather than "rename + content change." The final commit contents are semantically identical to the planned hard-swap; the commit log simply shows 9 renames + 2 deletes + 2 modifies rather than 11 renames. No functional impact.

## Self-Check: PASSED

**Files verified (exist):**

```
FOUND: dashboard/app/build/page.tsx
FOUND: dashboard/app/build/layout.tsx
FOUND: dashboard/app/build/queue/page.tsx
FOUND: dashboard/app/build/queue/delegate-form.tsx
FOUND: dashboard/app/build/queue/actions.ts
FOUND: dashboard/app/build/phase/[num]/page.tsx
FOUND: dashboard/app/build/phase/[num]/waves-view.tsx
FOUND: dashboard/app/build/phases-list.tsx
FOUND: dashboard/app/build/project-selector.tsx
FOUND: dashboard/app/build/breakers-panel.tsx
FOUND: dashboard/app/build/metrics-tabs.tsx
FOUND: dashboard/app/plan/page.tsx
FOUND: dashboard/app/plan/layout.tsx
FOUND: dashboard/app/memory/page.tsx
FOUND: dashboard/app/metrics/page.tsx
FOUND: dashboard/middleware.ts (modified)
FOUND: dashboard/app/page.tsx (modified)
MISSING: dashboard/app/ops/ — intentional (directory removed)
```

**Commits verified:**

```
FOUND: 36a9fab refactor(03-04): rename app/ops -> app/build, app/build -> app/plan
FOUND: c7419df feat(03-04): add /memory + /metrics stubs, update middleware + root redirect
```
