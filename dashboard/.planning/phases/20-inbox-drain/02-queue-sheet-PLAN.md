---
phase: 20
plan: 02-queue-sheet
wave: 2
name: Wire up Build Queue clicked-card sheet controls
---

# 02-queue-sheet — Wire Queue Card Sheet

## Context
The /build/queue page lists items correctly, but clicking any card opens a Sheet
with 8 stubbed controls that fire `toast.info("not yet wired")` and 3 labels that
hardcode "Phase 8/9" instead of reading actual data.

## Task

<task>
<name>Wire queue card sheet to real data</name>

<files>
components/queue/**/*.tsx
app/api/queue/item/[taskId]/route.ts
lib/cae-queue-item.ts
</files>

<action>
1. Read the existing queue-item API at `/api/queue/item/[taskId]` — understand what data it returns.
2. In the queue card sheet component, replace all `toast.info("not yet wired")` stubs with real actions:
   - "View buildplan" → open the buildplan content in a read-only panel or link to the file
   - "View log" → fetch and display the CAE log for that task
   - Other action buttons: wire to the `/api/queue/item/[taskId]/action` endpoint (approve, reject, retry)
3. Replace hardcoded "Phase 8/9" labels with actual data from the queue item's metadata.
4. If any API endpoints are missing data, add the fields to the API response.
</action>

<verify>
1. Click any queue card — Sheet opens with real data, no toast stubs.
2. Phase/wave labels show actual values from the task metadata.
3. `pnpm vitest run` passes.
</verify>
</task>

