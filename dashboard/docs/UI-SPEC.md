# cae-dashboard UI spec v1

**Status:** design lock-in after round 2 critique. Locked decisions marked ✓. Open questions marked ⚠.

## 0. Audience, voice, vibe

- **Primary users:** you (dev/operator) + Shift founders (non-devs peeking at Ops)
- **Platform priority:** desktop-first (1440×900 baseline), mobile deferred ✓
- **Voice:** **Nexus** = playful + smart-ass. Dry humor, not quippy. First-name with agents, honest about uncertainty, drops dev jargon then translates inline. Example tone:
  > "Forge botched that one three times. Want me to hand it to Phantom? He's scary but he reads logs for a living."

Every agent has a distinct voice in chat (short attribution):
- **Nexus** — orchestrator, cool deadpan
- **Forge** — blue-collar, terse, "done"
- **Sentinel** — pedantic, lists issues
- **Scout** — overly enthusiastic researcher
- **Scribe** — librarian energy
- **Phantom** — noir detective
- **Aegis** — paranoid, security-first
- **Arch** — architect, structured
- **Herald** — marketing copy over-energy

## 1. Global chrome (always visible)

```
┌──────────────────────────────────────────────────────────────────┐
│ CAE · [Build|Ops]  proj▾   $12.34/48k·today  ⌘K   🟢 live  avatar │ ← 40px top
├──┬────────────────────────────────────────────────────────┬──────┤
│▼│                                                          │ ▶    │
│⌂ │                                                          │      │
│👥│            MAIN (per tab)                                │ CHAT │
│⚡│                                                          │ 48→  │
│📊│                                                          │ 300  │
│🧠│                                                          │ px   │
│📜│                                                          │      │
│🎮│                                                          │      │  right rail
└──┴──────────────────────────────────────────────────────────┴──────┘
   ↑ left rail, 48px icon-only, per-mode tabs    ↑ collapsible chat (Ctrl+T)
```

- **Top bar (40px):**
  - Left: CAE wordmark · Build/Ops segmented toggle · project selector
  - Middle: **cost + token ticker** ("$12.34 · 48k tok today") — not cap-enforced (OAuth sub) but visibility
  - Right: ⌘K palette · live-heartbeat dot (green=up, amber=degraded, red=halt) · avatar menu
- **Left rail (48px):** icon-only nav, per-mode (6 Ops tabs / 4 Build tabs), active tab highlighted with cyan bar
- **Right rail chat (Ctrl+T):** default 48px collapsed icon-column with latest msg preview + unread dot. Click or Ctrl+T → 300px. Auto-expand when agent is streaming. Escape to collapse.

## 2. Left-rail tabs

### Ops mode (6 tabs)
| Icon | Tab | What it is |
|------|-----|---|
| ⌂ | **Home** | Rollup + active phases + needs-you + recent merges |
| 👥 | **Agents** | Roster with sparklines + detail drawer |
| ⚡ | **Workflows** | YAML-defined + schedule + pipelines (unified) |
| 📊 | **Metrics** | Cost / Reliability / Speed panels |
| 🧠 | **Memory** | AGENTS.md + KNOWLEDGE/ + personas + **knowledge graph** (Graphify) |
| 📜 | **Changes** | Plain-English commit timeline, grouped by project |

Pixel-agents = **"Live Floor"** icon 🎮 in top bar (not a tab). Click → full-screen overlay. Pop out into separate window for second-monitor use.

### Build mode (4 tabs)
| Icon | Tab | What it is |
|------|-----|---|
| 📁 | **Projects** | Project cards w/ lifecycle badges |
| 📝 | **PRDs** | Drafts awaiting review |
| 🗺️ | **Roadmaps** | Ordered-steps lists, approve-to-ship |
| ✅ | **UAT** | Walkthrough cards |

## 3. Ops Home (hierarchy, not kanban)

