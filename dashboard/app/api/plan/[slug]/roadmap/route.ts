export const dynamic = "force-dynamic"

import { readFile } from "fs/promises"
import { join } from "path"
import { auth } from "@/auth"
import { resolveProject, readShiftState } from "@/lib/cae-shift"
import { log } from "@/lib/log"
import { withLog } from "@/lib/with-log"

const l = log("api.plan.roadmap")

type SlugCtx = { params: Promise<{ slug: string }> }

async function getHandler(_req: Request, ctx: SlugCtx) {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })
  const { slug } = await ctx.params
  const proj = await resolveProject(slug)
  if (!proj) return Response.json({ error: "project_not_found", slug }, { status: 404 })

  const state = await readShiftState(proj.path)
  const roadmapPath = state?.roadmap?.path ?? join(proj.path, ".shift", "ROADMAP.md")
  try {
    const text = await readFile(roadmapPath, "utf8")
    return Response.json({
      path: roadmapPath,
      text,
      approved: Boolean(state?.roadmap?.user_approved),
      phase: state?.phase ?? null,
    })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return Response.json({ path: roadmapPath, text: null, approved: false, phase: state?.phase ?? null }, { status: 200 })
    }
    l.error({ err, slug }, "read ROADMAP failed")
    return Response.json({ error: "read_roadmap_failed", detail: String(err) }, { status: 500 })
  }
}

export const GET = withLog(getHandler as (req: Request, ctx: SlugCtx) => Promise<Response>, "/api/plan/[slug]/roadmap")
