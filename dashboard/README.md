<!-- generated-by: gsd-doc-writer -->
# cae-dashboard

**A single web app that non-dev founders use to plan features, watch the CAE coding team build them, and ship.**

Two modes, one shell. One auth. One codebase. Local host, no cloud.

## What problem this solves

Founders without engineering chops can drive CAE + Shift from chat + CLI, but reviewing what the agents are doing, approving dangerous actions, and catching a silent halt means hopping between `.planning/`, `.cae/metrics/*.jsonl`, Telegram pings, and tmux sessions. This dashboard collapses all of that into one browser tab — with plain-English copy by default and a hidden dev-mode flip (`Ctrl+Shift+D`) for when you do want the SHAs.

## What this is

- **Plan mode** (`/plan`) — Shift's project + PRD + roadmap + UAT surface. Currently a stub page; full workflow ships in Phase 10.
- **Build mode** (`/build`) — the live surface for the CAE coding team. Today covers: Home (`/build`), Agents (`/build/agents`), Workflows (`/build/workflows`), Queue (`/build/queue`). Changes tab (`/build/changes`) is a stub awaiting Phase 9.
- **Global top-bar icons** — Memory (`/memory`) and Metrics (`/metrics`) are stubs awaiting Phases 7 + 8.

Semantic: *Plan the work, then Build it.* The mode toggle lives in the top bar; tab sets are mode-scoped.

## Quick start

```bash
pnpm install
pnpm dev
```

Then sign in with GitHub at `http://localhost:3000/signin`.

### First-time setup

1. Create a GitHub OAuth app at https://github.com/settings/developers. Callback URL: `http://localhost:3000/api/auth/callback/github`.
2. Copy `.env.example` → `.env.local` and fill `AUTH_SECRET` (generate with `openssl rand -hex 32`), `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`.
3. `pnpm install`.
4. `pnpm dev` (Next.js runs on `:3000` by default; Turbopack picks an alternate port if taken).

The dashboard reads disk state from `$CAE_ROOT` (defaults to `/home/cae/ctrl-alt-elite`), `$INBOX_ROOT` (`/home/cae/inbox`), `$OUTBOX_ROOT` (`/home/cae/outbox`). Override via env vars if your layout differs.

## What makes it different

- **No USD anywhere.** Cost ticker shows tokens only: `48k tok today · est.` The project runs on an Anthropic OAuth subscription — not billed per call — so dollar amounts would be wrong by construction.
- **Founder-speak by default, dev-mode on demand.** Every user-visible label has a founder/dev pair. `Ctrl+Shift+D` flips the whole app: founder labels become SHAs, YAML, wave numbers. Persisted in `localStorage.devMode`.
- **Explain-mode on by default.** `Ctrl+E` toggles inline jargon tooltips. Persisted in `localStorage.explainMode`. Default `true` (UI-SPEC §S4.6).
- **Reads disk, writes narrow mutations.** No backing database. State comes from `.planning/phases/**/*.md`, `.cae/metrics/*.jsonl`, inbox/outbox dirs. Mutations route through existing CAE + Shift backends (tmux spawn, file writes) — the dashboard owns none of the business logic.

## Architecture at a glance

