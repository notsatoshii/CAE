export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { resolveProject } from "@/lib/cae-shift"
import { loadUatState, patchUatState } from "@/lib/cae-uat"
import { log } from "@/lib/log"
import { withLog } from "@/lib/with-log"

const l = log("api.plan.uat")

type Ctx = { params: Promise<{ slug: string; phase: string }> }

function parsePhase(raw: string): number | null {
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1 || n > 999) return null
  return n
}

async function getHandler(_req: Request, ctx: Ctx) {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })
  const { slug, phase } = await ctx.params
  const proj = await resolveProject(slug)
  if (!proj) return Response.json({ error: "project_not_found", slug }, { status: 404 })
  const phaseNum = parsePhase(phase)
  if (phaseNum === null) return Response.json({ error: "invalid_phase" }, { status: 400 })

  try {
    const state = await loadUatState(proj, phaseNum)
    return Response.json(state)
  } catch (err) {
    l.error({ err, slug, phase }, "load UAT state failed")
    return Response.json({ error: "load_uat_failed", detail: String(err) }, { status: 500 })
  }
}

interface PatchBody { id?: unknown; status?: unknown; note?: unknown }

async function postHandler(req: NextRequest, ctx: Ctx) {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })
  const { slug, phase } = await ctx.params
  const proj = await resolveProject(slug)
  if (!proj) return Response.json({ error: "project_not_found", slug }, { status: 404 })
  const phaseNum = parsePhase(phase)
  if (phaseNum === null) return Response.json({ error: "invalid_phase" }, { status: 400 })

  const body = (await req.json().catch(() => null)) as PatchBody | null
  if (!body) return Response.json({ error: "invalid_json" }, { status: 400 })
  const id = typeof body.id === "string" ? body.id : ""
  const status = body.status === "pass" || body.status === "fail" ? body.status : null
  if (!id || !status) return Response.json({ error: "id_and_status_required" }, { status: 400 })
  const note = typeof body.note === "string" ? body.note : undefined

  try {
    const next = await patchUatState(proj, phaseNum, id, status, note)
    return Response.json(next)
  } catch (err) {
    l.error({ err, slug, phase, id }, "patch UAT state failed")
    return Response.json({ error: "patch_uat_failed", detail: String(err) }, { status: 500 })
  }
}

export const GET = withLog(getHandler as (req: Request, ctx: Ctx) => Promise<Response>, "/api/plan/[slug]/uat/[phase]")
export const POST = withLog(postHandler as (req: Request, ctx: Ctx) => Promise<Response>, "/api/plan/[slug]/uat/[phase]")
