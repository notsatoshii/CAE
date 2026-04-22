/**
 * lib/client-log-bus.ts — Client-side circular log buffer + CustomEvent dispatcher.
 *
 * Design:
 *   - Module-level ring buffer (max 50 entries) — in-memory, lost on page reload.
 *     That's intentional: breadcrumb panel shows what happened THIS session.
 *   - Each clientLog() call pushes to buffer AND dispatches window CustomEvent
 *     'cae:log' so the DebugBreadcrumbPanel (and any future consumer) can
 *     react without polling.
 *   - subscribe() is a convenience wrapper over addEventListener so React
 *     components can add/remove listeners without direct window access.
 *
 * Usage:
 *   import { clientLog } from "@/lib/client-log-bus";
 *   clientLog("warn", "chat", "send failed", { status: 503 });
 *
 * Server-safe: dispatching is guarded by `typeof window !== "undefined"`.
 * The module-level buffer always works (useful in SSR tests).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ClientLogLevel = "debug" | "info" | "warn" | "error";

export interface ClientLogEntry {
  time: number;
  level: ClientLogLevel;
  scope: string;
  msg: string;
  ctx?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

const CAPACITY = 50;
const BUFFER: ClientLogEntry[] = [];

// Subscribers registered via subscribe()
const SUBSCRIBERS: Array<(entry: ClientLogEntry) => void> = [];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Log an event to the client-side buffer and broadcast it.
 *
 * @param level  Severity level
 * @param scope  Dot-separated scope tag (mirrors server-side log(scope) pattern)
 * @param msg    Human-readable message
 * @param ctx    Optional structured context
 */
export function clientLog(
  level: ClientLogLevel,
  scope: string,
  msg: string,
  ctx?: Record<string, unknown>,
): void {
  const entry: ClientLogEntry = { time: Date.now(), level, scope, msg, ctx };

  // Maintain circular buffer (oldest entry dropped when over capacity)
  BUFFER.push(entry);
  if (BUFFER.length > CAPACITY) {
    BUFFER.shift();
  }

  // Notify inline subscribers (e.g., test spies, React components)
  for (const sub of SUBSCRIBERS) {
    try {
      sub(entry);
    } catch {
      // Subscriber errors must never crash the caller
    }
  }

  // Broadcast via CustomEvent for components using addEventListener
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cae:log", { detail: entry }));
  }
}

/**
 * Returns a shallow copy of the current buffer (oldest → newest).
 * Mutating the returned array does NOT affect the internal buffer.
 */
export function getBuffer(): ClientLogEntry[] {
  return [...BUFFER];
}

/**
 * Clears the buffer. Useful for testing and for future "clear breadcrumbs" UI.
 */
export function clearBuffer(): void {
  BUFFER.length = 0;
}

/**
 * Registers a callback that fires synchronously on each clientLog() call.
 * Returns an unsubscribe function.
 *
 * Prefer this over addEventListener('cae:log', ...) in tests where you need
 * synchronous assertions without async event propagation.
 */
export function subscribe(cb: (entry: ClientLogEntry) => void): () => void {
  SUBSCRIBERS.push(cb);
  return () => {
    const idx = SUBSCRIBERS.indexOf(cb);
    if (idx !== -1) SUBSCRIBERS.splice(idx, 1);
  };
}
