/**
 * POST /api/security/scan/[name]
 *
 * Triggers an on-demand gitleaks rescan for the named skill.
 * Operator+ required. Returns ScanResult.
 *
 * T-14-05-03: name validated against slug regex; path constrained to ~/.claude/skills.
 * T-14-05-06: This is on-demand (not triggered on render).
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

const SLUG_RE = /^[A-Za-z0-9_.-]+$/

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const session = await auth()
  if (!requireRole(session?.user?.role as Role | undefined, "operator")) {
    return NextResponse.json({ error: "forbidden", required: "operator" }, { status: 403 })
  }

  const { name } = await params
  if (!name || !SLUG_RE.test(name)) {
    return NextResponse.json({ error: "invalid skill name" }, { status: 400 })
  }

  const skillsDir = process.env.CAE_SKILLS_DIR ?? path.join(os.homedir(), ".claude", "skills")
  const skillDir = path.join(skillsDir, name)

  const result = await scanSkill(skillDir)
  // Fire-and-forget persist — don't block response on write
  appendScan(name, result).catch(() => undefined)

  return NextResponse.json(result)
}
