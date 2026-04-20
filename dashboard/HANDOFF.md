# cae-dashboard — session handoff

**Date:** 2026-04-20 (session 3)
**Context at handoff:** ~65%
**Next session starts here:** read this file + `dashboard/docs/UI-SPEC.md`

---

## Quick orient

- **Phase 1 (shell + auth + toggle):** ✅ shipped (`main` — 4 Sentinel-approved merges)
- **Phase 2 (Ops core — state lib, phase list, tail, breakers, queue, phase detail):** ✅ shipped (6 Sentinel-approved merges)
- **Dashboard LIVE at:** http://165.245.186.254:3003 (dev server; GitHub OAuth configured)
- **UI-SPEC.md** at `dashboard/docs/UI-SPEC.md` is the LAW — the built UI is now considered a functional-but-ugly proof. Phase 2.5 onward rewrites per spec.

---

## What's working RIGHT NOW

- `pnpm dev` serves on :3003
- GitHub OAuth flow (creds in `.env.local`, NOT tracked in git)
- `/signin`, `/build`, `/ops`, `/ops/phase/[num]`, `/ops/queue` all 200
- Middleware protects `/build` + `/ops` — redirects to `/signin?from=...`
- Real CAE data piped through: reads from `/home/cae/ctrl-alt-elite/.planning/`, `/home/cae/inbox`, `/home/cae/outbox`, `.cae/metrics/*.jsonl`
- Live tail SSE at `/api/tail` (path-gated)
- Live breakers state at `/api/state`
- Manual delegation form at `/ops/queue` → writes to inbox + spawns `cae execute-buildplan` via tmux

---

## Known UI ugliness (being rewritten per UI-SPEC)

- Default Times New Roman (Geist font never loaded properly — scaffold bug)
- Light mode only (spec requires dark default)
- Generic shadcn placeholder layout
- No hierarchy, density, or CAE-native state machine reflected
- Empty states = empty

---

## UI-SPEC.md summary

Read `dashboard/docs/UI-SPEC.md` for the full 400-line design doc. Key decisions locked:

**Visual system:** dark default (`#0a0a0a` bg), cyan accent (`#00d4ff`), Geist Sans 13px base, Geist Mono 12px metadata, Linear-subtle motion

