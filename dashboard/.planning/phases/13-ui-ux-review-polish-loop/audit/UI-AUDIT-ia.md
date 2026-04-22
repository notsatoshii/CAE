# UI Audit — Mission Control IA Delta

**Audited:** 2026-04-23 (Plan 13-07, Wave 4)
**Reference:** Mission Control (github.com/builderz-labs/mission-control, 4.3k stars)
**Scope:** Route-by-route IA comparison. Adopt/Partial/Defer per V2 §5 delta table.
**Auditor:** Sonnet 4.6 (plan 13-07 executor)

---

## Overview

Mission Control (MC) is the closest public reference project to CAE Dashboard — a
self-hosted AI agent orchestration UI. This audit maps every MC IA pattern identified
in 13-MISSION-CONTROL-NOTES.md against our current implementation, assigns an
adopt/partial/defer verdict, and documents the evidence for each decision.

All ADOPT items ship in plan 13-07. DEFER items are recorded here with rationale
and a target plan for future resolution.

---

## V2 §5 Delta Table — Per-Row Verdicts

### Row 1: Ambient Clock + Latency Chip

**MC pattern:** Top-right cluster shows "Live 09:23" (wall clock) + "Nov 28ms (20 avg)"
(latency per session). Always-on ambient awareness without navigating anywhere.

**Verdict: ADOPTED (plan 13-07)**

**What we shipped:**
- `components/shell/ambient-clock.tsx` — HH:mm:ss local clock, 1s tick, isolated
  component so the 1s setInterval does not cause top-nav re-renders
- Reduced-motion branch: HH:mm (no seconds) at 60s cadence when
  `prefers-reduced-motion: reduce` is set
- aria-label="Local time HH:mm" for screen readers
- Mounted in `components/shell/top-nav.tsx` between HeartbeatDot and LivenessChip

**Evidence:**
- `components/shell/ambient-clock.tsx` lines 1–60 (new file)
- `components/shell/top-nav.tsx` line 10 (import) + line 51 (mount)
- `components/shell/ambient-clock.test.tsx` — 4 tests: format, tick, reduced-motion, aria-label

