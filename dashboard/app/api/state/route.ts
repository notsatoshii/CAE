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
import { getActivityFeed, type ActivityFeedRow } from "@/lib/cae-activity-feed"
import type { CbEvent } from "@/lib/cae-types"
import { log } from "@/lib/log"
import { withLog } from "@/lib/with-log"

const l = log("api.state")

// Route-level response cache — getHomeState takes 30-50s on cold start.
// Cache the full response so subsequent polls (3s interval) are instant.
let _responseCache: { ts: number; body: unknown } | null = null
const RESPONSE_CACHE_TTL = 5_000 // 5s

async function getHandler(req: NextRequest) {
  // Return cached response if fresh
  if (_responseCache && Date.now() - _responseCache.ts < RESPONSE_CACHE_TTL) {
    return Response.json(_responseCache.body)
  }
  // `||` (not `??`) so an empty string from `?project=` falls back to CAE_ROOT.
  // useStatePoll always sends `?project=${encodeURIComponent("")}`, which made
  // the previous `??` operator pass through the empty string — and then
  // `join("", ".cae/metrics/...")` resolves to `/.cae/metrics/...`, a
  // nonexistent root-filesystem path. Every breaker reading got zeroed out.
  const project = req.nextUrl.searchParams.get("project") || CAE_ROOT
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
    activityFeed,
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
      l.error({ err }, "getHomeState failed")
      return {
        rollup: { shipped_today: 0, tokens_today: 0, in_flight: 0, blocked: 0, warnings: 0 },
        phases: [],
        events_recent: [],
        needs_you: [],
        live_ops_line: "Idle right now.",
      }
    }),
    // Class 15A: canonical + legacy stream union. Last 20 is plenty for the
    // /build home feed card; /api/tail/activity handles live tailing.
    getActivityFeed({ root: project }).catch((err): ActivityFeedRow[] => {
      l.error({ err }, "getActivityFeed failed")
      return []
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

  const body = {
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
    // Class 15A: canonical activity feed, last 20 rows for the build-home
    // ActivityFeed card. Consumers that need more call /api/tail/activity.
    recent_activity: activityFeed.slice(0, 20),
  }
  _responseCache = { ts: Date.now(), body }
  return Response.json(body)
}

export const GET = withLog(getHandler, "/api/state")
