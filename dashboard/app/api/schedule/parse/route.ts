import { NextRequest, NextResponse } from "next/server"
import { parseSchedule } from "@/lib/cae-schedule-parse"
import { describeCron } from "@/lib/cae-schedule-describe"

export const runtime = "nodejs"

/**
 * In-memory rate limiter: 10 requests per 60s per IP.
 * T-14-03-03: DoS / LLM cost abuse mitigation.
 * Limitation: resets on server restart (documented, sufficient for v0.1).
 */
const bucket = new Map<string, { count: number; resetAt: number }>()

function rateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000
): boolean {
  const now = Date.now()
  const b = bucket.get(key)
  if (!b || b.resetAt < now) {
    bucket.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (b.count >= limit) return false
  b.count++
  return true
}

/**
 * POST /api/schedule/parse
 *
 * Body: { nl: string; timezone?: string }
 * Returns: { cron, source, confidence, english, nextRun }
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "local"
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 })
  }

  let body: { nl?: string; timezone?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 })
  }

  const nl = body.nl
  if (typeof nl !== "string" || !nl.trim()) {
    return NextResponse.json({ error: "nl required" }, { status: 400 })
  }

  const timezone = typeof body.timezone === "string" ? body.timezone : "UTC"

  try {
    const parsed = await parseSchedule(nl)
    const { english, nextRun } = describeCron(parsed.cron, timezone)
    return NextResponse.json({
      ...parsed,
      english,
      nextRun: nextRun?.toISOString() ?? null,
    })
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 422 }
    )
  }
}
