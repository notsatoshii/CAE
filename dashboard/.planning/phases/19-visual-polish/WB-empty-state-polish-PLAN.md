---
phase: 19
plan: WB-empty-state-polish
wave: 2
name: Polish empty states across all pages
---

# WB — Empty state polish

## Context

Multiple pages show raw "0" values or placeholder text when no data is available. They should show proper empty states with helpful messaging.

## Task

<task>
<name>Add proper empty states to Mission Control cards and metric panels</name>

<files>
components/build-home/mission-control*.tsx
components/build-home/rollup-strip*.tsx
components/build-home/live-ops*.tsx
components/metrics/**/*.tsx
</files>

<action>
1. Mission Control cards (ACTIVE, BURN·7D, TOKENS TODAY, LAST 60S): When values are 0, show a subtle "—" with a muted description like "No agents active" instead of "0 agents working" which implies the system is broken.
2. Rollup strip (shipped/in-flight/warnings/blocked/tok): Change "0 NOMINAL" labels to just show the number. "NOMINAL" reads like status monitoring jargon that doesn't help.
3. Live Ops: "Nothing running right now." is good. Keep it.
4. Check /metrics page — ensure panels show "No data yet" with helpful descriptions instead of empty charts.
</action>

<verify>
1. `pnpm vitest run` — all green.
2. Visit /build — empty states look intentional and helpful, not broken.
3. Visit /metrics — no broken panels.
</verify>
</task>
