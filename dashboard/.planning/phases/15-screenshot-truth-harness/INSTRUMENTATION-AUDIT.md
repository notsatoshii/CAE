# CAE Dashboard Instrumentation Audit

**Date**: 2026-04-23  
**Scope**: Data capture pipeline integrity across all 14 shipped phases  
**Finding**: Multiple critical data flows are BROKEN due to missing writers, incomplete hook installation, and disabled generators.

---

## 1. Data Files Inventory

### Circuit Breakers (Primary event stream)
- **File**: `.cae/metrics/circuit-breakers.jsonl` (per project)
- **Reader**: `lib/cae-home-state.ts` (lines 217, 271), `lib/cae-agents-state.ts` (line 187), `lib/cae-metrics-state.ts` (line 226)
- **Expected by**: Home (tokens_today, warnings, active agents), Agents tab, Metrics panels
- **Writer**: Should be populated by `forge_begin` / `forge_end` / `token_usage` events from CAE Python circuit_breakers.py
- **Current Status**: **FILE MISSING** — Not found in `/home/cae/ctrl-alt-elite/.cae/metrics/`
- **Impact**: CRITICAL — All token tracking, agent activity, and failure tracking returns zero data

### Sentinel Events
- **File**: `.cae/metrics/sentinel.jsonl` (per project)
- **Reader**: `lib/cae-metrics-state.ts` (line 243) — for sentinel_rejects_30d
- **Expected by**: Metrics > Reliability tab (approval/rejection counts)
- **Writer**: Should be written by sentinel Python process
- **Current Status**: **FILE MISSING** — silent fallback (metrics return empty arrays)
- **Impact**: MODERATE — Reliability metrics for sentinel approvals always show zero

### Skill Scans
- **File**: `.cae/metrics/skill-scans.jsonl`
- **Reader**: Indirect — skills route calls `getCatalog()` which doesn't directly read this
- **Expected by**: Skills page
- **Writer**: Should be written by `tools/skill-install.sh` or skill-discovery subprocess
- **Current Status**: **FILE EXISTS** (36 lines, last write 2026-04-23 10:37:00)
- **Line 1 schema**: `{"ts":"2026-04-23T10:00:00Z","name":"vercel-labs/deploy","findings":0,"redactedSample":[],"available":true}`
- **Impact**: MINIMAL — File exists but appears to be sample/stale data; skills route doesn't use it

### Memory Consult Log
- **File**: `.cae/metrics/memory-consult.jsonl` (per project)
- **Reader**: `lib/cae-memory-consult.ts` (line 54) — aggregates across projects
- **Expected by**: Memory > Why drawer (shows which memory sources a task consulted)
- **Writer**: Should be written by PostToolUse hook `memory-consult-hook.sh` (Phase 8 Wave 1)
- **Current Status**: **FILE MISSING** — tailJsonl silently returns [] on error
- **Impact**: MODERATE — Memory consult feature shows no data (but has safe fallback heuristics)

### Tool Call Audit Log
- **File**: `.cae/metrics/tool-calls.jsonl` (per project)
- **Reader**: `lib/cae-audit-log.ts` (line 46)
- **Expected by**: Security > Audit page
- **Writer**: Should be written by PostToolUse hook `tools/audit-hook.sh` (Phase 14 Wave 1)
- **Current Status**: **FILE MISSING** — readAuditLog returns {entries: [], total: 0}
- **Impact**: CRITICAL — Audit page shows no data (security visibility lost)

### Graph State
- **File**: `.cae/graph.json`
- **Reader**: `lib/cae-graph-state.ts` (line 104) — loadGraph()
- **Expected by**: Memory > Graph visualization
- **Writer**: Should be written by `regenerateGraph()` called manually or via API
- **Current Status**: **FILE EXISTS** (82KB+, populated)
- **Impact**: GREEN — Graph loads successfully

### Scheduled Tasks Registry
- **File**: `scheduled_tasks.json` (repo root)
- **Reader**: `lib/cae-schedule-store.ts` (line 125) — readTasks()
- **Expected by**: Schedule page, cae-scheduler-watcher.sh cron daemon
- **Writer**: POST `/api/schedule` writes via atomicWrite()
- **Current Status**: **FILE EXISTS** but EMPTY (`[]`)
- **Impact**: MODERATE — Schedule page is empty (feature not in use yet)

