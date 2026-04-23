/**
 * GET /api/security/audit
 *
 * Returns tool-call audit log entries filtered by query params.
 * Requires operator+ role.
 *
 * Query params: tool, task, from, to, limit (max 1000), offset
 *
 * T-14-05-05: Only tool name + cwd returned; no args or stdout exposed.
 */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { requireRole } from "@/lib/cae-rbac"
import type { Role } from "@/lib/cae-types"
import { readAuditLog } from "@/lib/cae-audit-log"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!requireRole(session?.user?.role as Role | undefined, "operator")) {
    return NextResponse.json({ error: "forbidden", required: "operator" }, { status: 403 })
  }

  const sp = req.nextUrl.searchParams
  const limitRaw = parseInt(sp.get("limit") ?? "200", 10)
  const limit = isNaN(limitRaw) ? 200 : Math.min(Math.max(1, limitRaw), 1000)
  const offsetRaw = parseInt(sp.get("offset") ?? "0", 10)
  const offset = isNaN(offsetRaw) ? 0 : Math.max(0, offsetRaw)

  const { entries, total } = await readAuditLog({
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    tool: sp.get("tool") ?? undefined,
    task: sp.get("task") ?? undefined,
    limit,
    offset,
  })

  return NextResponse.json({ entries, total })
}
