# cae-dashboard — Roadmap

**Status:** v0.1 (in progress)
**Milestone:** v0.1 — Founder-facing UI over CAE + Shift
**Design law:** `docs/UI-SPEC.md` — all phases below implement sections of that spec.

## Overview

Phases 1 and 2 shipped a functional-but-ugly proof (shell + Ops core). After Session 3/4 design lock-in, the rest of the milestone rewrites per `UI-SPEC.md`:

- Mode toggle renamed: **Plan** (Shift FE) / **Build** (CAE FE). Old Build (=Shift) is now Plan; old Ops (=CAE) is now Build.
- Memory + Metrics pulled out of tabs → global top-bar icons (accessible from both modes).
- Build tabs (5): Home / Agents / Workflows / Queue / Changes.
- Plan tabs (4): Projects / PRDs / Roadmaps / UAT.
- Non-dev founders = primary audience both modes. Explain-mode default ON; Dev-mode = ⌘Shift+D, opt-in.

## Phase 1: App shell + auth + mode toggle

**Status:** ✅ shipped (2026-04-20, session 3)

**Goal:** user can sign in with GitHub, see a layout with top nav, toggle between empty Plan and Build placeholder pages.

**Why first:** the shell is load-bearing for everything else; get auth + routing right before any feature code.

**What shipped:**
- Next.js 15 app scaffold with App Router + TypeScript + Tailwind v4 + shadcn/ui
- NextAuth.js v5 with GitHub OAuth
- Top nav with mode toggle (labels were "Build | Ops" at ship time — renamed to "Plan | Build" in Phase 2.5)
- `/build` and `/ops` routes with placeholder pages (routes reorg in Phase 2.5)
- Session-scoped mode preference persisted to cookie

## Phase 2: Build mode core — live phase dashboard

**Status:** ✅ shipped (2026-04-20, session 3)

**Goal:** operators can see every active CAE phase with live progress.

**Why:** validates Server-Sent Events + `cae` subprocess shell-out pattern before the richer Plan-mode UX.

**What shipped:**
- `/ops` home (now Build Home): list of active `.planning/phases/NN-*/` with status + wave progress
- Phase detail route: per-task cards, wave number, current state
- Live tail via SSE from tmux log files (`/api/tail`)
- Circuit-breaker state panel (`/api/state`)
- Queue route with manual delegation form (writes BUILDPLAN.md to inbox, spawns `cae execute-buildplan` via tmux)
- `.cae/metrics/*.jsonl` tabular viewer with live append

## Phase 3: Design system foundation + founder-speak copy

**Goal:** establish dark theme + Geist fonts + cyan accent + base component library; refactor top-bar and routes to the Plan/Build naming; wire ExplainMode + DevMode providers; run a founder-speak copy pass across existing Phase 1+2 surfaces.

**Why this before feature rewrites:** every downstream phase consumes these tokens, providers, and layout primitives. Doing it up-front avoids re-styling Phase 4 onward.

**What it includes:**
- Dark theme tokens per UI-SPEC §13 (`#0a0a0a` bg, `#00d4ff` accent, Geist Sans 13px base, Geist Mono 12px metadata)
- shadcn-aligned base component library (Button, Card, Tabs, Dialog, Sheet, Toast, DropdownMenu, ScrollArea, Separator)
- Geist fonts wired (replace accidental Times New Roman fallback)
- Top-bar refactor: rename toggle Build/Ops → Plan/Build; add Memory + Metrics icon slots; keep cost ticker ("est." label)
- Route reorg: `/ops/*` → `/build/*` (CAE); existing `/build/*` (Shift placeholder) → `/plan/*`; middleware protection updated
- `ExplainModeProvider` — default ON, Ctrl+E toggles, localStorage persisted
- `DevModeProvider` — default OFF, ⌘Shift+D toggles, localStorage persisted, subtle "dev" badge in top-bar when on
- Screen-shake hook (accepts Sentinel merge event, respects `prefers-reduced-motion`, subtle ~150ms)
- Founder-speak copy pass across all Phase 1+2 labels/buttons/column headers per UI-SPEC §Audience reframe

