# cae-dashboard — working notes

## 2026-04-20 — pixel-agents visualization

Source: https://github.com/pablodelucca/pixel-agents

**Profile:**
- MIT license ✅ (compatible with anything)
- React 19 + Vite + Canvas 2D
- Originally a VS Code extension observing Claude Code JSONL transcripts
- Agent state machine: idle → walk → type/read; BFS pathfinding; JSON asset manifests
- `webview-ui/` subdir is self-contained React+Canvas — the part worth porting
- `src/` (VS Code extension host) + `server/` — discard on port

**Port strategy (Phase 2 Ops mode):**
1. Fork pixel-agents repo under `notsatoshii/` for attribution + upstream diff-keeping
2. Extract `webview-ui/` into cae-dashboard at `components/pixel-agents/` (or as pnpm workspace if keeping it as a package)
3. **Keep:** Canvas render loop, sprite/asset manifests, state machine, pathfinding
4. **Replace data source:** swap VSCode API + Claude CLI transcript reader for Next.js server actions that read:
   - `.cae/metrics/*.jsonl` — which agent is active, token burn, events
   - `.planning/phases/*/tasks/*/task.md.output` — tool-call transcripts
   - `/home/cae/inbox` + `outbox` — delegation queue
5. **Extend agent roster:** current repo = one agent. CAE has 8 roles. Options:
   - (a) Reuse single sprite, add role-label + hat/color tint
   - (b) Paint new 16×16 or 32×32 sprites per role (more work, better UX)
   - Default to (a) for v0 — iterate to (b) later
6. **Sprite mapping (tentative):**
   - Forge — hammer/anvil animation
   - Sentinel — watchtower, scanning
   - Scout — walking/looking-around
   - Scribe — quill writing
   - Phantom — translucent, appears only when debugging
   - Aegis — shield raised during SC-mode
   - Arch — blueprint table
   - Herald — scroll/proclamation

**UI slot:** `/ops` page main canvas area. Sidebar shows task list; canvas shows agents in a shared room, each moving/animating based on live metrics stream (SSE).

**Licensing note:** MIT requires attribution — credit pablodelucca in README + retain LICENSE header in ported files.

---

## 2026-04-20 — expanded feature list

### Ops mode
- Log viewer (tmux, jsonl metrics, task outputs, Hermes logs, openclaw archive) — filterable
- Agent profiles — persona + model + lifetime stats + recent invocations + edit-gated
- KANBAN board — CAE tasks / delegations / Shift projects / UAT items; sync with Multica bridge
- (all prior Ops features)

### Build mode
- Ask-Shift chat pane — mentor dialogue on-demand

### Shared
- **Command palette / chat drawer** — always-accessible natural-language bot:
  - routes through Hermes LLM (Claude OAuth wired)
  - fires CAE / Shift / git / hermes subprocess commands
  - output rendered inline
  - history + saved commands
  - **same bot as Telegram `@LeverPM_bot`** — single conversation state across web + TG

### Integration map
- **LLM backend:** Hermes (Claude OAuth) — one brain for TG + web
- **KANBAN backend:** Multica (existing docker at :8090) via `scripts/multica-bridge.sh`
- **Agent profile stats source:** `.cae/metrics/circuit-breakers.jsonl` + `sentinel.jsonl` + `compaction.jsonl` — aggregate server-side
- **Pixel-agents data source:** same metrics files tailed via SSE
