export const dynamic = "force-dynamic"

import { listProjects } from "@/lib/cae-state"
import { BuildHomeHeading } from "@/components/shell/build-home-heading"
import { ProjectSelector } from "./project-selector"
import { LiveActivityPanel } from "@/components/build-home/live-activity-panel"
import { RollupStrip } from "@/components/build-home/rollup-strip"
import { LiveOpsLine } from "@/components/build-home/live-ops-line"
import { ActivePhaseCards } from "@/components/build-home/active-phase-cards"
import { NeedsYouList } from "@/components/build-home/needs-you-list"
import { RecentLedger } from "@/components/build-home/recent-ledger"
import { TaskDetailSheet } from "@/components/build-home/task-detail-sheet"
import { MissionControlHero } from "@/components/build-home/mission-control-hero"
import { FloorPin } from "@/components/build-home/floor-pin"
import { resolveCbPath } from "@/lib/floor/cb-path"

interface BuildPageProps {
  searchParams: Promise<{ project?: string }>
}

export default async function BuildPage({ searchParams }: BuildPageProps) {
  const { project: projectParam } = await searchParams
  const allProjects = await listProjects()

  const selected =
    (projectParam ? allProjects.find((p) => p.path === projectParam) : undefined) ??
    allProjects[0]

  const projectName = selected?.name ?? "no project"
  const cbPath = resolveCbPath(selected?.path ?? null)

  return (
    <main data-testid="build-home" className="p-6 max-w-7xl">
      <div className="flex items-center gap-3 mb-4">
        <BuildHomeHeading projectName={projectName} />
        {allProjects.length > 0 && selected && (
          <ProjectSelector projects={allProjects} selected={selected} />
        )}
      </div>

      {/* Mission Control hero — full-bleed banner ABOVE the live-activity stack
          (Phase 15 Wave 3.1). Always renders so the banner is the first thing
          a returning user sees. */}
      <div className="mb-6">
        <MissionControlHero />
      </div>

      {/* Two-column layout on desktop: main stack + Live Floor pin (3.2). */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6 min-w-0">
          <LiveActivityPanel />
          <RollupStrip />
          <LiveOpsLine />
          <ActivePhaseCards />
          <NeedsYouList />
          <RecentLedger />
        </div>

        <aside className="hidden lg:block">
          <FloorPin cbPath={cbPath} projectPath={selected?.path ?? null} />
        </aside>
      </div>

      <TaskDetailSheet />
    </main>
  )
}
