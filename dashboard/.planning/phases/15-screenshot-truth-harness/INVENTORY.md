# CAE Dashboard FE Inventory

**Last Updated:** 2026-04-23  
**Scope:** Next.js 16 + React 19 + base-ui + Tailwind dashboard  
**Project Root:** `/home/cae/ctrl-alt-elite/dashboard`

---

## 1. Route Map

### / — Root & Authentication
| URL | File | Auth | Type | Description |
|-----|------|------|------|-------------|
| / | `app/page.tsx` | Yes (redirect) | Server | Redirects to /build or /plan based on mode cookie |
| /signin | `app/signin/page.tsx` | No | Server | Login page with GitHub + Google OAuth buttons |
| /403 | `app/403/page.tsx` | — | Server | Forbidden (no admin/operator role) |

### /build/* — Build Mode (8 Main Tabs)
| URL | File | Auth | Type | Description |
|-----|------|------|------|-------------|
| /build | `app/build/page.tsx` | Yes | Server | Home: rollup strip, live ops, active phases, needs-you list, recent ledger |
| /build/agents | `app/build/agents/page.tsx` | Yes | Server | Agent roster grid + detail drawer (?agent={name}) |
| /build/workflows | `app/build/workflows/page.tsx` | Yes | Server | Workflow list with run/edit buttons |
| /build/workflows/new | `app/build/workflows/new/page.tsx` | Yes | Server | Create workflow form (WorkflowForm in create mode) |
| /build/workflows/[slug] | `app/build/workflows/[slug]/page.tsx` | Yes | Server | Edit workflow form (WorkflowForm in edit mode) |
| /build/queue | `app/build/queue/page.tsx` | Yes | Server | Queue depth, active + pending tasks by status |
| /build/skills | `app/build/skills/page.tsx` | Yes | Server | Skill catalog grid with install buttons |
| /build/skills/[name] | `app/build/skills/[name]/page.tsx` | Yes | Server | Skill detail (description, installation status) |
| /build/skills/installed | `app/build/skills/installed/page.tsx` | Yes | Server | Installed skills list |
| /build/schedule | `app/build/schedule/page.tsx` | Yes | Server | Scheduled tasks (cron + next-run) |
| /build/schedule/new | `app/build/schedule/new/page.tsx` | Yes | Server | Create scheduled task form |
| /build/phase/[num] | `app/build/phase/[num]/page.tsx` | Yes | Server | Phase detail: waves, tasks, tail logs |
| /build/changes | `app/build/changes/page.tsx` | Yes | Server | Change log grouped by project/day |
| /build/security | `app/build/security/page.tsx` | Yes | Server | Security dashboard: trust overview, scans, secrets |
| /build/security/audit | `app/build/security/audit/page.tsx` | Yes (Operator) | Server | Audit log (full event history, role-restricted) |
| /build/security/secrets | `app/build/security/secrets/page.tsx` | Yes | Server | Secrets report (redacted keys, metadata) |
| /build/security/skills | `app/build/security/skills/page.tsx` | Yes | Server | Skill security status (trust scores, scans) |
| /build/admin/roles | `app/build/admin/roles/page.tsx` | Yes (Admin) | Server | Role management UI (admin-only) |

### /plan/* — Plan Mode (Stub)
| URL | File | Auth | Type | Description |
|-----|------|------|------|-------------|
| /plan | `app/plan/page.tsx` | Yes | Server | Stub: "Coming soon" with Projects/PRDs/Roadmaps/UAT tabs (inactive) |

### /metrics, /memory, /floor, /chat — Global Panels
| URL | File | Auth | Type | Description |
|-----|------|------|------|-------------|
| /metrics | `app/metrics/page.tsx` | Yes | Server | Golden signals: success gauge, speed panel, spending, retry heatmap, per-agent wall, top-expensive tasks |
| /memory | `app/memory/page.tsx` | Yes | Server | Graph canvas + three tabs: Browse (file tree), Graph (node editor), Diff (git timeline) |
| /floor | `app/floor/page.tsx` | Yes | Server | Live agent floor: canvas + legend + toolbar, project-scoped via searchParams |
| /floor/popout | `app/floor/popout/page.tsx` | Yes | Server | Full-screen floor (h-screen, no top-nav) |
| /chat | `app/chat/page.tsx` | Yes | Server | 50/50 split layout: ConversationHistory left, ChatPanel right |

**Auth Pattern:**
- Middleware.ts guards all routes except `/` + `/signin` + `/403`
- Routes starting `/build/admin`, `/api/admin` require **admin** role
- `/build/security/audit` + `/api/security/*` require **operator** role
- `/api/queue/delegate`, `/api/workflows/*/run`, `/api/schedule/*`, `/api/skills/install` require **operator** role
- Scope: `viewer` < `operator` < `admin` (checked via `isAtLeast()` in lib/cae-rbac.ts)

---

## 2. Component Inventory

