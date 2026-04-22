<!-- generated-by: gsd-doc-writer -->
# Architecture

How the cae-dashboard is put together. Read after [README.md](./README.md); [AGENTS.md](./AGENTS.md) covers internal conventions not duplicated here.

## Overview

`cae-dashboard` is a Next.js 16 App Router app. It renders a two-mode shell (Plan = Shift; Build = CAE) over two primary data sources:

1. **Disk state** — `$CAE_ROOT/.planning/phases/**`, `$CAE_ROOT/.cae/metrics/*.jsonl`, `$INBOX_ROOT`, `$OUTBOX_ROOT`. Read-only on read-paths; mutated via narrow server actions on write-paths.
2. **tmux sessions** — `cae execute-buildplan` is spawned detached via `tmux` for workflow runs and manual delegations. Session names follow the Phase 2 short-id convention (`web-<id>`, `wf-<id>`) so the queue aggregator can match them.

Nothing else persists server-side. No database, no queue broker, no state store.

## Core concepts

### Plan vs Build mode

One segmented toggle in the top bar, two route trees:

- **Plan** (`/plan/**`) — Shift planning surface (Projects / PRDs / Roadmaps / UAT per UI-SPEC §2). Currently stubbed; full content ships in Phase 10.
- **Build** (`/build/**`) — CAE coding-team surface. 5 left-rail tabs in locked order: Home · Agents · Workflows · Queue · Changes (Changes stubbed until Phase 9).

Mode preference persists in the `cae-mode` cookie. Root `/` (in `app/page.tsx`) reads the cookie and redirects to `/plan` or `/build` (default: `/build`).

