export const dynamic = "force-dynamic"

import { auth } from "@/auth"
import { resolveProject, readShiftState } from "@/lib/cae-shift"
import { lifecycleBadgeFor } from "@/lib/cae-plan-home"
import { log } from "@/lib/log"
import { withLog } from "@/lib/with-log"

const l = log("api.plan.slug")

async function getHandler(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })
  const { slug } = await ctx.params
  const proj = await resolveProject(slug)
  if (!proj) return Response.json({ error: "project_not_found", slug }, { status: 404 })
  try {
    const state = await readShiftState(proj.path)
    const badge = lifecycleBadgeFor(state?.phase ?? proj.shiftPhase ?? null)
    return Response.json({ project: proj, state, lifecycle: badge })
  } catch (err) {
    l.error({ err, slug }, "read shift state failed")
    return Response.json({ error: "read_state_failed", detail: String(err) }, { status: 500 })
  }
}

export const GET = withLog(
  getHandler as unknown as (req: Request) => Promise<Response>,
  "/api/plan/[slug]",
)
