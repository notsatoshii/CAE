/**
 * GET /api/workflows/live — live workflow instances (Class 19D).
 *
 * Reads `.cae/metrics/activity.jsonl` + `.planning/phases/*\/state.json`,
 * reduces them into a `WorkflowInstance[]`, and serves the list with a
 * cheap content-derived ETag so the client-side 5s poll can short-circuit
 * on unchanged state.
 *
 * Why a polling route instead of SSE: the activity stream is a raw JSONL
 * tail without kernel-level watches. SSE would require either an fs-watch
 * that re-reads on change (brittle under the audit C5 hot-reload churn) or
 * a periodic server tick that redundantly broadcasts. The existing
 * /api/activity/live route settled on 5s fetch-poll + matching cache for
 * exactly this reason; we mirror that pattern.
 *
 * Caching: process-level 3s cache on getLiveInstances output + matching
 * Cache-Control. 304 short-circuit via If-None-Match.
 *
 * Failure mode: missing activity.jsonl / phases dir / malformed rows all
 * silently yield an empty list, NOT a 500. The UI renders the empty
 * branch.
 */

export const dynamic = "force-dynamic"

import type { NextRequest } from "next/server"
import { auth } from "@/auth"
import { etagFor, getLiveInstances } from "@/lib/workflows/live-instances"
import type { WorkflowInstance } from "@/lib/workflows/live-instances"
import { log } from "@/lib/log"
import { withLog } from "@/lib/with-log"

const l = log("api.workflows.live")

/** Process-level cache TTL. Keep below the 5s client poll. */
const CACHE_TTL_MS = 3_000

interface CacheEntry {
  expiresAt: number
  etag: string
  instances: WorkflowInstance[]
}

let cache: CacheEntry | null = null

/** Test hook — clear the module-level cache between tests. */
export function __resetWorkflowsLiveCache(): void {
  cache = null
}

async function getHandler(req: NextRequest): Promise<Response> {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })

  const now = Date.now()
  let instances: WorkflowInstance[]
  let etag: string

  if (cache && cache.expiresAt > now) {
    instances = cache.instances
    etag = cache.etag
  } else {
    try {
      instances = await getLiveInstances()
    } catch (err) {
      l.error(
        { err: err instanceof Error ? err.message : String(err) },
        "getLiveInstances failed",
      )
      instances = []
    }
    etag = etagFor(instances)
    cache = { expiresAt: now + CACHE_TTL_MS, etag, instances }
  }

  // If-None-Match short-circuit.
  const ifNoneMatch = req.headers.get("if-none-match")
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "private, max-age=3",
      },
    })
  }

  return Response.json(
    { instances },
    {
      headers: {
        ETag: etag,
        "Cache-Control": "private, max-age=3",
      },
    },
  )
}

export const GET = withLog(
  getHandler as (req: Request) => Promise<Response>,
  "/api/workflows/live",
)