### Chat Sessions
- **Files**: `.cae/chat/{uuid}.jsonl` (one per session)
- **Reader**: `lib/cae-chat-state.ts` (lines 145, 159, 165)
- **Expected by**: Chat page
- **Writer**: `appendMessage()` called by POST `/api/chat/send`
- **Current Status**: **4 SESSION FILES EXIST** (all 124 bytes, recent timestamps)
- **Impact**: GREEN — Chat works; sessions are created and persisted

---

## 2. Writer Audit

### Circuit Breakers Writer

**Source File Expected**: `bin/circuit_breakers.py` (CAE binary)

**Where It Should Write**:
- Each project: `.cae/metrics/circuit-breakers.jsonl`
- Event types: `forge_begin`, `forge_end`, `token_usage`, `limit_exceeded`, `halt`, `escalate_to_phantom`

**Installation/Registration**:
- Should be automatic when CAE (Python CLI) runs
- No registration script required (unlike hooks)

**Current Status**: **WRITER NOT FOUND / NOT RUNNING**
- `circuit-breakers.jsonl` does not exist in any project's `.cae/metrics/`
- No Python circuit-breaker process is visible in active system
- **Cause**: Either CAE binary is not integrated into this environment, or no CAE tasks have executed since dashboard was deployed

**How to Verify**: 
```bash
# Check if cae binary exists and works
cae --version

# Check if any project has ever logged events
find /home/cae/ctrl-alt-elite -name "circuit-breakers.jsonl" -type f
```

---

### Audit Hook Writer

**File**: `tools/audit-hook.sh`  
**Registration**: Via `scripts/install-audit-hook.sh` → adds entry to `~/.claude/settings.json`

**What It Does**:
- Appends one JSONL line per tool call to `.cae/metrics/tool-calls.jsonl`
- Triggered by Claude's PostToolUse hook for: Bash, Write, Edit, MultiEdit, Agent, Task

**Current Status**: **HOOK NOT REGISTERED**
- `.claude/settings.json` exists but contains **ONLY the memory-consult-hook** (Phase 8)
- Audit-hook entry is completely missing
- **Cause**: `install-audit-hook.sh` was never run

**Installation Command**:
```bash
cd /home/cae/ctrl-alt-elite/dashboard
bash scripts/install-audit-hook.sh
```

**Verification**:
```bash
jq '.hooks.PostToolUse | length' ~/.claude/settings.json
# Should show 2 entries (memory + audit); currently shows 1
```

---

### Memory Consult Hook Writer

**File**: `tools/memory-consult-hook.sh`  
**Registration**: Already in `~/.claude/settings.json` (matcher: `Read`)

**What It Does**:
- Appends one JSONL line per Read tool call to `.cae/metrics/memory-consult.jsonl`
- Event: `{"ts":"...", "event":"memory_consult", "source_path":"...", "task_id":"..."}`

**Current Status**: **HOOK INSTALLED BUT NOT FIRING**
- Entry is in settings.json
- No `.cae/metrics/memory-consult.jsonl` file exists in any project
- **Possible Cause**: 
  - Read hook may not be firing on memory reads
  - Projects may not have a `.cae/metrics/` directory created yet (lazy-init issue)

**Verification**:
```bash
# Check if hook is registered
jq '.hooks.PostToolUse[] | select(.matcher == "Read")' ~/.claude/settings.json

# Check if any memory-consult.jsonl exists
find /home -name "memory-consult.jsonl" 2>/dev/null
```

---

### Sentinel Writer

**Source**: Python sentinel process (from CAE binary)

**What It Does**:
- Evaluates tool calls against approval rules
- Writes `sentinel.jsonl` with `verdict_valid`, `verdict_invalid`, `approve: bool` events

**Current Status**: **NOT IMPLEMENTED / NOT RUNNING**
- No `sentinel.jsonl` files found anywhere
- Sentinel feature is likely not deployed in this CAE environment yet

**Installation**: Depends on CAE binary deployment (outside dashboard scope)

---

### Scheduler Cron Watcher

**File**: `scripts/cae-scheduler-watcher.sh`  
**Registration**: Via `scripts/install-scheduler-cron.sh` → adds to user crontab

**What It Does**:
- Runs every minute (crontab `* * * * *`)
- Reads `scheduled_tasks.json`
- Dispatches due buildplans via tmux or background shell

