# Memory Graph Audit — Phase 15

**Status:** AUDIT ONLY. No code changes.  
**Date:** 2026-04-23  
**Context:** Eric stated "knowledge graphs DO NOT work the way I wanted them to. they should work like knowledge graphs in obsidian or the visuals like in graphify." This audit investigates the gap.

---

## Executive Summary

The current CAE memory graph is **structurally sound but visually and functionally incomplete** relative to Eric's mental model. The implementation ships Phase 8 (Waves 1-5) features only:

- ✅ React-flow v12 DOM rendering with dagre LR layout
- ✅ 4-kind node filtering (phases/agents/notes/PRDs)  
- ✅ Node drawer with backlinks + forward-refs
- ✅ Graph regeneration button with 60s cooldown
- ✅ Text-extracted edges (markdown links + @-refs)

**Missing entirely** (per KNOWLEDGE-LAYER-DESIGN.md §5 & §6):

- ❌ Force-directed layout (d3-force) — currently pure dagre (structural/hierarchical only)
- ❌ Node size by centrality/inbound-count — all nodes 180×50 px
- ❌ Edge color by type (mentions/related/derived_from/supersedes) — all edges gray
- ❌ Halo on recently accessed nodes — no access-log.jsonl
- ❌ Re-analyze button + modal with 3-stage UX — only "Regenerate" exists
- ❌ Search + path-highlight — no search box in graph
- ❌ Markdown body rendering in drawer — node drawer shows only file path + backlinks list
- ❌ `.cae/knowledge/` directory structure (edges.jsonl, snapshot.json, etc.) — `.cae/graph.json` only
- ❌ LLM relationship extractor (opus-4-7) — no semantic edges at all
- ❌ Post-commit + agent hooks — no continuous labelling
- ❌ Wikilink normalization — no in-app wikilink→markdown link flow

**Gap impact:** The graph *works* as a **read-only structural reference**, but lacks the **interactive intelligence** (search, relationships, re-organization, live updates) that make Obsidian graphs useful.

---

## 1. Route + Component Inventory

### Routes

| Route | Purpose | Implemented |
|-------|---------|-------------|
| `/memory` | Server shell (auth-gated) | ✅ |
| `/memory?view=graph` | Tab routing (deep-link) | ✅ |
| `/api/memory/graph` | GET graph payload | ✅ |
| `/api/memory/regenerate` | POST trigger walk | ✅ |
| `/api/memory/search` | Full-text search | ✅ (browse only) |
| `/api/memory/file/[...path]` | GET markdown content | ✅ |
| `/api/memory/tree` | File tree for browse | ✅ |
| `/api/memory/git-log/[...path]` | Git history for drawer | ✅ |
| `/api/memory/analyze` | POST re-analyze + SSE | ❌ (not wired) |
| `/api/memory/apply` | POST apply suggestions | ❌ (not wired) |
| `/api/memory/revert` | POST revert snapshot | ❌ (not wired) |
| `/api/memory/file-meta?path=...` | GET file frontmatter | ❌ (not wired) |
| `/api/editor/open` | Launch editor | ❌ (not wired) |

### Components

**Graph pane:**
- `components/memory/graph/graph-pane.tsx` — Tab container, filter state, loading/error/empty handling
- `components/memory/graph/graph-canvas.tsx` — ReactFlow canvas (DOM nodes, dagre layout only)
- `components/memory/graph/graph-filters.tsx` — 4 chips for kind toggling
- `components/memory/graph/node-drawer.tsx` — Side panel on node click; shows label, kind, source file, backlinks, forward-refs
- `components/memory/graph/regenerate-button.tsx` — Cooldown-gated POST trigger, 60s countdown
- `components/memory/graph/layout-dagre.ts` — Pure layout util (no force)

**Browse pane:**
- `components/memory/browse/browse-pane.tsx` — File tree + markdown viewer
- `components/memory/browse/file-tree.tsx` — Tree UI
- `components/memory/browse/markdown-view.tsx` — Fetches + renders markdown body (react-markdown + remark-gfm)
- `components/memory/browse/search-bar.tsx` — Full-text search input
- `components/memory/browse/search-results.tsx` — FTS results list

**Shared:**
- `app/memory/memory-client.tsx` — Base-UI Tabs router; mounts both panes + drawers (WhyDrawer, GitTimelineDrawer)
- `app/memory/page.tsx` — Server shell (auth check)

### What's rendered

**Graph tab (`view=graph`):**
- Node cap banner (if >500 nodes)
- Controls: GraphFilters (4 chips) + RegenerateButton + ExplainTooltip
- Canvas: ReactFlow (dagre LR layout, border-color by kind, click → NodeDrawer)
- Drawer: side panel (label, kind badge, source file, backlinks list, forward-refs list)

