---
phase: 20
plan: 04-workflows-live
wave: 2
name: Workflows tab — live workflow instances + per-step state
---

# 04-workflows-live — Live Workflow Instances

## Context
`/build/workflows` is a static stub. Need to render live workflow instances
with per-step state and duration. Source from activity.jsonl + phases/*/state.json.

## Task

<task>
<name>Render live workflow instances with per-step state</name>

<files>
app/build/workflows/**/*.tsx
components/workflows/**/*.tsx
lib/workflows/live-instances.ts
lib/cae-workflows.ts
app/api/workflows/live/route.ts
</files>

<action>
1. Check existing code — `lib/workflows/live-instances.ts` and `/api/workflows/live` may already exist.
2. Read phases from `.planning/phases/*/` to find active workflows.
3. Parse state.json files in each phase dir for per-step progress.
4. Join with activity.jsonl events for timing data (start/end timestamps per step).
5. Render a timeline or step-progress view showing: workflow name, steps, current step, duration per step, overall progress.
6. If the API already exists and returns data, focus on the UI rendering.
</action>

<verify>
1. `/build/workflows` shows real workflow data (not just static placeholders).
2. Each workflow shows step-by-step progress with timestamps.
3. `pnpm vitest run` passes.
</verify>
</task>

