export const dynamic = "force-dynamic"

/**
 * /build/agents — agent roster page (Phase 5 Plan 05-03).
 *
 * Server component: calls `getAgentsRoster()` directly (no self-HTTP hop
 * through `/api/agents`) and passes the result to the client `AgentGrid`.
 * The aggregator reads the filesystem, so `force-dynamic` is required.
 *
 * The `/build/*` layout wraps this with the 48px BuildRail (Plan 05-02).
 * Authentication is handled by `middleware.ts` — no guard here.
 *
 * The detail drawer is deferred to Plan 05-04; in this plan, clicking a
 * card updates `?agent={name}` URL state but nothing visible changes.
 */

import { Cpu } from "lucide-react"
import { getAgentsRoster } from "@/lib/cae-agents-state"
import { AgentGrid } from "@/components/agents/agent-grid"
import { AgentsPageHeading } from "@/components/agents/agents-page-heading"
import { AgentDetailDrawer } from "@/components/agents/agent-detail-drawer"
import { EmptyState, EmptyStateActions } from "@/components/ui/empty-state"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { labelFor } from "@/lib/copy/labels"

export const metadata = {
  title: "Agents — CAE",
}

export default async function AgentsPage() {
  let agents: Awaited<ReturnType<typeof getAgentsRoster>>["agents"] = []
  let loadError: string | null = null
  try {
    const roster = await getAgentsRoster()
    agents = roster.agents
  } catch (err) {
    console.error("[/build/agents] aggregator failed:", err)
    loadError = err instanceof Error ? err.message : "aggregator failed"
  }

  return (
    <main data-testid="agents-page" className="p-8 max-w-6xl">
      <div className="flex flex-col gap-1 mb-8">
        <AgentsPageHeading />
        <p className="text-xs text-[color:var(--text-muted,#8a8a8c)]">
          9 agents · data refreshed every 30 seconds
        </p>
      </div>
      {agents.length === 0 && !loadError ? (
        <EmptyState
          testId="agents-page-empty"
          icon={Cpu}
          heading={labelFor(false).emptyAgentsHeading}
          body={labelFor(false).emptyAgentsBody}
          actions={
            <EmptyStateActions>
              <Link href="/chat">
                <Button variant="secondary">{labelFor(false).emptyAgentsCtaJob}</Button>
              </Link>
            </EmptyStateActions>
          }
        />
      ) : (
        <AgentGrid agents={agents} loadError={loadError} />
      )}
      {/* Drawer mounts unconditionally — invisible until ?agent={name} in URL.
          Reads its own URL state; must not be gated on agents.length. */}
      <AgentDetailDrawer />
    </main>
  )
}
