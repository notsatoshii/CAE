export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { resolveProject } from "@/lib/cae-shift"
import { ghAuthStatus, runGhRepoCreate } from "@/lib/cae-ship"
import { log } from "@/lib/log"
import { withLog } from "@/lib/with-log"

const l = log("api.plan.gh-create")

type SlugCtx = { params: Promise<{ slug: string }> }

interface GhBody { repoName?: unknown }

async function getHandler() {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })
  const status = await ghAuthStatus()
  return Response.json(status)
}

async function postHandler(req: NextRequest, ctx: SlugCtx) {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })
  const { slug } = await ctx.params
  const proj = await resolveProject(slug)
  if (!proj) return Response.json({ error: "project_not_found", slug }, { status: 404 })

  const body = (await req.json().catch(() => ({}))) as GhBody
  const name = typeof body.repoName === "string" ? body.repoName : slug
  if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(name)) {
    return Response.json({ error: "invalid_repo_name" }, { status: 400 })
  }

  const status = await ghAuthStatus()
  if (!status.authed) {
    return Response.json({ error: "gh_not_authed", detail: status.stderr ?? "" }, { status: 412 })
  }

  try {
    const { sid, logFile } = await runGhRepoCreate(proj, name)
    return Response.json({ ok: true, sid, logFile, repoName: name }, { status: 202 })
  } catch (err) {
    l.error({ err, slug, name }, "gh repo create spawn failed")
    return Response.json({ error: "gh_create_failed", detail: String(err) }, { status: 500 })
  }
}

export const GET = withLog(getHandler as (req: Request) => Promise<Response>, "/api/plan/[slug]/gh-create")
export const POST = withLog(postHandler as (req: Request, ctx: SlugCtx) => Promise<Response>, "/api/plan/[slug]/gh-create")
