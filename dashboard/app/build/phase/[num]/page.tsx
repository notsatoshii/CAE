export const dynamic = "force-dynamic"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { listProjects } from "@/lib/cae-state"
import { getPhaseDetail } from "@/lib/cae-phase-detail"
import { WavesView } from "./waves-view"
import { TailSheet } from "@/components/tail-sheet"

interface PhasePageProps {
  params: Promise<{ num: string }>
  searchParams: Promise<{ project?: string; tail?: string }>
}

export default async function PhasePage({ params, searchParams }: PhasePageProps) {
  const { num } = await params
  const { project: projectParam, tail: tailParam } = await searchParams

  const allProjects = await listProjects()
  const selected =
    (projectParam ? allProjects.find((p) => p.path === projectParam) : undefined) ??
    allProjects[0]

  const phaseNumber = parseInt(num, 10)
  const detail = selected ? await getPhaseDetail(selected.path, phaseNumber) : null

  const backParams = new URLSearchParams({ project: selected?.path ?? "" })
  const phaseHref = `/build/phase/${num}?${backParams.toString()}`

  return (
    <main className="p-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-2">
        <Link
          href={`/build?${backParams.toString()}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "text-muted-foreground")}
        >
          ← Build
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Phase {String(phaseNumber).padStart(2, "0")} —{" "}
          <span className="text-muted-foreground font-normal">
            {detail?.name ?? "unknown"}
          </span>
        </h1>
      </div>
      {detail?.currentBranch && (
        <p className="text-sm text-muted-foreground mb-6">
          Branch:{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">{detail.currentBranch}</code>
        </p>
      )}
      {detail ? (
        <WavesView detail={detail} projectPath={selected?.path ?? ""} />
      ) : (
        <p className="mt-8 text-sm text-muted-foreground">No project selected.</p>
      )}
      {tailParam && <TailSheet tail={tailParam} backHref={phaseHref} />}
    </main>
  )
}
