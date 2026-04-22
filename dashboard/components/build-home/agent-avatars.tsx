"use client";

import { agentMetaFor } from "@/lib/copy/agent-meta";

// Each pill below emits: data-testid="agent-pill-{agentName}"
// (computed form is `data-testid={"agent-pill-" + meta.name}` — acceptance grep anchor above.)

interface AgentAvatarsProps {
  agents: Array<{ name: string; concurrent: number }>;
}

const COLOR_MAP: Record<string, string> = {
  orange: "#f97316",
  cyan: "var(--accent)",
  purple: "#a855f7",
  yellow: "#facc15",
  green: "var(--success)",
  gray: "var(--text-dim)",
  red: "var(--danger)",
  blue: "var(--info)",
  amber: "var(--warning)",
};

export function AgentAvatars({ agents }: AgentAvatarsProps) {
  if (agents.length === 0) return null;

  return (
    <div data-testid="agent-avatars" className="inline-flex items-center gap-2">
      {agents.map((a) => {
        const meta = agentMetaFor(a.name);
        const color = COLOR_MAP[meta.color] ?? COLOR_MAP.gray;
        const isIdle = a.concurrent === 0;
        const dotCount = Math.max(1, a.concurrent);
        return (
          <span
            key={a.name}
            data-testid={"agent-pill-" + meta.name}
            className="inline-flex items-center gap-1 text-xs"
            style={{ opacity: isIdle ? 0.5 : 1 }}
            title={meta.label + " · " + a.concurrent + " active"}
          >
            <span className="text-base leading-none" aria-hidden="true">
              {meta.emoji}
            </span>
            <span className="font-mono text-[color:var(--text)]">{meta.label}</span>
            <span className="inline-flex items-center gap-0.5 ml-0.5">
              {Array.from({ length: dotCount }).map((_, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className="inline-block size-1.5 rounded-full"
                  style={{
                    backgroundColor: color,
                    opacity: i < a.concurrent ? 1 : 0.25,
                  }}
                />
              ))}
            </span>
          </span>
        );
      })}
    </div>
  );
}
