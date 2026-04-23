# Knowledge Layer Design — Tracks B + C (Phase 15)

**Status:** Design only. No code change.
**Owner:** Eric (CAE dashboard).
**Date:** 2026-04-23.
**Closes:** OVERHAUL-PLAN.md Track B (knowledge layer) + Track C (continuous labelling) + visualization spec E8.

---

## 0. Mandate (verbatim)

> "knowledge graphs DO NOT work the way I wanted them to. they should work like knowledge graphs in obsidian or the visuals like in graphify. also the .md files inside memory I think could be easier to read in an obsidian like structuring or format, I would like some sort of agent that autoreformats/organizes/examines and relinks the knowledge graphs together. finding connects etc. Where I could just press a button inside the memory and it relinks/organizes/strutures, after doing like a full analysis so that the links between actions, files, agents, knowledge, memory are constantly being labelled, organized, and structure, and establish."

### Locked design defaults

| # | Decision | Why |
|---|---------|-----|
| 1 | In-app primary; OSS libs (gray-matter, react-markdown, dagre, chokidar) used as helpers | "no half-assed fixes"; keep ownership in the dashboard, vend OSS for solved problems |
| 2 | Markdown link syntax on disk (`[label](path.md)`); rendered as Obsidian-style wikilinks in app | Obsidian/Logseq/grep-friendly on disk; in-app affordance is purely a renderer concern |
| 3 | Trigger model = **manual button + post-commit hook + 15-min cron**, not real-time-on-keystroke | Avoids Eric editing a file mid-thought and having an analyzer rewrite under him |
| 4 | LLM = **opus-4-7** for relationship extraction, called via Eric's Anthropic account; local-tier privacy only | No third-party telemetry, no other vendors |
| 5 | Action graph initial scope = **commits + agent invocations only** | Ship-able v1; expand later to PRs/skills/workflows |
| 6 | Analyzer surfaces **suggestions** with **one-click apply**, not auto-write | Eric stays in the loop; revert is one click |

### Scope boundary (v1)

**In:** Memory `.md` files (root + project + dashboard memory dirs), commits, agent invocations.

**Out (deferred to v2):** PRs, code symbols (tree-sitter), workflow YAML graph, skills dependency tree, multi-repo cross-link.

---

## 1. Memory file format spec

### 1.1 Frontmatter schema

YAML frontmatter at the top of every memory `.md`. Required fields are written by the analyzer if missing; optional fields are user-authored or analyzer-suggested.

#### Required

| Field | Type | Notes |
|------|------|-------|
| `name` | string | Snake-case identifier; matches filename without `.md` |
| `description` | string | One-line summary, ≤ 140 chars; surfaced in MEMORY.md index |
| `type` | enum | One of: `project`, `feedback`, `bug`, `user`, `decision`, `handoff`, `reference` |
| `created_at` | ISO8601 date | Filled by analyzer on first pass if missing (uses `git log --diff-filter=A`) |
| `updated_at` | ISO8601 date | Re-stamped on every analyzer pass that touches the file |

#### Optional

| Field | Type | Notes |
|------|------|-------|
| `tags` | string[] | Free-form labels (e.g. `["recon","intel","backend"]`); user or analyzer-suggested |
| `aliases` | string[] | Alternate names the file is known by; resolves wikilinks like `[[Recon System]]` |
| `related` | string[] | Manually curated `path/file.md` refs the user vouches for; analyzer **proposes**, user accepts |
| `mentions_files` | string[] | **Auto-extracted**: absolute or repo-relative file paths mentioned in body (regex). Never user-edited |
| `mentions_agents` | string[] | **Auto-extracted**: agent identifiers (`gsd-*`, `hermes`, `herald`, `claude`, `shift`, `timmy`) |
| `mentions_phases` | string[] | **Auto-extracted**: `Phase NN` / `phase-NN-*` references |
| `mentions_commits` | string[] | **Auto-extracted**: 7-40 hex char SHAs |
| `last_reanalyzed_at` | ISO8601 | When the analyzer last ran on this file; distinct from `updated_at` (which fires on any edit) |
| `analyzer_version` | semver | Schema version of the analyzer that wrote auto-extracted fields. Migrations key off this |
| `backlinks` | bool | Default `true`. Set `false` to opt the file out of the auto-maintained `## Backlinks` section |
| `confidence_floor` | 0..1 | Filter — analyzer suggestions below this confidence are silently dropped for this file |

#### Example

```yaml
---
name: project_recon_full_state
description: RECON intelligence system — full architecture, what works, what needs fixing.
type: project
created_at: 2026-04-15
updated_at: 2026-04-23
last_reanalyzed_at: 2026-04-23T11:42:00Z
analyzer_version: 1.0.0
tags: [recon, intel, backend, fundraising]
aliases: ["RECON", "Recon System"]
related:
  - bug_recon_sigpipe_set_e.md
  - user_interests_and_goals.md
mentions_files:
  - scripts/run_recon.sh
  - .cae/recon/snapshot.json
mentions_agents: [hermes, claude]
mentions_phases: [Phase 12, Phase 14]
mentions_commits: [4239fef, a82c1d9]
backlinks: true
---
```

### 1.2 Body conventions

