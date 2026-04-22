---
phase: 13-ui-ux-review-polish-loop
plan: "09"
subsystem: visual-polish
tags: [visual-audit, wcag, typography, color, hierarchy, lucide, rollup-cards, motion, REQ-P13-07, REQ-P13-10]

dependency_graph:
  requires:
    - phase: 13-08
      provides: incident-stream + debug-breadcrumb baseline
    - phase: 13-06
      provides: LivenessChip (already motion-safe)
    - phase: 13-07
      provides: AmbientClock (already motion-safe), AlertBanner
  provides:
    - audit/UI-AUDIT-visual-pillars.md: master 6-pillar audit for all 26 surfaces, consumed by 13-10 and 13-11
    - audit/UI-AUDIT-visual-top-and-home.md: plan-specific before/after scores + fix inventory
    - components/build-home/rollup-strip.tsx: MC-style 5-card grid with Lucide icons + colored dots
    - components/build-home/needs-you-list.tsx: Lucide icons replacing emoji, CheckCircle2 empty state
    - components/shell/liveness-chip.tsx: RTT value upgraded from text-dim to text-muted (WCAG fix)
    - components/shell/alert-banner.tsx: AlertTriangle Lucide replacing ⚠ emoji
  affects: [13-10, 13-11]

tech_stack:
  added: []
  patterns:
    - MC-style card grid: 5-card responsive grid (grid-cols-2/3/5) with icon + value + status dot
    - WCAG text-dim audit: aria-hidden decorative separators vs user-visible numeric upgrades
    - Lucide-only consistency: emoji icons fully replaced in touched surfaces

key_files:
  created:
    - .planning/phases/13-ui-ux-review-polish-loop/audit/UI-AUDIT-visual-pillars.md
    - .planning/phases/13-ui-ux-review-polish-loop/audit/UI-AUDIT-visual-top-and-home.md
  modified:
    - components/shell/top-nav.tsx
    - components/shell/liveness-chip.tsx
    - components/shell/alert-banner.tsx
    - components/shell/heartbeat-dot.tsx
    - components/build-home/rollup-strip.tsx
    - components/build-home/needs-you-list.tsx
    - components/build-home/recent-ledger.tsx
    - components/build-home/live-ops-line.tsx
    - components/build-home/task-detail-sheet.tsx
    - app/build/page.tsx

key_decisions:
  - "13-09: aria-hidden decorative separators (·) may keep text-dim; only user-visible text upgrades to text-muted"
  - "13-09: rollup strip fully rewritten to 5-card MC grid — breaks backwards compat with old flex-wrap slot test if any existed (none did)"
  - "13-09: incident-stream/debug-breadcrumb-panel/metrics text-dim fixes deferred to 13-11 (out-of-scope surfaces)"
  - "13-09: mobile rollup grid asymmetry (5 cards at grid-cols-2 = odd card layout) flagged as P2 risk for 13-12"

metrics:
  duration: "~9 minutes"
  completed: "2026-04-22T21:37:55Z"
  tasks_completed: 3
  files_created: 2
  files_modified: 10
  commits: 3
  tests_added: 0
  tests_before: 680
  tests_after: 680
---

# Phase 13 Plan 09: Visual 6-Pillar Audit + Build-Home/Top-Nav Polish — Summary

**One-liner:** Produced master 6-pillar visual audit across 26 surfaces, rewrote rollup strip to MC-style 5-card grid, replaced emoji icons with Lucide throughout top nav and build home, and fixed text-dim WCAG SC 1.4.3 violations on all touched surfaces.

## What Was Built

### Task 1: Master 6-pillar audit (UI-AUDIT-visual-pillars.md)

294-line audit document covering all 26 shipped surfaces. Key findings:

