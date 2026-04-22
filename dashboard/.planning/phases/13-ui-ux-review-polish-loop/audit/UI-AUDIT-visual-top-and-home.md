# UI Audit — Top Nav + Build Home + Alert Banner (Plan 13-09)

**Scope:** Three highest-frequency surfaces: top nav, /build home, alert banner
**Plan:** 13-09 (Wave 6 Part 1)
**Date:** 2026-04-23
**Parent document:** `UI-AUDIT-visual-pillars.md` (master)

---

## In-Scope Surfaces

| Surface | Component files |
|---------|----------------|
| Top nav | top-nav.tsx, cost-ticker.tsx, heartbeat-dot.tsx, liveness-chip.tsx, ambient-clock.tsx |
| Build home | rollup-strip.tsx, active-phase-cards.tsx, needs-you-list.tsx, recent-ledger.tsx, live-ops-line.tsx, app/build/page.tsx |
| Alert banner | alert-banner.tsx |

---

## Pillar Scores — Before vs After

### Top Nav

| Pillar | Before | After | Notes |
|--------|--------|-------|-------|
| 1 Hierarchy | 3 | 3 | Left: wordmark+mode toggle; center: cost ticker; right: cluster chips. Clear zones. |
| 2 Density | 3 | 3 | h-10 (40px), px-3 py-0 inner, gap-2/gap-3 between chips — all 8pt grid. No regressions. |
| 3 Consistency | 3 | 4 | alert-banner ⚠ emoji → Lucide AlertTriangle. liveness-chip separator → aria-hidden. |
| 4 Motion | 3 | 3 | heartbeat-dot animate-pulse covered by globals.css safety net. AmbientClock 60s under reduce. |
| 5 Typography | 3 | 3 | Geist sans/mono verified via `style={{ fontFamily: "var(--font-sans)" }}` on header. |
| 6 Color | 2 | 3 | liveness-chip RTT value: text-dim → text-muted (user-visible numeric, WCAG fix). separator dot aria-hidden + text-dim OK. |

### Build Home (overall page)

| Pillar | Before | After | Notes |
|--------|--------|-------|-------|
| 1 Hierarchy | 2 | 3 | Rollup strip redesigned: 5 elevated cards with 32px numbers + icons. Numbers now have clear visual weight. |
| 2 Density | 3 | 3 | app/build/page.tsx: sections wrapped in `flex flex-col gap-6` — consistent 24px gaps (8pt × 3). |
| 3 Consistency | 3 | 4 | needs-you-list: emoji icons (⚠/🛡/📝) → Lucide (AlertTriangle/ShieldAlert/FileText). |
| 4 Motion | 3 | 3 | active-phase-cards progress pulse covered by globals.css safety net. |
| 5 Typography | 3 | 3 | All font-mono tabular-nums on numeric values. Scale stays in {12,13,14,32}px. |
| 6 Color | 2 | 3 | task-detail-sheet italic note text-dim → text-muted. rollup-strip warning dots: amber only when value>0. |

### Alert Banner

| Pillar | Before | After | Notes |
|--------|--------|-------|-------|
| 1 Hierarchy | 3 | 3 | Icon + copy left, CTAs right. Clear reading order. |
| 2 Density | 3 | 3 | px-4 py-2 (8pt grid), gap-2/gap-3, text-sm. |
| 3 Consistency | 3 | 4 | ⚠ emoji → Lucide AlertTriangle (Lucide-only rule now satisfied). |
| 4 Motion | 4 | 4 | No animation. Static banner. |
| 5 Typography | 3 | 3 | text-sm body copy, text-xs CTAs. Geist sans. |
| 6 Color | 3 | 3 | Amber border + amber-900/10 bg. var(--text) copy — correct. Dismiss button amber-bordered. |

---

## Fixes Applied (this plan)

### Task 2: Top nav + alert banner

| Finding | File | Change | Status |
|---------|------|--------|--------|
| P0-01 liveness-chip RTT text-dim on user-visible numeric | liveness-chip.tsx:84 | `· {rtt}` split: separator → aria-hidden text-dim span; rtt value → text-muted span | Fixed |
| P0-01 top-nav separator dot missing aria-hidden | top-nav.tsx:33 | Added `aria-hidden="true"` to `·` separator | Fixed |
| P1-08 alert-banner ⚠ emoji | alert-banner.tsx:116 | Replaced with `<AlertTriangle size={16} aria-hidden />` from lucide-react | Fixed |
| P1-11 task-detail-sheet italic note text-dim at 14px | task-detail-sheet.tsx:182 | text-dim → text-muted | Fixed |
| P1-02 needs-you-list emoji icons | needs-you-list.tsx:12 | AlertTriangle/ShieldAlert/FileText from lucide-react with contextual colors | Fixed |
| P1-04 needs-you empty state indistinguishable from loading | needs-you-list.tsx | Added CheckCircle2 icon in success color + explicit text | Fixed |

