import React, { Suspense } from "react"
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
import { Skeleton } from "@/components/ui/skeleton"

/**
 * /build/skills — Skills Hub landing page.
 *
 * Shell renders immediately; slow catalog/git fetches are deferred into a
 * <Suspense> boundary so DOMContentLoaded fires on the shell HTML rather than
 * waiting for network calls to skills.sh and clawhub.ai.
 *
 * Each external fetch has an 8 s AbortSignal.timeout (cae-skills-scrape-*.ts)
 * so the Suspense boundary resolves in ≤8 s even when external services are
 * unreachable.
 */
export default function SkillsPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="type-hero" data-testid="skills-page-heading">Skills</h1>
        <p className="type-body mt-1 text-[color:var(--text-muted)]">
          Browse, install, and manage Claude Code skills from the community.
        </p>
      </div>

      <Suspense fallback={<SkillsLoadingSkeleton />}>
        <SkillsContent />
      </Suspense>
    </div>
  )
}

async function SkillsContent() {
  const [catalog, session, lastUpdatedMap, recentCommits] = await Promise.all([
    getCatalog().catch(() => []),
    auth(),
    getSkillsLastUpdatedMap().catch(() => ({})),
    getRecentSkillsCommits(20).catch(() => []),
  ])
  const currentRole: Role = (session?.user?.role as Role | undefined) ?? "viewer"
  const enriched = enrichSkillsWithLastUpdated(catalog, lastUpdatedMap)

  return (
    <>
      <SkillsClient catalog={enriched} currentRole={currentRole} />
      <RecentEditsTimeline commits={recentCommits} />
    </>
  )
}

function SkillsLoadingSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading skills catalog"
      data-testid="skills-loading-skeleton"
    >
      <span className="sr-only" data-truth="build-skills.loading">yes</span>
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}
