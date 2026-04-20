---
phase: 2
plan: A
wave: 2
name: Wave 2 — /ops landing with live phase list
---

# Wave 2 — Ops landing page

**Depends on:** Wave 1 (lib/cae-state).

<task id="1">
<name>Build /ops landing with phase list + project selector</name>
<files>/home/cae/ctrl-alt-elite/dashboard/app/ops/page.tsx, /home/cae/ctrl-alt-elite/dashboard/app/ops/phases-list.tsx, /home/cae/ctrl-alt-elite/dashboard/app/ops/project-selector.tsx, /home/cae/ctrl-alt-elite/dashboard/components/ui/badge.tsx, /home/cae/ctrl-alt-elite/dashboard/components/ui/table.tsx</files>
<action>
Work at `/home/cae/ctrl-alt-elite/dashboard/`.

1. Pre-add shadcn components: `pnpm dlx shadcn@latest add --yes badge table`.

2. Replace `app/ops/page.tsx` (currently placeholder) with a server component that:
   - Reads selected project from URL search param `?project=` (default: first in `listProjects()`)
   - Calls `listPhases(project.path)` and `listProjects()`
   - Renders `<ProjectSelector>` (client component with router.push to update search param) + `<PhasesList phases={phases} />`
   - Heading: "Ops — <projectName>"
   - Short intro paragraph under heading

3. `phases-list.tsx` — client component rendering a shadcn Table:
   - Columns: Phase #, Name, Status (badge colored by state), # plan files, Actions (View button linking to `/ops/phase/[number]?project=...`)
   - Auto-refresh every 5s via `useEffect` + `router.refresh()` for live status updates
   - Empty state: "No phases in this project yet. Run `/gsd-plan-phase` or `cae-init` to scaffold."

4. `project-selector.tsx` — client component with shadcn DropdownMenu listing available projects; on pick, `router.push()` with new `?project=` param.

5. Make sure `/ops/page.tsx` has `export const dynamic = "force-dynamic";` so server component re-runs each request (no static cache).

6. `pnpm build` must pass.

7. Commit: `feat(ops): live phase list + project selector`.
</action>
<verify>
cd /home/cae/ctrl-alt-elite/dashboard && test -f app/ops/page.tsx && test -f app/ops/phases-list.tsx && test -f app/ops/project-selector.tsx && grep -q listPhases app/ops/page.tsx && pnpm build 2>&1 | grep -E "Compiled" | head -1
</verify>
</task>
