import { describe, it, expect } from "vitest"
import { parseSkillMd } from "./cae-skills-parse"
import * as fs from "node:fs"
import * as path from "node:path"

const FIXTURE_DIR = path.join(__dirname, "../tests/fixtures/skills")

describe("parseSkillMd", () => {
  it("Test 4a: parses full frontmatter from SKILL.md fixture", () => {
    const content = fs.readFileSync(path.join(FIXTURE_DIR, "SKILL.md"), "utf8")
    const result = parseSkillMd(content)
    expect(result.frontmatter.name).toBe("deploy")
    expect(result.frontmatter.description).toBe(
      "Deploy the application to production"
    )
    expect(result.frontmatter.disableModelInvocation).toBe(true)
    expect(Array.isArray(result.frontmatter.allowedTools)).toBe(true)
    expect(result.frontmatter.allowedTools.length).toBeGreaterThan(0)
    expect(result.body).toContain("Deploy $ARGUMENTS")
  })

  it("Test 4b: parses allowed-tools from SKILL-allowed-tools.md fixture", () => {
    const content = fs.readFileSync(
      path.join(FIXTURE_DIR, "SKILL-allowed-tools.md"),
      "utf8"
    )
    const result = parseSkillMd(content)
    expect(result.frontmatter.allowedTools).toContain("Bash(rm *)")
    expect(result.frontmatter.allowedTools).toContain("Bash(sudo *)")
    expect(result.frontmatter.disableModelInvocation).toBe(false)
  })

  it("Test 4c: handles content with no frontmatter", () => {
    const content = "Just some plain markdown content\n\n## Header\n\nBody text."
    const result = parseSkillMd(content)
    expect(result.frontmatter.disableModelInvocation).toBe(false)
    expect(result.frontmatter.allowedTools).toEqual([])
    expect(result.body).toContain("Just some plain markdown content")
  })

  it("Test 4d: handles malformed YAML gracefully", () => {
    const content = "---\ninvalid: yaml: :\n  bad: : nesting\n---\nBody here."
    const result = parseSkillMd(content)
    expect(result.frontmatter.disableModelInvocation).toBe(false)
    expect(result.frontmatter.allowedTools).toEqual([])
    // Body should be extractable from after delimiters
    expect(result.body).toContain("Body here")
  })

  it("Test 4e: handles allowed-tools as space-separated string", () => {
    const content = `---
name: test-skill
allowed-tools: Bash Write Edit
---
Body content here.`
    const result = parseSkillMd(content)
    expect(result.frontmatter.allowedTools).toEqual(["Bash", "Write", "Edit"])
  })
})