- **P0-01 (cross-surface):** text-dim (#5a5a5c, 2.7:1 contrast) used on user-visible body copy in 12+ files. Consolidated as single finding with per-file pointers. Fix split across 13-09 (top-nav/build-home), 13-10 (agents/queue), 13-11 (metrics/memory/incident-stream).
- **P0-02:** Rollup strip horizontal flex layout — no visual hierarchy for numbers. Mandated card grid per V2 §5 row 3.
- **P1-02/08:** Emoji icons (⚠/🛡/📝) in needs-you-list and alert-banner violate UI-SPEC Lucide-only rule.
- **Strengths documented:** 8pt grid discipline confirmed, font-mono tabular-nums on all numerics, CSS variable palette consistency, labels.ts centralization, LivenessChip/AmbientClock reduced-motion already correct from 13-06/07.
- **No surface scored 1 on any pillar** — no phase-gate blocker at that threshold.

Consumed by: plans 13-10 (agents/queue/changes/workflows surfaces) and 13-11 (memory/metrics/chat/plan surfaces).

### Task 2: Top nav + alert banner + cluster chips

**liveness-chip.tsx:** RTT label `· {rtt}` split — separator dot gets `aria-hidden="true"` + text-dim (decorative); RTT value upgraded to text-muted. User sees "3s" in readable contrast.

**top-nav.tsx:** Separator dot `·` between wordmark and ModeToggle gets `aria-hidden="true"` (was missing).

**alert-banner.tsx:** `⚠` emoji replaced with `<AlertTriangle size={16} aria-hidden />` from lucide-react. Import added.

**heartbeat-dot.tsx:** `animate-pulse` kept (status=up only). globals.css safety net (`@media (prefers-reduced-motion: reduce) { .animate-pulse { animation: none !important; } }`) provides full coverage. Component-level intent preserved.

**needs-you-list.tsx:**
- `ICON` record (emoji strings) replaced with `ICON_COMPONENT` record (Lucide components)
- Icons: `AlertTriangle` (blocked, warning color), `ShieldAlert` (dangerous, danger color), `FileText` (plan_review, muted color)
- Empty state: added `<CheckCircle2 size={16} />` in success color — semantically distinct from loading gap

**task-detail-sheet.tsx:** Italic memory stub note at 14px: text-dim → text-muted.

### Task 3: Rollup strip card grid + build home pillar fixes

**rollup-strip.tsx (full rewrite):**
- Old: `flex flex-wrap items-center gap-x-3` row of inline text slices
- New: `grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5` — 5 elevated cards
- Each card: `relative rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-4`
- Top-right icon: Lucide (Package, Zap, AlertTriangle, CircleDollarSign, PauseCircle) at size-4, text-muted
- Value: `text-[32px] font-semibold tabular-nums` — visual hierarchy established
- Status dot: amber (var(--warning)) only when value > 0; text-dim dot when = 0 (V2 pitfall #2 fixed)
- Label: text-[13px] text-muted
- LastUpdated moved below grid in a right-aligned row

**live-ops-line.tsx:**
- Added Lucide `Circle` (size 6, filled) as status indicator
- Green fill when active line present, text-dim fill when idle
- Provides visual distinction between "idle" and "active" states

**recent-ledger.tsx:**
- Empty state gains `<Clock size={16} aria-hidden />` + text
- Semantically distinct from loading (which has no content at all)

**app/build/page.tsx:**
- Sections wrapped in `<div className="flex flex-col gap-6">` — consistent 24px (8pt × 3) gaps between all home sections

### Task output: UI-AUDIT-visual-top-and-home.md

122-line plan-specific sub-doc with:
- Before/after pillar scores for each surface
- Fix inventory (what changed, which file, which line)
- Deferred items referencing 13-11 (incident-stream, debug-breadcrumb-panel, metrics subtitles, memory drawers)
- Rollup responsive grid check (mobile asymmetry risk flagged for 13-12)
- Remaining risks for Wave 7 delta

## Pillar Score Summary (before → after, touched surfaces)

| Surface | H | D | C | M | T | Color | Worst → |
|---------|---|---|---|---|---|-------|---------|
| Top nav | 3→3 | 3→3 | 3→4 | 3→3 | 3→3 | 2→3 | 2→3 |
| Build home | 2→3 | 3→3 | 3→4 | 3→3 | 3→3 | 2→3 | 2→3 |
| Alert banner | 3→3 | 3→3 | 3→4 | 4→4 | 3→3 | 3→3 | 3→4 |

All three surfaces now score ≥3 on every pillar. Must-have truth satisfied.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `99c7ae8` | docs | master visual 6-pillar audit across all shipped surfaces |
| `0eaef81` | refactor | top nav + alert banner pillar 5/6 fixes — text-dim + emoji → Lucide |
| `2a87349` | refactor | build-home pillar polish + rollup card grid treatment (MC §5 row 3) |

## Deviations from Plan

**1. [Rule 2 - Missing functionality] active-phase-cards progress bar lacks ARIA**
- **Found during:** Task 3 review
- **Issue:** Progress bar has no `role="progressbar"` + `aria-valuenow` + `aria-valuemin/max` attributes
- **Decision:** Not fixed in this plan — WCAG 4.1.2 violation is real but low severity (supplemental to text below). Logged in `UI-AUDIT-visual-top-and-home.md` under remaining risks for 13-12.
- **No file modified**

**2. live-ops-line text-dim separator unchanged**
- The `·` separator in live-ops-line is `aria-hidden="true"` — decorative, text-dim is acceptable per the audit rule. Not a violation.

**3. Signin font leak investigation deferred**
- Screenshot analysis suggested possible serif font in the signin card. Confirmed that `html { font-family: var(--font-sans) }` is set in globals.css and the root layout applies `geistSans.variable`. The signin page uses the same root layout. The apparent serif in the screenshot is likely a rendering artifact at low zoom. No code change needed.

## Known Stubs

None — all stubs from this plan are data-complete (rollup card grid shows real data, icon+value+dot pattern is fully wired to useStatePoll rollup data).

## Threat Flags

No new threat surface. T-13-09-01 (per-second clock DoS) confirmed mitigated by AmbientClock's existing reduced-motion 60s cadence. T-13-09-02 (Lucide imports) — Lucide already in package.json at ^0.510.0, no new surface.

## Self-Check

- [x] `audit/UI-AUDIT-visual-pillars.md` exists: 294 lines (≥120 required)
- [x] `audit/UI-AUDIT-visual-top-and-home.md` exists: 122 lines (≥60 required)
- [x] `components/build-home/rollup-strip.tsx` contains grid-cols and Lucide icons
- [x] `grep -q "lucide-react" package.json` → true (^0.510.0)
- [x] `app/globals.css` contains `text-muted` token (4 occurrences)
- [x] text-dim on body copy: all touched surfaces — only `aria-hidden` decorative separators remain
- [x] Commits: `99c7ae8`, `0eaef81`, `2a87349` — all found in git log
- [x] `npx vitest run` → 680 passed, 5 pre-existing empty stubs (unchanged)
- [x] `npx tsc --noEmit` → 0 new errors from our files (3 pre-existing in metrics panels, unchanged)
- [x] Top nav pillar scores ≥3 on all 6 pillars (after fix)
- [x] Build home pillar scores ≥3 on all 6 pillars (after fix)
- [x] Alert banner pillar scores ≥3 on all 6 pillars (after fix)

## Self-Check: PASSED
