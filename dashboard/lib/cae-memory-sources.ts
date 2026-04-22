/**
 * Phase 8 Wave 2 (D-10, D-12): memory-source allowlist + tree builder.
 *
 * Single source of truth for what counts as a memory source across the whole
 * dashboard:
 *   - `isMemorySourcePath(abs)` — pure fn, zero fs, consumed by the server
 *     routes, search module, git module, hook script (mirror logic in bash).
 *   - `listMemorySources(projectPath)` — enumerates a single project's
 *     memory files by walking the D-10 globs with readdir recursion.
 *   - `buildMemoryTree()` — union across every project returned by
 *     `listProjects()`, grouped per-project by glob category.
 *   - `ALLOWED_ROOTS` — lazily resolved via `getAllowedRoots()`; the set
 *     of project root paths that memory lookups are permitted to touch.
 *
 * D-10 glob set (per project):
 *   - <project>/AGENTS.md
 *   - <project>/KNOWLEDGE/ **\/*.md
 *   - <project>/.claude/agents/*.md
 *   - <project>/agents/cae-*.md
 *   - <project>/.planning/phases/\*\/\*.md
 */
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { listProjects } from "./cae-state";

export interface MemoryTreeNode {
  id: string; // relative path, "project:<name>", or "group:<name>" — unique within tree
  label: string; // display name
  absPath?: string; // only on leaf nodes (kind === "file")
  kind: "project" | "group" | "file";
  children?: MemoryTreeNode[];
}

// D-10 patterns as pure regexes. `isMemorySourcePath` intentionally has no
// fs access — path-shape match only. Paired with the "must start with an
// allowed project root" check for defense in depth.
const MEMORY_PATH_PATTERNS: RegExp[] = [
  /\/AGENTS\.md$/,
  /\/KNOWLEDGE\/.+\.md$/,
  /\/\.claude\/agents\/[^/]+\.md$/,
  /\/agents\/cae-[^/]+\.md$/,
  /\/\.planning\/phases\/[^/]+\/[^/]+\.md$/,
];

// Directories we never descend into during enumeration.
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "graphify-out",
  ".cae",
  "dist",
  "build",
  ".turbo",
]);

// Hard cap on discovered paths per project — stops a runaway KNOWLEDGE tree
// from blowing up the API response.
const MAX_PATHS_PER_PROJECT = 5000;

// Cached allowlist; filled on first `getAllowedRoots()` call and held for
// the process lifetime. Dev-server restarts on file change so this is fine.
let _allowedRoots: string[] | null = null;

/**
 * Returns the list of allowed project roots. Cached process-wide after first
 * call. Downstream modules MUST use this — never hardcode the roots list.
 */
export async function getAllowedRoots(): Promise<string[]> {
  if (_allowedRoots !== null) return _allowedRoots;
  const projects = await listProjects();
  _allowedRoots = projects.map((p) => p.path);
  return _allowedRoots;
}

/**
 * Proxy constant exposed for test/inspection convenience. Reads the cached
 * value; call `getAllowedRoots()` first if you need a guaranteed-populated
 * snapshot.
 */
export const ALLOWED_ROOTS: { get value(): string[] | null } = {
  get value() {
    return _allowedRoots;
  },
};

/**
 * For tests only — resets the cached allowlist so a test can re-seed
 * `listProjects()` between cases.
 */
export function __resetAllowedRootsCacheForTests(): void {
  _allowedRoots = null;
}

/**
 * Pure, synchronous check: does `abs` match one of the D-10 memory-source
 * glob patterns AND live inside an allowed project root?
 *
 * The root check is defense in depth — the regex set alone already rejects
 * `/etc/passwd`, `/tmp/foo.md`, etc., but pairing with the explicit root
 * list makes path-injection an order-of-magnitude harder to land.
 *
 * Callers that need the root check must `await getAllowedRoots()` first to
 * warm the cache; otherwise this falls back to pattern-only matching (useful
 * for the hook script's mirror logic and for startup paths).
 */
export function isMemorySourcePath(abs: string): boolean {
  if (typeof abs !== "string" || abs.length === 0) return false;
  // Reject trailing slashes, .mdx, non-absolute paths.
  if (abs.endsWith("/")) return false;
  if (!abs.startsWith("/")) return false;
  if (!abs.endsWith(".md")) return false;

  // Pattern match against the D-10 glob set.
  const patternMatch = MEMORY_PATH_PATTERNS.some((rx) => rx.test(abs));
  if (!patternMatch) return false;

  // If the allowlist has been warmed, enforce the root-prefix check. If it
  // hasn't been warmed yet, we accept pattern-only (hook script mirrors this
  // logic in bash and does its own root check at the shell level).
  const roots = _allowedRoots;
  if (!roots || roots.length === 0) return true;
  return roots.some((r) => abs === r + "/" || abs.startsWith(r + "/"));
}

