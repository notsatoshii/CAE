export const dynamic = "force-dynamic"

import { listPhases, listProjects } from "@/lib/cae-state"
import { ProjectSelector } from "./project-selector"
import { BreakersPanel } from "./breakers-panel"
import { PhasesList } from "./phases-list"
import { MetricsTabs } from "./metrics-tabs"

interface OpsPageProps {
  searchParams: Promise<{ project?: string }>
}

export default async function OpsPage({ searchParams }: OpsPageProps) {
  const { project: projectParam } = await searchParams
  const allProjects = await listProjects()

  const selected =
    (projectParam ? allProjects.find((p) => p.path === projectParam) : undefined) ??
    allProjects[0]

  const phases = selected ? await listPhases(selected.path) : []

  return (
    <main className="p-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Ops —{" "}
          <span className="text-muted-foreground font-normal">
            {selected?.name ?? "no project"}
          </span>
        </h1>
        {allProjects.length > 0 && selected && (
          <ProjectSelector projects={allProjects} selected={selected} />
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Live phase execution status for this project. Refreshes every 5 seconds.
      </p>
      <BreakersPanel projectPath={selected?.path ?? ""} />
      <PhasesList phases={phases} projectPath={selected?.path ?? ""} />
      <MetricsTabs projectPath={selected?.path ?? ""} />
    </main>
  )
}
