---
phase: 20
plan: plWD-loading
wave: 4
name: Fix stuck loading components — Memory browse, Chat mirror
---

# plWD-loading — Fix Stuck Loading Components

## Context
From Playwright audit:
- Memory browse pane: file tree stuck in loading state (data-liveness=loading)
- Chat mirror pane: shows "Loading..." forever for the Home surface mirror

## Task

<task>
<name>Fix memory browse and chat mirror loading states</name>

<files>
components/memory/browse/browse-pane.tsx
app/chat/page.tsx
components/chat/chat-panel.tsx
</files>

<action>
1. MEMORY BROWSE: The browse pane fetches a file tree from an API (likely /api/memory/sources
   or similar). If the API times out or returns an error, the component stays in loading state
   forever. Fix:
   a. Find the fetch call in browse-pane.tsx
   b. Add a timeout (5s) and error handling
   c. On timeout/error, show empty state "Memory sources unavailable" instead of infinite loading
   d. If the API returns successfully but with empty data, show "No memory files found"

2. CHAT MIRROR: The chat page has a split layout with a "mirror" pane that reflects the Build
   surface. The mirror pane tries to load the Home page content but fails. This is likely because
   it fetches from /api/state or renders the BuildPage component which takes too long.
   Fix:
   a. Find the mirror component (likely in chat page or chat-panel)
   b. Add a loading timeout — if content doesn't load in 5s, show a simple static summary
      instead of trying to mirror the full page
   c. The static fallback should show: project name, liveness status, and "Open Build →" link
</action>

<verify>
1. Navigate to /memory — browse pane shows file tree OR proper empty state (not loading skeleton)
2. Navigate to /chat — mirror pane shows content or static fallback (not "Loading..." forever)
</verify>
</task>
