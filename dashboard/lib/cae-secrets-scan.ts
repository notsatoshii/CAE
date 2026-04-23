/**
 * cae-secrets-scan.ts — gitleaks shell-out wrapper for skill secret scanning.
 *
 * Plan 14-05: Shells out to the gitleaks binary (installed by scripts/install-gitleaks.sh).
 * Results are persisted as append-only JSONL to .cae/metrics/skill-scans.jsonl.
 *
 * Pitfall 6: gitleaks false positives on doc examples — uses custom allowlist config
 * and tags doc-example findings with isDocExample=true for UI differentiation.
 *
 * Pitfall 5: Never scan on render — only on install + explicit rescan button.
 *
 * T-14-05-02 (Info Disclosure): Always pass --redact; surface matchRedacted only.
 * T-14-05-06 (DoS): Called fire-and-forget post-install; does not block SSE stream.
 */
import { spawn } from "node:child_process"
import { readFile, writeFile, mkdir } from "node:fs/promises"
import path from "node:path"

/** A single secret finding from gitleaks. */
export type SecretFinding = {
  ruleId: string
  file: string
  startLine: number
  /** Already redacted by gitleaks --redact flag. */
  matchRedacted: string
  /** True when the match looks like a documentation example (not a real secret). */
  isDocExample: boolean
}

/** Aggregate result from a single skill scan. */
export type ScanResult = {
  /** True if gitleaks binary was found and ran; false if ENOENT. */
  available: boolean
  findings: SecretFinding[]
  error?: string
  scannedAt: string
}

/**
 * Patterns that indicate a match is a documentation example rather than a real secret.
 * Mirrors the allowlist regexes in gitleaks-allowlist.toml.
 */
const DOC_EXAMPLES: RegExp[] = [
  /your-api-key-here/i,
  /REDACTED/,
  /sk-proj-example/i,
  /xxxx+/i,
  /example-key/i,
  /<your-[a-z-]+>/i,
  /\{\{[a-z_]+\}\}/i,
  /AKIAIOSFODNN7EXAMPLE/i,
]

/**
 * scanSkill — run gitleaks detect on a skill directory.
 *
 * @param dir - Absolute path to the skill directory.
 * @param spawnImpl - Injection point for tests (defaults to node:child_process spawn).
 */
export async function scanSkill(
  dir: string,
  spawnImpl: typeof spawn = spawn
): Promise<ScanResult> {
  const tmpReport = `/tmp/gitleaks-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.json`

  const allowlistConfig = path.join(process.cwd(), "lib/gitleaks-allowlist.toml")

  return new Promise((resolve) => {
    const proc = spawnImpl("gitleaks", [
      "detect",
      "--no-git",
      "--source",
      dir,
      "--redact",
      "--report-format",
      "json",
      "--report-path",
      tmpReport,
      "--config",
      allowlistConfig,
    ])

    let stderrBuf = ""
    proc.stderr?.on("data", (d: Buffer) => {
      stderrBuf += d.toString()
    })

    proc.on("error", (e: NodeJS.ErrnoException) => {
      resolve({
        available: false,
        findings: [],
        error:
          (e as NodeJS.ErrnoException).code === "ENOENT"
            ? "gitleaks not installed"
            : e.message,
        scannedAt: new Date().toISOString(),
      })
    })

    proc.on("close", async (_code: number | null) => {
      // gitleaks exits non-zero when findings are present — treat any read as "available=true".
      // Only proc.on("error") means the binary is missing.
      try {
        const raw = await readFile(tmpReport, "utf8").catch(() => "[]")
        const list = JSON.parse(raw || "[]") as Record<string, unknown>[]

        const findings: SecretFinding[] = list.map((r) => {
          const match = String(r["Match"] ?? "")
          return {
            ruleId: String(r["RuleID"] ?? "unknown"),
            file: String(r["File"] ?? ""),
            startLine: Number(r["StartLine"] ?? 0),
            matchRedacted: match,
            isDocExample: DOC_EXAMPLES.some((re) => re.test(match)),
          }
        })

        resolve({ available: true, findings, scannedAt: new Date().toISOString() })
      } catch (e) {
        resolve({
          available: true,
          findings: [],
          error: String((e as Error).message),
          scannedAt: new Date().toISOString(),
        })
      }
    })
  })
}

/**
 * appendScan — persist a scan result as an append-only JSONL line.
 * File: ${CAE_ROOT}/.cae/metrics/skill-scans.jsonl
 * T-14-05-02: Only metadata logged — no raw secret values.
 */
export async function appendScan(
  name: string,
  report: ScanResult
): Promise<void> {
  const caeRoot =
    process.env.CAE_ROOT ?? "/home/cae/ctrl-alt-elite"
  const file = path.join(caeRoot, ".cae/metrics/skill-scans.jsonl")

  await mkdir(path.dirname(file), { recursive: true }).catch(() => undefined)

  const entry = JSON.stringify({
    ts: report.scannedAt,
    name,
    findings: report.findings.length,
    redactedSample: report.findings
      .slice(0, 3)
      .map((f) => `${f.file}:${f.startLine} [${f.ruleId}]`),
    available: report.available,
    error: report.error,
  })

  await writeFile(file, entry + "\n", { flag: "a", encoding: "utf8" })
}
