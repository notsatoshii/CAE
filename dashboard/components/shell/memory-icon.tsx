import Link from "next/link";
import { Brain } from "lucide-react";

export function MemoryIcon() {
  return (
    <Link
      href="/memory"
      aria-label="Memory"
      title="Memory"
      data-testid="memory-icon"
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
    >
      <Brain className="size-4" aria-hidden="true" />
    </Link>
  );
}
