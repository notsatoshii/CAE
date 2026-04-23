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

  return (
    <main data-testid="build-home" className="p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-4">
        <BuildHomeHeading projectName={projectName} />
        {allProjects.length > 0 && selected && (
          <ProjectSelector projects={allProjects} selected={selected} />
        )}
      </div>

      <div className="flex flex-col gap-6">
        <LiveActivityPanel />
        <RollupStrip />
        <LiveOpsLine />
        <ActivePhaseCards />
        <NeedsYouList />
        <RecentLedger />
      </div>

      <TaskDetailSheet />
    </main>
  )
}
