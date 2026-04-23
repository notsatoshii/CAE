/**
 * GET /api/security/trust
 *
 * Returns trust scores for all locally installed skills.
 * Requires authentication (any signed-in role can read).
 *
 * T-14-05-08: No override capability here — use /api/security/trust-override (admin-only).
 */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { requireRole } from "@/lib/cae-rbac"
import type { Role } from "@/lib/cae-types"
import { readLocalSkillsDir } from "@/lib/cae-skills-local"
import { parseSkillMd } from "@/lib/cae-skills-parse"
import { computeTrustScore } from "@/lib/cae-skills-trust"
import { readOverrides, overrideKey } from "@/lib/cae-trust-overrides"
import { readFile } from "node:fs/promises"
import path from "node:path"
import os from "node:os"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest) {
  const session = await auth()
  // Any signed-in user can view trust scores (read-only)
  if (!session?.user?.role) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }
  if (!requireRole(session.user.role as Role, "viewer")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const skillsDir = process.env.CAE_SKILLS_DIR ?? path.join(os.homedir(), ".claude", "skills")
  const overrides = await readOverrides()
  const localSkills = await readLocalSkillsDir(skillsDir)

  const scored = await Promise.all(
    localSkills.map(async (s) => {
      // Read SKILL.md for frontmatter
      const md = await readFile(
        path.join(skillsDir, s.name, "SKILL.md"),
        "utf8"
      ).catch(() => "")
      const { frontmatter } = parseSkillMd(md)
      const isOverridden = overrides.has(overrideKey(s.owner, s.name))

      const trust = computeTrustScore({
        skill: s,
        frontmatter,
        secretsCount: 0, // Scan results loaded separately via /api/security/scans
        overridden: isOverridden,
      })

      return { skill: s, trust }
    })
  )

  return NextResponse.json(scored)
}
