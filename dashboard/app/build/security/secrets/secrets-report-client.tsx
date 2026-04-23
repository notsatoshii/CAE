"use client"

import { SecretsReport } from "@/components/security/secrets-report"
import type { Role, CatalogSkill } from "@/lib/cae-types"
import type { ScanResult } from "@/lib/cae-secrets-scan"

export function SecretsReportClient({
  scans,
  currentRole,
}: {
  scans: Array<{ skill: CatalogSkill; result: ScanResult }>
  currentRole: Role | undefined
}) {
  async function handleRescan(skillName: string) {
    await fetch(`/api/security/scan/${encodeURIComponent(skillName)}`, {
      method: "POST",
    })
  }

  return (
    <SecretsReport scans={scans} currentRole={currentRole} onRescan={handleRescan} />
  )
}
