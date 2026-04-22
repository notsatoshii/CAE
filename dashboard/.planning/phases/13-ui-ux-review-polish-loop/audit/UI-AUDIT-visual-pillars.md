# UI Audit — Visual 6-Pillar Report (Master)

**Scope:** All shipped surfaces, Plan 13-09 code audit + signin screenshot review
**Method:** Static code inspection (grep + component-by-component read) + visual analysis of signin screenshots
**Date:** 2026-04-23
**Plan assignment:** This document is consumed by plans 13-09 (top nav/build-home/alert banner), 13-10 (agents/queue/changes/workflows), and 13-11 (memory/metrics/chat/plan)

---

## Rubric (V2 §6)

| Pillar | Criterion | Score 4 | Score 3 | Score 2 | Score 1 |
|--------|-----------|---------|---------|---------|---------|
| 1 Hierarchy | Focal point, size 1.5× secondary, ≤2 weights | Single clear focus, two weights | Clear focus, minor confusion | Competing foci | No hierarchy |
| 2 Density | 8pt grid, row height 32-40px lists, 12-14px padding | All 8pt, rows 32-40px | Mostly 8pt, 1-2 deviations | Arbitrary values prevalent | No grid discipline |
| 3 Consistency | Same action = same visual; Lucide only; CTAs via labels.ts | 100% consistent | 1-2 divergences | Systematic inconsistency | Random styling |
| 4 Motion | prefers-reduced-motion respected; no perpetual pulse except liveness | Full respect | Minor edge case | Pulse persists under reduce | Ignores media query |
| 5 Typography | Geist Sans+Mono; scale {13,14,15,16,20,24,32}px; weights 400/500/600 | All correct | 1-2 off-scale | Arbitrary sizes prevalent | Wrong font |
| 6 Color | WCAG 2.2 AA: body ≥4.5:1, UI/large ≥3:1 | All AA+ | 1-2 fails on non-body | Body copy fails | Multiple body fails |

---

## Surface Pillar Scores

| Surface | Plan | Hierarchy | Density | Consistency | Motion | Typography | Color | Worst |
|---------|------|-----------|---------|-------------|--------|------------|-------|-------|
| Signin card | 13-09 | 3 | 3 | 3 | 4 | 2 | 3 | 2 |
| Top nav | 13-09 | 3 | 3 | 3 | 3 | 3 | 2 | 2 |
| Alert banner | 13-09 | 3 | 3 | 3 | 4 | 3 | 3 | 3 |
| Build home page | 13-09 | 2 | 3 | 3 | 3 | 3 | 2 | 2 |
| Rollup strip | 13-09 | 2 | 3 | 3 | 4 | 3 | 2 | 2 |
| Active phase cards | 13-09 | 3 | 3 | 3 | 2 | 3 | 3 | 2 |
| Needs-you list | 13-09 | 3 | 3 | 2 | 4 | 2 | 2 | 2 |
| Recent ledger | 13-09 | 3 | 3 | 3 | 4 | 3 | 3 | 3 |
| Live ops line | 13-09 | 2 | 3 | 3 | 4 | 3 | 2 | 2 |
| Agents grid | 13-10 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| Agent drawer | 13-10 | 3 | 3 | 3 | 4 | 3 | 3 | 3 |
| Queue kanban | 13-10 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| Queue card | 13-10 | 3 | 3 | 3 | 3 | 3 | 3 | 3 |
| Changes timeline | 13-10 | 3 | 3 | 3 | 4 | 3 | 3 | 3 |
| Workflows list | 13-10 | 3 | 3 | 3 | 4 | 3 | 3 | 3 |
| Workflow edit | 13-10 | 3 | 3 | 3 | 4 | 3 | 3 | 3 |
| Metrics spending | 13-11 | 3 | 3 | 3 | 4 | 3 | 2 | 2 |
| Metrics reliability | 13-11 | 3 | 3 | 3 | 4 | 3 | 2 | 2 |
| Metrics speed | 13-11 | 3 | 3 | 3 | 4 | 3 | 3 | 3 |
| Memory browse | 13-11 | 3 | 3 | 3 | 4 | 3 | 2 | 2 |
| Memory graph | 13-11 | 3 | 3 | 3 | 4 | 3 | 3 | 3 |
| Memory why drawer | 13-11 | 3 | 3 | 3 | 4 | 2 | 2 | 2 |
| Incident stream | 13-11 | 3 | 3 | 3 | 4 | 2 | 2 | 2 |
| Chat rail | 13-11 | 3 | 3 | 3 | 4 | 3 | 3 | 3 |
| Phase detail | 13-10 | 3 | 3 | 3 | 4 | 3 | 3 | 3 |
| Task detail sheet | 13-09 | 3 | 3 | 3 | 4 | 2 | 2 | 2 |