**Current Status**: **NOT INSTALLED**
- `crontab -l` shows NO CAE scheduler entry (only Lever/Timmy entries)
- `scripts/install-scheduler-cron.sh` was never executed

**Installation Command**:
```bash
bash /home/cae/ctrl-alt-elite/dashboard/scripts/install-scheduler-cron.sh
```

**Verification**:
```bash
crontab -l | grep -i "scheduler\|cae-scheduler"
# Should show: * * * * * "/home/cae/ctrl-alt-elite/dashboard/scripts/cae-scheduler-watcher.sh" >> /tmp/cae-scheduler.log 2>&1
```

---

## 3. Token Tracking Pipeline

**Full Chain**:
1. **Component** → `components/shell/cost-ticker.tsx`
2. **API Route** → `app/api/state/route.ts` (returns HomeState)
3. **Aggregator** → `lib/cae-home-state.ts` → `getHomeState()` (line 166)
4. **Data Source** → `.cae/metrics/circuit-breakers.jsonl` per project (line 217)
5. **Event Field** → `input_tokens` + `output_tokens` (lines 225-226)
6. **Writer** → CAE Python `bin/circuit_breakers.py` via `forge_end` / `token_usage` events

**Current Status**: **COMPLETELY BROKEN**
- circuit-breakers.jsonl does not exist
- `buildRollup()` returns `tokens_today: 0`, `tokens_mtd: 0`, `tokens_projected_monthly: 0`
- Cost ticker shows **$0.00** all the time

**Breakpoint**: No CAE task execution in this environment (no circuit-breakers.jsonl generator)

---

## 4. Pixel-Agents (Live Floor) Pipeline

**Full Chain**:
1. **Component** → `components/floor/floor-canvas.tsx`
2. **Client** → Opens EventSource to `/api/tail?path=...`
3. **SSE Endpoint** → `app/api/tail/route.ts` (line 52, createTailStream)
4. **File Tailed** → Project's `.cae/metrics/circuit-breakers.jsonl` or arbitrary path
5. **Event Types** → `forge_begin`, `forge_end` (parsed by floor-canvas)
6. **Writer** → CAE Python `bin/circuit_breakers.py`

**Current Status**: **BROKEN**
- Circuit-breakers.jsonl is missing
- Tail stream has no data to read
- Floor shows empty canvas (no agents visible)

**Breakpoint**: Same root cause as token tracking — no circuit-breakers.jsonl writer

---

## 5. Schedule Pipeline

**Full Chain**:
1. **Component** → `app/build/schedule/schedule-client.tsx`
2. **API Read** → `app/api/schedule/route.ts` GET → `readTasks()`
3. **Registry Read** → `lib/cae-schedule-store.ts` → `scheduled_tasks.json`
4. **Cron Daemon** → `scripts/cae-scheduler-watcher.sh` (runs every minute)
5. **Dispatcher** → tmux session spawner → `cae execute-buildplan`

**Current Status**: **PARTIALLY BROKEN**
- `scheduled_tasks.json` exists but is empty
- Schedule page displays correctly (no data, but no errors)
- Cron daemon is NOT installed

