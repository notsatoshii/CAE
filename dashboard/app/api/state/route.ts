export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { join } from "path"
import {
  getCircuitBreakerState,
  listInbox,
  listOutbox,
  listPhases,
  tailJsonl,
} from "@/lib/cae-state"
import { CAE_ROOT } from "@/lib/cae-config"

export async function GET(req: NextRequest) {
  const project = req.nextUrl.searchParams.get("project") ?? CAE_ROOT
  const metricsDir = join(project, ".cae", "metrics")
  const today = new Date().toISOString().slice(0, 10)

  const [breakers, phases, inbox, outbox, cbEntries, sentinelEntries, compactionEntries, approvalsEntries] =
    await Promise.all([
      getCircuitBreakerState(project),
      listPhases(project),
      listInbox(),
      listOutbox(),
      tailJsonl(join(metricsDir, "circuit-breakers.jsonl"), 200),
      tailJsonl(join(metricsDir, "sentinel.jsonl"), 50),
      tailJsonl(join(metricsDir, "compaction.jsonl"), 50),
      tailJsonl(join(metricsDir, "approvals.jsonl"), 50),
    ])

  let inputTokensToday = 0
  let outputTokensToday = 0
  let retryCount = 0
  for (const entry of cbEntries) {
    if (typeof entry !== "object" || entry === null) continue
    const e = entry as Record<string, unknown>
    const ts = e.timestamp as string | undefined
    if (!ts?.startsWith(today)) continue
    if (typeof e.inputTokens === "number") inputTokensToday += e.inputTokens
    if (typeof e.outputTokens === "number") outputTokensToday += e.outputTokens
    if (e.event === "retry") retryCount++
  }

  return Response.json({
    breakers: { ...breakers, inputTokensToday, outputTokensToday, retryCount },
    phases,
    inbox,
    outbox,
    metrics: {
      breakers: cbEntries.slice(-50),
      sentinel: sentinelEntries,
      compaction: compactionEntries,
      approvals: approvalsEntries,
    },
  })
}
