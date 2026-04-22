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
import { getHomeState, type HomeState } from "@/lib/cae-home-state"
import type { CbEvent } from "@/lib/cae-types"

export async function GET(req: NextRequest) {
  const project = req.nextUrl.searchParams.get("project") ?? CAE_ROOT
  const metricsDir = join(project, ".cae", "metrics")
  const today = new Date().toISOString().slice(0, 10)

  const [
    breakers,
    phases,
    inbox,
    outbox,
    cbEntries,
    sentinelEntries,
    compactionEntries,
    approvalsEntries,
    home,
  ] = await Promise.all([
    getCircuitBreakerState(project),
    listPhases(project),
    listInbox(),
    listOutbox(),
    tailJsonl(join(metricsDir, "circuit-breakers.jsonl"), 200),
    tailJsonl(join(metricsDir, "sentinel.jsonl"), 50),
    tailJsonl(join(metricsDir, "compaction.jsonl"), 50),
    tailJsonl(join(metricsDir, "approvals.jsonl"), 50),
    getHomeState().catch((err): HomeState => {
      console.error("[/api/state] getHomeState failed:", err)
      return {
        rollup: { shipped_today: 0, tokens_today: 0, in_flight: 0, blocked: 0, warnings: 0 },
        phases: [],
        events_recent: [],
        needs_you: [],
        live_ops_line: "Idle right now.",
      }
    }),
  ])

  // Phase 7 Wave 0 (D-02): sum tokens from real snake_case jsonl schema.
  // Real schema uses `ts` (not `timestamp`), `input_tokens` / `output_tokens`
  // (not `inputTokens` / `outputTokens`). Retries are implicit in
  // `forge_end` rows with `success:false` — no standalone "retry" event.
  //
  // IMPORTANT boundary (D-02): the response fields below keep the existing
  // camelCase names (`inputTokensToday`, `outputTokensToday`, `retryCount`)
  // because consumers (cost-ticker, use-state-poll type) still read those
  // keys. Internal (jsonl) = snake_case; API envelope = camelCase.
  let inputTokensToday = 0
  let outputTokensToday = 0
  let retryCount = 0
  for (const entry of cbEntries) {
    if (typeof entry !== "object" || entry === null) continue
    const e = entry as CbEvent
    const ts = e.ts
    if (!ts?.startsWith(today)) continue
    if (typeof e.input_tokens === "number") inputTokensToday += e.input_tokens
    if (typeof e.output_tokens === "number") outputTokensToday += e.output_tokens
    if (e.event === "forge_end" && e.success === false) retryCount++
  }

  return Response.json({
    // Existing Phase 2/3 fields (backward-compat)
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
    // Phase 4 extension. Note: home.phases exposed as `home_phases` to avoid
    // shadowing the existing per-project `phases` top-level key (listPhases result).
    rollup: home.rollup,
    home_phases: home.phases,
    events_recent: home.events_recent,
    needs_you: home.needs_you,
    live_ops_line: home.live_ops_line,
  })
}
