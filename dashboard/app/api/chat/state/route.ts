/**
 * GET /api/chat/state — Phase 9 Plan 03 Task 3B.
 *
 * Rail-state endpoint for the ChatRailProvider. Returns current session id,
 * unread count (via `?last_seen=<msgId>` replay per D-17), last-message
 * preview, and the full sessions list. `streaming` is always false here —
 * the stream state is known only to /send; the client is the authority on
 * streaming once it opens an EventSource.
 *
 * Query params:
 *   sessionId — optional; if present, compute unread replay.
 *   last_seen — optional; last message id the client has seen.
 *
 * Response: {currentSessionId, unreadCount, streaming, lastMessagePreview, sessions}
 */
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@/auth";
import {
  validateSessionId,
  readTranscriptAfter,
  listSessions,
  ValidationError,
} from "@/lib/cae-chat-state";
import { withLog } from "@/lib/with-log";

async function getHandler(req: NextRequest) {
  const session = await auth();
  if (!session) {
    // TODO: chat.errorUnauthorized (owned by plan 09-02 Task 3)
    return new Response("unauthorized", { status: 401 });
  }

  const currentSessionId = req.nextUrl.searchParams.get("sessionId");
  const lastSeen = req.nextUrl.searchParams.get("last_seen");

  let unreadCount = 0;
  let lastMessagePreview = "";

  if (currentSessionId) {
    try {
      validateSessionId(currentSessionId);
    } catch (e) {
      if (e instanceof ValidationError) {
        // TODO: chat.errorBadSessionId
        return Response.json(
          { error: "bad sessionId" },
          { status: 400 },
        );
      }
      throw e;
    }
    const after = await readTranscriptAfter(currentSessionId, lastSeen);
    unreadCount = after.length;
    const last = after[after.length - 1];
    lastMessagePreview = last?.content.slice(0, 80) ?? "";
  }

  const sessions = await listSessions();
  return Response.json({
    currentSessionId,
    unreadCount,
    streaming: false,
    lastMessagePreview,
    sessions,
  });
}

export const GET = withLog(getHandler, "/api/chat/state");
