/**
 * POST /api/telemetry/client-error
 *
 * Receives client-side error reports from window.onerror, window.onunhandledrejection,
 * and React error boundaries, and logs them via pino so they appear in the server-side
 * structured log stream (.cae/logs/dashboard.log.jsonl).
 *
 * This is the bridge between browser-land errors and the server-side Incident Stream
 * (plan 13-08). The client cannot write to the server log directly — it POSTs here instead.
 *
 * Trust boundary (T-13-05-03): body is untrusted client JSON. We:
 *   - Parse body with .catch(() => ({})) to handle malformed JSON
 *   - Only extract known string fields (message, stack, url, userAgent, componentStack)
 *   - pino redact paths cover auth-shaped values that might appear in message/stack
 *   - No size limit beyond Next.js default 1MB bodyParser limit (single-user app)
 *   - No auth required (window.onerror fires before auth check; single-user)
 */
import { NextResponse } from "next/server";
import { log } from "@/lib/log";
import { withLog } from "@/lib/with-log";

async function postHandler(req: Request) {
  const body = await req.json().catch(() => ({})) as {
    message?: string;
    stack?: string;
    url?: string;
    userAgent?: string;
    componentStack?: string;
  };

  log("client.error").error({
    clientMsg: body.message ?? "(no message)",
    stack: body.stack,
    clientUrl: body.url,
    userAgent: body.userAgent,
    componentStack: body.componentStack,
  }, "client.error.reported");

  return NextResponse.json({ ok: true });
}

export const POST = withLog(postHandler, "/api/telemetry/client-error");
