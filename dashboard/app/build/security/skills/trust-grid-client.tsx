"use client"

/**
 * TrustGridClient — client wrapper for TrustGrid with override action wired.
 */
import { useState } from "react"
import type { CatalogSkill, TrustScore, Role } from "@/lib/cae-types"
import { TrustGrid } from "@/components/security/trust-grid"

type TrustEntry = { skill: CatalogSkill; trust: TrustScore }

export function TrustGridClient({
  entries: initialEntries,
  currentRole,
}: {
  entries: TrustEntry[]
  currentRole: Role | undefined
}) {
  const [entries, setEntries] = useState(initialEntries)

  async function handleOverride(owner: string, name: string, trusted: boolean) {
    await fetch("/api/security/trust-override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner, name, trusted }),
    })
    // Refresh trust scores after override
    const res = await fetch("/api/security/trust")
    if (res.ok) {
      const fresh = await res.json()
      setEntries(fresh)
    }
  }

  const trustedCount = entries.filter((e) => e.trust?.trusted).length

  return (
    <>
      <span className="sr-only" data-truth="build-security-skills.healthy">yes</span>
      <span className="sr-only" data-truth="build-security-skills.count">
        {entries.length}
      </span>
      <span
        className="sr-only"
        data-truth={entries.length === 0 ? "build-security-skills.empty" : "build-security-skills.nonempty"}
      >
        {entries.length === 0 ? "yes" : "no"}
      </span>
      <span className="sr-only" data-truth="build-security-skills.trusted-count">
        {trustedCount}
      </span>
      <TrustGrid
        entries={entries}
        currentRole={currentRole}
        onOverride={handleOverride}
      />
    </>
  )
}
