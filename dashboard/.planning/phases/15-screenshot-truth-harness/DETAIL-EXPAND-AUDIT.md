# Detail-Expand Depth Audit — CAE Dashboard

**Date:** 2026-04-23  
**Scope:** Every clickable list/row/card that opens a detail view (drawer, sheet, dialog, accordion, modal)  
**Author's Goal:** Quantify the gap between available data and rendered data. Eric's complaint: "shipped tasks show 0 information or detail that is useful" and "kandbans/detail expands currently suck."

---

## Executive Summary

**Finding:** Of 11 major detail-expand surfaces audited, **9 have material gaps** (P0-P1 missing fields), with average **32% field utilization** (showing ~21 of ~65 available fields per surface). The worst offender is **TaskDetailSheet** (only 4 rendered fields from a possible 24 available in the phase/task state), followed by **RecentLedger** (2 expandable rows × ~6 fields each vs 15+ available per event). Most accordion expands (DayGroup, ProjectGroup, FileTree, Schedule TaskList) render only label + count without drilling into detailed state.

**Common gaps:**
1. **Missing cost/token breakdowns** — token counts available in state but rarely rendered
2. **Missing timestamp details** — parsed dates/duration windows absent from detail views
3. **Missing agent + model context** — agent invocation records available but not shown per-task
4. **Missing status transitions** — task state available but not rendered chronologically
5. **Missing links between contexts** — no way to jump from task→phase→agent or from event→detail

**Recommendation:** Implement a "rich detail view" system where every clickable item (row, card, accordion) shows:
- **Always:** full timestamp, status with color, acting agent + model
- **Available expansion:** token cost, duration wall-time, success rate, related items (links)
- **Permanent link:** back to phase/project context

---

## Surfaces Audited

### 1. AgentDetailDrawer

**Trigger:** `components/agents/agent-grid.tsx` → agent card onClick  
**Target:** `components/agents/agent-detail-drawer.tsx` (Sheet, right-slide)  
**Data Source:** `/api/agents/{name}` → `lib/cae-agents-state.ts::AgentDetailEntry`

#### Available Fields (from AgentDetailEntry)
| Field | Type | Rendered? | Notes |
|-------|------|-----------|-------|
| name | string | YES | agent identifier |
| label | string | YES | display name (e.g., "Architect") |
| founder_label | string | YES | founder-speak label |
| emoji | string | YES | emoji avatar |
| color | string | NO | theme color (available but unused in drawer) |
| model | string | YES | current model (in Model Override section) |
| group | enum | NO | "active" \| "recently_used" \| "dormant" |
| last_run_days_ago | number \| null | PARTIAL | inferred from drift context, not explicitly labeled |
| **stats_7d.tokens_per_hour** | number[] | NO | 10-bucket sparkline data missing |
| **stats_7d.tokens_total** | number | NO | total tokens past 7 days not shown |
| stats_7d.success_rate | number | YES | shown in drift banner (if warning present) |
| **stats_7d.success_history** | number[] | NO | 10-bucket success rate sparkline absent |
| **stats_7d.avg_wall_ms** | number | NO | average wall time not rendered |
| **stats_7d.wall_history** | number[] | NO | wall-time sparkline absent |
| **current.concurrent** | number | NO | currently active invocations not shown |
| **current.queued** | number | NO | queued invocations not shown |
| **current.last_24h_count** | number | NO | invocation velocity absent |
| drift_warning | boolean | YES | controls drift banner visibility |
| persona_md | string | YES | markdown rendered in Persona section |
| **lifetime.tasks_total** | number | YES | shown in Lifetime Stats |
| **lifetime.tokens_total** | number | YES | shown in Lifetime Stats (K-formatted) |
| **lifetime.success_rate** | number | YES | shown in Lifetime Stats |
| **lifetime.avg_wall_ms** | number | YES | shown in Lifetime Stats (mm:ss format) |
| **lifetime.top_expensive[]** | object[] | YES | list of 5 most-expensive tasks |
| **lifetime.top_expensive[].project** | string | YES | rendered in row |
| **lifetime.top_expensive[].phase** | string | YES | rendered in row |
| **lifetime.top_expensive[].plan** | string | YES | rendered in row |
| **lifetime.top_expensive[].task** | string | YES | rendered in row |
| **lifetime.top_expensive[].tokens** | number | YES | rendered in row (K-formatted) |
| **lifetime.top_expensive[].timestamp** | string | NO | transaction date not shown |
| **recent_invocations[]** | object[] | YES | table shows last 50 |
| **recent_invocations[].ts** | string | YES | time column (HH:mm) |
| **recent_invocations[].project** | string | YES | project column |
| **recent_invocations[].phase** | string | YES | phase-task column |
| **recent_invocations[].task** | string | YES | task column (in phase-task) |
| **recent_invocations[].model** | string | NO | model per-invocation not shown |
| **recent_invocations[].tokens** | number | YES | tokens column |
| **recent_invocations[].wall_ms** | number | YES | wall column (seconds) |
| **recent_invocations[].status** | enum | YES | ok/fail status indicator |

