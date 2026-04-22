"use client";

import { useCommandPalette } from "@/lib/hooks/use-command-palette";
import { cn } from "@/lib/utils";

/**
 * Optional top-nav button that opens the command palette.
 * Not mounted in this plan — Plan 12-04 mounts it.
 * Shows "⌘K" on mac, "Ctrl+K" on other platforms.
 */
export function PaletteTrigger() {
  const { toggle } = useCommandPalette();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Open command palette"
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-1",
        "text-xs text-muted-foreground",
        "border border-border bg-background",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-2 focus-visible:outline-ring",
      )}
    >
      <span>Search</span>
      <span className="flex items-center gap-0.5">
        <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
          ⌘
        </kbd>
        <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">
          K
        </kbd>
      </span>
    </button>
  );
}
