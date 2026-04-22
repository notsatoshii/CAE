export const dynamic = "force-dynamic"

import { getAgentsRoster } from "@/lib/cae-agents-state"

export async function GET() {
  try {
    const roster = await getAgentsRoster()
    return Response.json(roster)
  } catch (err) {
    console.error("[/api/agents] failed:", err)
    return Response.json({ agents: [] }, { status: 500 })
  }
}