```
┌──────────────────────────────────────────────────────────────────┐
│ Today                                                            │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ 14 shipped · 48k tok · $6.20 · 3 in-flight · 2 blocked · ⚠1 │ │  rollup strip
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Active phases (3)                                                │
│ ┌────────────────────────────────────────────────────────────┐   │
│ │ cae-dashboard · phase 3              Forge ●● Sentinel ●   │   │
│ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░ wave 3/5 · 62%           │   │
│ │ ETA ~4m · 3k tok this phase                                │   │
│ └────────────────────────────────────────────────────────────┘   │
│ ┌ lever · audit 9 bugs · wave 2/4 · 28k tok                  ┐  │
│ └ timmy · new skill · wave 1/2 · Scout active                ┘  │
│                                                                  │
│ Needs you (3)                                                    │
│ ⚠ cae-dashboard p3-t4: Sentinel rejected 3× → [Review]          │
│ 🛡 lever p2-t1: danger action "git push main" → [Approve][Deny] │
│ 📝 shift-project-x: ROADMAP ready for review → [Open Build]     │
│                                                                  │
│ Recent (last 20)                                                 │
│ ✓ 8:42  cae-dashboard p3-t3    +4 commits  forge(sonnet)  820tok│
│ ✓ 8:38  lever p2-t1            +2 commits  forge(opus)   4.1ktok│
│ ✗ 8:31  cae-dashboard p3-t4    aborted    sentinel rejected 3×  │
│ ...                                                              │
└──────────────────────────────────────────────────────────────────┘
```

**Click any phase card →** slides over phase-detail sheet (waves, task cards, tail).
**Click any "Needs you" row →** action modal or detail sheet.

## 4. Queue tab — this is where KANBAN lives

Moved out of Home. KANBAN lives in the **Queue** sub-tab under **Workflows**. Columns use **CAE-native lifecycle**:

`Planned → Queued → Building → Reviewing → Blocked → Merged`

Each card (dense, ~80px):
- Line 1: task title
- Line 2: agent avatar · model chip · urgency dot · `@project`
- Line 3: tag pills (3 visible)
- Live indicator: pulsing cyan dot when actively running
- Click → right-sheet detail (50% width, covers chat rail)

## 5. Task detail sheet (right slide-over)

Sections (collapsible):
- **Header:** title · status · agents · urgency · tags · close (Esc) · **Pause** (Ctrl+.) / **Abort** (Ctrl+Shift+.)
- **Summary:** buildplan text, expandable
- **Live log:** SSE tail, pause/resume scroll, 500 line cap
- **Changes:** commits landed (sha + plain-English rewrite) · GitHub links
- **Memory referenced:** AGENTS.md entries + KNOWLEDGE/ topics invoked during this task · click → Memory tab filtered
- **Comments:** thread (ties into chat context; `@task:tb-abc123` mentions work)
- **Actions:** Approve / Deny / Retry / Abandon / Reassign / Edit plan

## 6. Agents tab

Grid of agent cards (~8 cards, 2-3 columns).

**Card anatomy (200×280px):**
```
┌─────────────────────────────┐
│ FORGE                    ●● │  live indicator (dots = concurrent tasks)
│ claude-sonnet-4.6           │  model chip
│ ─────────────────────────── │
│ token/hr    ▂▂▃▅▇▇▆▄▃▂ 12k │  sparkline
│ success 7d  ▇▇▇▇▆▇▇▇▇▇ 94% │
│ avg wall    ▃▃▂▃▃▃▃▃▄▃ 3:12│
│ ─────────────────────────── │
│ 3 active · 2 queued · 47/d  │
│ ─────────────────────────── │
│ ▸ Edit persona   ▸ Override │
└─────────────────────────────┘
```

**Click card → Agent detail drawer:**
- Persona (view-only MD render of `agents/cae-forge.md` + highlight auto-injected diffs)
- Model override control (for this project only / global)
- Lifetime stats + leaderboard ("top 5 tasks by token cost")
- Recent invocations table (last 50)
- Drift detection banner if success-rate dropped >15% in 7d: "Forge success rate trending down — investigate?"

## 7. Workflows tab

**Unified abstraction: workflow = YAML spec**
```yaml
name: upgrade-deps
description: Bump npm deps + rerun tests
trigger:
  type: manual          # | cron | event
  # schedule: "0 9 * * 1"    # if cron
  # on: task.failed           # if event
steps:
  - agent: forge
    task: "Run pnpm update --latest, commit if tests pass"
    timeout: 10m
  - agent: sentinel
    task: review
  - gate: approval
    notify: telegram
  - action: push
```