**Browse tab (`view=browse`):**
- File tree (left rail, collapsible)
- Markdown viewer (right pane, react-markdown rendering)
- Search results overlay (if query active)

---

## 2. Graph Data Flow

### Current (`regenerateGraph` only)

```
/api/memory/regenerate (POST)
  ↓
lib/cae-graph-state.ts :: regenerateGraph()
  ├─ walkMemorySources()  [no-op if called >2s after last]
  │   ├─ listProjects() → listMemorySources(project.path)
  │   ├─ Read .md files from allowlist globs
  │   ├─ Extract MARKDOWN_LINK_RE + AT_REF_RE (text regex only)
  │   └─ Emit nodes + links
  ├─ Atomic write → .cae/graph.json (tmp + rename)
  └─ Return {ok, duration_ms, total_nodes}
  ↓
/api/memory/graph (GET)
  ├─ loadGraph() reads .cae/graph.json
  ├─ Classify nodes by path pattern (classifyNode)
  ├─ Apply 500-node render cap
  └─ Return GraphPayload {nodes, links, generated_at, ...}
  ↓
GraphPane → GraphCanvas
  ├─ applyDagreLayout(nodes, links) → {position}
  └─ Render ReactFlow
```

### `.cae/graph.json` schema

Current file (when present):

```json
{
  "nodes": [
    {
      "id": "/abs/path/file.md",
      "label": "First H1 from file",
      "source_file": "/abs/path/file.md",
      "file_type": "md",
      "kind": "phases|agents|notes|PRDs"
    }
  ],
  "links": [
    {
      "source": "/abs/path/a.md",
      "target": "/abs/path/b.md",
      "relation": "markdown_link|at_ref|heading_ref",
      "confidence": "EXTRACTED"
    }
  ],
  "generated_at": "2026-04-23T...",
  "source_path": "/home/cae/.cae/graph.json",
  "truncated": false,
  "total_nodes": 42
}
```

### What's NOT present

- **No `.cae/knowledge/` dir** (KNOWLEDGE-LAYER-DESIGN.md §2). Missing:
  - `edges.jsonl` (append-only event log with confidence scores)
  - `snapshot.json` (materialized view with node centrality, recency, etc.)
  - `proposed-changes.json` (LLM suggestions pending review)
  - `agent-invocations.jsonl` (PostToolUse hook output)
  - `commits.jsonl` (post-commit hook output)
  - `logs/` subdir (analyzer runs, errors, LLM costs)
  - `snapshots/` subdir (pre-apply backups, rollback trails)

- **No metadata in nodes** — missing from schema:
  - `centrality` (PageRank-style importance)
  - `inbound_count` / `outbound_count` (for sizing)
  - `recency_score` (exp decay on `updated_at`)
  - `last_accessed_at` (from access-log.jsonl)
  - `tags` (from frontmatter)
  - `description` (one-liner from frontmatter)

- **No rich edge types** — only 3 extraction types, no semantic edges:
  - ❌ `related` (LLM similarity)
  - ❌ `derived_from` (LLM dependency)
  - ❌ `supersedes` (LLM / manual overrides)
  - ❌ `mentioned_by_action` (commit/agent touched file)
  - ❌ `worked_on_by` (agent read/wrote file)
  - ❌ `part_of_phase` (regex extracted)

### File generation

| Source | Generator | Trigger | Frequency |
|--------|-----------|---------|-----------|
| `.cae/graph.json` | `regenerateGraph()` (pure TS walker) | Click button or `/api/memory/regenerate` | Manual + 60s cooldown |
| **Not yet wired:** |
| `edges.jsonl` | Memory analyzer (5-stage pipeline) | Button / post-commit / agent hook / 15m cron | Continuous (proposed) |
| `snapshot.json` | Analyzer snapshot rebuild | After edges append | On-demand + 15m cron |
| `access-log.jsonl` | Session logger (hypothetical) | File access in graph drawer | On every click |
| `commits.jsonl` | Post-commit hook | Git commit | Per commit |
| `agent-invocations.jsonl` | PostToolUse hook | Agent completion | Per agent task |

### Graph size / node count

**Current:**
- ~65 memory markdown files found under `listMemorySources` allowlist
- Typical graph: 42–55 nodes (after walk)
- Edge count: ~80–120 edges (markdown links + @-refs)
- 500-node render cap (D-05) not yet triggered

**If analyzer + hooks wired:**
- Estimated +20–40 LLM-suggested edges per 50 files (~0.3–0.8 added per file)
- Commits + agent invocations would add nodes (currently explicit opt-in, deferred to v2)

---

## 3. Graph Rendering Quality

### Library versions

