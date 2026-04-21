import Link from "next/link";
import { BarChart3 } from "lucide-react";

export function MetricsIcon() {
  return (
    <Link
      href="/metrics"
      aria-label="Metrics"
      title="Metrics"
      data-testid="metrics-icon"
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[color:var(--text-muted)] transition-colors hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text)]"
    >
      <BarChart3 className="size-4" aria-hidden="true" />
    </Link>
  );
}