Tab layout:
- Left: list of saved workflows (searchable, tag-filtered)
- Right: YAML editor (Monaco) + preview pane showing step graph + "Run now" button
- Sub-tabs inside Workflows: **Definitions · Runs · Schedule**
- **Queue** (the KANBAN) is one view of **Runs**

## 8. Metrics tab (3 panels, not 4 tabs)

### Cost panel
- Big number: today + month-to-date + projected-monthly
- Stacked bar: $ by agent (7d, 30d toggle)
- Line: daily $ for 30d with drift detection
- Table: top 10 most expensive tasks ever (with links)
- Note banner: "OAuth subscription — these are cost *estimates* for tracking, not billed amounts"

### Reliability panel
- Per-agent success rate gauges (last 7d)
- Retry heatmap (days × hour-of-day)
- Halt events log (Phantom escalations, circuit-breaker trips)
- Sentinel reject-rate trend

### Speed panel
- P50 / P95 wall-time per agent
- Queue depth over time
- Time-to-merge distribution

## 9. Memory tab

Two modes:
- **Browse:** file tree — `AGENTS.md`, `KNOWLEDGE/*.md`, `agents/cae-*.md`, `.planning/*/plan.md`. Markdown render with search. Copy button per block.
- **Graph:** **Graphify** knowledge graph view — nodes = memory entries/topics/agents/projects, edges = references. Force-directed. Click node → drawer with content + "who references this?" back-links.

Features across both:
- Full-text search (ripgrep-backed server action)
- "Why?" button on any Ops event → traces memory entries consulted
- Memory git-log timeline — see evolution, diff between dates
- Read-only (edits via agents only, no direct UI mutation)

## 10. Changes tab

Timeline of what shipped.

```
┌──────────────────────────────────────────────────────────────┐
│ Today                                                        │
│ ──────                                                       │
│ 8:42am  cae-dashboard                                        │
│   3 features shipped:                                        │
│   · signin page rendering                                    │
│   · ops phase detail route                                   │
│   · live metrics tail                                        │
│   [▾ technical] 4 commits to forge/p3-t3 → main              │
│                 https://github.com/notsatoshii/CAE/commit/…  │
│                                                              │
│ 8:38am  lever                                                │
│   1 fix shipped: OI decrement on close                       │
│   [▾ technical] 2 commits to forge/p2-t1 → main              │
│                                                              │
│ Yesterday                                                    │
│ ─────────                                                    │
│ ...                                                          │
└──────────────────────────────────────────────────────────────┘
```

Tech panel collapsed by default → expand shows SHAs, diff preview, author, labeled GitHub links.

## 11. Live Floor (pixel-agents overlay)

**Style:** isometric 2.5D (Stardew Valley × Habbo Hotel vibe). More visual depth than 2D top-down, hand-drawn pixel aesthetic.

**Layout:** a single "CAE HQ" scene with rooms per agent role:
- Central hub: Nexus's desk (orchestrating, flips papers, pings out)
- East wing: Forge's forge (anvil + hammer animation when building)
- Watchtower: Sentinel (binoculars scanning)
- Overlook: Scout with map
- Library: Scribe at desk with quill
- Shadow realm (lower deck): Phantom appears only during debugging
- Armory: Aegis standing guard
- Drafting table: Arch with blueprints
- Town square pulpit: Herald
- Loading bay: delegation queue (crates come in, get routed)

Events:
- Task merge → fireworks above hub + screen flash
- Sentinel reject → red X animation over target agent
- Phantom escalation → Phantom walks across screen to target
- Dangerous action pending → alarm light flashes red

Controls: top-right pop-out button, minimize, pause animation. Always optional — never blocks work. Second-monitor dream view.

## 12. Chat (right rail)

```
┌─────────┐   collapsed (48px)
│   🟢    │   live status
│    💬   │   latest msg preview (truncated)
│   ●3    │   unread count
│         │
│  agents │   stacked avatars of agents speaking recently
│  ●●●    │
│         │
│  ⌘T     │
└─────────┘
```

