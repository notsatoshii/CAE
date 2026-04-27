---
phase: 20
plan: plWA
wave: 1
name: Progressive loading + data flow fixes
---

# plWA — Progressive Loading + Data Flow Fixes

## Context
The build home page shows a full-screen Pikachu loader for 8-15s while /api/state computes.
Individual components should show their own skeleton states rather than blocking the entire page.
The Activity feed sidebar is stuck on loading skeletons because it reads `recent_activity` from
useStatePoll data but the field arrives late or the cast-read fails. The liveness chip says
"Connecting" for 8+ seconds which looks broken.

## Task

<task>
<name>Per-component loading states and activity feed fix</name>

<files>
components/build-home/activity-feed.tsx
components/build-home/mission-control-hero.tsx
components/shell/liveness-chip.tsx
lib/hooks/use-state-poll.tsx
</files>

<action>
1. In activity-feed.tsx: The component reads `data.recent_activity` via a cast-read from useStatePoll.
   The issue is the `loading` state check: `data === null && error === null`. When useStatePoll returns
   data but without `recent_activity` field, the cast-read gives null and `rows` stays null, showing
   loading forever. Fix: treat missing `recent_activity` as empty array, not loading.
   Change: `const rows = dataWithActivity?.recent_activity ?? null` → 
   `const rows = data ? (dataWithActivity?.recent_activity ?? []) : null`
   
2. In liveness-chip.tsx: The chip shows "Connecting" when `lastUpdated === null` (no poll completed yet).
   The `/api/state` route now has a 5s response cache so second poll is 100ms. But the FIRST poll takes
   8s. Fix: after 3 seconds of "Connecting", show "Connecting..." with pulse animation. After successful
   poll, show "Live" immediately. Add a useEffect that sets a timer after mount: if still connecting after
   3s, add CSS pulse class to the dot.

3. In mission-control-hero.tsx: The MC tiles show "appears when an agent picks up work" as placeholder
   text when the value is 0. This reads like a broken tooltip, not a zero-state. Fix: when value is 0,
   show "0" with muted styling and a subtitle like "active" or "today" — not the explanatory text.
   The explanatory text should only show in dev mode (useDevMode).
</action>

<verify>
1. Load http://localhost:3002 — activity feed sidebar should show "Nothing on the wire yet." empty state instead of loading skeletons
2. MC tiles should show "0 active", "0 tok", "0 today", "0/min" in muted text
3. Liveness chip transitions: "Connecting..." (pulsing) → "Live" within 10s
</verify>
</task>
