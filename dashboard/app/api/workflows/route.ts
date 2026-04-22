export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { listWorkflows, parseWorkflow, writeWorkflow } from "@/lib/cae-workflows"
import { withLog } from "@/lib/with-log"

async function getHandler() {
  const workflows = await listWorkflows()
  workflows.sort((a, b) => b.mtime - a.mtime)
  return Response.json({ workflows })
}

async function postHandler(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body || typeof (body as { yaml?: unknown }).yaml !== "string") {
    return Response.json({ error: "yaml required" }, { status: 400 })
  }
  const { spec, errors } = parseWorkflow((body as { yaml: string }).yaml)
  if (!spec || errors.length > 0) {
    return Response.json({ errors }, { status: 400 })
  }
  const record = await writeWorkflow(spec)
  return Response.json({ workflow: record }, { status: 201 })
}

export const GET = withLog(getHandler as (req: Request) => Promise<Response>, "/api/workflows")
export const POST = withLog(postHandler, "/api/workflows")
