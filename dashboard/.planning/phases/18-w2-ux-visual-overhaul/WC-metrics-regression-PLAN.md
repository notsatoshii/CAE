---
phase: 18
plan: WC-metrics-regression
wave: 3
name: Fix Metrics page truth regression and layout
---

# WC — Fix Metrics page

## Context

Metrics page regressed from truth=5 to truth=1 in C6 across ALL viewports and personas (15 cells). Layout is chaotic with no coherent grid. Incident stream shows 50 identical "client.error.reported" entries.

Reference: C6-DELTA.md regression rows for "metrics", `/home/timmy/cae-dashboard-visual-audit.md` item #12

## Task

<task>
<name>Fix metrics data regression and layout</name>

<files>
app/metrics/**/*.tsx
app/build/metrics/**/*.tsx
components/metrics/**/*.tsx
</files>

<action>
1. **Truth regression**: Investigate why truth dropped from 5→1. Check if the data source path changed, if the API endpoint broke, or if a component refactor lost data bindings. Cross-reference with C5 screenshots vs C6.
2. **Layout**: Establish a proper grid: 3-column on wide, 2-column on laptop. Align card heights. Give sparkline charts adequate height (min 80px).
3. **Incident stream**: Deduplicate identical consecutive entries. Show "client.error.reported × 50" instead of 50 rows. Add a count badge.
4. **Agent cards**: Replace "not enough jobs yet" (5 of 9 cards) with a proper empty state mini-card.
5. **Chart colors**: Ensure legend colors are distinguishable at small sizes. Use at least 30° hue separation between adjacent colors.
</action>

<verify>
1. Metrics page truth keys match fixture data (should score ≥4 on truth pillar).
2. Grid layout is clean and aligned on laptop viewport.
3. No duplicate incident stream entries.
4. `pnpm vitest run` — all green.
</verify>
</task>