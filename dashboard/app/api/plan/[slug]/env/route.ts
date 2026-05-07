export const dynamic = "force-dynamic"

import { readFile } from "fs/promises"
import { join } from "path"
import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { resolveProject } from "@/lib/cae-shift"
import { parseEnvExample, validateShipInput, writeEnvLocal } from "@/lib/cae-ship"
import { log } from "@/lib/log"
import { withLog } from "@/lib/with-log"

const l = log("api.plan.env")

type SlugCtx = { params: Promise<{ slug: string }> }

interface EnvBody { values?: Record<string, unknown> }

async function postHandler(req: NextRequest, ctx: SlugCtx) {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })
  const { slug } = await ctx.params
  const proj = await resolveProject(slug)
  if (!proj) return Response.json({ error: "project_not_found", slug }, { status: 404 })

  const body = (await req.json().catch(() => null)) as EnvBody | null
  if (!body || typeof body.values !== "object" || body.values === null) {
    return Response.json({ error: "values_required" }, { status: 400 })
  }
  const stringified: Record<string, string> = {}
  for (const [k, v] of Object.entries(body.values)) {
    stringified[k] = typeof v === "string" ? v : String(v ?? "")
  }

  let whitelist: string[] = []
  try {
    const raw = await readFile(join(proj.path, ".env.example"), "utf8")
    whitelist = parseEnvExample(raw)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      l.error({ err, slug }, "read .env.example failed")
      return Response.json({ error: "read_env_failed", detail: String(err) }, { status: 500 })
    }
  }

  try {
    const clean = validateShipInput(stringified, whitelist)
    const file = await writeEnvLocal(proj, clean)
    return Response.json({ ok: true, file, count: Object.keys(clean).length })
  } catch (err) {
    const msg = String(err)
    const status = /unknown env key|invalid env key|contains newline/.test(msg) ? 400 : 500
    if (status === 500) l.error({ err, slug }, "write env.local failed")
    return Response.json({ error: "env_write_failed", detail: msg }, { status })
  }
}

export const POST = withLog(postHandler as (req: Request, ctx: SlugCtx) => Promise<Response>, "/api/plan/[slug]/env")
