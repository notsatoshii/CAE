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
          ? "py-2"
          : "py-2 border-l-2 pl-3 border-[color:var(--accent-muted,#00d4ff20)]"
      }
    >
      <div className="text-xs font-mono text-[color:var(--text-dim,#5a5a5c)] mb-0.5 flex items-center gap-1">
        {meta ? <span aria-hidden>{meta.emoji}</span> : null}
        <span>{who}</span>
        {ts ? (
          <time
            dateTime={ts}
            className="ml-1 text-[color:var(--text-dim,#5a5a5c)]"
          >
            {new Date(ts).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        ) : null}
      </div>
      <div className="text-sm text-[color:var(--text,#e5e5e5)] whitespace-pre-wrap break-words">
        {role === "assistant" ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        ) : (
          content
        )}
        {streaming ? (
          <span
            className="inline-block w-1.5 h-4 bg-[color:var(--accent,#00d4ff)] align-middle ml-1 animate-pulse"
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}