- **H1 reserved for human title** — analyzer never writes H1; uses `name` field for indexing.
- **H2 sections** are the unit of summarization; analyzer can use H2 anchors for fine-grained backlinks (e.g. `[other.md#Decision-2](other.md#decision-2)`).
- **Code fences** triple-backtick with language tag; analyzer skips fenced blocks during entity extraction (so example file paths inside ```` ```bash ```` blocks don't pollute `mentions_files`).
- **Link syntax on disk:** standard Markdown `[label](relative/or/absolute/path.md)`.
- **Wikilink input alternative:** users may type `[[file_name]]` or `[[file_name|display label]]`; the analyzer normalizes wikilinks → markdown links on next pass (resolving via `name` or `aliases`).
- **Inline code identifiers:** wrap in backticks. Analyzer treats `` `regex` `` as a code identifier candidate, not a file mention.

### 1.3 Bottom auto-section: Backlinks

Every file (unless `backlinks: false`) gets a Backlinks section maintained between fenced markers. The analyzer is the **only writer** within these markers; everything else is preserved verbatim.

```markdown
<!-- BACKLINKS:start -->
## Backlinks

- [project_cae_dashboard_session5.md](project_cae_dashboard_session5.md) — "RECON intel pulled into Phase 9 onboarding…"
- [feedback_be_critical.md](feedback_be_critical.md) — "RECON output should not be sycophantic…"
<!-- BACKLINKS:end -->
```

Rules:
- Markers are HTML comments → invisible in rendered Markdown but trivial to parse.
- Snippet is ≤10 words from the linking file's nearest sentence to the link.
- Backlinks list is sorted by `inbound recency desc` (most recently linking file first).
- Section is appended **once** if missing; never duplicated. If a user manually wrote a `## Backlinks` heading without markers, the analyzer logs a warning and skips (does not clobber).

### 1.4 Migration path (existing 30+ files in `/root/.claude/projects/-root/memory/` and project dirs)

Six-step, non-destructive:

1. **Inventory pass.** Walk every `.md` under: `/root/.claude/projects/-root/memory/`, `dashboard/.cae/memory/` (if exists), `dashboard/.planning/phases/*/HANDOFF.md`, `~/.claude/CLAUDE.md`, project `CLAUDE.md`. Output `migration-plan.json` listing each file × current-frontmatter-keys × diff-vs-required.
2. **Backup.** `cp -r` of each source dir to `.cae/knowledge/snapshots/pre-migration-<ts>/`. Preserves rollback.
3. **Frontmatter merge (dry-run first).** For each file:
   - If no frontmatter → prepend a frontmatter block with required fields filled (heuristic: `type` from filename prefix `bug_*` / `feedback_*` / `project_*` / `user_*`; `description` = first H1 or first sentence ≤140 chars; `created_at` from `git log --diff-filter=A --follow`).
   - If frontmatter exists → merge new keys, never overwrite user values.
4. **Auto-extracted fields.** Run the entity extractor (§3.3) and populate `mentions_*`. These are mechanically regenerable; no human review needed.
5. **Backlinks bootstrap.** Compute global backlink graph, write the `<!-- BACKLINKS:start -->...end -->` section into every file with `backlinks ≠ false`.
6. **LLM `related` suggestions** (Step 5 of analyzer). Output to `proposed-changes.json`. Eric reviews in the in-app diff modal and bulk-accepts.

Migration is idempotent: re-running yields a no-op diff if nothing changed upstream.

### 1.5 JSON Schema for frontmatter validation

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://cae.local/schema/memory-frontmatter-v1.json",
  "title": "CAE Memory Frontmatter v1",
  "type": "object",
  "required": ["name", "description", "type", "created_at", "updated_at"],
  "additionalProperties": false,
  "properties": {
    "name":           { "type": "string", "pattern": "^[a-z0-9_]+$" },
    "description":    { "type": "string", "maxLength": 140 },
    "type":           { "enum": ["project","feedback","bug","user","decision","handoff","reference"] },
    "created_at":     { "type": "string", "format": "date-time" },
    "updated_at":     { "type": "string", "format": "date-time" },
    "last_reanalyzed_at": { "type": "string", "format": "date-time" },
    "analyzer_version":   { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
    "tags":           { "type": "array", "items": { "type": "string" }, "uniqueItems": true },
    "aliases":        { "type": "array", "items": { "type": "string" }, "uniqueItems": true },
    "related":        { "type": "array", "items": { "type": "string", "pattern": "\\.md$" }, "uniqueItems": true },
    "mentions_files": { "type": "array", "items": { "type": "string" }, "uniqueItems": true },
    "mentions_agents":{ "type": "array", "items": { "type": "string" }, "uniqueItems": true },
    "mentions_phases":{ "type": "array", "items": { "type": "string", "pattern": "^[Pp]hase[ -]?\\d+" }, "uniqueItems": true },
    "mentions_commits":{ "type": "array", "items": { "type": "string", "pattern": "^[0-9a-f]{7,40}$" }, "uniqueItems": true },
    "backlinks":      { "type": "boolean", "default": true },
    "confidence_floor": { "type": "number", "minimum": 0, "maximum": 1 }
  }
}
```

Validation runs in two places: analyzer pre-write (refuses to commit invalid frontmatter), and an `npm run lint:memory` script for CI.

---

## 2. Knowledge index storage

Two on-disk artifacts under `dashboard/.cae/knowledge/`:

```
.cae/knowledge/
├── edges.jsonl              # append-only event log of every extracted edge
├── snapshot.json            # materialized view; deterministic rebuild from edges.jsonl
├── proposed-changes.json    # uncommitted diff awaiting Eric's review
├── snapshots/
│   ├── pre-migration-<ts>/  # full source backup before migration
│   └── pre-apply-<ts>/      # backup before each analyzer apply (revertable)
├── agent-invocations.jsonl  # PostToolUse hook output
├── commits.jsonl            # post-commit hook output
└── logs/
    └── analyzer-<date>.log  # one line per analyzer phase, durations, file counts
```

### 2.1 `edges.jsonl` schema (append-only)

One JSON object per line:

```json
{
  "id": "e_01HXYZ...",                    // ULID; stable for dedup
  "from_file": "/abs/path/to/source.md",  // memory file or commit SHA or agent id
  "to_file":   "/abs/path/to/target.md",  // memory file
  "edge_type": "mentions",                // see §2.2
  "confidence": 0.92,                     // 0..1; 1.0 for regex-extracted, LLM emits its own score
  "extracted_at": "2026-04-23T11:42:00Z",
  "source": "auto",                       // "auto" | "manual" | "llm"
  "context": "RECON intel pulled into Phase 9 onboarding flow",  // ≤ 10 words from source
  "extractor_version": "1.0.0",           // analyzer build that produced the edge
  "supersedes": null                      // optional id of an edge this overrides (e.g. retract)
}
```

Append-only is critical: every analyzer pass writes new lines; deduplication happens at snapshot-build time. Retraction = append a tombstone with `supersedes: <old_id>` and `confidence: 0`.

### 2.2 Edge types

| Edge type | Source side | Target side | Producer |
|----------|------------|-------------|----------|
| `mentions` | memory file | memory file | regex (`mentions_files` resolution) |
| `related` | memory file | memory file | LLM (semantic similarity) |
| `derived_from` | memory file | memory file | LLM (one file references the other as authoritative source) |
| `supersedes` | memory file | memory file | LLM or manual (e.g. session9 supersedes session8) |
| `mentioned_by_action` | commit SHA | memory file | post-commit hook (commit changed files referenced in memory) |
| `worked_on_by` | agent id | memory file | PostToolUse hook (agent's task touched the file) |
| `part_of_phase` | memory file | phase id | regex (`mentions_phases`) |
| `alias_of` | wikilink token | memory file | analyzer (wikilink normalization trail) |

Edge type → color mapping is locked in §5 (UI legend).

### 2.3 `snapshot.json` (materialized view)

Regenerated from `edges.jsonl` end-to-end on every analyzer pass; never hand-edited. Schema:

```json
{
  "schema_version": "1.0.0",
  "generated_at": "2026-04-23T11:42:00Z",
  "stats": {
    "node_count": 87,
    "edge_count": 412,
    "edge_type_counts": { "mentions": 215, "related": 98, "supersedes": 12, ... },
    "orphan_count": 3
  },
  "nodes": [
    {
      "id": "/abs/path/file.md",
      "label": "project_recon_full_state",
      "kind": "memory",
      "type": "project",
      "centrality": 0.41,        // PageRank-style; precomputed
      "inbound_count": 7,
      "outbound_count": 4,
      "recency_score": 0.88,     // exp decay, halflife 14d, on updated_at
      "last_accessed_at": "2026-04-23T10:11:00Z",  // from access-log.jsonl
      "tags": ["recon","intel"]
    }
  ],
  "edges": [
    {
      "from": "...", "to": "...", "type": "mentions",
      "weight": 0.92,            // max confidence across edge instances
      "first_seen": "...", "last_seen": "..."
    }
  ]
}
```

Snapshot is the single source of truth for the graph UI. Only the analyzer writes it (atomic rename pattern: write to `.tmp` → rename).

### 2.4 Incremental update strategy

When a single file changes:

1. Read file, re-extract entities (§3.3).
2. Compute its **new outbound edges** (mentions + LLM-related for that file only).
3. Append all new edges with current ts.
4. Append tombstones for prior edges from this file that no longer hold.
5. Re-run snapshot rebuild **only over the affected subgraph** (file + its 1-hop neighbors). Snapshot has a `dirty_nodes: [...]` field carried into the next full rebuild; a full rebuild runs on the 15-min cron regardless.

Rebuild perf budget: ≤ 2s on 200 files / 1000 edges (it's all in-memory map-reduce).

### 2.5 File watching

Watcher (`chokidar`) sits in the analyzer daemon (when running) on memory dirs. On change:
- Debounce 5s (avoid thrashing during a save burst).
- Enqueue file path.
- Process queue with concurrency = 1 (no race on `edges.jsonl` writes).
- File-watcher mode is **opt-in** via a checkbox in /memory; default off — Eric explicitly chose button + cron + post-commit, not real-time.

---

## 3. Memory Analyzer Agent

### 3.1 Location & shape

```
dashboard/scripts/memory-analyzer.ts        # CLI entrypoint
dashboard/lib/memory/analyzer/
  ├── index.ts                              # orchestrator
  ├── frontmatter.ts                        # gray-matter wrapper + schema validate
  ├── extract-entities.ts                   # regex extraction
  ├── extract-related-llm.ts                # opus-4-7 prompt + parse
  ├── compute-backlinks.ts                  # global join over edges
  ├── diff.ts                               # produce proposed-changes.json
  ├── apply.ts                              # write files + edges + snapshot
  ├── snapshot-build.ts                     # materialize snapshot.json
  └── types.ts
```

CLI (Node, runs under existing dashboard `tsx`):

```bash
node scripts/memory-analyzer.ts <subcommand> [flags]

# subcommands
all                    # process every memory file
incremental            # process files changed in last <window> (default 15m)
file <path>            # single file
commit <sha>           # process files referenced by a commit (post-commit hook)
agent <invocation_id>  # process files an agent touched
preview                # write proposed-changes.json without applying
apply                  # apply proposed-changes.json after review
revert <snapshot_dir>  # roll back to a pre-apply snapshot

# flags
--dry-run              # never write files; emit diff to stdout
--no-llm               # skip the LLM step (regex + backlinks only)
--confidence-floor N   # drop edges below N confidence
--root <path>          # override CAE_ROOT (test isolation)
--json                 # machine-readable output (for the UI to render progress)
```

The same module exposes a programmatic API consumed by the in-app `/api/memory/analyze` route (which the Re-analyze button calls).

### 3.2 Pipeline (5 stages)

For each file in scope:

1. **Read & parse** — `gray-matter` splits frontmatter + body.
2. **Extract entities** — pure regex, no LLM (§3.3).
3. **LLM relationship suggest** — opus-4-7 with carefully scoped prompt (§3.4).
4. **Compute backlinks** — global join on edges → list of inbound files with snippets.
5. **Diff & emit** — proposed frontmatter merge, proposed Backlinks section, edge appends → `proposed-changes.json`.

Stages 1-2-4 run for every file in scope on every pass. Stage 3 (LLM) is skipped on incremental passes if neither the file body nor any neighbor has changed since `last_reanalyzed_at` (cache key = sha256 of body + neighbor labels).

### 3.3 Entity extraction (regex specs)

```ts
const PATTERNS = {
  filePath:   /(?:[\w./-]*\/)?[\w.-]+\.(?:md|ts|tsx|js|jsx|sh|json|yml|yaml|py)\b/g,
  agentName:  /\b(gsd-[a-z-]+|hermes|herald|claude|shift|timmy)\b/g,
  phaseId:    /\b[Pp]hase[ -]?\d{1,3}\b|phase-\d{1,3}-[a-z-]+/g,
  commitSha:  /\b[0-9a-f]{7,40}\b/g,
  url:        /https?:\/\/[^\s)]+/g,
  wikilink:   /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
  mdLink:     /\[([^\]]+)\]\(([^)]+)\)/g,
};
```

Hygiene rules:
- Strip fenced code blocks before extraction.
- File-path matches resolve against the repo root and CAE_ROOT; un-resolvable paths are kept as raw strings but flagged `resolved: false`.
- Commit SHAs are validated against `git cat-file -e <sha>` if the repo is available; invalid → discarded.
- Wikilinks are resolved via `name` or `aliases` lookup; unresolved wikilinks become a `link_unresolved` edge for surfacing in the UI as broken-link warnings.

### 3.4 LLM relationship extraction (opus-4-7)

**Privacy:** call goes through Eric's `@anthropic-ai/sdk` client using his ANTHROPIC_API_KEY. No content leaves his account. No telemetry vendor. Logged to `.cae/knowledge/logs/`.

**Prompt template** (system + user):

```
SYSTEM:
You are a knowledge graph relationship extractor for an Obsidian-style
memory vault. You analyze ONE source file and a directory of all other
memory titles + descriptions. You return ONLY relationships that a careful
reader would defend, never speculative ones.

