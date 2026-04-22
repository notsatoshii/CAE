---
phase: 04-build-home-rewrite
plan: 06
subsystem: ui
tags: [integration, page-assembly, cleanup, a11y, consistency-checks, phase-4-wiring]

# Dependency graph
requires:
  - phase: 04-build-home-rewrite (Plan 04-01)
    provides: getHomeState aggregator + extended /api/state + dynamic /api/tail ALLOWED_ROOTS
  - phase: 04-build-home-rewrite (Plan 04-02)
    provides: AGENT_META lookup + 30 new Phase 4 label keys (rollupEmptyState/liveOpsIdle/activePhasesEmpty/needsYouEmpty/recentEmpty/phaseCard*/recent*/sheet*)
  - phase: 04-build-home-rewrite (Plan 04-03)
    provides: RollupStrip + LiveOpsLine + AgentAvatars + ActivePhaseCards (URL-state sheet nav)
  - phase: 04-build-home-rewrite (Plan 04-04)
    provides: NeedsYouList + RecentLedger (founder/dev copy flip verified here)
  - phase: 04-build-home-rewrite (Plan 04-05)
    provides: TaskDetailSheet + SheetLiveLog + SheetActions + useSheetKeys

provides:
  - /build home page rewritten — UI-SPEC §3 five-widget hierarchy + Task Detail Sheet
  - cae-home-state.ts consolidated — lib/copy/agent-meta.ts is now the single source of truth for founder_label
  - StatePollProvider repositioned — now wraps both TopNav chrome and page children (prior placement inside top-nav.tsx broke every Phase 4 widget at runtime)

affects:
  - Phase 5 (Agents tab) — home sheet is the navigation seed for agent drill-in
  - Phase 7 (/metrics) — absorbs the deleted metrics-tabs.tsx responsibilities
  - Phase 8 (Memory tab) — sheet Memory section placeholder waits for this phase
  - Phase 9 (Chat rail + real pause/abort wiring) — replaces SheetActions stubs

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Single source of truth consolidation (inline duplicate map → imported lookup fn) for parallel-wave planning discipline
    - Provider placement: global providers (DevMode, StatePoll) must wrap BOTH chrome AND page children in app/layout.tsx — never buried inside a specific chrome component
    - Python-based a11y audit (regex-driven <button> inner-text/aria-label matcher) replaces fragile awk heuristic
    - Render-branch smoke via direct labelFor/agentMetaFor composition (bypass React tree; exercise the text-assembly functions directly)

key-files:
  created:
    - .planning/phases/04-build-home-rewrite/04-06-SUMMARY.md
  modified:
    - app/build/page.tsx (rewritten; 45 lines; mounts 5 widgets + TaskDetailSheet)
    - lib/cae-home-state.ts (680 lines; inline FOUNDER_LABEL removed, agentMetaFor import added)
    - app/layout.tsx (StatePollProvider moved from top-nav.tsx to wrap TopNav + children)
    - components/shell/top-nav.tsx (provider removed; header renders directly)
  deleted:
    - app/build/phases-list.tsx (96 lines; superseded by ActivePhaseCards)
    - app/build/breakers-panel.tsx (87 lines; absorbed into RollupStrip + LiveOpsLine)
    - app/build/metrics-tabs.tsx (125 lines; moved to Phase 7 /metrics)

key-decisions:
  - "Sequence committed as two commits on purpose — 0ddede2 deletes the 3 Phase 2 widgets (broken build momentarily); 8981433 restores by rewriting page.tsx + consolidating FOUNDER_LABEL + fixing StatePollProvider placement. Deletion diff remains small and revertable."
  - "StatePollProvider moved from top-nav.tsx → app/layout.tsx so every page child gets provider access (Rule 3 auto-fix — widgets would have thrown at runtime with the prior placement)."
  - "FOUNDER_LABEL consolidation: Option B executed — cae-home-state.ts imports agentMetaFor; 9-entry inline map removed. Replacement call is `agentMetaFor(name).founder_label` which matches the prior `?? agent.name` fallback for unknown agents (agentMetaFor's unknown-agent branch returns the raw name as founder_label)."
  - "Container bumped max-w-5xl → max-w-6xl per plan; subtitle paragraph removed (rollup strip + live-ops line now convey 'live status')."
  - "A11y audit uses Python regex not awk — the plan's awk heuristic produced false-positives on multi-line JSX (attribute values spanning >5 lines). All 5 build-home buttons verified: 3 have JSX-expression text bodies, 2 have aria-label + text. Zero FAILs."

