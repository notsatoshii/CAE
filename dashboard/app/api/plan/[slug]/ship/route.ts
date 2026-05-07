export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { resolveProject } from "@/lib/cae-shift"
import { runCaeExecutePhase } from "@/lib/cae-ship"
import { log } from "@/lib/log"
import { withLog } from "@/lib/with-log"

const l = log("api.plan.ship")

type SlugCtx = { params: Promise<{ slug: string }> }

async function postHandler(req: NextRequest, ctx: SlugCtx) {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })
  const { slug } = await ctx.params
  const proj = await resolveProject(slug)
  if (!proj) return Response.json({ error: "project_not_found", slug }, { status: 404 })

  const body = (await req.json().catch(() => ({}))) as { phase?: unknown }
  const phaseNum = typeof body.phase === "number" ? body.phase : 1
  if (!Number.isInteger(phaseNum) || phaseNum < 1 || phaseNum > 99) {
    return Response.json({ error: "invalid_phase" }, { status: 400 })
  }

  try {
    const { sid, logFile } = await runCaeExecutePhase(proj, phaseNum)
    return Response.json({ ok: true, sid, logFile, phase: phaseNum }, { status: 202 })
  } catch (err) {
    l.error({ err, slug, phaseNum }, "cae execute-phase spawn failed")
    return Response.json({ error: "ship_spawn_failed", detail: String(err) }, { status: 500 })
  }
}

export const POST = withLog(postHandler as (req: Request, ctx: SlugCtx) => Promise<Response>, "/api/plan/[slug]/ship")
