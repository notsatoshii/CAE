import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import type { CatalogSkill } from "./cae-types"
import { parseSkillMd } from "./cae-skills-parse"

/**
 * Returns the skills directory.
 * Reads from CAE_SKILLS_DIR env (for tests) or defaults to ~/.claude/skills/.
 */
export function getSkillsDir(): string {
  return process.env.CAE_SKILLS_DIR ?? path.join(os.homedir(), ".hermes", "skills")
}

/**
 * Reads all installed skills from ~/.claude/skills/ (or provided dir).
 *
 * For each subdirectory that contains a SKILL.md file:
 *   - Parses frontmatter for name/description
 *   - Returns CatalogSkill with source:"local", installed:true, owner:"local"
 *
 * Skips entries without SKILL.md silently.
 */
export async function readLocalSkillsDir(
  dir: string = getSkillsDir()
): Promise<CatalogSkill[]> {
  const skills: CatalogSkill[] = []

  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    // Directory doesn't exist or can't be read — return empty
    return []
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const skillDir = path.join(dir, entry.name)
    const skillMdPath = path.join(skillDir, "SKILL.md")

    // Check if this directory has a SKILL.md directly
    try {
      const content = fs.readFileSync(skillMdPath, "utf8")
      const { frontmatter } = parseSkillMd(content)

      skills.push({
        name: entry.name,
        owner: "local",
        source: "local",
        description: frontmatter.description ?? "",
        installCmd: "already installed",
        detailUrl: `file://${skillDir}`,
        installed: true,
      })
    } catch {
      // No SKILL.md at top level — check subdirectories (category folders)
      try {
        const subEntries = fs.readdirSync(skillDir, { withFileTypes: true })
        for (const sub of subEntries) {
          if (!sub.isDirectory()) continue
          const subSkillDir = path.join(skillDir, sub.name)
          const subSkillMd = path.join(subSkillDir, "SKILL.md")
          try {
            const content = fs.readFileSync(subSkillMd, "utf8")
            const { frontmatter } = parseSkillMd(content)
            skills.push({
              name: sub.name,
              owner: "local",
              source: "local",
              description: frontmatter.description ?? "",
              installCmd: "already installed",
              detailUrl: `file://${subSkillDir}`,
              installed: true,
            })
          } catch {
            continue
          }
        }
      } catch {
        continue
      }
    }
  }

  return skills
}
