# Phase 6: Workflows + Queue — Context

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Source:** UI-SPEC.md §4 (Queue/KANBAN) + §7 (Workflows) + §Audience reframe

<domain>
## Phase Boundary

Unify workflow definitions + queue runs per UI-SPEC §4 + §7. Founder-first: chat-drafted workflows are the primary entry; YAML editor is Advanced (dev-mode only). Queue is its own tab with founder-speak KANBAN columns.

**In scope:**
1. `/build/workflows` route — list of saved workflows + draft/edit UI
2. `/build/workflows/new` + `/build/workflows/[id]` detail routes
3. Workflow YAML schema + persistence (`.cae/workflows/*.yml` files)
4. Natural-language draft (textarea → server action parses intent into YAML stub; uses `cae-arch` skill or simple heuristics — NOT calling Anthropic API here; heuristic-based stub, real Nexus drafting deferred to Phase 9)
5. Monaco YAML editor (dev-mode only) with schema validation + step-graph preview
6. Run-now button → writes BUILDPLAN to inbox + spawns cae execute-buildplan via tmux (reuses Phase 2 mechanic)
7. `/build/queue` — full KANBAN rewrite replacing Phase 2 delegate form
8. KANBAN columns (founder-speak default, dev-mode flips to technical): Waiting / In progress / Double-checking / Stuck / Shipped
9. Card layout: task title, agent avatar, urgency, tags, live pulse (cyan dot) when running
10. Card click → reuse task detail sheet from Phase 4
11. `/api/workflows` endpoints: GET list, POST create, GET by id, PUT update, POST run
12. `/api/queue` endpoint: GET all current+recent workflow runs, grouped by status

