---
phase: 22
plan: A
wave: 1
name: Pixel Agents Historical Hydration + Timeline Sidebar
---

# Phase 22 — Pixel Agents Historical Hydration + Timeline Sidebar

**Goal:** Enable the Floor page to load and display historical agent execution from circuit-breaker.jsonl. Users can see what agents did in the past 4 hours even when CAE isn't currently running.

## Architecture

Historical agents flow:
1. Circuit-breaker file → `/api/cb-tail` endpoint
2. Parse events → reconstruct agent lifecycles
3. Ghost agents rendered on canvas (faded)
4. Timeline sidebar shows all agents (live + historical)
5. Click agent → detail panel with DONE.md + commits

---

<task id="1">
<name>Parse Circuit-Breaker Events</name>
<files>dashboard/lib/floor/parse-circuit-breaker.ts</files>
<action>
Create pure utility functions to extract and reconstruct agent lifecycles from circuit-breaker JSONL:
- parseCircuitBreakerEvents(lines: string[]): ParsedCbEvent[]
- reconstructAgentLifecycles(events: ParsedCbEvent[]): AgentLifecycle[]
- deriveStation(taskId: string): StationName
- parseTimestamp(ts: string | number): number

Handle event types: forge_begin, forge_end, tool_call
Add 16 unit tests covering timestamp parsing, station derivation, event parsing, lifecycle reconstruction.
</action>
<verify>
npm run test dashboard/lib/floor/parse-circuit-breaker.test.ts
Verify 16/16 tests pass
</verify>
</task>

<task id="2">
<name>Wire Historical Load into FloorClient</name>
<files>dashboard/components/floor/floor-client.tsx</files>
<action>
Add automatic historical hydration on component mount:
- useEffect fetches /api/cb-tail?limit=5000 on mount
- Parses circuit-breaker events and reconstructs lifecycles
- Filters to last 4 hours (configurable)
- Stores in component state: historicalAgents
- Passes to canvas for ghost rendering + sidebar for display

Non-blocking fetch (errors silently logged), only runs on mount.
</action>
<verify>
npm run dev &
Navigate to /floor
Check browser console for no errors
Verify historical agents load (if CB file has events)
</verify>
</task>

<task id="3">
<name>Render Ghost Agents on Canvas</name>
<files>dashboard/lib/floor/renderer.ts</files>
<action>
Extend main render function to draw historical agents:
- Add layer 6: Ghost agents rendered faded at final station positions
- Opacity 0.3 (translucent, distinguishable from live agents)
- Colored squares matching live agent style (hue from task_id hash)
- Status emoji + completion time label below each ghost
- Helper functions: computeHueForTaskId, formatTimeSince

Visual hierarchy: Background → Floor tiles → Stations → Effects → Entities → Live agents → Ghost agents
</action>
<verify>
npm run dev
Open /floor
Verify ghost agents appear as faded squares on canvas (if historical data exists)
</verify>
</task>

<task id="4">
<name>Build Timeline Sidebar</name>
<files>dashboard/components/floor/floor-timeline.tsx</files>
<action>
Create FloorTimeline component showing all agents (live + historical):
- Horizontal scrollable list at bottom of canvas
- Each agent as a pill button: color square, task ID, spawn time, duration, status emoji
- Newest-first sorting
- Highlight selected agent
- Click handler to select and open detail panel
- Mobile-responsive: hidden at <768px viewport width
- Deduplicates live agents (live takes priority over historical)
- Proper TypeScript types
- Accessible buttons with clear labels
</action>
<verify>
npm run dev
Open /floor on desktop (768px+)
Verify timeline sidebar appears at bottom
Click an agent pill → verify selection highlights
</verify>
</task>

<task id="5">
<name>Create Agent Detail Panel</name>
<files>dashboard/components/floor/agent-detail-panel.tsx</files>
<action>
Create AgentDetailPanel component for task execution details:
- Fixed right-side slide-out panel (w-96, z-50)
- Fetches /api/outbox/[taskId]/done on open
- Parses YAML frontmatter from DONE.md (status, started_at, finished_at, summary, commits)
- Sections: Header (task ID, status badge, close), Summary, Execution (timestamps), Commits (links), Tools (placeholder)
- Error handling: 404 for missing tasks, "unable to parse metadata"
- Loading state: "Loading task details..."
- Infinite cache for DONE.md (immutable after completion)
- Clean YAML parsing (handles quoted values, multi-line)
- Responsive layout with scrollable content area
</action>
<verify>
npm run dev
Open /floor
Click an agent → panel should open on right
Verify DONE.md content loads (if task exists in /home/cae/outbox/)
</verify>
</task>

<task id="6">
<name>Wire Components Together</name>
<files>dashboard/components/floor/floor-client.tsx</files>
<action>
Integrate all components into cohesive experience:
- Add state: selectedTaskId, historicalAgents, liveAgents
- Pass historicalAgents to FloorCanvas via props
- Render FloorTimeline sidebar with click handler
- Render AgentDetailPanel that opens on selection
- Proper state management: selection cleared on close

Layout:
┌─────────────────────────────┐
│ [Toolbar: Pause|Legend]     │
├──────────────┬──────────────┤
│              │              │
│   Canvas     │  [Detail]    │
│  + Ghosts    │  Panel       │
│              │              │
├──────────────┴──────────────┤
│ [Timeline Sidebar]          │
│  [■] task1 | [■] task2...   │
└─────────────────────────────┘
</action>
<verify>
npm run dev
Open /floor
Verify all three components present and wired
</verify>
</task>

<task id="7">
<name>Create API Endpoints</name>
<files>dashboard/app/api/cb-tail/route.ts, dashboard/app/api/outbox/[taskId]/done/route.ts</files>
<action>
Implement two API endpoints:

GET /api/cb-tail?limit=5000
- Returns plaintext JSONL (last N lines of circuit-breakers.jsonl)
- Query param: limit (default/max 5000)
- Source: /home/cae/ctrl-alt-elite/dashboard/.cae/metrics/circuit-breakers.jsonl
- Cache: 30s (CB file is write-heavy)
- Error handling: 404 if file missing

GET /api/outbox/[taskId]/done
- Returns DONE.md content (YAML + optional markdown body)
- Dynamic route param: taskId
- Source: /home/cae/outbox/[taskId]/DONE.md
- Cache: infinite (DONE.md immutable)
- Error handling: 404 if file missing
</action>
<verify>
curl http://localhost:3002/api/cb-tail?limit=5
curl http://localhost:3002/api/outbox/7b637a96-cd3/done
Both should return valid responses
</verify>
</task>