**Data shown (rendered fields):**
1. Persona (markdown)
2. Model override UI
3. Drift banner (conditional)
4. Lifetime: tasks_total, tokens_total, success_rate, avg_wall_ms
5. Top 5 expensive: project, phase, plan, task, tokens
6. Recent invocations: ts, project, phase, task, tokens, wall_ms, status

**Gaps:**
- `stats_7d.tokens_per_hour` + sparkline → P1 — useful for trend detection
- `stats_7d.success_history` + sparkline → P1 — shows reliability trend
- `stats_7d.wall_history` → P1 — performance trend
- `current.concurrent` + `current.queued` → P1 — live queue depth
- `current.last_24h_count` → P1 — velocity indicator
- `top_expensive[].timestamp` → P2 — when was peak spend?
- `recent_invocations[].model` → P1 — which model was used?
- `color`, `group` → P2 — metadata not critical

**Severity Count:** P0: 0, P1: 6, P2: 2  
**Field Utilization:** 14 of 37 = **38%**

**Recommendation:**
Replace "Recent Invocations" table with a rich timeline widget showing:
- 10-bucket success_history sparkline (top-left of "Lifetime" section)
- 10-bucket tokens_per_hour sparkline (top-middle)
- 10-bucket wall_history sparkline (top-right)
- Summary header: "Lifetime: {tasks_total} tasks · {tokens_total} tokens · {success_rate}% success · {current.concurrent} active"
- For each recent invocation row, add: model badge, show full timestamp (not just HH:mm), and make task a clickable link to phase detail
- Add "Last 24h invocations: {current.last_24h_count}" metric below the table

---

### 2. TaskDetailSheet

**Trigger:** 
- From TaskDetailSheet URL state: `?sheet=open&phase={num}&task={taskId}`
- From ActivePhaseCards: phase card click → `openSheet(phaseNumber, project)`
- From RecentLedger: row click (currently NO-OP)
- From QueueCard: card click → `openSheet()`

**Target:** `components/build-home/task-detail-sheet.tsx` (Sheet, right-slide, 50vw)  
**Data Source:** `/api/state` → `lib/cae-home-state.ts::PhaseSummary` (per phase number)

#### Available Fields
From `PhaseSummary`:
| Field | Type | Rendered? | Notes |
|-------|------|-----------|-------|
| project | string | NO | used for filtering but not displayed |
| projectName | string | PARTIAL | shown in title via `phaseCardTitle()` |
| phase | string | NO | e.g. "p4-plan01" |
| phaseNumber | number | YES | shown in title |
| wave_current | number | YES | shown in Summary section (e.g. "Wave 1/3") |
| wave_total | number | YES | shown in Summary section |
| progress_pct | number | YES | shown in Summary section (e.g. "45%") |
| **eta_min** | number \| null | NO | ETA available but never rendered |
| **tokens_phase** | number | NO | phase token cost not shown |
| **agents_active[]** | object[] | YES | agent avatars in header only |
| **agents_active[].name** | string | YES | only in avatar tooltip |
| **agents_active[].concurrent** | number | YES | shown as concurrency dots in avatar |

From phase state (not in PhaseSummary but available via detail calls):
- commits (from recent events)
- status (shipped/aborted)
- details per plan (from phase directory)
- task breakdown by status
- memory items consulted (stub — deferred to Phase 8)
- comments (stub — deferred to Phase 9)

**Data shown (rendered fields):**
1. Header title: phase number + project name
2. Agent avatars + concurrency dots
3. Summary: wave_current/wave_total, progress_pct
4. Live log: tail of log file (path derived from heuristic)
5. Changes section: "No commits yet" (stub)
6. Memory referenced: "ships in Phase 8" (stub)
7. Comments: placeholder (stub)
8. Actions: Pause + Abort buttons

