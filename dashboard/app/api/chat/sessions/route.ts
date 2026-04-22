/**
 * /api/chat/sessions — Phase 9 Plan 03 Task 3D.
 *
 * GET  — list all sessions (newest by mtime first). Used by the /chat
 *        standalone page session picker and by the Wave 2 rail provider's
 *        "switch conversation" control.
 * POST — create a new session jsonl with a meta first line. Body may
 *        include `{agent: AgentName}` to pick the initial persona; defaults
 *        to "nexus" if absent or invalid.
 *
 * Response (GET):  {sessions: SessionSummary[]}
 * Response (POST): {sessionId, agent}
 */
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { listSessions, getOrCreateSession } from "@/lib/cae-chat-state";
import type { AgentName } from "@/lib/copy/agent-meta";

const VALID_AGENTS: readonly AgentName[] = [
  "nexus",
  "forge",
  "sentinel",
  "scout",
  "scribe",
  "phantom",
  "aegis",
  "arch",
  "herald",
];

function isAgentName(x: unknown): x is AgentName {
  return typeof x === "string" && (VALID_AGENTS as readonly string[]).includes(x);
}

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) {
    // TODO: chat.errorUnauthorized (owned by plan 09-02 Task 3)
    return new Response("unauthorized", { status: 401 });
  }
  const sessions = await listSessions();
  return Response.json({ sessions });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    // TODO: chat.errorUnauthorized
    return new Response("unauthorized", { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const candidate = (body as Record<string, unknown>).agent;
  const agent: AgentName = isAgentName(candidate) ? candidate : "nexus";
  const id = await getOrCreateSession(agent);
  return Response.json({ sessionId: id, agent });
}
