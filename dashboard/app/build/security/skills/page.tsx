/**
 * /build/security/skills — Skill trust score sub-tab.
 *
 * Fetches trust scores server-side and renders TrustGrid.
 * Admin override capability wired through client component.
 */
import { auth } from "@/auth"
import type { Role } from "@/lib/cae-types"
import { SecurityClient } from "../security-client"
import { TrustGridClient } from "./trust-grid-client"
import { fetchTrustScores } from "./fetch-trust-scores"

export const dynamic = "force-dynamic"

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