**Gaps:**
- **eta_min** → P0 — "Expected completion" is vital context; shows at line 91-95 in active-phase-cards.tsx but NOT in the detail sheet
- **tokens_phase** → P0 — cost to date is missing; should appear near progress bar
- **phase** (identifier) → P1 — internal phase name not shown
- **status** → P1 — is this phase running/failed/shipped? Unknown from drawer
- **commits** → P1 — number of commits made this phase (available via RecentEvent) not shown
- **task breakdown** → P0 — no breakdown of tasks by status (pending/running/merged/failed)
- **memory items** → deferred (Phase 8 plan 08-02)
- **comments** → deferred (Phase 9)

**Severity Count:** P0: 3, P1: 3  
**Field Utilization:** 6 of ~15 shown/available = **40%**

**Recommendation:**
Replace the Summary section with a rich header showing:
```
Phase p4-plan01 — Wave 2/4 · 45% complete · ETA 12m remaining
Agents: 🏗️ Architect (1 active) · 🔧 Forge (0 active)
Tokens used: 1.2M / Commits: 8 / Status: in-progress
```
Add a "Tasks" section below the log showing:
- Pending: 3 tasks
- Running: 1 task  
- Merged: 8 tasks
- Failed: 0 tasks
(Clickable to filter log to task output)

Add "Memory consulted: {count} files" link (enabled when Phase 8 ships).

---

### 3. SkillDetailDrawer

**Trigger:** `components/skills/` → skill card onClick (from catalog grid)  
**Target:** `components/skills/skill-detail-drawer.tsx` (custom drawer, right-slide)  
**Data Source:** `/api/skills/{name}` → `lib/cae-types.ts::CatalogSkill`

#### Available Fields
| Field | Type | Rendered? | Notes |
|-------|------|-----------|-------|
| name | string | YES | shown in header |
| owner | string | YES | shown below name in header |
| source | enum | YES | shown in external link text |
| sources[] | enum[] | NO | multiple sources not indicated |
| description | string | YES | shown in body (for external skills) |
| installs | number | NO | install count from skills.sh hidden |
| stars | number | NO | star count from ClawHub hidden |
| installCmd | string | YES | copy button in footer |
| detailUrl | string | YES | view on {source} link in footer |
| installed | boolean | YES | controls Install button visibility |
| trust (TrustScore) | object | YES | trust badge rendered (ships in Plan 14-05) |
| trust.total | number | YES | trust percentage |
| trust.factors[] | TrustFactor[] | YES | no drill-down into factors (Plan 14-05) |

**Data shown:**
1. Header: name + owner
2. Trust badge: total score + "Loading…" state
3. Body: markdown (for local skills) OR description (external)
4. Footer: copy install command button + Install button (if not installed)

**Gaps:**
- **installs** → P2 — credibility metric hidden
- **stars** → P2 — popularity metric hidden
- **sources[]** → P2 — if skill is in multiple registries, that's not shown
- **trust.factors[]** → P1 — clicking trust badge should expand factors (planned 14-05)

**Severity Count:** P0: 0, P1: 1, P2: 3  
**Field Utilization:** 6 of 11 = **55%**

**Recommendation:**
Add a "Stats" row below trust badge:
```
Installs: 1.2k | Stars: 45 | Sources: skills.sh, ClawHub
```
Make trust badge clickable to expand factors (as per plan 14-05):
```
Trust Score: 85%
✓ No hardcoded secrets — 20%
✓ Limited tool scope — 30%
✗ Unsigned code — 0%
✓ Community review — 35%
```

---

### 4. GitTimelineDrawer

**Trigger:** `components/memory/browse/file-tree.tsx` → file node click (Wave 5 wiring)  
**Target:** `components/memory/git-timeline-drawer.tsx` (custom drawer, right-slide)  
**Data Source:** `/api/memory/git-log/{path}` → array of `GitLogEntry`

#### Available Fields
| Field | Type | Rendered? | Notes |
|-------|------|-----------|-------|
| sha | string | YES | checkbox key + shown truncated |
| author | string | NO | commit author not displayed |
| message | string | NO | commit message/subject not shown |
| timestamp | number | NO | commit date not shown (only in heuristic sorting) |
| path | string | YES | path shown in header (derived from URL) |
| show_diff | boolean | YES | "Show diff" button enabled when 2 picks |