**Definition of done:**
- Dark theme visible on all existing routes, no Times New Roman anywhere
- Toggle reads "Plan | Build"; clicking routes to `/plan` and `/build`
- Memory + Metrics icon buttons in top bar (route to stub pages, full content in later phases)
- Ctrl+E toggles explain-mode tooltip visibility; ⌘Shift+D toggles dev-mode badge + technical labels
- Phase 1 auth flow + Phase 2 existing routes still functional after rename
- All tab labels / buttons / column headers pass "non-dev founder" readability

**Plans:** 6 plans

Plans:
- [x] 03-01-PLAN.md — Dark theme tokens + Geist fonts + shake keyframes (wave 1)
- [x] 03-02-PLAN.md — ExplainMode + DevMode providers + useScreenShake hook + Toaster mount (wave 2)
- [x] 03-03-PLAN.md — Top-bar refactor (Plan/Build toggle + Memory/Metrics icons + tokens-only cost ticker + heartbeat + dev badge + shared /api/state poll hook) (wave 3)
- [x] 03-04-PLAN.md — Route reorg (/ops → /build, /build → /plan, /memory + /metrics stubs) + middleware (wave 2)
- [x] 03-05-PLAN.md — Founder-speak copy pass + centralized label dictionary + heading client-islands (wave 4)
- [x] 03-06-PLAN.md — Shadcn primitives: Dialog, Sonner (Toast), ScrollArea (wave 1)

## Phase 4: Build Home rewrite (hierarchy + rollup + needs-you)

**Goal:** Build mode `/build` home shows the hierarchy view from UI-SPEC §3 — rollup strip, Active phases cards, Needs-you actionable list, Recent ledger.

