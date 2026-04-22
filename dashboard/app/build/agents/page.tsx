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

import { getAgentsRoster } from "@/lib/cae-agents-state"
import { AgentGrid } from "@/components/agents/agent-grid"
import { AgentsPageHeading } from "@/components/agents/agents-page-heading"

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
    <main data-testid="agents-page" className="p-6 max-w-6xl">
      <div className="mb-6">
        <AgentsPageHeading />
        <p className="text-xs text-[color:var(--text-muted,#8a8a8c)] mt-1">
          9 agents · data refreshed every 30 seconds
        </p>
      </div>
      {agents.length === 0 && !loadError ? (
        <div
          data-testid="agents-page-empty"
          className="rounded-lg border border-[color:var(--border,#1f1f22)] bg-[color:var(--surface,#121214)] p-8 text-sm text-[color:var(--text-muted,#8a8a8c)]"
        >
          No agent activity yet. Once CAE runs a task, stats start flowing in.
        </div>
      ) : (
        <AgentGrid agents={agents} loadError={loadError} />
      )}
    </main>
  )
}
