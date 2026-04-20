import { NextRequest } from "next/server"
import path from "path"
import { createTailStream } from "@/lib/tail-stream"

const CWD = process.cwd()

const ALLOWED_ROOTS = [
  path.resolve(CWD, ".cae", "metrics"),
  path.resolve(CWD, ".cae", "logs"),
  path.resolve(CWD, ".planning", "phases"),
  "/home/cae/outbox",
]

function isAllowed(filePath: string): boolean {
  const resolved = path.resolve(filePath)
  return ALLOWED_ROOTS.some(
    (root) => resolved === root || resolved.startsWith(root + path.sep)
  )
}

export async function GET(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get("path")
  if (!filePath) {
    return new Response("Missing path", { status: 400 })
  }

  if (!isAllowed(filePath)) {
    return new Response("Forbidden", { status: 403 })
  }

  const controller = new AbortController()
  const tail = createTailStream(path.resolve(filePath), controller.signal)

  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(sc) {
      const reader = tail.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          sc.enqueue(encoder.encode(`data: ${value}\n\n`))
        }
      } catch {}
      finally { sc.close() }
    },
    cancel() { controller.abort() },
  })

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}