Output STRICT JSON, no prose, matching schema:
{ "related": [
    { "path": "<other-file.md>",
      "relationship": "related" | "derived_from" | "supersedes",
      "confidence": 0.0..1.0,
      "reason": "<one sentence, ≤120 chars>" }
] }

Rules:
- Only emit edges with confidence ≥ 0.6.
- Never emit self-edges.
- Never emit an edge already present in the existing `related` field.
- Prefer "supersedes" only if source explicitly invalidates target (e.g. "replaces", "supersedes", "subsumed by", "deprecates").
- "derived_from" = source builds directly on target's findings.
- "related" = same topic / shared entities, neither derives nor supersedes.

USER:
SOURCE FILE: <path>
SOURCE FRONTMATTER: <yaml>
SOURCE BODY (first 4000 chars): <body>
SOURCE EXTRACTED ENTITIES: <mentions_files / agents / phases JSON>

OTHER FILES IN VAULT (name, description):
  - bug_recon_sigpipe_set_e: RECON lightweight modes died silently from SIGPIPE under set -e pipefail
  - project_recon_full_state: RECON intelligence system — full architecture
  - ... (truncated to 200 entries; vault is small)
```

**Token budget:** with 87 files and ≤140-char descriptions, the catalog fits in ~6k input tokens. Source body capped at 4k tokens. Output ≤ 1k tokens. ≈ 11k tokens per file. At 87 files × $15/Mtok input, $75/Mtok output (Opus pricing): ~$0.18 per full-vault pass; incremental passes touch <5 files, ~$0.01.

**Prompt caching:** the catalog (other-file titles+descriptions) is identical across all 87 calls in one pass. Use `cache_control: ephemeral` on that block; saves ~80% input cost on full passes.

**Robustness:** parse output with a schema validator; on parse failure retry once with "Your last response was not valid JSON; output ONLY the JSON object." On second failure log + skip that file.

### 3.5 Backlinks computation

After all files have stage-2 edges materialized in `edges.jsonl`:

1. Group edges by `to_file`.
2. For each target, build the Backlinks section: list of (`from_file`, `context_snippet`, `last_seen`).
3. `context_snippet` = nearest sentence in the source file that contains the link, truncated to 10 words.
4. Sort by `last_seen desc`; cap at 50 entries (configurable per-file via frontmatter `backlinks_limit`).

### 3.6 Diff emission (`proposed-changes.json`)

Schema:

```json
{
  "generated_at": "2026-04-23T11:42:00Z",
  "analyzer_version": "1.0.0",
  "files": [
    {
      "path": "/abs/path/file.md",
      "frontmatter_diff": {
        "added":   { "tags": ["intel"], "related": ["other.md"] },
        "removed": {},
        "changed": { "updated_at": ["2026-04-22","2026-04-23"] }
      },
      "backlinks_diff": {
        "before": ["a.md","b.md"],
        "after":  ["a.md","b.md","c.md"],
        "added_snippets": [{ "from": "c.md", "snippet": "..." }]
      },
      "body_unchanged": true
    }
  ],
  "edges_to_append": [ /* edge objects */ ],
  "edges_to_tombstone": [ /* edge ids */ ],
  "stats": { "files_changed": 12, "edges_added": 47, "edges_removed": 3 }
}
```

This is the **only** thing the UI reads in the preview modal. Apply takes this exact file as input.

### 3.7 Apply

1. Snapshot all files-to-change to `.cae/knowledge/snapshots/pre-apply-<ts>/`.
2. For each file: rewrite frontmatter (preserve key order on unchanged keys; insert new keys after required block) → rewrite Backlinks section between markers → write atomically (`.tmp` rename).
3. Append `edges_to_append` and tombstones to `edges.jsonl`.
4. Rebuild `snapshot.json` end-to-end.
5. Write apply receipt to `.cae/knowledge/logs/apply-<ts>.log`.

Failure mode: any file write fails → abort, restore from pre-apply snapshot, log + surface error in UI toast. Half-applied state is impossible.

### 3.8 Safety properties

- Frontmatter merge is **non-destructive**: never deletes user-authored keys (`tags`, `aliases`, `related` user-vouched entries are preserved; analyzer-suggested `related` entries live in a separate proposed list until Eric accepts).
- Body content outside the BACKLINKS markers is **never touched**.
- Code-fenced blocks are **invisible** to the extractor.
- Every apply is **revertable** in one click.

---

## 4. Continuous labelling pipeline

Three independent producers feed `edges.jsonl`:

### 4.1 Post-commit hook

Path: `.git/hooks/post-commit` (installed by `scripts/install-knowledge-hooks.sh`).

```bash
#!/usr/bin/env bash
set -euo pipefail
node "$REPO_ROOT/scripts/memory-analyzer.ts" commit HEAD --json \
  >> "$REPO_ROOT/dashboard/.cae/knowledge/logs/post-commit.log" 2>&1 || true