### UI Foundation (base-ui + primitives)
| Component | File | Purpose |
|-----------|------|---------|
| Button | `components/ui/button.tsx` | Action + nav + toggle button (tailwind className variant) |
| Badge | `components/ui/badge.tsx` | Status badge (pill-shaped, color-coded) |
| Card | `components/ui/card.tsx` | Container (border, padding, shadow) |
| Sheet | `components/ui/sheet.tsx` | Right-slide drawer (wraps base-ui Dialog) |
| Dialog | `components/ui/dialog.tsx` | Modal dialog (base-ui Dialog primitive) |
| Tabs | `components/ui/tabs.tsx` | Tab switcher (base-ui Tabs) |
| DropdownMenu | `components/ui/dropdown-menu.tsx` | Click menu (base-ui Popup) |
| Table | `components/ui/table.tsx` | Data table HTML elements |
| ScrollArea | `components/ui/scroll-area.tsx` | Scrollable container |
| Input | `components/ui/input.tsx` | Text input |
| Textarea | `components/ui/textarea.tsx` | Multi-line text input |
| Label | `components/ui/label.tsx` | Form label |
| Avatar | `components/ui/avatar.tsx` | User/agent avatar circle |
| Separator | `components/ui/separator.tsx` | Visual divider |
| Panel | `components/ui/panel.tsx` | Card-like panel container |
| EmptyState | `components/ui/empty-state.tsx` | Empty state + CTA (icon + heading + body + actions) |
| Sparkline | `components/ui/sparkline.tsx` | Tiny line chart |
| LastUpdated | `components/ui/last-updated.tsx` | "Updated 2m ago" timestamp |
| ShortcutOverlay | `components/ui/shortcut-overlay.tsx` | Keyboard shortcut help modal |
| ExplainTooltip | `components/ui/explain-tooltip.tsx` | ? icon → tooltip popover |
| Sonner | `components/ui/sonner.tsx` | Toast notifications (Sonner library) |