**Voice:** **Nexus** = playful smart-ass (matches Eric's persona). Each agent has distinct voice in chat. Voice-guidelines doc (`docs/VOICE.md`) needs writing before chat ships.

**IA:**
- Top bar: CAE · Build/Ops · project · **cost ticker** · ⌘K · heartbeat · avatar
- Left rail: 48px icon-only tabs
- Right rail: chat (collapsed 48px default, Ctrl+T → 300px)

**Ops tabs (7):**
- **Home** (hierarchy: rollup + active phases + needs-you + recent)
- **Agents** (grid with sparklines, grouped Active/Recent/Dormant)
- **Workflows** (YAML-defined, definitions only)
- **Queue** (KANBAN of workflow runs — promoted from Workflows sub-tab)
- **Metrics** (Cost / Reliability / Speed panels)
- **Memory** (browse + Graphify knowledge graph)
- **Changes** (dev/prose toggle — aggregated commits + GitHub links)

**Build tabs (4):** Projects / PRDs / Roadmaps / UAT

**Cross-cutting:**
- Live Floor = top-bar toggle (isometric pixel-agents overlay; port of pablodelucca/pixel-agents) — **LAST phase, pure polish**
- Cost ticker always visible (labeled "est." — OAuth, not actual billing)
- Emergency brake: Pause (Ctrl+.) / Abort (Ctrl+Shift+.) per task
- Build ↔ Ops crosslinks
- Empty states guide to action
- Explain-mode toggle for Shift-user visitors
- Command palette (⌘K)
- Keyboard-first

---

## Proposed next phase order (per UI-SPEC)

- **Phase 2.5** — Design system foundation (dark theme, Geist fonts wired, cyan accent, base component library, typography scale, density tokens)
- **Phase 3** — New Ops Home (hierarchy, rollup, needs-you)
- **Phase 4** — Agents tab with sparklines + detail drawer
- **Phase 5** — Workflows + Queue (unified YAML spec)
- **Phase 6** — Metrics (3 panels)
- **Phase 7** — Memory + Graphify graph view
- **Phase 8** — Changes + right-rail chat
- **Phase 9** — Live Floor (fork pixel-agents)
- **Phase 10** — Command palette + polish + empty states + explain-mode

---

## ⚠ LATE-SESSION REFRAME — read this first

Eric clarified after the main spec was written: **primary users for BOTH modes are non-dev founders / product people, not developers.** This invalidated the "Ops = dev, Build = normie" mental model. See UI-SPEC.md § Audience reframe addendum for full implications.

**TL;DR of reframe:**
- Explain-mode is DEFAULT ON everywhere; dev-mode (SHAs, YAML, raw metrics) is an "Advanced" toggle
- KANBAN columns translated to founder-speak (Waiting / In progress / Double-checking / Stuck / Shipped)
- Workflows chat-first (Nexus drafts from natural language); YAML editor = Advanced
- Memory tab renamed **Notes**; Commits tab shows prose always
- Metrics panels renamed Spending / How well it's going / How fast
- Agents tab simplified — "Forge the builder" framing, model/token chips hidden under expand
- Nexus voice rule: **always explain before doing**, confirmation gate on anything that spends tokens
- Possible mode renaming: **Build → Plan**, **Ops → Ship**. Or dissolve the toggle entirely — open question.

Phase 2.5 (design system) should include: component library + the dev-mode global toggle + founder-first copy across every tab label, button, column header.

## Open questions next session must resolve with user

Tagged in UI-SPEC.md §final-open-questions + reframe addendum:

1. **Mode structure** — keep Build/Ops toggle with founder rename (Plan/Ship)? OR dissolve into single unified IA? OR toggle as view-filter only?
2. **Queue as 7th tab** — confirm (spec says yes, was originally a sub-tab under Workflows)
3. **Live Floor isometric vs 2D top-down** — spec picked isometric, Eric said "up to me" → confirm before building
3. **Graphify specifics** — is this graphify.dev, an Obsidian plugin, or something internal? Need API docs before designing Memory graph view
4. **Screen shake on merge** — spec removed; confirm killed
5. **Explain-mode default** — on for Build, off for Ops — confirm

---

## Critical session context

### CAE repo state
- `main` pushed through `4ce7829` + phase 2 merges + UI-SPEC commit
- `dashboard/` subdir contains everything (subtree-added, self-contained)
- `.env.local` at `/home/cae/ctrl-alt-elite/dashboard/.env.local` has GitHub OAuth creds — NOT committed, gitignored
- Shift repo at `github.com/notsatoshii/shift` (separate; `main` = `10bcce5`)

### Hermes + Telegram state (all wired)
- `hermes-gateway.service` active, Claude Code OAuth, bot `@LeverPM_bot` (chat 422985839 = Eric)
- Outbox watcher in root crontab, pings on DONE.md
- **Deferred:** formalize auth via `hermes auth add anthropic --type oauth` for `hermes doctor`

### openclaw + LEVER state
- ✅ fully decommissioned
- Archive at `/home/cae/archive/lever-openclaw-2026-04-20/` (2GB, 17,263 files, SHA manifest verified)
- LEVER code repos preserved: `/home/lever/Lever`, `/home/lever/lever-protocol`
- lever-frontend/oracle/accrue-keeper services still active (business-critical, untouched)
- See `/home/cae/archive/lever-openclaw-2026-04-20/HANDOFF.md` for agent-by-agent resume guide

### Dev server
- Currently running on :3003 as a backgrounded `pnpm dev` process
- AUTH_URL in `.env.local` = `http://165.245.186.254:3003`
- Firewall: ufw allow 3003/tcp added (port open to public — dev-only)
- Kill before next session if not needed: `pkill -f "next dev"`

### Known bugs tracked
- Shift backend: Arch subprocess spawn silently fails (fix deferred)
- Gemini Sentinel path: raw_len=0 on responses, Claude Opus fallback handles all
- Hermes `.update_check` cache stale (cosmetic)
- Next.js 16 `middleware` → `proxy` deprecation warning (cosmetic)
- `next lint` CLI migration (cosmetic)

---

## Repos / paths next session touches

| Path | Purpose |
|------|---------|
| `/home/cae/ctrl-alt-elite/` | CAE orchestrator + dashboard |
| `/home/cae/ctrl-alt-elite/dashboard/` | Next.js app (subtree) |
| `/home/cae/ctrl-alt-elite/dashboard/docs/UI-SPEC.md` | **Read this first** |
| `/home/cae/ctrl-alt-elite/dashboard/docs/PRD.md` | Product spec |
| `/home/cae/ctrl-alt-elite/dashboard/docs/ROADMAP.md` | Old roadmap (superseded by UI-SPEC phase order) |
| `/home/cae/ctrl-alt-elite/dashboard/docs/NOTES.md` | pixel-agents + feature list notes |
| `/home/shift/` | Shift CLI + Claude Code skill (separate repo) |
| `/home/cae/archive/lever-openclaw-2026-04-20/` | LEVER resumption archive |
| `/home/timmy/.hermes/` | Hermes daemon + timmy-delegate skill |

---

## Resume instructions

Next session:

```
1. cat /home/cae/ctrl-alt-elite/dashboard/HANDOFF.md  (this file)
2. cat /home/cae/ctrl-alt-elite/dashboard/docs/UI-SPEC.md  (design law)
3. Resolve 5 open questions with Eric
4. Plan Phase 2.5 (design system foundation) via /gsd-plan-phase
5. Fire CAE execute-phase 2.5
6. Then cascade Phase 3→Phase 10 per spec
```

Session's primary artifact for next pickup: **UI-SPEC.md**. That doc captures all the design negotiation — don't re-derive.

---

## Session highlight reel

This session shipped:
1. **Real Shift → CAE dogfood end-to-end** (first time ever)
2. Phase 1 + Phase 2 of cae-dashboard (10 Sentinel-approved merges)
3. openclaw decommission + 2GB LEVER archive with resume handoff
4. Hermes v0.9 → v0.10 upgrade, Claude Code OAuth wired
5. Timmy bridge real E2E (BUILDPLAN → CAE → DONE.md → TG ping on Eric's phone)
6. Shift v3.0 extracted to its own repo (`notsatoshii/shift`)
7. UI-SPEC.md — full dashboard design spec through 2 rounds of UX critique

Eric gave direction on UI design as a collaborative back-and-forth. Result = opinionated design lock-in reflecting CAE's actual state machine, not generic admin-panel cliches.

End of session.
