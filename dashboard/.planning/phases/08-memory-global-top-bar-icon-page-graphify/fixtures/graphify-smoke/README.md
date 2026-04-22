# graphify-smoke fixture

Wave-0 captured output of a LIVE graphify run. Downstream (Wave 2
`lib/cae-graph-state.ts`) freezes `GraphNode`/`GraphEdge` types against this
file.

## Provenance

- **Mode:** LIVE graphify run (not hand-written, not fallback)
- **Graphify version:** 0.4.29 (pip install graphifyy)
- **Input directory:** `/home/cae/ctrl-alt-elite/dashboard/lib` (the dashboard's
  server-module directory — 30+ TypeScript files with real import/call graphs)
- **Exact command:** `graphify update /home/cae/ctrl-alt-elite/dashboard/lib`
- **Node count:** 144
- **Link count:** 273
- **Community count:** 22

## Escalation history (why `lib/` and not `docs/`)

Plan 08-01 Task 3 originally specified running graphify against the tiny
two-file `./docs/` fixture. `graphify update .` on the markdown-only fixture
printed `[graphify watch] No code files found - nothing to rebuild.` and exited
non-zero. Graphify 0.4.29's `update` subcommand is **code-file only**
(tree-sitter AST extraction), not markdown-aware — the research assumption
that `--mode fast` would walk markdown turned out to be outdated vs. the CLI
that shipped.

Per the plan's escalation order (docs/ → agents/ → CAE root), both
`/home/cae/ctrl-alt-elite/docs/` and `/home/cae/ctrl-alt-elite/agents/` are
also markdown-only (no code files) and would produce the same empty result.
`/home/cae/ctrl-alt-elite/dashboard/lib/` is the first directory in the CAE
tree with enough real TypeScript code to yield a substantive graph, so we
escalated one step further than the plan listed.

## CLI-shape deviation (important for Wave 2)

Plan 08-01 Task 1 references `graphify . --mode fast --no-viz --update` — **this
syntax is NOT available in graphify 0.4.29.** The 0.4.x CLI uses subcommands
instead of flags:

- `graphify update <path>` — AST-only re-extract (replaces `--mode fast --update`)
- `graphify watch <path>` — watch mode
- `graphify add <url>` — fetch-and-extract

There is no `--no-viz` flag; graphify always writes `graph.html` + `graph.json`
+ `GRAPH_REPORT.md` + `cache/` into `{cwd}/graphify-out/`.

Wave 2 server code must spawn `graphify update <path>` (not `.`) and know that
the output lives at `{path}/graphify-out/graph.json`, **relative to the target
dir, not relative to cwd**. This differs from the plan's gotcha #9.

## Schema (ground truth)

Top-level keys observed:

```json
{
  "directed": false,
  "multigraph": false,
  "graph": {},
  "nodes": [...],
  "links": [...],
  "hyperedges": [...]
}
```

**Note:** graphify uses networkx's `"links"` key, **not** `"edges"`. The plan's
verification command grepped for `g.edges` — that check is wrong; the correct
check is `g.links`. Wave 2's `GraphEdge` type must map from `links`.

### Node shape

```json
{
  "label": "cae-home-state.ts",
  "file_type": "code",
  "source_file": "cae-home-state.ts",
  "source_location": "L1",
  "id": "cae_home_state_ts",
  "community": 0,
  "norm_label": "cae-home-state.ts"
}
```

### Link shape

```json
{
  "relation": "contains",
  "confidence": "EXTRACTED",
  "source_file": "cae-home-state.ts",
  "source_location": "L88",
  "weight": 1,
  "_src": "cae_home_state_ts",
  "_tgt": "cae_home_state_toprojectname",
  "source": "cae_home_state_ts",
  "target": "cae_home_state_toprojectname",
  "confidence_score": 1
}
```

## Reproduce

```bash
mkdir -p /tmp/graphify-repro && cd /tmp/graphify-repro
graphify update /home/cae/ctrl-alt-elite/dashboard/lib
# Output: /home/cae/ctrl-alt-elite/dashboard/lib/graphify-out/graph.json
cp /home/cae/ctrl-alt-elite/dashboard/lib/graphify-out/graph.json \
   /home/cae/ctrl-alt-elite/dashboard/.planning/phases/08-memory-global-top-bar-icon-page-graphify/fixtures/graphify-smoke/graph.sample.json
rm -rf /home/cae/ctrl-alt-elite/dashboard/lib/graphify-out
```

Note: graphify writes into the **target directory**, not `cwd`. Always clean
`graphify-out/` from the target after running.
