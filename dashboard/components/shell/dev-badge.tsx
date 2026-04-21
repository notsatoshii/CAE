"use client";

import { useDevMode } from "@/lib/providers/dev-mode";

export function DevBadge() {
  const { dev } = useDevMode();
  if (!dev) return null;
  return (
    <span
      data-testid="dev-badge"
      aria-label="Dev mode enabled"
      title="Dev mode — Cmd+Shift+D to toggle"
      className="inline-flex items-center rounded-full border border-[color:var(--accent)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[color:var(--accent)]"
    >
      dev
    </span>
  );
}
