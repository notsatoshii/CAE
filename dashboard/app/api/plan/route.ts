export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { getPlanHomeState } from "@/lib/cae-plan-home"
import { log } from "@/lib/log"
import { withLog } from "@/lib/with-log"

const l = log("api.plan")

async function getHandler() {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })
  try {
    const state = await getPlanHomeState()
    return Response.json(state)
  } catch (err) {
    l.error({ err }, "plan home aggregator failed")
    return Response.json({ projects: [], emptyState: true, mostRecentSlug: null }, { status: 500 })
  }
}

export const GET = withLog(getHandler as (req: Request) => Promise<Response>, "/api/plan")
