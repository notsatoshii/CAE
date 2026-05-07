export const dynamic = "force-dynamic"

import { readFile } from "fs/promises"
import { join } from "path"
import { auth } from "@/auth"
import { resolveProject } from "@/lib/cae-shift"
import { parseEnvExample } from "@/lib/cae-ship"
import { log } from "@/lib/log"
import { withLog } from "@/lib/with-log"

const l = log("api.plan.env-keys")

type SlugCtx = { params: Promise<{ slug: string }> }

async function getHandler(_req: Request, ctx: SlugCtx) {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })
  const { slug } = await ctx.params
  const proj = await resolveProject(slug)
  if (!proj) return Response.json({ error: "project_not_found", slug }, { status: 404 })

  const path = join(proj.path, ".env.example")
  try {
    const raw = await readFile(path, "utf8")
    const keys = parseEnvExample(raw)
    return Response.json({ path, keys })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return Response.json({ path, keys: [] })
    }
    l.error({ err, slug }, "read .env.example failed")
    return Response.json({ error: "read_env_failed", detail: String(err) }, { status: 500 })
  }
}

export const GET = withLog(getHandler as (req: Request, ctx: SlugCtx) => Promise<Response>, "/api/plan/[slug]/env-keys")
