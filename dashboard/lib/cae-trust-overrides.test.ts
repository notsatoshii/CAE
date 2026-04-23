/**
 * cae-trust-overrides.test.ts — Integration tests using real temp files.
 *
 * ESM named import bindings cannot be reliably intercepted by vi.mock in vitest 1.x
 * jsdom environment. Using real temp dirs is more reliable and equally fast for
 * small JSON files.
 */
import { describe, it, expect, beforeEach } from "vitest"
import * as os from "node:os"
import * as path from "node:path"
import * as fs from "node:fs/promises"
import { readOverrides, writeOverride, overrideKey } from "./cae-trust-overrides"

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cae-overrides-test-"))
  // Point CAE_ROOT at our temp dir so the module uses it
  process.env.CAE_ROOT = tmpDir
  // Ensure .cae dir exists
  await fs.mkdir(path.join(tmpDir, ".cae"), { recursive: true })
})

describe("trust overrides", () => {
  it("Test 10a: readOverrides returns empty set when file missing", async () => {
    const result = await readOverrides()
    expect(result).toBeInstanceOf(Set)
    expect(result.size).toBe(0)
  })

  it("Test 10b: readOverrides parses existing JSON file", async () => {
    const file = path.join(tmpDir, ".cae/trust-overrides.json")
    await fs.writeFile(
      file,
      JSON.stringify(["vercel-labs/agent-skills", "anthropic/coding"])
    )

    const result = await readOverrides()
    expect(result.has("vercel-labs/agent-skills")).toBe(true)
    expect(result.has("anthropic/coding")).toBe(true)
    expect(result.size).toBe(2)
  })

  it("Test 10c: writeOverride(key, true) adds entry and sets perms 0600", async () => {
    const file = path.join(tmpDir, ".cae/trust-overrides.json")
    await fs.writeFile(file, JSON.stringify(["vercel-labs/agent-skills"]))

    await writeOverride("random-user/cleanup", true)

    const content = await fs.readFile(file, "utf8")
    const list = JSON.parse(content) as string[]
    expect(list).toContain("vercel-labs/agent-skills")
    expect(list).toContain("random-user/cleanup")

    // File permissions should be 0600
    const stat = await fs.stat(file)
    expect(stat.mode & 0o777).toBe(0o600)
  })

  it("Test 10d: writeOverride(key, false) removes entry", async () => {
    const file = path.join(tmpDir, ".cae/trust-overrides.json")
    await fs.writeFile(
      file,
      JSON.stringify(["vercel-labs/agent-skills", "random-user/cleanup"])
    )

    await writeOverride("random-user/cleanup", false)

    const content = await fs.readFile(file, "utf8")
    const list = JSON.parse(content) as string[]
    expect(list).toContain("vercel-labs/agent-skills")
    expect(list).not.toContain("random-user/cleanup")
  })

  it("Test 10e: overrideKey normalizes owner/name to lowercase", () => {
    expect(overrideKey("Vercel-Labs", "Agent-Skills")).toBe("vercel-labs/agent-skills")
  })
})
