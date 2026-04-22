# Mission Control research notes (reference repo)

**Repo:** https://github.com/builderz-labs/mission-control (4.3k ⭐, 740 forks)
**Captured:** session 6, 2026-04-23 by Eric's ask
**Purpose:** reference for Phase 13 audit + potential Phase 14 enhancements. What's BETTER than our current FE.

## Executive observation

Mission Control is the closest public project to what we're building — self-hosted AI agent orchestration dashboard. Eric observed in README screenshots: "UI looks a little better than what we have". Confirmed by direct screenshot review.

**Their strengths we lack (priority-ordered):**

1. **⌘K global search bar centered in top nav** — "Jump to page, task, agent…" — prominent, universal. We deferred this to Phase 12. Consider pulling forward.
2. **Live system clock + status indicator top-right** ("Live 09:23", "Sessions 2/87", "Nov 28ms (20 avg)" latency) — real-time ambient awareness. We have heartbeat dot but no latency, no clock, no session counter.
3. **KPI strip prominent** — top-row cards (Gateway Online / Sessions 2/87 / Agent Capacity 1/total / Queue 0 / System Load 76%) with colored dots. We have metrics page separate; they surface it as always-on context.
4. **Golden Signals panel** — standard SRE pattern: Gateway status, Traffic (sessions), Errors 24h, Saturation (queue), Memory %, Disk %. We should steal this framing for the Metrics page.
5. **Agent Squad grid** (see `agents.png`) — card grid with avatar + colored status dot + model info + last-active time + **per-card quick actions: Wake / Spawn / Hide**. Our agents tab is closer to a list; cards with avatars + inline actions are more scannable.
6. **Tab bar above agent surface: Command / Workflows / Pipelines / Fleet** — single tabbed surface instead of multiple nav items for related things. Our nav is flatter and less grouped.
7. **Alert banners with inline CTAs** — yellow alert bar at top with "Run Docker Fix" + "Show Details" + dismiss X. We log warnings to a panel but don't surface them with action.
8. **Incident Stream** panel (live tail of incidents) — addresses Eric's "logs suck" complaint. Ours log to file; they render a real-time stream with severity badges.
9. **Session Router live list** — per-session metrics (latency, tokens, status) scrollable. Ours is more static; theirs feels alive.
10. **Mode indicator** ("MODE: Gateway") — tiny chip showing which mode the dashboard is in. We have mode toggle in top nav but no always-visible context chip.

## Naming wins to consider adopting

| Theirs | Ours | Change? |
|--------|------|---------|
| "Mission Control" | "CAE Dashboard" | Keep CAE brand; "Mission Control" is their product name. But consider our tagline. |
| "Session Router" | — (none) | Adopt for chat/session routing display |
| "Gateway Health + Golden Signals" | "Metrics" | Add "Golden Signals" framing to Metrics panel |
| "Agent Squad" | "Agents" | "Squad" is punchier; consider for tab label |
| "Incident Stream" | — (errors scattered across logs) | Adopt — build incident stream panel |
| "Fleet" | "Agents" list | Consider for multi-project agent roster view |
| "Task Flow" | "Queue" / "Workflows" | "Task Flow" describes the kanban better |
| "Wake / Spawn / Hide" | "Start / Stop / Archive" | Their verbs are agentive (wake an agent, spawn a task) — more intuitive for our audience |
| "SOUL personalities" | voice personas (Nexus/Forge/etc.) | They branded personality as "SOUL" — could rethink if we want branded framing |

## Features worth stealing (beyond UI)

1. **Real-time everything** — WebSocket + SSE + "smart polling that pauses when you're away" — this directly addresses Eric's "data not LIVE" critique. Pause-when-away polling is a quick win.
2. **Quality gates (Aegis)** — blocks task completion without sign-off — we have ConfirmActionDialog but no persistent sign-off wall. Consider.
3. **Skills Hub** — browse/install from ClawdHub + skills.sh — we have skills but no marketplace browse. Phase 14 candidate.
4. **Recurring tasks** with natural language scheduling ("every morning at 9am") — we have workflows but no cron-natural-lang.
5. **Trust scoring + secret detection + MCP call auditing** — agent eval framework (4-layer). Our security panel is lighter.
6. **Role-based access** (viewer/operator/admin + Google SSO + approval workflow) — we're single-user currently. Post-MVP.

## What we already do better (don't lose these)

- Persona voices (Nexus/Forge/Sentinel/Scout/Scribe/Phantom/Aegis/Arch/Herald — 9 personas) with per-route narration. MC has agent names but voice narration is ours.
- Explain-mode (⌘E) — founder-speak + dev-mode toggle. MC appears dev-mode only.
- ConfirmActionDialog with token estimate + undo toast. MC's quality gate seems more heavyweight.
- Changes prose timeline with Tuesday/this-morning phrasing. MC has logs stream, not story-told changes.
- Chat pop-out icon + persistent rail + /chat split. MC has a chat-like send bar but not a pervasive rail.

## Recommendations

**For Phase 13 (UI/UX review loop), add to scope:**

- Audit against Mission Control IA. For each current CAE route, ask: does MC have a more scannable equivalent? If yes, screenshot both and propose delta.
- Run a naming-polish pass using the table above. "Agents" → "Squad"? "Workflows" → "Pipelines"? (Test with Eric before committing.)
- Add Golden Signals framing to Metrics page.
- Pull ⌘K forward from Phase 12 if not shipped yet.
- Build Incident Stream panel (addresses "logs suck").
- Pause-when-away polling gate across all SSE/polling hooks (addresses "data not LIVE").

**For potential Phase 14 (orchestration depth):**

- Task Flow kanban redesign with their per-card action verbs
- Skills Hub marketplace (ClawdHub integration path)
- Natural-lang cron scheduler
- Role-based access if multi-user ever lands

## Screenshots on disk

- `/tmp/mc-research/overview.png` — dashboard overview
- `/tmp/mc-research/agents.png` — Agent Squad grid

(Copy to `.planning/phases/13-ui-ux-review-polish-loop/reference/` if keeping long-term.)