**Breakpoint 1**: Cron watcher not in crontab (install-scheduler-cron.sh never run)  
**Breakpoint 2**: No scheduled tasks in registry (users haven't created any yet)

**Installation Required**:
```bash
bash /home/cae/ctrl-alt-elite/dashboard/scripts/install-scheduler-cron.sh
```

---

## 6. Audit-Hook Pipeline

**Full Chain**:
1. **Component** → `app/build/security/page.tsx` (Audit tab)
2. **API Read** → `app/api/security/audit/route.ts` → `readAuditLog()`
3. **Log Read** → `lib/cae-audit-log.ts` → `.cae/metrics/tool-calls.jsonl`
4. **Writer** → PostToolUse hook `tools/audit-hook.sh`
5. **Hook Registration** → `~/.claude/settings.json` (PostToolUse entries)

**Current Status**: **COMPLETELY BROKEN**
- `~/.claude/settings.json` does NOT have audit-hook entry
- `tool-calls.jsonl` does not exist anywhere
- Security/Audit page shows **"No audit data found"**

**Breakpoint**: `install-audit-hook.sh` was never run

**Installation Required**:
```bash
cd /home/cae/ctrl-alt-elite/dashboard
bash scripts/install-audit-hook.sh
```

**Verification**:
```bash
jq '.hooks.PostToolUse[] | select(.matcher | contains("Bash|Write|Edit|MultiEdit|Agent|Task"))' ~/.claude/settings.json
# Should show one entry with command: "bash .../audit-hook.sh"
```

---

## 7. Skills Pipeline

**Full Chain**:
1. **Component** → `app/build/skills/page.tsx`
2. **Catalog API** → `app/api/skills/route.ts` → `getCatalog(q)`
3. **Catalog Aggregator** → `lib/cae-skills-catalog.ts`
4. **Data Sources**:
   - Local installed skills: `~/.claude/skills/` directory scan
   - Trust overrides: `trust-overrides.json` (empty array in repo root)
   - ClawHub: HTTP request to external API

**Current Status**: **WORKING (partial)**
- Local skills scan works (if any are installed)
- `trust-overrides.json` exists but is empty (`[]`)
- ClawHub integration works (external service)

**No Breaking Issues**: Skills page functions without circuit-breakers.jsonl

---

## 8. Memory Consult Pipeline

**Full Chain**:
1. **Component** → Memory > Why drawer (shown after memory is consulted)
2. **API Read** → `app/api/memory/consult/[task_id]/route.ts`
3. **Aggregator** → `lib/cae-memory-consult.ts` → `getMemoryConsultEntries(taskId)`
4. **Log Read** → `.cae/metrics/memory-consult.jsonl` per project
5. **Writer** → PostToolUse hook `tools/memory-consult-hook.sh` (Phase 8)

**Current Status**: **BROKEN (graceful fallback)**
- `memory-consult.jsonl` does not exist in any project
- `getMemoryConsultEntries()` returns `{task_id, entries: [], found: false}`
- UI uses heuristic fallback when `found: false` (shows recently modified files)

**Breakpoint**: Memory consult hook is registered but not creating files  
- Possible cause: Projects don't have `.cae/metrics/` directories auto-created by hook
- Or: Read tool is not being fired on memory-sourced files

**Note**: This is not critical because the UI has a fallback heuristic; the feature degrades gracefully.

---

## 9. Gap Matrix

| Surface | Reads From | Present | Has Data | Writer Working | Verdict |
|---------|-----------|---------|----------|-----------------|---------|
| **Home** (tokens, active agents, warnings) | `.cae/metrics/circuit-breakers.jsonl` | ❌ NO | ❌ NO | ❌ NO (CAE binary not running) | **RED** |
| **Agents Tab** (roster, stats, timeline) | `.cae/metrics/circuit-breakers.jsonl` | ❌ NO | ❌ NO | ❌ NO (same writer) | **RED** |
| **Metrics** (spending, reliability, speed) | `.cae/metrics/circuit-breakers.jsonl` + `sentinel.jsonl` | ❌ NO | ❌ NO | ❌ NO (CAE + sentinel not running) | **RED** |
| **Queue** (waiting, in-progress, shipped) | inbox/outbox dirs, tmux sessions | ✅ YES | ❌ Likely empty | ✅ Yes (outbox watcher running) | **YELLOW** |
| **Changes** (git merges, PRs) | `git log --merges` + `.cae/metrics/circuit-breakers.jsonl` | ✅ Partial | ⚠️ Partial | ⚠️ Partial (git works, CB missing) | **YELLOW** |
| **Floor** (live agents, events) | `/api/tail` → `.cae/metrics/circuit-breakers.jsonl` | ❌ NO | ❌ NO | ❌ NO (CB writer missing) | **RED** |
| **Schedule** (cron tasks, watcher) | `scheduled_tasks.json`, cron daemon | ⚠️ Partial | ❌ NO (empty registry) | ❌ NO (cron not installed) | **RED** |
| **Skills** (catalog, trust overrides) | Local dir + `trust-overrides.json` | ✅ YES | ✅ YES (can install skills) | ✅ YES (manual + ClawHub) | **GREEN** |
| **Security/Audit** (tool calls) | `.cae/metrics/tool-calls.jsonl` | ❌ NO | ❌ NO | ❌ NO (hook not registered) | **RED** |
| **Memory** (consult log, graph) | `.cae/metrics/memory-consult.jsonl`, `.cae/graph.json` | ⚠️ Partial | ⚠️ Partial (graph yes, consult no) | ⚠️ Partial (graph yes, consult not creating files) | **YELLOW** |
| **Chat** (sessions, transcripts) | `.cae/chat/{uuid}.jsonl` | ✅ YES | ✅ YES (4 sessions) | ✅ YES (PostSend hook) | **GREEN** |

---

## 10. Remediation Plan

### CRITICAL: Restore Token/Agent/Metrics Data

**Problem**: All token tracking, agent visibility, and metrics panels show zero data.

**Root Cause**: `.cae/metrics/circuit-breakers.jsonl` writer (CAE Python) is not running.

**Diagnosis**:
```bash
# 1. Check if CAE binary exists
which cae
cae --version

# 2. Check for any circuit-breaker files
find /home/cae/ctrl-alt-elite -name "circuit-breakers.jsonl" -type f

# 3. Check if any CAE tasks have run
ls -la /home/cae/ctrl-alt-elite/.cae/metrics/
# Should show circuit-breakers.jsonl, not just skill-scans.jsonl
```

**Fix Options**:
1. **If CAE is installed but not running**: Trigger a CAE task execution
   ```bash
   # Example: run a simple CAE task to generate circuit-breaker events
   cd /home/cae/ctrl-alt-elite/dashboard
   cae --help  # Should trigger logging
   ```

2. **If CAE is not installed**: Install CAE binary
   ```bash
   # Per CAE setup docs — outside dashboard scope
   pip install cae  # or similar
   ```

**Verification** (when fixed):
```bash
# After first CAE task runs:
tail -5 /home/cae/ctrl-alt-elite/.cae/metrics/circuit-breakers.jsonl
# Should show JSON lines with forge_begin, forge_end, or token_usage events

# Dashboard should now show:
# - Home: non-zero tokens_today, active agents
# - Agents Tab: roster with stats
# - Metrics: populated spending, reliability, speed panels
# - Floor: live agent events
```

---

### HIGH PRIORITY: Install Audit Hook

**Problem**: Security/Audit page shows no data. No visibility into tool calls.

**Installation**:
```bash
cd /home/cae/ctrl-alt-elite/dashboard
bash scripts/install-audit-hook.sh
```

**Verification**:
```bash
# 1. Check registration
jq '.hooks.PostToolUse | map(select(.matcher | contains("Bash"))) | length' ~/.claude/settings.json
# Should show 1

# 2. Run a Bash tool (e.g., `ls`) in Claude
# Then check:
tail -1 /home/cae/ctrl-alt-elite/.cae/metrics/tool-calls.jsonl
# Should show: {"ts":"2026-04-23T...","task":"...","tool":"Bash","cwd":"..."}

# 3. Verify dashboard
curl http://localhost:3000/api/security/audit
# Should return entries array (populated after step 2)
```

---

### HIGH PRIORITY: Install Scheduler Cron Watcher

**Problem**: Schedule page works but cron daemon is not running; scheduled tasks never dispatch.

**Installation**:
```bash
bash /home/cae/ctrl-alt-elite/dashboard/scripts/install-scheduler-cron.sh
```

**Verification**:
```bash
# 1. Check crontab
crontab -l | grep scheduler
# Should show: * * * * * "/home/cae/ctrl-alt-elite/dashboard/scripts/cae-scheduler-watcher.sh" >> /tmp/cae-scheduler.log 2>&1

# 2. Verify watcher is running (wait ~1 minute for cron to fire)
tail -10 /tmp/cae-scheduler.log
# Should show dispatch events if tasks exist

# 3. Check scheduler metrics
tail -5 /home/cae/ctrl-alt-elite/.cae/metrics/scheduler.jsonl
# Should show {"ts":"...", "event": "dispatch|complete|error", ...}
```

---

### MODERATE: Investigate Memory Consult Hook

**Problem**: Memory consult events are not being logged, but UI has safe fallback.

**Investigation**:
```bash
# 1. Verify hook is registered
jq '.hooks.PostToolUse[] | select(.matcher == "Read")' ~/.claude/settings.json
# Should show entry with memory-consult-hook.sh

# 2. Trigger a Read tool call (e.g., open a memory file in editor)
# Then check:
find /home -name "memory-consult.jsonl" 2>/dev/null

# 3. If file still doesn't exist, check hook output
ls -la /home/cae/ctrl-alt-elite/tools/memory-consult-hook.sh
# File should exist and be executable

# 4. Test hook manually
export CAE_TASK_ID="test-123"
export CAE_ROOT="/home/cae/ctrl-alt-elite"
bash /home/cae/ctrl-alt-elite/tools/memory-consult-hook.sh
ls -la /home/cae/ctrl-alt-elite/.cae/metrics/memory-consult.jsonl
# Should now exist with one line
```

**Root Cause Hypothesis**: Projects may not have `.cae/metrics/` directories auto-created. Hook silently fails to write if parent directory doesn't exist.

**Quick Fix**: Manually create the directory
```bash
mkdir -p /home/cae/ctrl-alt-elite/.cae/metrics
```

**Verification** (after fix):
- Memory > Why drawer should show consulted sources (no longer shows empty)
- Dashboard > Memory Consult route should populate entries array

---

### LOW PRIORITY: Verify Sentinel Integration

**Problem**: Reliability panel shows no sentinel approval/rejection data.

**Status**: Sentinel feature is likely not deployed yet in this environment.

**Action**: Check with team lead if sentinel should be enabled.

**If YES, enable**:
```bash
# Depends on CAE binary configuration (outside dashboard scope)
# Typically requires:
# 1. CAE config enables sentinel mode
# 2. Safety rules are defined
# 3. Sentinel process runs alongside CAE tasks
```

**Verification** (when enabled):
```bash
tail -5 /home/cae/ctrl-alt-elite/.cae/metrics/sentinel.jsonl
# Should show verdict_valid/verdict_invalid events with approve: bool
```

---

## Summary

| Issue | Severity | Installation Command | Expected Time |
|-------|----------|----------------------|----------------|
| **Circuit-breakers.jsonl missing** | CRITICAL | `# Trigger CAE task execution` | 5-10 min to test |
| **Audit hook not registered** | HIGH | `bash scripts/install-audit-hook.sh` | 1 min |
| **Scheduler not in crontab** | HIGH | `bash scripts/install-scheduler-cron.sh` | 1 min |
| **Memory consult log missing** | MODERATE | `mkdir -p .cae/metrics` + check hook | 2 min |
| **Sentinel not deployed** | LOW | `# Check with team` | N/A |

**Quick Fix (install all missing hooks + cron)**:
```bash
cd /home/cae/ctrl-alt-elite/dashboard
bash scripts/install-audit-hook.sh
bash scripts/install-scheduler-cron.sh
mkdir -p /home/cae/ctrl-alt-elite/.cae/metrics
echo "Installations complete. Waiting for CAE task execution..."
```

---

## Appendix: File Locations Reference

```
/home/cae/ctrl-alt-elite/
├── .cae/
│   ├── chat/                           # Session files exist (✅)
│   ├── graph.json                      # Memory graph (✅)
│   ├── metrics/
│   │   ├── circuit-breakers.jsonl      # MISSING (❌)
│   │   ├── sentinel.jsonl              # MISSING (❌)
│   │   ├── memory-consult.jsonl        # MISSING (❌)
│   │   ├── tool-calls.jsonl            # MISSING (❌)
│   │   ├── scheduler.jsonl             # MISSING (❌)
│   │   └── skill-scans.jsonl           # EXISTS (✅)
│   └── trust-overrides.json            # EXISTS (✅)
├── dashboard/
│   ├── scripts/
│   │   ├── install-audit-hook.sh       # Run to fix audit (needs execution)
│   │   └── install-scheduler-cron.sh   # Run to fix schedule (needs execution)
│   ├── tools/
│   │   ├── audit-hook.sh               # Exists, needs registration
│   │   └── memory-consult-hook.sh      # Registered, not firing
│   └── lib/
│       ├── cae-home-state.ts           # Reads circuit-breakers
│       ├── cae-metrics-state.ts        # Reads circuit-breakers + sentinel
│       ├── cae-agents-state.ts         # Reads circuit-breakers
│       ├── cae-audit-log.ts            # Reads tool-calls
│       ├── cae-memory-consult.ts       # Reads memory-consult
│       └── cae-schedule-store.ts       # Reads/writes scheduled_tasks.json
├── .claude/
│   └── settings.json                   # Has memory-consult hook, MISSING audit hook
└── scheduled_tasks.json                # Exists but empty
```