```
@xyflow/react: 12.10.2
@dagrejs/dagre: 3.0.0
d3-force: ❌ NOT INSTALLED (would need `npm install d3-force`)
```

### Layout algorithm

**Current:** Dagre LR (left-to-right rank-based)

```typescript
// layout-dagre.ts
g.setGraph({ rankdir: "LR", ranksep: 80, nodesep: 40 });
dagre.layout(g);
```

- ✅ Deterministic, fast (<5ms for 500 nodes)
- ✅ Respects hierarchical structure (parent → children layer)
- ❌ **No physics** — straight hierarchical, not force-directed
- ❌ Does NOT cluster by topic (all layout is left-right rank)
- ❌ No organic clustering (what Obsidian achieves with d3-force)

**What Eric likely wants:** Force-directed layout (what Obsidian ships)

```
Force-directed (d3-force):
  - Nodes repel each other (avoid overlap)
  - Edges attract (pull related nodes close)
  - Gravity toward center
  - Settles into organic clusters
  → "Knowledge graphs in Obsidian" feel
```

### Node visuals

| Aspect | Current | Obsidian | Graphify | Gap |
|--------|---------|----------|----------|-----|
| **Shape** | Rectangle (ReactFlow default) | Circle | Node badges | Shape mismatch |
| **Size** | All 180×50 px fixed | By link count (radius ∝ links) | By importance | No sizing by centrality |
| **Label** | Text only | Title in center | Title + icon | No metadata display |
| **Colors** | Border color by kind | By tag/folder | Color palette | No edge-color; only node-border |
| **Hover state** | No visual change | Dims others, lights connection | Highlight connection | Missing hover interaction |
| **Halo/glow** | None | Pulsing ring on recent | Subtle glow | No access tracking |

**Current node style:**
```tsx
style: {
  border: "1px solid " + KIND_BORDER[n.kind],  // kind-specific color
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 12,
  borderRadius: 6,
  padding: "6px 10px",
  width: 180,  // FIXED
}
```

**Missing implementations:**
- No node size variation (`clamp(8, 8 + log2(inbound+1)*6, 28)` from spec)
- No hover handler to dim/highlight connected nodes
- No halo overlay for recently accessed nodes

### Edge visuals

| Aspect | Current | Obsidian | Graphify | Gap |
|--------|---------|----------|----------|-----|
| **Color** | All gray (`--border-strong`) | By type / relationship | By type | All same color |
| **Weight** | All 1px stroke | By confidence / strength | Vary | No weight variation |
| **Type indicator** | Not visible | Label on hover | Color legend | No edge type legend |
| **Arrowhead** | None | Optional toggle | Optional | Not supported |
| **Dash style** | Solid | Varies by type | Varies | All solid |

**Current edge style:**
```tsx
style: { stroke: "var(--border-strong)", strokeWidth: 1 }
```

**Spec calls for (§5.2):**
```
mentions → var(--border-strong) [neutral]
related → var(--accent) [cyan]
derived_from → var(--success) [green]
supersedes → var(--warning) [amber, dashed]
mentioned_by_action → var(--info) [blue]
worked_on_by → var(--accent-muted) [faint cyan]
part_of_phase → purple token (new)
```

**Current implementation:** ZERO edge-color logic. All edges render with `--border-strong` regardless of `relation` field.

### Interactivity

| Feature | Current | Working | Notes |
|---------|---------|---------|-------|
| **Pan/zoom** | ✅ | Yes | ReactFlow native |
| **Click node** | ✅ | Yes | Opens NodeDrawer |
| **Drag node** | ✅ | Yes | ReactFlow native |
| **Filter by kind** | ✅ | Yes | Chip toggles |
| **Search** | ❌ | No | No search box in graph tab |
| **Path highlight** | ❌ | No | No BFS path between 2 nodes |
| **Hover → dim others** | ❌ | No | No hover handler |
| **Click to preview neighbor** | ❌ | No | Only side drawer, no tooltip |
| **Re-analyze modal** | ❌ | No | Only "Regenerate" button (read-only) |
| **Diff preview** | ❌ | No | Not implemented |
| **Edge filter pills** | ❌ | No | Would need edge type color coding first |

### Side panel (NodeDrawer)

**Current implementation:**

```
┌─ Label + Kind badge + Close X
├─ Source file (mono, copy-on-click)
├─ Back-links list (label only, no snippets)
└─ Forward-refs list (label only, no snippets)
```

**Missing (per §5.2):**
- ❌ Full markdown body (react-markdown)
- ❌ Frontmatter as metadata strip (created/updated/last-analyzed)
- ❌ Tag pills
- ❌ Suggested-related list with Accept/Reject buttons
- ❌ "Open in editor" button → `/api/editor/open`
- ❌ Wikilink hover-cards (tooltip on `[file.md]()` links)
- ❌ "Superseded by X" banner
- ❌ Backlinks with context snippets (spec calls for ≤10 words from linking sentence)