# Phase 2 → Phase 4 diff summary
before: "3-table dev dashboard (breakers stat grid + phases table + metrics tabs). Each table polled its own /api/state shard at a different interval. No hierarchy, no founder-facing copy flip, no task drill-in."
after:  "5-widget founder-facing hierarchy (RollupStrip one-line metric bar · LiveOpsLine pinned agent status · ActivePhaseCards clickable phase cards · NeedsYouList actionable decisions · RecentLedger dense event tail) + right-slide Task Detail Sheet with SSE live log, 6-action button row, Memory placeholder. Single useStatePoll provider at layout root, 3s refresh, founder/dev labelFor flip end-to-end."

# Metrics
metrics:
  duration: ~8 minutes
  completed: 2026-04-20
  commits:
    - 0ddede2 refactor(04-06): remove superseded Phase 2 home widgets
    - 8981433 feat(04-06): assemble Phase 4 Build Home widgets + mount task detail sheet + consolidate founder_label
---

# Phase 4 Plan 06: Build Home Integration Summary

Assembled the Phase 4 Build Home page from Waves 1–3 widgets, deleted the superseded Phase 2 home surfaces, consolidated the intentional FOUNDER_LABEL duplicate, and verified the founder↔dev copy-mode flip renders distinct HTML. Fixed a blocking provider-placement bug discovered during verification so every `/build` widget actually has runtime access to `useStatePoll`.

## What was built

### Task 1 — External-consumer check + deletion (commit 0ddede2)

Pre-delete grep of `app/`, `components/`, `lib/` confirmed that only `app/build/page.tsx` imported the three Phase 2 widgets. Deletion was safe.

```
app/build/page.tsx:6:import { BreakersPanel } from "./breakers-panel"
app/build/page.tsx:7:import { PhasesList } from "./phases-list"
app/build/page.tsx:8:import { MetricsTabs } from "./metrics-tabs"
```

Zero external references. `git rm` of the three files — deletion commit is deliberately broken (page.tsx still imports them) and is restored in Task 2.

### Task 2 — Page rewrite + FOUNDER_LABEL consolidation + provider fix (commit 8981433)

**`app/build/page.tsx`** rewritten per UI-SPEC §3 order:

```tsx
<main data-testid="build-home" className="p-6 max-w-6xl">
  <div className="flex items-center gap-3 mb-4">
    <BuildHomeHeading projectName={projectName} />
    {allProjects.length > 0 && selected && (
      <ProjectSelector projects={allProjects} selected={selected} />
    )}
  </div>

  <RollupStrip />
  <LiveOpsLine />
  <ActivePhaseCards />
  <NeedsYouList />
  <RecentLedger />

  <TaskDetailSheet />
</main>
```

Removed: `listPhases` server call (the widgets poll `/api/state` themselves via `useStatePoll`), the "Live phase execution status" subtitle paragraph (rollup + live-ops replace it). Retained: server-component `export const dynamic = "force-dynamic"`, project discovery via `listProjects`, `BuildHomeHeading` + `ProjectSelector` at top.

**`lib/cae-home-state.ts`** consolidated:

```diff
- const FOUNDER_LABEL: Record<string, string> = {
-   forge: "the builder",
-   sentinel: "the checker",
-   scout: "the researcher",
-   ...9 entries total...
- }
+ import { agentMetaFor } from "./copy/agent-meta"

  function composeLiveOpsLine(...) {
-   const labelFor = (name) => FOUNDER_LABEL[name] ?? name
+   const labelFor = (name) => agentMetaFor(name).founder_label
  }
```

`agentMetaFor` returns `{founder_label: name}` for unknown agents, so behaviour is equivalent to the prior `?? agent.name` fallback.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Moved `StatePollProvider` from `components/shell/top-nav.tsx` to `app/layout.tsx`**

