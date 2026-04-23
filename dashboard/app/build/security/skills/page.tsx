/**
 * /build/security/skills — Skill trust score sub-tab.
 *
 * Fetches trust scores server-side and renders TrustGrid.
 * Admin override capability wired through client component.
 */
import { auth } from "@/auth"
import type { Role, CatalogSkill, TrustScore } from "@/lib/cae-types"
import { SecurityClient } from "../security-client"
import { TrustGridClient } from "./trust-grid-client"

export const dynamic = "force-dynamic"

type TrustEntry = { skill: CatalogSkill; trust: TrustScore }

async function fetchTrustScores(cookieHeader: string): Promise<TrustEntry[]> {
  try {
    // Server-side fetch needs absolute URL
    const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000"
    const res = await fetch(`${base}/api/security/trust`, {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    })
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

export default async function SecuritySkillsPage() {
  const session = await auth()
  const role = (session?.user?.role ?? "viewer") as Role

  // Build cookie string for server-side fetch
  const { cookies } = await import("next/headers")
  const cookieStore = await cookies()
  const cookieHeader = cookieStore.toString()

  const entries = await fetchTrustScores(cookieHeader)

  return (
    <SecurityClient currentRole={role}>
      <TrustGridClient entries={entries} currentRole={role} />
    </SecurityClient>
  )
}
