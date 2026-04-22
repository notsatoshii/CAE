<!-- generated-by: gsd-doc-writer -->
# Changelog

All user-facing changes to `cae-dashboard`. Newest on top.

Version numbers track the `v0.1` milestone in [.planning/ROADMAP.md](./.planning/ROADMAP.md); they are not `package.json` versions (that pin stays at `0.1.0` until the milestone closes).

---

## v0.3 — Workflows + Queue (Phase 6)

Shipped 2026-04-22.

- **Workflow domain layer** (`lib/cae-workflows.ts`, `lib/cae-workflows-schema.ts`, `lib/cae-nl-draft.ts`) — typed `WorkflowSpec` / `WorkflowStep` / `WorkflowRecord`, pure `parseWorkflow` / `validateWorkflow` / `serializeWorkflow`, `heuristicDraft(text)` NL → spec converter, disk CRUD rooted at `$CAE_ROOT/.cae/workflows/*.yml`. Schema split from disk I/O so client components can import validators without bundling `fs`.
- **API routes** — `GET`/`POST /api/workflows`, `GET`/`PUT`/`DELETE /api/workflows/[slug]`, auth-gated `POST /api/workflows/[slug]/run` (spawns detached `tmux` session, returns 202), `GET /api/queue` (5-bucket aggregator reading inbox + outbox + `circuit-breakers.jsonl` + live `tmux list-sessions`).
- **Workflow widgets** (`components/workflows/*`) — hand-rolled SSR-safe `<StepGraph />` SVG preview (no react-flow / dagre / mermaid), `<MonacoYamlEditor />` dynamic-imported (`ssr: false`), `<NlDraftTextarea />` founder draft entry. Added `@monaco-editor/react@^4.6.0` (resolved 4.7.0).
- **Workflow pages** — `/build/workflows` list with Run-now buttons, `/build/workflows/new`, `/build/workflows/[slug]` edit. `<WorkflowForm />` holds `yaml` as the single source of truth; NL draft, Monaco, and name input all write back to it. Monaco is dev-mode-gated (`Ctrl+Shift+D` to reveal).
- **Queue rewrite** — `/build/queue` is now a 5-column KANBAN (`Waiting → In progress → Double-checking → Stuck → Shipped`) powered by `/api/queue` with 5-second `window.setInterval` polling. `<QueueCard />` shows agent emoji, title, project · time, ≤3 tags, pulsing cyan dot when in-progress. Card click opens `TaskDetailSheet` via `?sheet=open&task=...` URL state. New Job button wraps the preserved Phase 2 `createDelegation` server action + `<DelegateForm />` in a modal.
- **Breaking — route semantics.** The Phase 2 inbox/outbox tables were deleted from `/build/queue` root. Sub-routes `/build/queue/inbox/[taskId]` and `/build/queue/outbox/[taskId]` are still present but superseded by the KANBAN.
- **Copy** — 33 new label keys under `workflows.*` + `queue.kanbanCol.*` with founder/dev variants.

Commits: `1e5515d` through `8ed6417` (20+ commits; see `git log --oneline` for the full set).

---

## v0.2.3 — Agents tab (Phase 5)

Shipped 2026-04-22.

- **Data layer** — `lib/cae-agents-state.ts` exports `getAgentsRoster()` + `getAgentDetail()` with a 30-second process-level cache. Reads `forge_start` / `forge_done` / `forge_fail` events from `.cae/metrics/*.jsonl` across all projects, buckets into 10-slot sparkline arrays (oldest → newest), derives 7d success rate + avg wall time + drift warning (7d success < 85% of 30d baseline, ≥5 samples in 7d).
- **API routes** — `GET /api/agents` (roster) + `GET /api/agents/[name]` (detail).
- **Sparkline primitive** — `components/ui/sparkline.tsx`, SSR-safe pure SVG, no hooks.
- **Build left-rail** — `components/shell/build-rail.tsx` mounts a 48px icon-only left-rail on every `/build/*` page via `app/build/layout.tsx`. 5 tabs locked in order: Home · Agents · Workflows · Queue · Changes (Lucide icons: `Home`, `Users`, `Zap`, `Inbox`, `ScrollText`).
- **Stub routes** — `/build/workflows` and `/build/changes` pages added as stubs so the rail has no broken links (workflows filled in Phase 6; changes awaits Phase 9).
- **Agents grid** — `/build/agents` server page renders `<AgentGrid />` with responsive breakpoints (1 col < 768px, 2 col ≥ 768px, 3 col ≥ 1280px). Cards group into Active / Recently used / Dormant. Active cards show sparklines for `tokens/hr`, `success 7d`, `avg wall`; dormant cards collapse the stats block but keep the footer row.
- **Agent detail drawer** — `components/agents/agent-detail-drawer.tsx` is URL-state driven (`?agent=<name>`), 227 lines, widened to `sm:!max-w-xl lg:!max-w-2xl`. Six sections: persona MD (inline safe renderer — no `dangerouslySetInnerHTML`), model override stub, drift banner, lifetime stats tiles + top-5 expensive tasks, last-50 invocations table. `DriftBanner` renders when the aggregator's `drift_warning` flag is set.
- **Copy** — 31 new keys under `agents.*` with founder/dev variants (`Forge — the builder`, etc.).

