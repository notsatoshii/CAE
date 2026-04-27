"use client";

/**
 * ChatPanel — thread + input + SSE stream consumer. Phase 9 Plan 05 Task 2.
 *
 * Mounts inside the expanded rail AND at /chat (standalone=true, Wave 4).
 * Owns the chat send loop + the SSE frame parser + de-dupe by id (D-17).
 *
 * Streaming receive pattern: EventSource does NOT support POST, so we use
 * fetch() with a ReadableStream reader and hand-parse SSE frames (separated
 * by \n\n, each carrying `id:`, `event:`, `data:` lines — per the frozen
 * contract from 09-03's /api/chat/send route).
 *
 * On every frame:
 *   - If id matches rail.lastSeenMsgId, skip (reconnect de-dupe).
 *   - Otherwise: dispatch on event type (assistant.{begin,delta,end},
 *     unread_tick, rate_limited); record id via rail.setLastSeenMsgId.
 *
 * Gates on currentSessionId — creates one on mount via POST /api/chat/sessions
 * if absent; otherwise fetches /api/chat/history/<id> for seed messages.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useChatRail } from "@/lib/providers/chat-rail";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { safeUUID } from "@/lib/safe-uuid";
import { Message } from "./message";
import { Suggestions } from "./suggestions";
import { LastUpdated } from "@/components/ui/last-updated";
import type { AgentName } from "@/lib/copy/agent-meta";

interface ChatMessageUI {
  id: string;
  role: "user" | "assistant";
  content: string;
  agent?: AgentName | null;
  ts: string;
}

interface HistoryResponse {
  messages?: ChatMessageUI[];
  meta?: { agent?: AgentName; session_id?: string; created_at?: string };
}

interface SessionsPostResponse {
  sessionId?: string;
  agent?: AgentName;
}

export function ChatPanel({ standalone = false }: { standalone?: boolean } = {}) {
  const rail = useChatRail();
  const { dev } = useDevMode();
  const t = labelFor(dev);
  const pathname = usePathname() ?? "/";

  const [messages, setMessages] = useState<ChatMessageUI[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [rateLimitUntil, setRateLimitUntil] = useState<number>(0);
  const [currentAgent, setCurrentAgent] = useState<AgentName>("nexus");
  const [initError, setInitError] = useState<string | null>(null);
  // SSE health: tracks when the last delta was received from /api/chat/send stream
  const [lastMsgAt, setLastMsgAt] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Force a re-render every second while rate-limited so the countdown decrements.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (rateLimitUntil === 0) return;
    const id = window.setInterval(() => forceTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [rateLimitUntil]);

  // On mount: pick or create a session, then seed history.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let id = rail.currentSessionId;
        if (!id) {
          const res = await fetch("/api/chat/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agent: "nexus" }),
          });
          if (!res.ok) throw new Error("sessions-post " + res.status);
          const j = (await res.json()) as SessionsPostResponse;
          if (!j.sessionId) throw new Error("sessions-post missing id");
          id = j.sessionId;
          if (j.agent) setCurrentAgent(j.agent);
          if (!alive) return;
          rail.setCurrentSession(id);
        }
        const hres = await fetch("/api/chat/history/" + encodeURIComponent(id));
        if (!hres.ok) throw new Error("history " + hres.status);
        const h = (await hres.json()) as HistoryResponse;
        if (!alive) return;
        if (h.messages) setMessages(h.messages);
        if (h.meta?.agent) setCurrentAgent(h.meta.agent);
      } catch (err) {
        if (!alive) return;
        setInitError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      alive = false;
    };
    // Only run on mount; rail.currentSessionId changes from elsewhere shouldn't
    // re-seed the thread (session-picker handling would live separately).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  // Cancel in-flight stream on unmount.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (sending) return;
      if (Date.now() < rateLimitUntil) return;
      const sessionId = rail.currentSessionId;
      if (!sessionId) return;

      setSending(true);
      rail.setStreaming(true);
      setDraft("");

      const userMsg: ChatMessageUI = {
        id: safeUUID(),
        role: "user",
        content: trimmed,
        ts: new Date().toISOString(),
      };
      const assistantDraft: ChatMessageUI = {
        id: safeUUID(),
        role: "assistant",
        content: "",
        agent: currentAgent,
        ts: new Date().toISOString(),
      };
      setMessages((ms) => [...ms, userMsg, assistantDraft]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/chat/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            message: trimmed,
            route: pathname,
            on_route: pathname,
          }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error("send " + res.status);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        // SSE frames are separated by blank lines (\n\n). Within a frame,
        // lines start with "id: ", "event: ", or "data: ".
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf("\n\n")) >= 0) {
            const frame = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const lines = frame.split("\n");
            let id: string | null = null;
            let event: string | null = null;
            let data: string | null = null;
            for (const l of lines) {
              if (l.startsWith("id: ")) id = l.slice(4);
              else if (l.startsWith("event: ")) event = l.slice(7);
              else if (l.startsWith("data: ")) data = l.slice(6);
            }
            if (!event) continue;
            // D-17 de-dupe: skip if id matches the last seen id (duplicate
            // from browser-level EventSource-style reconnect).
            if (id && rail.lastSeenMsgId && id === rail.lastSeenMsgId) {
              continue;
            }
            // WR-01 fix (plan 13-04): only promote lastSeenMsgId on frames
            // with a non-empty id. Delta and tick frames carry id="" (no `id:`
            // line in the SSE frame) so `id` is null here — we must not
            // promote those ephemeral frames. Only assistant.begin and
            // assistant.end carry the stable assistantMsgId. We promote on
            // assistant.end so the cursor lands after the full message is
            // written, matching what readTranscriptAfter() sees in the jsonl.
            if (id && event === "assistant.end") rail.setLastSeenMsgId(id);
            let obj: Record<string, unknown> = {};
            if (data) {
              try {
                obj = JSON.parse(data);
              } catch {
                // Skip malformed frames.
                continue;
              }
            }
            if (event === "assistant.begin") {
              if (typeof obj.agent === "string") {
                setCurrentAgent(obj.agent as AgentName);
              }
            } else if (event === "assistant.delta") {
              const deltaText = typeof obj.delta === "string" ? obj.delta : "";
              setMessages((ms) => {
                const last = ms[ms.length - 1];
                if (!last || last.role !== "assistant") return ms;
                return [
                  ...ms.slice(0, -1),
                  { ...last, content: last.content + deltaText },
                ];
              });
              // Track last SSE frame time for the health indicator
              setLastMsgAt(Date.now());
              // D-09: bump the rail's unread counter on every delta, with
              // auto-expand (debounced 500ms) if the user didn't just close.
              rail.bumpUnread({ autoExpand: true });
            } else if (event === "assistant.end") {
              const final = typeof obj.final === "string" ? obj.final : null;
              setMessages((ms) => {
                const last = ms[ms.length - 1];
                if (!last || last.role !== "assistant") return ms;
                return [
                  ...ms.slice(0, -1),
                  { ...last, content: final ?? last.content },
                ];
              });
            } else if (event === "rate_limited") {
              const sec =
                typeof obj.retry_after_sec === "number"
                  ? obj.retry_after_sec
                  : 30;
              setRateLimitUntil(Date.now() + sec * 1000);
            } else if (event === "unread_tick") {
              rail.bumpUnread();
            }
          }
        }
      } catch (err) {
        // Abort + network errors surface by leaving the draft bubble in place.
        // Rate-limit path already set the banner.
        if (err instanceof Error && err.name === "AbortError") {
          // expected on unmount
        }
      } finally {
        setSending(false);
        rail.setStreaming(false);
        abortRef.current = null;
      }
    },
    [sending, rateLimitUntil, rail, pathname, currentAgent],
  );

  const rateLimitSecs =
    rateLimitUntil > Date.now()
      ? Math.ceil((rateLimitUntil - Date.now()) / 1000)
      : 0;

  // C2-wave/Class 3: liveness state for chat panel.
  //  - initError          → error
  //  - no session yet     → loading
  //  - 0 messages         → empty
  //  - lastMsgAt > 60s    → stale
  //  - else               → healthy
  const chatLiveness: "loading" | "error" | "empty" | "stale" | "healthy" =
    initError
      ? "error"
      : messages.length === 0
        ? "empty"
        : lastMsgAt !== null && Date.now() - lastMsgAt > 60_000
          ? "stale"
          : "healthy";

  return (
    <div
      data-testid="chat-panel"
      data-liveness={chatLiveness}
      className={
        standalone
          ? "flex flex-col h-full max-w-[800px] mx-auto"
          : "flex flex-col h-full"
      }
    >
      <span className="sr-only" data-truth={`chat-panel.${chatLiveness}`}>yes</span>
      {/* SSE stream health — shows when last delta was received */}
      {lastMsgAt !== null && (
        <div className="flex justify-end px-3 py-1 border-b border-[color:var(--border,#1f1f22)]">
          <LastUpdated at={lastMsgAt} threshold_ms={30000} />
        </div>
      )}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-1"
      >
        {initError ? (
          <p className="text-sm text-[color:var(--warning,#f59e0b)]">
            {t.chatFailedToLoad}
          </p>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-[15px] font-medium text-[color:var(--text-muted)]">
              {t.chatEmptyThread}
            </p>
            <p className="text-[13px] text-[color:var(--text-muted)] opacity-70">
              Type a message below to get started.
            </p>
          </div>
        ) : (
          messages.map((m, idx) => (
            <Message
              key={m.id}
              role={m.role}
              content={m.content}
              agent={m.agent ?? null}
              ts={m.ts}
              streaming={
                sending &&
                idx === messages.length - 1 &&
                m.role === "assistant"
              }
            />
          ))
        )}
      </div>
      {rateLimitSecs > 0 ? (
        <p
          data-testid="chat-rate-banner"
          className="px-3 py-1 text-xs text-[color:var(--warning,#f59e0b)] border-t border-[color:var(--border,#1f1f22)]"
        >
          {t.chatRateLimited(rateLimitSecs)}
        </p>
      ) : null}
      <Suggestions onPick={(msg) => void send(msg)} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
        className="flex gap-2 px-3 py-2 border-t border-[color:var(--border,#1f1f22)]"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
          disabled={sending || rateLimitSecs > 0}
          placeholder={t.chatInputPlaceholder}
          rows={2}
          aria-label={t.chatInputPlaceholder}
          className="flex-1 resize-none text-[15px] bg-transparent border border-[color:var(--border,#1f1f22)] rounded p-2 text-[color:var(--text,#e5e5e5)] placeholder:text-[color:var(--text-muted)] disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim() || rateLimitSecs > 0}
          className="text-sm px-3 py-1 rounded bg-[color:var(--accent,#00d4ff)] text-black disabled:opacity-50"
        >
          {sending ? t.chatSendButtonPending : t.chatSendButton}
        </button>
      </form>
    </div>
  );
}
