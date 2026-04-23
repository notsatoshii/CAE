/**
 * lib/logs/multi-source-merge.ts — Phase 15 Wave 5.1 (logs v2).
 *
 * Multi-source log line merge: takes pre-parsed events from N stream
 * sources (tail, audit, tool-calls, heartbeat) and yields a single
 * timestamp-sorted union.
 *
 * Design notes
 * ============
 * - **Source-tagged**: every emitted LogLine carries `source` so the UI can
 *   render per-source badges and let users filter on it.
 * - **Stable sort**: when two lines share an identical `ts` we keep
 *   insertion order (sourceIndex is the tiebreak) so multi-source replays
 *   render deterministically.
 * - **Dedup**: identical (ts + source + raw) tuples are dropped — JSONL
 *   tail-readers can occasionally double-fire the last line on file-watch
 *   re-reads, and we'd rather lose a duplicate than show it twice.
 * - **Best-effort parsing**: a non-JSON, no-timestamp raw string is still
 *   surfaced — it just gets `ts = receivedAt` and `level = "info"` so it
 *   sorts roughly with its peers.
 *
 * Pure data — no React, no fs, no globals. Safe to call from server
 * routes, workers, or unit tests.
 */

/** Recognised levels — anything else is normalised to "info". */
export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal" | "trace"

/** The four physical streams we currently merge. */
export type LogSource = "tail" | "audit" | "tool" | "heartbeat"

/** Canonical, render-ready log entry. */
export interface LogLine {
  /** ISO8601 UTC timestamp (always present — falls back to receivedAt). */
  ts: string
  /** Sortable epoch-ms derived from ts. */
  tsMs: number
  /** Source stream this line came from. */
  source: LogSource
  /** Normalised log level. */
  level: LogLevel
  /** Optional scope tag (e.g. "api.tail", "agent", "chat") — pino `name` field. */
  scope?: string
  /** Optional msg one-liner. */
  msg?: string
  /** Original raw payload (used for search + copy-as-cURL detection). */
  raw: string
  /** Parsed JSON object if `raw` was JSON, else undefined. */
  obj?: Record<string, unknown>
}

/** Best-effort parse a single raw line into a LogLine. */
export function parseLogLine(
  raw: string,
  source: LogSource,
  receivedAt: number = Date.now(),
): LogLine | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // JSON path — pino + tool-call + audit lines are all JSONL.
  if (trimmed.startsWith("{")) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>
      const ts =
        typeof obj.ts === "string"
          ? obj.ts
          : typeof obj.time === "number"
            ? new Date(obj.time).toISOString()
            : typeof obj.time === "string"
              ? obj.time
              : new Date(receivedAt).toISOString()
      const tsMs = Date.parse(ts)
      const level = normaliseLevel(obj.level ?? obj.lvl)
      const scope =
        typeof obj.name === "string"
          ? obj.name
          : typeof obj.scope === "string"
            ? obj.scope
            : typeof obj.tool === "string"
              ? `tool.${obj.tool}`
              : undefined
      const msg =
        typeof obj.msg === "string"
          ? obj.msg
          : typeof obj.message === "string"
            ? obj.message
            : undefined
      return {
        ts,
        tsMs: Number.isFinite(tsMs) ? tsMs : receivedAt,
        source,
        level,
        scope,
        msg,
        raw: trimmed,
        obj,
      }
    } catch {
      // fall through to plain-text path
    }
  }

  // Plain-text path — try to detect a leading ISO timestamp.
  const isoMatch = trimmed.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)/,
  )
  const ts = isoMatch ? isoMatch[1] : new Date(receivedAt).toISOString()
  const tsMs = isoMatch ? Date.parse(isoMatch[1]) : receivedAt
  const level = guessLevel(trimmed)
  return {
    ts,
    tsMs: Number.isFinite(tsMs) ? tsMs : receivedAt,
    source,
    level,
    raw: trimmed,
  }
}

/** Normalise pino numeric or string levels into our enum. */
function normaliseLevel(v: unknown): LogLevel {
  // pino numeric: 10=trace 20=debug 30=info 40=warn 50=error 60=fatal
  if (typeof v === "number") {
    if (v >= 60) return "fatal"
    if (v >= 50) return "error"
    if (v >= 40) return "warn"
    if (v >= 30) return "info"
    if (v >= 20) return "debug"
    return "trace"
  }
  if (typeof v === "string") {
    const lower = v.toLowerCase()
    if (
      lower === "trace" ||
      lower === "debug" ||
      lower === "info" ||
      lower === "warn" ||
      lower === "warning" ||
      lower === "error" ||
      lower === "err" ||
      lower === "fatal"
    ) {
      if (lower === "warning") return "warn"
      if (lower === "err") return "error"
      return lower as LogLevel
    }
  }
  return "info"
}

/** Guess level from plain-text body (cheap heuristic). */
function guessLevel(s: string): LogLevel {
  const upper = s.toUpperCase()
  if (upper.includes("FATAL")) return "fatal"
  if (upper.includes("ERROR") || upper.includes(" ERR ")) return "error"
  if (upper.includes("WARN")) return "warn"
  if (upper.includes("DEBUG")) return "debug"
  if (upper.includes("TRACE")) return "trace"
  return "info"
}

/**
 * Merge multiple already-parsed LogLine arrays into a single timestamp-
 * sorted, deduped sequence. Stable: equal `tsMs` keeps relative order.
 */
export function mergeLogLines(buckets: LogLine[][]): LogLine[] {
  // Flatten with insertion-index to preserve stable order on tsMs ties.
  const tagged: Array<{ line: LogLine; idx: number }> = []
  let idx = 0
  for (const bucket of buckets) {
    for (const line of bucket) {
      tagged.push({ line, idx: idx++ })
    }
  }
  tagged.sort((a, b) => {
    if (a.line.tsMs !== b.line.tsMs) return a.line.tsMs - b.line.tsMs
    return a.idx - b.idx
  })

  // Dedup: identical (tsMs + source + raw) tuples collapse to one.
  const out: LogLine[] = []
  const seen = new Set<string>()
  for (const { line } of tagged) {
    const key = `${line.tsMs}|${line.source}|${line.raw}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(line)
  }
  return out
}

/**
 * Insert one new line into an already-sorted buffer, maintaining order +
 * dedup. O(n) worst-case but typical case (line is newer than tail) is O(1).
 *
 * Returns a NEW array (immutable update — React-friendly).
 */
export function insertSorted(buffer: LogLine[], line: LogLine): LogLine[] {
  // Cheap dedup against last few entries (tail-watcher double-fire).
  const lookback = Math.min(buffer.length, 4)
  for (let i = buffer.length - lookback; i < buffer.length; i++) {
    const b = buffer[i]
    if (b.tsMs === line.tsMs && b.source === line.source && b.raw === line.raw) {
      return buffer
    }
  }

  // Fast-path: line is newer than everything in buffer.
  if (buffer.length === 0 || line.tsMs >= buffer[buffer.length - 1].tsMs) {
    return [...buffer, line]
  }

  // Binary-search insertion point.
  let lo = 0
  let hi = buffer.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (buffer[mid].tsMs <= line.tsMs) lo = mid + 1
    else hi = mid
  }
  const next = buffer.slice()
  next.splice(lo, 0, line)
  return next
}
