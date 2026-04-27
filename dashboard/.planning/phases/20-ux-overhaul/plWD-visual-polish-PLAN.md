---
phase: 20
plan: plWD-polish
wave: 4
name: Visual polish — tiles, cards, nav badges, empty states
---

# plWD-polish — Visual Polish Pass

## Context
From user audit:
- MC tiles show "appears when..." as placeholder (confusing)
- Rollup tiles have no trend indicators
- Agent cards all look identical — no role differentiation
- Queue kanban lacks column counts and priority coloring
- Sidebar nav has no badge counts
- Skills page shows false "no skills match" empty state
- Workflows shows bare "No recipes" without templates

## Task

<task>
<name>Visual polish across home, agents, queue, nav, skills, workflows</name>

<files>
components/build-home/mission-control-hero.tsx
components/build-home/rollup-strip.tsx
components/agents/agent-card.tsx
app/build/queue/queue-card.tsx
components/shell/sidebar.tsx
app/build/skills/skills-client.tsx
app/build/workflows/workflows-list-client.tsx
</files>

<action>
1. MISSION CONTROL TILES (mission-control-hero.tsx):
   - When a tile value is 0, show "0" in large text with muted color + label below ("active", "7d", "today", "/min")
   - Remove the "appears when..." explanatory text from production display
   - Only show that text when dev mode is enabled (check useDevMode)
   - When value is 0, show tile border as var(--border) not var(--success) — gray not green

2. ROLLUP STRIP (rollup-strip.tsx):
   - Add a small trend indicator next to each value: "↑" green if higher than yesterday, "↓" red if lower, "—" muted if same
   - Since we don't have historical data, just show "—" muted for now (placeholder for future comparison logic)
   - Add "today" label under the shipped/in-flight/warnings/blocked counts

3. AGENT CARDS (agent-card.tsx):
   - Add a colored left-border per agent persona:
     * nexus=cyan, forge=orange, sentinel=red, scout=green, scribe=purple, phantom=violet, aegis=amber, arch=blue
   - Show persona role as a small badge below the name (e.g., "Builder", "Reviewer", "Researcher")
   - If the agent has any recent activity (last 24h), show a small green dot; otherwise gray dot

4. QUEUE KANBAN (queue-card.tsx or the queue page):
   - Add task count to each column header: "Waiting (10)", "Shipped (6)"
   - Add a subtle priority indicator: colored left-border on cards based on priority field (if available)
   - Truncate long card titles to 60 chars with ellipsis

5. SIDEBAR NAV (sidebar.tsx):
   - Add a badge/count next to "Queue" showing number of waiting items
   - Add a badge next to "Agents" showing number of currently active agents
   - Badges should be small rounded pills with the count, using var(--accent) bg

6. SKILLS (skills-client.tsx):
   - Fix the "No skills match your search" message that shows when there's no search query
   - If search is empty AND skills list is empty, show different message: "No skills installed yet"
   - If search is active AND no results, show "No skills match '{query}'"

7. WORKFLOWS (workflows-list-client.tsx):
   - In the empty state, instead of just "No recipes yet", add 3 example recipe cards (grayed out/template style):
     * "Auto-review PRs" — trigger on new PR, run Sentinel
     * "Daily metrics digest" — cron daily, compile metrics
     * "Deployment pipeline" — trigger on main push, run tests + deploy
   - These are non-functional templates — clicking them opens the "New recipe" form prefilled
</action>

<verify>
1. Home page MC tiles show "0 active", "0 7d", "0 today", "0 /min" with muted styling
2. Agent cards have colored left borders matching their persona
3. Queue columns show counts in headers
4. Sidebar shows badge counts
5. Skills page doesn't show false empty state
6. Workflows empty state shows template cards
</verify>
</task>
