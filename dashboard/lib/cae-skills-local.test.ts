import { describe, it, expect, afterAll } from "vitest"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { readLocalSkillsDir } from "./cae-skills-local"

describe("readLocalSkillsDir", () => {
  let tmpDir: string

  function setupTmpDir() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cae-skills-test-"))

    // Skill 1: deploy
    const s1 = path.join(tmpDir, "deploy")
    fs.mkdirSync(s1)
    fs.writeFileSync(
      path.join(s1, "SKILL.md"),
      `---
name: deploy
description: Deploy the application to production
---
Deploy $ARGUMENTS to production.`
    )

    // Skill 2: git-workflow
    const s2 = path.join(tmpDir, "git-workflow")
    fs.mkdirSync(s2)
    fs.writeFileSync(
      path.join(s2, "SKILL.md"),
      `---
name: git-workflow
description: Standardized git branching
---
Git workflow steps.`
    )

    // Non-skill: a directory WITHOUT SKILL.md — should be skipped
    const noSkill = path.join(tmpDir, "not-a-skill")
    fs.mkdirSync(noSkill)

    return tmpDir
  }

  afterAll(() => {
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      } catch {
        // ignore cleanup errors
      }
    }
  })

  it("Test 3: returns 2 skills from tmp dir with 2 SKILL.md files", async () => {
    const dir = setupTmpDir()
    const skills = await readLocalSkillsDir(dir)
    expect(skills).toHaveLength(2)
  })

  it("Test 3b: all local skills have correct source and installed=true", async () => {
    const dir = setupTmpDir()
    const skills = await readLocalSkillsDir(dir)
    for (const s of skills) {
      expect(s.source).toBe("local")
      expect(s.installed).toBe(true)
      expect(s.owner).toBe("local")
    }
  })

  it("Test 3c: skill names match directory names", async () => {
    const dir = setupTmpDir()
    const skills = await readLocalSkillsDir(dir)
    const names = skills.map((s) => s.name).sort()
    expect(names).toEqual(["deploy", "git-workflow"])
  })

  it("Test 3d: descriptions extracted from frontmatter", async () => {
    const dir = setupTmpDir()
    const skills = await readLocalSkillsDir(dir)
    const deploy = skills.find((s) => s.name === "deploy")
    expect(deploy?.description).toBe("Deploy the application to production")
  })

  it("Test 3e: returns empty array for empty dir", async () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "cae-skills-empty-"))
    try {
      const skills = await readLocalSkillsDir(emptyDir)
      expect(skills).toEqual([])
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true })
    }
  })
})
