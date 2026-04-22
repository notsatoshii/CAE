"use client";

/**
 * Message — single chat bubble. Phase 9 Plan 05 Task 2.
 *
 * - role="user"    → plain text, no markdown rendering.
 * - role="assistant" → markdown via react-markdown + remark-gfm. Assistant
 *   bubbles carry an agent attribution header (founder_label in founder-speak,
 *   agent label in dev-mode).
 * - streaming=true → an animated caret renders at the tail to indicate the
 *   SSE stream is still writing into this bubble.
 *
 * Security (T-09-05-01): react-markdown sanitizes by default; no rehype-raw
 * so assistant-emitted HTML cannot reach the DOM. Matches Phase 8 precedent.
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { agentMetaFor, type AgentName } from "@/lib/copy/agent-meta";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";

export interface MessageProps {
  role: "user" | "assistant";
  content: string;
  agent?: AgentName | null;
  ts?: string;
  streaming?: boolean;
}

export function Message({ role, content, agent, ts, streaming }: MessageProps) {
  const { dev } = useDevMode();
  const t = labelFor(dev);
  const meta = agent ? agentMetaFor(agent) : null;
  const who =
    role === "user"
      ? t.chatMessageUserRole
      : t.chatMessageAgentRole(
          meta?.founder_label ?? "CAE",
          meta?.label ?? "CAE",
        );

  return (
    <div
      data-testid={`chat-msg-${role}`}
      className={
        role === "user"
          ? "flex justify-end py-1"
          : "flex items-start gap-2 py-1"
      }
    >
      {/* Assistant avatar — outside the bubble, left side */}
      {role === "assistant" && (
        <div
          aria-hidden
          className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] text-[11px]"
        >
          {meta?.emoji ?? "🤖"}
        </div>
      )}

      <div
        className={
          "flex max-w-[65ch] flex-col gap-0.5 " +
          (role === "user" ? "items-end" : "items-start")
        }
      >
        {/* Role label */}
        <span className="px-1 text-[11px] font-mono text-[color:var(--text-muted)]">
          {who}
        </span>

        {/* Bubble */}
        <div
          className={
            "rounded-lg p-3 text-[15px] text-[color:var(--text)] break-words " +
            (role === "user"
              ? "bg-[color:var(--accent)]/10 border border-[color:var(--accent)]/20"
              : "border border-[color:var(--border)] bg-[color:var(--bg-elev,var(--surface))]")
          }
        >
          {role === "assistant" ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          ) : (
            content
          )}
          {streaming ? (
            <span
              className="inline-block w-1.5 h-4 bg-[color:var(--accent,#00d4ff)] align-middle ml-1 animate-pulse motion-reduce:animate-none"
              aria-hidden
            />
          ) : null}
        </div>

        {/* Timestamp */}
        {ts ? (
          <time
            dateTime={ts}
            className="px-1 font-mono text-[11px] text-[color:var(--text-muted)]"
          >
            {new Date(ts).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        ) : null}
      </div>
    </div>
  );
}