**Not in scope (deferred):**
- Real Nexus chat-drafting of workflows (Phase 9 chat rail owns this)
- Workflow editor autocomplete for agent names/fields (polish)
- Scheduled workflow cron trigger implementation (definitions can include cron string but no scheduler in Phase 6 — polish phase adds)
- Event-triggered workflows (task.failed etc.) — definitions parse, no dispatcher
- Workflow versioning / history
- Drag-to-reorder queue cards (explicit buttons only, per UI-SPEC critique #11)

</domain>

<decisions>
## Implementation Decisions

### Workflow YAML schema

```yaml
name: upgrade-deps
description: Bump npm deps + rerun tests
trigger:
  type: manual          # | cron | event (latter two: definitions parse, no runtime dispatch in Phase 6)
  schedule: "0 9 * * 1" # optional, cron type only
  on: task.failed       # optional, event type only
steps:
  - agent: forge
    task: "Run pnpm update --latest, commit if tests pass"
    timeout: 10m
  - agent: sentinel
    task: review
  - gate: approval
    notify: telegram
  - action: push
```

Steps: each is one of:
- `{ agent, task, timeout? }` — agent task
- `{ gate, notify? }` — approval gate (value: `approval` for human, `auto` for instant)
- `{ action }` — fixed action (`push`, `abort`, `branch`)

Persistence: `.cae/workflows/{slug}.yml` at project root. `slug` from name.

### Workflow list UI

`/build/workflows` server component fetches `/api/workflows` → list of workflow cards:
- Founder view: card shows name, description, last run (relative time), "Run now" button
- Dev view: adds YAML SHA, trigger type, step count, agent chips

Empty state: "No recipes yet" (founder) / "No workflows defined" (dev). CTA: "Create one" button → `/build/workflows/new`.

### New/edit workflow page

`/build/workflows/new` and `/build/workflows/[id]`:

**Founder mode (default):**
- Big textarea at top: "Describe what you want this recipe to do"
- "Draft" button → server action parses natural language into YAML stub (heuristic-based: detect "every Monday" → cron, "forge" → forge step, "review" → sentinel, "approve" → gate, "push" → action)
- Right pane: visual step graph preview (nodes + arrows) — reactflow-style custom SVG or simple ol/li
- Save button → POST /api/workflows

**Dev mode (Ctrl+Shift+D toggle):**
- Textarea hidden, Monaco YAML editor shown
- Schema validation inline (json-schema-for-yaml or manual parse + validate)
- Right pane still shows step graph from parsed YAML

**Single source of truth:** workflow YAML string in component state. Founder natural-language draft → converts to YAML → same state. Dev YAML edit → same state.

### Monaco editor

Use `@monaco-editor/react` (add to deps). Lazy-load — `import('@monaco-editor/react')` dynamically. Register YAML language support. Schema validation via JSON schema (define inline in component).

### Step graph preview

Simple SVG rendering: vertical list of step boxes with arrows. No flowchart library. Each step box: icon (agent/gate/action) + label. ~80 lines.

### Queue tab rewrite

`/build/queue` — currently Phase 2 delegate form + list. Rewrite to full KANBAN:

```
┌─────────────┬─────────────┬──────────────────┬────────────┬──────────────┐
│ Waiting (3) │ In prog (2) │ Double-check (1) │ Stuck (1)  │ Shipped (12) │
├─────────────┼─────────────┼──────────────────┼────────────┼──────────────┤
│ [card]      │ [card]      │ [card]           │ [card]     │ [card]       │
│ [card]      │ [card]      │                  │            │ [card]       │
│ [card]      │             │                  │            │ [card]       │
└─────────────┴─────────────┴──────────────────┴────────────┴──────────────┘
```

Dev-mode column names: Planned / Queued / Building / Reviewing / Blocked / Merged.

Card layout (founder, ~80px dense):
```
[agent-emoji] task title
agent • project • 2m ago
#tag #tag #tag
[●] pulsing cyan dot if status=in-progress
```

Click card → reuses `TaskDetailSheet` from Phase 4 (URL state `?sheet=open&project=...&phase=...&plan=...&task=...`).

Keep the delegate form from Phase 2 — moves to a modal opened by "New job" button on the KANBAN header.

### Data sources

`/api/queue` aggregates from `.cae/inbox/*.md` (Waiting), live tmux sessions (In progress), outbox review queue (Double-check), error-flagged (Stuck), `.cae/metrics/*.jsonl` last 50 shipped rows.

Bucketing heuristics:
- Waiting: inbox entries not yet picked up
- In progress: active tmux session detected + heartbeat recent
- Double-checking: outbox entry with Sentinel pending approval marker
- Stuck: retry count ≥3 or explicit halt marker
- Shipped: merged + DONE.md present

### Running workflows

"Run now" on a workflow:
1. Expand the first `agent/task` step into a BUILDPLAN.md
2. Write to `.cae/inbox/wf-{slug}-{timestamp}.md`
3. Spawn `cae execute-buildplan` in tmux (reuse Phase 2 mechanic)
4. Return run ID to client → client navigates to queue with optimistic append

Multi-step workflows (Phase 6 scope): only first step runs in Phase 6. Full workflow runtime (step-by-step orchestration across waves) deferred — but the YAML parses and persists so later phases can pick it up.

### Founder-speak keys to add to labels.ts

`workflows.*`: listHeading, emptyCopy, createButton, draftBtn, saveBtn, runBtn, kanbanCol.waiting, kanbanCol.inProgress, kanbanCol.doubleCheck, kanbanCol.stuck, kanbanCol.shipped (dev: Planned/Queued/Building/Reviewing/Blocked/Merged), etc.

### Natural-language heuristic draft

Simple rules-based parser. Examples:
- "every Monday" → trigger.type=cron, schedule="0 9 * * 1"
- "every [day]" → set cron day
- "forge builds X" → step: { agent: forge, task: "X" }
- "sentinel reviews" → step: { agent: sentinel, task: review }
- "approve" / "ask me first" → step: { gate: approval }
- "push to main" → step: { action: push }
- "when task fails" → trigger.type=event, on=task.failed

If parse fails or text is unclear: return a minimal template with placeholders + note "couldn't parse fully — please refine." Don't call LLM.

Real chat-first drafting lives in Phase 9 (chat rail → workflow creation).

### Claude's Discretion

- Exact Monaco editor height (400px baseline ok)
- Step graph animation (none for Phase 6 — visual only)
- Queue refresh interval (5s; less frequent than home 3s)
- Whether to use optimistic UI on "Run now" (yes, recommended)
- File path for new workflows (can slugify name, or timestamp if collision)

</decisions>

<canonical_refs>
## Canonical References

### Design law
- `docs/UI-SPEC.md` §4 (Queue/KANBAN), §7 (Workflows), §Audience reframe

### Phase 4 artifacts
- `components/build-home/task-detail-sheet.tsx` — reuse for card click
- `lib/hooks/use-state-poll.tsx` — reuse for queue polling
- `lib/copy/agent-meta.ts` — agent emojis + colors
- `lib/copy/labels.ts` — extend with workflows.* + queue.*

### Phase 5 artifacts
- `components/shell/build-rail.tsx` — Workflows tab becomes live (no longer stub)
- `app/build/workflows/page.tsx` — stub from 05-02, fully rewrite this phase
- `app/build/queue/page.tsx` — Phase 2 delegate form, refactor to KANBAN

### Existing
- `.cae/inbox`, `.cae/outbox` — current CAE I/O
- `.cae/metrics/*.jsonl` — run history
- `bin/telegram_gate.py` / tmux orchestration — existing CAE spawn pattern

</canonical_refs>

<specifics>
## Specific Ideas

### Monaco dynamic import

```tsx
const Monaco = dynamic(() => import('@monaco-editor/react'), { ssr: false, loading: () => <div>Loading editor…</div> })
```

Register YAML language once via `onMount` callback: `monaco.languages.register({ id: 'yaml' })`.

### Step graph SVG

Hand-rolled 100-line component:
- Parse YAML steps with `js-yaml` (already in deps likely — check)
- For each step: render rectangle with icon + label
- Arrows: simple vertical lines between rectangles
- Color-code: agent=cyan, gate=amber, action=green

### KANBAN card

```tsx
<article
  data-testid={`queue-card-${task.id}`}
  data-status={task.status}
  onClick={() => openSheet(task)}
  className="dense-card"
>
  <header>
    <AgentBadge agent={task.agent} />
    <h3>{task.title}</h3>
  </header>
  <div className="meta">{task.project} • {relativeTime(task.ts)}</div>
  <div className="tags">{task.tags.map(t => <span>#{t}</span>)}</div>
  {task.status === 'in_progress' && <span className="pulse-dot" />}
</article>
```

### Approval stubs

Workflow "gate: approval" steps: Phase 6 only parses + shows in graph. Actual approval gating (writing to approval queue, notifying TG) deferred. Queue cards for approval-pending show in "Double-check" column with a "Approve" button that is currently a stub.

</specifics>

<deferred>
## Deferred Ideas

- **Real chat-driven workflow drafting** → Phase 9 (chat rail)
- **Workflow scheduler (cron dispatcher)** → Polish
- **Event dispatcher (task.failed trigger)** → Polish
- **Multi-step workflow runtime** → after Phase 9 (chat can orchestrate)
- **Workflow run history view** → Could go in Phase 9 Changes tab
- **Autocomplete in Monaco** → v2
- **Workflow templates gallery** → v2
- **Drag-to-reorder queue** → explicitly skipped (UI-SPEC critique #11)

</deferred>

---

*Phase: 06-workflows-queue*
*Context gathered: 2026-04-22*
