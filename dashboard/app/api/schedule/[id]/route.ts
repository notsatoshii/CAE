import { NextRequest, NextResponse } from "next/server"
import { toggleTask, deleteTask } from "@/lib/cae-schedule-store"

export const runtime = "nodejs"

// T-14-03-04: id must match this regex to prevent injection
const ID_RE = /^[a-z0-9-]+$/

/**
 * PATCH /api/schedule/[id]
 * Body: { enabled: boolean }
 * Toggles the enabled flag of a scheduled task.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 })
  }

  let body: { enabled?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 })
  }

  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled (boolean) required" }, { status: 400 })
  }

  try {
    await toggleTask(id, body.enabled)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/**
 * DELETE /api/schedule/[id]
 * Removes a scheduled task from the registry.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!ID_RE.test(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 })
  }

  try {
    await deleteTask(id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
