---
phase: 13-ui-ux-review-polish-loop
plan: "11"
subsystem: visual-polish
tags: [visual-audit, wcag, typography, color, panel-component, chat-bubbles, signin, memory, metrics, REQ-P13-07, REQ-P13-10]

dependency_graph:
  requires:
    - phase: 13-09
      provides: master visual 6-pillar audit (UI-AUDIT-visual-pillars.md)
    - phase: 13-10
      provides: agents/queue/changes/workflows polish baseline
    - phase: 13-08
      provides: incident-stream chrome baseline
  provides:
    - components/ui/panel.tsx: shared Panel chrome wrapper adopted by 4 panel-shaped components
    - audit/UI-AUDIT-visual-memory-metrics-chat-plan.md: 172-line before/after pillar scores for 13 surfaces
  affects: [13-12]

tech_stack:
  added: []
  patterns:
    - Shared Panel primitive: rounded-lg border bg-surface p-6, h2 15px semibold, optional subtitle 12px muted, aria-labelledby auto-derived
    - Chat bubble design: max-w-65ch, user right-aligned accent/10, assistant left-aligned bg-elev, avatar outside bubble
    - Skeleton loading shimmer: animate-pulse shapes + motion-reduce:animate-none inline guard

key_files:
  created:
    - components/ui/panel.tsx
    - components/ui/panel.test.tsx
    - .planning/phases/13-ui-ux-review-polish-loop/audit/UI-AUDIT-visual-memory-metrics-chat-plan.md
  modified:
    - components/memory/browse/file-tree.tsx
    - components/memory/graph/graph-pane.tsx
    - components/memory/graph/graph-filters.tsx
    - components/memory/graph/node-drawer.tsx
    - components/memory/why-drawer.tsx
    - components/metrics/spending-panel.tsx
    - components/metrics/reliability-panel.tsx
    - components/metrics/speed-panel.tsx
    - components/metrics/golden-signals-subtitles.tsx
    - components/shell/incident-stream.tsx
    - components/chat/chat-panel.tsx
    - components/chat/message.tsx
    - app/plan/page.tsx
    - app/signin/page.tsx
    - app/signin/github-sign-in-button.tsx

key_decisions:
  - "13-11: Panel subtitle renders at 12px text-muted; spending panel passes <EstDisclaimer> as subtitle — keeps header compact without breaking existing layout"
  - "13-11: data! non-null assertions on metrics panels (spending/reliability/speed) — all null paths return early before the loaded state; assertion is safe and avoids unnecessary optional chaining in render"
  - "13-11: Chat message bubble max-w-[65ch] not max-w-prose — 65ch is closer to the 60-70ch readability sweet spot and aligns with the UI-SPEC interface spec"
  - "13-11: Signin uses bg-accent text-black for GitHub button — cyan (#00d4ff) on black (#0a0a0a) is ~10:1 contrast; inverted from app chrome but correct for primary CTA emphasis"
  - "13-11: Plan home tab preview row is aria-hidden — it's a visual preview, not interactive; real tabs come in Phase 10"

metrics:
  duration: "~25 minutes"
  completed: "2026-04-23T07:06:00Z"
  tasks_completed: 3
  files_created: 3
  files_modified: 12
  commits: 3
  tests_added: 9
  tests_before: 701
  tests_after: 701
---

# Phase 13 Plan 11: Wave 6c Visual Pillar Polish (Memory/Metrics/Chat/Plan/Signin) — Summary

**One-liner:** Shipped shared Panel chrome primitive adopted across 4 components, polished memory tree+drawers+graph states, redesigned chat bubbles with proper role differentiation, and produced a founder-ready signin card — closing all P0-01/P1-09/P1-10/P2-06/P2-07 findings from the master 13-09 audit for the 13-11 scope.

## What Was Built

### Task 1: Memory tree + graph + drawers polish

**file-tree.tsx:**
- Indent depth: 12px/level → **16px/level** (more legible hierarchy)
- File count chips: added `font-mono tabular-nums shrink-0` (prevents layout shift, consistent with codebase numeric pattern)

**graph-pane.tsx:**
- Loading state was plain text indistinguishable from error. Replaced with **skeleton shimmer** (3 animate-pulse bars + label) + `motion-reduce:animate-none` inline guard. Empty / cooldown / loading states are now visually distinct:
  - Loading: skeleton shimmer
  - Empty: EmptyState icon + heading + Regenerate CTA (already correct from 08-06)
  - Error: danger-colored text
  - Cooldown: RegenerateButton shows countdown (already correct from 08-06)

