import { NextRequest, NextResponse } from "next/server"
import path from "node:path"
import { readTasks, writeTask } from "@/lib/cae-schedule-store"
import { parseSchedule } from "@/lib/cae-schedule-parse"
import type { ScheduledTask } from "@/lib/cae-types"

export const runtime = "nodejs"

/**
 * GET /api/schedule
 * Returns all scheduled tasks from the registry.
 */
export async function GET(_req: NextRequest) {
  try {
    const tasks = await readTasks()
    return NextResponse.json(tasks)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

/**
 * Generate a URL-safe slug id from a natural language string + short hash.
 */
function generateId(nl: string): string {
  const base = nl
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40)
  // Short hash for uniqueness
  const hash = Math.abs(
    nl.split("").reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0)
  )
    .toString(36)
    .slice(0, 4)
  return `${base}-${hash}`.replace(/^-|-$/g, "")
}

/**
 * POST /api/schedule
 * Body: { nl: string; timezone?: string; buildplan: string }
 * Creates a new scheduled task and writes it to the registry.
 *
 * Security: validates buildplan is an absolute path under CAE_ROOT (T-14-03-01).
 */
export async function POST(req: NextRequest) {
  let body: { nl?: string; timezone?: string; buildplan?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 })
  }

  if (typeof body.nl !== "string" || !body.nl.trim()) {
    return NextResponse.json({ error: "nl required" }, { status: 400 })
  }
  if (typeof body.buildplan !== "string" || !body.buildplan) {
    return NextResponse.json({ error: "buildplan required" }, { status: 400 })
  }

  // T-14-03-01: path traversal prevention
  const caeRoot = process.env.CAE_ROOT ?? "/home/cae/ctrl-alt-elite"
  const normalizedBp = path.normalize(body.buildplan)
  if (
    !path.isAbsolute(normalizedBp) ||
    !normalizedBp.startsWith(caeRoot) ||
    normalizedBp.includes("..")
  ) {
    return NextResponse.json(
      { error: "buildplan must be an absolute path under CAE_ROOT" },
      { status: 400 }
    )
  }

  const timezone =
    typeof body.timezone === "string" && body.timezone ? body.timezone : "UTC"

  let parsed: Awaited<ReturnType<typeof parseSchedule>>
  try {
    parsed = await parseSchedule(body.nl)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 })
  }

  const task: ScheduledTask = {
    id: generateId(body.nl),
    nl: body.nl.trim(),
    cron: parsed.cron,
    timezone,
    buildplan: normalizedBp,
    enabled: true,
    lastRun: 0,
    createdAt: Math.floor(Date.now() / 1000),
    createdBy: "unknown", // TODO(14-04): populate from session.user.email after RBAC
  }

  try {
    await writeTask(task)
    return NextResponse.json(task, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
