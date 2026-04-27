---
phase: 20
plan: plWD-broken
wave: 4
name: Fix broken pages — Security, Changes, Metrics
---

# plWD-broken — Fix 3 Broken Pages

## Context
From Playwright audit:
- /build/security: Stuck on Pikachu loader (server component hangs in suspense)
- /build/changes: data-liveness=loading forever — endpoint times out
- /metrics: 3 of 4 panels show data-liveness=error (spending, reliability, speed)

## Task

<task>
<name>Unblock Security, Changes, and Metrics pages</name>

<files>
app/build/security/page.tsx
app/build/changes/**
lib/cae-changes-state.ts
app/api/metrics/route.ts
lib/cae-metrics-state.ts
components/metrics/**
</files>

<action>
1. SECURITY PAGE: The page is a server component that likely calls listProjects() or reads
   .shift/state.json, which hangs. Wrap the data-fetching in a try/catch with a 3s timeout
   using Promise.race. If it times out, render the page with empty data + error banner
   "Security data unavailable — filesystem timeout". Check if it imports from cae-state.ts
   and calls anything that might trigger the /home/cae readdir hang.

2. CHANGES PAGE: The page depends on cae-changes-state.ts which likely calls tailJsonl or
   git log across projects. Same issue — reading files that hang. Add the same timeout pattern.
   If the git log or file reads take >5s, return empty array and show "No changes loaded"
   empty state instead of infinite loading.

3. METRICS PAGE: The /api/metrics route returns data that the frontend panels parse. The panels
   show "error" liveness which means the API returned something the panels can't parse, OR
   the API itself returns a 500/error. Check the route handler — it likely calls tailJsonl
   for sentinel.jsonl, compaction.jsonl, etc. If those files don't exist at the expected paths,
   catch the error and return empty arrays instead of throwing.
   
   For each metrics panel component (spending, reliability, speed), ensure they handle empty
   data gracefully — show "No data yet" instead of error state when the API returns empty arrays.
</action>

<verify>
1. Navigate to /build/security — page loads within 5s (not stuck on loader)
2. Navigate to /build/changes — page shows content or proper empty state
3. Navigate to /metrics — all 4 panels render (empty state OK, not error state)
4. `curl -m 10 http://localhost:3002/api/metrics` returns 200 JSON
</verify>
</task>
