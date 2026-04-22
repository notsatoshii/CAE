/**
 * POST /api/chat/send — Phase 9 Plan 03 Task 3A.
 *
 * Accepts a user message, picks the persona (explicit @agent override →
 * session meta → voice-router default per D-05), persists the user message,
 * spawns `claude --print --resume`, parses stream-json stdout line-by-line,
 * and re-frames each text delta as an SSE `assistant.delta` event. On stream
 * close, persists the full assistant message and emits `assistant.end`.
 *
 * SSE frame schema (WR-01 fix, plan 13-04 — stable id contract):
 *   event: assistant.begin  id: <assistantMsgId>  data: {sessionId, agent, model}
 *   event: assistant.delta  id: (empty)            data: {delta: "text"}
 *   event: unread_tick      id: (empty)            data: {unread: 1}   // when on_route != /chat
 *   event: assistant.end    id: <assistantMsgId>  data: {msg_id, final, tokens}
 *   event: rate_limited     id: (empty)            data: {retry_after_sec: 30}
 *
 * id contract: non-empty id iff the frame corresponds to a persisted message
 * id the client can promote to lastSeenMsgId. Ephemeral frames (deltas, ticks)
 * carry id="" so the browser does not advance its internal lastEventId cursor.
 * See lib/sse.ts for the encodeSSE contract and WR-01 rationale.
 * See app/api/chat/send/route.test.ts for the contract tests.
 *
 * Security: auth() on every request (T-09-03-01). sessionId regex-validated
 * before any fs/subprocess call (T-09-03-02, gotcha #3). Message length cap
 * 4000 (T-09-03-05). Agent override parsed by whitelisted regex only — no
 * string-templating into CLI args (T-09-03-06).
 *
 * NOTE on error copy: user-facing error bodies below are hardcoded English.
 * The `chat.*` labels are owned by plan 09-02 Task 3 (Wave 1 disjoint-file
 * rule); once those ship, a future plan can wire labelFor() into these
 * response bodies. Expected label keys referenced inline as TODO markers.
 */
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { join } from "path";
import { auth } from "@/auth";
import { CAE_ROOT } from "@/lib/cae-config";
import {
  validateSessionId,
  appendMessage,
  getSessionMeta,
  setSessionMeta,
  ValidationError,
} from "@/lib/cae-chat-state";
import { encodeSSE } from "@/lib/sse";
import { pickPersona, modelForAgent } from "@/lib/voice-router";
import { spawnClaudeChat } from "@/lib/chat-spawn";
import type { AgentName } from "@/lib/copy/agent-meta";
import { withLog } from "@/lib/with-log";

const MAX_MESSAGE_LEN = 4000;

// Whitelist of override agent names — matches the nine personas in
// lib/copy/agent-meta.ts. Anchored to the start of the user message after
// .trimStart() with a trailing word-boundary so `@nexustest` does NOT match
// (gotcha #6: @agent must be first token only).
const OVERRIDE_RE =
  /^@(nexus|forge|sentinel|scout|scribe|phantom|aegis|arch|herald)\b/i;