Commits: `358155d` through `8f0b47d`.

---

## v0.2.2 — Build Home rewrite (Phase 4)

Shipped 2026-04-22.

- **Data aggregator** — `lib/cae-home-state.ts` (680 lines) exports `getHomeState()` with a 1-second result cache. Composes rollup (shipped_today / tokens_today / in_flight / blocked / warnings), `home_phases` with progress + ETA + `agents_active`, `events_recent` (last 20), `needs_you` list (blocked / dangerous / plan_review), and `live_ops_line` string.
- **`/api/state` extension** — server merges `getHomeState()` output into the existing response shape (home exposed as `home_phases` to avoid shadowing the legacy `phases` key).
- **`/api/tail` cross-project** — `ALLOWED_ROOTS` is now computed per-request from `listProjects()`, adding each project's `.cae/logs`, `.cae/metrics`, and `.planning/phases` to the allow-list. Enables SSE tail for any project under `$CAE_ROOT`.
- **Agent metadata** — new `lib/copy/agent-meta.ts` with single-source-of-truth `AGENT_META` table for the 9 known agents (Forge, Sentinel, Scout, Scribe, Phantom, Aegis, Arch, Herald, Nexus) — `label`, `founder_label`, `emoji`, `color`. Consolidated in Plan 04-06.
- **Home widgets** — `components/build-home/`: `<RollupStrip />`, `<LiveOpsLine />`, `<AgentAvatars />`, `<ActivePhaseCards />`, `<NeedsYouList />`, `<RecentLedger />`. All consume the shared `useStatePoll()` context.
- **Task detail sheet** — `<TaskDetailSheet />` is URL-state-controlled (`?sheet=open&phase={N}&project={path}[&plan][&task]`), right-slide at 50vw on desktop. 7 sections: Header / Summary / Live log / Changes / Memory (stub) / Comments (stub) / Actions. `<SheetLiveLog />` consumes `/api/tail` via `EventSource`, caps at 500 lines, supports pause-scroll. `<SheetActions />` has 6 stub buttons (Approve / Deny / Retry / Abandon / Reassign / Edit plan). `useSheetKeys` binds `Esc`, `Ctrl+.` (pause), `Ctrl+Shift+.` (abort).
- **Breaking — home page rewritten.** `app/build/page.tsx` now mounts the new widgets instead of the Phase 2 `<PhasesList />` + `<BreakersPanel />` (both deleted). Any direct imports of those two components will fail.
- **Provider repositioning.** `StatePollProvider` moved from `components/shell/top-nav.tsx` into `app/layout.tsx` so it wraps TopNav AND page children — previously, widgets under `/build` that called `useStatePoll()` threw at runtime.
- **Copy** — 31 new Phase 4 label keys in `labels.ts`.

Commits: `e76a5f9` through `63ab14e`.

---

## v0.2.1 — Design system + route reorg + founder-speak (Phase 3)

Shipped 2026-04-21.

- **Breaking — routes renamed.** Hard swap, no redirects:
  - `/ops/**` → `/build/**` (CAE orchestration surface)
  - `/build/**` → `/plan/**` (Shift planning surface — was a placeholder)
  - `/ops/*` URLs now 404. Update any bookmarks.
