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
 * SSE routes (text/event-stream responses) are detected and get a different
 * "req.end.stream-open" log entry — the actual stream lifecycle is not tracked
 * here (stream closes after the handler returns the Response object).
 */

import { randomUUID } from "crypto";
import { log, reqCtx } from "@/lib/log";

const l = log("http");

type AnyHandler = (req: Request, ...rest: unknown[]) => Promise<Response>;

/**
 * Wraps an App Router handler with structured logging + correlation ID middleware.
 *
 * @param handler - Async function (req: Request, ...rest) => Promise<Response>
 * @param route   - Route label for log context, e.g. "/api/state"
 * @returns The same function signature, wrapped
 */
export function withLog<T extends AnyHandler>(handler: T, route: string): T {
  return (async (req: Request, ...rest: unknown[]) => {
    // Accept incoming correlation ID or generate a fresh one
    const reqId = req.headers.get("x-correlation-id") ?? randomUUID();

    return reqCtx.run({ reqId, route }, async () => {
      const start = Date.now();

      l.info({ method: req.method, url: req.url, reqId }, "req.begin");

      try {
        const res = await handler(req, ...rest);
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
