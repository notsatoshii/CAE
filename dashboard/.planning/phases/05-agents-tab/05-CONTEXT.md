# Phase 5: Agents tab — Context

**Gathered:** 2026-04-22
**Status:** Ready for planning
**Source:** UI-SPEC.md §2 (left-rail tabs) + §6 (Agents tab) + §Audience reframe

<domain>
## Phase Boundary

Build `/build/agents` — the agent roster page showing all 9 CAE agents (Nexus, Forge, Sentinel, Scout, Scribe, Phantom, Aegis, Arch, Herald) as a grid of cards with health stats + a detail drawer.

**In scope:**
1. `/build/agents` route (nested under `/build` layout so top-bar + mode toggle stay)
2. Grid of agent cards (200×280px each, 2-3 columns responsive)
3. Card content: name, founder_label, model chip (dev only), token/hr sparkline, 7d success rate, avg wall time, active/queued/24h counts, concurrency dots
4. Agent grouping: **Active** (currently working) / **Recently used** (last 7d, not active) / **Dormant** (no activity 7+ days)
5. Idle-agent card variant: "inactive {N}d · last run {day}"
6. Card click → right-slide detail drawer (reuse shadcn Sheet)
7. Detail drawer: persona MD render, model override control, lifetime stats, recent invocations table (last 50), drift banner if 7d success rate drops ≥15%
8. Left-rail tab navigation — add Agents to the 5-tab left rail in /build (Home · Agents · Workflows · Queue · Changes)
9. Founder-speak headline "{Agent} — {founder_label}" (e.g., "Forge — the builder")
10. Data API: `/api/agents` new endpoint returning agent roster + stats from `.cae/metrics/*.jsonl` aggregation

**Not in scope (deferred):**
- Persona editing UI (drawer shows MD only, read-only in Phase 5 — editing deferred to v2 per UI-SPEC §6 "Edit persona ▸" which is a button but no UI yet)
- Model override server wiring (control renders but server action stubbed — full wiring ties into CAE config mutation, deferred to polish phase)
- Agent chat integration (Phase 9)
- Live Floor pixel agents (Phase 11)

</domain>

<decisions>
## Implementation Decisions

### The 9 agents

Source of truth: `lib/copy/agent-meta.ts` (Phase 4) — AGENT_META table has label, founder_label, emoji, color per agent. This phase reuses it verbatim; no new agents added.

### Left-rail tabs in /build

Add permanent left-rail (48px, icon-only) to `/build/*` layout so Home/Agents/Workflows/Queue/Changes are always accessible. Current Phase 4 `/build` home has no left-rail yet — this phase introduces it.

Rail is mounted in `app/build/layout.tsx`. Each tab is a Lucide icon wrapped in Link:
- Home (⌂) → `/build`
- Agents (👥) → `/build/agents`
- Workflows (⚡) → `/build/workflows` (stub route — Phase 6)
- Queue (📦) → `/build/queue` (existing from Phase 2)
- Changes (📜) → `/build/changes` (stub route — Phase 9)

Active tab highlighted with cyan accent (`#00d4ff`) via Tailwind conditional class. Uses `usePathname()` to detect active.

Workflows + Changes sub-routes render "Coming in Phase {N}" stub pages in this phase — keeps the rail navigable without 404s.

### Agent card layout (200×280px)

```
┌─────────────────────────────┐
│ FORGE                    ●● │  live indicator (dots = concurrent tasks)
│ the builder                 │  founder_label (dev: shows model chip claude-sonnet-4-6)
│ ─────────────────────────── │
│ token/hr    ▂▂▃▅▇▇▆▄▃▂ 12k │  sparkline
│ success 7d  ▇▇▇▇▆▇▇▇▇▇ 94% │
│ avg wall    ▃▃▂▃▃▃▃▃▄▃ 3:12│
│ ─────────────────────────── │
│ 3 active · 2 queued · 47/d  │
└─────────────────────────────┘
```

Dark theme tokens apply (Phase 3). Card uses `components/ui/card.tsx` (shadcn, dark re-themed).

Sparklines: lightweight, no chart library. Simple SVG polyline rendering of 10 values. Cyan stroke on dark background.

Concurrency dots: right side of name row. Max 4 visible dots; "+{N}" overflow if more.

### Card grouping

Server-side logic groups agents by activity:
- **Active:** `current_concurrent > 0` (currently working)
- **Recently used:** 1-7 days since last invocation
- **Dormant:** 8+ days since last invocation OR never run

