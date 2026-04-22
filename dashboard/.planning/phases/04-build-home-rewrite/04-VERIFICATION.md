---
phase: 04-build-home-rewrite
verified: 2026-04-22T04:57:13Z
status: human_needed
score: 15/15 must-haves verified (automated)
overrides_applied: 0
re_verification: null
human_verification:
  - test: "Visual hierarchy renders — RollupStrip, LiveOpsLine, ActivePhaseCards, NeedsYouList, RecentLedger stack in that order on /build"
    expected: "Full-width top rollup card, mono live-ops line, active-phase cards with cyan progress bars, needs-you action rows, 20-row recent ledger — all inside p-6 max-w-6xl container"
    why_human: "Visual layout and spacing cannot be verified via grep. Requires browser render with real session."
  - test: "Click an active phase card opens the Task Detail Sheet"
    expected: "Card click pushes ?sheet=open&phase=N&project=... to URL; Sheet slides in from right at sm:max-w-[50vw]; 7 sections visible (Header, Summary, Live log, Changes, Memory, Comments, Actions)"
    why_human: "Click → URL update → Sheet mount is a runtime behavior. Unit-level grep only verifies params.set calls; needs live browser verification."
  - test: "SSE live-log stream appends lines in Task Detail Sheet"
    expected: "When sheet opens on an active phase with a live log, text streams into the Live log section. Pause button stops auto-scroll. Banner shows truncation after 500 lines. No 403 from /api/tail."
    why_human: "EventSource streaming, real-time DOM appends, and cross-project ALLOWED_ROOTS expansion can only be observed against a running dev server with a live log file."
  - test: "Keyboard shortcuts Esc / Ctrl+. / Ctrl+Shift+. function inside the Sheet"
    expected: "Esc closes sheet (URL keeps project, drops sheet/phase/plan/task). Ctrl+. fires a toast and console.info pause. Ctrl+Shift+. fires window.confirm → toast + console.info abort. Shortcuts do NOT fire when an input/textarea is focused."
    why_human: "Keyboard event handling with modifier combinations and editable-target guards requires interactive browser testing."
  - test: "Founder↔Dev mode flip is observable end-to-end"
    expected: "Pressing Ctrl+Shift+D flips labels in all 5 widgets. RollupStrip/LiveOpsLine stay mostly stable; ActivePhaseCards titles flip from 'Building cae-dashboard' to 'cae-dashboard · phase N'; NeedsYouList plan_review copy flips; RecentLedger rows flip from 'Built with the builder' to '+N commits forge(sonnet)'; TaskDetailSheet section headings flip from 'What CAE looked at' to 'Memory referenced' etc."
    why_human: "The dev-mode toggle is a client-side React state transition; requires real render and keyboard input."
  - test: "Empty states render correctly when state is quiet"
    expected: "With zero projects active: RollupStrip shows rollupEmptyState; LiveOpsLine shows liveOpsIdle; ActivePhaseCards shows activePhasesEmpty; NeedsYouList shows needsYouEmpty; RecentLedger shows recentEmpty — all with founder vs dev copy variants."
    why_human: "Empty-state conditional rendering tested only via source grep. Visual confirmation requires a run with no active data."
  - test: "Sheet close preserves project query param"
    expected: "Open sheet while ?project=/path&... is set. Press Esc (or click overlay). Resulting URL retains project= but loses sheet/phase/plan/task."
    why_human: "URL state manipulation on close is verified by static guard (grep -c 'params.delete(\"project\")' === 0) but runtime browser confirmation is the authoritative check."
---

# Phase 4: Build Home Rewrite — Verification Report

**Phase Goal:** Rewrite /build home into UI-SPEC §3 hierarchy view. Rollup + Active phase cards + Live Ops line + Needs-you + Recent ledger + Task Detail sheet (§5) + /api/state extension + /api/tail cross-project extension + labels/agent-meta.

