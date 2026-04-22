import React from "react"
import { getCatalog } from "@/lib/cae-skills-catalog"
import { SkillsClient } from "./skills-client"

/**
 * /build/skills — Skills Hub landing page.
 *
 * Server component: SSR-loads the initial catalog from 3 sources (skills.sh,
 * ClawHub, local) then hands off to SkillsClient for tab switching, detail
 * drawer, and install UX.
 *
 * REQ-P14-01, REQ-P14-02, REQ-P14-03.
 */
export default async function SkillsPage() {
  let catalog = await getCatalog().catch(() => [])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Skills</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Browse, install, and manage Claude Code skills from the community.
        </p>
      </div>

      <SkillsClient catalog={catalog} />
    </div>
  )
}