### Task 3: Build home + rollup strip

| Finding | File | Change | Status |
|---------|------|--------|--------|
| P0-02 rollup strip horizontal flex layout | rollup-strip.tsx | Full rewrite: 5-card grid (grid-cols-2 → md:3 → lg:5), 32px value, Lucide icons (Package/Zap/AlertTriangle/CircleDollarSign/PauseCircle), colored status dots | Fixed |
| P1-03 warnings slot amber when value=0 | rollup-strip.tsx | `warning: rollup.warnings > 0` — dot is var(--text-dim) when 0, var(--warning) when >0 | Fixed |
| P2-04 live-ops-line hierarchy | live-ops-line.tsx | Added Lucide Circle status dot (green=active, dim=idle), distinguishes idle vs active visually | Fixed |
| V2 pitfall #3 recent-ledger empty state | recent-ledger.tsx | Added Clock icon in muted color to distinguish empty from loading skeleton | Fixed |
| app/build page gap discipline | app/build/page.tsx | Wrapped sections in `flex flex-col gap-6` — 24px gap (8pt × 3) between all home sections | Fixed |

---

## Deferred Items (not fixed in this plan)

| Finding | Surface | Target plan | Reason |
|---------|---------|-------------|--------|
| P0-01 incident-stream text-dim on body copy | incident-stream.tsx | 13-11 | Out of scope surface (metrics tab) |
| P0-01 debug-breadcrumb-panel text-dim | debug-breadcrumb-panel.tsx | 13-11 | Dev-mode only, lower priority |
| P0-01 metrics/golden-signals-subtitles text-dim | golden-signals-subtitles.tsx | 13-11 | Metrics surface |
| P0-01 memory/why-drawer text-dim | why-drawer.tsx | 13-11 | Memory surface |
| P0-01 memory/node-drawer text-dim | node-drawer.tsx | 13-11 | Memory surface |
| P0-03 signin card possible serif leak | app/auth/* | 13-09 low-pri | Requires auth layout inspection; no screenshot evidence confirmed |
| P2-08 signin card font verification | auth layout | 13-09 low-pri | Add to deferred-items if no time |

---

## Screenshot References

**Before:** `.planning/phases/13-ui-ux-review-polish-loop/shots/before/laptop-founder/root.png`
  — signin page only; authenticated build-home screenshots not available in this session.

**Code-level analysis:** All findings above are from static code inspection of component source files, cross-referenced against the design system tokens (globals.css) and UI-SPEC.md.

---

## Rollup Card Responsive Check

| Viewport | Grid columns | Expected behavior |
|----------|-------------|-------------------|
| mobile (375px) | 2 cols (`grid-cols-2`) | Cards wrap: 3 top row (2+1 or 2+3), constrained width. 32px values may feel large at 375px. |
| laptop (1280px) | 3 cols (`md:grid-cols-3`) | 5 cards: 3 top + 2 bottom. Values visible, no overflow. |
| wide (1920px) | 5 cols (`lg:grid-cols-5`) | All 5 cards in a single row. Ideal presentation. |

**Risk flagged:** On mobile at grid-cols-2, the 5-card layout means 3 cards in the first row but only 2 fill the second row. This leaves an asymmetric layout at mobile widths. Flag for Wave 7 delta (plan 13-12): consider `grid-cols-2 sm:grid-cols-3 md:grid-cols-5` or a horizontal scroll for mobile.

---

## Remaining Risks for Wave 7 Delta

1. **Rollup mobile asymmetry** — 5-card grid leaves 1 orphaned card at 375px (see above).
2. **needs-you-list loading state** — component returns empty list when `data` is null (pre-first-poll). Items=0 AND data=null currently render the same "all caught up" empty state. Fix: distinguish `data === undefined` (loading) from `data.needs_you.length === 0` (truly empty).
3. **HeartbeatDot vs LivenessChip duplication** — both chips on top nav, both show system health. HeartbeatDot = circuit-breaker state; LivenessChip = data freshness. This is intentional but may confuse non-dev founders. Consider consolidating into LivenessChip tooltip in Wave 7.
4. **active-phase-cards progress bar no ARIA** — `role="progressbar"` + `aria-valuenow` + `aria-valuemin/max` missing. WCAG 4.1.2. Low priority (progress bar is supplemental to the text below it).