```
┌─────────────────────────────────────────────────────────────────┐
│  Top nav (40px) — wordmark · [Plan|Build] · ticker · 🧠 · 📊   │
├──┬──────────────────────────────────────────────────────────────┤
│  │ /plan (Phase 10 stub)                                        │
│  │ /build ← Home (rollup · phases · needs-you · recent)         │
│ 48│ /build/agents ← grid + drawer                                │
│ px│ /build/workflows ← list · new · [slug] · Monaco (dev-mode)  │
│   │ /build/queue ← 5-col KANBAN (Waiting→In progress→Shipped)   │
│  │ /build/changes (Phase 9 stub)                                │
│  │ /memory · /metrics (global stubs — Phases 7 + 8)             │
└──┴──────────────────────────────────────────────────────────────┘
                │
                ▼
     Server actions + /api routes (state, tail, agents, workflows, queue)
                │
                ▼
     Disk: $CAE_ROOT/.planning/**, /.cae/metrics/*.jsonl, $INBOX_ROOT, $OUTBOX_ROOT
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the module map and data flow.

## Module roster

| Area | Path |
|---|---|
| Root shell + auth + providers | `app/layout.tsx`, `auth.ts`, `middleware.ts` |
| Top-bar chrome | `components/shell/top-nav.tsx` + `mode-toggle.tsx` + `cost-ticker.tsx` + `memory-icon.tsx` + `metrics-icon.tsx` + `heartbeat-dot.tsx` + `dev-badge.tsx` |
| Build left-rail | `components/shell/build-rail.tsx` |
| Build Home widgets | `components/build-home/*.tsx` (rollup, live-ops, active-phase, needs-you, recent, task-detail sheet) |
| Agents tab | `app/build/agents/page.tsx` + `components/agents/*.tsx` |
| Workflows | `app/build/workflows/**` + `components/workflows/*.tsx` + `lib/cae-workflows.ts` + `lib/cae-workflows-schema.ts` + `lib/cae-nl-draft.ts` |
| Queue | `app/build/queue/**` + `lib/cae-queue-state.ts` |
| Global providers | `lib/providers/explain-mode.tsx` + `lib/providers/dev-mode.tsx` + `lib/hooks/use-state-poll.tsx` |
| Copy dictionary | `lib/copy/labels.ts` + `lib/copy/agent-meta.ts` |
| Disk adapters | `lib/cae-state.ts` + `lib/cae-config.ts` + `lib/cae-home-state.ts` + `lib/cae-agents-state.ts` + `lib/cae-phase-detail.ts` |

Internal conventions, gotchas, and poll-interval decisions live in [AGENTS.md](./AGENTS.md).

## Status (honest)

| Phase | Status | What's there |
|---|---|---|
| 1 — Shell + auth + mode toggle | Shipped | GitHub OAuth, Plan/Build toggle, cookie-persisted mode |
| 2 — Build core | Shipped | Phase detail route, SSE tail, circuit-breaker panel, delegation queue |
| 3 — Design system + routes | Shipped | Dark tokens, Geist fonts, shadcn Dialog/Sonner/ScrollArea, `/ops`→`/build` + `/build`→`/plan` reorg, ExplainMode + DevMode providers, founder-speak labels |
| 4 — Build Home rewrite | Shipped | Rollup strip, Active phases, Needs-you, Recent ledger, TaskDetailSheet with SSE live log |
| 5 — Agents tab | Shipped | `/build/agents` grid + sparklines + detail drawer with persona MD + drift banner |
| 6 — Workflows + Queue | Shipped | Workflows list/new/[slug] + Monaco YAML (dev-mode) + NL draft + step graph; 5-col KANBAN at `/build/queue` |
| 7 — Metrics panels | Planned | `/metrics` is currently a stub |
| 8 — Memory + Graphify | Planned | `/memory` is currently a stub |
| 9 — Changes + right-rail chat | Planned | `/build/changes` is currently a stub |
| 10 — Plan mode (Projects · PRDs · Roadmaps · UAT) | Planned | `/plan` is currently a stub |
| 11 — Live Floor (isometric pixel-agents) | Planned | |
| 12 — ⌘K palette + polish | Planned | |

Phase-by-phase plans, completion status, and task-level DoD live in [.planning/ROADMAP.md](./.planning/ROADMAP.md).

## Stack

- Next.js 16 (App Router) + TypeScript + React 19
- Tailwind v4 (inline `@theme`) + shadcn/ui (base-ui backed, `style: "base-nova"`)
- NextAuth.js v5 (beta) with GitHub OAuth
- Server Actions for mutations; Server-Sent Events via `/api/tail` for live log streaming
- `yaml` v2 for workflow specs; `@monaco-editor/react` for the dev-mode YAML editor (dynamic import, `ssr: false`)
- Package manager: `pnpm`

## Project docs

- [ARCHITECTURE.md](./ARCHITECTURE.md) — module map + data flow + extension points
- [CHANGELOG.md](./CHANGELOG.md) — what landed per phase
- [AGENTS.md](./AGENTS.md) — internal conventions, patterns that work, gotchas
- [docs/UI-SPEC.md](./docs/UI-SPEC.md) — design contract (session 4 resolutions are authoritative)
- [docs/PRD.md](./docs/PRD.md) — product spec
- [.planning/ROADMAP.md](./.planning/ROADMAP.md) — ordered phase breakdown

## FAQ

**Why no dollar amounts?** The project uses an Anthropic OAuth subscription, so per-call pricing doesn't apply. Showing tokens is truthful; showing USD would be wrong.

**Why is `Ctrl+E` different from `Ctrl+Shift+D`?** Explain-mode (`Ctrl+E`) toggles tooltip jargon glossaries — meant for founders who hit a term they don't know. Dev-mode (`Ctrl+Shift+D`) swaps the whole UI over to technical copy (SHAs, YAML-first workflows, raw agent names) — meant for engineers operating the thing.

**Does it run in the cloud?** No. It's designed for single-user local host on the same machine as CAE, Shift, Hermes, and the target project checkouts. Multi-user, teams, and cloud deploy are out of scope for v0.3.

**Where does it store state?** It doesn't. All reads hit disk (`$CAE_ROOT/.planning/**`, `.cae/metrics/*.jsonl`, `$INBOX_ROOT`, `$OUTBOX_ROOT`). All writes route through Shift/CAE backends (file writes + tmux spawn for `cae execute-buildplan`).

**Can I ship my own workflow?** Yes — either draft one in natural language on `/build/workflows/new` (founder mode) or author the YAML directly with dev-mode on (`Ctrl+Shift+D`). Schema lives in `lib/cae-workflows-schema.ts`; files land at `$CAE_ROOT/.cae/workflows/*.yml`. Run-now posts to `POST /api/workflows/[slug]/run` which spawns a detached tmux session.

## Phase 14 dev setup

Phase 14 adds Skills Hub, NL cron scheduling, RBAC, and a Security panel.

### 1. Install gitleaks

```bash
bash scripts/install-gitleaks.sh
```

The script is idempotent — it skips the download if `gitleaks` is already on `$PATH`.
It pins version 8.18.4. Override with `GITLEAKS_VERSION=X.Y.Z bash scripts/install-gitleaks.sh`.

### 2. scheduled_tasks.json

A mutable runtime registry lives at the repo root (`/home/cae/ctrl-alt-elite/scheduled_tasks.json`).
It is created empty on first run and is gitignored (state file, not source).
The NL cron UI writes to it; the cron watcher reads from it.

### 3. Env vars (coming in Plan 14-04)

Google OAuth credentials for the RBAC sign-in flow will be documented in Plan 14-04.
Placeholders to set when that plan ships:

```bash
# .env.local (Plan 14-04)
# AUTH_GOOGLE_ID=...
# AUTH_GOOGLE_SECRET=...
```

## License

Private / unpublished. Part of the Ctrl+Alt+Elite repo at `notsatoshii/CAE`.
