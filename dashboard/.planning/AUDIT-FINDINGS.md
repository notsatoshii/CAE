# CAE Dashboard — Full UX Audit Findings

Audit date: 2026-04-28
Auditor: Timmy (acting as end-user)

## Severity Key
- **P0**: Broken — feature doesn't work, crashes, or blocks usage
- **P1**: Looks bad — unprofessional, confusing, or misleading
- **P2**: Minor polish — small improvements, nice-to-haves

---

## GLOBAL / SHELL

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| G1 | P0 | `/api/state` cold start takes 14s | ~~First page load blocks for 14s before any data shows. Pikachu loading screen displays during this time.~~ **FIXED**: stale-while-revalidate pattern — serves cached data within 2min, background refresh. Only first-ever cold start blocks. |
| G2 | P1 | Liveness shows "Connecting..." until state poll succeeds | Liveness chip stays orange "Connecting..." for 14s on cold start, then switches to "Live". Should show "Warming up..." or similar. |
| G3 | P2 | Cost ticker shows "0 tok today —" | The trailing dash is confusing. Should show "0 tok today" or "0 tok today · idle" |
| G4 | P2 | Top bar has two "Explain this metric" buttons | Both look identical, unclear what they explain |

## HOME PAGE (`/`)

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| H1 | P1 | Activity feed shows wall of "heartbeat" entries | 20+ identical heartbeat rows with no aggregation. Should collapse to "23 heartbeats in last minute" |
| H2 | P1 | BURN · 7D card has very poor text contrast | Sub-labels nearly invisible against dark background |
| H3 | P1 | LAST 60S sparkline chart is empty with no axes | Shows blank area with just "idle" text — looks broken even when correct |
| H4 | P2 | "Recent" section shows identical build descriptions | All say "Built with CAE Build System (ctrl-alt-elite)" — no differentiating info |
| H5 | P2 | Mission Control stat labels too faint | "agents working", "Peak 7d", etc. nearly illegible |
| H6 | P2 | Live Floor widget too small to be useful | Colored squares barely distinguishable |

## AGENTS PAGE (`/build/agents`)

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| A1 | P2 | All agents show "0%" success rate | Expected for idle state but looks concerning — consider "—" for agents with no jobs |
| A2 | P2 | Verb buttons (Start/Stop/Archive) are non-functional | `onClick` only calls `stopPropagation()` — no actual action |
| A3 | P2 | "10000 / day" rate display on Forge card | Looks like a bug — unlikely real rate when everything else is 0 |

## QUEUE PAGE (`/build/queue`)

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| Q1 | P1 | Shipped cards show "— · —" for all metadata | Agent and timestamp both missing on shipped items |
| Q2 | P1 | "No items" text in empty columns is unstyled | Just plain text, no empty state design |
| Q3 | P2 | Card titles truncated with no tooltip or expand | Can't read full buildplan names |
| Q4 | P2 | Some cards in Waiting column are bundled under others | Multiple cards appear nested under one button element |

## SKILLS PAGE (`/build/skills`)

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| S1 | ✅ | Detail drawer works | Shows full SKILL.md content |
| S2 | ✅ | Edit mode works | Textarea + Save/Cancel functional |
| S3 | P2 | No success feedback after save | Save works but no toast/flash confirmation |
| S4 | P2 | Search results count not shown | "75 skills" shown on tab but no "X results for 'query'" feedback |

## LIVE FLOOR (`/floor`)

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| F1 | P0 | All station labels overlap in center | 10 labels stacked on top of each other, completely unreadable |
| F2 | P1 | Only 2 location markers visible | Legend shows 11 locations but only 2 colored diamonds on grid |
| F3 | P1 | Only 1 agent sprite visible | 9 agents defined but only Forge has a sprite |
| F4 | P1 | All stations clustered in center | Grid is large but everything bunched in one spot |
| F5 | P2 | Legend colors hard to distinguish | Similar dark colors for different items |

## METRICS (`/metrics`)

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| M1 | ✅ | All panels render correctly | Spending, Reliability, Speed, Incidents all show data |
| M2 | P2 | "0%" success rate messaging is alarming | "CAE is getting things right 0% of the time" — should say "No completed jobs yet" |
| M3 | P2 | Retry heatmap shows empty grid | Looks like a broken chart rather than "no retries" |

## MEMORY (`/memory`)

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| ME1 | ✅ | Browse tab works | File tree loads, files readable |
| ME2 | P2 | Initial load shows "Loading..." for 3-5s | Expected for first compile but feels slow |

## CHAT (`/chat`)

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| C1 | P1 | Mirror panel left side shows placeholder data | "· phase % · wave /" — literal format string not rendered |
| C2 | P2 | Chat is non-functional | Send button disabled, no actual AI integration |

## SECURITY (`/build/security`)

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| SEC1 | P2 | "No installed skills found" despite 75 skills existing | Trust scoring doesn't detect local skills |

## CHANGES (`/build/changes`)

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| CH1 | P2 | "Nothing's shipped in the last 30 days" | Incorrect — commits exist from today. Uses different data source than commits |

## WORKFLOWS (`/build/workflows`)

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| W1 | P1 | Sidebar says "Workflows" but page heading says "Recipes" | Naming mismatch |

## SCHEDULE (`/build/schedule`)

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| SC1 | P2 | Clean empty state | Works fine, just no data |

## PLAN (`/plan`)

| # | Severity | Issue | Details |
|---|----------|-------|---------|
| P1 | P2 | Placeholder page with non-functional tabs | Expected — feature not built yet |

---

## PRIORITY FIX ORDER

### Batch 1 — P0 Blockers (DONE)
1. ~~`/api/state` cold start hang~~ → Fixed with stale-while-revalidate

### Batch 2 — P0/P1 Visual Breaks
1. **F1**: Live Floor label overlap → need collision avoidance or spread stations
2. **C1**: Chat mirror placeholder format string
3. **W1**: Workflows/Recipes naming mismatch
4. **H1**: Activity feed heartbeat aggregation

### Batch 3 — P1 Data Issues
5. **Q1**: Queue shipped cards missing metadata
6. **Q2**: Queue empty column styling
7. **M2**: Metrics "0% success" alarming copy
8. **H2/H5**: Contrast improvements on Mission Control

### Batch 4 — P2 Polish
9. **A2**: Wire up agent verb buttons or remove them
10. **S3**: Save confirmation toast
11. **G3**: Cost ticker trailing dash
12. **H4**: Deduplicate "Recent" build entries
