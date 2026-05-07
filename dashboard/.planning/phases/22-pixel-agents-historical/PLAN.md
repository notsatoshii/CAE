---
phase: 22
plan: Pixel agents historical visualization — replay past agents from circuit-breaker log
wave: 1
name: Phase 22 Wave 1 — Historical agent playback + floor timeline
---

<task id="1" owner="ARCH">
### Task 1: Design historical agent playback architecture

**Input:**
- Current floor canvas (isometric, renders live agents from breakers.jsonl)
- Circuit-breaker metrics schema (timestamps, agent type, status, tokens)
- UI-SPEC §visual identity requirement: show agent activity over time, not just live

**Deliverable:**
ARCHITECTURE-amendments.md covering:

1. **Data source:** Historical agents from .cae/metrics/circuit-breakers.jsonl
   - Extract all breaker.created_at timestamps + agent_type
   - Group by agent (conductor, forge, sentinel, scribe, etc)
   - Calculate duration (start → end/error)
   - Filter by date range (last 24h, last week, all)

2. **Floor timeline UI:**
   - Add timeline scrubber below floor canvas (or to the right)
   - Scrubber shows bars for each agent type (color-coded)
   - Clicking bar jumps canvas to that moment
   - Hover shows agent details (name, status, duration, wave)

3. **Agent sprite animation:**
   - Agents fade in at creation, animate to position
   - Fade out at completion
   - Pixel sprite already exists; reuse from live mode
   - Speed control: 1x / 2x / 4x / 8x playback

4. **Persistence:**
   - Floor ?date=2026-05-07&playback=true loads historical view
   - Default: live mode (date=today)
   - Playback state saved to localStorage (date + playback_speed)

**Acceptance:**
- Historical agent data can be queried from breakers.jsonl
- Timeline scrubber mockup designed (Figma or ASCII)
- Playback speed control defined
- Date picker component identified
</task>

<task id="2" owner="FORGE">
### Task 2: Implement historical agent data extraction

**Input:**
- circuit-breakers.jsonl at /home/cae/ctrl-alt-elite/.cae/metrics/circuit-breakers.jsonl
- Current /api/cb-tail endpoint (reads breakers, emits SSE)
- Architecture from Task 1

**Change:**
1. Create `/api/agents/historical` endpoint:
   - Query params: ?from=2026-05-07&to=2026-05-08&agent_type=forge (all optional)
   - Returns: JSON array of historical agents with timestamps
   - Schema: [{id, agent_type, created_at, completed_at, duration_ms, status, phase, wave}]

2. Parse circuit-breakers.jsonl:
   - Read file once, cache in memory (reload on file change)
   - Filter by date range (server-side)
   - Map breaker events to agent lifecycle

3. Test cases:
   - Empty file → []
   - No agents on date → []
   - Full day of agents → correct grouping by agent_type
   - Date range crossing midnight → both days merged

**Test:**
- curl http://localhost:3002/api/agents/historical
- Verify response matches schema
- Check date filtering works

**Acceptance:**
- /api/agents/historical returns valid JSON
- Date filtering works correctly
- Performance acceptable (< 100ms for 1 week of data)
</task>

<task id="3" owner="PRISM">
### Task 3: Build timeline scrubber + historical floor mode

**Input:**
- Historical data from /api/agents/historical
- Current floor canvas (FloorCanvas component)
- Architecture timeline design from Task 1

**Change:**
1. Create TimelineControl component:
   - Date picker (input or calendar, default today)
   - Playback speed selector (1x / 2x / 4x / 8x)
   - Play / Pause buttons
   - Progress bar (0-100% through day)
   - Agent type filter checkboxes

2. Update FloorClient:
   - Detect ?playback=true in URL
   - Fetch historical data instead of live SSE
   - Simulate agent lifecycle (created → positioned → completed)
   - Step through events at chosen speed
   - Pause/resume controls work

3. Connect canvas:
   - Reuse existing pixel sprites
   - Fade in on agent creation
   - Animate to position (if available)
   - Fade out on completion
   - Color by agent type (existing scheme)

4. Test cases:
   - Playback starts at 00:00, agents appear in order
   - Speed changes mid-playback
   - Pause then resume preserves position
   - Date change fetches new data

**Test:**
- Navigate to /floor?playback=true&date=2026-05-07
- Agents appear and animate through the day
- Timeline scrubber updates
- Play/pause works

**Acceptance:**
- TimelineControl renders
- /floor?playback=true works with no errors
- Agents animate through historical timeline
- Performance acceptable (60fps on desktop)
</task>

<task id="4" owner="SCRIBE">
### Task 4: Document historical agents pattern + close Phase 22

**Input:**
- Completed work from Tasks 1-3
- AGENTS.md (update with new pattern)
- ARCHITECTURE.md amendments

**Change:**
1. Update AGENTS.md:
   - Historical playback pattern: breakers.jsonl → /api/agents/historical → FloorClient playback
   - Circuit-breaker event types (created, completed, error)
   - Agent lifecycle (duration_ms calculation)

2. Write SUMMARY.md:
   - What was built: historical agent visualization
   - Key decisions (architecture, playback speed, sprite reuse)
   - Future work (save favorite dates, compare agents, etc)

3. Create CHANGELOG entry:
   - Phase 22: Pixel agents complete — live + historical modes
   - Closes feature scope for v0.1

**Acceptance:**
- AGENTS.md updated
- SUMMARY.md complete
- Historical agents feature ready for v0.1 ship
</task>
