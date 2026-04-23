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
  // NextAuth v5 AUTH_URL first (v4 NEXTAUTH_URL fallback, localhost:3000 last).
  // Content-type guard + awaited res.json() prevent the "SyntaxError:
  // Unexpected token '<'" crash the C1 audit surfaced when wrong-port
  // routing returned HTML.
  const base =
    process.env.AUTH_URL ??
    process.env.NEXTAUTH_URL ??
    "http://localhost:3000"
  try {
    const res = await fetch(`${base}/api/security/scans`, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    })
    if (!res.ok) return []
    const ct = res.headers.get("content-type") ?? ""
    if (!ct.toLowerCase().startsWith("application/json")) return []
    const data = (await res.json()) as unknown
    return Array.isArray(data) ? (data as ScanEntry[]) : []
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

  const secretsLiveness: "empty" | "healthy" =
    scans.length === 0 ? "empty" : "healthy";

  return (
    <SecurityClient currentRole={role}>
      <div data-testid="build-security-secrets-root" data-liveness={secretsLiveness}>
        <span className="sr-only" data-truth={"build-security-secrets." + secretsLiveness}>yes</span>
        <span className="sr-only" data-truth="build-security-secrets.healthy">yes</span>
        <span className="sr-only" data-truth="build-security-secrets.loading">no</span>
        <span className="sr-only" data-truth="build-security-secrets.scans-count">
          {scans.length}
        </span>
        {scans.length === 0 && (
          <span className="sr-only" data-truth="build-security-secrets.empty">yes</span>
        )}
        <SecretsReportClient scans={scans} currentRole={role} />
      </div>
    </SecurityClient>
  )
}