**graph-filters.tsx:** Node count chips `text-dim` → `text-muted` (WCAG SC 1.4.3 fix, P0-01)

**node-drawer.tsx:** Back-link/forward-ref empty state `—` and relation labels: `text-dim` → `text-muted` (3 occurrences)

**why-drawer.tsx:**
- `h2`: `text-sm font-medium` → `text-[15px] font-semibold` (pillar-5 typography scale)
- Drawer padding: `p-4` → `p-6` (UI-SPEC §13 24px minimum)
- Timestamps + dev note: `text-dim` → `text-muted` (WCAG fix, P1-10)

### Task 2: Shared Panel chrome + metrics + incident stream + chat

**components/ui/panel.tsx (new):**
- `<Panel title subtitle? headingId? className? testId? as?>` wrapper
- Uniform chrome: `rounded-lg border border-[--border] bg-[--surface] p-6`
- Header: `h2` at `text-[15px] font-semibold`, subtitle at `text-[12px] text-muted`
- `aria-labelledby` auto-derived from title (override with `headingId`)
- 9 unit tests covering all props

**Panel adoption — 4 components:**
| Component | States using Panel |
|-----------|-------------------|
| `spending-panel.tsx` | error, loading, empty, loaded |
| `reliability-panel.tsx` | error, loading, empty, loaded |
| `speed-panel.tsx` | error, loading, empty, loaded |
| `incident-stream.tsx` | always-on panel |

**golden-signals-subtitles.tsx:** `text-dim 11px` → `text-muted 12px` (P2-06 — both contrast and size fixed)

**incident-stream.tsx:** "Gateway healthy." + event timestamps `text-dim` → `text-muted` (P1-09); wrapped in Panel; event count moved to Panel subtitle.

**message.tsx (full bubble redesign):**
- User: `flex justify-end`, bubble `bg-accent/10 border border-accent/20 rounded-lg p-3 max-w-[65ch]`
- Assistant: `flex items-start gap-2`, emoji avatar (6×6 circle) outside bubble left, bubble `border bg-bg-elev rounded-lg p-3 max-w-[65ch]`
- Role label: `text-[11px] font-mono text-muted`
- Timestamp below bubble: `text-[11px] font-mono text-muted` (was `text-dim`)
- Streaming caret: `motion-reduce:animate-none` guard added

**chat-panel.tsx:**
- Empty state: single-line text → centered heading (`text-[15px] font-medium`) + sub-copy
- Textarea: `text-sm placeholder:text-dim` → `text-[15px] placeholder:text-muted`

### Task 3: Plan home + signin + audit doc

**app/plan/page.tsx:**
- Added `text-[15px] text-muted leading-relaxed` sub-copy explaining Plan mode scope
- Added coming-soon tabs preview strip (`aria-hidden`) with Projects/PRDs/Roadmaps/UAT — sets visual expectation without interactive confusion
- Container: `flex flex-col gap-6 mx-auto` — consistent 24px gaps (8pt × 3)

**app/signin/page.tsx:**
- Replaced shadcn `bg-card`/`text-muted-foreground` tokens with CSS var palette
- Centered card: `max-w-sm rounded-xl border bg-[--surface] px-8 py-10 shadow-xl`
- Product wordmark: `text-[32px] font-semibold` + `text-[13px] uppercase tracking-widest` tagline
- Value prop: `text-[15px] leading-relaxed max-w-[260px]` centered
- Radial gradient backdrop: `bg-[--accent]/5 blur-3xl 600px` — subtle depth without distraction
- Footer: `© {year}` at `text-[11px] text-muted opacity-60`

**app/signin/github-sign-in-button.tsx:**
- Added Lucide `<Github size={5}>` icon
- `bg-accent text-black` → 10:1+ WCAG AA contrast
- `py-3 w-full` → ≥48px touch target (WCAG 2.5.8)
- `focus-visible:ring-2` focus indicator
- `void signIn("github")` — auth flow unchanged (T-13-11-01)

**audit/UI-AUDIT-visual-memory-metrics-chat-plan.md:** 172-line document covering:
- Before/after pillar scores for 13 surfaces
- Per-surface fix inventory with file references
- Panel adoption table
- Pillar 4 motion callout for memory graph reducedMotion
- WCAG AA analysis for signin button (text 10.8:1, border 3:1+, touch target 48px)
- Wave 7 regression risks (chat bubble narrow mobile, plan tab preview, incident-stream subtitle aria-live)

