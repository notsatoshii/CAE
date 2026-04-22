"use client";

/**
 * Suggestions — route-aware chip buttons. Phase 9 Plan 05 Task 2 (CHT-05).
 *
 * Reads the current pathname and delegates to suggestionsFor() (Wave 0,
 * D-11). Renders up to 3 chips; clicking a chip calls onPick(message) which
 * ChatPanel uses to pre-fill + send.
 *
 * Returns null when the current route has no suggestions so the panel layout
 * collapses (no empty divider).
 */

import { usePathname } from "next/navigation";
import { suggestionsFor } from "@/lib/chat-suggestions";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { ExplainTooltip } from "@/components/ui/explain-tooltip";

export function Suggestions({ onPick }: { onPick: (message: string) => void }) {
  const pathname = usePathname() ?? "/";
  const items = suggestionsFor(pathname);
  const { dev } = useDevMode();
  const t = labelFor(dev);

  if (items.length === 0) return null;

  return (
    <div
      data-testid="chat-suggestions"
      className="border-t border-[color:var(--border,#1f1f22)] px-3 py-2"
    >
      <div className="flex items-center gap-1 text-xs text-[color:var(--text-muted,#8a8a8c)] mb-1">
        <span>{t.chatSuggestionsHeading}</span>
        <ExplainTooltip text={t.chatExplainSuggestions} />
      </div>
      <div className="flex flex-wrap gap-1">
        {items.slice(0, 3).map((sug) => (
          <button
            key={sug.label}
            type="button"
            onClick={() => onPick(sug.message)}
            className="text-xs px-2 py-1 rounded-full border border-[color:var(--border,#1f1f22)] hover:bg-[color:var(--surface-hover,#1a1a1d)] text-[color:var(--text-muted,#8a8a8c)]"
          >
            {sug.label}
          </button>
        ))}
      </div>
    </div>
  );
}
