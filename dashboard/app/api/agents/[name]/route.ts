export const dynamic = "force-dynamic"

import { getAgentDetail } from "@/lib/cae-agents-state"

export async function GET(
  _req: Request,
  context: { params: Promise<{ name: string }> },
) {
  const { name } = await context.params
  try {
    const detail = await getAgentDetail(name.toLowerCase())
    if (!detail) {
      return Response.json({ error: "unknown agent" }, { status: 404 })
    }
    return Response.json(detail)
  } catch (err) {
    console.error("[/api/agents/" + name + "] failed:", err)
    return Response.json({ error: "aggregator_failed" }, { status: 500 })
  }
}
