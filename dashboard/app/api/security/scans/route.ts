/**
 * GET /api/security/scans
 *
 * Returns the latest scan result per skill, aggregated from
 * .cae/metrics/skill-scans.jsonl (most recent entry per skill name wins).
 *
 * Requires operator+ role.
 */
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { requireRole } from "@/lib/cae-rbac"
import type { Role } from "@/lib/cae-types"
import { readFile } from "node:fs/promises"
import path from "node:path"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface ScanEntry {
  ts: string
  name: string
  findings: number
  available: boolean
  redactedSample?: string[]
  error?: string
}

export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!requireRole(session?.user?.role as Role | undefined, "operator")) {
    return NextResponse.json({ error: "forbidden", required: "operator" }, { status: 403 })
  }

  const caeRoot = process.env.CAE_ROOT ?? "/home/cae/ctrl-alt-elite"
  const file = path.join(caeRoot, ".cae/metrics/skill-scans.jsonl")

  let raw: string
  try {
    raw = await readFile(file, "utf8")
  } catch {
    return NextResponse.json([])
  }

  // Parse JSONL and keep latest entry per skill name
  const latest = new Map<string, ScanEntry>()
  for (const line of raw.split("\n").filter(Boolean)) {
    try {
      const entry = JSON.parse(line) as ScanEntry
      if (typeof entry.name === "string" && typeof entry.ts === "string") {
        const existing = latest.get(entry.name)
        if (!existing || entry.ts > existing.ts) {
          latest.set(entry.name, entry)
        }
      }
    } catch {
      // Skip malformed lines
    }
  }

  return NextResponse.json([...latest.values()])
}
