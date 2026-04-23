/**
 * POST /api/security/scan/[name]
 *
 * Triggers an on-demand gitleaks rescan for the named skill.
 * Operator+ required. Returns ScanResult.
 *
 * T-14-05-03: name validated against slug regex; path constrained to ~/.claude/skills.
 * T-14-05-06: This is on-demand (not triggered on render).
 *
 * CR-03 fix: SLUG_RE tightened to require alphanumeric/underscore start (blocks
 * leading `.` and `-`). Pure-dot tokens `.` and `..` explicitly rejected.
 * Resolved path verified to stay inside skillsDir (defense-in-depth).
 */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { requireRole } from "@/lib/cae-rbac"
import type { Role } from "@/lib/cae-types"
import { scanSkill, appendScan } from "@/lib/cae-secrets-scan"
import path from "node:path"
import os from "node:os"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * CR-03: tightened from /^[A-Za-z0-9_.-]+$/ — now requires the first character
 * to be alphanumeric or underscore, blocking leading-dot and leading-dash slugs.
 * Pure-dot tokens `.` and `..` are also explicitly rejected below.
 */
const SLUG_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await auth()
  if (!requireRole(session?.user?.role as Role | undefined, "operator")) {
    return NextResponse.json({ error: "forbidden", required: "operator" }, { status: 403 })
  }

  const { name } = await params

  // CR-03: reject pure-dot tokens and enforce SLUG_RE
  if (!name || !SLUG_RE.test(name) || name === "." || name === "..") {
    return NextResponse.json({ error: "invalid skill name" }, { status: 400 })
  }

  const skillsDir = process.env.CAE_SKILLS_DIR ?? path.join(os.homedir(), ".claude", "skills")
  const skillDir = path.join(skillsDir, name)

  // CR-03: defense-in-depth — verify resolved path stays inside skillsDir
  const resolved = path.resolve(skillDir)
  const resolvedRoot = path.resolve(skillsDir)
  if (!resolved.startsWith(resolvedRoot + path.sep)) {
    return NextResponse.json({ error: "invalid skill name" }, { status: 400 })
  }

  const result = await scanSkill(skillDir)
  // Fire-and-forget persist — don't block response on write
  appendScan(name, result).catch(() => undefined)

  return NextResponse.json(result)
}