```

What `commit HEAD` does:
1. `git show --name-only HEAD` → list of files changed.
2. Append a node-equivalent record to `commits.jsonl`: `{sha, author, ts, subject, files_changed[]}`.
3. For each memory file with `mentions_files` overlapping the commit's files: append a `mentioned_by_action` edge from `<sha>` → `<memory_file>`.
4. If the commit body contains explicit memory-file references (e.g. "closes project_recon_full_state.md"), append edges for those too.
5. Output a one-line summary to stderr (visible in `git commit` console).

Hook is idempotent (re-running for same SHA is a no-op via dedup on edge id derivation: `sha:from:to:type`).

### 4.2 Agent invocation logger

Hook: `PostToolUse` matcher on `Agent` tool, configured in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Agent|TaskCreate",
        "hooks": [
          {
            "type": "command",
            "command": "node /home/cae/ctrl-alt-elite/dashboard/scripts/agent-invocation-logger.ts"
          }
        ]
      }
    ]
  }
}
```

Logger reads tool call payload from stdin (per Claude Code hook protocol), writes one line to `.cae/knowledge/agent-invocations.jsonl`:

```json
{
  "id": "ai_01HXYZ...",
  "ts": "2026-04-23T11:42:00Z",
  "agent": "gsd-plan-phase",
  "subagent_type": "explore",
  "task_id": "task_abc123",
  "session_id": "sess_xyz",
  "files_read":  ["/abs/path/a.md","/abs/path/b.md"],     // gathered from same task's Read tool calls
  "files_wrote": ["/abs/path/c.md"],                       // from Write/Edit tool calls
  "duration_ms": 47000,
  "tokens": { "input": 12000, "output": 4200 }
}
```

