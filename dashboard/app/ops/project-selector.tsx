"use client"

import { useRouter } from "next/navigation"
import { ChevronDownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Project } from "@/lib/cae-types"

interface ProjectSelectorProps {
  projects: Project[]
  selected: Project
}

export function ProjectSelector({ projects, selected }: ProjectSelectorProps) {
  const router = useRouter()

  function pick(path: string) {
    const params = new URLSearchParams({ project: path })
    router.push(`/ops?${params.toString()}`)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 h-8 text-sm font-medium hover:bg-muted transition-colors"
      >
        {selected.name}
        <ChevronDownIcon className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {projects.map((p) => (
          <DropdownMenuItem
            key={p.path}
            onClick={() => pick(p.path)}
            className={p.path === selected.path ? "bg-accent" : ""}
          >
            {p.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
