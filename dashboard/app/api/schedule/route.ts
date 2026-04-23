import { NextRequest, NextResponse } from "next/server"
import path from "node:path"
import { readTasks, writeTask } from "@/lib/cae-schedule-store"
import { parseSchedule } from "@/lib/cae-schedule-parse"
import { auth } from "@/auth"
import { requireRole } from "@/lib/cae-rbac"
import type { ScheduledTask } from "@/lib/cae-types"
import type { Role } from "@/lib/cae-types"

export const runtime = "nodejs"

/**
 * CR-04: Allowlist for buildplan paths. Only alphanumeric, slash, dot, underscore,
 * and hyphen are permitted. This blocks all shell metacharacters: `'`, `"`, `;`,
 * `$`, backtick, space, newline, `&`, `|`, `(`, `)`, `<`, `>`, `\`, `*`, `?`, `~`.
 *
 * Applied AFTER path.normalize and the existing absolute-path + CAE_ROOT checks
 * (defense-in-depth — all three layers must pass).
 */
const BUILDPLAN_RE = /^[A-Za-z0-9_./-]+$/

/**
 * WR-03: Maximum length for the natural-language schedule input.
 * Limits LLM prompt injection surface — a 200-char input cannot carry a full
 * instruction-override payload while still describing a schedule.
 */
const NL_MAX_LEN = 200

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
 * Security:
 *   - operator role required (T-14-04 defense-in-depth)
 *   - nl length-limited to 200 chars (WR-03: limits LLM prompt injection surface)
 *   - buildplan is an absolute path under CAE_ROOT (T-14-03-01)
 *   - buildplan must match BUILDPLAN_RE (CR-04: no shell metacharacters)
 *   - WR-01: caeRoot check uses trailing separator to prevent prefix-escape
 */
export async function POST(req: NextRequest) {
  // Defense-in-depth: re-check role in handler (STRIDE T-14-04-03)
  const session = await auth()
  if (!requireRole(session?.user?.role as Role | undefined, "operator")) {
    return NextResponse.json({ error: "forbidden", required: "operator" }, { status: 403 })
  }

  let body: { nl?: string; timezone?: string; buildplan?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 })
  }

  if (typeof body.nl !== "string" || !body.nl.trim()) {
    return NextResponse.json({ error: "nl required" }, { status: 400 })
  }

  // WR-03: length-limit nl to reduce LLM prompt injection surface
  if (body.nl.length > NL_MAX_LEN) {
    return NextResponse.json(
      { error: `nl must be ${NL_MAX_LEN} characters or fewer` },
      { status: 400 }
    )
  }

  if (typeof body.buildplan !== "string" || !body.buildplan) {
    return NextResponse.json({ error: "buildplan required" }, { status: 400 })
  }

  // T-14-03-01: path traversal prevention
  const caeRoot = process.env.CAE_ROOT ?? "/home/cae/ctrl-alt-elite"
  const normalizedBp = path.normalize(body.buildplan)

  // WR-01: add trailing separator so "/home/cae/ctrl-alt-elite-evil/..." does not pass
  const caeRootWithSep = caeRoot.endsWith(path.sep) ? caeRoot : caeRoot + path.sep

  if (
    !path.isAbsolute(normalizedBp) ||
    !(normalizedBp === caeRoot || normalizedBp.startsWith(caeRootWithSep)) ||
    normalizedBp.includes("..")
  ) {
    return NextResponse.json(
      { error: "buildplan must be an absolute path under CAE_ROOT" },
      { status: 400 }
    )
  }

  // CR-04: reject shell metacharacters in buildplan path.
  // The watcher interpolates buildplan into a shell string; any character outside
  // the allowlist could enable RCE when the watcher runs.
  if (!BUILDPLAN_RE.test(normalizedBp)) {
    return NextResponse.json(
      { error: "buildplan contains invalid characters" },
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
    createdBy: session?.user?.email ?? "unknown",
  }

  try {
    await writeTask(task)
    return NextResponse.json(task, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
