/**
 * lib/with-log.ts — App Router handler wrapper that adds:
 *   - x-correlation-id header propagation / UUID generation
 *   - AsyncLocalStorage reqCtx (reqId + route) threaded through handler
 *   - req.begin / req.end / req.end.stream-open / req.fail structured log lines
 *
 * Usage:
 *   // BEFORE
 *   export async function GET(req: Request) { ... }
 *
 *   // AFTER
 *   import { withLog } from "@/lib/with-log";
 *   async function getHandler(req: Request) { ... }
 *   export const GET = withLog(getHandler, "/api/state");
 *
 * Works with both `Request` (Web API) and `NextRequest` (Next.js) — the
 * wrapper only calls `.headers.get()`, `.method`, and `.url` which are
 * present on both types.
 *
 * SSE routes (text/event-stream responses) are detected and get a different
 * "req.end.stream-open" log entry.
 */

import { randomUUID } from "crypto";
import { log, reqCtx } from "@/lib/log";

const l = log("http");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (...args: any[]) => Promise<Response>;

/**
 * Wraps an App Router handler with structured logging + correlation ID middleware.
 *
 * @param handler - Async function (req, ...rest) => Promise<Response>
 * @param route   - Route label for log context, e.g. "/api/state"
 * @returns The same function signature, wrapped
 */
export function withLog<T extends AnyHandler>(handler: T, route: string): T {
  return (async (...args: unknown[]) => {
    // First arg is always the request object (Request or NextRequest)
    const req = args[0] as { headers: { get(name: string): string | null }; method: string; url: string };

    // Accept incoming correlation ID or generate a fresh one
    const reqId = req.headers.get("x-correlation-id") ?? randomUUID();

    return reqCtx.run({ reqId, route }, async () => {
      const start = Date.now();

      l.info({ method: req.method, url: req.url, reqId }, "req.begin");

      try {
        const res = await handler(...args);
        const ms = Date.now() - start;

        const isStream = res.headers.get("content-type")?.includes("text/event-stream");
        if (isStream) {
          l.info({ status: res.status, ms, stream: true }, "req.end.stream-open");
        } else {
          l.info({ status: res.status, ms }, "req.end");
        }

        // Propagate correlation ID to caller so client can correlate client-error POSTs
        res.headers.set("x-correlation-id", reqId);
        return res;
      } catch (err) {
        const ms = Date.now() - start;
        l.error(
          {
            err: err instanceof Error ? err.message : String(err),
            stack: (err as Error)?.stack,
            ms,
          },
          "req.fail",
        );
        throw err;
      }
    });
  }) as T;
}