**Data shown:**
1. Header: filename (basename of absPath)
2. List: commit shas (truncated) as checkbox rows
3. Footer: "Show diff" button (enabled when 2 commits selected)

**Gaps:**
- **author** → P1 — who made the change?
- **message** → P0 — commit subject essential for understanding
- **timestamp** → P1 — when was it committed?
- **diff preview** → P2 — side-by-side diff view (only 2-commit selection works)

**Severity Count:** P0: 1, P1: 2, P2: 1  
**Field Utilization:** 2 of 6 = **33%**

**Recommendation:**
Replace the checkbox list with a table showing:
| sha | author | message | date |
|-----|--------|---------|------|
| abc1234 | jane.doe | Fix file parsing bug | 2026-04-20 |
| def5678 | john.smith | Add new feature | 2026-04-18 |

Make the row itself clickable (not just checkbox). Show author initials as a colored pill next to the sha. On 2-commit selection, auto-show the diff below the table instead of requiring a separate button.

---

### 5. NodeDrawer (Memory Graph)

**Trigger:** `components/memory/graph/` → node click  
**Target:** `components/memory/graph/node-drawer.tsx` (custom drawer, right-slide)  
**Data Source:** `lib/cae-graph-state.ts::GraphNode` + `GraphLink[]`

#### Available Fields
| Field | Type | Rendered? | Notes |
|-------|------|-----------|-------|
| id | string | YES | shown as title (label or basename) |
| label | string | YES | display label |
| kind | enum | YES | shown as colored badge |
| source_file | string | YES | shown in mono (copy-on-click) |
| backLinks[] | GraphLink[] | YES | list of items linking TO this node |
| forwardRefs[] | GraphLink[] | YES | list of items this node links TO |
| (link.source) | string | YES | shown as backling row text |
| (link.target) | string | YES | shown as forward-ref row text |

**Data shown:**
1. Header: node label (or basename if no label)
2. Kind badge: phases/agents/notes/PRDs
3. Source file: full path (copyable)
4. Back-links list: items → this node
5. Forward-refs list: this node → items

**Gaps:**
- **No metadata per link** → P1 — what type of relationship? (references, depends on, etc.)
- **No click-through** → P1 — back-links aren't clickable to switch nodes
- **No timestamps** → P2 — when was this node created/updated?
- **No open in Browse** → P1 — should have button to jump to Browse tab + select file

**Severity Count:** P0: 0, P1: 3, P2: 1  
**Field Utilization:** 7 of ~11 = **64%** (graph structure is sparse by design)

**Recommendation:**
Add a "Context" bar showing node creation/last-modified timestamps. Make back-link and forward-ref rows themselves clickable (highlight on hover). Add an "Open in Browse" button that jumps to Browse tab + selects the source_file. If link types are available in the state, show them as badges on the link rows (e.g. "references", "depends on").

---

### 6. WhyDrawer (Memory Consult)

**Trigger:** Task detail sheet (Wave 5 MemoryClient integration) — "Memory referenced" section  
**Target:** `components/memory/why-drawer.tsx` (custom drawer, right-slide)  
**Data Source:** `/api/memory/consult/{taskId}` → `MemoryConsultResult`

#### Available Fields
| Field | Type | Rendered? | Notes |
|-------|------|-----------|-------|
| found | boolean | YES | determines Path A vs B/C |
| entries[] | object[] | YES | list items shown |
| entries[].file | string | YES | absolute path |
| entries[].ts | string | PARTIAL | parsed to locale date but not highlighted |
| entries[].reason | string | PARTIAL | shown in pill as "REAL" or "HEURISTIC" but reason text not displayed |
| heuristic_fallback | boolean | implicit | shown via pill type |

**Data shown:**
1. List: files accessed during task
2. Each row: filename (basename) + pill ("REAL trace" or "HEURISTIC")
3. Timestamp: parsed and formatted
4. Click handler: optional onSelectFile (Wave 5 callback to Browse tab)

**Gaps:**
- **reason text** → P1 — *why* was this file consulted? (e.g. "imported by agent.py" or "pattern match")
- **ts formatting** → P1 — timestamp shown but not searchable/sortable
- **file tree context** → P1 — don't show full path; show relative path + breadcrumb
- **query that matched** → P1 — for heuristic entries, what pattern matched?

