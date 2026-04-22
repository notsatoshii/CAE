import { NextRequest } from "next/server"
import path from "path"
import { createTailStream } from "@/lib/tail-stream"
import { listProjects } from "@/lib/cae-state"
import { log } from "@/lib/log"
import { withLog } from "@/lib/with-log"

const l = log("api.tail")
const CWD = process.cwd()

const STATIC_ALLOWED_ROOTS = [
  path.resolve(CWD, ".cae", "metrics"),
  path.resolve(CWD, ".cae", "logs"),
  path.resolve(CWD, ".planning", "phases"),
  "/home/cae/outbox",
]

async function computeAllowedRoots(): Promise<string[]> {
  const roots = [...STATIC_ALLOWED_ROOTS]
  try {
    const projects = await listProjects()
    for (const p of projects) {
      roots.push(path.resolve(p.path, ".cae", "logs"))
      roots.push(path.resolve(p.path, ".cae", "metrics"))
      roots.push(path.resolve(p.path, ".planning", "phases"))
    }
  } catch (err) {
    l.error({ err }, "listProjects() failed, falling back to static roots")
  }
  return roots
}

function isAllowedPath(filePath: string, roots: string[]): boolean {
  const resolved = path.resolve(filePath)
  return roots.some(
    (root) => resolved === root || resolved.startsWith(root + path.sep)
  )
}

async function getHandler(req: NextRequest) {
  const filePath = req.nextUrl.searchParams.get("path")
  if (!filePath) {
    return new Response("Missing path", { status: 400 })
  }

  const allowedRoots = await computeAllowedRoots()
  if (!isAllowedPath(filePath, allowedRoots)) {
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

export const GET = withLog(getHandler, "/api/tail")
