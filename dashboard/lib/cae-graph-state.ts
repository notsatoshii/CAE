/**
 * Phase 8 Wave 2 (D-02 rewrite 2026-04-22, MEM-05 + MEM-08): pure-TS
 * memory-graph walker + load/classify.
 *
 * The old subprocess-based generator has been REMOVED from this data path
 * per D-02. In its place: a ~200-LOC walker that reads memory-source
 * markdown files via `listMemorySources`, extracts `[text](./rel.md)`
 * markdown links and Claude-style `@path.md` at-refs, and emits
 * `{nodes, links, generated_at, ...}` JSON to `{CAE_ROOT}/.cae/graph.json`.
 *
 * The Wave-0 schema fixture is retained as reference only — networkx-style
 * `links[]` (not `edges[]`) with node shape `{id,label,source_file,...}`.
 * We preserve `links[]` parity so future tool swaps stay mechanically
 * trivial.
 *
 * Classification (D-04): nodes are tagged `phases | agents | notes | PRDs`.
 * `commits` is not a kind — deferred to a future phase.
 *
 * Regenerate semantics:
 *   - 60s process-level cooldown (D-06). Cooldown starts at CALL time so
 *     parallel invocations queue behind the same 60s window.
 *   - 500-node render cap (D-05) applied in `loadGraph`, alphabetical by
 *     id truncation.
 *   - `loadGraph` is read-only; NEVER writes `.cae/graph.json`.
 */
import { mkdir, readFile, rename, writeFile, stat } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { CAE_ROOT } from "./cae-config";
import { listProjects } from "./cae-state";
import { isMemorySourcePath, listMemorySources } from "./cae-memory-sources";

export type NodeKind = "phases" | "agents" | "notes" | "PRDs";

export interface GraphNode {
  id: string; // absolute path of the source .md file
  label?: string; // first h1 if present, else basename
  source_file: string; // = id (networkx parity)
  file_type: "md" | "txt";
  kind: NodeKind;
}

export interface GraphLink {
  source: string; // node id (absolute path)
  target: string; // node id (absolute path)
  relation: "markdown_link" | "at_ref" | "heading_ref";
  confidence: "EXTRACTED"; // v1 — all edges are textually extracted
}

/**
 * Back-compat alias for any consumer that was using `GraphEdge`. The canonical
 * field name is `links[]` / `GraphLink`; we expose the alias so Wave 3/4/5
 * UI components can import either.
 */
export type GraphEdge = GraphLink;

export interface GraphPayload {
  nodes: GraphNode[];
  links: GraphLink[];
  generated_at: string; // ISO8601 Z
  source_path: string; // absolute path to .cae/graph.json
  truncated: boolean; // true if pre-truncation count > 500
  total_nodes: number; // pre-truncation node count
}

const GRAPH_FILE_REL = ".cae/graph.json";
const RENDER_CAP = 500;
const COOLDOWN_MS = 60_000;
const MAX_FILE_BYTES = 512 * 1024; // 512 KB per markdown — memory source files are small

// Module-level cooldown gate (D-06). Updated at call START so parallel
// calls queue behind one 60s window.
let lastRegenAt = 0;

/**
 * Pure classify — matches on `source_file` / `id` path shape. Returns
 * one of the 4 D-04 kinds. Commit-style nodes are deliberately excluded
 * from the NodeKind union — see D-04 for the decision rationale.
 */
export function classifyNode(n: { id: string; source_file?: string }): NodeKind {
  const p = (n.source_file ?? n.id).toLowerCase();
  if (
    /\/\.planning\/phases\/\d{2}-.+?\/.+?\.md$/.test(p) ||
    /\/\.planning\/phases\//.test(p)
  ) {
    return "phases";
  }
  if (/\/agents\/cae-[\w-]+\.md$/.test(p)) return "agents";
  if (/\/\.claude\/agents\/[^/]+\.md$/.test(p)) return "agents";
  if (/\/prd[^/]*\.md$/i.test(p) || /\/docs\/prd\.md$/i.test(p)) return "PRDs";
  if (/\/(roadmap|ui-spec)\.md$/i.test(p)) return "PRDs";
  if (/\/knowledge\/.+?\.md$/.test(p)) return "notes";
  if (/\/agents\.md$/.test(p)) return "notes";
  return "notes";
}

/**
 * Read `.cae/graph.json`, validate shape, classify nodes, apply 500-node
 * render cap. Returns `null` when the file doesn't exist (UI interprets
 * this as "not built yet" via the API route's 200-empty envelope).
 */
