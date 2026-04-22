/**
 * Phase 8 Wave 5 (plan 08-07) — client-safe extract of the D-10 memory-source
 * path-shape check.
 *
 * This file exists because `lib/cae-memory-sources.ts` — the original home of
 * `isMemorySourcePath` — imports `node:fs/promises` at module top-level (for
 * the server-only `listMemorySources` / `buildMemoryTree` / `getAllowedRoots`
 * functions). That import prevents the module from being bundled into the
 * client, which transitively broke `components/memory/why-drawer.tsx` (client
 * component) once Wave 5 actually wired the drawer into a live route.
 *
 * The path-shape check itself is pure — regex + string prefix only. Lifting
 * it here lets the WhyDrawer call `getHeuristicWhyTraceClient` from the
 * browser bundle without dragging node-only fs APIs along.
 *
 * IMPORTANT: this module intentionally does NOT touch the `_allowedRoots`
 * cache that the server-side `isMemorySourcePath` consults. The server-side
 * function still runs the root-prefix check when the cache is warm; the
 * client-side version relies on pattern-match only (identical to the
 * uninitialized-cache branch — see `cae-memory-sources.ts` lines 122-124).
 * This is acceptable for the heuristic-fallback use case because:
 *   1. `filesModified` is sourced from trusted places (outbox DONE.md, git).
 *   2. The UI is read-only — the client-side heuristic never performs a
 *      filesystem operation based on its result.
 */

// D-10 patterns. Kept in sync with `lib/cae-memory-sources.ts` ::
// MEMORY_PATH_PATTERNS (source of truth for the server). If one side changes,
// both must change — deliberately NOT imported from there to keep this file
// free of any transitive server-only imports.
const MEMORY_PATH_PATTERNS: RegExp[] = [
  /\/AGENTS\.md$/,
  /\/KNOWLEDGE\/.+\.md$/,
  /\/\.claude\/agents\/[^/]+\.md$/,
  /\/agents\/cae-[^/]+\.md$/,
  /\/\.planning\/phases\/[^/]+\/[^/]+\.md$/,
];

export function isMemorySourcePathPure(abs: unknown): boolean {
  if (typeof abs !== "string" || abs.length === 0) return false;
  if (abs.endsWith("/")) return false;
  if (!abs.startsWith("/")) return false;
  if (!abs.endsWith(".md")) return false;
  return MEMORY_PATH_PATTERNS.some((rx) => rx.test(abs));
}

export interface HeuristicWhyEntry {
  source_path: string;
  basis: "files_modified_intersect";
}

/**
 * Client-safe version of `getHeuristicWhyTrace` from `cae-memory-whytrace.ts`.
 * Identical input/output contract, but skips the root-prefix check (which
 * requires warming the server-side allowlist cache). For the UI's fallback
 * rendering this is fine — see module docstring.
 */
export function getHeuristicWhyTraceClient(
  filesModified: readonly string[] | null | undefined,
): HeuristicWhyEntry[] {
  const uniq = Array.from(new Set(filesModified ?? []));
  return uniq
    .filter((p) => typeof p === "string" && p.length > 0)
    .filter((p) => isMemorySourcePathPure(p))
    .map((source_path) => ({
      source_path,
      basis: "files_modified_intersect" as const,
    }));
}