**What it includes:**
- Rollup strip (today's shipped / tokens / burn / in-flight / blocked)
- Active phase cards with live progress bars + ETA + wave count
- "Needs you" list with per-row actions (Review / Approve / Deny / Open)
- Recent 20 events (✓/✗ rows with timestamps + agent + token usage)
- Click phase card → right-slide task detail sheet (UI-SPEC §5)
- Live Ops one-liner pinned above Active Phases (agent assignment real-time)

**Plans:** 6 plans

Plans:
- [x] 04-01-PLAN.md — /api/state extension + home-state aggregator + useStatePoll type extension (wave 1)
- [x] 04-02-PLAN.md — agent-meta.ts + labels.ts Phase 4 copy extension (wave 1)
- [x] 04-03-PLAN.md — Rollup strip + Live Ops line + Active phase cards + Agent avatars (wave 2)
- [x] 04-04-PLAN.md — Needs-you list + Recent ledger (wave 2)
- [x] 04-05-PLAN.md — Task detail sheet + SSE live log + keyboard shortcuts (wave 3)
- [x] 04-06-PLAN.md — Integration: mount widgets on /build + delete superseded Phase 2 widgets + a11y pass (wave 4)

## Phase 5: Agents tab

**Goal:** Build mode `/build/agents` — agent roster with sparklines + detail drawer per UI-SPEC §6.

**What it includes:**
- Grid of agent cards (9 agents) with token/hr sparkline, 7d success rate, avg wall time
- Grouping: Active / Recently used / Dormant
- Card click → full drawer: persona MD render, model override (stub), lifetime stats, last 50 invocations, drift banner
- Idle-agent card variant ("inactive 6d · last run Thu")
- Founder-speak headlines ("Forge — the builder")
- Left-rail (5 tabs) added to /build layout — Home · Agents · Workflows · Queue · Changes
- Stub routes for /build/workflows (Phase 6) and /build/changes (Phase 9) so rail has no broken links
- Data API: /api/agents roster + /api/agents/[name] detail, aggregated from .cae/metrics/*.jsonl across projects
- Drift detection: 7d success rate < 85% of 30d baseline (with >=5 samples in 7d)

**Plans:** 4 plans

Plans:
- [x] 05-01-PLAN.md — Data API (/api/agents + [name]) + cae-agents-state aggregator + Sparkline primitive + labels.ts agents.* keys (wave 1)
- [x] 05-02-PLAN.md — BuildRail left-nav + /build layout rewrite + stub routes for /build/workflows + /build/changes (wave 1)
- [x] 05-03-PLAN.md — /build/agents page + AgentGrid + AgentCard (active + idle variants + drift indicator) (wave 2)
- [x] 05-04-PLAN.md — AgentDetailDrawer (persona MD + model override + drift banner + lifetime stats + recent invocations) + integration + a11y + Phase 5 VERIFICATION (wave 3)

## Phase 6: Workflows + Queue

**Goal:** Unified YAML workflow abstraction + KANBAN queue per UI-SPEC §4 + §7.

**What it includes:**
- Workflows tab: list + Monaco YAML editor + preview step graph + Run-now button
- Sub-tabs: Definitions · Schedule
- Queue tab (sibling to Workflows): KANBAN columns using founder-speak (Waiting / In progress / Double-checking / Stuck / Shipped)
- Cards with agent avatar + urgency + tags + live pulse
- Card click → right-slide detail sheet
- Chat-first workflow drafting (Nexus drafts from natural language; YAML behind Advanced toggle)

**Plans:** 6 plans

Plans:
- [x] 06-01-PLAN.md — Workflow domain: schema + YAML parser + file CRUD + NL heuristic + labels.ts workflows/queue keys (wave 1)
- [x] 06-02-PLAN.md — API routes: /api/workflows CRUD + /[slug]/run (tmux spawn) + /api/queue aggregator (wave 2)
- [x] 06-03-PLAN.md — Widgets: StepGraph SVG + MonacoYamlEditor (dynamic import) + NlDraftTextarea (wave 2)
- [x] 06-04-PLAN.md — /build/workflows list + new + [slug] edit pages with dev-mode-gated Monaco (wave 3)
- [x] 06-05-PLAN.md — /build/queue 5-column KANBAN rewrite + New-job modal wrapping Phase 2 DelegateForm (wave 4)
- [x] 06-06-PLAN.md — Integration + VERIFICATION.md + human sign-off checkpoint (wave 5)

## Phase 7: Metrics (global top-bar icon → page)

**Goal:** `/metrics` — 3 panels (Spending / How well it's going / How fast) per UI-SPEC §8 + §Audience reframe.

**What it includes:**
- Spending panel: today + MTD + projected monthly; stacked bar by agent; 30d line; top 10 expensive tasks; "est." disclaimer
- How-well-it's-going panel: per-agent success gauges; retry heatmap; halt events log; Sentinel reject trend
- How-fast panel: P50/P95 wall time; queue depth; time-to-merge distribution
- Founder-speak copy throughout ("CAE is getting things right 94% of the time this week")

## Phase 8: Memory (global top-bar icon → page) + Graphify

**Goal:** `/memory` — browse + graph per UI-SPEC §9 + §S4.5 with a REAL event-based "Why?" trace (via Claude Code PostToolUse hook on Read tool), heuristic fallback for legacy tasks.

**What it includes:**
- Browse: file tree (AGENTS.md, KNOWLEDGE/, .claude/agents/, agents/cae-*.md, .planning/phases/*/*.md); markdown render via react-markdown + remark-gfm; full-text search (ripgrep-backed)
- "Why?" button on Build events → REAL memory-consult trace via PostToolUse hook writing to `.cae/metrics/memory-consult.jsonl`; heuristic fallback (`files_modified ∩ memory_sources`) for pre-hook tasks, explicitly labelled distinctly
- Memory git-log timeline (per-file) with diff-between-dates
- Graph view: safishamsi/graphify CLI (`--mode fast --no-viz`) → `.cae/graph.json` at CAE_ROOT → native @xyflow/react + @dagrejs/dagre render (no iframe)
- Filter UI by node type — 4 chips (phases/agents/notes/PRDs); commits OFF in v1
- Click node → drawer with content + back-links + open-timeline
- Manual "Regenerate graph" button — 60s client debounce + server 429 cooldown; cron deferred
- 500-node cap with "showing N of M" banner
- New `components/ui/explain-tooltip.tsx` as shared primitive (moved from components/metrics/)
- Vitest wired for the first time (was planned in Phase 6, installed here)
- Cross-subtree: `adapters/claude-code.sh` exports `CAE_TASK_ID`; `~/.claude/settings.json` gets PostToolUse hook registration; new `tools/memory-consult-hook.sh`

