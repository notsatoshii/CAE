import React from "react"
import { getCatalog } from "@/lib/cae-skills-catalog"
import { auth } from "@/auth"
import { SkillsClient } from "./skills-client"
import type { Role } from "@/lib/cae-types"

/**
 * /build/skills — Skills Hub landing page.
 *
 * Server component: SSR-loads the initial catalog from 3 sources (skills.sh,
 * ClawHub, local) then hands off to SkillsClient for tab switching, detail
 * drawer, and install UX.
 *
 * Phase 14 Plan 04: passes currentRole to SkillsClient so InstallButton
 * can be disabled for viewer-role users.
 *
 * REQ-P14-01, REQ-P14-02, REQ-P14-03.
 */
export default async function SkillsPage() {
  const [catalog, session] = await Promise.all([
    getCatalog().catch(() => []),
    auth(),
  ])
  const currentRole: Role = (session?.user?.role as Role | undefined) ?? "viewer"

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Skills</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Browse, install, and manage Claude Code skills from the community.
        </p>
      </div>

      <SkillsClient catalog={catalog} currentRole={currentRole} />
    </div>
  )
}
