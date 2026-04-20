# cae-dashboard — Product Spec

**Status:** draft v0.1 (drafted directly; Shift Arch spawn bug deferred)
**Last updated:** 2026-04-20

## What it is

A single web app serving two audiences with one consistent design:

- **Build mode** — proactive mentor UI for non-technical founders; wraps Shift's IDEA → PRD → ROADMAP → BUILD → UAT → SHIP lifecycle with plain-English prose, one-question-at-a-time intake, approval gates, and visual progress.
- **Ops mode** — operator dashboard for the CAE coding team; live phase execution tailing, inbox/outbox delegation queue, agent activity (Forge/Sentinel/Scout/Scribe/Phantom token burn), circuit-breaker state, dangerous-action queue, forge-branch manager, `.cae/metrics/*.jsonl` viewer.

Same auth, same shell, mode toggle in top nav. `cae.dev` eventually; localhost first.

## Who it's for

- **Founders** (Build mode): non-dev product people using Shift to go from idea to shipped code. They never see YAML, file paths, or CLI commands unless they opt in.
- **Operators** (Ops mode): developers (including Master) monitoring CAE execution, approving dangerous actions, triaging blocked builds.

Most real users will touch both modes — Shift mentors through planning, then they peek at Ops to watch CAE build.

## What "done" looks like

A user at `localhost:3000` can:

1. Sign in (OAuth — GitHub initially).
2. Toggle between Build and Ops in top nav.
3. **Build mode:** start a new Shift project (free-text intake), get drafted PRD + ROADMAP, approve each gate, watch CAE execution progress, receive UAT walkthrough at the end.
4. **Ops mode:** see every live CAE phase, tail any Forge session in real time, approve/deny Telegram-gated dangerous actions from the browser, filter metrics jsonl streams, browse the inbox/outbox queue, inspect circuit-breaker state.
5. Both modes share a single session, design language, and underlying Shift/CAE state.

## Constraints

- Reads existing `.shift/state.json`, `.planning/phases/`, `.cae/metrics/*.jsonl`, `/home/cae/inbox`, `/home/cae/outbox` — single source of truth remains disk files. FE is a view.
- Writes a narrow set of mutations: approve a Shift gate, approve a CAE dangerous action, delegate a task.
- No duplication of Shift or CAE logic in the FE — all side effects route through existing backends (`shift`, `cae`, Hermes, watcher).

## Stack decision

- **Next.js 15** (App Router) + **TypeScript** + **React 19**
- **Tailwind v4** + **shadcn/ui** components
- **Server Actions** for mutations; **Server-Sent Events** for live tail
- **Node child_process** to shell out to `shift`, `cae`, `git`, `tmux`
- **SQLite** (or just the filesystem) for user→project mapping; no Postgres yet
- **NextAuth.js v5** + GitHub OAuth provider

No Docker, no Vercel deploy, no billing, no teams. Runs on the same host as CAE + Shift + Hermes.

## Out of scope (Phase 3+)

- Multi-user tenancy
- Cloud hosting + deploys
- Mobile layouts beyond responsive tables
- Billing / usage caps
- Feature flags / A/B