**Expanded (300px, Ctrl+T):**
- Header: "Nexus" · context (current project) · new conversation · pop-out
- Thread: message bubbles with agent avatar + name. Code blocks syntax-highlighted. Diff previews inline. Action buttons inline ("Run this? [Yes] [No]").
- Input: textarea, `/` commands, `@agent` mentions, file attach, send (Enter) / newline (Shift+Enter)
- Below input: suggested actions based on current tab context ("Analyze the blocked task?", "Summarize today's burn?")

**Full-screen:** `/chat` route for extended sessions.

## 13. Visual system

### Colors
```
bg              #0a0a0a   (near-black)
surface         #121214   (cards, panels)
surface-hover   #1a1a1d
border          #1f1f22   (dividers, card edges)
border-strong   #2a2a2e   (input outlines)
text            #e5e5e5
text-muted      #8a8a8c
text-dim        #5a5a5c

accent          #00d4ff   (cyan — active, primary CTA, live indicators)
accent-hover    #33deff
accent-muted    #00d4ff20 (bg tints for active states)

success         #22c55e
warning         #f59e0b
danger          #ef4444
info            #3b82f6

running-pulse   cyan gradient with 1.5s pulse
```

### Typography
- **Sans:** Geist Sans — 13px base, 14/15/16/20/24/32 scale
- **Mono:** Geist Mono — 12px base (logs, tables, code, agent metadata)
- **Weights:** 400 body, 500 UI, 600 headings, no bolder than 700

### Motion
- Linear-subtle. 150ms ease-out for transitions. 80ms for hover states. Pulses for live (1.5s infinite). No bounce, no spring, no parallax.
- **Screen shake** allowed on Live Floor only for merge events (1 frame, 4px).

### Icons
- Lucide React (shadcn default), 16px UI, 20px tabs, 48px empty-state hero.

### Density
- **Dense everywhere lists exist:** KANBAN, tables, agent grid, changes timeline — 12-14px padding, 32-40px rows, mono for metadata.
- **Breathable everywhere detail exists:** task sheet, agent drawer, chat, memory detail — 24-32px padding, sans 14-16px, generous line-height.

## 14. Cross-cutting features

- **Always-visible cost ticker** (top bar): current today $ + tokens, click → Metrics/Cost
- **Emergency brake** per running task: Pause (Ctrl+.) / Abort (Ctrl+Shift+.)
- **Live Floor pop-out** for second-monitor use
- **Empty states** guide action, not blank page
- **Explain mode toggle** (settings): shows jargon tooltips for Shift-user visitors
- **Build ↔ Ops crosslinks:** Build project card "executing in CAE →" chip; Ops home "Shift needs you" banner
- **Command palette** (⌘K): fuzzy search across projects / tasks / agents / workflows / memory / commands
- **Keyboard-first:** every action has shortcut. Help overlay (?) shows all.

## 15. Mobile (deferred, note only)

Post-desktop-v1. When built: single-column list, approve/deny cards optimized, chat full-screen, launched from Telegram deeplinks.

---

# Self-critique pass 2

I pushed hard last round. Pushing again.

### Still wrong

**1. Live Floor risk of being distracting gimmick.** Isometric animated scene looks cool in a demo, questionable during actual work. Mitigation: never always-on, strictly opt-in, pop-out for ambient display. But I'd reality-check this by shipping Floor *after* everything else — it's polish, not core.

**2. "Needs you" bucket will stale.** If user ignores a blocked task, it sits there forever, cluttering home. Add: auto-age, snooze, "I'll deal with it later" button, or weekly auto-escalation via Telegram ping.

**3. Workflows + Queue being under one tab is confusing.** Workflow = definition (template). Queue = runs (executions). User might expect "Queue" as its own tab since it's the most-visited view. Reconsider: make **Queue a top-level tab (7th)**, Workflows stays for definitions. Cleaner mental model.