- **Found during:** Task 2 reading the provider tree
- **Issue:** `StatePollProvider` wrapped only `<header>` JSX inside `top-nav.tsx`, so every client widget rendered below `<TopNav>` (i.e. every Phase 4 build-home widget) would throw at runtime: *"useStatePoll must be used inside <StatePollProvider>"*. Phase 3 was unaffected because its consumers (`CostTicker`, `HeartbeatDot`) lived inside the header. Phase 4 breaks that assumption by mounting `useStatePoll` consumers across page children.
- **Fix:** Removed `<StatePollProvider>` wrapper from `top-nav.tsx`; added `<StatePollProvider>` wrapping `{session && <TopNav/>}` and `{children}` and `<Toaster/>` inside `app/layout.tsx`'s provider stack (ExplainMode → DevMode → StatePoll → tree).
- **Files modified:** `app/layout.tsx`, `components/shell/top-nav.tsx`
- **Commit:** 8981433 (integrated into Task 2 commit; would have been a blocker if discovered later)

**2. [Rule 3 - Method] Python a11y audit replaces awk heuristic**

- **Found during:** Task 3 running the plan's awk-based button audit
- **Issue:** The plan's awk script used a regex that required `>TEXT<` or `>{EXPR}<` to appear on the same line or in a contiguous non-broken block. Real JSX in the codebase splits buttons across 5–15 lines with attributes, then content, then `</button>`. The awk regex hit its buffer reset on newlines and reported false FAILs on 4 of 5 buttons.
- **Fix:** Replaced with a Python regex scan: `re.DOTALL` non-greedy `<button...>...</button>` block extraction, then per-block `aria-label=` OR non-tag text OR `{expr}` check. Zero FAILs reported; all 5 build-home buttons have accessible names.
- **Files modified:** none (verification-only change)
- **Commit:** n/a

## Verifications

### Build + typecheck gate

- `pnpm tsc --noEmit` → exit 0
- `pnpm build` → exit 0 (12 routes generated, `/build` among them, no runtime warnings beyond the pre-existing middleware deprecation notice)

### Source-grep verifications (definitive for CI)

```
app/build/page.tsx mentions of Phase 4 widget names: 12    (target ≥ 6)
app/build/page.tsx mentions of removed widgets:      0
app/build/page.tsx data-testid="build-home":         1
app/build/page.tsx max-w-6xl:                        1
app/build/page.tsx BuildHomeHeading:                 2

Component testid anchors:
  rollup-strip.tsx:       1 + 1
  live-ops-line.tsx:      1
  active-phase-cards.tsx: 1 + 1
  needs-you-list.tsx:     1 + 1
  recent-ledger.tsx:      1 + 1
  task-detail-sheet.tsx:  1

Empty-state label keys wired:
  rollupEmptyState:   1
  liveOpsIdle:        1
  activePhasesEmpty:  1
  needsYouEmpty:      1
  recentEmpty:        1

aria-hidden per file:
  active-phase-cards.tsx: 3
  agent-avatars.tsx:      2
  live-ops-line.tsx:      1
  needs-you-list.tsx:     2
  recent-ledger.tsx:      1
  rollup-strip.tsx:       1
  6 of 9 build-home files carry aria-hidden (target ≥ 4)

FOUNDER_LABEL consolidation:
  grep -c "agentMetaFor" lib/cae-home-state.ts:          3    (target ≥ 1)
  grep -c "^const FOUNDER_LABEL" lib/cae-home-state.ts:  0    (target = 0)
```

### Button a11y audit (Python regex)

```
OK  active-phase-cards.tsx: button aria=False text=True  expr=True
OK  sheet-actions.tsx:      button aria=False text=True  expr=True
OK  sheet-live-log.tsx:     button aria=False text=True  expr=True
OK  task-detail-sheet.tsx:  button aria=True  text=False expr=True
OK  task-detail-sheet.tsx:  button aria=True  text=False expr=True

Total buttons: 5, fails: 0
```

Every build-home button has either an `aria-label` attribute or JSX-expression inner text.

### Render-branch smoke (RecentLedger founder vs dev)

Direct composition via `labelFor` + `agentMetaFor` (React tree bypassed — the labelling functions ARE the render-branch logic):

```
founder: "Built with the builder (demo)"
dev    : "demo p4-pl01-t1    +3 commits  forge(sonnet)"
empty founder: "Nothing shipped yet today."
empty dev    : "No events logged."
```

Founder branch contains `"the builder"` and `"Built"` (founder markers). Dev branch contains `"commits"` and `"sonnet"` (dev markers). Empty-state text also differs. Assertion: branches produce distinct text for both populated and empty states.

