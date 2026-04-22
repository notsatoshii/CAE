---
phase: 13-ui-ux-review-polish-loop
plan: "07"
subsystem: mc-ia-adoptions
tags: [mc-ia, ambient-clock, alert-banner, golden-signals, agent-verbs, labels, top-nav, metrics, agents]

dependency_graph:
  requires:
    - phase: 13-06
      provides: LivenessChip (adjacent to AmbientClock in top-nav), useStatePoll (AlertBanner data source)
  provides:
    - components/shell/ambient-clock.tsx: HH:mm:ss local clock, 1s tick, isolated from nav re-renders
    - components/shell/alert-banner.tsx: Persistent amber banner gated on breaker state, fingerprint dismiss
    - components/metrics/golden-signals-subtitles.tsx: SRE Golden Signals subtitle on all 3 metrics panels
    - lib/copy/labels.ts agentVerbs: A/B verb sets (Start/Stop/Archive vs Wake/Spawn/Hide)
    - audit/UI-AUDIT-ia.md: Route-by-route MC delta with adopt/partial/defer verdicts + evidence
  affects: [13-08, 13-09, 13-12]

tech_stack:
  added: []
  patterns:
    - Isolated clock component: setInterval in local state only, no context writes (avoids nav re-renders)
    - Fingerprint-based dismissal: localStorage JSON with per-trigger fingerprint string
    - Golden Signals additive layer: secondary subtitle below founder-speak heading, same data source
    - A/B verb factory: agentVerbs(set) returns verb map; getAgentVerbSet() reads localStorage

key_files:
  created:
    - components/shell/ambient-clock.tsx
    - components/shell/ambient-clock.test.tsx
    - components/shell/alert-banner.tsx
    - components/shell/alert-banner.test.tsx
    - components/metrics/golden-signals-subtitles.tsx
    - lib/copy/labels.test.ts
    - .planning/phases/13-ui-ux-review-polish-loop/audit/UI-AUDIT-ia.md
  modified:
    - components/shell/top-nav.tsx (AmbientClock mount)
    - components/shell/top-nav.test.tsx (AmbientClock mock)
    - app/layout.tsx (AlertBanner mount)
    - components/metrics/spending-panel.tsx (GoldenSignalsSubtitle mount)
    - components/metrics/reliability-panel.tsx (GoldenSignalsSubtitle mount)
    - components/metrics/speed-panel.tsx (GoldenSignalsSubtitle mount)
    - lib/copy/labels.ts (agentVerbs + getAgentVerbSet appended)
    - components/agents/agent-card.tsx (verb state + quick-action buttons)

key_decisions:
  - "13-07: AmbientClock shows HH:mm:ss (more granular than MC's HH:mm); seconds suppressed under prefers-reduced-motion for a11y"
  - "13-07: AlertBanner fingerprint format is `{halted?'h':''}|{retryCount}|{phantomEscalations}` — encodes severity change, not just on/off"
  - "13-07: Golden Signals as subtitle (additive) not replacement — founder-speak primary headings retained per D-06"
  - "13-07: agentVerbs default is start_stop_archive; Eric decides wake_spawn_hide promotion before plan 13-09"
  - "13-07: Agent card verb buttons are copy-only stubs; action handlers deferred to plan 13-09 (Wave 6)"

metrics:
  duration: "~60 minutes"
  completed: "2026-04-23T06:10:00Z"
  tasks_completed: 3
  files_created: 7
  files_modified: 8
  commits: 3
  tests_added: 16
  tests_before: 628
  tests_after: 644
---

# Phase 13 Plan 07: Mission Control IA Adoptions — Summary

**One-liner:** Shipped ambient HH:mm:ss clock + fingerprint-dismissable breaker alert banner + Golden Signals SRE subtitles on 3 metrics panels + agent verb A/B (Wake/Spawn/Hide vs Start/Stop/Archive) via localStorage, all zero new data endpoints, with a 330-line MC IA audit documenting every adopt/partial/defer verdict.

