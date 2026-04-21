# Phase 4: Build Home rewrite — Context

**Gathered:** 2026-04-21
**Status:** Ready for planning
**Source:** UI-SPEC.md §3 (Ops Home hierarchy) + §5 (Task detail sheet) + §Audience reframe

<domain>
## Phase Boundary

Rewrite `/build` home page from the Phase 2 functional-but-ugly proof into the hierarchy view from UI-SPEC §3. This is the primary surface founders see when they land — make it clear, calm, actionable.

**In scope:**
1. Rollup strip (today's numbers: shipped count, tokens, in-flight, blocked, warnings)
2. Active phase cards with live progress bar + ETA + wave count + agent avatars
3. "Needs you" actionable list with per-row action buttons (Review / Approve / Deny / Open)
4. Recent ledger — last 20 events with ✓/✗ status, timestamp, agent, tokens
5. Live Ops one-liner — pinned above Active Phases, real-time agent assignment
6. Click phase card → right-slide task detail sheet (UI-SPEC §5)
7. Right-slide task detail sheet with: header (title/status/agents/urgency/tags/close/Pause/Abort), summary, live log (SSE tail, 500 line cap), changes (commits with plain-English rewrite), memory referenced (section header + Phase-8 placeholder only; list+click-through defer), comments, actions (Approve/Deny/Retry/Abandon/Reassign/Edit plan)

**Not in scope (deferred):**
- Agents tab content (Phase 5)
- Workflow/Queue redesign (Phase 6)
- Memory browse/graph (Phase 8)
- Changes tab (Phase 9)
- Chat rail (Phase 9)
- Plan mode content (Phase 10)
- Command palette (Phase 12)
- Screen-shake wiring to merge events (Phase 9 owns SSE integration)

</domain>

<decisions>
## Implementation Decisions

### Rollup strip

Content: `{shipped_count} shipped · {total_tokens} tok · {in_flight} in-flight · {blocked} blocked · ⚠{warnings}`

- Data source: aggregate across all projects' `.cae/metrics/*.jsonl` for today + scan `.planning/phases/*/` for in-flight + blocked counts
- Server component fetching at page load; use SWR or `useStatePoll` hook (from Phase 3) for client-side refresh every 3s
- Empty state: `No activity today` with a subtle CTA link to docs
- Position: top of `/build` home, below top-bar, full-width inside a single card surface

### Active phase cards

One card per active (in-flight) phase across all projects. Card anatomy:

```
┌────────────────────────────────────────────────────────────────┐
│ {project-name} · phase {N}              Forge ●● Sentinel ●   │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░ wave {W/N} · {P}%            │
│ ETA ~{M}m · {X}k tok this phase                                 │
└────────────────────────────────────────────────────────────────┘
```

- Agent avatars (right side of heading): dots = concurrent tasks for that agent, grayscale if dormant
- Progress bar: cyan accent (`#00d4ff`), animated pulse when actively running
- ETA: heuristic from past phases of same project (average wall time × remaining waves)
- Token count: sum of this phase's metrics
- Click card → right-slide task detail sheet

Data source: `.planning/phases/*/PLAN.md` frontmatter + current wave tracked via `.planning/STATE.md`

Founder-speak flip (via `useDevMode` + `labelFor`):
- Dev off: "Building `cae-dashboard` — {P}% done, ~{M} min left"
- Dev on: "cae-dashboard · phase {N} · wave {W/N} · {P}%"

### Live Ops one-liner

Pinned above Active Phases. Single line of mono 12px text showing every currently-active agent and what it's on:

`Right now: Forge → p3-t3 (cae-dashboard). Sentinel → p3-t2 review. Scout → idle.`

Founder-speak flip:
- Dev off: "Right now: builder is working on the signin page, checker is double-checking the auth code."
- Dev on: mono technical form above

Data: poll `.planning/STATE.md` + inbox/outbox for current agent assignment. Refresh every 3s via `useStatePoll`.

### "Needs you" list

Actionable items requiring user decision. Each row:

```
⚠ {project}/phase{N}-t{M}: Sentinel rejected 3× → [Review]
🛡 {project}/phase{N}-t{M}: danger action "git push main" → [Approve][Deny]
📝 {project}: ROADMAP ready for review → [Open Plan]
```

Icons map to item type (⚠ = blocked, 🛡 = security/dangerous, 📝 = plan review). Actions inline.

Data sources:
- Blocked tasks: `.planning/phases/*/PLAN.md` + state of Forge/Sentinel retry counts
- Dangerous-action pending: scan outbox for approval items (existing CAE mechanic from Phase 2)
- Plan review: from Plan mode (Phase 10) — stub for now (show only if any `.planning/phases/*-REVIEW-READY.md` marker exists)

Empty state: `All caught up` with a small checkmark graphic.

### Recent ledger

Last 20 events across all projects. Dense 40px rows, mono font:

```
✓ 8:42  cae-dashboard p3-t3    +4 commits  forge(sonnet)  820tok
✓ 8:38  lever p2-t1            +2 commits  forge(opus)   4.1ktok
✗ 8:31  cae-dashboard p3-t4    aborted    sentinel rejected 3×
```

Data source: tail of `.cae/metrics/*.jsonl` across projects + git log for commit counts. Refresh every 10s (less frequent than rollup since it's append-only).

Founder-speak for event row (dev off):
- `✓ 8:42  Built 4 things in cae-dashboard — Forge in 12s`
- `✗ 8:31  Couldn't finish p3-t4 — checker kept flagging it`

### Task detail sheet (right slide-over)

Triggered by clicking an active phase card OR a "Needs you" row. Slides from right, 50% viewport width on desktop, full width on narrow screens.

Sections (all collapsible, expanded by default except where noted):

1. **Header:** title, status pill, agents working (avatar row), urgency dot, tags. Actions: close (Esc key), Pause (Ctrl+.), Abort (Ctrl+Shift+.)
2. **Summary:** buildplan text (from PLAN.md `<objective>`), expandable
3. **Live log:** SSE tail at `/api/tail?phase={N}&plan={M}`, pause/resume scroll button, hard cap 500 lines visible
4. **Changes:** commits landed with SHA + plain-English rewrite (use `labelFor` consumer for dev toggle), GitHub compare link
5. **Memory referenced:** **section present as placeholder only in Phase 4.** Renders the section heading (`"What CAE looked at"` / `"Memory referenced"`) with an empty body reading `"ships in Phase 8"` (subtle `text-muted` styling). Collapsed by default (uses `<details>/<summary>` native disclosure). The LIST of AGENTS.md + KNOWLEDGE/ entries invoked during this task AND the click-through to a filtered Memory tab are BOTH deferred to Phase 8 (when the Memory tab ships). In Phase 4 we ship ONLY the scaffolded section so the sheet's 7-section layout is visually complete; actual content lands with Phase 8.
6. **Comments:** thread (stub — tied to chat rail from Phase 9; show "Comments ship in Phase 9" if before then)
7. **Actions:** Approve / Deny / Retry / Abandon / Reassign / Edit plan — only the ones applicable to current status

Keyboard:
- `Esc` — close sheet
- `Ctrl+.` — pause
- `Ctrl+Shift+.` — abort

Use `components/ui/sheet.tsx` (shadcn, from Phase 1; dark-themed via Phase 3 tokens).

**Close behaviour contract:** When the sheet closes (Esc / overlay click / URL-state removal), the `project` query param MUST BE PRESERVED in the URL. Only `sheet`, `phase`, `plan`, `task` are removed. The founder's selected project context survives sheet dismissal.

### Live tail integration

Reuse `/api/tail` SSE endpoint from Phase 2. Sheet opens → fetch begins → appended lines stream in. Pause button → stops auto-scroll but keeps stream. Close sheet → aborts fetch (client-side EventSource close).

**Cross-project extension (Phase 4):** `/api/tail`'s Phase 2/3 ALLOWED_ROOTS whitelist covered ONLY the dashboard project's CWD. For the Build Home (cross-project by design), Plan 04-01 Task 4 extends the whitelist at request time to include every `{project_path}/.cae/logs`, `/.cae/metrics`, and `/.planning/phases` directory discovered by `listProjects()`. Non-dashboard project logs now stream successfully instead of returning 403.

Hard cap 500 lines visible: prepend buffer trim after 500 lines. Show "…earlier lines truncated" banner when triggered.

### Emergency brake labeling (founder-speak)

Dev off: "Pause this" button visible, Ctrl+. secondary
Dev on: compact icon button with Ctrl+. keyboard hint

### State polling for phase + agent status

Extend `useStatePoll` (from Phase 3) to include:
- Per-phase: current wave, progress percentage, active agents, token sum
- Global: count of in-flight phases, blocked count, warning count, today's shipped count
- Refresh interval: 3s default (same as Phase 3)

API route `/api/state` — extend existing Phase 2 endpoint to return the richer JSON shape above. Backward-compat: older consumers (heartbeat dot) still work.

### Empty states

- No active phases: "No active work right now. Go to Plan mode to start a project."
- No blocked items: "All caught up ✓"
- No recent events: "Nothing shipped yet today."

All empty-state copy pulls from `lib/copy/labels.ts` so dev-mode toggle flips tone.

### Claude's Discretion

- Exact grid layout (CSS Grid vs Flexbox with explicit widths)
- Rollup strip card vs full-bleed row
- Task detail sheet animation curve (shadcn default acceptable)
- Whether to add optimistic UI for Approve/Deny actions (client-side state update before server confirms)
- Exact shape of `/api/state` JSON (extend existing, add nested `phases` + `events` keys)
- ETA formula details (executor picks — document in SUMMARY)

</decisions>

<canonical_refs>
## Canonical References

### Design law
- `docs/UI-SPEC.md` §3 (Ops Home hierarchy), §5 (Task detail sheet), §Audience reframe (all founder-speak flips)

### Existing implementation (refactor targets)
- `app/build/page.tsx` — current home page (Phase 2 proof — rewrite)
- `app/build/phases-list.tsx` — current active phase list (refactor into new card format)
- `app/build/breakers-panel.tsx` — circuit breaker panel (move into task detail sheet or absorb into live-ops one-liner)
- `app/build/metrics-tabs.tsx` — metrics tabs (REMOVE — Phase 7 owns full metrics at /metrics)
- `app/api/tail/route.ts` — existing SSE endpoint (reuse + extend ALLOWED_ROOTS for cross-project paths)
- `app/api/state/route.ts` — existing state endpoint (extend shape)

### Phase 3 artifacts (dependencies)
- `lib/providers/dev-mode.tsx` — useDevMode hook
- `lib/providers/explain-mode.tsx` — useExplainMode hook
- `lib/copy/labels.ts` — labelFor dictionary (extend with Phase 4 labels; baseline 9 `$` template literals in Phase 3 keys MUST be preserved)
- `lib/hooks/use-state-poll.tsx` — shared poll hook (extend for richer state)
- `components/ui/sheet.tsx` — right-slide sheet primitive
- `components/ui/scroll-area.tsx` — for live log overflow
- `components/shell/build-home-heading.tsx` — heading client-island (reuse)

### Project instructions
- `./CLAUDE.md` if exists
- `.claude/skills/cae-forge/SKILL.md` — Forge persona
- `.claude/skills/cae-arch/SKILL.md` — Arch planner persona

</canonical_refs>

<specifics>
## Specific Ideas

### State API extension

Current `/api/state` returns circuit-breaker state. Extend:

```ts
type StateResponse = {
  breaker: { tokens_today: number, concurrent_forge: number, retries: number },
  phases: Array<{
    project: string,
    phase: string,
    wave_current: number,
    wave_total: number,
    progress_pct: number,
    eta_min: number | null,
    tokens_phase: number,
    agents_active: Array<{ name: string, concurrent: number }>,
  }>,
  events_recent: Array<{
    ts: string,
    project: string,
    phase: string,
    plan: string,
    status: 'shipped' | 'aborted',
    commits: number,
    agent: string,
    model: string,
    tokens: number,
  }>, // last 20
  needs_you: Array<{
    type: 'blocked' | 'dangerous' | 'plan_review',
    project: string,
    phase?: string,
    task?: string,
    summary: string,
    actions: Array<{ label: string, href: string }>,
  }>,
  rollup: {
    shipped_today: number,
    tokens_today: number,
    in_flight: number,
    blocked: number,
    warnings: number,
  },
  live_ops_line: string,  // pre-formatted one-liner (server composes)
}
```

Server aggregates via reading `.planning/`, `.cae/metrics/`, inbox/outbox. Cached for 1s to avoid thrashing.

**Status enum source of truth:** The aggregator depends on `TaskStatus` from `lib/cae-phase-detail.ts` (values: `"pending" | "running" | "merged" | "failed"`). Plan 04-01 Task 1 imports these values rather than hardcoding — TypeScript enforces drift detection.

### Task detail sheet opening pattern

Use URL state: clicking card navigates to `/build/phase/[num]?sheet=open` or similar — allows deep-linking + browser back button closes sheet. Alternative: pure React state (no URL change) — simpler but less shareable.

Recommend URL state for shareability. Planner picks exact scheme.

URL scheme (LOCKED by Plan 04-03): `?sheet=open&phase={N}&project={path}` (+ optional `plan={id}&task={id}` when opening from a Needs-you row). Sheet close removes `sheet`, `phase`, `plan`, `task` — preserves `project`.

### Agent avatar rendering

Use a lookup table `lib/copy/agent-meta.ts` (new) with:
```ts
export const AGENT_META = {
  forge: { label: 'Forge', founder_label: 'the builder', emoji: '⚒️', color: 'orange' },
  sentinel: { label: 'Sentinel', founder_label: 'the checker', emoji: '🛡️', color: 'cyan' },
  // ...9 total agents from UI-SPEC §0
}
```

Avatar = emoji + color pill. Dots = concurrent task count.

**Single source of truth rule:** Plan 04-01 (wave 1) and Plan 04-02 (wave 1) both need the founder_label mapping, but run in parallel so neither can import from the other during execution. Plan 04-01 ships with a DELIBERATE inline duplicate `FOUNDER_LABEL` map to break the parallel-wave dependency. Plan 04-06 (wave 4) THEN refactors `lib/cae-home-state.ts` to import `agentMetaFor` from `lib/copy/agent-meta.ts`, eliminating the duplicate. After Plan 04-06, `agent-meta.ts` is the single source of truth.

### Live Ops line composition

Server composes the sentence from active agent map. Template:
- 0 active: "Idle right now."
- 1 active: "Right now: {agent_founder_label} is on {task}."
- 2+ active: "Right now: {a} is on {X}. {b} is on {Y}. {c} is idle."

Max 3 agents shown; "+{N} more idle" if more.
</specifics>

<deferred>
## Deferred Ideas

- **Full task comments thread** → Phase 9 (chat rail)
- **Memory-referenced LIST and click-through to Memory tab** → Phase 8 (Memory tab ships then). In Phase 4, the Task Detail Sheet renders ONLY the section heading with a subtle "ships in Phase 8" placeholder; the list of AGENTS.md / KNOWLEDGE entries and the click-through navigation both wait for the Memory tab.
- **Screen-shake on Sentinel merge** → Phase 9 (SSE integration lives there)
- **Agent detail drawer** → Phase 5 (Agents tab)
- **Metrics panels (old metrics-tabs)** → Phase 7 (dedicated /metrics page)
- **Project picker** (switching which projects show on /build home) → Phase 6 or later; for Phase 4 show all projects
- **Pinning favorite phases** → deferred to v2
- **Drag-to-reorder "Needs you"** → deferred (no drag in v1 per UI-SPEC critique #11)
- **Real pause/abort wiring** (SheetActions' 6 buttons + Pause/Abort hotkeys) → Phase 9 or later. Phase 4 ships them as `toast.info()` stubs; the button testids + keyboard shortcuts + URL-state scaffolding are in place so future phases only wire behaviour, not UI.

</deferred>

---

*Phase: 04-build-home-rewrite*
*Context gathered: 2026-04-21*
*Revised: 2026-04-20 (checker feedback round — memory-referenced deferral clarified, cross-project tail extension called out, status-enum source-of-truth noted, FOUNDER_LABEL consolidation plan documented, sheet close project-preservation contract locked)*