async function postHandler(req: NextRequest) {
  const session = await auth();
  if (!session) {
    // TODO: chat.errorUnauthorized (owned by plan 09-02 Task 3)
    return new Response("unauthorized", { status: 401 });
  }

  let body: {
    sessionId?: unknown;
    message?: unknown;
    route?: unknown;
    on_route?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    // TODO: chat.errorBadRequest
    return Response.json({ error: "bad json" }, { status: 400 });
  }

  const sessionId = body.sessionId;
  const message = body.message;
  const route = typeof body.route === "string" ? body.route : "/";
  const onRoute =
    typeof body.on_route === "string" ? body.on_route : route;

  if (typeof message !== "string" || !message) {
    // TODO: chat.errorMissingFields
    return Response.json({ error: "missing fields" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LEN) {
    // TODO: chat.errorTooLong
    return Response.json({ error: "too long" }, { status: 400 });
  }
  try {
    validateSessionId(sessionId);
  } catch (e) {
    if (e instanceof ValidationError) {
      // TODO: chat.errorBadSessionId
      return Response.json({ error: "bad sessionId" }, { status: 400 });
    }
    throw e;
  }
  // After validateSessionId, sessionId is a string.
  const sid = sessionId as string;

  // Persona resolution order (09-CONTEXT D-05 + gotcha #9):
  //   1. Explicit @agent first-token override in the user's message
  //   2. Previously-stored session meta (persona sticks across turns)
  //   3. Voice router default (pickPersona by route + message)
  const meta = await getSessionMeta(sid);
  const trimmed = message.trimStart();
  const overrideMatch = trimmed.match(OVERRIDE_RE);
  const overrideAgent: AgentName | null = overrideMatch
    ? (overrideMatch[1].toLowerCase() as AgentName)
    : null;

  const agent: AgentName =
    overrideAgent ?? meta?.agent ?? pickPersona({ route, message });
  const model = modelForAgent(agent);
  const voiceFile = join(
    CAE_ROOT,
    "dashboard",
    "docs",
    "voices",
    `${agent}.md`,
  );

  // Persist the persona decision so the NEXT turn reads the same agent by
  // default (gotcha #9: --append-system-prompt-file stability across resume).
  if (overrideAgent && meta && overrideAgent !== meta.agent) {
    await setSessionMeta(sid, { ...meta, agent: overrideAgent });
  } else if (!meta) {
    // Session created elsewhere without a meta line, or a race.
    await setSessionMeta(sid, {
      session_id: sid,
      agent,
      created_at: new Date().toISOString(),
    });
  }

  // Persist the user turn to the transcript before spawning claude so a
  // subprocess crash doesn't lose the user's text.
  const userMsgId = randomUUID();
  await appendMessage(sid, {
    id: userMsgId,
    ts: new Date().toISOString(),
    role: "user",
    content: message,
    route,
  });

  // Spawn claude and stream stdout as SSE.
  const handle = spawnClaudeChat({
    sessionId: sid,
    voiceFile,
    model,
    messageText: message,
    cwd: CAE_ROOT,
  });

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(sc) {
      // WR-01 fix (plan 13-04): ONE id for the entire assistant response,
      // generated upfront and reused on both assistant.begin and assistant.end.
      // Delta and tick frames carry id="" so the browser does not advance its
      // internal lastEventId on ephemeral frames. See lib/sse.ts for contract.
      const assistantMsgId = randomUUID();

      sc.enqueue(
        enc.encode(
          encodeSSE(assistantMsgId, "assistant.begin", {
            sessionId: sid,
            agent,
            model,
          }),
        ),
      );

      let finalText = "";
      let inTokens = 0;
      let outTokens = 0;
      let rateLimited = false;
      let buffer = "";

      // Parse newline-delimited stream-json and re-frame deltas as SSE.
      handle.stdout.on("data", (chunk: Buffer) => {
        buffer += chunk.toString("utf8");
        let idx: number;
        while ((idx = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (!line.trim()) continue;
          let obj: Record<string, unknown>;
          try {
            obj = JSON.parse(line);
          } catch {
            continue; // skip non-JSON lines (CLI banners, etc.)
          }
          // Text deltas from stream_event.content_block_delta.
          if (
            obj.type === "stream_event" &&
            typeof obj.event === "object" &&
            obj.event !== null
          ) {
            const ev = obj.event as Record<string, unknown>;
            if (ev.type === "content_block_delta") {
              const delta = ev.delta as
                | { type?: string; text?: string }
                | undefined;
              const text =
                delta && typeof delta.text === "string" ? delta.text : "";
              if (text) {
                finalText += text;
                // Ephemeral frame — id="" so client does not promote lastSeenMsgId.
                sc.enqueue(
                  enc.encode(
                    encodeSSE("", "assistant.delta", {
                      delta: text,
                    }),
                  ),
                );
                // Unread tick when user is not on /chat (D-09).
                // Also ephemeral — id="".
                if (onRoute !== "/chat") {
                  sc.enqueue(
                    enc.encode(
                      encodeSSE("", "unread_tick", { unread: 1 }),
                    ),
                  );
                }
              }
            }
          } else if (obj.type === "result") {
            const usage = obj.usage as
              | { input_tokens?: number; output_tokens?: number }
              | undefined;
            if (usage) {
              inTokens =
                typeof usage.input_tokens === "number"
                  ? usage.input_tokens
                  : 0;
              outTokens =
                typeof usage.output_tokens === "number"
                  ? usage.output_tokens
                  : 0;
            }
          }
        }
      });

      // Watch stderr for claude rate-limit messages (gotcha #12).
      let stderrBuf = "";
      handle.stderr.on("data", (chunk: Buffer) => {
        stderrBuf += chunk.toString("utf8");
        if (
          /rate.?limit/i.test(stderrBuf) ||
          /usage.?limit/i.test(stderrBuf)
        ) {
          rateLimited = true;
        }
      });

      const code = await handle.wait();
      if (rateLimited || code !== 0) {
        // Rate-limited frame is also ephemeral — no persisted id.
        sc.enqueue(
          enc.encode(
            encodeSSE("", "rate_limited", {
              retry_after_sec: 30,
            }),
          ),
        );
        sc.close();
        return;
      }

      // Persist the assistant turn using assistantMsgId — the SAME id already
      // emitted on assistant.begin. This ensures readTranscriptAfter(sid, id)
      // finds the persisted record when the client sends lastSeenMsgId back.
      await appendMessage(sid, {
        id: assistantMsgId,
        ts: new Date().toISOString(),
        role: "assistant",
        content: finalText,
        agent,
        tokens: { in: inTokens, out: outTokens },
      });

      // assistant.end carries the stable id again so the client's D-17 de-dupe
      // and lastSeenMsgId promotion land on the same persisted record.
      sc.enqueue(
        enc.encode(
          encodeSSE(assistantMsgId, "assistant.end", {
            msg_id: assistantMsgId,
            final: finalText,
            tokens: { in: inTokens, out: outTokens },
          }),
        ),
      );
      sc.close();
    },
    cancel() {
      handle.kill();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export const POST = withLog(postHandler, "/api/chat/send");
