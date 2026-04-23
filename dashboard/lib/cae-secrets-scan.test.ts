/**
 * cae-secrets-scan.test.ts — Tests for gitleaks shell-out scanner.
 *
 * Pattern:
 *   - scanSkill: uses spawnImpl injection parameter to avoid module mock issues
 *   - readFile for report: use real temp file written before spawning
 *   - appendScan: use real temp dir (ESM named import mocks unreliable in vitest 1.x jsdom)
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import * as os from "node:os"
import * as path from "node:path"
import * as fs from "node:fs/promises"
import { scanSkill, appendScan } from "./cae-secrets-scan"

let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cae-scan-test-"))
  process.env.CAE_ROOT = tmpDir
})

/** Build a fake ChildProcess that fires "close" with exitCode on next microtask.
 *  The proc writes `reportData` to a path that scanSkill will read via readFile. */
function makeCloseProc(exitCode: number, reportPath: string, reportData: string) {
  const proc = {
    stderr: { on: vi.fn() },
    on(event: string, cb: (code: number) => void) {
      if (event === "close") {
        queueMicrotask(async () => {
          // Write the report data to the expected path before signalling close
          await fs.writeFile(reportPath, reportData).catch(() => undefined)
          cb(exitCode)
        })
      }
      return proc
    },
  }
  return proc
}

/** Build a fake ChildProcess that fires "error" on next microtask. */
function makeErrorProc(code: string) {
  const proc = {
    stderr: { on: vi.fn() },
    on(event: string, cb: (err: Error) => void) {
      if (event === "error") {
        const err = Object.assign(new Error("spawn " + code), { code })
        queueMicrotask(() => cb(err))
      }
      return proc
    },
  }
  return proc
}

describe("scanSkill", () => {
  it("Test 5: injected spawnImpl → parsed findings with doc-example tagging", async () => {
    const fixtureData = JSON.stringify([
      {
        RuleID: "openai-api-key",
        File: "/path/to/SKILL.md",
        StartLine: 40,
        Match: "sk-proj-example-key-here",
        Secret: "REDACTED",
      },
      {
        RuleID: "aws-access-token",
        File: "/path/to/helper.py",
        StartLine: 12,
        Match: "AKIAIOSFODNN7REAL_FINDING",
        Secret: "REDACTED",
      },
    ])

    // Capture the report path that scanSkill will generate, then write fixture there
    let capturedReportPath = ""
    const mockSpawn = vi.fn().mockImplementation((_cmd: string, args: string[]) => {
      // scanSkill passes --report-path <tmpFile> as argv[7]
      const rpIdx = args.indexOf("--report-path")
      capturedReportPath = rpIdx >= 0 ? args[rpIdx + 1] : ""
      return makeCloseProc(1, capturedReportPath, fixtureData)
    })

    const result = await scanSkill(
      "/tmp/test-skill",
      mockSpawn as unknown as typeof import("node:child_process").spawn
    )

    expect(result.available).toBe(true)
    expect(result.findings.length).toBe(2)

    // "sk-proj-example-key-here" matches doc-example allowlist
    const docExample = result.findings.find((f) => f.file === "/path/to/SKILL.md")
    expect(docExample?.isDocExample).toBe(true)

    // "AKIAIOSFODNN7REAL_FINDING" does not match any doc-example pattern
    const realFinding = result.findings.find((f) => f.file === "/path/to/helper.py")
    expect(realFinding?.isDocExample).toBe(false)
  })

  it("Test 6: ENOENT → available:false, error:'gitleaks not installed'", async () => {
    const mockSpawn = vi.fn().mockReturnValue(makeErrorProc("ENOENT"))
    const result = await scanSkill(
      "/tmp/test-skill",
      mockSpawn as unknown as typeof import("node:child_process").spawn
    )

    expect(result.available).toBe(false)
    expect(result.error).toBe("gitleaks not installed")
    expect(result.findings).toEqual([])
  })

  it("Test 6b: non-ENOENT error → available:false, error contains message", async () => {
    const mockSpawn = vi.fn().mockReturnValue(makeErrorProc("EACCES"))
    const result = await scanSkill(
      "/tmp/test-skill",
      mockSpawn as unknown as typeof import("node:child_process").spawn
    )

    expect(result.available).toBe(false)
    expect(result.error).not.toBe("gitleaks not installed")
  })
})

describe("appendScan", () => {
  it("Test 7: writes JSONL line to skill-scans.jsonl in CAE_ROOT", async () => {
    await fs.mkdir(path.join(tmpDir, ".cae/metrics"), { recursive: true })

    const report = {
      available: true,
      findings: [] as any[],
      scannedAt: "2026-04-23T10:00:00Z",
    }
    await appendScan("vercel-labs/deploy", report)

    const outFile = path.join(tmpDir, ".cae/metrics/skill-scans.jsonl")
    const content = await fs.readFile(outFile, "utf8")
    const parsed = JSON.parse(content.trim())
    expect(parsed.name).toBe("vercel-labs/deploy")
    expect(typeof parsed.ts).toBe("string")
    expect(parsed.findings).toBe(0)
  })

  it("Test 7b: appendScan appends multiple entries (not overwrite)", async () => {
    await fs.mkdir(path.join(tmpDir, ".cae/metrics"), { recursive: true })

    const report = { available: true, findings: [] as any[], scannedAt: "2026-04-23T10:00:00Z" }
    await appendScan("skill-one", report)
    await appendScan("skill-two", report)

    const outFile = path.join(tmpDir, ".cae/metrics/skill-scans.jsonl")
    const lines = (await fs.readFile(outFile, "utf8"))
      .split("\n")
      .filter(Boolean)
    expect(lines.length).toBe(2)
    expect(JSON.parse(lines[0]).name).toBe("skill-one")
    expect(JSON.parse(lines[1]).name).toBe("skill-two")
  })
})