Important nuance: the `Agent` PostToolUse fires once when the subagent **completes**, but the read/write tool calls happen inside the subagent's transcript. Two implementation options:

- **Option A (preferred):** also wire `PostToolUse` for `Read|Write|Edit`, log to a same-session per-task buffer keyed by `task_id`. When the `Agent` PostToolUse fires, drain the buffer and consolidate.
- **Option B (fallback):** parse the subagent's transcript file at consolidation time. More fragile.

Once consolidated, the analyzer's `agent <invocation_id>` mode reads this JSON and emits `worked_on_by` edges from `<agent_id>` → `<memory_file>` for every file the agent read or wrote.

### 4.3 15-minute cron

Existing scheduler: `scripts/cae-scheduler-watcher.sh` already runs every 15m. Add a new entry to its task table:

```yaml
- name: knowledge-incremental
  schedule: "*/15 * * * *"
  command: node /home/cae/ctrl-alt-elite/dashboard/scripts/memory-analyzer.ts incremental --json
  log: .cae/knowledge/logs/cron-incremental.log
  timeout: 120s
```

`incremental` mode:
- Diffs file mtimes against `last_reanalyzed_at` in their frontmatter.
- Selects files mtime > last_reanalyzed.
- Runs full pipeline on each.
- Auto-applies stage-2 edges (regex) and Backlinks (deterministic, no LLM ambiguity).
- Stage-3 LLM `related` suggestions are written to `proposed-changes.json` only — Eric still gates apply via the in-app button.

This split is intentional: deterministic edges (mentions, backlinks) flow continuously; semantic edges (related, derived_from, supersedes) need human gate.

### 4.4 Scheduler dependency ordering

```
chokidar (opt-in)  ─┐
post-commit hook   ─┼──► edges.jsonl ──► snapshot.json ──► /api/memory/snapshot ──► UI
agent hook         ─┤        ▲
15m cron           ─┘        │
                     LLM proposed-changes.json ──► UI diff modal ──► Eric apply ──► back into edges.jsonl
```

---

## 5. /memory tab UI rework

### 5.1 Current state

| Component | Path | Current behavior |
|----------|------|------------------|
| `GraphPane` | `components/memory/graph/graph-pane.tsx` | Fetches `/api/memory/graph`, renders filters + canvas + drawer |
| `GraphCanvas` | `components/memory/graph/graph-canvas.tsx` | xyflow with dagre LR layout, 4-kind border colors, click-to-drawer |
| `GraphFilters` | `components/memory/graph/graph-filters.tsx` | 4 chips: phases / agents / notes / PRDs |
| `RegenerateButton` | `components/memory/graph/regenerate-button.tsx` | Calls graph regeneration with 60s cooldown |
| `NodeDrawer` | `components/memory/graph/node-drawer.tsx` | Side panel with backlinks/forward-refs lists, "open git timeline" |
| `layout-dagre.ts` | same dir | Pure layout |

### 5.2 New requirements (E8 spec made concrete)

