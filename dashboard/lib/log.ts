/**
 * lib/log.ts — pino structured logger with AsyncLocalStorage correlation IDs.
 *
 * Usage (server-side only — never import in client components):
 *   import { log, reqCtx } from "@/lib/log";
 *
 *   // In a route handler (wrapped with withLog):
 *   log("agent.run").info({ agentId }, "agent started");
 *   log("chat.send").error({ err }, "stream failed");
 *
 *   // In lib/cae-*.ts aggregators:
 *   const l = log("cae-agents-state");
 *   l.warn({ path }, "file missing");
 */

import pino from "pino";
import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs";
import path from "node:path";

/** Context stored per-request via AsyncLocalStorage. Merged into every log line. */
export type ReqCtx = { reqId: string; route?: string; userId?: string };

/** AsyncLocalStorage that threads correlation IDs through all async operations in a request. */
export const reqCtx = new AsyncLocalStorage<ReqCtx>();

// ---------------------------------------------------------------------------
// Log file destination
// ---------------------------------------------------------------------------

const LOG_DIR = path.resolve(process.cwd(), ".cae/logs");
try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch {
  // Best-effort; stdout fallback below
}
const LOG_FILE = path.join(LOG_DIR, "dashboard.log.jsonl");

const streams: pino.StreamEntry[] = [{ stream: process.stdout }];

// Only write to file in Node runtime (not edge); guard with typeof window for test compat
if (typeof window === "undefined" && process.env.NEXT_RUNTIME !== "edge") {
  try {
    streams.push({
      stream: pino.destination({ dest: LOG_FILE, sync: false, mkdir: true }),
    });
  } catch {
    // Fallback to stdout-only if file open fails (e.g., read-only FS in CI)
  }
}

// ---------------------------------------------------------------------------
// Redact paths — covers authorization, cookies, and session tokens at any depth
// ---------------------------------------------------------------------------

const REDACT_PATHS = [
  "*.authorization",
  "*.cookie",
  "*.session-token",
  "*.password",
  "*.headers.authorization",
  "*.headers.cookie",
  "*.authjs\\.session-token",
  "*.*.authorization",
  "*.*.cookie",
];

// ---------------------------------------------------------------------------
// Base pino instance
// ---------------------------------------------------------------------------

const base = pino(
  {
    level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
    // Emit level as a string label (e.g. "info") instead of pino's numeric 30
    formatters: {
      level: (label) => ({ level: label }),
    },
    // Merge the AsyncLocalStorage store into every log line (empty object if outside a request)
    mixin: () => (reqCtx.getStore() ?? {}) as Record<string, unknown>,
    // Serialize Error objects with message + stack
    serializers: {
      err: pino.stdSerializers.err,
    },
    redact: {
      paths: REDACT_PATHS,
      censor: "[redacted]",
    },
  },
  pino.multistream(streams),
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns a scoped child logger.
 * @param scope Dot-separated scope tag, e.g. "agent.run", "chat.send", "http"
 *
 * Each child inherits the base logger's config (level, redact, mixin).
 * The `scope` field appears in every emitted JSON line.
 */
export function log(scope = "app") {
  return base.child({ scope });
}
