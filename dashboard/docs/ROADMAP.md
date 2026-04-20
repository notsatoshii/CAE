# cae-dashboard — Roadmap

**Status:** draft v0.1
**Note:** ordered steps only — no timelines, no estimates.

## Overview

Build the shell first (auth + layout + mode toggle), then Ops mode (the higher-signal/lower-risk half, and the half Master wants most), then Build mode (wraps Shift), then shared polish + wiring.

## Phase 1 — App shell + auth + mode toggle

**Goal:** user can sign in with GitHub, see a layout with top nav, toggle between empty Build and Ops placeholder pages.

**Why this first:** the shell is load-bearing for everything else; get auth + routing right before any feature code.

**What it includes:**
- Next.js 15 app scaffold with App Router + TypeScript + Tailwind v4 + shadcn/ui
- NextAuth.js v5 with GitHub OAuth
- Top nav with mode toggle (Build | Ops), active-route highlighting
- `/build` and `/ops` routes with placeholder pages
- Session-scoped mode preference persisted to cookie

**Definition of done:**
- `npm run dev` serves at localhost:3000
- unauthenticated user redirected to sign-in
- authenticated user sees shell + can toggle modes
- mode preference persists across reloads

## Phase 2 — Ops mode: live phase dashboard

**Goal:** operators can see every active CAE phase with live progress.

**Why second:** validates Server-Sent Events + `cae` subprocess shell-out pattern on the simpler side before tackling Build's richer UX.

**What it includes:**
- `/ops` home: list of active `.planning/phases/NN-*/` with status + wave progress
- Phase detail: per-task cards (plan title, wave number, current state)
- Live tail of running Forge/Sentinel via SSE from tmux log files
- Circuit-breaker state panel (current token burn, concurrent Forge count, retry counts)
- `.cae/metrics/*.jsonl` tabular viewer with live append

**Definition of done:**
- Phase list auto-refreshes as `.planning/phases/` changes on disk
- Live tail streams stdout of running tmux sessions without polling
- Metrics table shows last 100 events per stream

## Phase 3 — Ops mode: delegation queue + dangerous-action gate

**Goal:** inbox/outbox visibility + in-browser approval for dangerous actions.

**What it includes:**
- `/ops/queue` inbox + outbox view (task_id, status, age, links to BUILDPLAN + DONE)
- Manual delegation: form to write a new BUILDPLAN.md to inbox
- Dangerous-action approval UI — polls `bin/telegram_gate.py` state, lets operator approve/deny from browser instead of Telegram
- Forge-branch manager: list `forge/*` branches with merge/abandon buttons

**Definition of done:**
- dangerous action logged by CAE surfaces in UI within 5s
- approval routes through existing gate — Telegram stays as fallback
- new delegation writes valid BUILDPLAN.md that CAE picks up

## Phase 4 — Build mode: Shift project intake

**Goal:** a founder can start a new project from the web, walk intake, get PRD drafted.

**What it includes:**
- `/build` home: project list cards (each showing phase — idea/research/prd/roadmap/execute/uat/ship)
- New project wizard: one-question-at-a-time intake (matching Shift's tone)
- Server action invokes `shift new <name>` backend
- PRD preview pane with Approve / Refine / Explain buttons
- Plain-English narration of each step

**Definition of done:**
- new project persists to `.shift/state.json` via backend
- PRD draft renders in browser with approve gate
- UI mirrors Shift CLI UX (no YAML, no file paths)

## Phase 5 — Build mode: roadmap + CAE handoff

**Goal:** approved ROADMAP → first CAE phase auto-scaffolded + executing.

**What it includes:**
- ROADMAP draft + approve gate
- Automatic generation of `.planning/phases/01-*/PLAN.md` from approved ROADMAP phase 1 (fills the current Shift gap)
- "Ship it" button that fires `cae execute-phase 1` server-side
- Live progress handoff to Ops mode (or an embedded mini-progress panel)

**Definition of done:**
- approved ROADMAP produces valid PLAN.md
- `cae execute-phase` fires from UI
- progress visible without leaving Build mode

## Phase 6 — Build mode: UAT + ship

**Goal:** walk user through manual UAT, commit + push to their GitHub repo.

**What it includes:**
- UAT checklist derived from ROADMAP success criteria
- Per-item pass/fail UX with plain-English prompts
- Ship wizard: collect env vars, create GitHub repo via `gh`, push
- Final "project shipped" page with links

**Definition of done:**
- UAT item pass/fail persisted to state
- `gh repo create` + `git push` from UI
- project card moves to `shipped` state

## Phase 7 — Shared polish

**What it includes:**
- Design system pass (spacing, colors, typography audit)
- Error states + empty states everywhere
- Keyboard shortcuts (mode toggle, approve, deny)
- Loading states via React Suspense + streaming
- Accessibility audit (axe DevTools clean)
- Dark mode

**Definition of done:**
- no `console.error` in happy path
- axe clean
- keyboard-only flow possible for both modes

## What we'll defer to v2 or later

- Multi-user / teams / permissions
- Cloud deploy (Vercel / Fly)
- Mobile apps
- Advanced metrics (graphs, aggregations)
- Plugin / extension API
- Billing / usage caps
