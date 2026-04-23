import { NextRequest, NextResponse } from "next/server"
import { installSkill, isSafeRepo } from "@/lib/cae-skills-install"
import { auth } from "@/auth"
import { requireRole } from "@/lib/cae-rbac"
import type { Role } from "@/lib/cae-types"
import { scanSkill, appendScan } from "@/lib/cae-secrets-scan"
import path from "node:path"
import os from "node:os"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Safe segment regex — used to re-validate the derived skillName before
 * passing it to path.join(). Must start with alnum/underscore, no leading
 * dots or dashes, and must not be the pure-dot tokens `.` or `..`.
 *
 * CR-02: defense-in-depth on top of isSafeRepo() in cae-skills-install.ts.
 */
const SAFE_NAME_RE = /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/

/**
 * POST /api/skills/install
 * Body: { repo: string } — owner/name slug or https://github.com/... URL
 *
 * Returns an SSE stream of InstallEvent objects:
 *   event: line\ndata: "...\n"\n\n
 *   event: err\ndata: "...\n"\n\n
 *   event: done\ndata: "0"\n\n
 *
 * Security:
 *   - repo validated by installSkill() against allowlist regex (T-14-02-01)
 *   - skillName re-validated before path.join (CR-02)
 *   - spawn uses argv array, never shell:true
 *   - invalid repo → 400 before any child process is started
 *   - operator role required (T-14-04 defense-in-depth; middleware is first line)
 */
export async function POST(req: NextRequest) {
  // Defense-in-depth: re-check role in handler (middleware may be bypassed by
  // URL encoding tricks — STRIDE T-14-04-03).
  const session = await auth()
  if (!requireRole(session?.user?.role as Role | undefined, "operator")) {
    return NextResponse.json({ error: "forbidden", required: "operator" }, { status: 403 })
  }

  let body: { repo?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })
  }

  if (typeof body.repo !== "string" || !body.repo) {
    return NextResponse.json(
      { error: "repo required — provide owner/name or GitHub URL" },
      { status: 400 }
    )
  }

  // CR-02: derive skillName via explicit regex match (not split().pop()) so we
  // never accidentally pass a `..` or leading-dash token to path.join.
  // Strip URL prefix and tree suffix, then extract owner/name via REPO_RE.
  const repoPart = body.repo
    .replace(/^https?:\/\/github\.com\//, "")
    .split("/tree/")[0]
  const slugMatch = /^([A-Za-z0-9_][A-Za-z0-9_.-]*)\/([A-Za-z0-9_][A-Za-z0-9_.-]*)$/.exec(repoPart)
  if (!slugMatch) {
    return NextResponse.json({ error: "invalid repo" }, { status: 400 })
  }
  const skillName = slugMatch[2]
  // Belt-and-suspenders: reject pure-dot tokens even if regex somehow passed them
  if (skillName === "." || skillName === ".." || !SAFE_NAME_RE.test(skillName)) {
    return NextResponse.json({ error: "invalid repo" }, { status: 400 })
  }

  let stream: AsyncIterable<{ type: string; data: string }>
  try {
    stream = installSkill(body.repo)
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    )
  }

  const enc = new TextEncoder()
  const body_ = new ReadableStream({
    async start(controller) {
      let installSucceeded = false
      try {
        for await (const ev of stream) {
          controller.enqueue(
            enc.encode(`event: ${ev.type}\ndata: ${JSON.stringify(ev.data)}\n\n`)
          )
          if (ev.type === "done" && ev.data === "0") {
            installSucceeded = true
          }
        }
      } catch (err) {
        controller.enqueue(
          enc.encode(`event: error\ndata: ${JSON.stringify(String(err))}\n\n`)
        )
      } finally {
        controller.close()
        // T-14-05-06: Fire-and-forget scan after successful install.
        // Does NOT block the SSE response. Scan failure is logged but never surfaced here.
        // skillName is pre-validated above — safe to join with skillsDir.
        if (installSucceeded) {
          const skillsDir = process.env.CAE_SKILLS_DIR ?? path.join(os.homedir(), ".claude", "skills")
          const skillDir = path.join(skillsDir, skillName)
          // CR-02 final guard: resolved path must stay inside skillsDir
          const resolved = path.resolve(skillDir)
          const resolvedRoot = path.resolve(skillsDir)
          if (resolved.startsWith(resolvedRoot + path.sep) || resolved === resolvedRoot) {
            scanSkill(skillDir)
              .then((result) => appendScan(skillName, result))
              .catch(() => undefined)
          }
        }
      }
    },
  })

  return new Response(body_, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
