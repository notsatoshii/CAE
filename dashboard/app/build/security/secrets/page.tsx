/**
 * /build/security/secrets — Secret scan sub-tab.
 *
 * Fetches latest scan results server-side and renders SecretsReport.
 */
import { auth } from "@/auth"
import type { Role, CatalogSkill } from "@/lib/cae-types"
import type { ScanResult } from "@/lib/cae-secrets-scan"
import { SecurityClient } from "../security-client"
import { SecretsReportClient } from "./secrets-report-client"

export const dynamic = "force-dynamic"

type ScanEntry = {
  ts: string
  name: string
  findings: number
  available: boolean
  redactedSample?: string[]
  error?: string
}

async function fetchScans(cookieHeader: string): Promise<ScanEntry[]> {
  try {
    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000"
    const res = await fetch(`${base}/api/security/scans`, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function SecuritySecretsPage() {
  const session = await auth()
  const role = (session?.user?.role ?? "viewer") as Role

  const { cookies } = await import("next/headers")
  const cookieStore = await cookies()
  const cookieHeader = cookieStore.toString()

  const scanEntries = await fetchScans(cookieHeader)

  // Convert scan entries to SecretsReport shape
  const scans = scanEntries.map((entry) => ({
    skill: {
      name: entry.name,
      owner: "local",
      source: "local" as const,
      description: "",
      installCmd: "",
      detailUrl: "",
      installed: true,
    } satisfies CatalogSkill,
    result: {
      available: entry.available,
      findings: [], // Full findings not stored in JSONL — show count only
      scannedAt: entry.ts,
      error: entry.error,
    } satisfies ScanResult,
  }))

  return (
    <SecurityClient currentRole={role}>
      <SecretsReportClient scans={scans} currentRole={role} />
    </SecurityClient>
  )
}