**Delta from MC:** We show HH:mm:ss (more granular than MC's HH:mm). Latency chip
is LivenessChip (plan 13-06) showing staleness in seconds, not per-session ms latency.
MC's session-latency requires chat-rail modifications — see Row 8 (Session Router).

---

### Row 2: Persistent Alert Banner

**MC pattern:** Yellow banner across top with inline "Run Docker Fix" + "Show Details"
+ X dismiss CTAs. Appears when the orchestrator surface something actionable.

**Verdict: ADOPTED (plan 13-07)**

**What we shipped:**
- `components/shell/alert-banner.tsx` — amber banner triggered by any of:
  - `breakers.halted === true`
  - `breakers.retryCount > 0`
  - `breakers.recentPhantomEscalations > 0`
- Fingerprint-based dismissal via localStorage `p13-alert-dismissed`
- Banner reappears when fingerprint changes (new/different trigger event)
- "Show Details" → /build; "Dismiss" → writes fingerprint to localStorage
- Mounted in `app/layout.tsx` between TopNav and children (session-gated)
- Zero new API endpoints — reuses existing `useStatePoll()` → `/api/state`

**Evidence:**
- `components/shell/alert-banner.tsx` lines 1–130 (new file)
- `app/layout.tsx` line 17 (import) + line 56 (mount)
- `components/shell/alert-banner.test.tsx` — 6 tests: quiet, halted, retry,
  fingerprint match, fingerprint change, dismiss

**Delta from MC:** Their banner has domain-specific CTAs ("Run Docker Fix"). Ours
uses founder-speak copy keyed on trigger type. The CTA navigates to /build rather
than spawning a one-click fix — correct per D-06 (prefer nav to existing surface).

---

### Row 3: KPI Card Strip (Always-on Rollup)

**MC pattern:** Prominent top-row of colored KPI cards (Gateway Online / Sessions 2/87
/ Agent Capacity / Queue / System Load %) always visible on every page.

**Verdict: DEFERRED to Wave 6 (plan 13-09)**

**Rationale:** Our rollup strip (RollupStrip component) already surfaces the same data
but in a horizontal bar format rather than individual KPI cards with icons and colored
accents. Promoting it to always-on (not just on /build) and adding MC-style card
treatment with per-metric icons is a visual change, not a copy/IA change. This belongs
in plan 13-09 (visual pillar polish), not in this copy-and-IA plan.

**Target:** plan 13-09 (Wave 6 visual polish). Wire RollupStrip to layout.tsx or
promote metrics to a persistent HUD strip.

---

### Row 4: Golden Signals Panel

**MC pattern:** Standard SRE framing — Traffic, Errors, Saturation, Latency —
as labeled sections in the metrics/dashboard surface.

**Verdict: ADOPTED (plan 13-07)**

**What we shipped:**
- `components/metrics/golden-signals-subtitles.tsx` — secondary subtitle strip
  under each metrics panel heading. Three panel variants:

  | Panel prop | Primary heading (founder) | Golden Signals subtitle |
  |------------|--------------------------|------------------------|
  | "spending" | "Spending" / "How CAE is spending" | Traffic · {tok today} | Saturation · {%} budget MTD |
  | "howwell"  | "How well it's going" | Errors · {n} halts | Success rate · {%} |
  | "howfast"  | "How fast" | Latency p50 · {ms} | p95 · {ms} |

- Data sourced from existing `useMetricsPoll()` — zero new fetches or endpoints
- Mounted in `spending-panel.tsx`, `reliability-panel.tsx`, `speed-panel.tsx`
  immediately after the `<h2>` heading element

**Evidence:**
- `components/metrics/golden-signals-subtitles.tsx` lines 1–137 (new file)
- `components/metrics/spending-panel.tsx` — import line + mount after h2
- `components/metrics/reliability-panel.tsx` — import line + mount after h2
- `components/metrics/speed-panel.tsx` — import line + mount after h2
- `app/metrics/metrics-client.tsx` — unchanged (provider mount point unaffected)

**Delta from MC:** MC renders Golden Signals as full KPI cards with icons and
numeric badges. We add them as a secondary subtitle line (additive, non-replacing).
The visual card treatment is plan 13-09 territory. The data framing and vocabulary
are now present.

---

### Row 5: Agent Card Action Verbs

**MC pattern:** Agent Squad cards have per-card quick actions labeled
"Wake / Spawn / Hide" — agentive verbs that match what users actually do (wake
a dormant agent, spawn a new task, hide an agent from view).

Our current agent cards use implicit actions via click-to-open-drawer, with no
inline action buttons.

**Verdict: ADOPTED (plan 13-07)**

**What we shipped:**
- `lib/copy/labels.ts` — `AgentVerbSet`, `AgentVerbs`, `agentVerbs()` factory,
  and `getAgentVerbSet()` localStorage reader appended to existing file
- Two verb sets:

  | Set | primary | stop | archive |
  |-----|---------|------|---------|
  | `start_stop_archive` (default) | Start | Stop | Archive |
  | `wake_spawn_hide` (MC-inspired) | Wake | Hide | Hide |

- `components/agents/agent-card.tsx` — imports `agentVerbs + getAgentVerbSet`;
  reads verb set from localStorage on mount via `useState + useEffect`; renders
  three quick-action verb buttons (primary / stop / archive) between the stats
  block and the footer row. Handlers are stubs (TODO 13-09 will wire them)

**A/B decision path:**
- Default is `start_stop_archive` (familiar, neutral)
- To activate MC verbs: `localStorage.setItem("p13-agent-verbs", "wake_spawn_hide")`
- To revert: `localStorage.removeItem("p13-agent-verbs")`
- Eric decides which set to make permanent in plan 13-09. The localStorage flag
  allows testing in production without a code deploy.

**Evidence:**
- `lib/copy/labels.ts` — `AgentVerbSet` type + `VERB_SETS` + `agentVerbs()` + `getAgentVerbSet()`
- `components/agents/agent-card.tsx` — `useState/useEffect` verb state + verb button row
  with `data-testid="agent-card-{name}-verb-primary/stop/archive"` testids
- `lib/copy/labels.test.ts` — 6 tests: both sets, default, localStorage empty/set/invalid

**Delta from MC:** MC's verbs trigger actions immediately. Ours render the verb copy
without live action handlers (plan 13-09 scope). The A/B vocabulary is wired and
visually present.

---

### Row 6: Tabbed Agent Surface (Command / Workflows / Pipelines / Fleet)

**MC pattern:** Single tab bar above the agent area groups Command / Workflows /
Pipelines / Fleet — related surfaces in one place rather than separate nav items.

**Verdict: DEFERRED — Phase 14**

**Rationale:** Our nav is flat: Agents / Queue / Workflows are separate top-nav
links. Collapsing them into a tab bar would require:
1. IA refactor of the nav (moving 3 routes into 1 parent route + tab state)
2. URL structure change (/build/agents?tab=workflows vs /build/workflows)
3. Migration of existing deep-links

This is not a copy-only change and crosses the D-06 boundary. Phase 14 candidate.

---

### Row 7: Alert Banners with Inline CTAs (general pattern)

**MC pattern:** System-level alert bars (Docker alerts, health warnings) with
actionable CTAs inline. We covered the specific breaker-halt trigger in Row 2.

**Verdict: ADOPTED (see Row 2 — alert-banner.tsx)**

The general pattern is implemented. Future alert types (disk full, model rate-limit,
git conflict) can be added to the trigger conditions in `alert-banner.tsx` without
architectural changes.

---

### Row 8: Session Router (per-session latency list)

**MC pattern:** Scrollable list of active sessions with per-session latency, token
count, and status. Makes active work "feel alive."

**Verdict: PARTIAL — deferred to plan 13-08 (Functionality completeness)**

**Rationale:** Our ChatRail + session list (chat-panel.tsx) shows past conversations
but does not surface live per-session metrics (latency, tokens in-flight). Adding
this requires:
- A new /api/sessions endpoint or extending /api/state with session metrics
- Live SSE updates for the session list

The LivenessChip (plan 13-06) partially covers this at the aggregate level
("Live · 2s" staleness). True session-level latency is plan 13-08 territory.

**Note:** This was identified in V2 §5 as PARTIAL from the start.

---

### Row 9: Fleet / Pipelines Tabs

**MC pattern:** Separate tabs for Fleet (multi-project agent roster) and Pipelines
(CI/CD-style pipeline view).

**Verdict: SKIP — not applicable to CAE single-project architecture**

CAE is single-user, single-project. Fleet management assumes multi-tenant/multi-project.
Pipelines tab duplicates functionality in our Queue kanban. Neither maps cleanly
to our current architecture without new data model work.

This is out of scope for Phase 13 per V2 §5 explicit skip list.

---

### Row 10: Task Flow Rename

**MC pattern:** "Task Flow" for the kanban/queue view instead of our "Queue."

**Verdict: SKIP — naming decision deferred**

Renaming "Queue" to "Task Flow" requires updating all labels.ts entries, URL slugs,
and any documentation. It's a meaningful IA change but pure copy with no functional
improvement. Eric has not confirmed preference. If adopted, it becomes a 10-minute
labels.ts change in any future plan.

**Note:** Our queue uses kanban columns (Planned / Building / Reviewing / Blocked /
Merged in dev; Waiting / Working on it / etc. in founder). "Task Flow" is arguably
more accurate. Deferred until Eric confirms.

---

### Row 11: SOUL Personality Rebrand

**MC pattern:** "SOUL personalities" branded framework for agent voice personas.

**Verdict: SKIP — we have better**

CAE already has 9 named personas (Nexus/Forge/Sentinel/Scout/Scribe/Phantom/Aegis/
Arch/Herald) with per-route narration via Explain-mode. This is a naming/branding
decision, not a functionality gap. MC's SOUL brand is theirs; we keep ours.

---

### Row 12: ⌘K Global Search

**MC pattern:** Centered ⌘K command bar in top nav — "Jump to page, task, agent…"

**Verdict: DEFERRED — Phase 12 territory**

CommandPalette is already implemented (plan 12-xx, ShortcutHelpButton in top-nav).
The ⌘K trigger is wired. The search contents and result quality are Phase 12 scope.
No action needed in Plan 13-07.

---

## Summary Table

| MC Pattern | Our verdict | Plan | Status |
|-----------|-------------|------|--------|
| Ambient clock | ADOPTED | 13-07 | `components/shell/ambient-clock.tsx` |
| Latency chip | ADOPTED (via LivenessChip) | 13-06 | `components/shell/liveness-chip.tsx` |
| Persistent alert banner | ADOPTED | 13-07 | `components/shell/alert-banner.tsx` |
| KPI card strip | DEFERRED | 13-09 | visual treatment pending |
| Golden Signals framing | ADOPTED | 13-07 | `components/metrics/golden-signals-subtitles.tsx` |
| Agent card verbs | ADOPTED (A/B) | 13-07 | `lib/copy/labels.ts` + `agent-card.tsx` |
| Tabbed agent surface | DEFERRED | Phase 14 | IA refactor needed |
| Incident Stream panel | DEFERRED | 13-08 | logging plan scope |
| Session Router | PARTIAL | 13-08 | aggregate liveness done; per-session TBD |
| Fleet/Pipelines tabs | SKIP | — | not applicable |
| Task Flow rename | SKIP | — | naming decision pending |
| SOUL personality | SKIP | — | we have better |
| ⌘K global search | ADOPTED | 12-xx | CommandPalette already wired |

---

## MC Patterns We Already Do Better

Per 13-MISSION-CONTROL-NOTES.md "What we already do better":

- **Persona voices** — Nexus/Forge/Sentinel/etc. with per-route narration (Explain-mode). MC has agent names but no narration.
- **Explain-mode (⌘E)** — Founder-speak + dev-mode toggle. MC appears dev-mode only.
- **ConfirmActionDialog** — Token estimate + undo toast. MC's quality gate is heavier.
- **Changes prose timeline** — Tuesday/this-morning phrasing. MC has log streams, not story-told history.
- **Chat pop-out + persistent rail** — Chat is pervasive across all tabs. MC has a send bar but not a persistent rail.

These are competitive advantages. Plan 13-07 additions do not erode them.

---

## Open Questions / Next Steps

1. **AgentVerbs A/B decision** — Eric to evaluate `wake_spawn_hide` in dev mode via
   `localStorage.setItem("p13-agent-verbs", "wake_spawn_hide")`. Deadline: before
   plan 13-09 (Wave 6 visual polish) ships.

2. **KPI card visual treatment** — plan 13-09 should evaluate whether RollupStrip
   data warrants a MC-style card grid at page top (always-on) or if the current
   strip placement on /build home is sufficient.

3. **Incident Stream panel** — plan 13-08 (Functionality/Logging) evaluates whether
   the existing TailPanel / SheetLiveLog covers this or if a dedicated incident stream
   panel (reading pino structured logs) is warranted.
