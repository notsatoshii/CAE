import Link from "next/link";
import { Brain } from "lucide-react";

/**
 * MemoryIcon — top-nav link to /memory.
 *
 * C2 fix-wave Class 7 added the inline "Memory" label to the right of the
 * icon. The top-bar is only 40px tall, so true below-icon labels would
 * require re-plumbing header height. Inline-right preserves the height
 * constraint while still surfacing copy — matches Linear's top-bar pattern.
 */
export function MemoryIcon() {
  return (
    <Link
      href="/memory"
      aria-label="Memory"
      data-testid="memory-icon"
      className="inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
    >
      <Brain className="size-4" aria-hidden="true" />
      <span
        data-testid="memory-icon-label"
        className="hidden font-mono text-[11px] tracking-wide text-current md:inline"
      >
        Memory
      </span>
    </Link>
  );
}
