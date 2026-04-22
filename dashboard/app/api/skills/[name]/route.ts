import { NextRequest, NextResponse } from "next/server"
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { getSkillsDir } from "@/lib/cae-skills-local"
import { parseSkillMd } from "@/lib/cae-skills-parse"
import type { CatalogSkill } from "@/lib/cae-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Sanitizes a skill name from a URL segment.
 * Only allows [A-Za-z0-9_.-]+ — strips path traversal and protocol.
 * T-14-02-02: path traversal mitigation.
 */
function sanitizeName(raw: string): string | null {
  const cleaned = raw.replace(/[^A-Za-z0-9_.-]/g, "")
  if (!cleaned || cleaned.length === 0) return null
  // Extra safety: reject anything that looks like traversal after cleaning
  if (cleaned.includes("..") || cleaned.startsWith(".")) return null
  return cleaned
}

/**
 * GET /api/skills/[name]
 * Returns { skill: CatalogSkill, md: string, frontmatter: SkillFrontmatter }
 * for a locally installed skill.
 *
 * 404 if skill directory or SKILL.md does not exist.
 * 400 if name contains invalid characters (path traversal attempt).
 *
 * TODO(14-04): Add operator role gate via NextAuth middleware.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name: rawName } = await params
  const name = sanitizeName(rawName)

  if (!name) {
    return NextResponse.json({ error: "invalid skill name" }, { status: 400 })
  }

  const skillsDir = getSkillsDir()
  const skillDir = path.join(skillsDir, name)
  const skillMdPath = path.join(skillDir, "SKILL.md")

  // Verify the resolved path is within skillsDir (defense in depth — T-14-02-02)
  if (!skillDir.startsWith(skillsDir + path.sep) && skillDir !== skillsDir) {
    return NextResponse.json({ error: "invalid skill name" }, { status: 400 })
  }

  try {
    const md = await fs.readFile(skillMdPath, "utf8")
    const { frontmatter, body } = parseSkillMd(md)

    const skill: CatalogSkill = {
      name,
      owner: frontmatter.name ?? "local",
      source: "local",
      description: frontmatter.description ?? "",
      installCmd: "already installed",
      detailUrl: `file://${skillDir}`,
      installed: true,
    }

    return NextResponse.json({ skill, md: body, frontmatter })
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
}
