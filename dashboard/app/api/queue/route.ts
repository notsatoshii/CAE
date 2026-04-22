export const dynamic = "force-dynamic"

import { getQueueState } from "@/lib/cae-queue-state"

export async function GET() {
  try {
    const state = await getQueueState()
    return Response.json(state)
  } catch (err) {
    console.error("[/api/queue] failed:", err)
    return Response.json({ error: "queue_state_failed" }, { status: 500 })
  }
}
