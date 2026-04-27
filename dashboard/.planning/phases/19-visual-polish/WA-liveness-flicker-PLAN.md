---
phase: 19
plan: WA-liveness-flicker
wave: 1
name: Fix liveness chip flicker — starts Offline then flips to Live
---

# WA — Fix liveness chip initial state

## Context

The liveness chip in the top nav starts as "Offline" (red dot) and flips to "Live" (green) after the first /api/state poll completes (~3-8s). This creates a jarring flicker on every page load.

## Task

<task>
<name>Set liveness chip initial state to loading instead of Offline</name>

<files>
components/shell/liveness-chip.tsx
</files>

<action>
1. When `lastUpdated` is null AND there's no error, the chip should show a neutral state — "Connecting" or a pulsing dot — instead of "Offline" (which implies the system is down).
2. Change the "dead" classification to only trigger when `lastUpdated` was previously set but became stale (>18s), not when it's null (never received data yet).
3. Add a "connecting" label with a neutral gray/blue dot for the initial state.
</action>

<verify>
1. `pnpm vitest run` — all green (update liveness-chip.test.tsx if needed).
2. On page load, chip shows "Connecting" (neutral), then flips to "Live" once data arrives.
</verify>
</task>
