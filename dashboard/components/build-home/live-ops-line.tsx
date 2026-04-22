"use client";

import { useStatePoll } from "@/lib/hooks/use-state-poll";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";

export function LiveOpsLine() {
  const { data } = useStatePoll();
  const { dev } = useDevMode();
  const t = labelFor(dev);

  const line = data?.live_ops_line ?? "";
  const isIdle = !line || line === "Idle right now.";
  const display = isIdle ? t.liveOpsIdle : line;

  return (
    <div
      data-testid="live-ops-line"
      className="mb-4 border-y border-[color:var(--border-subtle)] bg-[color:var(--surface)]/50 px-3 py-2 flex items-center gap-2 text-xs"
    >
      <span className="text-[color:var(--text-muted)] uppercase tracking-wider">
        {t.liveOpsSectionLabel}
      </span>
      <span className="text-[color:var(--text-dim)]" aria-hidden="true">
        ·
      </span>
      <span className="font-mono text-[color:var(--text)]">{display}</span>
    </div>
  );
}
