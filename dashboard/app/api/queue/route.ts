export const dynamic = "force-dynamic"

import { getQueueState } from "@/lib/cae-queue-state"
import { log } from "@/lib/log"
import { withLog } from "@/lib/with-log"

const l = log("api.queue")

async function getHandler() {
  try {
    const state = await getQueueState()
    return Response.json(state)
  } catch (err) {
    l.error({ err }, "queue state aggregator failed")
    return Response.json({ error: "queue_state_failed" }, { status: 500 })
  }
}

export const GET = withLog(getHandler as (req: Request) => Promise<Response>, "/api/queue")
