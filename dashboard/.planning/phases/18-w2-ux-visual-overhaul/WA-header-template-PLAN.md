---
phase: 18
plan: WA-header-template
wave: 1
name: Fix broken "— tok today EST. —" template in global header
---

# WA — Fix broken header template

## Context

The global header bar shows `— tok today EST. —` on EVERY page. This is a broken data binding where token count isn't resolving. Screams "unfinished."

Reference: `/home/timmy/cae-dashboard-visual-audit.md` item #3

## Task

<task>
<name>Fix or remove the broken token counter template in the global header</name>

<files>
components/layout/**/*.tsx
components/top-nav/**/*.tsx
components/header/**/*.tsx
app/layout.tsx
</files>

<action>
1. Find the header component rendering `— tok today EST. —` (search for "tok today" or "EST" in TSX).
2. Either wire it to real token usage data from the metrics API, OR remove the element entirely if no data source exists.
3. If wiring: show "—" or a skeleton when loading, actual number when available, "offline" when API unreachable.
4. Verify the fix renders correctly on all viewports.
</action>

<verify>
1. No page shows the raw template string "tok today EST".
2. `pnpm vitest run` — all green.
3. `pnpm build` passes.
</verify>
</task>