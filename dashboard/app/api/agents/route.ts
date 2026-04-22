export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { getAgentsRoster } from "@/lib/cae-agents-state"
import { log } from "@/lib/log"
import { withLog } from "@/lib/with-log"

const l = log("api.agents")

async function getHandler() {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })
  try {
    const roster = await getAgentsRoster()
    return Response.json(roster)
  } catch (err) {
    l.error({ err }, "roster aggregator failed")
    return Response.json({ agents: [] }, { status: 500 })
  }
}

export const GET = withLog(getHandler as (req: Request) => Promise<Response>, "/api/agents")
