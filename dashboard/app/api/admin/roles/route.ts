/**
 * GET /api/admin/roles
 * Returns the current admin + operator email lists from env.
 *
 * Phase 14 Plan 04: Read-only v0.1 — admins edit .env.local directly.
 * v2 will add POST with a DB adapter for real-time changes.
 *
 * Security:
 *   - admin role required (middleware already blocks /api/admin/* for non-admin;
 *     this handler re-checks for defense-in-depth — STRIDE T-14-04-04)
 */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { requireRole, parseList } from "@/lib/cae-rbac"
import type { Role } from "@/lib/cae-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest) {
  // Defense-in-depth: re-check admin role (middleware is first line)
  const session = await auth()
  if (!requireRole(session?.user?.role as Role | undefined, "admin")) {
    return NextResponse.json({ error: "forbidden", required: "admin" }, { status: 403 })
  }

  return NextResponse.json({
    admins: parseList(process.env.ADMIN_EMAILS),
    operators: parseList(process.env.OPERATOR_EMAILS),
  })
}