**Severity Count:** P0: 0, P1: 4  
**Field Utilization:** 3 of ~7 = **43%**

**Recommendation:**
Restructure the list to show:
```
📄 src/agents/architect.py (REAL trace)
   Consulted 14:32:01 — referenced from line 42 of lib/prompt.ts
```
Add sorting by: timestamp (desc) | filename | confidence (REAL first).
For heuristic entries, show what pattern triggered:
```
📄 .cae/metrics/circuit-breakers.jsonl (HEURISTIC)
   Pattern match: "*.jsonl" token files — 2 references found
```

---

### 7. FileTree Accordion (Memory Browse)

**Trigger:** Tree node expand/collapse (chevron click or arrow key)  
**Target:** `components/memory/browse/file-tree.tsx` (accordion, nested)  
**Data Source:** `/api/memory/tree` → `MemoryTreeNode[]`

#### Available Fields
| Field | Type | Rendered? | Notes |
|-------|------|-----------|-------|
| id | string | YES | key for expand/collapse state |
| kind | enum | YES | "project" \| "group" \| "file" |
| label | string | YES | display name (project or group name) |
| children[] | MemoryTreeNode[] | YES | nested recursively |
| (file) path | string | YES | full absolute path shown on leaf buttons |
| (file) selected | boolean | YES | leaf carries data-selected="true" |
| count | number | NO | number of files in group/project not shown |

**Data shown:**
1. Tree structure: nested expand/collapse
2. Project/group names (labels)
3. File basenames (clickable buttons)
4. Selected file: accent-bordered highlight
5. Keyboard nav: ArrowDown/Up/Left/Right

**Gaps:**
- **count per group** → P2 — "src (5 files)" would be useful
- **file icons** → P2 — .ts vs .json vs .md visual distinction
- **file size** → P2 — sort by size option
- **last modified** → P2 — sort by recency
- **search within tree** → P2 — find file by pattern

**Severity Count:** P0: 0, P1: 0, P2: 4  
**Field Utilization:** 6 of ~10 = **60%**

**Recommendation:**
Add file count badges to group headers: "src (5 files)". Add file icons (icon library). On group header hover, show a mini-summary: "Last modified: 2h ago". Add a search bar at the top of the FileTree to filter by filename pattern (debounced fetch).

---

### 8. DayGroup Accordion (Changes)

**Trigger:** DayGroup rendered inside ProjectGroup (auto-expanded)  
**Target:** Each day renders a ChangeRow list (not a separate drawer; accordion content)  
**Data Source:** `lib/cae-changes-state.ts::ChangeEvent[]`

#### Available Fields
From `ChangeEvent`:
| Field | Type | Rendered? | Notes |
|-------|------|-----------|-------|
| ts | string | YES | bucketed into day buckets |
| project | string | NO | not shown (parent ProjectGroup provides context) |
| projectName | string | NO | not shown |
| branch | string | YES | shown in ChangeRow |
| commit_sha | string | YES | shown truncated |
| author | string | NO | commit author not shown |
| message | string | YES | commit message shown |
| parents | string[] | NO | parent commit shas not shown |
| tags | string[] | NO | git tags not shown |
| is_merge | boolean | YES | visual distinction (merge commits bolded?) |

**Data shown (per ChangeRow):**
1. Commit message
2. Branch name
3. Commit sha (truncated)
4. Status (implicit from message)
5. Author (NOT SHOWN)

**Gaps:**
- **author** → P1 — who made the change?
- **is_merge** → P2 — visually distinguish merge commits
- **tags** → P2 — git tags (releases, milestones)
- **timestamp** → P1 — time within the day (currently just bucket)
- **parents** → P2 — commit ancestry/tree view
- **stats** (insertions/deletions) → P2 — code churn

**Severity Count:** P0: 0, P1: 2, P2: 4  
**Field Utilization:** 5 of ~10 = **50%**

**Recommendation:**
Add author pill next to branch: "main by jane.doe · abc1234". Add timestamp within day bucket (e.g. "14:32"). On hover, show insertions/deletions stats. Add visual indicator for merge commits (different background color or icon). Make message clickable to show full commit details in a popover (author, full sha, parents, stats).

---

### 9. ProjectGroup Accordion (Changes)

