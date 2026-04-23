"use client"

/**
 * SecretsReport — gitleaks findings grouped by skill with rescan button.
 *
 * Doc-example findings are tagged with "likely example" badge.
 * Rescan button triggers POST /api/security/scan/[name] (operator+).
 */
import { useState } from "react"
import type { CatalogSkill } from "@/lib/cae-types"
import type { ScanResult, SecretFinding } from "@/lib/cae-secrets-scan"
import { RoleGate } from "@/components/auth/role-gate"
import type { Role } from "@/lib/cae-types"

export type SecretsReportProps = {
  scans: Array<{ skill: CatalogSkill; result: ScanResult }>
  currentRole: Role | undefined
  onRescan?: (skillName: string) => Promise<void>
}

function FindingRow({ finding }: { finding: SecretFinding }) {
  return (
    <div className="flex items-start gap-2 border-t border-zinc-800 py-2 text-xs">
      <span className="font-mono text-zinc-400">{finding.ruleId}</span>
      <span className="flex-1 truncate text-zinc-500">
        {finding.file}:{finding.startLine}
      </span>
      {finding.isDocExample && (
        <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-zinc-400">
          likely example
        </span>
      )}
    </div>
  )
}

export function SecretsReport({ scans, currentRole, onRescan }: SecretsReportProps) {
  const [rescanning, setRescanning] = useState<string | null>(null)

  if (scans.length === 0) {
    return (
      <p data-testid="secrets-empty" className="text-sm text-zinc-500">
        No scans available. Install a skill to trigger automatic scanning.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {scans.map(({ skill, result }) => {
        const realFindings = result.findings.filter((f) => !f.isDocExample)
        const docExamples = result.findings.filter((f) => f.isDocExample)

        return (
          <div
            key={skill.name}
            className="rounded border border-zinc-800 bg-zinc-900/50"
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <span className="flex-1 text-sm font-medium text-zinc-200">
                {skill.name}
              </span>
              {!result.available && (
                <span className="text-xs text-amber-400">gitleaks unavailable</span>
              )}
              {result.available && realFindings.length === 0 && (
                <span className="text-xs text-emerald-400">No findings</span>
              )}
              {result.available && realFindings.length > 0 && (
                <span className="text-xs text-red-400">
                  {realFindings.length} finding{realFindings.length !== 1 ? "s" : ""}
                </span>
              )}
              <RoleGate role="operator" currentRole={currentRole}>
                <button
                  type="button"
                  data-testid={`rescan-btn-${skill.name}`}
                  disabled={rescanning === skill.name}
                  onClick={async () => {
                    setRescanning(skill.name)
                    try {
                      await onRescan?.(skill.name)
                    } finally {
                      setRescanning(null)
                    }
                  }}
                  className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400
                    hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-50"
                >
                  {rescanning === skill.name ? "Scanning…" : "Rescan"}
                </button>
              </RoleGate>
            </div>

            {result.findings.length > 0 && (
              <div className="px-4 pb-3">
                {result.findings.map((f, i) => (
                  <FindingRow key={i} finding={f} />
                ))}
                {docExamples.length > 0 && (
                  <p className="mt-2 text-xs text-zinc-600">
                    {docExamples.length} likely doc-example{docExamples.length !== 1 ? "s" : ""} (excluded from risk count)
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
