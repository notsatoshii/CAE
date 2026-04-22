/**
 * Phase 8 Wave 1 (D-03, MEM-09): multi-project aggregator for memory-consult.jsonl.
 *
 * Reads every project's `.cae/metrics/memory-consult.jsonl` (written by the
 * PostToolUse hook at /home/cae/ctrl-alt-elite/tools/memory-consult-hook.sh),
 * groups events by task_id, and returns the set of memory sources that a
 * given task's Claude-Code session consulted.
 *
 * Consumed by `app/api/memory/consult/[task_id]/route.ts` and surfaced in
 * the Wave-5 Why drawer.
 */
import { join } from "node:path";
import { listProjects, tailJsonl } from "./cae-state";

export interface MemoryConsultEntry {
  source_path: string;
  ts: string; // ISO8601 Z
}

export interface MemoryConsultResult {
  task_id: string;
  entries: MemoryConsultEntry[]; // de-duplicated by source_path, most recent ts wins, sorted by ts ascending
  found: boolean; // true if at least one entry matched; false = heuristic-fallback trigger
}

interface RawMemoryConsultEvent {
  ts?: unknown;
  event?: unknown;
  source_path?: unknown;
  task_id?: unknown;
}

const MEMORY_CONSULT_FILE = ".cae/metrics/memory-consult.jsonl";
const TAIL_LIMIT = 2_000;

// Simple process-level cache (60s TTL) — keyed by task_id. Matches Phase-5/7 aggregator pattern.
const cache = new Map<string, { at: number; value: MemoryConsultResult }>();
const CACHE_TTL_MS = 60_000;

export async function getMemoryConsultEntries(taskId: string): Promise<MemoryConsultResult> {
  const now = Date.now();
  const cached = cache.get(taskId);
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return cached.value;
  }

  const projects = await listProjects();
  const collected: MemoryConsultEntry[] = [];

  for (const project of projects) {
    const jsonlPath = join(project.path, MEMORY_CONSULT_FILE);
    let rows: unknown[] = [];
    try {
      rows = await tailJsonl(jsonlPath, TAIL_LIMIT);
    } catch {
      // File missing or unreadable — skip project silently.
      continue;
    }
    for (const row of rows) {
      if (typeof row !== "object" || row === null) continue;
      const e = row as RawMemoryConsultEvent;
      if (e.event !== "memory_consult") continue;
      if (typeof e.task_id !== "string") continue;
      if (e.task_id !== taskId) continue;
      if (typeof e.source_path !== "string") continue;
      if (typeof e.ts !== "string") continue;
      collected.push({ source_path: e.source_path, ts: e.ts });
    }
  }

  // Dedupe by source_path; retain most recent ts.
  const byPath = new Map<string, MemoryConsultEntry>();
  for (const entry of collected) {
    const prev = byPath.get(entry.source_path);
    if (!prev || entry.ts > prev.ts) byPath.set(entry.source_path, entry);
  }
  const entries = Array.from(byPath.values()).sort((a, b) =>
    a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0,
  );

  const value: MemoryConsultResult = {
    task_id: taskId,
    entries,
    found: entries.length > 0,
  };
  cache.set(taskId, { at: now, value });
  return value;
}

// Test-only: clear cache between unit tests. Not exported from a barrel — import directly.
export function __clearMemoryConsultCacheForTests(): void {
  cache.clear();
}