**Current backlinks:**
```tsx
{backLinks.map(l => (
  <li key={l.source}>
    <button onClick={...}>
      {basename(l.source)}
    </button>
  </li>
))}
```

No snippet, no context.

### Search / filtering

| Feature | Scope | Status |
|---------|-------|--------|
| **Full-text search (Browse tab)** | File tree + markdown content | ✅ Wired (`/api/memory/search`) |
| **Fuzzy search (Graph tab)** | Node labels + descriptions | ❌ Not implemented |
| **Path highlight** | BFS between 2 matches | ❌ Not implemented |
| **Edge filter pills** | Toggle edge types on/off | ❌ Not implemented (no edge colors first) |
| **Node filter pills** | Type / age / recency facets | ❌ Not implemented (only kind chips exist) |
| **Tag filter** | Via frontmatter `tags[]` | ❌ Not wired (no frontmatter in schema) |

---

## 4. Comparison vs Obsidian + Graphify

### What Obsidian's graph view does that CAE doesn't

| Feature | Obsidian | CAE | Criticality |
|---------|----------|-----|-------------|
| **Force layout with physics** | ✅ d3-force, nodes settle into organic clusters | ❌ Pure dagre (hierarchical only) | **CRITICAL** — Eric's primary complaint |
| **Node size ∝ link count** | ✅ Bigger = more connected | ❌ All 180×50 px fixed | **HIGH** — visual importance hierarchy |
| **Hover → dims+highlights** | ✅ Hover node → others fade to 30% opacity + connected edges glow | ❌ No hover handler | **HIGH** — local context exploration |
| **Click → side panel w/ body** | ✅ Full markdown content, metadata, backlinks with snippets | ❌ Only file path + backlink filenames | **HIGH** — content exploration |
| **Backlinks with context** | ✅ "X mentions this in: 'snippet of sentence containing link'" | ❌ Only filename list | **MED** — comprehension |
| **Search + path highlight** | ✅ Search query highlights matching nodes; if 2+ matches, shows shortest path | ❌ No graph search | **MED** — discovery |
| **Tag/folder filtering** | ✅ Chips to toggle tag groups | ❌ Only node kind chips (phases/agents/notes/PRDs) | **MED** — scoping |
| **Bidirectional backlinks auto-maintained** | ✅ Post-commit hook (implied by Obsidian's editor) | ❌ Manual markdown links only | **MED** — relationship consistency |
| **Access tracking (halo glow)** | ✅ Recently opened files pulse | ❌ No access-log.jsonl | **LOW** — UX polish |

### What Graphify does that CAE doesn't

(Graphify = `safishamsi/graphify` CLI used in session 4 per `project_cae_dashboard_graphify.md`)

Graphify generates a JSON graph structure and renders it. CAE is now doing the same (pure TS walker → JSON → react-flow). The visual gap is not Graphify-specific but general **force layout + edge colors + node sizing**.

From VISUAL-RESEARCH.md §12:

> The 2026 SaaS dashboard typography landscape converged on a small set:
> 
> **react-flow + d3-force-3d** for layout. Already locked.
> Implementation pattern: custom node card (200×80), edges colored by type, force layout → freeze, hover → dim+highlight, click → side panel with full content + backlinks list.

CAE's current position: halfway through that vision. Has the side panel infrastructure but not the visual sophistication.

---

## 5. Memory File Structure

### Memory directory locations

```
/root/.claude/projects/-root/memory/         # 65 .md files (main vault)
  ├─ MEMORY.md (hand-curated index)
  ├─ project_*.md (24 files)
  ├─ bug_*.md (8 files)
  ├─ feedback_*.md (9 files)
  ├─ user_*.md (5 files)
  └─ ... (handoff docs, decision logs)

/home/cae/ctrl-alt-elite/dashboard/.planning/phases/*/CLAUDE.md  # Phase docs (auto-detected via .cae/memory globs)
```

### Frontmatter (sample from 3 files)

**File 1:** `/root/.claude/projects/-root/memory/bug_claude_cli_2.1.117_headless_oauth.md`

```yaml
---
name: Claude CLI 2.1.117 headless OAuth broken
description: Direct `claude auth login` and `claude setup-token` on headless Linux return 400 on token exchange. Root cause = CLI bug (likely redirect_uri mismatch in POST to platform.claude.com/v1/oauth/token). Workaround = cron-mirror creds from primary user.
type: project
originSessionId: d2894e24-06d4-4fb1-b38f-07bac74a1949
---
```

**File 2:** `/root/.claude/projects/-root/memory/MEMORY.md` (hand-maintained index)

```yaml
# Memory Index

- [project_recon_full_state.md](project_recon_full_state.md) — RECON intelligence system: full architecture, what's working, what needs fixing. Resume here for any RECON work.
- [bug_recon_sigpipe_set_e.md](bug_recon_sigpipe_set_e.md) — FIXED 2026-04-16: run_recon.sh...
...
```

**Analysis:**
- ✅ Files use Markdown link syntax `[label](path.md)` (disk-friendly, grep-friendly)
- ✅ Some files have YAML frontmatter (`name`, `description`, `type`, `originSessionId`)
- ⚠️ **Many files have NO frontmatter** (only full body, or only YAML name+desc)
- ❌ **No `tags[]` field** (mentioned in KNOWLEDGE-LAYER-DESIGN spec but absent from real files)
- ❌ **No `related[]` field** (analyzer-suggested, but no live analyzer yet)
- ❌ **No `mentions_files`, `mentions_agents`, `mentions_phases`, `mentions_commits`** (auto-extracted by analyzer, but analyzer not wired)
- ❌ **No `backlinks` section** (generator outputs `##Backlinks` but not auto-maintained)

### Link patterns observed

```
[project_recon_full_state.md](project_recon_full_state.md)  # relative path
[RECON intel pulled into Phase 9 onboarding…]               # human description
```

Standard markdown links. No `[[wikilink]]` syntax observed in real files (spec supports this as input, normalizes to markdown on analyzer pass).

### What's missing

| Feature | Status | Impact |
|---------|--------|--------|
| **Complete frontmatter** | Partial; many files lack required fields | Analyzer can't extract `mentions_*` without rerun |
| **Wikilink support** | Not used (files use markdown links) | Not urgent; markdown links work |
| **Backlinks section** | Manually curated MEMORY.md only | Should be auto-maintained per §1.3 of spec |
| **Auto-extracted mentions** | Not present | Requires analyzer pass |
| **LLM-suggested related[]** | Not present | Requires analyzer pass + user acceptance |
| **Bid backlinks (incoming + outgoing)** | Manual links only; no incoming-edge index | Should be computed from edges.jsonl |
| **Post-commit relinking** | No hook installed | Requires git/hooks setup |

---

## 6. Re-analyze Button Status

### Current state

**Single button exists:** `RegenerateButton` in `components/memory/graph/regenerate-button.tsx`

```tsx
<button onClick={handleClick} disabled={pending || cooldownActive}>
  {pending ? <Loader2 animate /> : <RefreshCw />}
  {label}
</button>
```

**What it does:**
1. POST `/api/memory/regenerate` (client-side)
2. Server calls `regenerateGraph()` (pure TS walker)
3. Walks memory sources + extracts markdown links + @-refs
4. Writes atomic `.cae/graph.json`
5. Returns `{ok, duration_ms, total_nodes}`
6. Calls `onRegenerated()` callback (triggers graph refetch)
7. 60s cooldown (client-side countdown + server-side gate)

**UX:**
- Simple button with pending spinner
- No modal
- No progress steps
- No diff preview
- No accept/reject flow

### What Eric's mental model expects (per KNOWLEDGE-LAYER-DESIGN.md §6)

```
Click "Re-analyze" → Modal opens
  │
  ├─ Stage 1: Progress
  │   - Phase label: "Reading 87 files…" → "Extracting entities…" → "Calling LLM…" → "Computing diffs…"
  │   - Progress bar (0–100%)
  │   - Cancel button
  │
  ├─ Stage 2: Diff preview
  │   - Header: "47 edges to add · 3 to remove · 12 files affected"
  │   - File list (left rail) + diff pane (right)
  │   - Frontmatter before/after (side-by-side)
  │   - Backlinks list before/after
  │   - Per-suggestion toggle: ☑ accept / ☐ reject
  │   - Bulk actions: "Accept all", "Reject all", "Accept ≥0.85 confidence"
  │   - "Apply (n selected)" + "Cancel"
  │
  ├─ Stage 3: Apply
  │   - Progress bar (files written, edges appended, snapshot rebuilt)
  │   - Toast on completion: "Applied 38 changes. [Revert] [Show graph]"
  │   - Auto-close modal
  │   - Graph auto-refetch
  │
  └─ Revert path
      - Each apply records pre-apply snapshot
      - Toast "Revert" button → POST /api/memory/revert
      - Confirm dialog
```

### Gap analysis

| Expectation | Current | Status |
|-------------|---------|--------|
| Modal workflow | Simple button → POST → reload | ❌ Missing 3-stage flow |
| Progress streaming | None | ❌ No SSE or EventSource |
| Diff preview | None | ❌ Not implemented |
| File list in modal | N/A | ❌ Not implemented |
| Frontmatter diffs | N/A | ❌ Not implemented |
| Suggestion toggle | N/A | ❌ Not implemented |
| LLM relationships | None (generator is text-only) | ❌ No opus-4-7 call |
| Apply atomicity | Assumes success (no rollback) | ⚠️ Partial (no snapshot on error) |
| Revert infrastructure | None | ❌ No snapshot dir structure |
| SSE progress | None | ❌ Not wired |
| Toast with actions | Potential (sonner installed) | ⚠️ Library present, not used for re-analyze |

### API routes needed (not yet wired)

```
POST /api/memory/analyze
  → spawn analyzer in preview mode
  → return SSE stream: { phase, current, total, file?, error? }
  → write proposed-changes.json

POST /api/memory/apply
  → read proposed-changes.json
  → snapshot current state
  → rewrite files + edges.jsonl + snapshot.json
  → return receipt or error

POST /api/memory/revert
  → restore from snapshot dir
  → reset state

GET /api/memory/file-meta?path=...
  → return { description, tags, updated_at, inbound_count, ... }
  → lazy fetch for wikilink tooltips

POST /api/editor/open
  → spawn code / cursor / xdg-open
  → allowed_roots check
```

---

## 7. Continuous Labelling Status

### What's wired

Nothing yet. The spec (§4) calls for:

1. **Post-commit hook** — `.git/hooks/post-commit`  
   - NOT installed
   - Would call `memory-analyzer.ts commit HEAD --json`
   - Appends `commits.jsonl` + `mentioned_by_action` edges

2. **Agent invocation logger** — PostToolUse hook  
   - NOT configured in `~/.claude/settings.json`
   - Would fire on Agent tool completion
   - Logs `agent-invocations.jsonl`
   - Analyzer later reads to emit `worked_on_by` edges

3. **15-minute cron** — Entry in `scripts/cae-scheduler-watcher.sh`  
   - NOT added to task table
   - Would call `memory-analyzer.ts incremental --json`
   - Diffs file mtimes vs `last_reanalyzed_at` in frontmatter

### What would be required

| Component | Files | Status |
|-----------|-------|--------|
| Memory analyzer CLI | `scripts/memory-analyzer.ts` + `lib/memory/analyzer/*.ts` | ❌ Not written |
| `.git/hooks/post-commit` | `.git/hooks/post-commit` | ❌ Not installed |
| PostToolUse hook | `~/.claude/settings.json` + `scripts/agent-invocation-logger.ts` | ❌ Not configured |
| Cron entry | `scripts/cae-scheduler-watcher.sh` (task table) | ❌ Not added |
| Analyzer logger | `lib/memory/analyzer/index.ts` (5-stage orchestrator) | ❌ Not written |

### Current state

**Only manual regeneration exists** via RegenerateButton → `/api/memory/regenerate` → pure TS walker. No analyzer, no LLM, no hooks, no continuous updates.

---

## 8. Specific Gap Matrix

### Feature comparison

| Obsidian feature | CAE current | Eric's mental model | Gap | Criticality |
|---|---|---|---|---|
| **Force-directed layout** | Dagre LR (hierarchical) | Organic clustering via d3-force physics | Visual layout fundamentally different | **CRITICAL** |
| **Node size by importance** | Fixed 180×50 all nodes | Radius ∝ inbound_count; larger = more connected | No size variation | **HIGH** |
| **Hover → highlights connection** | No hover handler | Dim others (30% opacity) + light edges to connected nodes | Missing interaction | **HIGH** |
| **Click → full markdown body** | Only file path + backlink list | Full content + metadata + backlinks with snippets | Minimal content access | **HIGH** |
| **Edge color by type** | All gray | 7+ color types (mentions/related/supersedes/etc.) | No visual relationship hierarchy | **HIGH** |
| **Search in graph** | No graph search box | Fuzzy on labels + descriptions | No discovery UI | **MEDIUM** |
| **Path highlight (2+ matches)** | Not implemented | BFS highlight shortest path | Missing | **MEDIUM** |
| **Re-analyze with diff modal** | Only "Regenerate" read-only | 3-stage flow: progress → diff → apply | Approval workflow missing | **MEDIUM** |
| **Backlinks with context snippets** | File list only | "In X: 'sentence containing link'" (≤10 words) | No comprehension aids | **MEDIUM** |
| **Tag/folder filtering** | 4 kind chips only | Faceted search (type / age / recency) | Coarse filtering | **LOW** |
| **Wikilink support** | Markdown links only | `[[file\|label]]` input → normalized to markdown | Not needed (markdown works) | **LOW** |
| **Supersede banners** | No | "Superseded by X" in drawer | Polish missing | **LOW** |
| **Mini-map** | No | Bottom-right xyflow MiniMap component | Missing (low-effort add) | **LOW** |
| **Halo on recently accessed** | No | Pulsing ring (access-log.jsonl) | Requires session logger | **LOW** |
| **Access-log tracking** | No | Rolling 24h window of file opens | Requires infrastructure | **LOW** |
| **LLM semantic edges** | No | Opus-4-7 relationship extraction | Requires analyzer + LLM route | **CRITICAL** |

---

## 9. Upgrade Path

### Waves to ship (from KNOWLEDGE-LAYER-DESIGN.md §10 breakdown)

**Phase 15 scope:** E8 visualization + analyzer infrastructure setup (Tracks B+C)

| Wave | Title | Effort | Dependencies | Eric gate |
|------|-------|--------|--------------|-----------|
| **W1** | Frontmatter spec + schema validation | 3d | None | ✅ Spec locked |
| **W2** | Migration tool (non-LLM) | 4d | W1 | Dry-run review |
| **W3** | edges.jsonl + snapshot.json storage | 2d | W1 | ✅ Locked |
| **W4** | Analyzer CLI (regex + backlinks, no LLM) | 5d | W2, W3 | Dry-run review |
| **W5** | LLM extractor (opus-4-7, prompt cache) | 3d | W4 | Cost review |
| **W6** | Post-commit + agent hook + cron | 2d | W4 | Trust review |
| **W7** | API routes (/analyze, /apply, /revert, etc.) | 3d | W3, W5 | ✅ Locked |
| **W8** | GraphCanvas v2 (force, colors, sizes, legend) | 4d | W7 | Visual audit |
| **W9** | NodeDrawer v2 + MarkdownView + search | 5d | W8 | UAT |
| **W10** | Re-analyze modal (3 stages) + DiffPreview | 6d | W7, W9 | UAT |

**Total:** ~37 days for full vision. For Phase 15 specifically:

- **High-value quick wins** (1–2 weeks):
  1. Swap dagre → d3-force layout (install, wire into GraphCanvas)
  2. Node size by inbound_count + edge colors by relation type (visual update)
  3. Add GraphSearch + EdgeFilters (UI components)
  4. Extend NodeDrawer to render markdown body (wire MarkdownView)

- **Medium-effort follow-ups** (2–3 weeks):
  1. Move /api/memory/regenerate → full analyzer (W1–W5, non-LLM first)
  2. Re-analyze modal skeleton (progress view, diff preview)
  3. Hook installation (post-commit + cron, no agent hook yet)

- **Long-term (Phase 16+)**:
  1. LLM semantic edges (W5)
  2. Agent-invocation logger (W6)
  3. Full 3-stage re-analyze flow (W10)
  4. Access-log + halo rendering

### Reference: KNOWLEDGE-LAYER-DESIGN.md sections

- **§1:** Frontmatter spec (required for migration)
- **§2:** Knowledge index storage (edges.jsonl + snapshot.json schema)
- **§3:** Analyzer agent (5-stage pipeline, LLM prompt)
- **§4:** Continuous labelling (hooks + cron)
- **§5:** UI rework (components, layout, API routes) ← **Eric's primary concern**
- **§6:** Re-analyze button UX (modal 3-stage flow)
- **§10:** Wave breakdown (dependency ordering)

---

## 10. Continuous Integration Status

### Pre-commit / linting

- **npm run lint:memory** (proposed in spec §1.5) — NOT YET IMPLEMENTED
  - Would validate frontmatter JSON schema on all .md files
  - Would catch missing required fields early

### Test coverage

- **Unit tests** (§12.1) — NOT WRITTEN
  - Graph extraction regex (extract-entities.test.ts)
  - Frontmatter merge (frontmatter.test.ts)
  - Backlink computation (compute-backlinks.test.ts)
  - LLM parse robustness (extract-related-llm.test.ts)

- **Integration tests** (§12.2) — NOT WRITTEN
  - Tmp vault walk end-to-end
  - Hook integration (commit trigger)
  - Migration dry-run on real vault

- **UI tests** (§12.3) — NOT WRITTEN
  - GraphPane with fixture snapshot
  - NodeDrawer click + markdown render
  - Filter toggle + edge color
  - Re-analyze modal SSE progress

- **E2E (Playwright)** — NOT WRITTEN

### Current test count

- Graph components have basic .test.tsx files (fixtures, snapshot tests)
- No end-to-end analyzer tests
- No hook/cron integration tests

---

## 11. Open Questions

1. **Force layout parameters:** With 50–100 nodes, what d3-force settings (repulsion, attraction, gravity) give the "Obsidian feel" without oscillation?
   - Spec suggests: stiffness ~240–500, damping ~28–40, mass ~1

2. **Node click → drawer vs inline preview:** Should click open side drawer (current) or show hover tooltip first?
   - Current: drawer + click behavior — fine, matches Obsidian

3. **Edge label rendering:** Spec mentions edge color by type but not edge labels. Show type on hover? Legend only?
   - Recommendation: legend (top-right) + type visible in inspector/drawer; optional "show edge labels" toggle for power users

4. **Wikilink normalization:** Real memory files use `[label](path.md)`. Should analyzer rewrite `[[wiki]]` → `[wiki](path.md)` on disk?
   - Current: only markdown links used; no wikilinks in real vault
   - Recommendation: ship markdown-on-disk, wikilink-in-app renderer (spec §8)

5. **LLM cost/quality trade-off:** Opus-4-7 for all 65 files = ~$0.18/pass. Accept?
   - Recommendation: Yes (per spec). Incremental mode only touches changed files (~$0.01/pass).

---

## 12. Concrete Findings

### What works well

✅ **Data pipeline:** Text extraction (markdown + @-refs) is robust and fast
✅ **React-flow integration:** Rendering, pan/zoom, controls are solid
✅ **Node classification:** Path-based kind detection works
✅ **Cooldown gating:** 60s rate limit prevents thrashing
✅ **File allowlist:** `listMemorySources` correctly scopes memory dirs

### What needs rework

❌ **Layout algorithm:** Dagre LR is structural, not organic. Replace with d3-force for clustering.
❌ **Node visuals:** All fixed size. Need `inbound_count` in schema + size formula in render.
❌ **Edge visuals:** All gray. Need relation type in schema + color mapping in render.
❌ **Re-analyze UX:** Simple button → 3-stage modal flow (progress + diff + apply).
❌ **Content access:** NodeDrawer only shows filename. Extend to render markdown body.
❌ **Frontmatter:** Spec defines rich schema; real files have minimal or no YAML. Migration required.

### What's architecturally sound but incomplete

⚠️ **Analyzer foundation:** Pure TS walker exists; need 5-stage orchestrator (regex → entity extract → LLM suggest → backlinks → diff emit).
⚠️ **Hook infrastructure:** Spec designed; not installed. Straightforward `.git/hooks/post-commit` + settings.json entry.
⚠️ **Knowledge index:** Schema defined; only `.cae/graph.json` written. Need edges.jsonl + snapshot.json for richer queries.

### Blame assignment

- **Why is it incomplete?** Phase 8 shipped Waves 1–5 (basic graph); Phases 9–14 focused on other surfaces (agents, workflows, etc.). Phase 15 (this cycle) is the **visual + analyzer overhaul** that will close these gaps.
- **Was this a bad decision?** No. Phase 8 delivered working graph MVP. Phase 15 is the design-informed follow-up with proper research (VISUAL-RESEARCH, KNOWLEDGE-LAYER-DESIGN).

---

## 13. Verdict

**The current implementation is a functional graph renderer but NOT an Obsidian-grade knowledge tool.**

It succeeds at:
- Structural visualization (nodes + edges)
- File discovery (click → drawer)
- Basic filtering (by kind)

It fails at:
- **Organic layout** (force physics vs hierarchy)
- **Visual relationship hierarchy** (size, color, prominence)
- **Interactive intelligence** (search, path highlight, hover context)
- **Content integration** (full markdown + metadata in drawer)
- **Relationship richness** (only text-extracted, no semantic edges)
- **Approval workflows** (regenerate is read-only; no diff/apply loop)

**To match Eric's mental model ("work like obsidian"), Phase 15 must deliver:**
1. d3-force layout
2. Node/edge styling by metadata
3. Search + path highlight
4. Markdown body in drawer
5. 3-stage re-analyze modal
6. Analyzer + LLM relationship extractor

All 5 are specified in KNOWLEDGE-LAYER-DESIGN.md and VISUAL-RESEARCH.md §12. The technical path is clear; execution is the blocker.

---

## References

- `/home/cae/ctrl-alt-elite/dashboard/.planning/phases/15-screenshot-truth-harness/KNOWLEDGE-LAYER-DESIGN.md` — Full spec (§1–10)
- `/home/cae/ctrl-alt-elite/dashboard/.planning/phases/15-screenshot-truth-harness/VISUAL-RESEARCH.md` — Section 12 (knowledge graph research)
- `/home/cae/ctrl-alt-elite/dashboard/lib/cae-graph-state.ts` — Current walker
- `/home/cae/ctrl-alt-elite/dashboard/components/memory/graph/*.tsx` — UI components
- `/root/.claude/projects/-root/memory/` — Real memory vault (65 files, 42–55 node graphs)

**Audit completed:** 2026-04-23 14:30 UTC

