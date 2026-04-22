/**
 * lib/incidents-stream.ts — Reusable tail-and-parse logic for JSONL log files.
 *
 * Provides:
 *   - `filterLevel(min)` — predicate: passes warn/error/fatal (or error/fatal only)
 *   - `tailJsonl(file, opts)` — emits history lines + real-time appends; returns close()
 *
 * Design decisions:
 *   - stat + poll (500ms) instead of fs.watch — reliable on Linux, no ENOENT risk
 *     on missing file, easier to unit-test by appending to a tmp file
 *   - History read uses readline to avoid loading full file into memory
 *   - Lines that fail JSON.parse are silently skipped (malformed == not our lines)
 *   - close() / AbortSignal are equivalent; either stops the poll loop
 *
 * Server-only — never import from client components.
 */

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createInterface } from "node:readline";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogLine = {
  level: string;
  time: number;
  scope?: string;
  reqId?: string;
  route?: string;
  msg?: string;
  [k: string]: unknown;
};

export type LineHandler = (line: LogLine, raw: string) => void;

export interface TailJsonlOptions {
  /** Called for each matching line (history + real-time) */
  onLine: LineHandler;
  /** Called when the tail is closed cleanly */
  onClose?: () => void;
  /** Filter predicate — if absent, all lines pass */
  filter?: (l: LogLine) => boolean;
  /** Max number of historical lines to emit on connect (default 50) */
  historyLimit?: number;
  /** AbortSignal to stop the tail (equivalent to calling the returned close()) */
  signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// filterLevel — level severity predicate
// ---------------------------------------------------------------------------

/**
 * Returns a predicate that passes log lines at or above the given minimum level.
 *
 * Severity order: debug < info < warn < error < fatal
 *
 * @param min "warn" → accept warn + error + fatal
 *            "error" → accept error + fatal only
 */
export function filterLevel(min: "warn" | "error"): (l: LogLine) => boolean {
  if (min === "error") {
    return (l) => l.level === "error" || l.level === "fatal";
  }
  return (l) =>
    l.level === "warn" || l.level === "error" || l.level === "fatal";
}

// ---------------------------------------------------------------------------
// tailJsonl — history + real-time tail
// ---------------------------------------------------------------------------

/**
 * Opens a JSONL file, emits the last `historyLimit` matching lines, then
 * continues polling for new appends until closed.
 *
 * @returns A `close()` function that stops the poll loop immediately.
 *
 * If the file does not exist, history read is skipped gracefully and polling
 * begins — the file may be created later and new lines will be detected.
 */
export async function tailJsonl(
  file: string,
  opts: TailJsonlOptions,
): Promise<() => void> {
  const filter = opts.filter ?? (() => true);
  const historyLimit = opts.historyLimit ?? 50;

  // Track closed state — used by the poll loop
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    opts.onClose?.();
  };

  // Wire abort signal to close()
  if (opts.signal) {
    if (opts.signal.aborted) {
      close();
      return close;
    }
    opts.signal.addEventListener("abort", close, { once: true });
  }

  // -------------------------------------------------------------------------
  // Phase 1: emit last N matching lines from history
  // -------------------------------------------------------------------------

  let lastSize = 0;

  try {
    const s = await stat(file);
    lastSize = s.size;

    const rl = createInterface({
      input: createReadStream(file),
      crlfDelay: Infinity,
    });

    const history: Array<{ line: LogLine; raw: string }> = [];

    for await (const raw of rl) {
      if (closed) break;
      try {
        const parsed = JSON.parse(raw) as LogLine;
        if (filter(parsed)) {
          history.push({ line: parsed, raw });
        }
      } catch {
        // skip malformed line
      }
    }

    const recent = history.slice(-historyLimit);
    for (const h of recent) {
      if (closed) break;
      opts.onLine(h.line, h.raw);
    }
  } catch {
    // File may not exist yet; start tailing from zero
    lastSize = 0;
  }

  // -------------------------------------------------------------------------
  // Phase 2: poll for new appends at 500ms intervals
  // -------------------------------------------------------------------------

  const pollTail = async () => {
    while (!closed) {
      // Wait first so initial poll fires after history is delivered
      await new Promise<void>((r) => setTimeout(r, 500));
      if (closed) break;

      try {
        const s = await stat(file);
        if (s.size > lastSize) {
          const chunk = createReadStream(file, { start: lastSize });
          const rl = createInterface({ input: chunk, crlfDelay: Infinity });

          for await (const raw of rl) {
            if (closed) return;
            try {
              const parsed = JSON.parse(raw) as LogLine;
              if (filter(parsed)) opts.onLine(parsed, raw);
            } catch {
              // skip malformed
            }
          }

          lastSize = s.size;
        }
      } catch {
        // Transient stat / read errors (e.g., log rotation) — continue polling
      }
    }
  };

  // Start poll loop but don't await it — runs in background
  pollTail();

  return close;
}
