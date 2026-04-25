---
phase: 18
plan: WC-agents-page
wave: 3
name: Fix Agents page contradictory data and missing context
---

# WC — Agents Page Fixes

## Context

Agents marked "WORKING NOW" and "Active" show "0 working · 0 waiting" — directly contradictory. "5039/day" has no unit label. "Today: 100%" has no context. Stop/Archive buttons shown on offline agents. Score: 4.5/10.

Reference: `/home/timmy/cae-dashboard-visual-audit.md` item #10

## Task

<task>
<name>Fix agent data display and interaction consistency</name>

<files>
app/build/agents/**/*.tsx
components/agents/**/*.tsx
components/build-home/agent*/**/*.tsx
lib/agents.ts
</files>

<action>
1. Fix the status contradiction: if an agent has status "Active" with 0 tasks, show "Idle" not "WORKING NOW". Status should be derived from actual task data, not a static flag.
2. Add unit labels: "5,039 tasks/day" not "5039/day". "28 reviews/day" not "28/day".
3. "Today: 100%" → "Uptime today: 100%" or "Success rate: 100%". Add a tooltip explaining what it measures.
4. "ACTIVE · 2X" → explain or remove. If it means "2 concurrent instances", show "2 instances".
5. Disable Stop/Archive buttons on agents that are offline or have never run. Show them as greyed-out with a tooltip "Agent is offline".
6. Use the new EmptyState component for agents with no activity data.
</action>

<verify>
1. No agent shows contradictory status/task data.
2. All numbers have unit labels.
3. Disabled buttons on offline agents.
4. `pnpm vitest run` — all green.
</verify>
</task>