import Link from "next/link";
import { BarChart3 } from "lucide-react";

// C2 fix-wave Class 7: inline "Metrics" label beside the icon. See
// memory-icon.tsx for the full rationale.
export function MetricsIcon() {
  return (
    <Link
      href="/metrics"
      aria-label="Metrics"
      data-testid="metrics-icon"
      className="inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
    >
      <BarChart3 className="size-4" aria-hidden="true" />
      <span
        data-testid="metrics-icon-label"
        className="hidden font-mono text-[11px] tracking-wide text-current md:inline"
      >
        Metrics
      </span>
    </Link>
  );
}
