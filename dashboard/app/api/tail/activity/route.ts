/**
 * /api/tail/activity — Class 15A.
 *
 * SSE stream that tails the canonical activity.jsonl. Lets the
 * <ActivityFeed /> card render new rows the moment they land without
 * polling /api/state every 3s. Mirrors the /api/tail shape but is
 * activity-specific (no ?path= query needed) — removes the path-safety
 * surface area and makes the client wiring a one-liner.
 */

import { NextRequest } from "next/server"
import { join } from "node:path"
import { createTailStream } from "@/lib/tail-stream"
import { CAE_ROOT } from "@/lib/cae-config"
import { withLog } from "@/lib/with-log"

export const dynamic = "force-dynamic"

async function getHandler(req: NextRequest) {
  // Allow a ?project= override so multi-project dashboards can tail each
  // project's activity.jsonl independently. Defaults to CAE_ROOT.
  const project = req.nextUrl.searchParams.get("project") ?? CAE_ROOT
  const filePath = join(project, ".cae", "metrics", "activity.jsonl")

  const controller = new AbortController()
  // Propagate request abort to the tail stream so resources release when
  // the client disconnects.
  req.signal.addEventListener("abort", () => controller.abort())

  const tail = createTailStream(filePath, controller.signal)
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(sc) {
      const reader = tail.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (value.length === 0) continue
          sc.enqueue(encoder.encode(`data: ${value}\n\n`))
        }
      } catch {
        // fall through to close
      } finally {
        sc.close()
      }
    },
    cancel() {
      controller.abort()
    },
  })

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}

export const GET = withLog(getHandler, "/api/tail/activity")
