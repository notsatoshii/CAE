# Phase 20 — Full UX Audit Report

**Audited:** 2026-04-27 | **Method:** Playwright screenshots + structural analysis (14 pages)
**Server:** http://165.245.186.254:3002

## Page-by-Page Findings

### 1. HOME (`/`) — Build Home
- **Working:** Mission Control hero (4 tiles), Live activity panel, Rollup strip, Recent commits (10 items), Floor pin, Sidebar nav
- **Broken:** Activity feed sidebar stuck on loading skeletons (never populates). Recent ledger shows "Nothing shipped yet today" even with 10 commits visible above it
- **Empty state issues:** 4 MC tiles show "appears when..." placeholder text — looks broken to users who don't know what it means
- **Design:** MC tiles are all "nominal" green even when values are 0 — should show neutral/gray when inactive
- **Missing:** No trend arrows/sparklines on rollup tiles. Liveness chip stuck on "Connecting" for 8+ seconds on load

### 2. AGENTS (`/build/agents`)
- **Working:** Grid of 9 agent cards (1 active, 8 quiet). Clean card layout
- **Issues:** Cards look uniform — no visual way to distinguish agent roles at a glance. No mini-metrics (tasks completed, success rate). No agent avatars/icons. "Recently active" section has only Forge
- **Missing:** Performance sparklines per agent, clickable agent detail, task history

### 3. QUEUE (`/build/queue`)
- **Working:** Kanban board with 5 columns (Waiting/Working/Checking/Stuck/Shipped). 10 items in Waiting, 6 in Shipped
- **Issues:** "Working on it", "Double-checking", "Stuck" columns all empty with small "No items" text. Cards show full buildplan titles (very long). No priority coloring
- **Missing:** Drag-and-drop indicators, task counts per column header, priority badges, time-in-column indicators

### 4. WORKFLOWS (`/build/workflows`)
- **Working:** 3 live runs displayed. Workflow form exists
- **Issues:** "No recipes yet" empty state dominates page. Live runs section works but recipe list is empty
- **Missing:** Template gallery, run success/failure rates, visual workflow preview

### 5. SCHEDULE (`/build/schedule`)
- **Working:** Empty state with "Create one" CTA
- **Issues:** Shows raw cron syntax when populated. No calendar/timeline visualization
- **Missing:** Schedule preview, next-run indicator, visual timeline

### 6. SKILLS (`/build/skills`)
- **Working:** Renders skill list with search
- **Issues:** "No skills match your search" shown even without search query (misleading). "Recent edits" section visible but no categorization
- **Missing:** Category grouping, icons per skill, install/uninstall actions

### 7. SECURITY (`/build/security`)
- **BROKEN:** Shows "Loading..." (Pikachu loader) — never finishes loading. Page stuck in suspense state
- **Root cause:** Likely server-side component hanging (auth check or file scan)

### 8. MEMORY BROWSE (`/memory`)
- **Working:** Two-pane layout (file tree + content). Tabs for Browse/Graph
- **Issues:** Browse pane stuck on "loading" state. Right pane shows "Pick a file" empty state
- **Missing:** Search within files, syntax highlighting in file preview

### 9. MEMORY GRAPH (`/memory?view=graph`)
- **Working:** ReactFlow canvas renders with 228 nodes. Filters visible (phases/agents/notes/PRDs). Regenerate button works
- **Issues:** Graph layout is a scattered mess — nodes not meaningfully clustered. Only 11 links (all from phase 14). Node labels too small. No legend. All nodes same size regardless of importance
- **Missing:** Force-directed clustering by kind, meaningful inter-node links (agent↔phase), node size by importance, clickable zoom-to-cluster

### 10. METRICS (`/metrics`)
- **BROKEN:** 3 of 4 panels show error state (spending=error, reliability=error, speed=error). Only incident stream renders (shows "No incidents — Gateway healthy")
- **Root cause:** Metrics API routes likely failing or returning malformed data
- **Missing:** Time range selector, trend comparisons, benchmark lines

### 11. FLOOR (`/floor`)
- **Working:** Isometric canvas renders with grid + room labels. SSE connected
- **Issues:** All 10 stations scattered across 16x16 grid in separate rooms — feels empty/disconnected. No agents visible (none actively working). "Waiting for first heartbeat" status
- **Missing:** Shared workspace layout (agents working together), idle animations, interactive tooltips on hover

### 12. CHANGES (`/build/changes`)
- **BROKEN:** Page stuck on loading state — never renders content. `data-liveness=loading`
- **Root cause:** Changes data endpoint likely timing out or failing

### 13. PLAN (`/plan`)
- **Working:** Empty state renders: "Plan mode ships soon. For now, do your planning in Build."
- **Issues:** Page is literally a placeholder with one link. No actual planning functionality
- **Missing:** Everything — this is a stub page

### 14. CHAT (`/chat`)
- **Working:** Split view with mirror pane + chat panel. "What are you working on?" greeting. Suggestion buttons work
- **Issues:** Mirror pane shows "Loading..." for Home surface — never loads. Chat has no conversation history
- **Missing:** Working mirror pane, chat history, multi-session support

---

## Cross-Cutting Issues

| Category | Issue | Severity | Pages |
|----------|-------|----------|-------|
| **Broken pages** | Security, Changes, Metrics (3/4 panels) completely broken | 🔴 Critical | 3 pages |
| **Stuck loading** | Activity feed, Memory browse, Chat mirror never finish loading | 🔴 Critical | 3 components |
| **Empty states** | "appears when..." text reads as broken, not helpful | 🟡 High | Home |
| **No data context** | Rollup tiles show "0" with no trend, no "compared to..." | 🟡 High | Home |
| **Visual hierarchy** | Agent cards identical, no role icons/avatars | 🟡 Medium | Agents |
| **Knowledge graph** | 228 nodes, 11 links — graph is meaningless | 🟡 High | Memory |
| **Floor layout** | 10 separate rooms, no collaborative workspace feel | 🟡 Medium | Floor |
| **Liveness chip** | Says "Connecting" for 8+ seconds — looks broken | 🟡 Medium | All pages |
| **Plan page** | Complete stub — no functionality | 🟡 Low | Plan |
