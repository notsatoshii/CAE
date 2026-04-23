/**
 * GET /api/mission-control — feed for the Mission Control hero banner at
 * the top of /build (Phase 15 Wave 3.1).
 *
 * Returns the projection produced by lib/cae-mission-control-state.ts.
 *
 * Caching: 5-second Cache-Control + matching process-level cache. Aligns
 * with the client-side 5-second poll so two tabs share one fs walk.
 *
 * Failure mode: any read error is swallowed and the route returns a
 * zero-shape body. UI then renders the per-tile empty placeholders.
 *
 * No dollar signs in this file (lint-no-dollar.sh guard).
 */

export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import {
  emptyMissionControl,
  getMissionControlState,
} from "@/lib/cae-mission-control-state"
import { log } from "@/lib/log"
import { withLog } from "@/lib/with-log"

const l = log("api.mission-control")

async function getHandler() {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })

  let body
  try {
    body = await getMissionControlState()
  } catch (err) {
    l.error(
      { err: err instanceof Error ? err.message : String(err) },
      "getMissionControlState failed",
    )
    body = emptyMissionControl()
  }

  return Response.json(body, {
    headers: {
      "Cache-Control": "private, max-age=5",
    },
  })
}

export const GET = withLog(getHandler as (req: Request) => Promise<Response>, "/api/mission-control")
