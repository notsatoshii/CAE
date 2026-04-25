---
phase: 18
plan: WA-live-floor
wave: 1
name: Fix Live Floor page — renders completely blank
---

# WA — Fix Live Floor page

## Context

The Floor page renders a 100% empty black canvas with only a floating legend in the bottom-right corner. The spatial visualization that the legend describes doesn't render. No loading indicator, no error message, no empty state. Score: 0.8/10.

Reference: `/home/timmy/cae-dashboard-visual-audit.md` item #2, screenshot at `audit/shots/healthy/admin/floor--laptop.png`

## Task

<task>
<name>Fix or redesign the Live Floor visualization</name>

<files>
app/floor/**/*.tsx
app/build/floor/**/*.tsx
components/floor/**/*.tsx
components/live-floor/**/*.tsx
</files>

<action>
1. Identify why the canvas/visualization isn't rendering. Check: is it a missing data source? A canvas initialization error? An SSR issue with a canvas/WebGL component?
2. If the visualization code works but needs data: connect it to the fixture data from `audit/seed-fixture.ts healthy` which populates `.cae/metrics/`.
3. If the visualization is fundamentally broken: replace with a structured card-based view showing agent rooms/zones as a grid of cards (not canvas). Each card: agent name, status, current task, uptime.
4. If offline/no data: show a proper EmptyState (see Wave B component if available, or inline one): centered icon, "No live agents detected", "Agents will appear here when running", with a manual refresh button.
5. Remove or fix the whimsical room names ("The debugger's shadow realm") — replace with functional names or agent identifiers.
</action>

<verify>
1. Floor page renders visible content on laptop viewport — not a blank canvas.
2. Legend only appears when the visualization it describes is visible.
3. `pnpm vitest run` — all green.
4. `pnpm build` passes.
</verify>
</task>