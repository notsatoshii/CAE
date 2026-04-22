/**
 * GET /api/incidents — SSE endpoint streaming level≥warn log lines.
 *
 * On connect:
 *   1. Emits last 50 warn+/error lines from .cae/logs/dashboard.log.jsonl (history)
 *   2. Continues tailing for new lines appended to the file
 *   3. Each line is emitted as `data: {json}\n\n`
 *
 * When client disconnects: file watcher is closed (no resource leak).
 *
 * Data flow:
 *   .cae/logs/dashboard.log.jsonl (written by pino in plan 13-05)
 *     → lib/incidents-stream.tailJsonl (filter level≥warn, history + poll)
 *       → ReadableStream SSE frames
 *         → <IncidentStream/> panel
 *
 * Security (T-13-08-01):
 *   - Requires authenticated session (await auth() at top of handler)
 *   - pino.redact (plan 13-05) removes auth/session/password before writing to file
 *   - No user query params; no path traversal risk
 *
 * Runtime: nodejs (requires AsyncLocalStorage + fs APIs; edge runtime lacks both)
 */

import path from "node:path";
import { auth } from "@/auth";
import { tailJsonl, filterLevel } from "@/lib/incidents-stream";
import { withLog } from "@/lib/with-log";

export const runtime = "nodejs";

async function handler(req: Request) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const logFile = path.resolve(process.cwd(), ".cae/logs/dashboard.log.jsonl");
  const enc = new TextEncoder();

  // Create our own AbortController to wire both the request abort and the
  // stream cancel path back to a single close() call on the file watcher.
  const abort = new AbortController();

  // When the client disconnects, req.signal fires "abort"
  req.signal.addEventListener("abort", () => abort.abort(), { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const close = await tailJsonl(logFile, {
        filter: filterLevel("warn"),
        historyLimit: 50,
        signal: abort.signal,
        onLine: (line) => {
          try {
            controller.enqueue(enc.encode(`data: ${JSON.stringify(line)}\n\n`));
          } catch {
            // controller already closed (e.g., client disconnected mid-frame)
            abort.abort();
          }
        },
        onClose: () => {
          try {
            controller.close();
          } catch {
            // Already closed — safe to ignore
          }
        },
      });

      // Ensure watcher is torn down if stream is cancelled via back-pressure
      abort.signal.addEventListener("abort", close, { once: true });
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

export const GET = withLog(handler, "/api/incidents");
