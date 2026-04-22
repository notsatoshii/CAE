import React from "react"
import { readTasks } from "@/lib/cae-schedule-store"
import { ScheduleClient } from "./schedule-client"

export const dynamic = "force-dynamic"

export default async function SchedulePage() {
  let tasks: Awaited<ReturnType<typeof readTasks>> = []
  try {
    tasks = await readTasks()
  } catch {
    // If store is unavailable, render with empty list
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-[color:var(--text,#e5e5e5)]">
          Schedules
        </h1>
        <p className="mt-1 text-sm text-[color:var(--text-muted,#8a8a8c)]">
          Describe a recurring task in plain English and CAE will run it on schedule.
        </p>
      </div>
      <ScheduleClient initialTasks={tasks} />
    </div>
  )
}