Group headers in card grid: "Active (N)" / "Recently used (N)" / "Dormant (N)". Empty groups hidden. Order: Active → Recently used → Dormant.

### Idle-agent card variant

Dormant cards replace sparklines with a single line: "inactive {N}d · last run {day of week}" in muted text. All other structure preserved (name, founder_label, emoji).

### Detail drawer

Trigger: click on any card OR keyboard `Enter` when card focused. Opens right-slide sheet (50% viewport).

Contents top-to-bottom:
1. **Header:** agent name + founder_label + emoji (large, 48px), close button (Esc), drawer title "Agent detail"
2. **Persona:** MD render of `agents/cae-{name}.md` if file exists in project root. Fallback: "No persona file" (Phantom has no persona in base CAE; OK to show fallback).
3. **Model override:** current model dropdown. Shows current (e.g., `claude-sonnet-4-6`), options from a constant list. "Save" button — server action stub prints to console in Phase 5, full wiring deferred.
4. **Lifetime stats:** total tasks, total tokens, success rate, avg wall time. Top 5 expensive tasks table.
5. **Recent invocations:** last 50 invocation rows (mono font). Columns: timestamp, project, phase-task, tokens, wall time, status (✓/✗).
6. **Drift banner:** appears above Lifetime stats IF 7d success rate is <15% of 30d baseline. Red border, "Success rate trending down — investigate?" copy.

Data: fetched once when drawer opens via `/api/agents/{name}` endpoint. No polling inside drawer.

### Data API

**New endpoint:** `/api/agents` (GET) — returns roster:
```ts
type AgentRosterResponse = {
  agents: Array<{
    name: string,  // canonical: 'forge', 'sentinel', ...
    label: string,
    founder_label: string,
    emoji: string,
    color: string,
    model: string,  // current model from CAE config
    group: 'active' | 'recently_used' | 'dormant',
    last_run_days_ago: number | null,
    stats_7d: {
      tokens_per_hour: number[],  // 10 buckets for sparkline
      tokens_total: number,
      success_rate: number,  // 0-1
      success_history: number[],  // 10 buckets
      avg_wall_ms: number,
      wall_history: number[],  // 10 buckets
    },
    current: {
      concurrent: number,
      queued: number,
      last_24h_count: number,
    },
    drift_warning: boolean,  // 7d success rate < 85% of 30d baseline
  }>,
}
```

**New endpoint:** `/api/agents/[name]` (GET) — returns detail for one agent:
```ts
type AgentDetailResponse = {
  ...roster_entry,
  persona_md: string | null,  // raw MD from agents/cae-{name}.md
  lifetime: {
    tasks_total: number,
    tokens_total: number,
    success_rate: number,
    avg_wall_ms: number,
    top_expensive: Array<{
      project: string, phase: string, plan: string, task: string,
      tokens: number, timestamp: string, link?: string,
    }>,  // top 5
  },
  recent_invocations: Array<{
    ts: string, project: string, phase: string, task: string,
    model: string, tokens: number, wall_ms: number, status: 'ok' | 'fail',
  }>,  // last 50
}
```

Both endpoints aggregate from `.cae/metrics/*.jsonl` across projects (same listProjects() from Phase 4).

### Founder-speak flip

Card headline:
- Founder mode: "Forge" (bold) + "the builder" (subtitle)
- Dev mode: "FORGE" (bold uppercase) + "claude-sonnet-4-6" (model chip)

Stats labels:
- Founder: "tokens / hour", "success rate", "avg task time"
- Dev: "tok/hr", "success 7d", "avg wall"

Drift banner text:
- Founder: "{Agent} is having a rough week — check logs?"
- Dev: "{agent} success rate trending down: {pct}% vs 30d baseline {pct}%"

All new copy keys land in `lib/copy/labels.ts` under `agents.*` namespace.

### Client-side shape

Grid page (`app/build/agents/page.tsx`): server component, fetches `/api/agents` at render time, passes to client component.

Card: client component (needs click handler → URL state for drawer). Pattern mirrors Phase 4 active-phase-cards.

Drawer: client component, reads URL state `?agent={name}` and fetches `/api/agents/{name}` on mount. Reuses sheet primitive from Phase 1.

### Sparkline rendering

Hand-roll an `<Sparkline>` primitive in `components/ui/sparkline.tsx`:
```tsx
<Sparkline values={[1,2,3,5,4,6,7,8,7,6]} width={120} height={24} color="var(--accent)" />
```

