/**
 * /build/security/audit — Tool audit log sub-tab.
 *
 * Operator+ required (also enforced in middleware).
 * Fetches last 7 days of audit entries server-side.
 */
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { isAtLeast } from "@/lib/cae-rbac"
import type { Role } from "@/lib/cae-types"
import type { AuditEntry } from "@/lib/cae-types"
import { SecurityClient } from "../security-client"
import { AuditTable } from "@/components/security/audit-table"

export const dynamic = "force-dynamic"

async function fetchAudit(
  cookieHeader: string
): Promise<{ entries: AuditEntry[]; total: number }> {
  try {
    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000"
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const res = await fetch(
      `${base}/api/security/audit?from=${from}&limit=200`,
      { headers: { Cookie: cookieHeader }, cache: "no-store" }
    )
    if (!res.ok) return { entries: [], total: 0 }
    return res.json()
  } catch {
    return { entries: [], total: 0 }
  }
}

export default async function SecurityAuditPage() {
  const session = await auth()
  const role = (session?.user?.role ?? "viewer") as Role

  // Double-check operator requirement (middleware is first line)
  if (!isAtLeast(role, "operator")) {
    redirect("/403")
  }

  const { cookies } = await import("next/headers")
  const cookieStore = await cookies()
  const cookieHeader = cookieStore.toString()

  const initial = await fetchAudit(cookieHeader)

  return (
    <SecurityClient currentRole={role}>
      <AuditTable initial={initial} />
    </SecurityClient>
  )
}