**Plans:** 8 plans

Plans:
- [x] 08-01-PLAN.md — Wave 0 prereqs: graphify install + npm deps (@xyflow/react@12.10.2, @dagrejs/dagre@3.0.0, react-markdown@10.1.0, remark-gfm@4.0.1) + Vitest + RF css in globals.css + ExplainTooltip relocation + .cae/ gitignore + fixture graphify run (wave 0)
- [x] 08-02-PLAN.md — Wave 1 Why?-real plumbing: memory-consult-hook.sh + settings.json PostToolUse registration + adapter CAE_TASK_ID export + lib/cae-memory-consult.ts aggregator + /api/memory/consult/[task_id] (wave 1)
- [x] 08-03-PLAN.md — Wave 2 server modules (sources/search/git/graph/whytrace) + 7 API routes + memory.* labels (wave 2)
- [x] 08-04-PLAN.md — Wave 3 Browse tab: FileTree + MarkdownView + SearchBar + SearchResults (wave 3, parallel with 08-05)
- [x] 08-05-PLAN.md — Wave 3 Graph tab: GraphCanvas + dagre layout + 4-chip filters + NodeDrawer + RegenerateButton (wave 3, parallel with 08-04)
- [x] 08-06-PLAN.md — Wave 4 WhyDrawer (real trace + heuristic fallback) + GitTimelineDrawer + DiffView (wave 4)
- [x] 08-07-PLAN.md — Wave 5 /memory/page.tsx server shell + MemoryClient (Tabs + mounted drawers + deep-link query params) (wave 5)
- [x] 08-08-PLAN.md — Wave 6 08-VERIFICATION.md + verify-memory-hook.sh + human UAT (wave 6, non-autonomous)

## Phase 9: Changes tab + right-rail chat

**Status:** ✅ shipped (2026-04-23, session 5) — 8/8 plans complete

**Goal:** Build mode `/build/changes` + persistent chat rail per UI-SPEC §10 + §12 + §Audience reframe.

**What it includes:**
- Changes: prose-default timeline grouped by project (SHAs/diffs only when Dev-mode on) via `git log --all --merges` aggregator + circuit-breakers.jsonl join
- Right-rail chat: collapsed 48px icon column with unread dot, expanded 300px (click-toggle — Ctrl+T deferred to Phase 12 ⌘K palette since Chromium steals the binding)
- Per-agent voices (Nexus/Forge/Sentinel/Scout/Scribe/Phantom/Aegis/Arch/Herald) via `claude --print --resume --append-system-prompt-file docs/voices/<agent>.md`; SSE stream back to client
- `docs/VOICE.md` + 9 persona fragments shipped in Wave 0 with optional user sign-off
- Chat `/chat` full-page 50/50 split route (left: Build-surface mirror picker; right: chat panel)
- Suggested actions hardcoded per-route in `lib/chat-suggestions.ts` (3 chip buttons below input)
- Nexus "always explain before doing" gate on token-spending actions: `ConfirmActionDialog` with token estimate + plain-English summary, gated at `tokens >= 1000`; Dev-mode bypasses with undo toast

**Plans:** 8/8 plans executed

