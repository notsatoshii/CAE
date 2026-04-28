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
  
  // Try direct path first (e.g., ~/.hermes/skills/claude-code/SKILL.md)
  let skillDir = path.join(skillsDir, name)
  let skillMdPath = path.join(skillDir, "SKILL.md")

  // Verify the resolved path is within skillsDir (defense in depth — T-14-02-02)
  if (!skillDir.startsWith(skillsDir + path.sep) && skillDir !== skillsDir) {
    return NextResponse.json({ error: "invalid skill name" }, { status: 400 })
  }

  // If not found at top level, search one level of category subdirs
  try {
    await fs.access(skillMdPath)
  } catch {
    // Search category directories (e.g., autonomous-ai-agents/claude-code/)
    let found = false
    try {
      const categories = await fs.readdir(skillsDir, { withFileTypes: true })
      for (const cat of categories) {
        if (!cat.isDirectory()) continue
        const nested = path.join(skillsDir, cat.name, name, "SKILL.md")
        try {
          await fs.access(nested)
          skillDir = path.join(skillsDir, cat.name, name)
          skillMdPath = nested
          found = true
          break
        } catch { continue }
      }
    } catch { /* ignore */ }
    if (!found) {
      return NextResponse.json({ error: "not found" }, { status: 404 })
    }
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

    return NextResponse.json({ skill, md: body, frontmatter, raw: md })
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }
}

/**
 * Shared helper: resolve a skill name to its SKILL.md path on disk.
 * Searches top-level first, then one level of category subdirs.
 * Returns null if not found.
 */
async function resolveSkillMdPath(name: string): Promise<string | null> {
  const skillsDir = getSkillsDir()

  // Try direct path first
  const directPath = path.join(skillsDir, name, "SKILL.md")
  if (
    path.join(skillsDir, name).startsWith(skillsDir + path.sep) ||
    path.join(skillsDir, name) === skillsDir
  ) {
    try {
      await fs.access(directPath)
      return directPath
    } catch { /* fall through */ }
  }

  // Search category subdirs
  try {
    const categories = await fs.readdir(skillsDir, { withFileTypes: true })
    for (const cat of categories) {
      if (!cat.isDirectory()) continue
      const nested = path.join(skillsDir, cat.name, name, "SKILL.md")
      try {
        await fs.access(nested)
        return nested
      } catch { continue }
    }
  } catch { /* ignore */ }

  return null
}

/**
 * PUT /api/skills/[name]
 * Accepts { content: string } — the full SKILL.md file content (frontmatter + body).
 * Writes it back to disk. Returns updated { md, frontmatter }.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name: rawName } = await params
  const name = sanitizeName(rawName)

  if (!name) {
    return NextResponse.json({ error: "invalid skill name" }, { status: 400 })
  }

  let body: { content?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  if (typeof body.content !== "string") {
    return NextResponse.json(
      { error: "content field required (string)" },
      { status: 400 }
    )
  }

  const skillMdPath = await resolveSkillMdPath(name)
  if (!skillMdPath) {
    return NextResponse.json({ error: "not found" }, { status: 404 })
  }

  try {
    await fs.writeFile(skillMdPath, body.content, "utf8")
    const { frontmatter, body: mdBody } = parseSkillMd(body.content)
    return NextResponse.json({ ok: true, md: mdBody, frontmatter })
  } catch (err) {
    return NextResponse.json(
      { error: "write failed: " + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    )
  }
}