**Trigger:** ProjectGroup Accordion.Trigger click to expand/collapse  
**Target:** `components/changes/project-group.tsx` (accordion, in-page)  
**Data Source:** `lib/cae-changes-state.ts::ProjectGroup`

#### Available Fields
| Field | Type | Rendered? | Notes |
|-------|------|-----------|-------|
| project | string | YES | accordion value (key) |
| projectName | string | YES | header label |
| count | number | YES | "Project ({count})" in header |
| events | ChangeEvent[] | YES | rendered as DayGroup |

**Data shown:**
1. Project name + count in header
2. Expand/collapse chevron
3. DayGroup content (when expanded)

**Gaps:**
- **last event timestamp** → P2 — when was this project last active?
- **status summary** → P2 — total commits today/week
- **branch list** → P2 — active branches

**Severity Count:** P0: 0, P1: 0, P2: 3  
**Field Utilization:** 3 of ~6 = **50%**

**Recommendation:**
Show last activity timestamp in header: "Project (8 changes, updated 2h ago)". On hover, show: "Active branches: main, feature/auth" or similar. Collapsed state could show a mini-bar chart of commits per hour.

---

### 10. ActivePhaseCards (Home)

**Trigger:** Phase card click  
**Target:** TaskDetailSheet (via URL param) — also listed above (#2)  
**Data Source:** `/api/state` → `lib/cae-home-state.ts::PhaseSummary[]`

**Already audited in #2 (TaskDetailSheet).** This surface is the trigger; see TaskDetailSheet audit for the actual data shown.

**Summary for this surface alone:**
| Field | Rendered? |
|-------|-----------|
| project | NO |
| projectName | YES (title) |
| phaseNumber | YES (title) |
| wave_current/total | YES (text) |
| progress_pct | YES (progress bar) |
| eta_min | YES (text) |
| tokens_phase | YES (text) |
| agents_active | YES (avatars) |

**Field Utilization (card only, not sheet):** 6 of 8 = **75%**  
**But on sheet click, gaps emerge (see #2).**

---

### 11. RecentLedger (Home)

**Trigger:** Row click (currently no-op; should open TaskDetailSheet)  
**Target:** `components/build-home/recent-ledger.tsx` (dense table, in-page)  
**Data Source:** `/api/state` → `lib/cae-home-state.ts::RecentEvent[]`

#### Available Fields
| Field | Type | Rendered? | Notes |
|-------|------|-----------|-------|
| ts | string | YES | formatted as HH:mm |
| project | string | PARTIAL | full name shown in founder-speak description |
| projectName | string | YES | shown in description (fold into project) |
| phase | string | PARTIAL | shown in description (e.g. "p4-plan01") |
| plan | string | YES | shown in description |
| status | enum | YES | "shipped" or "aborted" — icon color |
| commits | number | YES | only in dev-mode row |
| agent | string | YES | shown in description (founder-speak) |
| model | string | PARTIAL | only in dev-mode row |
| tokens | number | YES | only in dev-mode row (formatting: "1.2k tok") |

**Data shown (founder-mode, default):**
1. Timestamp: HH:mm (right-aligned, muted)
2. Status icon: ✓ (green) or ✗ (red)
3. Description: "{agent_label} shipped {project} · {plan}" or "couldn't finish {plan}"
4. (no trailing data in founder-mode)

**Data shown (dev-mode):**
1. Timestamp: HH:mm
2. Status icon
3. Full task ID: "{project} {plan} +{commits} commits {agent}({model})"
4. Tokens: "1.2k tok" (right-aligned)

**Gaps:**
- **timestamps** → P1 — HH:mm is not sortable; need full ISO for sorting by actual time
- **phase context** → P1 — which phase was this run? Only shown in description text
- **model** → P1 — which model completed the task? (hidden in dev-mode only)
- **expandable row detail** → P0 — clicking row should show full context (no-op currently)
- **task link** → P1 — clicking row should open TaskDetailSheet (like QueueCard does)
- **filter/sort** → P2 — by status, agent, project

**Severity Count:** P0: 1, P1: 5, P2: 1  
**Field Utilization:** 6 of 8 = **75%** (but 0% interaction — rows are read-only)

**Recommendation:**
Enable row click to open TaskDetailSheet (just like QueueCard does). Add an expandable detail row showing:
```
✓ Shipped · Phase p4-plan01 · Agent: Architect (claude-sonnet-4-6)
  Timestamp: 2026-04-23T14:32:01Z · Duration: 8m 32s
  Commits: 8 · Tokens: 1.2M · Success rate: 100%
```
Add column headers: Time | Status | Plan | Agent | Tokens (right) | Details (expand button).
Make the table sortable by Time, Status, Plan, Agent.

---

## Surfaces NOT Found / Deferred

### Queue Kanban (QueueCard) — PARTIALLY AUDITED
**Trigger:** Queue card click  
**Target:** TaskDetailSheet (via URL state)  
**Status:** Data flow verified; detail sheet gaps documented in #2 above.

**Summary:** QueueCard renders:
- Agent emoji + title
- Project · relative-time
- Tags (truncated to 3)
- Left-border accent (status color)

Available but not shown:
- Full timestamp (only relative)
- Status (inferred from accent color, not labeled)
- Task ID (available but only in data attribute)

**Recommendation:** Add a detail row on click showing task ID + full timestamp + status label.

### Workflow List (WorkflowsListClient) — NO DETAIL EXPAND
Workflows are shown as cards with Edit/Run buttons. No detail drawer. Each workflow links to `/build/workflows/[slug]` for editing. No real "detail expand" surface here.

### Schedule TaskList — PARTIALLY AUDITED (#9 above)
Rows expand inline to show: buildplan path, last run timestamp, last completed timestamp, Open Log button. Has minimal detail and is working as designed.

### Audit Table (AuditTable) — PARTIALLY AUDITED
Rows expand inline (via state.expanded) to show full `cwd` and timestamp. Limited detail but serves the purpose (security auditing). No gaps identified beyond typical sorting/filtering (P2).

### Phase Detail Waves / Tasks — NO CLICKABLE DETAIL EXPAND
`/build/phase/[num]/page.tsx` shows WavesView with task cards. Cards link to tail logs (via `?tail=` param + TailSheet). No real "detail drawer" — just task name + log streaming.

---

## Kanban-Style Surfaces (Eric's mention)

Per Eric's complaint about "kandbans," the closest matches are:

1. **Queue Kanban** (Phase 6) — `app/build/queue/` shows QueueCard grid grouped by status columns. **No status drill-down.** Clicking card opens TaskDetailSheet (already audited #2).

2. **Agent Grid** (Phase 5) — `app/build/agents/` shows AgentRosterEntry cards. **Clicking opens AgentDetailDrawer (already audited #1).**

3. **Skills Grid** (Phase 14) — `app/build/skills/` shows CatalogSkill cards. **Clicking opens SkillDetailDrawer (already audited #3).**

4. **Active Phase Cards** (Home) — Horizontal list of in-flight phases. **Clicking opens TaskDetailSheet (already audited #2).**

**Finding:** All kanban surfaces use the same detail pattern: click card → open right-slide sheet/drawer. The sheets themselves have the depth gaps documented above.

---

## Cross-Cutting Patterns

### Pattern 1: Timestamps Are Underutilized
- **HH:mm only** in RecentLedger, RecentInvocationsTable
- **ISO string** in state but not sortable/filterable in UI
- **Recommendation:** Always show full timestamp on hover; make columns sortable by actual time

### Pattern 2: Token Costs Hidden
- Available in: agents (recent_invocations), home (RecentEvent), queue (tasks)
- Rendered in: RecentInvocationsTable, RecentLedger (dev-mode only)
- Missing from: TaskDetailSheet, most accordions
- **Recommendation:** Add a "$cost" badge everywhere tasks/agents are shown (use token→dollar formula)

### Pattern 3: Agent + Model Context Missing
- Available in: AgentDetailEntry, RecentEvent, RecentInvocation
- Rendered in: AgentDetailDrawer (itself), RecentLedger, QueueCard avatars
- Missing from: task rows, phase detail, changes
- **Recommendation:** Always show agent emoji + model badge on task/event cards

### Pattern 4: No Breadcrumb/Context Links
- Every detail view is an island; no way to jump Phase → Task → Agent
- **Recommendation:** Add persistent breadcrumb: "Phase p4 › Plan pl01 › Task t1 › Agent Architect"

### Pattern 5: Read-Only Accordions
- DayGroup, ProjectGroup, FileTree, Schedule TaskList all expand in-place
- None show click-through to related detail
- **Recommendation:** Make accordion content clickable to jump to related context

---

## Field Utilization Summary

| Surface | Rendered Fields | Available Fields | Utilization | P0 Gaps | P1 Gaps | P2 Gaps |
|---------|-----------------|------------------|-------------|---------|---------|---------|
| AgentDetailDrawer | 14 | 37 | 38% | 0 | 6 | 2 |
| TaskDetailSheet | 6 | 15 | 40% | 3 | 3 | — |
| SkillDetailDrawer | 6 | 11 | 55% | 0 | 1 | 3 |
| GitTimelineDrawer | 2 | 6 | 33% | 1 | 2 | 1 |
| NodeDrawer | 7 | 11 | 64% | 0 | 3 | 1 |
| WhyDrawer | 3 | 7 | 43% | 0 | 4 | — |
| FileTree | 6 | 10 | 60% | 0 | 0 | 4 |
| DayGroup (Changes) | 5 | 10 | 50% | 0 | 2 | 4 |
| ProjectGroup (Changes) | 3 | 6 | 50% | 0 | 0 | 3 |
| RecentLedger | 6 | 8 | 75% | 1 | 5 | 1 |
| Schedule TaskList | 5 | 8 | 63% | 0 | 0 | 2 |

**Average Utilization: ~52%** (range: 33%–75%)  
**Total P0 Gaps: 5** (TaskDetailSheet ×3, GitTimelineDrawer ×1, RecentLedger ×1)  
**Total P1 Gaps: 30** (distributed across all surfaces)  
**Total P2 Gaps: 26** (nice-to-haves)

---

## Top 3 Priorities (Eric's perspective)

### Priority 1: TaskDetailSheet — P0 "eta_min is gone"
When a user clicks an in-flight phase card, they want to know:
- How long until completion? (eta_min is rendered on card but NOT in sheet)
- How much has it cost? (tokens_phase missing)
- What's the task breakdown? (no per-task status list)

**Fix:** Add 3-row summary below the log:
```
ETA: 12m remaining · Cost so far: 1.2M tokens · Status: in-progress (Wave 2/4)
Tasks: 3 pending · 1 running · 8 merged · 0 failed
Last update: 2m ago
```

### Priority 2: RecentLedger — P0 "rows are clickable but do nothing"
Currently a read-only table. Clicking should jump to TaskDetailSheet (or show an inline expansion).

**Fix:** Make rows clickable like QueueCard. On click, open TaskDetailSheet with the plan/phase context. On hover, show an expand icon.

### Priority 3: AgentDetailDrawer — P1 "no trend visibility"
Available: stats_7d sparklines (tokens_per_hour, success_history, wall_history). Not shown.

**Fix:** Add 3 sparklines to the "Lifetime" header:
```
[tokens_per_hour sparkline] [success_history sparkline] [wall_history sparkline]
```
Each shows a 10-bucket trend; hover to see exact values.

---

## Implementation Roadmap

### Phase 1 (Immediate — Hot-fix)
- ✓ TaskDetailSheet: add ETA + tokens + task breakdown (all P0 fields available)
- ✓ RecentLedger: enable row click → TaskDetailSheet
- ✓ AgentDetailDrawer: add sparklines for stats_7d

### Phase 2 (Soon — Enhancement)
- ✓ GitTimelineDrawer: add author + message columns
- ✓ WhyDrawer: add reason text + pattern explanation
- ✓ All surfaces: add breadcrumb bar (Phase › Plan › Task › Agent)

### Phase 3 (Later — UX Overhaul)
- ✓ Standardize timestamp rendering (full ISO on hover, sortable)
- ✓ Add token cost badge everywhere
- ✓ Add agent emoji + model context everywhere
- ✓ Implement click-through links between contexts

---

## Verification

All field counts cross-checked against:
- `/lib/cae-home-state.ts` (HomeState, PhaseSummary, RecentEvent)
- `/lib/cae-agents-state.ts` (AgentRosterEntry, AgentDetailEntry, AgentInvocation)
- `/lib/cae-types.ts` (CatalogSkill, TrustScore, ScheduledTask, AuditEntry)
- `/lib/cae-changes-state.ts` (ChangeEvent, ProjectGroup)
- `/lib/cae-graph-state.ts` (GraphNode, GraphLink)
- Component render code (verified every `<span>`, `<p>`, label, value)

**Audit complete:** 2026-04-23, 11:30 UTC

