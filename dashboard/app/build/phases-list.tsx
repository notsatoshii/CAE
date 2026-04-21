"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Phase } from "@/lib/cae-types"

const STATUS_VARIANT: Record<Phase["status"], "default" | "secondary" | "destructive" | "outline"> = {
  idle: "outline",
  active: "default",
  done: "secondary",
  failed: "destructive",
}

interface PhasesListProps {
  phases: Phase[]
  projectPath: string
}

export function PhasesList({ phases, projectPath }: PhasesListProps) {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => router.refresh(), 5000)
    return () => clearInterval(id)
  }, [router])

  if (phases.length === 0) {
    return (
      <p className="mt-8 text-sm text-muted-foreground">
        No phases in this project yet. Run{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">/gsd-plan-phase</code>{" "}
        or{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">cae-init</code>{" "}
        to scaffold.
      </p>
    )
  }

  const params = new URLSearchParams({ project: projectPath })

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">#</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-24">Plans</TableHead>
          <TableHead className="w-20">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {phases.map((phase) => (
          <TableRow key={phase.number}>
            <TableCell className="font-mono text-muted-foreground">
              {String(phase.number).padStart(2, "0")}
            </TableCell>
            <TableCell className="font-medium">{phase.name}</TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[phase.status]}>
                {phase.status}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground">
              {phase.planFiles.length}
            </TableCell>
            <TableCell>
              <Link
                href={`/build/phase/${phase.number}?${params.toString()}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
              >
                View
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