SVG polyline. Normalize values to 0-1 then scale to height. 20-line implementation. Dark theme color.

### Drift detection thresholds

- Compare 7d success rate vs 30d baseline
- If 7d < 85% of 30d AND 7d has ≥5 samples: drift=true
- Don't flag if agent hasn't run enough in 30d (false positives on dormant agents waking up)

### Claude's Discretion

- Exact grid responsiveness breakpoints (1/2/3 columns)
- Sparkline visual style (line vs area fill — recommend line)
- Model dropdown options (hardcoded list OK — full dynamic list needs Anthropic API)
- Exact drawer width (50% or fixed px — match task-detail-sheet from Phase 4)
- Animation curve on card hover (shadcn default OK)

</decisions>

<canonical_refs>
## Canonical References

### Design law
- `docs/UI-SPEC.md` §2 (left-rail tabs), §6 (Agents tab), §Audience reframe

### Phase 4 artifacts (build on top)
- `lib/copy/agent-meta.ts` — AGENT_META with 9 agents (label, founder_label, emoji, color)
- `lib/copy/labels.ts` — extend with agents.* keys
- `lib/hooks/use-state-poll.tsx` — reuse for active agent count polling (optional)
- `components/ui/sheet.tsx` — drawer primitive
- `app/build/layout.tsx` — add left-rail here
- `app/build/page.tsx` — Phase 4 home (no changes; sibling route)

### Existing
- `lib/cae-config.ts` — listProjects()
- `.cae/metrics/*.jsonl` — per-agent invocation logs (schema: ts, project, agent, model, phase, task, tokens_input, tokens_output, wall_ms, status)
- `agents/cae-{name}.md` — persona files at CAE repo root (some exist, some missing)

### Project instructions
- `./CLAUDE.md`
- `.claude/skills/cae-forge/SKILL.md`

</canonical_refs>

<specifics>
## Specific Ideas

### Metrics aggregation strategy

Single pass over `.cae/metrics/*.jsonl` for all projects. Build per-agent bucketed stats in memory. Cache at process level for 30s (longer than Phase 4 home — agent stats change slower).

For sparklines (10 buckets each over last 7 days): `bucket_size_ms = 7 * 86400000 / 10`. Classify each invocation into its bucket, sum tokens / count successes / average wall time.

### Left-rail component

`components/shell/build-rail.tsx` (new):
```tsx
'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Home, Users, Zap, Inbox, ScrollText } from 'lucide-react'

const TABS = [
  { href: '/build', icon: Home, label: 'Home' },
  { href: '/build/agents', icon: Users, label: 'Agents' },
  { href: '/build/workflows', icon: Zap, label: 'Workflows' },
  { href: '/build/queue', icon: Inbox, label: 'Queue' },
  { href: '/build/changes', icon: ScrollText, label: 'Changes' },
]
```

Width 48px, icon 20px (per UI-SPEC §13). Active tab: cyan left border + subtle bg. Inactive: hover bg subtle.

Update `app/build/layout.tsx` to render `<BuildRail>` + main content in flex row.

### Stub routes for Workflows + Changes

`app/build/workflows/page.tsx` + `app/build/changes/page.tsx` — simple "Coming in Phase 6" / "Coming in Phase 9" stubs. Keeps rail navigable, no broken links.

### Persona file lookup

Persona files are at `/home/cae/ctrl-alt-elite/agents/cae-{name}.md` (repo root). Some may not exist (e.g., Phantom). Server action tries fs.readFile, returns null if ENOENT.

Render MD via an existing MD renderer if one is installed (check package.json); otherwise use `react-markdown` (pnpm add). Check first — if already present from Phase 2 or elsewhere, reuse.

### Drift banner copy

Founder: "Forge is having a rough week — check logs?" with a "View recent" button linking to the invocations table below.

Dev: "forge success rate trending down: 72% vs 30d baseline 91% (threshold 85%)"

</specifics>

<deferred>
## Deferred Ideas

- **Persona editing UI** → v2
- **Full model override wiring** → Polish phase
- **Per-agent cost projection** → future Metrics phase work
- **Agent-to-agent interaction graph** → Memory+Graphify (Phase 8)
- **"Pin favorite agents"** → v2
- **Custom agent creation** → v2
- **Time-range filter** on recent invocations → v2 (default: last 50)

</deferred>

---

*Phase: 05-agents-tab*
*Context gathered: 2026-04-22*