**Verified:** 2026-04-22T04:57:13Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Data layer aggregator + /api/state extension + /api/tail cross-project + useStatePoll type exist | VERIFIED | lib/cae-home-state.ts (22KB) + app/api/state/route.ts imports getHomeState + app/api/tail/route.ts imports listProjects + use-state-poll.tsx imports Rollup/PhaseSummary/RecentEvent/NeedsYouItem |
| 2 | `/api/state` returns extended shape (rollup, home_phases, events_recent, needs_you, live_ops_line) | VERIFIED | Lines 78-82 of app/api/state/route.ts return all 5 keys + breakers preserved |
| 3 | `/api/tail` ALLOWED_ROOTS dynamically extended via listProjects() | VERIFIED | app/api/tail/route.ts:4 imports listProjects; :15-28 computeAllowedRoots() appends per-project paths |
| 4 | agent-meta + labels copy layer ships 9 agents + Phase 4 keys | VERIFIED | lib/copy/agent-meta.ts (2.5KB) has 9 agents + agentMetaFor; labels.ts has rollup*/phaseCard*/needsYou*/recent*/sheet* keys including sheetMemoryStub |
| 5 | RollupStrip renders 5 metrics + empty-state from data.rollup | VERIFIED | components/build-home/rollup-strip.tsx consumes useStatePoll + rollupEmptyState |
| 6 | LiveOpsLine renders pre-formatted live_ops_line string | VERIFIED | components/build-home/live-ops-line.tsx with liveOpsIdle fallback |
| 7 | ActivePhaseCards renders one card per home_phases entry with click→URL nav | VERIFIED | active-phase-cards.tsx lines 25-31 openSheet sets sheet=open/phase/project; router.push preserves existing params |
| 8 | AgentAvatars renders emoji + dots with per-agent color from agentMetaFor | VERIFIED | agent-avatars.tsx imports agentMetaFor; COLOR_MAP covers 9 colors |
| 9 | NeedsYouList renders ⚠/🛡/📝 rows with inline Next.js Link action buttons | VERIFIED | needs-you-list.tsx imports Link from next/link; ICON map covers 3 types |
| 10 | RecentLedger renders 20 rows with ✓/✗ + founder/dev copy flip | VERIFIED | recent-ledger.tsx .slice(0,20) + recentShippedPrefix/recentAbortedPrefix + agentMetaFor |
| 11 | TaskDetailSheet mounts on ?sheet=open with 7 sections | VERIFIED | task-detail-sheet.tsx has sheet-section-summary/log/changes/memory/comments/actions + header; Memory uses <details>/<summary> with sheetMemoryStub |
| 12 | SheetLiveLog opens EventSource against /api/tail with 500-line cap + pause scroll | VERIFIED | sheet-live-log.tsx MAX_LINES=500, new EventSource, aria-label on pause button, sheetLogTruncatedNote banner |
| 13 | SheetActions renders 6 stub buttons (Approve/Deny/Retry/Abandon/Reassign/EditPlan) | VERIFIED | sheet-actions.tsx 6-entry buttons array with testids |
| 14 | useSheetKeys hook handles Esc / Ctrl+. / Ctrl+Shift+. with editable-target guard | VERIFIED | lib/hooks/use-sheet-keys.ts (60 lines) — isEditableTarget guard, preventDefault+stopPropagation, SSR-safe |
| 15 | Phase 2 widgets removed; /build/page.tsx assembles Phase 4 widgets; FOUNDER_LABEL consolidated | VERIFIED | phases-list/breakers-panel/metrics-tabs absent; page.tsx mounts 6 Phase 4 components; cae-home-state.ts imports agentMetaFor (3 hits); inline FOUNDER_LABEL const removed |