**4. "Changes" + "Commits" duality.** I renamed Commits → Changes for Shift users. But devs want raw commits. Solution: one tab, two modes (prose vs technical), persisted toggle per-user-role.

**5. Knowledge graph via Graphify — I don't know Graphify's specific API/constraints.** Assumed it's a graph viz (like Obsidian). Need to verify. If it's the `graphify.dev` tool or a proprietary lib, integration shape matters. Flag for research.

**6. Agent sparklines might be noise at idle.** Scribe is idle 95% of the time. Its sparklines will be flat. Card design should show "inactive 6d · last run Thu" for idle agents instead of empty graphs.

**7. 8+ agents = Agents tab gets crowded.** If we add specialists (Prism, Flux, Phantom, etc.), grid blows up. Better: group by "Active / Recently used / Dormant / Specialists."

**8. Live Floor second-monitor pop-out is nice but building a separate-window Next.js view is non-trivial.** Electron? Or just fullscreen browser tab? Latter is fine v1.

**9. Chat "pop-out" to `/chat` full-screen isn't quite right.** Users will lose task context. Better: split-screen mode — chat takes 50% while keeping tab on other 50%.

**10. "Screen shake on merge" — remove from v1.** Feature creep. Celebration animation is fine, screen shake during long work sessions = annoying. Skip.

**11. No drag-and-drop on Queue/KANBAN.** Status transitions happen automatically (CAE-driven), so user doesn't drag. But user might want to prioritize ("move this up the queue") or reassign — explicit buttons, not drag. OK; confirm.

**12. Memory graph view scalability.** If AGENTS.md has 500+ entries across projects + KNOWLEDGE/, graph becomes hairball. Need clustering / project-filter / node-count cap with "load more."

**13. Cost ticker accuracy.** Anthropic OAuth doesn't report token counts back in every SDK usage. We read metrics from `.cae/metrics/*.jsonl` which may not have precise cost. Show "estimated" label with tooltip.

**14. No "what is CAE doing RIGHT NOW" view.** Closest is Active Phases on Home. But during heavy build, *specifically which Forge is on which task right now* is buried. Add: pinned "Live Ops" status line above Active Phases showing "Forge→p3-t3 · Sentinel→p3-t2-review · Scout→idle" real-time, one-line.

**15. Nexus voice in chat — need voice guidelines doc.** "Playful smartass" can drift into cringe without rails. Need specific do/don't examples written out before first chat message ships.

---

# Revision summary (applied)

- Queue promoted to **7th tab** in Ops
- Changes tab has **dev/prose** toggle
- Agents grouped (Active / Recently used / Dormant)
- Scribe-style idle card = "inactive 6d · last run Thu"
- No screen shake on merge (pulse/flash only)
- Chat split-screen mode for pop-out
- Cost ticker labeled **"est."**
- Live Ops status line above Active Phases (1-line real-time agent assignment)
- Nexus voice examples doc (`docs/VOICE.md`) to ship with build
- Live Floor = last phase; core UI ships first
- Memory graph = project-filter + node-count cap + "load more"

---

# Final open questions

1. **Queue as 7th tab OK**, or keep under Workflows?
2. **Live Floor isometric** vs simple 2D top-down? I picked isometric; you said "up to me." Confirm?
3. **Graphify specifically** — is this graphify.dev, or something internal? I need API docs.
4. **Screen shake** — kill it per my critique? Or keep for big merges?
5. **Explain-mode default-on for Build** vs Ops default-off — is that right?

If you greenlight, next step is: translate this spec into phase plans (probably Phase 2.5 "design system + layout refactor" before we keep bolting on Ops features). Suggested phase order:

- **Phase 2.5** — Design system (dark theme, Geist fonts, cyan accent, component library)
- **Phase 3** — New Ops Home (hierarchy view + rollup + needs-you)
- **Phase 4** — Agents tab + sparklines + detail drawer
- **Phase 5** — Workflows + Queue
- **Phase 6** — Metrics (cost/reliability/speed panels)
- **Phase 7** — Memory + graph
- **Phase 8** — Changes + Chat rail
- **Phase 9** — Live Floor (pixel-agents fork + port)
- **Phase 10** — Command palette + polish + empty states
