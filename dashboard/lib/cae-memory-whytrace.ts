/**
 * Phase 8 Wave 2 (D-03 fallback, MEM-09): heuristic trace for the Why
 * drawer when the PostToolUse hook didn't capture events for a given
 * task (pre-hook / legacy tasks).
 *
 * Real-trace path lives in Wave 1 (`lib/cae-memory-consult.ts`). When
 * that returns `found: false`, the UI (Wave 5) falls back here — we
 * intersect the caller-supplied `files_modified` with the D-10 memory
 * source allowlist via `isMemorySourcePath`.
 *
 * This file is a two-line pure filter; correctness is tested transitively
 * via `cae-memory-sources.test.ts` (the allowlist) and end-to-end in
 * Wave 5's UI tests. Adding a test here would be a tautology.
 */
import { isMemorySourcePath } from "./cae-memory-sources";

export interface HeuristicWhyEntry {
  source_path: string;
  basis: "files_modified_intersect";
}

/**
 * Pure filter. Zero fs, zero async. Accepts the task's `files_modified`
 * (surfaced from outbox DONE.md or git log by the caller) and returns
 * only the paths that match the memory-source allowlist.
 *
 * Returns a non-empty array ONLY if at least one file is a memory source;
 * otherwise returns []. The Wave-5 drawer uses this return's length + the
 * live-trace `found` flag to decide what to render.
 */
export function getHeuristicWhyTrace(
  filesModified: readonly string[] | null | undefined,
): HeuristicWhyEntry[] {
  const uniq = Array.from(new Set(filesModified ?? []));
  return uniq
    .filter((p) => typeof p === "string" && p.length > 0)
    .filter((p) => isMemorySourcePath(p))
    .map((source_path) => ({
      source_path,
      basis: "files_modified_intersect" as const,
    }));
}