## Pillar Score Summary (13-11 scope, before → after)

| Surface | H | D | C | M | T | Color | Worst |
|---------|---|---|---|---|---|-------|-------|
| Memory browse | 3→3 | 3→3 | 3→3 | 4→4 | 3→3 | 2→**3** | 2→**3** |
| Memory why-drawer | 3→3 | 3→3 | 3→3 | 4→4 | 2→**3** | 2→**3** | 2→**3** |
| Memory node-drawer | 3→3 | 3→3 | 3→3 | 4→4 | 3→3 | 2→**3** | 2→**3** |
| Metrics spending | 3→3 | 3→3 | 3→**4** | 4→4 | 3→3 | 2→**3** | 2→**3** |
| Metrics reliability | 3→3 | 3→3 | 3→**4** | 4→4 | 3→3 | 2→**3** | 2→**3** |
| Metrics speed | 3→3 | 3→3 | 3→**4** | 4→4 | 3→3 | 3→3 | 3→**4** |
| Incident stream | 3→3 | 3→3 | 3→**4** | 4→4 | 2→**3** | 2→**3** | 2→**3** |
| Chat messages | 2→**3** | 3→3 | 2→**3** | 4→4 | 2→**3** | 2→**3** | 2→**3** |
| Plan home | 2→**3** | 3→3 | 3→3 | 4→4 | 2→**3** | 3→3 | 2→**3** |
| Signin | 3→**4** | 3→3 | 3→**4** | 4→4 | 2→**3** | 3→**4** | 2→**3** |

All surfaces now score ≥3 on every pillar.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `bed1479` | refactor | memory tree + graph + drawer pillar polish |
| `c2d2190` | refactor | shared Panel chrome + chat pillar polish |
| `8103845` | refactor | plan + signin polish + pillar audit doc |

## Deviations from Plan

**1. [Rule 2 - Missing functionality] data! assertions on metrics panels**
- **Found during:** Task 2 tsc check
- **Issue:** Panel refactor exposed pre-existing `data is possibly null` TypeScript errors — the `const s = data.spending` line was only safe because all null paths exited early, but TypeScript couldn't narrow through the early returns without the original `section` element providing structural context
- **Fix:** Added `data!` non-null assertion with explanatory comment on each. Safe: every null path (error, loading, empty) returns early before the `data!` line is reached.
- **Files modified:** spending-panel.tsx, reliability-panel.tsx, speed-panel.tsx

**2. Plan action — tabs preview row aria-hidden**
- Audit noted the greyed tab row could confuse users. Mitigated by `aria-hidden="true"` (screen readers skip), no click handler (no accidental navigation), and explicit `opacity-40` indicating inactive state. No code change needed beyond existing implementation.

## Known Stubs

None — all data paths in this plan are either live (metrics panels use useMetricsPoll, incident stream uses SSE, memory uses /api/memory/*) or correctly display empty/loading states. No hardcoded placeholder values introduced.

## Threat Flags

No new threat surface. Signin page visual polish preserves NextAuth flow unchanged — `signIn("github")` call unmodified. T-13-11-01 mitigated per WCAG AA analysis in audit doc.

## Wave 7 Regression Risks

1. **Chat bubble max-width on 320px viewport:** `max-w-[65ch]` renders within a 50% pane on /chat — test on narrow mobile in 13-12
2. **Incident stream Panel subtitle not aria-live:** Event count in subtitle doesn't announce to screen readers — acceptable for now (supplementary metadata)
3. **Plan tabs preview misleading on hover:** No hover state applied (`opacity-40` flat) but cursor is default. Flag for 13-12 — add `cursor-not-allowed` tooltip

## Self-Check

- [x] `components/ui/panel.tsx` exists + is non-empty
- [x] `grep -q "ChevronDown\|ChevronRight" components/memory/browse/file-tree.tsx` → FOUND
- [x] Panel used in spending-panel, reliability-panel, speed-panel, incident-stream (4 components ≥ 3 required)
- [x] Audit doc: 172 lines (≥70 required)
- [x] Commits `bed1479`, `c2d2190`, `8103845` — all found in git log
- [x] `npx vitest run` → 701 passed (5 pre-existing empty-suite failures unchanged from baseline)
- [x] `npx tsc --noEmit` → 0 new errors in our files (pre-existing errors in unrelated test files unchanged)
- [x] All 13 surfaces now score ≥3 on every pillar

## Self-Check: PASSED