- **Breaking — mode toggle semantics swapped.** Top-bar toggle is now **`Plan | Build`** (was `Build | Ops`). Old "Build" meant Shift planning; old "Ops" meant CAE. Per UI-SPEC §S4.1: *Plan the work, then Build it.*
- **Breaking — Memory + Metrics pulled out of mode tabs.** Now global top-bar icons linking to `/memory` and `/metrics` (both currently stubs; content ships in Phases 7 + 8). They are accessible from both Plan and Build.
- **Dark theme tokens** — `app/globals.css` now carries UI-SPEC §13 palette (`--bg #0a0a0a`, `--surface #121214`, `--accent #00d4ff`, `--text #e5e5e5`, semantic `--success` / `--warning` / `--danger` / `--info`). `<html lang="en" className="dark">` anchors shadcn `dark:` variants. `cae-shake` keyframe + `.cae-shaking` class respect `prefers-reduced-motion: reduce`.
- **Geist fonts** — `Geist` + `Geist_Mono` from `next/font/google` wired via `--font-geist-sans` + `--font-geist-mono` (replaces the accidental Times New Roman fallback).
- **shadcn primitives added** — `Dialog` (`components/ui/dialog.tsx`), `sonner` Toaster (`components/ui/sonner.tsx`, hardcoded `theme="dark"`), `ScrollArea` (`components/ui/scroll-area.tsx`). `sonner@^2.0.7` added to deps; `next-themes` dropped (zero usages).
- **Global providers** — `ExplainModeProvider` (default ON, `Ctrl+E` toggles, `localStorage.explainMode`) and `DevModeProvider` (default OFF, `Cmd+Shift+D` / `Ctrl+Shift+D` toggles, `localStorage.devMode`, subtle cyan "dev" badge in top bar when ON). Both hydrate from localStorage on mount; both `preventDefault` on their shortcut to suppress browser defaults.
- **Screen-shake hook** — `useScreenShake()` adds `.cae-shaking` to `document.body` for 160ms; early-returns under `prefers-reduced-motion: reduce`; SSR-safe. Will fire on Sentinel merge SSE events once Phase 9 chat rail lands.
- **Top-bar refactor** — new 40px `<TopNav />` (`components/shell/top-nav.tsx`) assembles: wordmark, `<ModeToggle />` (Plan/Build segmented), `<CostTicker />` (tokens only, no USD, `est.` label, tooltip `Token usage from local logs. OAuth subscription — not billed per call.`), `<MemoryIcon />`, `<MetricsIcon />`, `<HeartbeatDot />` (green/amber/red based on `/api/state` circuit-breaker state), `<DevBadge />`, `<UserMenu />`. Shared 3-second `/api/state` poll via `<StatePollProvider />` + `useStatePoll()` hook.
- **Founder-speak copy layer** — `lib/copy/labels.ts` exports `labelFor(dev: boolean): Labels` (pure, Node-testable). Four heading client-islands (`BuildHomeHeading`, `BuildQueueHeading`, `PhaseDetailHeading`, `PlanHomeHeading`) flip copy on dev-mode toggle without re-rendering the server tree. Phase 1+2 tab labels, button text, column headers all pass the "would a PM understand this" test.

Commits: `9d05fff` through `3112aee`.

---

## v0.2 — Build core (Phase 2)

Shipped 2026-04-20.

- `/ops` home with list of active `.planning/phases/NN-*/`, status + wave progress (pre-rename; now served at `/build`).
- Phase detail route: per-task cards, wave number, current state.
- SSE live tail via `/api/tail` from tmux log files.
- Circuit-breaker panel consuming `/api/state`.
- Delegation queue at `/ops/queue` with manual form that writes `BUILDPLAN.md` to `$INBOX_ROOT` and spawns `cae execute-buildplan` via `tmux`.
- `.cae/metrics/*.jsonl` tabular viewer with live append.

---

## v0.1 — App shell + auth + mode toggle (Phase 1)

Shipped 2026-04-20.

- Next.js 15 (since upgraded to 16) App Router scaffold + TypeScript + Tailwind v4 + shadcn/ui.
- NextAuth.js v5 beta with GitHub OAuth (`auth.ts`, `middleware.ts`, re-exported `GET`/`POST` handlers).
- Top nav with `Build | Ops` mode toggle (renamed to `Plan | Build` in Phase 3).
- `/build` + `/ops` placeholder pages (routes reorganized in Phase 3).
- Session-scoped mode preference persisted to `cae-mode` cookie.
