import React from "react"
import { getCatalog } from "@/lib/cae-skills-catalog"
import { auth } from "@/auth"
import { SkillsClient } from "./skills-client"
import type { Role } from "@/lib/cae-types"
import {
  getSkillsLastUpdatedMap,
  getRecentSkillsCommits,
} from "@/lib/skills/last-updated"
import { enrichSkillsWithLastUpdated } from "@/lib/skills/enrich"
import { RecentEditsTimeline } from "@/components/skills/recent-edits-timeline"

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
 * Skills/class19c: enriches catalog with per-skill last-updated sourced from
 * git log, and renders a "Recent edits" timeline panel of the last 20 commits
 * touching any skill directory. Both memoized 60s server-side.
 *
 * REQ-P14-01, REQ-P14-02, REQ-P14-03.
 */
export default async function SkillsPage() {
  const [catalog, session, lastUpdatedMap, recentCommits] = await Promise.all([
    getCatalog().catch(() => []),
    auth(),
    getSkillsLastUpdatedMap().catch(() => ({})),
    getRecentSkillsCommits(20).catch(() => []),
  ])
  const currentRole: Role = (session?.user?.role as Role | undefined) ?? "viewer"

  const enriched = enrichSkillsWithLastUpdated(catalog, lastUpdatedMap)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="type-hero" data-testid="skills-page-heading">Skills</h1>
        <p className="type-body mt-1 text-[color:var(--text-muted)]">
          Browse, install, and manage Claude Code skills from the community.
        </p>
      </div>

      <SkillsClient catalog={enriched} currentRole={currentRole} />

      <RecentEditsTimeline commits={recentCommits} />
    </div>
  )
}
