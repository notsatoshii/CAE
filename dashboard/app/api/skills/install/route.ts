import { NextRequest, NextResponse } from "next/server"
import { installSkill } from "@/lib/cae-skills-install"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
 *   - spawn uses argv array, never shell:true
 *   - invalid repo → 400 before any child process is started
 *
 * TODO(14-04): Add operator role gate via NextAuth middleware.
 */
export async function POST(req: NextRequest) {
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
      try {
        for await (const ev of stream) {
          controller.enqueue(
            enc.encode(`event: ${ev.type}\ndata: ${JSON.stringify(ev.data)}\n\n`)
          )
        }
      } catch (err) {
        controller.enqueue(
          enc.encode(`event: error\ndata: ${JSON.stringify(String(err))}\n\n`)
        )
      } finally {
        controller.close()
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
