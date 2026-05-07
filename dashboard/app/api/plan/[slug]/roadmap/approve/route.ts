export const dynamic = "force-dynamic"

import { readFile } from "fs/promises"
import { join } from "path"
import { auth } from "@/auth"
import { resolveProject, approveRoadmapGate } from "@/lib/cae-shift"
import { extractPhase1, writeBuildplan, runPlanGen } from "@/lib/cae-plan-gen"
import { log } from "@/lib/log"
import { withLog } from "@/lib/with-log"

const l = log("api.plan.roadmap.approve")

type SlugCtx = { params: Promise<{ slug: string }> }

async function postHandler(_req: Request, ctx: SlugCtx) {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })
  const { slug } = await ctx.params
  const proj = await resolveProject(slug)
  if (!proj) return Response.json({ error: "project_not_found", slug }, { status: 404 })

  try {
    await approveRoadmapGate(proj)
  } catch (err) {
    l.error({ err, slug }, "approve ROADMAP failed")
    const msg = String(err)
    const status = /must be 'roadmap'/.test(msg) ? 409 : 500
    return Response.json({ error: "approve_roadmap_failed", detail: msg }, { status })
  }

  // Best-effort BUILDPLAN.md write + plan-gen spawn (REQ-10-06).
  let buildplan: string | null = null
  let planGen: { spawned: boolean; sid?: string; planPath: string } | null = null
  try {
    const roadmapPath = join(proj.path, ".shift", "ROADMAP.md")
    const md = await readFile(roadmapPath, "utf8")
    const phase1 = extractPhase1(md)
    if (phase1) {
      buildplan = await writeBuildplan(proj, phase1)
      planGen = await runPlanGen(proj)
    }
  } catch (err) {
    l.warn({ err, slug }, "plan-gen pipeline soft-failed (gate already approved)")
  }

  return Response.json({
    ok: true,
    nextPhase: "waiting_for_plans",
    buildplan,
    planGen,
  }, { status: 202 })
}

export const POST = withLog(postHandler as (req: Request, ctx: SlugCtx) => Promise<Response>, "/api/plan/[slug]/roadmap/approve")
