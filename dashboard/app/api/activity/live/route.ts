/**
 * GET /api/activity/live — feed for the Live Activity Panel above the
 * rollup-strip on /build.
 *
 * Returns a small projection of the tool-call audit JSONL (written by
 * tools/audit-hook.sh). See lib/cae-activity-state.ts for the shape +
 * bucketing algorithm.
 *
 * Caching: 5-second Cache-Control + matching process-level cache in
 * cae-activity-state. Aligns with the client-side 5-second poll so the
 * file is read at most once per cycle even with many tabs open.
 *
 * Failure mode: any read error is swallowed and the route returns a
 * zero-shape body with last_event_at=null. The UI then renders the
 * "Tip:" empty state with character (see <LiveActivityPanel />).
 */

export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { emptyActivity, getLiveActivity } from "@/lib/cae-activity-state"
import { log } from "@/lib/log"
import { withLog } from "@/lib/with-log"

const l = log("api.activity.live")

async function getHandler() {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })

  let body
  try {
    body = await getLiveActivity()
  } catch (err) {
    l.error({ err: err instanceof Error ? err.message : String(err) }, "getLiveActivity failed")
    body = emptyActivity()
  }

  return Response.json(body, {
    headers: {
      // Match the cae-activity-state cache TTL so two clients hitting at
      // 5-second cadence share the same projection without races.
      "Cache-Control": "private, max-age=5",
    },
  })
}

export const GET = withLog(getHandler as (req: Request) => Promise<Response>, "/api/activity/live")
