export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { getAgentDetail } from "@/lib/cae-agents-state"
import { log } from "@/lib/log"
import { withLog } from "@/lib/with-log"

const l = log("api.agents.detail")

async function getHandler(
  _req: Request,
  context: { params: Promise<{ name: string }> },
) {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })
  const { name } = await context.params
  try {
    const detail = await getAgentDetail(name.toLowerCase())
    if (!detail) {
      return Response.json({ error: "unknown agent" }, { status: 404 })
    }
    return Response.json(detail)
  } catch (err) {
    l.error({ err, agentName: name }, "agent detail aggregator failed")
    return Response.json({ error: "aggregator_failed" }, { status: 500 })
  }
}

type NameCtx = { params: Promise<{ name: string }> }
export const GET = withLog(
  getHandler as (req: Request, ctx: NameCtx) => Promise<Response>,
  "/api/agents/[name]",
)
