# cae-dashboard

A single web app serving two audiences with one consistent design: a proactive mentor UI for non-technical founders (Build mode) and an operator dashboard for the CAE coding team (Ops mode). Same auth, same shell, mode toggle in top nav. Runs on the same host as CAE + Shift + Hermes — no cloud, no Docker, no billing.

## What it is

- **Build mode** — non-technical founders walk through Shift's IDEA → PRD → ROADMAP → BUILD → UAT → SHIP lifecycle with plain-English prose, one-question-at-a-time intake, approval gates, and visual progress.
- **Ops mode** — operators monitor live CAE phase execution, tail Forge sessions in real time, approve dangerous actions from the browser, and inspect `.cae/metrics/*.jsonl` streams.

## Stack

- Next.js 15 (App Router) + TypeScript + React 19
- Tailwind v4 + shadcn/ui
- NextAuth.js v5 + GitHub OAuth
- Server Actions for mutations; Server-Sent Events for live tail

## Setup

1. Create a GitHub OAuth app at https://github.com/settings/developers — set callback URL to `http://localhost:3000/api/auth/callback/github`
2. Copy `.env.example` → `.env.local` and fill in:
   - `AUTH_SECRET` — generate with `openssl rand -hex 32`
   - `AUTH_GITHUB_ID` — from your OAuth app
   - `AUTH_GITHUB_SECRET` — from your OAuth app
3. `pnpm install`
4. `pnpm dev`

## Project docs

- [PRD](.shift/PRD.md) — product spec, constraints, stack decisions
- [Roadmap](.shift/ROADMAP.md) — ordered phase breakdown

## Relationship to CAE + Shift

cae-dashboard is the web face of the CAE + Shift system. It reads existing disk state (`.shift/state.json`, `.planning/phases/`, `.cae/metrics/*.jsonl`, inbox/outbox) and writes a narrow set of mutations — it duplicates no Shift or CAE logic. All side effects route through the existing backends.
