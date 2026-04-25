---
phase: 18
plan: WA-chat-loading
wave: 1
name: Fix Chat page stuck on Loading, hostile greeting
---

# WA — Fix Chat page

## Context

Chat page left panel stuck on "Loading..." indefinitely with no timeout. Right panel greeting says "Hey. What's broken." which reads as aggressive/hostile. Score: 3.0/10.

Reference: `/home/timmy/cae-dashboard-visual-audit.md` item #6, screenshot at `audit/shots/healthy/admin/chat--laptop.png`

## Task

<task>
<name>Fix chat page loading state and greeting copy</name>

<files>
app/chat/**/*.tsx
components/chat/**/*.tsx
</files>

<action>
1. Find the chat component's data fetching. Add a 5-second timeout.
2. After timeout: show an empty state instead of infinite "Loading..." — "No conversations yet" with an icon and a "Start a conversation" CTA.
3. Change the greeting from "Hey. What's broken." to something welcoming: "What are you working on?" or "Ask me anything about the build."
4. If the chat relies on an API that doesn't exist yet, show a proper "Coming soon" state rather than a broken loading state.
</action>

<verify>
1. Chat page never shows infinite "Loading..." — resolves within 5 seconds to content or empty state.
2. Greeting is welcoming, not hostile.
3. `pnpm vitest run` — all green.
</verify>
</task>