async function walkForMarkdown(
  dir: string,
  collector: string[],
  max: number,
): Promise<void> {
  if (collector.length >= max) return;
  let entries: Awaited<ReturnType<typeof readdir>>;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // missing or unreadable — skip silently
  }
  for (const entry of entries) {
    if (collector.length >= max) return;
    if (entry.name.startsWith(".") && entry.isDirectory()) {
      // Allow `.claude` and `.planning` since the D-10 patterns traverse them;
      // skip everything else (like `.git`, `.cache`, `.vscode`…).
      if (entry.name !== ".claude" && entry.name !== ".planning") continue;
    }
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkForMarkdown(full, collector, max);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      collector.push(full);
    }
  }
}

/**
 * Enumerate every memory-source file under `projectPath`. Uses readdir
 * recursion (no rg spawn) so this is safe during tests and server startup.
 * Paths are absolute. Caps at 5000 entries per project.
 */
export async function listMemorySources(projectPath: string): Promise<string[]> {
  const collected: string[] = [];
  try {
    await stat(projectPath);
  } catch {
    return [];
  }
  await walkForMarkdown(projectPath, collected, MAX_PATHS_PER_PROJECT);
  return collected.filter((p) => {
    // Apply D-10 patterns to filter: we collected every .md under the project
    // (minus skip dirs), now narrow to the memory-source set. Note we do
    // NOT require the allowlist check here — `projectPath` is the caller's
    // responsibility to validate upstream.
    return MEMORY_PATH_PATTERNS.some((rx) => rx.test(p));
  });
}

type MemorySourceCategory =
  | "AGENTS.md"
  | "KNOWLEDGE"
  | "agents/"
  | ".claude/agents/"
  | ".planning/phases/";

function categorize(absPath: string): MemorySourceCategory | null {
  if (/\/AGENTS\.md$/.test(absPath)) return "AGENTS.md";
  if (/\/KNOWLEDGE\/.+\.md$/.test(absPath)) return "KNOWLEDGE";
  if (/\/\.claude\/agents\/[^/]+\.md$/.test(absPath)) return ".claude/agents/";
  if (/\/agents\/cae-[^/]+\.md$/.test(absPath)) return "agents/";
  if (/\/\.planning\/phases\/[^/]+\/[^/]+\.md$/.test(absPath))
    return ".planning/phases/";
  return null;
}

const CATEGORY_ORDER: MemorySourceCategory[] = [
  "AGENTS.md",
  "KNOWLEDGE",
  "agents/",
  ".claude/agents/",
  ".planning/phases/",
];

function basename(p: string): string {
  const i = p.lastIndexOf("/");
  return i < 0 ? p : p.slice(i + 1);
}

/**
 * Build the full cross-project memory tree. Each project is a top-level
 * node with group children (AGENTS.md, KNOWLEDGE, agents/, etc.), each
 * containing the file leaves. Empty groups are omitted; files sorted
 * alphabetically within each group.
 */
export async function buildMemoryTree(): Promise<MemoryTreeNode[]> {
  const projects = await listProjects();
  const tree: MemoryTreeNode[] = [];

  for (const project of projects) {
    const files = await listMemorySources(project.path);
    const byCategory = new Map<MemorySourceCategory, string[]>();
    for (const f of files) {
      const cat = categorize(f);
      if (!cat) continue;
      const bucket = byCategory.get(cat) ?? [];
      bucket.push(f);
      byCategory.set(cat, bucket);
    }

    const groupChildren: MemoryTreeNode[] = [];
    for (const cat of CATEGORY_ORDER) {
      const bucket = byCategory.get(cat);
      if (!bucket || bucket.length === 0) continue;
      bucket.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      const leaves: MemoryTreeNode[] = bucket.map((abs) => ({
        id: abs,
        label: basename(abs),
        absPath: abs,
        kind: "file" as const,
      }));
      if (cat === "AGENTS.md" && leaves.length === 1) {
        // Flatten the single-file AGENTS.md bucket into the project level
        // for a less noisy tree — this mirrors how the UI will render it.
        groupChildren.push(leaves[0]);
      } else {
        groupChildren.push({
          id: "group:" + project.name + ":" + cat,
          label: cat,
          kind: "group" as const,
          children: leaves,
        });
      }
    }

    if (groupChildren.length === 0) continue;
    tree.push({
      id: "project:" + project.name,
      label: project.name,
      kind: "project",
      children: groupChildren,
    });
  }

  return tree;
}