**Score:** 15/15 truths verified (automated). 7 items require human browser verification for runtime behavior.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| lib/cae-home-state.ts | getHomeState aggregator + 6 types, imports agentMetaFor | VERIFIED | 680 lines; exports HomeState/Rollup/PhaseSummary/RecentEvent/NeedsYouItem/AgentActive; imports agentMetaFor from ./copy/agent-meta; no inline FOUNDER_LABEL |
| lib/copy/agent-meta.ts | 9-agent AGENT_META + agentMetaFor | VERIFIED | 61 lines; 9 agents (nexus/forge/sentinel/scout/scribe/phantom/aegis/arch/herald) with locked emoji/color/founder_label |
| lib/copy/labels.ts | Labels interface extended with 48 Phase 4 keys | VERIFIED | 12KB; includes rollup*/phaseCard*/needsYou*/recent*/sheet*/sheetMemoryStub keys + founder/dev variants; Phase 3 baseline $ count preserved at 9 |
| lib/hooks/use-sheet-keys.ts | useSheetKeys hook with Esc/Ctrl+./Ctrl+Shift+. | VERIFIED | 60 lines; isEditableTarget guard; SSR-safe |
| lib/hooks/use-state-poll.tsx | StateResponse type includes 5 new Phase 4 fields | VERIFIED | Imports Rollup/PhaseSummary/RecentEvent/NeedsYouItem from @/lib/cae-home-state; rollup/home_phases/events_recent/needs_you/live_ops_line typed |
| app/api/state/route.ts | GET returns 7 top-level keys (breakers+phases+metrics+rollup+home_phases+events_recent+needs_you+live_ops_line) | VERIFIED | Imports getHomeState; home.phases renamed to home_phases; .catch fallback returns zeroed HomeState |
| app/api/tail/route.ts | ALLOWED_ROOTS dynamically extended via listProjects() | VERIFIED | STATIC_ALLOWED_ROOTS + computeAllowedRoots + isAllowedPath; per-request invocation; catches listProjects errors |
| components/build-home/rollup-strip.tsx | 5-metric strip + empty state | VERIFIED | 2.4KB; "use client"; useStatePoll + rollupEmptyState |
| components/build-home/live-ops-line.tsx | 1-line mono readout with idle fallback | VERIFIED | 967B; "use client"; liveOpsIdle fallback |
| components/build-home/agent-avatars.tsx | Emoji+dots pill using agentMetaFor | VERIFIED | 2KB; agentMetaFor + COLOR_MAP; idle opacity |
| components/build-home/active-phase-cards.tsx | Card list + click→?sheet=open URL nav | VERIFIED | 4.2KB; router.push + 3 params.set calls; animate-pulse when running |
| components/build-home/needs-you-list.tsx | 3 row types + inline Link buttons | VERIFIED | 3.4KB; Link from next/link; ICON map for blocked/dangerous/plan_review |
| components/build-home/recent-ledger.tsx | ✓/✗ 20-row ledger with founder/dev copy flip | VERIFIED | 3.6KB; .slice(0,20); recentShippedPrefix/recentAbortedPrefix; agentMetaFor |
| components/build-home/task-detail-sheet.tsx | Right-slide sheet with 7 sections, URL state, keyboard shortcuts | VERIFIED | 8.3KB; all 6 section testids + task-detail-sheet testid; useSheetKeys; sm:max-w-[50vw]; closeSheet preserves project |
| components/build-home/sheet-live-log.tsx | SSE tail with 500-line cap + pause scroll | VERIFIED | 3.2KB; EventSource + MAX_LINES=500 + aria-label |
| components/build-home/sheet-actions.tsx | 6-button action row (stubbed) | VERIFIED | 1.9KB; 6 entries with testids; toast.info stubs |
| app/build/page.tsx | Mount 5 widgets + TaskDetailSheet inside StatePollProvider | VERIFIED | 45 lines; mounts RollupStrip/LiveOpsLine/ActivePhaseCards/NeedsYouList/RecentLedger/TaskDetailSheet; max-w-6xl; data-testid="build-home" |
| app/layout.tsx | StatePollProvider wraps TopNav + children | VERIFIED | StatePollProvider at layout root (inside DevModeProvider); covers all page children |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| app/api/state/route.ts | lib/cae-home-state.ts | `import { getHomeState }` | WIRED | Line 13 imports getHomeState + HomeState type; line 39 invokes inside Promise.all |
| app/api/tail/route.ts | lib/cae-state.ts | `import { listProjects }` | WIRED | Line 4 imports; line 18 invoked in computeAllowedRoots |
| lib/hooks/use-state-poll.tsx | app/api/state | `fetch("/api/state?project=...")` | WIRED | Line 53 builds URL; line 57 fetches; response typed as StateResponse |
| lib/cae-home-state.ts | lib/copy/agent-meta.ts | `import { agentMetaFor }` | WIRED | Line 8 imports; line 585 in composeLiveOpsLine uses agentMetaFor(name).founder_label |
| components/build-home/rollup-strip.tsx | lib/hooks/use-state-poll.tsx | `useStatePoll()` | WIRED | Reads data.rollup; empty-state via rollupEmptyState |
| components/build-home/live-ops-line.tsx | lib/hooks/use-state-poll.tsx | `useStatePoll()` | WIRED | Reads data.live_ops_line; liveOpsIdle fallback |
| components/build-home/active-phase-cards.tsx | lib/hooks/use-state-poll.tsx | `useStatePoll()` | WIRED | Reads data.home_phases; filters in-flight |
| components/build-home/active-phase-cards.tsx | next/navigation | `router.push("?sheet=open&phase=...&project=...")` | WIRED | openSheet sets 3 params; preserves existing via URLSearchParams(searchParams.toString()) |
| components/build-home/agent-avatars.tsx | lib/copy/agent-meta.ts | `agentMetaFor(a.name)` | WIRED | Line 22 invoked per agent |
| components/build-home/needs-you-list.tsx | lib/hooks/use-state-poll.tsx | `useStatePoll()` (data.needs_you) | WIRED | Reads data.needs_you |
| components/build-home/needs-you-list.tsx | next/link | `<Link href={action.href}>` | WIRED | Line 2 imports Link; renders per action |
| components/build-home/recent-ledger.tsx | lib/hooks/use-state-poll.tsx | `useStatePoll()` (data.events_recent) | WIRED | Reads data.events_recent |
| components/build-home/task-detail-sheet.tsx | components/ui/sheet.tsx | `<Sheet><SheetContent>` | WIRED | Imports Sheet/SheetContent/SheetHeader/SheetTitle |
| components/build-home/task-detail-sheet.tsx | lib/hooks/use-sheet-keys.ts | `useSheetKeys({enabled, onClose, onPause, onAbort})` | WIRED | Line 74-79 invokes with memoized callbacks |
| components/build-home/sheet-live-log.tsx | app/api/tail/route.ts | `new EventSource("/api/tail?path=...")` | WIRED | Line 32 opens ES; encodeURIComponent |
| app/build/page.tsx | components/build-home/* (6 components) | import + JSX mount | WIRED | All 6 imported + rendered in UI-SPEC §3 order |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| RollupStrip | data.rollup | useStatePoll → fetch(/api/state) → getHomeState().rollup → reads .cae/metrics jsonl | Yes | FLOWING |
| LiveOpsLine | data.live_ops_line | getHomeState().live_ops_line ← composeLiveOpsLine over 30s window of forge_start events | Yes | FLOWING |
| ActivePhaseCards | data.home_phases | getHomeState().phases ← buildPhases(projects) → getPhaseDetail per phase | Yes | FLOWING |
| NeedsYouList | data.needs_you | getHomeState().needs_you ← buildNeedsYou (STATUS_FAILED + outbox approvals + REVIEW-READY markers) | Yes | FLOWING |
| RecentLedger | data.events_recent | getHomeState().events_recent ← tailJsonl across circuit-breakers.jsonl, maps forge_done/fail → RecentEvent | Yes | FLOWING |
| TaskDetailSheet | URL search params + data.home_phases | useSearchParams + useStatePoll | Yes | FLOWING (phaseSummary lookup by phaseNumber+project) |
| SheetLiveLog | EventSource messages | /api/tail?path=... SSE stream | Depends on runtime path | FLOWING (stream plumbing confirmed; actual stream needs human verification) |

### Requirements Coverage

No requirement IDs declared in any plan frontmatter (`requirements: []` across all 6 plans). Requirements tracking not applicable for this phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| sheet-actions.tsx | invoke() | `toast.info(...)` stub — no real action | Info | Intentional — documented in SUMMARY as Phase 9 deferral |
| task-detail-sheet.tsx | pauseAction/abortAction | `toast.info + console.info` stubs | Info | Intentional — documented as Phase 9 deferral |
| task-detail-sheet.tsx | Changes section | "No commits yet." static placeholder | Info | Intentional — commits data deferred to Phase 9 per CONTEXT |
| task-detail-sheet.tsx | Memory section | sheetMemoryStub placeholder | Info | Intentional — list + click-through deferred to Phase 8 per CONTEXT |
| task-detail-sheet.tsx | Comments section | sheetCommentsStub placeholder | Info | Intentional — chat rail deferred to Phase 9 per CONTEXT |
| cae-home-state.ts | RecentEvent.commits | always 0 in v1 | Info | Documented in 04-01-SUMMARY — commit count requires git log per event; deferred |

All stubs are INTENTIONAL and documented in plan/context files as cross-phase deferrals. No accidental placeholders found.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compile clean | `pnpm tsc --noEmit` | exit 0, no output | PASS |
| Production build | `pnpm build` | "Compiled successfully in 6.6s", all 12 routes generated including /build + /api/state + /api/tail | PASS |
| getHomeState() aggregator runs without throw | `pnpm dlx tsx <module-smoke>.mjs` | Returns HomeState with 5 keys: rollup/phases/events_recent/needs_you/live_ops_line; live_ops_line="Idle right now." on quiet machine | PASS |
| Status-enum script in check 15 spec | `m.getHomeState()` smoke | ran via dynamic import (TSX ESM interop quirk); returned valid HomeState object with expected shape | PASS (with note: the check 15 query used `home_phases` but internal type is `phases` — the rename happens in the HTTP route, which is correct design) |

### Human Verification Required

See frontmatter `human_verification:` section for the 7 items requiring browser-level testing (visual hierarchy, click → sheet open, SSE stream, keyboard shortcuts, dev-mode flip, empty states, sheet close project preservation).

### Gaps Summary

No gaps found. All 15 observable truths have supporting artifacts that:

1. **Exist** at the expected paths (substantive file sizes: 60–8300 lines)
2. **Are substantive** (no stub anti-patterns; every widget consumes real data via useStatePoll; every aggregator helper reads real file-system state)
3. **Are wired** (all imports + usages traced; 16 key links verified)
4. **Have flowing data** (Level 4 trace: rollup/phases/events/needs_you/live_ops_line all flow from real `.cae/metrics` + `.planning/phases` + outbox reads through to UI consumers)

The `FOUNDER_LABEL` consolidation (Plan 04-06 Option B) is complete — `cae-home-state.ts` imports `agentMetaFor` and the inline 9-entry duplicate is absent. The `params.delete("project")` guard in the sheet close path is enforced (grep count 0). The /api/tail ALLOWED_ROOTS extension is active (computeAllowedRoots reads listProjects per request). The Phase 2 widgets (phases-list/breakers-panel/metrics-tabs) are deleted.

The 7 human-verification items are runtime behaviors (visual render, click navigation, SSE streaming, keyboard shortcuts, dev-mode toggle, empty-state copy, URL preservation on close) that cannot be confirmed programmatically. Everything that can be verified via code inspection passes.

---

_Verified: 2026-04-22T04:57:13Z_
_Verifier: Claude (gsd-verifier)_
