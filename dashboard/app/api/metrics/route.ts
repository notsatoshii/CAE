export const dynamic = "force-dynamic"

import { getMetricsState } from "@/lib/cae-metrics-state"
import { log } from "@/lib/log"
import { withLog } from "@/lib/with-log"

const l = log("api.metrics")

/**
 * GET /api/metrics — aggregator endpoint for the Phase 7 /metrics page.
 *
 * Delegates to `getMetricsState()` which walks `.cae/metrics/*.jsonl` across
 * all projects (D-03). 500-path returns the FULL MetricsState shape with
 * zeros + a top-level `error` field so the UI never has to branch between
 * error and success shapes. Middleware handles auth (Phase 3 pattern).
 */
async function getHandler() {
  try {
    const state = await getMetricsState()
    return Response.json(state)
  } catch (err) {
    l.error({ err }, "aggregator failed")
    return Response.json(
      {
        error: "aggregator_failed",
        generated_at: new Date().toISOString(),
        spending: {
          tokens_today: 0,
          tokens_mtd: 0,
          tokens_projected_monthly: 0,
          by_agent_30d: [],
          daily_30d: [],
          top_expensive: [],
        },
        reliability: {
          per_agent_7d: [],
          retry_heatmap: [],
          halt_events: [],
          sentinel_rejects_30d: [],
        },
        speed: {
          per_agent_wall: [],
          queue_depth_now: 0,
          time_to_merge_bins: [],
        },
      },
      { status: 500 },
    )
  }
}

export const GET = withLog(getHandler as (req: Request) => Promise<Response>, "/api/metrics")
