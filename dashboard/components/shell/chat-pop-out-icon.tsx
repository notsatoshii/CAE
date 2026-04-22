"use client";

/**
 * ChatPopOutIcon — top-nav link to /chat (CHT-04, Wave 4, Plan 09-07).
 *
 * Matches the styling pattern of MemoryIcon + MetricsIcon (7x7 rounded
 * hover target, size-4 lucide icon). Wraps with ExplainTooltip for
 * Explain-mode support (D-15). Honors useDevMode() + labelFor() (D-14).
 *
 * No $ in this file (D-13 / lint-no-dollar.sh).
 */

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { ExplainTooltip } from "@/components/ui/explain-tooltip";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";

export function ChatPopOutIcon() {
  const { dev } = useDevMode();
  const t = labelFor(dev);
  return (
    <div className="flex items-center gap-1">
      <Link
        href="/chat"
        aria-label={t.chatRailExpandedTitle}
        data-testid="chat-pop-out-icon"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
      >
        <MessageSquare className="size-4" aria-hidden="true" />
      </Link>
      <ExplainTooltip text={t.chatExplainRail} />
    </div>
  );
}
