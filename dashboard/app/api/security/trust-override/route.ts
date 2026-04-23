/**
 * POST /api/security/trust-override
 *
 * Admin-only: marks a skill as trusted (or untrusted), persisting to
 * .cae/trust-overrides.json.
 *
 * Body: { owner: string, name: string, trusted: boolean }
 *
 * T-14-05-08: Admin-only endpoint. Both middleware and handler check role.
 * T-14-05-03: owner/name validated against safe slug regex before use.
 *
 * CR-03 fix: SLUG_RE tightened to require alphanumeric/underscore start,
 * consistent with the scan route fix. Pure-dot tokens explicitly rejected.
 */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { requireRole } from "@/lib/cae-rbac"
import type { Role } from "@/lib/cae-types"
import { writeOverride, overrideKey } from "@/lib/cae-trust-overrides"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Safe slug: must start with alphanumeric or underscore (blocks leading `.` and `-`).
 * CR-03: tightened from /^[A-Za-z0-9_.-]+$/ to prevent leading-dot and leading-dash.
 */
const SLUG_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!requireRole(session?.user?.role as Role | undefined, "admin")) {
    return NextResponse.json({ error: "admin required" }, { status: 403 })
  }

  let body: { owner?: unknown; name?: unknown; trusted?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  const { owner, name, trusted } = body
  if (
    typeof owner !== "string" ||
    typeof name !== "string" ||
    !SLUG_RE.test(owner) ||
    !SLUG_RE.test(name) ||
    owner === "." || owner === ".." ||
    name === "." || name === ".."
  ) {
    return NextResponse.json(
      { error: "invalid owner or name — must match [A-Za-z0-9_][A-Za-z0-9_.-]*" },
      { status: 400 }
    )
  }

  await writeOverride(overrideKey(owner, name), Boolean(trusted))
  return NextResponse.json({ ok: true })
}
