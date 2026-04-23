/**
 * cae-audit-log.ts — Reader for tool-call audit log written by tools/audit-hook.sh.
 *
 * Plan 14-05: Reads .cae/metrics/tool-calls.jsonl from every known project
 * (via listProjects), aggregates, filters, sorts, and paginates.
 *
 * T-14-05-04: Dashboard is READ-ONLY on this log — never writes.
 * T-14-05-05: Only tool name + cwd logged; no args, no stdout.
 */
import { tailJsonl, listProjects } from "./cae-state"
import path from "node:path"
import type { AuditEntry } from "./cae-types"

/** Filter parameters for readAuditLog. All fields are optional. */
export type AuditFilter = {
  /** ISO8601 string — only entries at or after this time. */
  from?: string
  /** ISO8601 string — only entries at or before this time. */
  to?: string
  /** Exact tool name match, e.g. "Bash". */
  tool?: string
  /** Exact task ID match, e.g. "t-abc123". */
  task?: string
  /** Maximum entries to return per page. Default 200. */
  limit?: number
  /** Zero-based page offset for pagination. Default 0. */
  offset?: number
}

/**
 * readAuditLog — aggregate + filter tool-call audit entries across all known projects.
 *
 * Skips missing/empty log files silently.
 * Invalid JSONL lines are filtered out by the tailJsonl typeguard.
 *
 * Returns entries sorted descending by ts (most recent first).
 */
export async function readAuditLog(
  filter: AuditFilter = {}
): Promise<{ entries: AuditEntry[]; total: number }> {
  const projects = await listProjects()
  let all: AuditEntry[] = []

  for (const p of projects) {
    try {
      const rows = await tailJsonl(
        path.join(p.path, ".cae/metrics/tool-calls.jsonl"),
        10_000
      )
      for (const row of rows) {
        if (isAuditEntry(row)) {
          all.push(row)
        }
      }
    } catch {
      // Missing or unreadable log — skip silently
    }
  }

  // Apply filters
  if (filter.from) {
    all = all.filter((e) => e.ts >= filter.from!)
  }
  if (filter.to) {
    all = all.filter((e) => e.ts <= filter.to!)
  }
  if (filter.tool) {
    all = all.filter((e) => e.tool === filter.tool)
  }
  if (filter.task) {
    all = all.filter((e) => e.task === filter.task)
  }

  // Sort descending by timestamp
  all.sort((a, b) => b.ts.localeCompare(a.ts))

  const total = all.length
  const limit = filter.limit ?? 200
  const offset = filter.offset ?? 0
  const entries = all.slice(offset, offset + limit)

  return { entries, total }
}

/**
 * isAuditEntry — type guard to filter out malformed JSONL rows.
 * Requires ts (string) and tool (string) as minimum fields.
 */
function isAuditEntry(v: unknown): v is AuditEntry {
  return (
    v !== null &&
    typeof v === "object" &&
    typeof (v as Record<string, unknown>)["ts"] === "string" &&
    typeof (v as Record<string, unknown>)["tool"] === "string"
  )
}