## What Was Built

### Task 1: AmbientClock component + top-nav mount

**Component:** `components/shell/ambient-clock.tsx`
- HH:mm:ss local time display, updates every 1 second via isolated `setInterval`
- Reduced-motion branch: HH:mm only at 60s cadence when `prefers-reduced-motion: reduce`
- `aria-label="Local time HH:mm"` for screen reader accessibility
- `tabular-nums` class prevents layout shift as digits change
- Mounted in top-nav between HeartbeatDot and LivenessChip

**Why isolated:** setInterval lives entirely in AmbientClock's local state. The
parent TopNav never re-renders on the 1s tick, preserving all other nav-bar
memoization.

**4 tests:** format (HH:mm:ss), tick (advances after 1s), reduced-motion (HH:mm),
aria-label prefix.

---

### Task 2: AlertBanner — persistent breaker-halt/retry/escalation banner

**Component:** `components/shell/alert-banner.tsx`
- Reads from `useStatePoll().data.breakers` — zero new endpoints
- Trigger conditions: `halted === true` OR `retryCount > 0` OR `recentPhantomEscalations > 0`
- Fingerprint = `"${halted?'h':''}|${retryCount}|${phantomEscalations}"`
- localStorage key `p13-alert-dismissed` stores `{ fingerprint }` on dismiss
- Banner reappears when trigger fingerprint differs from dismissed fingerprint
- "Show Details" → /build (existing surface, per D-06)
- "Dismiss" → writes fingerprint; removes banner from DOM instantly
- Mounted in `app/layout.tsx` between TopNav and children (session-gated)
- Amber styling via CSS variables (`var(--warning)`) — no hardcoded color values

**6 tests:** quiet state (no render), halted=true, retryCount>0, fingerprint match
(hidden), fingerprint mismatch (shown), dismiss (writes localStorage + removes banner).

---

### Task 3: Golden Signals subtitles + agent verb A/B + IA audit

**Golden Signals subtitles** (`components/metrics/golden-signals-subtitles.tsx`):

| Panel | Subtitle line |
|-------|--------------|
| Spending | Traffic · {tok today} | Saturation · {%} budget MTD |
| How well it's going | Errors · {n} halts | Success rate · {%} |
| How fast | Latency p50 · {ms} | p95 · {ms} |

- Reads from existing `useMetricsPoll()` (same 30s poll used by each panel above)
- Falls back to "—" when data is null
- `<p>` element with `data-testid="golden-signals-subtitle-{panel}"` and `aria-label`
- Mounted after `<h2>` in all three panel's loaded state

**Agent verb A/B** (`lib/copy/labels.ts` additions):
- `agentVerbs(set)` → `{ primary, stop, archive }` verb map
- `getAgentVerbSet()` → reads localStorage `p13-agent-verbs`; defaults to `"start_stop_archive"`
- `agent-card.tsx` calls `getAgentVerbSet()` on mount via `useState + useEffect`
- Quick-action verb buttons rendered below stats block with `data-testid` attributes
- Action handlers are `TODO 13-09` stubs — plan 13-09 (Wave 6) wires them

**A/B toggle instructions:**
```js
// Activate MC-inspired verbs
localStorage.setItem("p13-agent-verbs", "wake_spawn_hide")

// Revert to default
localStorage.removeItem("p13-agent-verbs")
```

**6 label tests:** both verb sets, default (no arg), localStorage empty/set/invalid.

**IA audit report** (`.planning/phases/13-ui-ux-review-polish-loop/audit/UI-AUDIT-ia.md`):
- 330 lines
- All 12 MC patterns from 13-MISSION-CONTROL-NOTES.md assessed
- Per-row verdict: ADOPTED / DEFERRED / SKIP with file+line evidence
- Summary table + "what we already do better" section
- Open questions for Eric (verb A/B decision, KPI card visual, Incident Stream)

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `5ec52c9` | feat | ambient clock in top-nav (MC IA adoption §5 row 1) |
| `04aa735` | feat | persistent breaker alert banner (MC IA §5 row 2) |
| `aa47d77` | feat | Golden Signals subtitles + agent verb A/B + IA audit (MC §5 rows 4/5) |

