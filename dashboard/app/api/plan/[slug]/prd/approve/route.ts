export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { resolveProject, approvePrdGate } from "@/lib/cae-shift"
import { log } from "@/lib/log"
import { withLog } from "@/lib/with-log"

const l = log("api.plan.prd.approve")

type SlugCtx = { params: Promise<{ slug: string }> }

async function postHandler(_req: Request, ctx: SlugCtx) {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })
  const { slug } = await ctx.params
  const proj = await resolveProject(slug)
  if (!proj) return Response.json({ error: "project_not_found", slug }, { status: 404 })
  try {
    const { sid } = await approvePrdGate(proj)
    return Response.json({ ok: true, sid, nextPhase: "roadmap" }, { status: 202 })
  } catch (err) {
    l.error({ err, slug }, "approve PRD failed")
    const msg = String(err)
    const status = /must be 'prd'/.test(msg) ? 409 : 500
    return Response.json({ error: "approve_prd_failed", detail: msg }, { status })
  }
}

export const POST = withLog(postHandler as (req: Request, ctx: SlugCtx) => Promise<Response>, "/api/plan/[slug]/prd/approve")