Plans:
- [x] 09-01-PLAN.md — Wave 0: `docs/VOICE.md` + 9 persona fragments + voice-router + chat-suggestions + chat-cost-estimate libs with tests (wave 0)
- [x] 09-02-PLAN.md — Wave 1a: Changes aggregator (`lib/cae-changes-state.ts`) + `/api/changes` route + BOTH `changes.*` and `chat.*` label keys in `lib/copy/labels.ts` (wave 1, parallel with 09-03)
- [x] 09-03-PLAN.md — Wave 1b: Chat API routes (`/api/chat/{send,state,history/[sessionId],sessions}`) + `lib/cae-chat-state.ts` + `lib/chat-spawn.ts` (wave 1, parallel with 09-02)
- [x] 09-04-PLAN.md — Wave 2a: `/build/changes` page + `changes-client.tsx` + `components/changes/{project-group,day-group,change-row,dev-mode-detail}.tsx` (wave 2, parallel with 09-05)
- [x] 09-05-PLAN.md — Wave 2b: ChatRailProvider + `components/chat/{chat-rail,chat-panel,message,suggestions}.tsx` mounted in `app/layout.tsx` (wave 2, parallel with 09-04)
- [x] 09-06-PLAN.md — Wave 3: ConfirmActionDialog + useGatedAction hook + wiring into existing token-spending server actions (queue delegate, workflows Run-now) (wave 3)
- [x] 09-07-PLAN.md — Wave 4: `/chat` full-page split route + ChatMirror picker + top-nav pop-out icon (wave 4)
- [x] 09-08-PLAN.md — Wave 5: 09-VERIFICATION.md + UAT auto-approved (239/239 tests, tsc, lint, build all green; browser UAT deferred) (wave 5)

## Phase 10: Plan mode — Projects / PRDs / Roadmaps / UAT

**Goal:** `/plan/*` routes wrapping Shift for non-dev founders.

**What it includes:**
- `/plan` home: project cards with lifecycle badges
- New-project wizard (one question at a time, Nexus-narrated)
- Server action → `shift new <name>` backend
- PRD preview with Approve / Refine / Explain
- ROADMAP draft + approve gate
- Auto-generation of `.planning/phases/NN-*/PLAN.md` from approved ROADMAP phase 1
- "Ship it" button fires `cae execute-phase N` and hands off to Build mode
- UAT checklist derived from ROADMAP success criteria; per-item pass/fail
- Ship wizard: env vars + `gh repo create` + `git push`

## Phase 11: Live Floor (pixel-agents isometric overlay)

**Goal:** top-bar Live Floor 🎮 toggle opens isometric CAE HQ scene per UI-SPEC §11.

**What it includes:**
- Fork pablodelucca/pixel-agents (MIT)
- Port to Next.js canvas/WebGL
- CAE HQ scene (Nexus hub, Forge forge, Sentinel watchtower, Scout overlook, Scribe library, Phantom shadow realm, Aegis armory, Arch drafting table, Herald pulpit, loading bay)
- Event animations (merge fireworks, reject X, Phantom walk, alarm flash)
- Pop-out to separate window for second-monitor use

**Progress:** 11-01 ✅ (wave-0 pure libs) | 11-02 ✅ (canvas render component) | 11-03 ✅ (useFloorEvents hook + cb-path + canvas refactor) | 11-04 ✅ (toolbar + page shell + FloorClient) | 11-05 ✅ (pop-out route + FloorPopoutHost + return-to-main)

## Phase 12: Command palette + polish + empty states

**Goal:** ⌘K palette + empty-state copy + final polish pass.

**What it includes:**
- ⌘K fuzzy palette across projects/tasks/agents/workflows/memory/commands
- Empty states with guided actions per tab
- Keyboard shortcuts help overlay (?)
- Accessibility audit (axe clean)
- `prefers-reduced-motion` audit (shake + pulse respect)
- Explain-mode copy QA pass

**Progress:**
- [x] Plan 12-01: Wave 0 prereqs (fuzzysort, axe-cli, KEYBINDINGS, motion CSS, audit scripts)
- [x] Plan 12-02: Palette pure libs + CommandPalette + ShortcutOverlay (49 tests)
- [x] Plan 12-03: Empty-state library (EmptyState primitive + 31 labels keys + 9 surfaces migrated)
- [x] Plan 12-04: Polish + mount (layout wiring, provider keybindings migration, audits)

## Phase 13: UI/UX review + polish loop (expanded scope)

**Goal:** close the UX quality gap — data correctness + liveness + functionality completeness + logging, then Mission-Control-grade IA + 6 visual pillars.