## Test Delta

| Phase | Tests |
|-------|-------|
| Before (13-06 baseline) | 628 |
| After Task 1 (AmbientClock) | 632 (+4) |
| After Task 2 (AlertBanner) | 638 (+6) |
| After Task 3 (labels + agent-card) | 644 (+6) |
| **Total added** | **+16** |

## Agent Verb A/B Toggle Instructions

Eric can evaluate the MC-inspired verb set in the live dashboard:

1. Open browser DevTools console on the dashboard
2. Run: `localStorage.setItem("p13-agent-verbs", "wake_spawn_hide")`
3. Reload the page
4. Navigate to /build/agents — cards now show Wake / Hide / Hide buttons
5. To revert: `localStorage.removeItem("p13-agent-verbs")` + reload

Decision needed before plan 13-09 ships (Wave 6 visual polish will wire actual
action handlers and may hard-code the winning verb set).

## Deferred Items (documented in UI-AUDIT-ia.md)

| Pattern | Target | Reason deferred |
|---------|--------|----------------|
| KPI card strip (always-on) | plan 13-09 | Visual treatment, not copy-only |
| Session Router (per-session latency) | plan 13-08 | Requires /api/sessions extension |
| Tabbed agent surface | Phase 14 | IA refactor, not copy-only |
| Incident Stream panel | plan 13-08 | Logging plan scope |
| Task Flow rename | TBD | Naming decision, pending Eric confirmation |
| SOUL rebrand | SKIP | We have stronger persona system |
| Fleet/Pipelines | SKIP | Not applicable (single-user, single-project) |

## Known Stubs

- `agent-card.tsx` verb buttons have `onClick` stubs with `// TODO 13-09` comments
- Handlers will be wired in plan 13-09 (Wave 6) when visual polish lands
- Stub does not prevent plan 13-07's goal (copy A/B is functional; buttons render)

## Threat Flags

None. Per plan threat model, all changes are client-side:
- T-13-07-01: localStorage `p13-alert-dismissed` + `p13-agent-verbs` — user-controlled, cosmetic, no privilege implications
- T-13-07-02: Ambient clock reveals local TZ — single-user dashboard, same info visible in browser

## Self-Check

- [x] `components/shell/ambient-clock.tsx` exists, ≥20 lines (60 lines)
- [x] `components/shell/alert-banner.tsx` exists, ≥60 lines (130 lines)
- [x] `components/metrics/golden-signals-subtitles.tsx` exists, ≥40 lines (137 lines)
- [x] `grep -q "agentVerbs" lib/copy/labels.ts` → true
- [x] `grep -q "AmbientClock" components/shell/top-nav.tsx` → true
- [x] `grep -q "AlertBanner" app/layout.tsx` → true
- [x] `grep -q "GoldenSignalsSubtitle" components/metrics/spending-panel.tsx` → true
- [x] `grep -q "GoldenSignalsSubtitle" components/metrics/reliability-panel.tsx` → true
- [x] `grep -q "GoldenSignalsSubtitle" components/metrics/speed-panel.tsx` → true
- [x] `grep -q "getAgentVerbSet\|agentVerbs" components/agents/agent-card.tsx` → true
- [x] `wc -l audit/UI-AUDIT-ia.md` → 330 (≥80 required)
- [x] `npx vitest run` → 644 passed (5 pre-existing empty stubs)
- [x] `npx tsc --noEmit` → 0 new errors from our files
- [x] Commits: `5ec52c9`, `04aa735`, `aa47d77`

## Self-Check: PASSED
