"use client"

/**
 * AgentsPageHeading — tiny client island for the /build/agents h1 heading
 * that flips founder↔dev copy via `useDevMode`. Mirrors the Phase 3 pattern
 * established by `components/shell/build-home-heading.tsx` so the surrounding
 * page can stay a server component.
 */

import { useDevMode } from "@/lib/providers/dev-mode"
import { labelFor } from "@/lib/copy/labels"

export function AgentsPageHeading() {
  const { dev } = useDevMode()
  const t = labelFor(dev)
  return (
    <h1
      data-testid="agents-page-heading"
      className="text-2xl font-medium text-foreground"
    >
      {t.agentsPageHeading}
    </h1>
  )
}