---

## Findings by Severity

### P0 — Phase-gate blockers (must resolve before D-08 gate)

**P0-01: text-dim (#5a5a5c, 2.7:1) used for body-copy on 12+ surfaces (WCAG SC 1.4.3 failure)**
- **Pillar:** 6 (Color)
- **Surfaces:** top-nav wordmark separator, liveness-chip RTT label, live-ops-line separator, rollup-strip dividers, needs-you-list separator, task-detail-sheet italic note, incident-stream empty text + timestamp, debug-breadcrumb-panel empty+timestamp, metrics subtitles, memory why-drawer timestamps, node-drawer empty placeholders
- **Specific files:**
  - `components/shell/top-nav.tsx:33` — separator dot `·`
  - `components/shell/liveness-chip.tsx:84` — `· {rtt}` label (user-visible text showing RTT seconds)
  - `components/build-home/live-ops-line.tsx:24` — separator dot
  - `components/build-home/rollup-strip.tsx:92` — Divider `·`
  - `components/build-home/needs-you-list.tsx:90` — separator dot
  - `components/build-home/task-detail-sheet.tsx:182` — italic "ships in Phase 8" body copy (14px, NOT decorative)
  - `components/shell/incident-stream.tsx:151,181,211` — "Since HH:mm:ss", "Gateway healthy.", timestamp
  - `components/shell/debug-breadcrumb-panel.tsx:116,134` — empty text, timestamps
  - `components/metrics/golden-signals-subtitles.tsx:130` — 11px subtitle (body)
  - `components/metrics/halt-events-log.tsx:51` — 10px timestamp
  - `components/memory/why-drawer.tsx:314,364,373` — 10px timestamps + italic note
  - `components/memory/graph/node-drawer.tsx:167,178,194,205` — "—" placeholders + back-link labels
- **Fix scope 13-09:** top-nav, liveness-chip, live-ops-line, rollup-strip, needs-you-list, task-detail-sheet
- **Fix scope 13-10:** agents components (if any found), changes/queue/workflows
- **Fix scope 13-11:** metrics, memory, incident-stream, debug-breadcrumb-panel
- **Rule for separators/decorative dots:** `aria-hidden="true"` decorative separators MAY keep text-dim. Only user-readable text must use text-muted.
- **Rule for ≤10px mono tabular-nums:** text-dim is permitted on purely decorative/supplementary metadata at 10px (e.g. "10px rank numbers") — upgrade to text-muted anywhere the value IS the information.
- **WCAG SC:** 1.4.3

**P0-02: Rollup strip renders as a horizontal flex row — not the MC 5-card grid (V2 §5 row 3)**
- **Pillar:** 1 (Hierarchy) — numbers have no visual weight/elevation; context collapsed to inline text
- **Surface:** `components/build-home/rollup-strip.tsx`
- **Defect:** `flex flex-wrap items-center gap-x-3` layout; numbers presented inline with no semantic card elevation; `shipped_today` and `tokens_today` have identical visual weight as `warnings`; no Lucide icons; no color-coded status dots
- **Fix:** Convert to 5-card grid per V2 §5 row 3 (target in 13-09 Task 3)

**P0-03: Signin card body copy uses system serif fallback**
- **Pillar:** 5 (Typography)
- **Surface:** signin card at `/auth/signin`
- **Evidence (screenshot):** The subtitle text "Ctrl+Alt+Elite — your AI engineering team. Sign in to start new projects..." visually renders in a proportional serif that does NOT match Geist Sans. The CAE heading also appears to use a serif at this zoom level. Geist Sans should be sans-serif.
- **Fix scope 13-09 (low priority):** Verify `html { font-family: var(--font-sans) }` in globals.css is being applied to the auth route. Check if the auth page is outside Next.js root layout. The root layout applies Geist Sans via `className={geistSans.variable}` but auth routes may use a separate layout without font application.
- **Action:** Audit `app/auth/` layout to confirm font variables are applied.

---

### P1 — High-priority visual defects (should fix in assigned plan wave)

**P1-01: Active phase cards — progress bar pulses perpetually when `running === true`**
- **Pillar:** 4 (Motion)
- **Surface:** `components/build-home/active-phase-cards.tsx:82`
- **Defect:** `running ? "animate-pulse" : ""` — pulse animation on progress bar has no prefers-reduced-motion guard at the component level. globals.css has a safety net for `.animate-pulse`, so this is currently mitigated by the global CSS. But the intent (pulsing progress bar) defeats the spirit of reduced-motion.
- **Fix scope 13-09:** Confirm globals.css safety net covers this exact class; add inline `aria-live="polite"` on progress bar region.

**P1-02: Emoji icons in needs-you list (consistency pillar)**
- **Pillar:** 3 (Consistency)
- **Surface:** `components/build-home/needs-you-list.tsx:12-16`
- **Defect:** `ICON = { blocked: "⚠", dangerous: "🛡", plan_review: "📝" }` — emoji icons mixed with Lucide icons elsewhere. UI-SPEC §13 states Lucide only for icons.
- **Fix scope 13-09:** Replace with `AlertTriangle`, `ShieldAlert`, `FileText` from lucide-react.

**P1-03: Rollup strip warnings slot always shows amber even when warnings === 0**
- **Pillar:** 6 (Color)
- **Surface:** `components/build-home/rollup-strip.tsx:55-59`
- **Defect:** `rollupWarningsLabel + rollup.warnings` is passed as the `value` prop and `warning={rollup.warnings > 0}` is set. However, `rollupWarningsLabel` is the emoji "⚠" which always appears in the slot label. When warnings === 0, the warnings slot does not trigger amber (warning prop is false), but the emoji prefix "⚠" still renders at default text color, creating visual noise. This also partially violates pillar-3 (emoji in labels.ts for this slot).
- **Fix scope 13-09:** Remove emoji from rollupWarningsLabel in labels.ts; use Lucide in the slot per card-grid redesign.

**P1-04: Needs-you list empty state uses text-only "All caught up ✓" — indistinguishable from loading**
- **Pillar:** 1 (Hierarchy) + Pillar 3 (Consistency)
- **Surface:** `components/build-home/needs-you-list.tsx` empty state
- **Defect:** When data is null (loading), the component renders empty. When data is an empty array (truly clear), it renders `"All caught up ✓"`. These states look identical during the polling gap.
- **Fix scope 13-09:** Add a Lucide `CheckCircle` icon in the empty state + distinct loading skeleton state.

**P1-05: LivenessChip RTT label uses text-dim for user-visible numeric**
- **Pillar:** 6 (Color)
- **Surface:** `components/shell/liveness-chip.tsx:84`
- **Defect:** `<span className="text-[color:var(--text-dim)]">· {rtt}</span>` — the RTT value "3s" is user-readable information displayed at 10px but is the number the user cares about. Falls under P0-01 but noted here as a named callout because it's on the most-visible surface (top nav).
- **Fix:** Upgrade to `text-muted`. The separator `·` can stay text-dim since it's `aria-hidden`.

**P1-06: Live ops line separator dot carries text-dim on user-visible line**
- **Pillar:** 6 (Color)
- **Surface:** `components/build-home/live-ops-line.tsx:24`
- **Defect:** `<span className="text-[color:var(--text-dim)]" aria-hidden="true">·</span>` — this is `aria-hidden` so it's decorative. This one is actually acceptable (decorative dot is fine at text-dim). However, the live ops line section label "Live Ops" uses `text-muted` already, which is correct. No change needed for this specific dot.
- **Note:** Confirmed acceptable — decorative separator, aria-hidden.

**P1-07: HeartbeatDot animate-pulse not gated by component-level motion check**
- **Pillar:** 4 (Motion)
- **Surface:** `components/shell/heartbeat-dot.tsx:33`
- **Defect:** `status === "up" && "animate-pulse"` — same as P1-01 above; covered by globals.css safety net, but component-level intent not expressed.
- **Fix scope 13-09:** Add inline reduced-motion conditional to be explicit.

**P1-08: Alert banner uses raw `⚠` emoji for warning icon**
- **Pillar:** 3 (Consistency)
- **Surface:** `components/shell/alert-banner.tsx:116`
- **Defect:** `<span aria-hidden ...>⚠</span>` — emoji icon breaks consistency with Lucide usage elsewhere.
- **Fix scope 13-09:** Replace with Lucide `AlertTriangle` icon.

**P1-09: Incident stream body copy uses text-dim for legible status text**
- **Pillar:** 6 (Color)
- **Surface:** `components/shell/incident-stream.tsx:151,181`
- **Defect:** "No incidents since HH:mm:ss." and "Gateway healthy." rendered with `text-[color:var(--text-dim)]` — these are 12px body text, not supplementary metadata. Fails WCAG SC 1.4.3.
- **Fix scope 13-11:** Upgrade to text-muted.

**P1-10: Memory why-drawer uses text-dim on 10px timestamps**
- **Pillar:** 6 (Color)
- **Surface:** `components/memory/why-drawer.tsx:314,364,373`
- **Defect:** 10px timestamps and italic notes in why-drawer use text-dim. At 10px the contrast ratio drops below WCAG SC 1.4.3 threshold (normal text ≥ 4.5:1 regardless of size; the 3:1 exception is only for "large text" ≥ 18pt/14pt bold).
- **Fix scope 13-11:** Upgrade to text-muted.

**P1-11: Task detail sheet italic "ships in Phase 8" uses text-dim at 14px**
- **Pillar:** 6 (Color)
- **Surface:** `components/build-home/task-detail-sheet.tsx:182`
- **Defect:** `text-sm text-[color:var(--text-dim)] italic` — 14px body copy at 2.7:1 contrast. Fails WCAG SC 1.4.3.
- **Fix scope 13-09:** Upgrade to text-muted.

---

### P2 — Polish improvements (nice-to-have within wave, else defer to 13-12)

**P2-01: Top nav separator dots between cluster sections use text-dim**
- **Pillar:** 6 (Color)
- **Surface:** `components/shell/top-nav.tsx:33` — `·` separator between "CAE" wordmark and ModeToggle
- **Note:** `aria-hidden` not set on this separator. Add `aria-hidden="true"` to make it decorative, then text-dim is acceptable.
- **Fix scope 13-09:** Add `aria-hidden="true"`.

**P2-02: Rollup strip divider dots are aria-hidden but still text-dim**
- **Pillar:** 6 (Color)
- **Surface:** `components/build-home/rollup-strip.tsx:92`
- **Note:** Already `aria-hidden="true"`. Decorative use — acceptable. No change needed.

**P2-03: HeartbeatDot renders "Live" label via LastUpdated rather than human label**
- **Pillar:** 1 (Hierarchy) — the heartbeat dot's label is an opacity-adjusted timestamp, not a clear status word
- **Surface:** `components/shell/heartbeat-dot.tsx`
- **Note:** Plan 13-06 shipping LivenessChip to replace the "Live" lie is already done. HeartbeatDot now shows LastUpdated timestamp. Acceptable as a data-dense dev aid.

**P2-04: Cost ticker empty state "— tok today" mixes dash placeholder with static label**
- **Pillar:** 1 (Hierarchy)
- **Surface:** `components/shell/cost-ticker.tsx` — pre-data state shows `— tok today`
- **Fix:** Change placeholder to `…` or skeleton state rather than `—` which reads as "zero".

**P2-05: Active phase card progress percentage uses `p.progress_pct + "%"` — no tabular-nums**
- **Pillar:** 2 (Density) + 5 (Typography)
- **Surface:** `components/build-home/active-phase-cards.tsx:89`
- **Note:** `font-mono text-xs text-[color:var(--text-muted)]` is already set on the wrapping span, and font-mono implies tabular-nums. Acceptable.

**P2-06: Metrics golden-signals subtitles use text-dim at 11px**
- **Pillar:** 6 (Color)
- **Surface:** `components/metrics/golden-signals-subtitles.tsx:130`
- **Note:** 11px is below the 12px minimum used across the codebase. While 11px is in a gray zone, combined with text-dim contrast this is marginal. Fix scope 13-11.

**P2-07: Debug breadcrumb panel empty state text-dim at 12px**
- **Pillar:** 6 (Color)
- **Surface:** `components/shell/debug-breadcrumb-panel.tsx:116`
- **Note:** Dev-mode only panel. Acceptable as lower priority. Fix scope 13-11.

**P2-08: Signin card body copy font-family suspect**
- **Pillar:** 5 (Typography)
- **Surface:** signin page
- **Note:** Screenshot analysis shows body text may be rendering in serif. The root layout applies `className={geistSans.variable}` but the auth layout (`app/(auth)/layout.tsx` or `app/auth/...`) may not chain this. Inspect and fix in 13-09 if confirmed.

---

## Cross-Surface Patterns (consolidated)

### Pattern A: text-dim on user-visible body copy (P0-01 + P1-05/09/10/11)
Found in 12+ files across 4 component directories. Root cause: text-dim was used as a secondary-text color during initial development before the WCAG audit. The correct token is text-muted (#8a8a8c, 4.5:1 on #0a0a0a).

**Treatment rule:**
- Decorative separators (aria-hidden): text-dim OK
- User-visible text ≥ 1px: text-muted required
- Exception: rank numbers or supplementary tabular-nums at 10px in purely additive contexts (e.g., memory node back-reference counts) — upgrade to text-muted anyway for uniformity

### Pattern B: Emoji icons (P1-02, P1-03, P1-08)
Three surfaces use emoji icons (`⚠`, `🛡`, `📝`). UI-SPEC §13 requires Lucide only. Lucide already installed (`lucide-react@^0.510.0` in package.json).

### Pattern C: Missing prefers-reduced-motion at component level
globals.css has a safety net for `.animate-pulse` but individual components (`active-phase-cards.tsx`, `heartbeat-dot.tsx`) rely on this implicitly. The AmbientClock and LivenessChip (Plans 13-06/07) already have proper component-level guards. Remaining surfaces should add explicit guards to express intent.

---

## Strengths (do NOT change)

1. **Color palette discipline:** --bg, --surface, --border-subtle, --text, --accent are applied correctly and consistently across all surfaces via CSS custom properties.
2. **Tailwind spacing discipline:** No arbitrary `p-[Xpx]` values found in shell or build-home components — 8pt grid is well-maintained.
3. **font-mono + tabular-nums on numbers:** All numeric values in cost-ticker, rollup-strip, active-phase-cards, recent-ledger use `font-mono tabular-nums`. Prevents layout shift on number updates.
4. **AmbientClock reduced-motion:** Plan 13-07 correctly implemented 60s cadence under prefers-reduced-motion.
5. **LivenessChip design:** The pill shape with colored dot + status word + RTT is clean and information-dense without being cluttered. The tooltip detail (state-poll freshness + SSE freshness) is the right approach for power users.
6. **AlertBanner fingerprint dismissal:** The fingerprint-based re-show logic correctly handles "worse state = banner re-appears" without a trivial dismiss loop.
7. **labels.ts centralization:** Founder/dev copy separation is clean; every user-visible string routes through labelFor(dev). No hardcoded user strings outside labels.ts (except TOOLTIP in cost-ticker.tsx — acceptable as internal non-translated string).
8. **WCAG-compliant CTAs:** AlertBanner dismiss button uses `aria-label="Dismiss alert"` and min sizing matches WCAG 2.5.8.
9. **Consistent card/CardContent pattern:** shadcn Card + CardContent used uniformly across rollup-strip, active-phase-cards, needs-you-list, recent-ledger. Elevates all data surfaces consistently.

---

## Plan Assignment Summary

### Plan 13-09 fixes (this plan — top nav + build home + alert banner)

- P0-01 fixes: top-nav, liveness-chip, live-ops-line, rollup-strip, needs-you-list, task-detail-sheet
- P0-02: rollup-strip → card grid
- P1-01: active-phase-cards pulse guard (confirm globals.css covers it)
- P1-02: needs-you-list emoji → Lucide
- P1-03: rollup warnings slot emoji cleanup (handled by card redesign)
- P1-04: needs-you empty state with CheckCircle icon
- P1-05: liveness-chip RTT label text-dim → text-muted
- P1-07: heartbeat-dot explicit motion guard
- P1-08: alert-banner ⚠ emoji → Lucide AlertTriangle
- P1-11: task-detail-sheet italic note text-dim → text-muted
- P2-01: top-nav separator dot add aria-hidden

### Plan 13-10 fixes (agents/queue/changes/workflows)

- P0-01 scan: grep agents/, queue/, changes/, workflows/ for text-dim on user-visible text
- Any emoji icons in those surfaces
- Verify Lucide consistency on action buttons

### Plan 13-11 fixes (memory/metrics/chat/plan)

- P0-01 fixes: incident-stream, debug-breadcrumb-panel, metrics/golden-signals-subtitles, halt-events-log, memory why-drawer, node-drawer
- P1-09: incident-stream body copy text-dim → text-muted
- P1-10: memory why-drawer timestamps text-dim → text-muted
- P2-06: golden-signals subtitles 11px font-size upgrade to 12px + text-muted
- P2-07: debug-breadcrumb-panel empty text upgrade

---

## Pillar Score Summary (all surfaces, pre-fix)

| Pillar | Surfaces failing (score <3) | Count |
|--------|----------------------------|-------|
| 1 Hierarchy | rollup-strip, build-home, live-ops-line | 3 |
| 2 Density | (none — 8pt grid maintained) | 0 |
| 3 Consistency | needs-you-list (emoji icons) | 1 |
| 4 Motion | active-phase-cards (pulse implicit) | 1 |
| 5 Typography | signin, task-detail-sheet, memory-why-drawer, incident-stream | 4 |
| 6 Color | top-nav, liveness-chip, rollup-strip, needs-you, task-detail-sheet, incident-stream, metrics, memory | 8 |

**Phase-gate status:** Multiple P0 findings. D-08 gate requires ≥95% P0 resolved before close.

**No surface scores 1 on any pillar** — no phase-gate blocker at the 1-score threshold per V2 §6.

---

*Document version: 13-09-v1. Plans 13-10 and 13-11 should not modify this document — they should append a `## Post-fix Update (13-10)` or `## Post-fix Update (13-11)` section with their score deltas.*