The naming semantically swapped in Phase 3: old "Build" = Shift became "Plan"; old "Ops" = CAE became "Build". See [CHANGELOG v0.2.1](./CHANGELOG.md#v021--design-system--route-reorg--founder-speak-phase-3) for migration notes.

### Explain-mode vs Dev-mode

Two independent booleans, both global, both client-side, both persisted in `localStorage`:

| Mode | Default | Shortcut | Storage key | Provider |
|---|---|---|---|---|
| Explain | ON | `Ctrl+E` | `localStorage.explainMode` | `lib/providers/explain-mode.tsx` |
| Dev | OFF | `Cmd+Shift+D` / `Ctrl+Shift+D` | `localStorage.devMode` | `lib/providers/dev-mode.tsx` |

Explain-mode enables inline jargon tooltips (for a founder who hits a term they don't know). Dev-mode flips the entire UI copy over to technical language, reveals the Monaco YAML editor, shows SHAs + branches + wave numbers, and surfaces the `dev` badge in the top bar.

Both providers live in `app/layout.tsx`, wrapping the root tree. Both providers guard against firing when focus is on `input` / `textarea` / `contentEditable` elements.

### Founder-speak copy layer

Every user-visible string lives in `lib/copy/labels.ts` as a key on the `Labels` interface. `labelFor(dev: boolean): Labels` returns either the FOUNDER or DEV branch. Consumers:

- **Server components** that need founder-speak on static copy: `const t = labelFor(false)` — no client island.
- **Client components** that need per-user flipping: `const { dev } = useDevMode(); const t = labelFor(dev)`.
- **Headings on server pages** that must flip per-user: small "use client" heading-island (see `components/shell/build-home-heading.tsx`, `phase-detail-heading.tsx`, `plan-home-heading.tsx`, `build-queue-heading.tsx`).

Agent-specific metadata (label, founder_label, emoji, color) lives in `lib/copy/agent-meta.ts`. `agentMetaFor(name)` returns an `AgentMeta` with an unknown-agent fallback that preserves the raw name.

### Cost = tokens, never USD

The app runs on an Anthropic OAuth subscription, so per-call USD pricing would be fiction. `components/shell/cost-ticker.tsx` computes `inputTokensToday + outputTokensToday` from `/api/state` and renders `{N}k tok today · est.`. The `est.` label's tooltip reads `Token usage from local logs. OAuth subscription — not billed per call.` There is no USD conversion and no rate table anywhere in the tree.

## Module map

### Root

| File | Role |
|---|---|
| `app/layout.tsx` | HTML shell, font loaders, `<ExplainModeProvider>` → `<DevModeProvider>` → `<StatePollProvider>` → `<TopNav>` + children + `<Toaster />` |
| `app/page.tsx` | Auth gate + cookie-based redirect to `/plan` or `/build` |
| `auth.ts` | NextAuth v5 config (GitHub provider only) |
| `middleware.ts` | Auth gate for `/plan/:path*`, `/build/:path*`, `/memory`, `/metrics` |
| `app/globals.css` | Tailwind v4 `@theme inline` + dark palette + `cae-shake` keyframe |

### Top-bar chrome (`components/shell/`)

| Component | Role |
|---|---|
| `top-nav.tsx` | 40px sticky header, assembles all children below |
| `mode-toggle.tsx` | `Plan | Build` segmented toggle, cyan accent on active |
| `cost-ticker.tsx` | Tokens-only display; no USD |
| `memory-icon.tsx` / `metrics-icon.tsx` | Links to `/memory` and `/metrics` |
| `heartbeat-dot.tsx` | Green / amber / red based on circuit-breaker state |
| `dev-badge.tsx` | Cyan pill visible only when `useDevMode().dev === true` |
| `user-menu.tsx` | Session dropdown |
| `build-rail.tsx` | 48px left-rail, 5 Build-mode tabs |

### Build-home widgets (`components/build-home/`)

Mounted on `app/build/page.tsx`; all read from the shared `useStatePoll()` context.

| Component | Role |
|---|---|
| `rollup-strip.tsx` | 5-metric top strip (shipped / tokens / in-flight / blocked / warnings) |
| `live-ops-line.tsx` | One-line mono agent-assignment string |
| `active-phase-cards.tsx` | Card list with progress + ETA + `AgentAvatars`; click → `?sheet=open` |
| `agent-avatars.tsx` | Reusable pill (emoji + concurrency dots) |
| `needs-you-list.tsx` | Blocked / dangerous / plan_review rows with inline action buttons |
| `recent-ledger.tsx` | Last-20 events dense mono table |
| `task-detail-sheet.tsx` | Right-slide, URL-state-controlled, 7 sections |
| `sheet-live-log.tsx` | SSE tail consumer; 500-line cap; pause-scroll |
| `sheet-actions.tsx` | 6 stub action buttons (Approve / Deny / Retry / Abandon / Reassign / Edit plan) |

### Agents tab (`app/build/agents/` + `components/agents/`)

| File | Role |
|---|---|
| `app/build/agents/page.tsx` | Server component, calls `getAgentsRoster()` directly, mounts grid + drawer |
| `components/agents/agent-grid.tsx` | Grouped sections (Active / Recently used / Dormant), responsive 1/2/3 col |
| `components/agents/agent-card.tsx` | 200×280 card; active variant with sparklines, dormant variant with "inactive Xd" |
| `components/agents/agent-detail-drawer.tsx` | URL-state-driven (`?agent=<name>`) right-slide with 6 sections |
| `components/agents/persona-markdown.tsx` | Inline safe MD renderer — no `dangerouslySetInnerHTML` |
| `components/agents/drift-banner.tsx` | Red alert when 7d success < 85% of 30d baseline (≥5 samples) |
| `components/agents/lifetime-stats.tsx` | 4 tiles + top-5 expensive tasks |
| `components/agents/recent-invocations-table.tsx` | Last-50 mono table |
| `components/agents/model-override.tsx` | Stub Save (console.info + toast) |

### Workflows (`app/build/workflows/` + `components/workflows/` + `lib/cae-workflows*.ts`)

| File | Role |
|---|---|
| `lib/cae-workflows-schema.ts` | Pure types + parsers, client-safe (no `fs`) |
| `lib/cae-workflows.ts` | Disk CRUD rooted at `$CAE_ROOT/.cae/workflows/*.yml` |
| `lib/cae-nl-draft.ts` | `heuristicDraft(text)` — natural language → `WorkflowSpec` |
| `app/build/workflows/page.tsx` | Server-rendered list with Run-now buttons |
| `app/build/workflows/new/page.tsx` + `[slug]/page.tsx` | Create + edit routes |
| `app/build/workflows/workflow-form.tsx` | `yaml` as single source of truth; NL / Monaco / name input all write back |
| `components/workflows/step-graph.tsx` | SSR-safe hand-rolled SVG preview |
| `components/workflows/monaco-yaml-editor.tsx` | Dev-mode-gated YAML editor, dynamic-imported (`ssr: false`) |
| `components/workflows/nl-draft-textarea.tsx` | Founder-facing draft entry |

### Queue (`app/build/queue/`)

| File | Role |
|---|---|
| `page.tsx` | KANBAN shell; server-renders initial `getQueueState()`; mounts `TaskDetailSheet` under `StatePollProvider` |
| `queue-kanban-client.tsx` | 5-column KANBAN; polls `/api/queue` every 5000ms |
| `queue-card.tsx` | Dense card with agent emoji, title, project · time, ≤3 tags, pulsing cyan dot on in-progress |
| `new-job-modal.tsx` | Dialog wrapper around the preserved `<DelegateForm />` |
| `delegate-form.tsx` | Phase 2 form — untouched except for a new `onSuccess?(taskId)` callback |
| `actions.ts` | Phase 2 `createDelegation` server action — untouched |

### Disk adapters (`lib/`)

| File | Role |
|---|---|
| `cae-config.ts` | `CAE_ROOT` / `INBOX_ROOT` / `OUTBOX_ROOT` env reads with hardcoded fallbacks |
| `cae-state.ts` | `listProjects`, `listPhases`, `listInbox`, `listOutbox`, `tailJsonl`, `getCircuitBreakerState` |
| `cae-home-state.ts` | `getHomeState()` aggregator with 1-second result cache |
| `cae-agents-state.ts` | `getAgentsRoster()` + `getAgentDetail()` with 30-second process-level cache |
| `cae-queue-state.ts` | Pure `bucketTasks()` + async `getQueueState()` |
| `cae-phase-detail.ts` | Phase detail page data layer |
| `cae-types.ts` | Shared TypeScript types |
| `tail-stream.ts` | Node stream helper used by `/api/tail` |

### Providers + hooks (`lib/providers/` + `lib/hooks/`)

| File | Role |
|---|---|
| `providers/explain-mode.tsx` | Context + `useExplainMode()` hook + `Ctrl+E` listener |
| `providers/dev-mode.tsx` | Context + `useDevMode()` hook + `Cmd+Shift+D` listener |
| `hooks/use-state-poll.tsx` | `<StatePollProvider>` fetches `/api/state` every 3000ms by default; `useStatePoll()` reads shared context |
| `hooks/use-screen-shake.ts` | Returns `{ shake }`; toggles `.cae-shaking` for 160ms; respects `prefers-reduced-motion` |
| `hooks/use-sheet-keys.ts` | `Esc` / `Ctrl+.` / `Ctrl+Shift+.` shortcuts for `TaskDetailSheet` |

## Data flow

### Authenticated page request (Build Home)

1. Browser hits `/build` → `middleware.ts` checks `auth()`; redirects to `/signin?from=/build` if no session.
2. `app/layout.tsx` runs server-side: calls `auth()`, renders `<html>` → `<body>` → providers → `<TopNav session>` → page children.
3. `app/build/layout.tsx` wraps children in `<div flex-row>` with `<BuildRail />` (client) on the left.
4. `app/build/page.tsx` runs (server, `force-dynamic`): calls `listProjects()`, renders heading + `<ProjectSelector>` + 5 widgets + `<TaskDetailSheet>`.
5. All 5 widgets are client components that call `useStatePoll()`. The provider fires one `GET /api/state?project=<path>` every 3000ms; `CostTicker` + `HeartbeatDot` + the 5 home widgets share that one fetch.
6. `/api/state` (server) runs `Promise.all` over: `getCircuitBreakerState`, `listPhases`, `listInbox`, `listOutbox`, `tailJsonl` × 4 (`.cae/metrics/*.jsonl`), `getHomeState()`. Response merges breaker totals + home aggregator output.
7. `TaskDetailSheet` reads URL params (`?sheet=open&phase&project[&plan][&task]`). When open, `<SheetLiveLog />` opens an `EventSource` on `/api/tail?file=<path>&project=<path>`, caps at 500 lines.

### Queue poll

1. `/build/queue` server page calls `getQueueState()` once for initial render, mounts `<QueueKanbanClient initialState>`.
2. Client component starts `window.setInterval(poll, 5000)`. Each tick fetches `/api/queue`, which calls `getQueueState()` — reads `$INBOX_ROOT` + `$OUTBOX_ROOT` + `circuit-breakers.jsonl` + shells out `tmux list-sessions` (2s timeout) and feeds it all into the pure `bucketTasks()` function.
3. Card click → `router.push('?sheet=open&task=<id>&project=<path>')`. `TaskDetailSheet` reads the URL independently of the queue state.

### Workflow run

1. User clicks Run on `/build/workflows` → browser POSTs to `/api/workflows/[slug]/run`.
2. Route handler calls `auth()`, rejects with 401 if unauthenticated.
3. On auth pass: reads the workflow YAML via `getWorkflow(slug)`, validates, spawns `tmux new-session -d` pointing at `cae execute-buildplan <inbox-path>`. Returns 202 with the spawned session name.
4. The spawned tmux session writes logs to `$CAE_ROOT/.cae/logs/<session>.log`; the queue aggregator picks up the new session on its next poll and the card shows up under "In progress".

### Founder-speak label flip

1. User hits `Ctrl+Shift+D`. `DevModeProvider` flips `dev: true`, persists to `localStorage.devMode`.
2. All components under the provider that call `useDevMode()` re-render. `labelFor(dev)` returns the DEV branch.
3. Monaco editor on `/build/workflows/[slug]` reveals itself (previously hidden); NL-draft textarea hides.
4. `DevBadge` in the top bar renders (it returns `null` when `dev === false`).

## Extension points

- **Add a label** — extend the `Labels` interface in `lib/copy/labels.ts`, add the key to both FOUNDER and DEV branches, consume via `labelFor(dev)`.
- **Add a new Build tab** — append to the `TABS` tuple in `components/shell/build-rail.tsx`, create `app/build/<slug>/page.tsx`.
- **Add a new workflow step type** — extend `WorkflowStep` in `lib/cae-workflows-schema.ts`, add validation in `validateWorkflow`, teach `heuristicDraft` to emit it, extend `StepGraph` switch.
- **Add a new `/api/state` field** — extend the server response shape in `app/api/state/route.ts` AND the `StateResponse` interface in `lib/hooks/use-state-poll.tsx`. All `useStatePoll()` consumers see it automatically.
- **Add a monitored metric** — drop a new `.jsonl` file under `$CAE_ROOT/.cae/metrics/`, add a `tailJsonl` call in `/api/state`, expose on the `StateResponse` type.

## Limitations

- **Single-user.** Auth is user-based but there are no team / permission concepts. Multi-user is v2.
- **Local host only.** No cloud deploy target. Paths are absolute (`/home/cae/...` defaults). Cloud is v2.
- **No write validation on workflow runs.** The run route spawns tmux without a dry-run. A bad workflow will fail loudly in the tmux log but the API returns 202 regardless.
- **Queue cards lack phase numbers.** Phase 6's KANBAN cards don't have a phase id, so the Phase 4 `TaskDetailSheet` degrades to `Phase ?` when opened from a queue card. Full queue-task detail is later polish.
- **Poll intervals are hardcoded.** `useStatePoll` defaults to 3000ms (`lib/hooks/use-state-poll.tsx:45`); the queue page uses 5000ms (`app/build/queue/queue-kanban-client.tsx:66`). There is no runtime config knob.
- **Memory + Metrics pages are stubs.** The icons resolve to real routes; the pages say "full content ships in Phase 7/8". Do not link users to them for real data.
- **Node-only tests.** Unit + integration tests use `node:test` + `tsx`. No Vitest, no Playwright. Browser-level UAT is manual.
- **`pnpm lint` is currently misconfigured** (see `.planning/phases/06-workflows-queue/06-05-SUMMARY.md` note) — `pnpm tsc` + `pnpm build` are the gates that actually run.
