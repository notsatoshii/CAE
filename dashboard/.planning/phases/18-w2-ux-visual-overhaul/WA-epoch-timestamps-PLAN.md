---
phase: 18
plan: WA-epoch-timestamps
wave: 1
name: Fix epoch timestamp bug — queue shows "20,567 days ago"
---

# WA — Fix epoch timestamp bug

## Context

The Queue page kanban board shows timestamps of "20,567 days ago" (~56 years). This is an epoch/date parsing bug — likely seconds vs milliseconds mismatch. This instantly destroys user trust.

Reference: `/home/timmy/cae-dashboard-visual-audit.md` item #1 and `/home/cae/inbox/tb-w2-ux-overhaul/BUILDPLAN.md`

## Task

<task>
<name>Fix all date/timestamp rendering to use consistent Date handling</name>

<files>
components/queue/**/*.tsx
components/build-home/**/*.tsx
lib/utils.ts
lib/date.ts
app/build/queue/**/*.tsx
</files>

<action>
1. Search the entire codebase for date formatting: `new Date(`, `formatDistance`, `formatRelative`, `toLocaleDateString`, `toLocaleString`, `dayjs(`, `date-fns`.
2. Find where epoch seconds are being passed to functions expecting milliseconds (or vice versa).
3. Create a single `formatRelativeTime(timestamp: number)` utility in `lib/date.ts` that handles both seconds and milliseconds (detect by magnitude: >1e12 = ms, else = seconds).
4. Replace ALL ad-hoc date formatting across the dashboard with this utility.
5. Add unit tests for the utility covering: epoch seconds, epoch ms, ISO strings, null/undefined, future dates.
</action>

<verify>
1. `pnpm vitest run` — all green.
2. No date on any page should show values older than 2025 or negative durations.
3. `pnpm build` passes.
</verify>
</task>