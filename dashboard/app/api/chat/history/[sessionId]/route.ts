/**
 * GET /api/chat/history/[sessionId] — Phase 9 Plan 03 Task 3C.
 *
 * Returns the full transcript + meta for one chat session. Used by the
 * Wave 2 UI on first mount of the chat panel to populate the thread.
 *
 * Response: {messages: ChatMessage[], meta: SessionMeta | null}
 *
 * Security (threat T-09-03-02): sessionId is pulled from the URL param,
 * regex-validated via validateSessionId BEFORE any fs call. A traversal
 * attempt like `../../etc/passwd` rejects at 400.
 */
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@/auth";
import {
  validateSessionId,
  readTranscript,
  getSessionMeta,
  ValidationError,
} from "@/lib/cae-chat-state";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> },
) {
  const session = await auth();
  if (!session) {
    // TODO: chat.errorUnauthorized (owned by plan 09-02 Task 3)
    return new Response("unauthorized", { status: 401 });
  }

  const { sessionId } = await ctx.params;
  try {
    validateSessionId(sessionId);
  } catch (e) {
    if (e instanceof ValidationError) {
      // TODO: chat.errorBadSessionId
      return Response.json({ error: "bad sessionId" }, { status: 400 });
    }
    throw e;
  }

  const [messages, meta] = await Promise.all([
    readTranscript(sessionId),
    getSessionMeta(sessionId),
  ]);
  return Response.json({ messages, meta });
}