**What it includes:**
- Data correctness: screenshot each panel, verify shown numbers against source-of-truth files. Flag P0 on mismatch. Uses `/usr/local/bin/screenshot-url` + Python verify harness.
- Liveness: tab-visibility pause, `<LastUpdated>` primitive, `Liveness` health chip mirroring MC "Live · 28ms" pattern, SSE heartbeat.
- Functionality completeness: clickwalk every route, expected-vs-actual per button/form.
- Logging: pino structured JSON + AsyncLocalStorage correlation IDs + `withLog()` wrapper across routes + Incident Stream panel reusing tail-stream.
- Mission Control IA adoptions: ambient clock + latency chip, persistent alert banner, Golden Signals copy on metrics, agent-verb A/B (Wake/Spawn/Hide).
- WR-01 fix: SSE id stability (chat unread count always 0 regression — standalone plan).
- Visual 6 pillars: hierarchy, density, consistency, motion, typography, color — with explicit score thresholds.

**Progress:** 8 plans complete
- [x] 13-01-PLAN.md — verify harness scaffold (Playwright + capture.sh + verify.py + routes.json)
- [x] 13-02-PLAN.md — baseline capture (BASELINE.md + public-route screenshots + console baseline)
- [x] 13-03-PLAN.md — data correctness audit (17-panel verify.py + VERIFY.md + UI-AUDIT-correctness.md + WR-01 confirmed)
- [x] 13-04-PLAN.md — WR-01 fix (stable assistantMsgId per SSE stream + client promotion fix + 19 new tests)
- [x] 13-05-PLAN.md — pino structured logging rollout (withLog HOF + 22 routes + 35 console.* conversions + client error bridge + JSONL file sink)
- [x] 13-06-PLAN.md — liveness audit fixes (tab-visibility pause + LastUpdated chip + LivenessChip RTT + HeartbeatDot + SSE health hooks)
- [x] 13-07-PLAN.md — MC IA adoptions (ambient clock + alert banner + Golden Signals subtitles + agent verb A/B)
- [x] 13-08-PLAN.md — Incident Stream SSE panel + DebugBreadcrumbPanel + client log bus (Wave 5, 36 new tests)
- [x] 13-09-PLAN.md — master 6-pillar visual audit + build-home/top-nav polish (Wave 6a, rollup card grid + Lucide + WCAG text-dim fixes)
- [x] 13-10-PLAN.md — agents/queue/changes/workflows pillar polish (Wave 6b, MC agent cards + queue chrome + timeline hierarchy)
- [x] 13-11-PLAN.md — memory/metrics/chat/plan/signin pillar polish + shared Panel primitive (Wave 6c, 13 surfaces ≥3 on all pillars)

## Phase 14: Orchestration depth — Skills Hub + cron + RBAC

**Goal:** deepen CAE's orchestration surface — Skills marketplace, natural-language scheduling, role-based access.

**What it includes:**
- Skills Hub marketplace — ClawdHub + skills.sh browse/install inside the dashboard.
- Natural-language cron scheduling ("every morning at 9am", "every weekday 7pm") → CronCreate-backed routines.
- Role-based access — viewer/operator/admin roles gated via Google SSO.
- Trust scoring for installed skills + secret detection + MCP call auditing surfaced in a Security panel.

**Plans:** 12/12 plans complete

Plans:
- [ ] 14-01-PLAN.md — Wave 0 scaffold: deps + gitleaks + fixtures + types + labels + audit-hook + skill-install wrapper (wave 0)
- [ ] 14-02-PLAN.md — Skills Hub: 3-source catalog scraper + install SSE + /build/skills page + detail drawer (wave 1)
- [ ] 14-03-PLAN.md — NL cron: rule-based parser + cronstrue describe + scheduled_tasks.json + system-cron watcher (wave 2)
- [ ] 14-04-PLAN.md — RBAC: Google provider + role callbacks + middleware gates + /build/admin/roles + RoleGate (wave 3)
- [ ] 14-05-PLAN.md — Security panel: trust score + gitleaks scan + PostToolUse audit log + /build/security (wave 4)
- [ ] 14-06-PLAN.md — Integration tests + VERIFICATION.md + BuildRail lock + docs/ENV + Eric UAT (wave 5)

## What we'll defer to v2 or later

- Multi-user / teams / permissions
- Cloud deploy (Vercel / Fly)
- Mobile apps (Telegram deep-link surface exists; native later)
- Advanced metrics (graph drill-downs, aggregations)
- Plugin / extension API
- Billing / usage caps
