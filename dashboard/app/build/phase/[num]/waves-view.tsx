"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { useDevMode } from "@/lib/providers/dev-mode"
import { labelFor, type Labels } from "@/lib/copy/labels"
import type { PhaseDetail, TaskStatus } from "@/lib/cae-phase-detail"

// Class 5G (2026-04-24): map task status → desaturated semantic badge variant.
// Pre-fix used the shadcn default/secondary/destructive variants which were
// filled-vivid and clashed with Linear-style muted content. New variants use
// the soft-tint pattern (10% bg, 30% border, colour text).
const STATUS_VARIANT: Record<
  TaskStatus,
  "neutral" | "info" | "success" | "danger"
> = {
  pending: "neutral",
  running: "info",
  merged: "success",
  failed: "danger",
}

interface WavesViewProps {
  detail: PhaseDetail
  projectPath: string
}

export function WavesView({ detail, projectPath }: WavesViewProps) {
  const router = useRouter()
  const { dev } = useDevMode()
  const t = labelFor(dev)

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 5000)
    return () => clearInterval(id)
  }, [router])

  if (detail.tasks.length === 0) {
    const phaseDir = `.planning/phases/${String(detail.number).padStart(2, "0")}-${detail.name}/`
    return (
      <p className="mt-8 text-sm text-muted-foreground">
        {t.noTasksEmpty(phaseDir)}
      </p>
    )
  }

  const waveMap = new Map<number, PhaseDetail["tasks"]>()
  for (const task of detail.tasks) {
    if (!waveMap.has(task.wave)) waveMap.set(task.wave, [])
    waveMap.get(task.wave)!.push(task)
  }
  const waves = Array.from(waveMap.entries()).sort(([a], [b]) => a - b)

  return (
    <div className="space-y-6">
      {waves.map(([waveNum, tasks]) => (
        <WaveSection
          key={waveNum}
          waveNum={waveNum}
          tasks={tasks}
          detail={detail}
          projectPath={projectPath}
          t={t}
        />
      ))}
      {detail.mergedCommits.length > 0 && (
        <div className="pt-4 border-t">
          <h3 className="text-sm font-medium mb-2 text-muted-foreground">{t.mergedCommitsHeading}</h3>
          <ul className="space-y-1">
            {detail.mergedCommits.map((c, i) => (
              <li key={i} className="font-mono text-xs text-muted-foreground">
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

interface WaveSectionProps {
  waveNum: number
  tasks: PhaseDetail["tasks"]
  detail: PhaseDetail
  projectPath: string
  t: Labels
}

function WaveSection({ waveNum, tasks, detail, projectPath, t }: WaveSectionProps) {
  const allMerged = tasks.every((task) => task.status === "merged")
  const anyFailed = tasks.some((task) => task.status === "failed")
  const anyRunning = tasks.some((task) => task.status === "running")
  const waveStatus: TaskStatus = anyFailed
    ? "failed"
    : anyRunning
      ? "running"
      : allMerged
        ? "merged"
        : "pending"

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-base font-semibold">{t.waveHeading(waveNum)}</h2>
        <Badge variant={STATUS_VARIANT[waveStatus]}>{waveStatus}</Badge>
      </div>
      <div className="grid gap-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.taskId}
            task={task}
            detail={detail}
            projectPath={projectPath}
            t={t}
          />
        ))}
      </div>
    </section>
  )
}

interface TaskCardProps {
  task: PhaseDetail["tasks"][0]
  detail: PhaseDetail
  projectPath: string
  t: Labels
}

function TaskCard({ task, detail, projectPath, t }: TaskCardProps) {
  const planFile = detail.planFiles.find((pf) => pf.filename === task.planFile)
  const taskName =
    planFile?.tasks.find(
      (task2) => `pl${planFile.frontmatter.plan}-t${task2.id}` === task.taskId,
    )?.name ?? task.taskId

  const tailParams = task.outputPath
    ? new URLSearchParams({ project: projectPath, tail: task.outputPath })
    : null

  return (
    <div className="rounded-lg border bg-card p-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <code className="text-xs text-muted-foreground font-mono">{task.taskId}</code>
          <Badge variant={STATUS_VARIANT[task.status]} className="text-xs">
            {task.status}
          </Badge>
          {task.attempts > 0 && (
            <span className="text-xs text-muted-foreground">{t.attemptSuffix(task.attempts)}</span>
          )}
        </div>
        <p className="text-sm font-medium truncate">{taskName}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.planFile}</p>
      </div>
      {tailParams && (
        <Link
          href={`/build/phase/${detail.number}?${tailParams.toString()}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
        >
          {t.viewOutputButton}
        </Link>
      )}
    </div>
  )
}