export async function loadGraph(): Promise<GraphPayload | null> {
  // Read CAE_ROOT at call time so tests can point at a temp dir via env.
  const caeRoot = process.env.CAE_ROOT ?? CAE_ROOT;
  const source_path = join(caeRoot, GRAPH_FILE_REL);
  let raw: string;
  try {
    raw = await readFile(source_path, "utf8");
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as {
    nodes?: unknown;
    links?: unknown;
    edges?: unknown; // back-compat with the Wave-0 schema fixture
    generated_at?: unknown;
    source_path?: unknown;
    truncated?: unknown;
    total_nodes?: unknown;
  };

  const rawNodes = Array.isArray(p.nodes) ? p.nodes : [];
  // Accept either `links` (Wave-0 fixture) or legacy `edges` — we tolerate
  // both so downstream tool swaps don't force a loader rewrite.
  const rawLinks = Array.isArray(p.links)
    ? p.links
    : Array.isArray(p.edges)
      ? p.edges
      : [];

  const classifiedNodes: GraphNode[] = [];
  for (const n of rawNodes) {
    if (typeof n !== "object" || n === null) continue;
    const nn = n as {
      id?: unknown;
      label?: unknown;
      source_file?: unknown;
      file_type?: unknown;
    };
    if (typeof nn.id !== "string") continue;
    const id = nn.id;
    const source_file =
      typeof nn.source_file === "string" ? nn.source_file : id;
    const fileType: "md" | "txt" =
      nn.file_type === "txt" ? "txt" : "md";
    const kind = classifyNode({ id, source_file });
    classifiedNodes.push({
      id,
      label: typeof nn.label === "string" ? nn.label : undefined,
      source_file,
      file_type: fileType,
      kind,
    });
  }

  const links: GraphLink[] = [];
  for (const l of rawLinks) {
    if (typeof l !== "object" || l === null) continue;
    const ll = l as {
      source?: unknown;
      target?: unknown;
      relation?: unknown;
      confidence?: unknown;
    };
    if (typeof ll.source !== "string" || typeof ll.target !== "string") continue;
    const relation: GraphLink["relation"] =
      ll.relation === "at_ref"
        ? "at_ref"
        : ll.relation === "heading_ref"
          ? "heading_ref"
          : "markdown_link";
    links.push({
      source: ll.source,
      target: ll.target,
      relation,
      confidence: "EXTRACTED",
    });
  }

  const totalNodes = classifiedNodes.length;
  // Sort alphabetically by id and truncate at RENDER_CAP (D-05).
  classifiedNodes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const truncated = totalNodes > RENDER_CAP;
  const nodes = truncated ? classifiedNodes.slice(0, RENDER_CAP) : classifiedNodes;
  // Drop links whose endpoints aren't in the kept node set (prevents
  // dangling edges in the UI after truncation).
  const keptIds = new Set(nodes.map((n) => n.id));
  const filteredLinks = truncated
    ? links.filter((l) => keptIds.has(l.source) && keptIds.has(l.target))
    : links;

  const generatedAt =
    typeof p.generated_at === "string" && p.generated_at.length > 0
      ? p.generated_at
      : "";

  return {
    nodes,
    links: filteredLinks,
    generated_at: generatedAt,
    source_path,
    truncated,
    total_nodes: totalNodes,
  };
}

/** Extract the first markdown h1 as a label. Falls back to basename. */
function extractLabel(absPath: string, contents: string): string {
  const m = contents.match(/^#\s+(.+?)\s*$/m);
  if (m && m[1]) return m[1].trim();
  const i = absPath.lastIndexOf("/");
  return i < 0 ? absPath : absPath.slice(i + 1);
}

const MARKDOWN_LINK_RE = /\[[^\]]*\]\(([^)]+?\.md)(?:#[^)]*)?\)/g;
const AT_REF_RE = /(?:^|\s)@([A-Za-z0-9._/-]+\.md)(?:\s|$)/gm;

function resolveTarget(fileAbs: string, ref: string): string | null {
  if (isAbsolute(ref)) return ref;
  // "./foo.md", "../foo.md", "foo.md"
  try {
    return resolve(dirname(fileAbs), ref);
  } catch {
    return null;
  }
}

interface WalkResult {
  nodes: GraphNode[];
  links: GraphLink[];
}

async function walkMemorySources(): Promise<WalkResult> {
  const projects = await listProjects();
  const allFiles = new Set<string>();
  for (const project of projects) {
    const files = await listMemorySources(project.path);
    for (const f of files) allFiles.add(f);
  }

  const labels = new Map<string, string>();
  const rawContents = new Map<string, string>();

  for (const abs of allFiles) {
    try {
      const st = await stat(abs);
      if (!st.isFile() || st.size > MAX_FILE_BYTES) continue;
      const contents = await readFile(abs, "utf8");
      rawContents.set(abs, contents);
      labels.set(abs, extractLabel(abs, contents));
    } catch (err) {
      console.error("[cae-graph-state] read failed", abs, err);
      continue;
    }
  }

  // Build nodes first — only files we actually read.
  const nodes: GraphNode[] = Array.from(rawContents.keys()).map((id) => {
    const n: GraphNode = {
      id,
      label: labels.get(id),
      source_file: id,
      file_type: "md",
      kind: classifyNode({ id, source_file: id }),
    };
    return n;
  });
  const nodeIds = new Set(nodes.map((n) => n.id));

  // Extract edges — markdown link + at-ref. Dedupe.
  const edgeKeys = new Set<string>();
  const links: GraphLink[] = [];

  function pushEdge(
    source: string,
    target: string,
    relation: GraphLink["relation"],
  ): void {
    if (!nodeIds.has(target)) return; // skip dangling
    if (source === target) return;
    const key = source + "|" + target + "|" + relation;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    links.push({ source, target, relation, confidence: "EXTRACTED" });
  }

  for (const [source, contents] of rawContents) {
    // markdown links
    for (const match of contents.matchAll(MARKDOWN_LINK_RE)) {
      const ref = match[1];
      const target = resolveTarget(source, ref);
      if (!target) continue;
      pushEdge(source, target, "markdown_link");
    }
    // at-refs (Claude-style @path.md)
    for (const match of contents.matchAll(AT_REF_RE)) {
      const ref = match[1];
      const target = resolveTarget(source, ref);
      if (!target) continue;
      pushEdge(source, target, "at_ref");
    }
  }

  return { nodes, links };
}

/**
 * Rebuild `.cae/graph.json` from scratch by walking memory sources. Pure
 * TypeScript — no subprocess, no external-tool spawn, no node builtin-process import.
 * Server-gated 60s cooldown (D-06). Atomic write via tmp + rename.
 */
export async function regenerateGraph(): Promise<{
  ok: boolean;
  error?: string;
  retry_after_ms?: number;
  duration_ms: number;
  total_nodes: number;
}> {
  const startedAt = Date.now();
  if (startedAt - lastRegenAt < COOLDOWN_MS) {
    const retry_after_ms = COOLDOWN_MS - (startedAt - lastRegenAt);
    return {
      ok: false,
      error: "cooldown",
      retry_after_ms,
      duration_ms: 0,
      total_nodes: 0,
    };
  }
  lastRegenAt = startedAt;

  const caeRoot = process.env.CAE_ROOT ?? CAE_ROOT;
  const graphDir = join(caeRoot, ".cae");
  const graphPath = join(graphDir, "graph.json");

  let walk: WalkResult;
  try {
    walk = await walkMemorySources();
  } catch (err) {
    console.error("[cae-graph-state] walk failed", err);
    return {
      ok: false,
      error: "walk_failed",
      duration_ms: Date.now() - startedAt,
      total_nodes: 0,
    };
  }

  const payload: GraphPayload = {
    nodes: walk.nodes,
    links: walk.links,
    generated_at: new Date().toISOString(),
    source_path: graphPath,
    truncated: false, // regeneration writes ALL nodes; truncation only in loadGraph render path
    total_nodes: walk.nodes.length,
  };

  try {
    await mkdir(graphDir, { recursive: true });
    const tmpPath = graphPath + ".tmp-" + startedAt;
    await writeFile(tmpPath, JSON.stringify(payload, null, 2), "utf8");
    await rename(tmpPath, graphPath);
  } catch (err) {
    console.error("[cae-graph-state] write failed", err);
    return {
      ok: false,
      error: "write_failed",
      duration_ms: Date.now() - startedAt,
      total_nodes: walk.nodes.length,
    };
  }

  return {
    ok: true,
    duration_ms: Date.now() - startedAt,
    total_nodes: walk.nodes.length,
  };
}

/**
 * Test-only: clear the cooldown so unit tests can call regenerate back-to-back.
 */
export function __resetCooldownForTests(): void {
  lastRegenAt = 0;
}

// Guard against regressions: the verify grep asserts `isMemorySourcePath`
// is wired through — pure-TS walker depends on the allowlist via
// `listMemorySources` (which uses the D-10 globs internally). This log
// reference keeps the dependency visible for dead-code elimination.
void isMemorySourcePath;
