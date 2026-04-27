---
phase: 19
plan: WA-recent-commits-empty
wave: 1
name: Fix Recent Commits section showing empty when data exists
---

# WA — Fix Recent Commits empty state

## Context

The Recent Commits section on /build shows "no 0" (empty skeleton) even though /api/commits returns real commit data. The ActivityFeed component reads `data.recent_activity` from `/api/state` but the git commit data comes from a separate `/api/commits` endpoint. The RecentCommits component may not be wired to the right data source.

## Task

<task>
<name>Wire Recent Commits to actual commit data</name>

<files>
components/build-home/recent-commits*.tsx
components/build-home/commit-feed*.tsx
app/api/commits/route.ts
</files>

<action>
1. Find the RecentCommits component on the /build page. Check what data source it reads.
2. The /api/commits endpoint at app/api/commits/route.ts returns real git log data (verified working — returns 200 with commit objects).
3. If the component reads from useStatePoll (which may not have the commits), wire it to fetch /api/commits directly or use the existing data.
4. Ensure the component renders commit hashes, messages, timestamps, and author info.
</action>

<verify>
1. `pnpm vitest run` — all green.
2. Visit /build — Recent Commits section shows actual git commits with hashes and messages.
</verify>
</task>