1. **Force-directed layout** with dagre as the structural fallback. Nodes settle via d3-force-style physics (use xyflow's built-in `useNodesState` + a force layout pass via `d3-force` to compute initial positions; allow user to grab and re-pin nodes).
2. **Edge color by type** with a legend. Type → color (CSS vars):
   - `mentions` → `var(--border-strong)` (default neutral)
   - `related` → `var(--accent)` (cyan)
   - `derived_from` → `var(--success)` (green)
   - `supersedes` → `var(--warning)` (amber, dashed)
   - `mentioned_by_action` → `var(--info)` (blue)
   - `worked_on_by` → `var(--accent-muted)` (faint cyan)
   - `part_of_phase` → purple token (new: `var(--phase)`)
3. **Node size by inbound link count** — radius = `clamp(8, 8 + log2(inbound + 1) * 6, 28)` px.
4. **Halo on recently accessed nodes** — read `.cae/sessions/access-log.jsonl` (rolling 24h window). Halo = pulsing 2px ring in `var(--accent)`, `motion-reduce:animate-none`.
5. **Click → side panel** (extends existing NodeDrawer):
   - File content rendered as Markdown (react-markdown + remark-gfm).
   - Frontmatter rendered as a tag row + metadata strip (created/updated/last-reanalyzed).
   - Backlinks list (existing, but now the analyzer's snippets).
   - Forward-refs list.
   - Suggested-related list (LLM proposals not yet applied) with Accept/Reject buttons inline.
   - "Open in editor" button — calls `/api/editor/open` (new route; uses `code -g <path>` or `xdg-open`).
6. **Search box** — fuzzy over node labels + descriptions. Matches highlighted (node halo in `var(--warning)`). Bonus: when 2+ nodes are matched, compute & highlight the shortest path between them (BFS over the snapshot edges).
7. **Re-analyze button** — see §6.
8. **Edge filter pills** — toggle visibility per edge type. Persists in URL query (`?edges=mentions,related`).
9. **Node filter pills** — type (project/feedback/bug/...), age (last day / week / month / older), recency (accessed in last 24h).
10. **Mini-map** — bottom-right; xyflow's `<MiniMap />` component, color-coded by node `type`.
11. **Loading state** — skeleton graph (placeholder nodes shimmering); already partially in place for the loading branch.
12. **Empty state** — "No memory yet — create your first note in `.cae/memory/` or run `cae memory new <name>`."

### 5.3 Component change list

| Component | Status | Change |
|----------|--------|--------|
| `GraphPane` | modify | Replace `payload.nodes/links` with snapshot.nodes/edges; add edge-filter state; pipe to canvas; add search input; mount Re-analyze modal |
| `GraphCanvas` | major rewrite | Use snapshot edge types; force layout via d3-force on first mount, dagre fallback; node size by `inbound_count`; halo overlay; mini-map; edge color by type |
| `GraphFilters` | rename → `NodeFilters` | Add type/age/recency facets; old 4-kind chips become a `type` facet |
| **NEW** `EdgeFilters` | new file | Pill row for each edge type with count |
| **NEW** `GraphSearch` | new file | Fuzzy search input + highlight-paths logic |
| **NEW** `GraphLegend` | new file | Color-coded edge-type legend |
| **NEW** `ReanalyzeButton` | new file | Triggers `/api/memory/analyze`; opens `ReanalyzeModal` |
| **NEW** `ReanalyzeModal` | new file | Stages: progress → diff preview → apply/revert (§6) |
| **NEW** `DiffPreview` | new file | Renders `proposed-changes.json` as side-by-side panes |
| `NodeDrawer` | major extend | Render Markdown body (react-markdown), suggested-related accept/reject, "Open in editor" button |
| **NEW** `MarkdownView` | new file in `components/ui/` | Shared renderer with wikilink resolution + hover preview |
| **NEW** `WikilinkTooltip` | new file | Hover-card preview of linked file's frontmatter description |
| `layout-dagre.ts` | extend | Add `applyForceLayout(nodes, edges)` companion |
| `RegenerateButton` | unchanged | Still regenerates structural graph; analyzer is separate |
| **NEW** API: `/api/memory/snapshot` | new route | Reads `.cae/knowledge/snapshot.json` |
| **NEW** API: `/api/memory/analyze` | new route | POST → spawns analyzer in preview mode; SSE progress stream |
| **NEW** API: `/api/memory/apply` | new route | POST → reads `proposed-changes.json`, applies, returns receipt |
| **NEW** API: `/api/memory/revert` | new route | POST snapshot dir → restores |
| **NEW** API: `/api/editor/open` | new route | Spawns editor; locked to allowed roots |

---

## 6. Re-analyze button UX

### 6.1 Placement

Top-right of /memory, next to existing RegenerateButton. Distinct visual: primary-accent fill (RegenerateButton is secondary).

### 6.2 Flow

```
Click ──► Modal opens
    │
    ├── Stage 1: Progress
    │     - Phase label + progress bar (0..100%)
    │     - "Reading 87 files…" → "Extracting entities…" → "Calling LLM (file 12 of 87)…" → "Computing diffs…"
    │     - Cancel button (kills the analyzer process)
    │
    ├── Stage 2: Diff preview
    │     - Header: "47 edges to add · 3 to remove · 12 files affected"
    │     - File list (left rail), default first file selected
    │     - Right pane shows that file's diff:
    │         - Frontmatter side-by-side (current vs proposed; diff highlight)
    │         - Backlinks list before/after
    │         - New edges card per relationship with reason + confidence badge
    │     - Per-suggestion toggle: ☑ accept (default) / ☐ reject
    │     - Bulk actions: "Accept all", "Reject all", "Accept high-confidence only (≥0.85)"
    │     - "Apply (n selected)" primary button; "Cancel" secondary
    │
    ├── Stage 3: Apply
    │     - Progress (file write, edges append, snapshot rebuild)
    │     - Toast on completion: "Applied 38 changes across 12 files. [Revert] [Show graph]"
    │     - Auto-closes modal; UI graph re-fetches snapshot
    │
    └── Revert path
          - Each apply records its pre-apply snapshot dir.
          - "Revert" toast button → POST /api/memory/revert with snapshot_id
          - Confirm dialog (1-click is fine, but show what gets undone)
```

### 6.3 Progress streaming

Server-Sent Events from `/api/memory/analyze` (new route). Event payloads:

```json
{ "phase": "reading",     "current": 14, "total": 87 }
{ "phase": "extracting",  "current": 14, "total": 87 }
{ "phase": "llm",         "current": 1,  "total": 87, "file": "project_recon_full_state.md" }
{ "phase": "diff",        "current": 87, "total": 87 }
{ "phase": "done",        "proposed_changes_path": ".cae/knowledge/proposed-changes.json" }
{ "phase": "error",       "message": "..." }
```

UI consumes via `EventSource`; updates progress bar + phase label live.

### 6.4 Diff rendering library

Use `diff` (jsdiff) for character-level Markdown body diffs (rare; mostly we show structural diffs). Frontmatter diffs render as a custom k/v table — clearer than text diff for small object changes.

### 6.5 Edge cases

- **Empty diff:** Stage 2 shows "Nothing to suggest. Vault is up to date." with single OK button.
- **LLM partial failure:** banner at top of Stage 2: "12 files skipped due to LLM errors — see log."
- **Concurrent analyzer run** (e.g. cron + button at once): the button-triggered run takes a file lock at `.cae/knowledge/.analyzer.lock`; if held, modal shows "Analyzer already running — view in progress" and attaches to the existing SSE stream.

---

## 7. Backlinks rendering convention

Already specified in §1.3. Repeating the contract here for clarity:

```markdown
<!-- BACKLINKS:start -->
## Backlinks

- [other_file.md](other_file.md) — context snippet (auto-generated)
- [another.md](another.md) — context snippet (auto-generated)
<!-- BACKLINKS:end -->
```

- Markers are stable HTML comments; analyzer's regex: `/<!-- BACKLINKS:start -->[\s\S]*?<!-- BACKLINKS:end -->/`.
- Replacement is full-section overwrite within markers.
- Section never appears outside markers; if user authors a `## Backlinks` heading without markers, analyzer **does not touch it** and logs a warning.
- Opt-out via frontmatter `backlinks: false` → analyzer removes the section if present (one-time) and skips on future passes.
- Snippet generation: use the source file's nearest sentence containing the link target, truncate to 10 words, ellipsize.
- Sort: most recently linked first.
- Cap: 50 by default; configurable per file via `backlinks_limit: N`.
- The renderer shows them collapsed (`<details>`) by default if count > 10.

---

## 8. Wikilink rendering in-app

### 8.1 On disk: standard Markdown links

```markdown
See [project_recon_full_state.md](project_recon_full_state.md) for details.
```

### 8.2 In app: rendered as wikilinks

The `MarkdownView` component (new) wraps `react-markdown` with custom `a` and `text` renderers:

- An `<a>` whose `href` ends in `.md` is rendered as a wikilink-style chip:
  - background `var(--surface-2)`, border `var(--border)`, no underline
  - prefix with a tiny doc icon
  - on hover: tooltip card showing the target file's `description` from frontmatter (fetched lazily via `/api/memory/file-meta?path=…`, cached)
  - on click: navigates within the graph (selects the target node + opens its drawer) instead of full page navigation
  - keyboard: `Enter` activates click; `⌘+click` opens in a new editor pane via `/api/editor/open`
- Broken wikilinks (target not in vault) render in `var(--danger)` with a tooltip "Unresolved link".

### 8.3 Wikilink input syntax (alternative)

Users typing `[[file_name]]` or `[[file_name|display label]]`:

- Renderer normalizes wikilinks at parse time to the same chip output.
- The next analyzer pass rewrites wikilinks → markdown links on disk (so on-disk format stays uniform), preserving the `display label` as the link text.
- Resolution order: exact `name` match → `aliases` match → fuzzy match (only with confidence ≥ 0.9).

### 8.4 Hover preview spec

Hover delay 250ms. Card shows:

```
project_recon_full_state.md       [type: project]
RECON intelligence system — full architecture, what works, what needs fixing.
Updated 2026-04-23  ·  7 backlinks  ·  4 outbound
[Open] [Open in editor]
```

Card uses existing `<Tooltip>` primitives in `components/ui/`.

---

## 9. Library choices (locked)

| Concern | Library | Why |
|---------|---------|-----|
| Markdown rendering | `react-markdown` + `remark-gfm` | Tables, task lists, autolinks; no custom parser |
| Frontmatter parse | `gray-matter` | De-facto standard; safe YAML parser inside |
| YAML schema validation | `ajv` + JSON Schema in §1.5 | Already in tree (TS-friendly) |
| Entity extraction | Regex only for v1 | Tree-sitter v2 only if Eric wants code-symbol edges later |
| Graph layout | `@xyflow/react` (already) + `@dagrejs/dagre` (already) + `d3-force` (new, ~50KB) | dagre = structural fallback; d3-force = the "Obsidian feel" |
| Mini-map | `<MiniMap />` from xyflow | Built-in |
| LLM client | `@anthropic-ai/sdk` (already in tree) | Native Anthropic; uses prompt caching |
| Diff rendering | `diff` (jsdiff) | Tiny; only used for body Markdown diffs |
| File watcher | `chokidar` (new) | Cross-platform; battle-tested; opt-in only |
| Cron | Existing `scripts/cae-scheduler-watcher.sh` | Just add a task entry |
| Hover tooltips | Existing `components/ui/tooltip.tsx` | No new dep |
| SSE | Native `EventSource` on client; Node `Response` streaming on server | No dep |
| Animations | Existing Framer Motion (per OVERHAUL Cycle 9 stack) | Halo pulse, modal transitions |

**Bundle delta estimate:** +d3-force (~50KB), +chokidar (server only), +gray-matter (server only), +diff (~6KB). Acceptable.

---

## 10. Migration plan (8 steps)

1. **Spec lock.** This document. Eric reads + approves.
2. **Analyzer build (CLI mode).** Implement `scripts/memory-analyzer.ts` + `lib/memory/analyzer/*`. CLI only; no UI yet. Tests + dry-run capability first-class.
3. **Dry-run on real vault.** `node scripts/memory-analyzer.ts all --dry-run --json` against `/root/.claude/projects/-root/memory/` and project memory dirs. Output written to `.cae/knowledge/dry-run-<ts>/`.
4. **Human review.** Eric reviews the dry-run report (what edges, what frontmatter merges, what backlinks). Tune prompt if quality is off.
5. **Migration apply.** Snapshot → frontmatter merge + backlinks bootstrap (deterministic, no LLM). Then apply LLM `related` suggestions in batches Eric accepts via the (CLI) preview flow (until UI ships).
6. **UI ship.** Components in §5.3, behind a `/memory` tab refactor. Old graph remains accessible until UI is verified.
7. **Hooks install.** `scripts/install-knowledge-hooks.sh` installs post-commit + PostToolUse + cron entry. Each install is idempotent and emits a verification line.
8. **Monitor 1 week.** Daily review of `.cae/knowledge/logs/` for: error rate, LLM cost, suggestion accept rate. Tune prompt + confidence floor based on real data. Decide whether to enable file-watcher mode.

---

## 11. Data privacy

**Locked guarantees:**

1. Memory file contents leave the machine **only** via the `@anthropic-ai/sdk` call to Anthropic's API, authenticated with Eric's `ANTHROPIC_API_KEY`. This is the same trust boundary as Eric's normal Claude Code usage — no expansion.
2. **No third-party telemetry.** No PostHog, Sentry, Datadog, etc. on analyzer paths. (If those exist for the dashboard generally, they MUST exclude `lib/memory/analyzer/*` and `/api/memory/*` paths.)
3. **No content in logs except**: file paths (basenames + first dir), edge metadata (types, confidence, snippet ≤10 words), token counts, durations. Logs go to `.cae/knowledge/logs/` only.
4. **No cloud-stored snapshots**: `.cae/knowledge/snapshots/` stays on disk; not synced to any cloud.
5. **API key never logged.** Analyzer reads `ANTHROPIC_API_KEY` from env, redacts on any debug dump.
6. **LLM prompt does not include**: secrets pattern-matched (regex catalog in `scripts/lint-no-dollar.sh` reused), `.env` content, anything from `.git-credentials`. A pre-flight scrub strips matches before the API call; if matches found, log at WARN and skip the file.

This must be documented in a `PRIVACY.md` shipped alongside the analyzer (one-page; references this section).

---

## 12. Test plan

### 12.1 Unit tests (analyzer)

- `extract-entities.test.ts`
  - Regex matches expected file paths / agents / phases / SHAs.
  - Code-fenced blocks excluded.
  - Wikilinks parsed (with and without `|` display label).
  - Edge cases: empty file, file with only frontmatter, file with malformed frontmatter.
- `frontmatter.test.ts`
  - Schema validation passes valid examples; rejects invalid.
  - Merge preserves user keys; never overwrites.
  - Order preservation on round-trip.
- `compute-backlinks.test.ts`
  - Snippet truncation correct.
  - Sort order correct.
  - Opt-out (`backlinks: false`) honored.
  - Existing `## Backlinks` without markers triggers warning + skip.
- `extract-related-llm.test.ts`
  - Mock @anthropic-ai/sdk; verify prompt structure, cache_control on catalog block, parse strict JSON.
  - Retry-on-malformed-JSON path covered.
  - Confidence-floor filter applied.
- `diff.test.ts`
  - Frontmatter diffs add/remove/change classified correctly.
  - Edge dedup against existing edges.
  - Tombstones generated for retracted edges.
- `apply.test.ts`
  - Atomic write (tmp+rename) under disk-full simulation.
  - Snapshot taken before write.
  - Half-failure rolls back.

### 12.2 Integration tests

- **Tmp vault test:**
  - Spin up tmp dir with N=15 seeded `.md` files (mix of types, with cross-references).
  - Run analyzer `all --no-llm` → verify `edges.jsonl` line count and contents; verify Backlinks sections inserted in all opt-in files; verify frontmatter populated.
  - Re-run analyzer → assert idempotent (no diff).
  - Edit one file's body → run `incremental` → assert only that file's edges and its backlinks-targets' Backlinks sections changed.
- **Hook integration test:**
  - Init a tmp git repo with seeded vault.
  - Install post-commit hook.
  - Make a commit touching files referenced in memory → verify `commits.jsonl` entry + `mentioned_by_action` edges.
- **Migration test:**
  - Copy real `/root/.claude/projects/-root/memory/` to tmp.
  - Run migration steps 1-5.
  - Verify: every file has required frontmatter; no body content modified outside markers; pre-migration snapshot dir present and complete.

### 12.3 UI integration tests (Vitest + RTL)

- Render `<GraphPane />` with seeded snapshot fixture; verify nodes appear with correct sizes/colors, edges colored by type, legend present.
- Click a node → `NodeDrawer` opens with markdown body rendered, backlinks list correct.
- Toggle edge filter pill → verify edges of that type disappear from canvas.
- Search "recon" → verify matching nodes get `data-search-match` attribute; if 2+ matches, verify path-highlight class on intermediate nodes.
- Click "Re-analyze" → modal opens; mock SSE → verify phase labels update; verify diff preview renders proposed-changes fixture; verify Apply button POSTs and modal closes; toast appears.

### 12.4 E2E (Playwright)

- Full flow with isolated `CAE_HOME` pointing at a tmp dir:
  1. Boot dashboard with seeded vault + snapshot.
  2. Navigate /memory.
  3. Click Re-analyze → wait for modal.
  4. Wait for Stage 2 (mock LLM via fixture).
  5. Toggle one suggestion to reject → click Apply.
  6. Wait for toast.
  7. Verify graph re-fetched; verify rejected edge absent in snapshot.
  8. Click Revert in toast → confirm dialog → verify state restored to pre-apply.

### 12.5 Snapshot/regression

- Golden snapshot of a small vault's edges.jsonl + snapshot.json after a deterministic (no-LLM) analyzer pass. Any analyzer change that breaks this snapshot must be reviewed.

### 12.6 Performance budgets

- Analyzer full pass on 200 files: ≤ 5s wall (no LLM); ≤ 90s wall with LLM (cached catalog, parallel ≤ 5 in flight).
- Snapshot rebuild: ≤ 2s for 200 files / 1000 edges.
- Graph render: first paint ≤ 800ms for 200 nodes / 1000 edges; interaction frame budget 16ms (60fps) during drag/zoom.
- Re-analyze modal: SSE first event within 500ms of click.

---

## Wave breakdown (recommendation for planner)

For `/gsd-plan-phase`, the following 10 waves are sized to ship in atomic commits and in dependency order:

| Wave | Title | Dependencies |
|------|-------|--------------|
| W1 | Memory frontmatter spec + JSON schema + validator + lint script | none |
| W2 | Migration tool: backup + frontmatter merge + entity extraction + bootstrap backlinks (no LLM) | W1 |
| W3 | `edges.jsonl` + `snapshot.json` storage layer + atomic writer + snapshot rebuild | W1 |
| W4 | Analyzer pipeline (regex + backlinks + diff emission) — CLI mode, `--no-llm` only | W2, W3 |
| W5 | LLM relationship extractor (opus-4-7, prompt cache, retry, confidence floor) | W4 |
| W6 | Post-commit hook + agent-invocation logger + cron entry + install script | W4 |
| W7 | API routes: `/api/memory/snapshot`, `/api/memory/analyze` (SSE), `/api/memory/apply`, `/api/memory/revert`, `/api/memory/file-meta`, `/api/editor/open` | W3, W5 |
| W8 | UI: GraphCanvas v2 (force layout, edge color by type, node size, halo, mini-map) + EdgeFilters + NodeFilters + GraphLegend | W7 |
| W9 | UI: NodeDrawer v2 (Markdown render, suggested-related accept/reject, Open in editor) + MarkdownView + WikilinkTooltip + GraphSearch (with path highlight) | W8 |
| W10 | UI: ReanalyzeButton + ReanalyzeModal (3 stages) + DiffPreview + revert flow + toast wiring | W7, W9 |

**Optional W11/W12** (post-ship): file-watcher opt-in toggle; tree-sitter code-symbol edges; PR/skill graph.

---

## Open questions (with proposed defaults)

| # | Question | Default if Eric silent |
|---|----------|------------------------|
| 1 | Ship file-watcher (chokidar) in v1 or v2? | v2 — Eric said cron+button, watcher is bonus |
| 2 | Where does `/api/editor/open` route? `code -g` (VSCode), `cursor`, or generic `xdg-open`? | Try `cursor` → `code` → `xdg-open` in that order (env-overridable) |
| 3 | Node halo for "accessed last 24h" — does Eric want it on ALL recently accessed, or only ones HE accessed (vs analyzer/agent)? | Only Eric-accessed (filter access-log by `actor: human`) |
| 4 | LLM model lock — opus-4-7 always, or fall back to sonnet on cost throttle? | Opus always (semantic quality matters; vault is small) |
| 5 | Should `mentions_files` resolve cross-repo or only within current repo? | Within current repo + `/root/.claude/projects/-root/memory/` only |
| 6 | Backlinks section caps: 50 default, with `<details>` collapse > 10 — keep both? | Yes |
| 7 | `supersedes` edges — should the superseded file get a banner in its drawer ("Superseded by X")? | Yes — high-value affordance, near-zero cost to ship |

---

## Status

- [x] Spec drafted (this doc)
- [ ] Eric review
- [ ] W1–W10 planning via `/gsd-plan-phase`
- [ ] Execute waves
- [ ] Migration apply (after W4 + Eric dry-run review)
- [ ] Hooks install (W6)
- [ ] UI ship (W10)
- [ ] 1-week monitor + tune
