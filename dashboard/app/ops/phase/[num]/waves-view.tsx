"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import type { PhaseDetail, TaskStatus } from "@/lib/cae-phase-detail"

const STATUS_VARIANT: Record<
  TaskStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  running: "default",
  merged: "secondary",
  failed: "destructive",
}

interface WavesViewProps {
  detail: PhaseDetail
  projectPath: string
}

export function WavesView({ detail, projectPath }: WavesViewProps) {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 5000)
    return () => clearInterval(id)
  }, [router])

  if (detail.tasks.length === 0) {
    return (
      <p className="mt-8 text-sm text-muted-foreground">
        No tasks found. Check plan files in{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">
          .planning/phases/{String(detail.number).padStart(2, "0")}-{detail.name}/
        </code>
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
        />
      ))}
      {detail.mergedCommits.length > 0 && (
        <div className="pt-4 border-t">
          <h3 className="text-sm font-medium mb-2 text-muted-foreground">Merged commits</h3>
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
}

function WaveSection({ waveNum, tasks, detail, projectPath }: WaveSectionProps) {
  const allMerged = tasks.every((t) => t.status === "merged")
  const anyFailed = tasks.some((t) => t.status === "failed")
  const anyRunning = tasks.some((t) => t.status === "running")
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
        <h2 className="text-base font-semibold">Wave {waveNum}</h2>
        <Badge variant={STATUS_VARIANT[waveStatus]}>{waveStatus}</Badge>
      </div>
      <div className="grid gap-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.taskId}
            task={task}
            detail={detail}
            projectPath={projectPath}
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
}

function TaskCard({ task, detail, projectPath }: TaskCardProps) {
  const planFile = detail.planFiles.find((pf) => pf.filename === task.planFile)
  const taskName =
    planFile?.tasks.find(
      (t) => `pl${planFile.frontmatter.plan}-t${t.id}` === task.taskId,
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
            <span className="text-xs text-muted-foreground">{task.attempts}× attempt</span>
          )}
        </div>
        <p className="text-sm font-medium truncate">{taskName}</p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{task.planFile}</p>
      </div>
      {tailParams && (
        <Link
          href={`/ops/phase/${detail.number}?${tailParams.toString()}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}
        >
          View output
        </Link>
      )}
    </div>
  )
}
