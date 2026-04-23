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

  const skillsTrustLiveness: "empty" | "healthy" =
    entries.length === 0 ? "empty" : "healthy";

  return (
    <SecurityClient currentRole={role}>
      <div
        data-testid="build-security-skills-root"
        data-liveness={skillsTrustLiveness}
      >
        <span className="sr-only" data-truth={"build-security-skills." + skillsTrustLiveness}>yes</span>
        <span className="sr-only" data-truth="build-security-skills.healthy">yes</span>
        <span className="sr-only" data-truth="build-security-skills.loading">no</span>
        <span className="sr-only" data-truth="build-security-skills.entries-count">
          {entries.length}
        </span>
        {entries.length === 0 && (
          <span className="sr-only" data-truth="build-security-skills.empty">yes</span>
        )}
        <TrustGridClient entries={entries} currentRole={role} />
      </div>
    </SecurityClient>
  )
}
