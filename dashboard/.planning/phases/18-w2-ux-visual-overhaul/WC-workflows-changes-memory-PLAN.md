---
phase: 18
plan: WC-workflows-changes-memory
wave: 3
name: Fix Workflows naming, Changes wiring, Memory loading
---

# WC — Fix Workflows, Changes, Memory pages

## Context

Workflows: "Recipes" vs "Workflows" naming confusion + contradictory empty state. Changes: nearly empty at 1.8/10. Memory: stuck on "Loading..." text.

Reference: `/home/timmy/cae-dashboard-visual-audit.md` items #11, and C6-FINDINGS.md

## Task

<task>
<name>Fix three broken/shallow pages</name>

<files>
app/build/workflows/**/*.tsx
app/build/changes/**/*.tsx
app/memory/**/*.tsx
components/workflows/**/*.tsx
components/changes/**/*.tsx
components/memory/**/*.tsx
</files>

<action>
**Workflows:**
1. Pick ONE name — "Workflows" (matches sidebar). Remove ALL references to "Recipes" in titles, headings, empty states, and descriptions.
2. Fix the contradictory empty state: if there ARE live runs displayed, don't show "No workflows yet" below them.
3. Apply EmptyState component when genuinely empty.

**Changes:**
1. Wire to git log data: read recent commits from `.cae/metrics/activity.jsonl` or git log.
2. Show: commit hash (short), message, author/agent, timestamp, files changed count.
3. If no commits available, show EmptyState: "No changes tracked yet" with description "Changes will appear here as agents commit code."

**Memory:**
1. Fix the loading state — replace "Loading..." text with LoadingState skeleton.
2. Wire to AGENTS.md content or `.cae/metrics/skill-scans.jsonl` for knowledge base data.
3. If no data: show EmptyState with "No knowledge entries yet."
</action>

<verify>
1. Zero references to "Recipes" anywhere in the UI.
2. Changes page shows real data from activity log or proper empty state.
3. Memory page resolves loading within 5 seconds.
4. `pnpm vitest run` — all green.
</verify>
</task>