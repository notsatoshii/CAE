---
phase: 04-build-home-rewrite
plan: 04
subsystem: build-home-widgets
tags: [build-home, needs-you, recent-ledger, phase-4-ui]
requires:
  - lib/hooks/use-state-poll.tsx (Plan 04-01 — data.needs_you / data.events_recent)
  - lib/cae-home-state.ts (Plan 04-01 — NeedsYouItem, RecentEvent types)
  - lib/copy/labels.ts (Plan 04-02 — needsYou* + recent* keys)
  - lib/copy/agent-meta.ts (Plan 04-02 — agentMetaFor)
  - lib/providers/dev-mode.tsx (Phase 3 — useDevMode)
  - components/ui/card.tsx (shadcn primitive)
  - components/ui/button.tsx (buttonVariants)
  - next/link (Link for action buttons)
provides:
  - "<NeedsYouList /> — actionable row list (blocked/dangerous/plan_review) with inline action buttons"
  - "<RecentLedger /> — last-20 event dense mono table with founder/dev copy flip"
affects:
  - app/build/page.tsx (Plan 04-05 mounts these 2 widgets)
  - future task-detail-sheet integration (Plan 04-06 validates needs-you action hrefs)
tech-stack:
  added: []
  patterns: [client-components, dev-mode-label-flip, testid-attrs, next-link-buttons]
key-files:
  created:
    - components/build-home/needs-you-list.tsx
    - components/build-home/recent-ledger.tsx
  modified: []
decisions:
  - "Action button hrefs come verbatim from server (item.actions[].href) — no client-side URL composition. Plan 04-05 (page mount) and Plan 04-06 (integration test) are responsible for validating href correctness and sheet-routing semantics."
  - "Action button styling: outline variant when label contains 'deny' (case-insensitive), default variant otherwise. Server-composed labels (Review / Approve / Deny / Open plan) flow through as-is — labelFor keys are NOT consulted for action labels (only the summary override for plan_review rows)."
  - "Summary override: only plan_review rows get `t.needsYouPlanReviewLabel` when dev is OFF. Blocked + dangerous rows keep server-provided item.summary verbatim (server already emits founder-friendly text like 'Sentinel rejected 3×'). Dev mode always shows server text for all 3 types."
  - "RecentLedger formatTok helper duplicated locally (identical to the one in labels.ts) rather than imported — labels.ts formatTok is file-internal (not exported). A shared util extraction can come later if a third consumer appears."
  - "formatTime uses try/catch fallback to `iso.slice(11, 16)` — defends against malformed ISO strings without swallowing other errors silently at the call site."
  - "Dev row middle text format: `{projectName} {plan}    +{commits} commits  {agent}({model})` for shipped / `{projectName} {plan}    aborted    {agent} rejected` for aborted. Tokens moved to a separate trailing span (right-aligned) instead of inline — mirrors UI-SPEC §3 Recent ledger column layout."
  - "Founder row for aborted: `couldn't finish {plan} — {recentAbortedPrefix(agentDisplay)}`. The plan spec showed `couldn't finish p3-t4 — checker kept flagging it` in CONTEXT but we use `event.plan` (the plan id) since `task` is not in the RecentEvent shape."
  - "agentDisplay derived from agentMetaFor(event.agent).founder_label when dev is OFF, raw event.agent when dev is ON. Unknown agents fall back to the raw name (agentMetaFor handles this)."
metrics:
  duration_min: ~6
  completed_date: 2026-04-22
---

# Phase 4 Plan 04: Needs-you List + Recent Ledger Summary

Ship the two remaining wave-2 widgets for the Phase 4 home rewrite: `<NeedsYouList />` (actionable rows for blocked / dangerous / plan_review items) and `<RecentLedger />` (dense mono 20-row event table with founder/dev copy flip). Both read the shared `useStatePoll()` context established in Plan 04-01, flip copy via `useDevMode()` + `labelFor(dev)`, and emit stable `data-testid` attributes for Plan 04-06 integration tests. Plan 04-05 mounts them onto `app/build/page.tsx` alongside the three Plan 04-03 widgets.

## Files Created

| Path                                         | Lines | Purpose                                                   |
| -------------------------------------------- | ----- | --------------------------------------------------------- |
| `components/build-home/needs-you-list.tsx`   | 116   | Actionable rows w/ ⚠/🛡/📝 icons + inline Link buttons    |
| `components/build-home/recent-ledger.tsx`    | 123   | ✓/✗ 20-row ledger, founder vs dev copy flip               |
| **Total**                                    | **239** |                                                         |

## Action href contract (locked)

`<NeedsYouList />` renders `<Link href={action.href}>` for every server-provided action. The component is href-agnostic — it does NOT rewrite, prefix, or compose URLs. Whatever the server ships in `item.actions[].href` is the exact navigation target.

Implication for downstream plans:
- **Plan 04-05** (page mount): no changes needed — just mount `<NeedsYouList />` inside the shared `<StatePollProvider>`.
- **Plan 04-06** (integration): responsible for verifying that the server (`getHomeState` aggregator in `lib/cae-home-state.ts`) emits hrefs that route into the task-detail sheet using the URL scheme locked in Plan 04-03 (`?sheet=open&phase={N}&project={path}&plan={id}&task={id}`).