### Shell Components (Layout & Navigation)
| Component | File | Purpose |
|-----------|------|---------|
| TopNav | `components/shell/top-nav.tsx` | 40px sticky header: CAE logo, mode toggle, cost ticker, icons (floor, memory, metrics, chat), heartbeat, liveness, dev badge, user menu |
| BuildRail | `components/shell/build-rail.tsx` | 48px left icon-rail for /build/*: Home, Agents, Workflows, Queue, Skills, Schedules, Security, Changes |
| BuildHomeHeading | `components/shell/build-home-heading.tsx` | /build page title |
| PhaseDetailHeading | `components/shell/phase-detail-heading.tsx` | /build/phase/[num] page title |
| PlanHomeHeading | `components/shell/plan-home-heading.tsx` | /plan page title (stub) |
| BuildQueueHeading | `components/shell/build-queue-heading.tsx` | /build/queue page title |
| ModeToggle | `components/shell/mode-toggle.tsx` | Build ↔ Plan mode switcher (button + cookie write) |
| UserMenu | `components/shell/user-menu.tsx` | User profile + sign-out dropdown |
| CostTicker | `components/shell/cost-ticker.tsx` | Token spend rolling display |
| FloorIcon | `components/shell/floor-icon.tsx` | /floor nav button (top-nav) |
| MemoryIcon | `components/shell/memory-icon.tsx` | /memory nav button (top-nav) |
| MetricsIcon | `components/shell/metrics-icon.tsx` | /metrics nav button (top-nav) |
| ChatPopOutIcon | `components/shell/chat-pop-out-icon.tsx` | /chat pop-out button (top-nav) |
| HeartbeatDot | `components/shell/heartbeat-dot.tsx` | Pulsing liveness indicator |
| AmbientClock | `components/shell/ambient-clock.tsx` | Current time display |
| LivenessChip | `components/shell/liveness-chip.tsx` | "X active" + dot status chip |
| DevBadge | `components/shell/dev-badge.tsx` | "DEV" badge when dev mode enabled |
| AlertBanner | `components/shell/alert-banner.tsx` | Top alert (e.g., "incident detected") |
| IncidentStream | `components/shell/incident-stream.tsx` | Real-time incident list panel |
| DebugBreadcrumbPanel | `components/shell/debug-breadcrumb-panel.tsx` | Debug panel: breadcrumb trail + state snapshots |

### Build Home Components
| Component | File | Purpose |
|-----------|------|---------|
| RollupStrip | `components/build-home/rollup-strip.tsx` | Summary stats: tasks (done/blocked/active), agents (active/idle) |
| LiveOpsLine | `components/build-home/live-ops-line.tsx` | Real-time events ticker (live stream text updates) |
| ActivePhaseCards | `components/build-home/active-phase-cards.tsx` | Row of 3-4 active phase cards (current waves + progress) |
| NeedsYouList | `components/build-home/needs-you-list.tsx` | Clickable rows: blocked tasks + failing agents + missed SLAs |
| RecentLedger | `components/build-home/recent-ledger.tsx` | Recent builds/deploys table with timestamp + status |
| TaskDetailSheet | `components/build-home/task-detail-sheet.tsx` | Right-slide sheet (?sheet=open&phase=X&task=Y): title, agents involved, live log, pause/abort buttons |
| SheetLiveLog | `components/build-home/sheet-live-log.tsx` | Live log tail inside task detail sheet |
| SheetActions | `components/build-home/sheet-actions.tsx` | Pause + Abort buttons in task detail sheet |
| AgentAvatars | `components/build-home/agent-avatars.tsx` | Avatar cluster display (stacked circles) |

### Agent Components
| Component | File | Purpose |
|-----------|------|---------|
| AgentGrid | `components/agents/agent-grid.tsx` | Responsive grid of AgentCards |
| AgentCard | `components/agents/agent-card.tsx` | Single agent card: emoji, name, model, stats (7d tokens, success rate, wall time), status (concurrent/queued) |
| AgentDetailDrawer | `components/agents/agent-detail-drawer.tsx` | Right-slide sheet (?agent={name}): persona, model override, drift banner, lifetime stats, recent invocations table |
| PersonaMarkdown | `components/agents/persona-markdown.tsx` | Markdown render of agent persona (system prompt) |
| ModelOverride | `components/agents/model-override.tsx` | Model dropdown selector for agent |
| DriftBanner | `components/agents/drift-banner.tsx` | Yellow alert: "Agent has drifted from spec" |
| LifetimeStats | `components/agents/lifetime-stats.tsx` | Lifetime metrics: total tasks, tokens, success rate, avg wall time |
| RecentInvocationsTable | `components/agents/recent-invocations-table.tsx` | Last 50 invocations table (ts, project, phase, task, model, tokens, wall_ms, status) |
| AgentsPageHeading | `components/agents/agents-page-heading.tsx` | /build/agents page title |

### Metrics Components
| Component | File | Purpose |
|-----------|------|---------|
| SuccessGauge | `components/metrics/success-gauge.tsx` | Radial gauge: % success rate |
| SpeedPanel | `components/metrics/speed-panel.tsx` | Avg wall time + histogram |
| SpendingPanel | `components/metrics/spending-panel.tsx` | Spending breakdown (last 7d) |
| SpendingDailyLine | `components/metrics/spending-daily-line.tsx` | Daily spending line chart |
| RetryHeatmap | `components/metrics/retry-heatmap.tsx` | 2D heatmap: agents × retry count |
| TopExpensiveTasks | `components/metrics/top-expensive-tasks.tsx` | Table: top 10 tasks by token cost |
| PerAgentWallTable | `components/metrics/per-agent-wall-table.tsx` | Wall time per agent (sortable) |
| QueueDepthDisplay | `components/metrics/queue-depth-display.tsx` | Current queue depth + trend |
| TimeToMergeHistogram | `components/metrics/time-to-merge-histogram.tsx` | Distribution: time from task start to merge |
| AgentStackedBar | `components/metrics/agent-stacked-bar.tsx` | Stacked bar: agent token allocation |
| ReliabilityPanel | `components/metrics/reliability-panel.tsx` | Uptime % + incident count |
| HaltEventsLog | `components/metrics/halt-events-log.tsx` | Recent halt events table |
| SentinelRejectTrend | `components/metrics/sentinel-reject-trend.tsx` | Trend: policy rejections over time |
| EstDisclaimer | `components/metrics/est-disclaimer.tsx` | "These are estimates" badge |
| GoldenSignalsSubtitles | `components/metrics/golden-signals-subtitles.tsx` | Explanatory text under each metric |

### Memory (Graph & Browse) Components
| Component | File | Purpose |
|-----------|------|---------|
| MemoryClient | `app/memory/memory-client.tsx` (via /memory) | Client root: mounts graph + browse tabs |
| GraphPane | `components/memory/graph/graph-pane.tsx` | Tab 1: canvas + filters + node drawer |
| GraphCanvas | `components/memory/graph/graph-canvas.tsx` | Interactive graph visualization (Cytoscape or similar) |
| GraphFilters | `components/memory/graph/graph-filters.tsx` | Filter UI: node type, label, time range |
| NodeDrawer | `components/memory/graph/node-drawer.tsx` | Right drawer: selected node detail (metadata, relationships) |
| RegenerateButton | `components/memory/graph/regenerate-button.tsx` | Re-index graph button |
| BrowsePane | `components/memory/browse/browse-pane.tsx` | Tab 2: file tree + markdown view |
| FileTree | `components/memory/browse/file-tree.tsx` | Collapsible file tree (files under .planning/) |
| MarkdownView | `components/memory/browse/markdown-view.tsx` | Render markdown file content |
| SearchBar | `components/memory/browse/search-bar.tsx` | Full-text search input |
| SearchResults | `components/memory/browse/search-results.tsx` | Results list + snippet preview |
| DiffView | `components/memory/diff-view.tsx` | Tab 3: git diff (before/after) |
| GitTimelineDrawer | `components/memory/git-timeline-drawer.tsx` | Git history: commit list + diff view |
| WhyDrawer | `components/memory/why-drawer.tsx` | Explainer: "Why does this file exist?" |

### Floor (Live Agent Visualization) Components
| Component | File | Purpose |
|-----------|------|---------|
| FloorClient | `components/floor/floor-client.tsx` | Root: mounts canvas + legend + toolbar, fetches /api/tail |
| FloorCanvas | `components/floor/floor-canvas.tsx` | WebGL/Canvas scene: agent sprites, events, particles |
| FloorLegend | `components/floor/floor-legend.tsx` | Legend: agent colors + status meanings |
| FloorToolbar | `components/floor/floor-toolbar.tsx` | Controls: zoom, speed, agent filter, export, view-mode |
| FloorPopoutHost | `components/floor/floor-popout-host.tsx` | Full-screen wrapper for /floor/popout |

### Chat Components
| Component | File | Purpose |
|-----------|------|---------|
| ChatLayout | `app/chat/chat-layout.tsx` | 50/50 split: left=history, right=input |
| ChatRail | `components/chat/chat-rail.tsx` | Right-side chat drawer (collapsible) |
| ChatPanel | `components/chat/chat-panel.tsx` | Chat input + send button + suggestions |
| Message | `components/chat/message.tsx` | Single message bubble (user/assistant) |
| ChatMirror | `components/chat/chat-mirror.tsx` | Real-time log of chat actions |
| Suggestions | `components/chat/suggestions.tsx` | Suggested follow-up prompts |
| ConfirmActionDialog | `components/chat/confirm-action-dialog.tsx` | "Are you sure?" dialog for risky chat commands |

### Changes & Timeline Components
| Component | File | Purpose |
|-----------|------|---------|
| ChangeRow | `components/changes/change-row.tsx` | Single change item: timestamp, project, phase, task, status |
| DayGroup | `components/changes/day-group.tsx` | Collapsible group: changes for a single day |
| ProjectGroup | `components/changes/project-group.tsx` | Collapsible group: changes for a project |
| DevModeDetail | `components/changes/dev-mode-detail.tsx` | JSON detail panel (dev-mode-only) |

### Schedule & Task Components
| Component | File | Purpose |
|-----------|------|---------|
| TaskList | `components/schedule/task-list.tsx` | Scheduled tasks list (cron + next-run + edit/delete) |
| NLInput | `components/schedule/nl-input.tsx` | Natural-language task input field |
| CronPreview | `components/schedule/cron-preview.tsx` | Next 5 run times for a cron expression |

### Security Components
| Component | File | Purpose |
|-----------|------|---------|
| AuditTable | `components/security/audit-table.tsx` | Audit log table: timestamp, actor, action, resource, result |
| SecretsReport | `components/security/secrets-report.tsx` | Secrets metadata (keys redacted, last-rotated, rotation-policy) |
| TrustBadge | `components/security/trust-badge.tsx` | Visual indicator: trust score (1-5 stars or color) |
| TrustExplainer | `components/security/trust-explainer.tsx` | Info modal: how trust score is calculated |
| TrustGrid | `components/security/trust-grid.tsx` | Skills grid with trust scores |

### Skills Components
| Component | File | Purpose |
|-----------|------|---------|
| SkillCatalogGrid | `components/skills/catalog-grid.tsx` | Grid of SkillCards (from registry) |
| SkillCard | `components/skills/skill-card.tsx` | Single skill: icon, name, description, install button |
| SkillDetailDrawer | `components/skills/skill-detail-drawer.tsx` | Right drawer (?skill={name}): full description, schema, examples, trust score |
| InstallButton | `components/skills/install-button.tsx` | "Install" button + loading + installed state |

### Workflow Components
| Component | File | Purpose |
|-----------|------|---------|
| WorkflowForm | `app/build/workflows/workflow-form.tsx` | Create/edit form: YAML editor + NL draft + step graph |
| MonacoYamlEditor | `components/workflows/monaco-yaml-editor.tsx` | Monaco code editor for YAML |
| NLDraftTextarea | `components/workflows/nl-draft-textarea.tsx` | Natural-language workflow draft |
| StepGraph | `components/workflows/step-graph.tsx` | Visual DAG: workflow steps + edges |

### Command Palette & Shortcuts
| Component | File | Purpose |
|-----------|------|---------|
| CommandPalette | `components/palette/command-palette.tsx` | Global cmd-k search + action palette (Cmd⌘K) |
| PaletteTrigger | `components/palette/palette-trigger.tsx` | Cmd-K trigger button |

### Other Components
| Component | File | Purpose |
|-----------|------|---------|
| RoleGate | `components/auth/role-gate.tsx` | Conditional render by role (admin/operator/viewer) |
| TailPanel | `components/tail-panel.tsx` | Live log tail viewer panel (streaming from /api/tail) |
| TailSheet | `components/tail-sheet.tsx` | Right-slide sheet version of tail panel |
| RootErrorBoundary | `components/root-error-boundary.tsx` | Catch React errors + log to /api/telemetry/client-error |

---

## 3. Data Source Map

### State Files (lib/)
All state functions read from `.cae/` filesystem and return typed structs.

| File | Exposes | Reads From | Fields |
|------|---------|-----------|--------|
| `lib/cae-state.ts` | `listProjects()`, `listPhases()`, `tailJsonl()` | `.cae/metrics/circuit-breakers.jsonl`, `./phases/*.md` | Project: `{ name, path, shiftUpdated }`, Phase: `{ number, name, status, planFiles }` |
| `lib/cae-agents-state.ts` | `getAgentsRoster()`, `getAgentDetail(name)` | `.cae/metrics/circuit-breakers.jsonl`, AGENT_META | AgentRosterEntry: `name, emoji, model, group, last_run_days_ago, stats_7d, current, drift_warning`; AgentDetailEntry: + `persona_md, lifetime, top_expensive, recent_invocations` |
| `lib/cae-metrics-state.ts` | `getMetrics()` | Circuit-breaker JSONL + event stream | `success_rate, avg_wall_ms, spending_7d, spending_daily, retry_heatmap, queue_depth` |
| `lib/cae-queue-state.ts` | `getQueueState()` | Circuit-breaker JSONL | `tasks: [ { id, project, phase, plan, task, status, agents_assigned, queued_at } ]` |
| `lib/cae-changes-state.ts` | `getChanges()` | Circuit-breaker JSONL | `changes: [ { ts, project, phase, plan, task, event, detail } ]` grouped by day/project |
| `lib/cae-chat-state.ts` | `getChatSessions()`, `getChatHistory(sessionId)` | `.cae/chat/*.jsonl` | Chat message: `{ id, role, content, ts, action?, result? }` |
| `lib/cae-graph-state.ts` | `getGraphData()` | `.planning/.git` + CLAUDE.md files | Graph node: `{ id, label, type, position, metadata }`, edges |
| `lib/cae-home-state.ts` | `getHomeState()` | Circuit-breaker JSONL, phases | Summary: active phases, active agents, queue depth, incidents |
| `lib/floor/state.ts` | `getFloorState(cbPath)` | Circuit-breaker JSONL at cbPath | Agents + events: `{ name, position, status, event_stream }` for live floor canvas |

### API Routes (app/api/)
Each route serves JSON or streams JSONL.

| Endpoint | Method | Returns | Reads | Purpose |
|----------|--------|---------|-------|---------|
| `/api/agents` | GET | `{ agents: AgentRosterEntry[] }` | cae-agents-state | Agent roster |
| `/api/agents/[name]` | GET | `AgentDetailEntry` | cae-agents-state | Agent detail drawer data |
| `/api/metrics` | GET | `MetricsData` | cae-metrics-state | Golden signals |
| `/api/queue` | GET | `{ tasks: QueueTask[] }` | cae-queue-state | Queue list |
| `/api/queue/delegate` | POST | `{ ok: bool }` | Circuit-breaker write | Assign task to agent |
| `/api/changes` | GET | `{ changes: Change[] }` | cae-changes-state | Change log |
| `/api/state` | GET | `{ home: HomeState }` | cae-home-state | Dashboard state (rollup strip, incidents) |
| `/api/tail` | GET (SSE) | Event stream | Circuit-breaker file | Live event tail (floor, metrics updates) |
| `/api/chat/send` | POST | `{ sessionId, messageId }` | cae-chat-state | Send chat message |
| `/api/chat/sessions` | GET | `ChatSession[]` | cae-chat-state | List chat sessions |
| `/api/chat/history/[sessionId]` | GET | `Message[]` | cae-chat-state | Chat history |
| `/api/memory/tree` | GET | `{ files: FileNode[] }` | `.planning/` | File tree for browse |
| `/api/memory/search` | POST | `{ results: SearchResult[] }` | `.planning/` glob + grep | Full-text search |
| `/api/memory/file/[...path]` | GET | File content (text/markdown) | `.planning/[path]` | Single file content |
| `/api/memory/git-log/[...path]` | GET | `{ commits: Commit[] }` | `.planning/.git` | Git history for file |
| `/api/memory/diff` | POST | `{ diff: string }` | Git state | Unified diff |
| `/api/memory/graph` | GET | `{ nodes, edges }` | cae-graph-state | Graph data for visualization |
| `/api/workflows` | GET | `WorkflowRecord[]` | `.planning/*/workflows.yaml` | Workflow list |
| `/api/workflows/[slug]` | GET | `WorkflowRecord` | `.planning/*/workflows.yaml` | Single workflow |
| `/api/workflows/[slug]/run` | POST | `{ jobId }` | Circuit-breaker write | Run workflow |
| `/api/skills` | GET | `SkillRegistry` | Skill metadata | Available skills |
| `/api/skills/[name]` | GET | `SkillDetail` | Skill metadata | Single skill detail |
| `/api/skills/install` | POST | `{ ok: bool }` | Filesystem write | Install skill |
| `/api/schedule` | GET | `ScheduleTask[]` | `.cae/schedule/*.cron` | Scheduled tasks |
| `/api/schedule/[id]` | POST/PATCH/DELETE | `{ ok: bool }` | Cron file write | Create/update/delete cron |
| `/api/schedule/parse` | POST | `{ next_runs: string[] }` | cron parser | Preview next 5 runs |
| `/api/security/audit` | GET | `AuditEntry[]` | `.cae/audit/*.jsonl` | Audit log (operator+) |
| `/api/security/scans` | GET | `SecurityScan[]` | `.cae/security/scans/` | Scan results |
| `/api/security/scan/[name]` | POST | `{ jobId }` | Rescan trigger | Rescan skill |
| `/api/security/trust` | GET | `TrustScore[]` | `.cae/security/trust.json` | Trust scores |
| `/api/incidents` | GET | `Incident[]` | Circuit-breaker JSONL | Recent incidents |
| `/api/admin/roles` | GET/POST | `UserRole[]` | Auth backend | Role management |
| `/api/telemetry/client-error` | POST | `{ ok: bool }` | Error log file | Client error logging |

**Data Freshness:**
- **Real-time:** `/api/tail` (SSE, immediate)
- **Polled:** `useStatePoll()` hook (configurable, default 1-30s)
- **Cached:** State aggregators (lib/cae-*-state.ts) cache 1s-30s per file
- **Static:** Metadata (AGENT_META, skill registry) loaded once per session

---

## 4. Interactive Element Classes

### Buttons
| Class | Example Files | Behavior |
|-------|---------------|----------|
| Action buttons | `components/ui/button.tsx` (variant=primary) | POST/PATCH/DELETE on click; show loading state; toast on success/error |
| Toggle buttons | `components/shell/mode-toggle.tsx` | Click to toggle state; update cookie |
| Icon buttons | `components/shell/floor-icon.tsx`, etc. | Navigation link or action trigger |
| Disabled buttons | RoleGate wraps button | Grey out + disable click if role < required |

**Examples:**
- `/build/page.tsx:59` — "Run workflow" button (POST to /api/workflows/[slug]/run)
- `/components/agents/agent-detail-drawer.tsx:80+` — Detail fetch on open
- `/components/shell/mode-toggle.tsx` — Build ↔ Plan cookie write

### Links & Navigation
| Class | Example Files | Behavior |
|-------|---------------|----------|
| Next Link (href) | BuildRail TABS (8 entries) | Client-side route transition |
| Dynamic route param | `/build/phase/[num]`, `/build/skills/[name]` | Route via URL param |
| Deep-link query params | `?agent=AgentName`, `?sheet=open&phase=1&task=task-id` | URL state drives drawer/sheet visibility |

**Examples:**
- `/components/shell/build-rail.tsx:48–72` — 8 tab links (Home, Agents, Workflows, Queue, Skills, Schedules, Security, Changes)
- `/app/build/agents/page.tsx:68` — AgentDetailDrawer uses `?agent={name}`
- `/components/build-home/task-detail-sheet.tsx:30–34` — Sheet opens via `?sheet=open&phase=X&task=Y`

### Drawers & Sheets (Right-slide)
| Component | Files | Data Shown |
|-----------|-------|-----------|
| Agent Detail | `components/agents/agent-detail-drawer.tsx` | Persona (markdown), model override, drift banner, lifetime stats, recent invocations table (50 rows) |
| Task Detail | `components/build-home/task-detail-sheet.tsx` | Title, phase/plan/task IDs, agents assigned (avatars), live log tail (100 lines), pause/abort buttons |
| Skill Detail | `components/skills/skill-detail-drawer.tsx` | Name, description, schema (JSON), examples, trust score, install button |
| Git Timeline | `components/memory/git-timeline-drawer.tsx` | Commit list (date, author, message), diff viewer |
| Node Detail | `components/memory/graph/node-drawer.tsx` | Node metadata (type, labels, relationships) |

**Data gap audit:**
- **Agent Detail:** Shows `persona_md`, `model`, `lifetime.tasks_total`, `lifetime.tokens_total`, `lifetime.success_rate`, `lifetime.avg_wall_ms`, `recent_invocations` (50); *missing:* `lifetime.top_expensive` (available but not shown), `group` enum (active/dormant — not visualized)
- **Task Detail:** Shows title, phase/plan/task, agents, log; *missing:* task status details, failure reason, estimated time remaining, retry count, nested subtasks (if any)
- **Skill Detail:** Shows description, schema; *missing:* version history, recent runs, error rate
- **Node Detail:** Shows metadata; *missing:* relationship count, change frequency

### Tabs
| Component | Files | Tabs |
|-----------|-------|------|
| Memory page | `app/memory/memory-client.tsx` | 3 tabs: Browse, Graph, Diff |
| Chat layout | `app/chat/chat-layout.tsx` | 2 panes: History (left), Input (right) |
| Metrics page | `/metrics` (implicit) | Panels arranged vertically (not tabbed) |

### Accordions / Collapsibles
| Component | Files | Opens To Show |
|-----------|-------|----------------|
| File tree | `components/memory/browse/file-tree.tsx` | Directory contents (recursive) |
| Day group | `components/changes/day-group.tsx` | Changes for a single day |
| Project group | `components/changes/project-group.tsx` | Changes for a single project |

### Dialogs / Modals
| Component | Files | Trigger |
|-----------|-------|---------|
| Confirm action | `components/chat/confirm-action-dialog.tsx` | Chat command needs confirmation (e.g., "Deploy to prod?") |
| Shortcut help | `components/ui/shortcut-overlay.tsx` | Cmd-? or button in top-nav |
| Trust explainer | `components/security/trust-explainer.tsx` | Click "?" next to trust score |

### Command Palette
| Component | Files | Behavior |
|-----------|-------|----------|
| Global palette | `components/palette/command-palette.tsx` | Cmd-K: search routes, actions, docs; execute action via Enter |
| Trigger button | Top-nav (search icon) | Opens palette |

**Registered Commands (in code):** (To be inventoried via grep for `command.register` or similar pattern — need to inspect impl)

### Keyboard Shortcuts
| Shortcut | Handler File | Action |
|----------|--------------|--------|
| Cmd-K | `components/palette/command-palette.tsx` | Open command palette |
| Esc | Various (Dialog/Sheet) | Close drawer/modal |
| Enter | `components/chat/chat-panel.tsx` | Send message |
| Cmd-/ | `components/ui/shortcut-overlay.tsx` | Show shortcuts help |

### Form Inputs
| Component | Files | Used In |
|-----------|-------|---------|
| TextInput | `components/ui/input.tsx` | Search bars, skill filter, cron input |
| Textarea | `components/ui/textarea.tsx` | Chat input, workflow YAML editor |
| Dropdown/Select | `components/ui/dropdown-menu.tsx` | Model override, agent filter |
| YAML editor | `components/workflows/monaco-yaml-editor.tsx` | Workflow edit form |

### Sortable / Filterable Lists
| Component | Files | Sortable By | Filterable By |
|-----------|-------|------------|----------------|
| Agent roster | `components/agents/agent-grid.tsx` | (Not implemented — grid order is fixed) | (Not implemented) |
| Recent invocations | `components/agents/recent-invocations-table.tsx` | Timestamp, tokens, status | (Not implemented) |
| Top expensive tasks | `components/metrics/top-expensive-tasks.tsx` | Tokens desc | (Not implemented) |
| Per-agent wall table | `components/metrics/per-agent-wall-table.tsx` | Wall time (sortable header click) | (Not implemented) |
| Audit log | `components/security/audit-table.tsx` | Timestamp, actor | Date range, actor, resource type |

---

## 5. Orphan Detection

**All pages are reachable via:**
1. BuildRail (8 tabs) covers: /build, /build/agents, /build/workflows, /build/queue, /build/skills, /build/schedule, /build/security, /build/changes
2. Top-nav icons cover: /floor, /memory, /metrics, /chat
3. Dynamic routes via links: /build/workflows/new, /build/workflows/[slug], /build/skills/[name], /build/schedule/new, /build/phase/[num]
4. Empty-state CTAs: /signin links to /build, /plan links to /build
5. Mode toggle: /build ↔ /plan

**Potentially orphan routes (buried, no top-nav entry, no link in main UI):**
- `/build/admin/roles` — only reachable by direct URL or internal link in admin pages (no admin breadcrumb)
- `/build/security/audit` — linked from `/build/security` but no direct icon button
- `/build/security/secrets` — linked from `/build/security`
- `/build/security/skills` — linked from `/build/security`
- `/build/skills/installed` — linked from `/build/skills` (maybe)
- `/floor/popout` — linked from floor-toolbar
- `/403` — only shown by middleware on 403

**Status:** No true orphans; all routes have at least one inbound link from either nav or a parent page.

---

## 6. Detail-Expand Inventory

**Critical gap identified:** Many list rows lack meaningful detail expansion. Data is available but not surfaced.

| List Component | File | Clickable Row | Expands To | Data Shown vs Available |
|---|---|---|---|---|
| Agent roster grid | `AgentGrid` | AgentCard | AgentDetailDrawer (?agent={name}) | Shows: persona, model, drift, lifetime, recent 50 invocations. Missing: top_expensive (available in DetailEntry.lifetime.top_expensive), drift_details (threshold values), model_history |
| Recent invocations table | `RecentInvocationsTable` | Table row | No detail-expand | Shows: ts, project, phase, task, model, tokens, wall_ms, status. Missing: click → log tail, error msg, retry reason, cost breakdown |
| Recent ledger | `RecentLedger` | Ledger item row | TaskDetailSheet (?sheet=open&phase=X) | Shows: title, agents, live log (100 lines), pause/abort buttons. Missing: task status (enum), failure reason, expected runtime, queue depth at time, related tasks |
| Queue list | No named component yet | Queue item | None | Shows: phase, task, agents. Missing: queue position, time queued, estimated start, priority |
| Active phase cards | `ActivePhaseCards` | Card click → /build/phase/[num] | Full phase detail page | Shows: waves, tasks, logs. Missing: wave progress %, task dependency graph, critical path |
| Needs-you list | `NeedsYouList` | Row click | Depends on type (blocked task → sheet, failing agent → AgentDetail) | Shows: issue title, affected resource. Missing: issue description, mitigation options, impact assessment |
| Changes log | Day/Project groups | ChangeRow click | DevModeDetail (dev-mode only) | Shows: timestamp, project, event type. Missing: event details, git diff, diff viewer (should click to DiffView) |
| Metrics charts | Per-agent wall table | Clicking agent name → AgentDetail | AgentDetailDrawer | Shows: agent stats. Missing: deeper breakdown (model vs task type, percentile distribution) |
| Audit log | `AuditTable` | Row click | None | Shows: timestamp, actor, action, resource, result. Missing: event payload detail, full command executed |
| Skills catalog | `SkillCatalogGrid` | SkillCard click | SkillDetailDrawer (?skill={name}) | Shows: description, schema, trust score. Missing: changelog, version history, dependent workflows |
| File tree | `FileTree` | Node click | `MarkdownView` (selects file in right pane) | Shows: file content. Missing: git blame, last-modified indicator |
| Search results | `SearchResults` | Result click | `MarkdownView` (opens in main view) | Shows: snippet, file path. Missing: context lines, highlight search term |
| Chat history | Implicit in ChatLayout | Message bubble | No detail-expand | Shows: message text, action result (if any). Missing: latency, token usage, related files, reasoning trace |
| Workflow list | No named component yet | Row click → /build/workflows/[slug] | Edit form (WorkflowForm) | Shows: YAML, steps. Missing: last-run info, success rate, dependent agents |
| Scheduled tasks | `TaskList` | Row click | Edit form | Shows: cron, next runs. Missing: last-run timestamp, skip/run-once options, execution log |

**Most critical gaps (Eric's complaints):**
1. **Task detail (sheet):** Shows only log tail + pause/abort; missing task status, failure reason, queue depth, estimated time
2. **Agent roster:** Shows lifetime stats; missing detailed breakdown by task type, model performance comparison, drift threshold values
3. **Recent ledger:** Shows only log; missing phase/task progress, queue depth at submission, retry count
4. **Workflow list:** Shows YAML; missing last-run info, success rate, CI/CD trigger status

---

## 7. Audit Infrastructure (Phase 13)

### Location
`/home/cae/ctrl-alt-elite/dashboard/.planning/phases/13-ui-ux-review-polish-loop/audit/`

### Audit Scripts & Outputs
| File | Type | Purpose | Status |
|------|------|---------|--------|
| `BASELINE.md` | Report | Baseline UI scores (pre-fixes) | ✓ Complete |
| `DELTA.md` | Report | Before/after comparison | ✓ Complete |
| `VERIFICATION.md` | Report | Manual verification checklist | ✓ Complete |
| `VERIFY.md` | Report | Verification results | ✓ Complete |
| `VERIFY-after.md` | Report | Post-fix verification | ✓ Complete |
| `WCAG-REPORT.md` | Report | Accessibility audit (WCAG 2.1) | ✓ Complete |
| `UI-AUDIT-*.md` | Reports | Detailed audits by category | ✓ Complete (11 files) |
| `working/capture-before.log` | Log | Screenshot capture log (before) | ✓ Complete |
| `working/capture-after.log` | Log | Screenshot capture log (after) | ✓ Complete |
| `working/CLICKWALK-*.md` | Docs | Interactive element click-through docs | ✓ Complete (4 files) |
| `working/console-baseline.tsv` | Data | Console errors baseline | ✓ Complete |
| `working/delta-pairs.json` | Data | Before/after fixture pairs | ✓ Complete |

### Fixtures (in working/)
None captured as PNG/video files in audit directory. Evidence suggests fixtures were logged in capture-*.log but PNGs not checked in.

### Inference
Phase 13 produced:
- **Clickwalk docs** (interactive element walkthrough) → can reuse for Click-walk in Phase 15
- **WCAG report** → can reuse for accessibility pass
- **Baseline + Delta** → can reuse as C1 baseline for Phase 15 scoring
- **No PNG fixtures** → Phase 15 must build capture harness from scratch (Playwright)

---

## Summary

**Total Routes:** 27 pages (1 home, 1 signin, 1 error, 22 build/*, 1 plan, 2 global (floor/popout), 1 metrics, 1 memory, 1 chat)

**Total Components:** 163 TSX files, ~95 user-visible components (excluding tests, helpers, primitives)

**Data Layer:** 8 state aggregators (lib/cae-*-state.ts) + 50 API endpoints feeding real-time UI

**Interactive Elements:**
- 8 navigation tabs (BuildRail)
- 4 main global icons (Floor, Memory, Metrics, Chat)
- 5 detail drawers/sheets (Agent, Task, Skill, GitTimeline, NodeDetail)
- 1 command palette (Cmd-K)
- 3 major tabs (Memory: Browse/Graph/Diff)
- 4 collapsible groups (FileTree, DayGroup, ProjectGroup, ActivePhaseCards)

**Critical Data Gaps (Detail-Expand Depth):**
- Agent detail: missing top_expensive breakdown, drift thresholds, model history
- Task detail: missing status, failure reason, queue depth, estimated time
- Recent ledger: missing progress %, queue context, retry info
- Audit log: missing event payload detail

**Audit Infrastructure Reuse:**
- CLICKWALK docs from Phase 13 → reuse for Phase 15 interactive element inventory
- WCAG report → reuse for accessibility baseline
- Baseline + Delta → reuse as C1 scoring reference
- Fixture capture → must build Playwright harness (no existing PNG snapshots)

