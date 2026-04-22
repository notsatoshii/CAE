export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { unlink } from "fs/promises"
import { getWorkflow, parseWorkflow, writeWorkflow } from "@/lib/cae-workflows"

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params
  const workflow = await getWorkflow(slug)
  if (!workflow) return Response.json({ error: "not found" }, { status: 404 })
  return Response.json({ workflow })
}

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params
  const existing = await getWorkflow(slug)
  if (!existing) return Response.json({ error: "not found" }, { status: 404 })
  const body = await req.json().catch(() => null)
  if (!body || typeof (body as { yaml?: unknown }).yaml !== "string") {
    return Response.json({ error: "yaml required" }, { status: 400 })
  }
  const { spec, errors } = parseWorkflow((body as { yaml: string }).yaml)
  if (!spec || errors.length > 0) {
    return Response.json({ errors }, { status: 400 })
  }
  // Preserve slug explicitly — writeWorkflow overwrites in place rather than
  // appending a random collision suffix.
  const record = await writeWorkflow(spec, { slug })
  return Response.json({ workflow: record })
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params
  const existing = await getWorkflow(slug)
  if (!existing) return Response.json({ error: "not found" }, { status: 404 })
  await unlink(existing.filepath)
  return new Response(null, { status: 204 })
}