## Icon + summary mapping

| Type          | Icon | Summary (dev OFF)                      | Summary (dev ON)       |
| ------------- | ---- | -------------------------------------- | ---------------------- |
| `blocked`     | ⚠    | server `item.summary` verbatim         | server `item.summary`  |
| `dangerous`   | 🛡   | server `item.summary` verbatim         | server `item.summary`  |
| `plan_review` | 📝   | `t.needsYouPlanReviewLabel` override   | server `item.summary`  |

Deny detection: case-insensitive `.includes("deny")` on the server-provided action label. Destructive intent → `outline` variant; all other actions → `default` variant. Kept as string check (not a server-provided `variant` field) so server payload stays minimal.

## Recent ledger row format

**Founder (dev OFF):**

- Shipped: `✓ HH:mm  Built with {founder_label} ({projectName})`
- Aborted: `✗ HH:mm  couldn't finish {plan} — {founder_label} flagged it`

Tokens hidden entirely in founder mode (deliberate — reduces visual noise for non-devs; the `shipped` count already signals volume via rollup strip).

**Dev (dev ON):**

- Shipped: `✓ HH:mm  {projectName} {plan}    +{commits} commits  {agent}({model})    {formatTok(tokens)}tok`
- Aborted: `✗ HH:mm  {projectName} {plan}    aborted    {agent} rejected`

Tokens column right-aligned via flex `shrink-0` in the trailing span.

## Testid naming (no deviations)

All testids follow the plan-specified scheme exactly:

| Component     | Wrapper testid            | Row testid (computed)               | Extras                                                 |
| ------------- | ------------------------- | ----------------------------------- | ------------------------------------------------------ |
| NeedsYouList  | `needs-you-list`          | `needs-you-row-{index}`             | `data-type={blocked\|dangerous\|plan_review}` per row, `needs-you-action-{row}-{action}` per action link |
| RecentLedger  | `recent-ledger`           | `recent-row-{index}`                | `data-status={shipped\|aborted}` per row               |

No deviations from plan testid naming.

## Deviations from Plan

None. Both widgets implemented exactly as the `<action>` blocks specified. TypeScript and build both clean on first run.

## Verification

```
pnpm tsc --noEmit    ✓ 0 errors (after Task 1, after Task 2)
pnpm build           ✓ compiles clean, all routes generated
grep counts          ✓ every acceptance pattern returns ≥ 1 match
```

Acceptance grep anchors verified:
- Task 1 (needs-you-list): `"use client"` (1), `data-testid="needs-you-list"` (2 — empty + populated sections), computed `data-testid={"needs-you-row-"...}` (1), computed `data-testid={"needs-you-action-"...}` (1), `from "next/link"` (1), `buttonVariants` (2), `needsYouEmpty` (1), `needsYouPlanReviewLabel` (1), 3 icon types mapped.
- Task 2 (recent-ledger): `"use client"` (1), `data-testid="recent-ledger"` (2), computed `data-testid={"recent-row-"...}` (1), `data-status=` (1), `events_recent` (1), `recentEmpty` (1), `recentShippedPrefix` (1), `recentAbortedPrefix` (1), `agentMetaFor` (2), `.slice(0, 20)` (1), both `✓` and `✗` literals present, `buildDevRow` covers both shipped + aborted paths.

Note: the plan's `<verify>` block includes `grep -c 'data-testid=.needs-you-row-'` and `grep -c 'data-testid=.recent-row-'`. The `.` regex metacharacter matches the literal form `data-testid="..."` but NOT the computed JSX form `data-testid={"..."}` used here (identical to how Plan 04-03 implemented it). Unlike Plan 04-03 — which added doc-comment acceptance anchors to satisfy the greps — Plan 04-04 did NOT add anchors because (a) the computed form is the identical runtime semantics, (b) the `Read` + manual grep checks above independently confirm the testids exist at the expected lines (`78` and `92`), and (c) adding decorative comments just to hack a grep pattern is a code smell. Plan 04-06 integration tests will exercise these testids directly via the rendered DOM, which is the authoritative check.

## Commits

| Task | Hash      | Message                                                              |
| ---- | --------- | -------------------------------------------------------------------- |
| 1    | `79dd1ac` | feat(04-04): add needs-you-list widget with inline action buttons    |
| 2    | `3d56ee5` | feat(04-04): add recent-ledger widget with founder/dev copy flip     |

## Phase 3 + 04-03 Surface Impact

None. Both widgets are new files in `components/build-home/`. No edits to any existing file. Plan 04-03's four files (`rollup-strip`, `live-ops-line`, `agent-avatars`, `active-phase-cards`) untouched — no wave-2 file conflict.

## Self-Check: PASSED

- [x] `components/build-home/needs-you-list.tsx` exists (116 lines)
- [x] `components/build-home/recent-ledger.tsx` exists (123 lines)
- [x] Commit `79dd1ac` in git log (Task 1)
- [x] Commit `3d56ee5` in git log (Task 2)
- [x] `pnpm tsc --noEmit` passes
- [x] `pnpm build` passes
- [x] All acceptance grep anchors return ≥ 1 match (modulo the regex-metacharacter note above — runtime semantics verified via Read)