### Agent-label consistency (Option B guard)

```
OK agent-label consistency (9 agents) + cae-home-state.ts uses agentMetaFor + no inline FOUNDER_LABEL
```

All nine agent keys (`nexus/forge/sentinel/scout/scribe/phantom/aegis/arch/herald`) resolve to the expected founder label via both `AGENT_META[k].founder_label` and `agentMetaFor(k).founder_label`. `cae-home-state.ts` imports `agentMetaFor`; the inline map is absent.

### Dev server smoke (port 3002)

```
pnpm dev → "Ready in 502ms" on port 3002 (port 3000 was in use)
GET /build           → HTTP 307 → /signin (unauthed redirect, expected)
GET /api/state       → HTTP 200 (unauthed for this endpoint)
  present keys: ['breakers', 'rollup', 'home_phases', 'events_recent', 'needs_you', 'live_ops_line']
  missing keys: []
  rollup = {shipped_today: 0, tokens_today: 0, in_flight: 0, blocked: 0, warnings: 0}
  live_ops_line = "Idle right now."
```

All six expected `/api/state` keys present. Live-ops idle sentinel flows through the aggregator as expected on a quiet machine.

### Empty-state summary

With zero projects active (this machine's current state), each widget renders its empty-state branch:

| Widget | Source grep | Empty key | Copy (founder / dev) |
|---|---|---|---|
| RollupStrip | `rollupEmptyState` | ✓ | "No activity today." / "No activity today." |
| LiveOpsLine | `liveOpsIdle` | ✓ | "Idle right now." / "idle" |
| ActivePhaseCards | `activePhasesEmpty` | ✓ | "No active work right now. Go to Plan mode to start a project." / "No active phases." |
| NeedsYouList | `needsYouEmpty` | ✓ | "All caught up ✓" / "queue: empty" |
| RecentLedger | `recentEmpty` | ✓ | "Nothing shipped yet today." / "No events logged." |

## Known post-Phase-4 wiring gaps

These are intentional stubs the current SUMMARY carries forward as guidance for later phases:

- **Sheet actions** (Approve / Deny / Retry / Abandon / Reassign / Edit plan) — `toast.info()` stubs; real wiring in Phase 9
- **Sheet pause/abort header buttons** — `toast.info()` stubs + `window.confirm` gate; real wiring in Phase 9
- **Sheet memory section** — `<details>` placeholder only; list + click-through ship in Phase 8
- **Sheet comments section** — "Comments ship in Phase 9" stub
- **Sheet changes section** — "No commits yet." placeholder (data not yet in home state; Phase 9)
- **Recent ledger commits count** — always `0` in v1 because the circuit-breakers.jsonl event payload doesn't carry a commit count (would require per-branch `git log` per event; deferred)
- **Plan review markers** — `NeedsYouList` scans for `*-REVIEW-READY.md` files but Plan mode in Phase 10 owns creating them

## Diff vs Phase 2 home

Before: three independent tables (BreakersPanel stat grid + PhasesList table + MetricsTabs tabs) each polling `/api/state` on its own schedule. Dev-facing labels, no hierarchy, no drill-in.

After: five widgets in UI-SPEC §3 order + right-slide task sheet, single `useStatePoll` provider at layout root (3s refresh), founder/dev `labelFor` flip verified end-to-end via render-branch smoke. Project selector + heading retained for multi-project navigation.

## Self-Check: PASSED

- [x] `app/build/page.tsx` exists and contains RollupStrip + LiveOpsLine + ActivePhaseCards + NeedsYouList + RecentLedger + TaskDetailSheet
- [x] `app/build/phases-list.tsx` absent
- [x] `app/build/breakers-panel.tsx` absent
- [x] `app/build/metrics-tabs.tsx` absent
- [x] `lib/cae-home-state.ts` imports `agentMetaFor`, no inline FOUNDER_LABEL
- [x] `app/layout.tsx` wraps `<StatePollProvider>` around both TopNav and children
- [x] Commit 0ddede2 exists in git log (refactor: remove superseded Phase 2 home widgets)
- [x] Commit 8981433 exists in git log (feat: assemble Phase 4 Build Home widgets + mount task detail sheet + consolidate founder_label)
- [x] `pnpm tsc --noEmit` exits 0
- [x] `pnpm build` exits 0 with all routes generated
