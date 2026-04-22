import { NextRequest, NextResponse } from "next/server"
import { describeCron } from "@/lib/cae-schedule-describe"

export const runtime = "nodejs"

/**
 * GET /api/schedule/next-run?cron=...&tz=...
 * Returns the next run time for a cron expression in a given timezone.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const cron = searchParams.get("cron")
  const tz = searchParams.get("tz") ?? "UTC"

  if (!cron) {
    return NextResponse.json({ error: "cron required" }, { status: 400 })
  }

  const { nextRun } = describeCron(cron, tz)
  if (!nextRun) {
    return NextResponse.json({ error: "invalid cron expression" }, { status: 400 })
  }

  return NextResponse.json({ nextRun: nextRun.toISOString() })
}
