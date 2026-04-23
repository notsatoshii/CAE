/**
 * app/api/logs/stream/route.ts — Phase 15 Wave 5.1 (logs v2).
 *
 * SSE endpoint that fans out N log streams into a single multiplexed
 * channel for the LogsPanelV2 client.
 *
 * Sources (each is a separate SSE event-name so the client can route):
 *   - "tail"      .cae/logs/dashboard.log.jsonl              (pino app logs)
 *   - "tool"      .cae/metrics/tool-calls.jsonl              (audit-hook tool calls)
 *   - "audit"     .cae/metrics/circuit-breakers.jsonl        (forge events)
 *   - "heartbeat" synthetic 15s tick frame                   (liveness)
 *
 * Frame shape (JSON over SSE `data:`):
 *   {
 *     "source": "tail" | "tool" | "audit" | "heartbeat",
 *     "raw": "<original line>",
 *     "receivedAt": <epoch ms>
 *   }
 *
 * Path safety: file paths are pinned to STATIC_ALLOWED_ROOTS — the same
 * allow-list the existing /api/tail route uses (no user-supplied paths
 * reach disk, so traversal is impossible by construction).
 *
 * RBAC: requires `viewer` role minimum (logs may include user agent IDs
 * + URLs, but never secrets — pino redact paths in lib/log.ts strip
 * authorization / cookie / token before write).
 *
 * Cleanup: on stream cancel we abort all child tail watchers and clear
 * the heartbeat interval.
 */
import { NextRequest } from "next/server"
import path from "node:path"
import { auth } from "@/auth"
import { requireRole } from "@/lib/cae-rbac"
import type { Role } from "@/lib/cae-types"
import { createTailStream } from "@/lib/tail-stream"
import { listProjects } from "@/lib/cae-state"
import { log } from "@/lib/log"
import { withLog } from "@/lib/with-log"
import type { LogSource } from "@/lib/logs/multi-source-merge"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const l = log("api.logs.stream")
const CWD = process.cwd()
const HEARTBEAT_MS = 15_000

interface SourceSpec {
  source: LogSource
  /** Absolute file paths to tail. Each path opens its own watcher. */
  paths: string[]
}

/**
 * Build the absolute-path list for each source from the dashboard cwd
 * + every Shift-managed project we know about. This is recomputed once
 * per stream open (not per-line) — restart the stream to pick up new
 * projects.
 */
async function resolveSources(): Promise<SourceSpec[]> {
  const tailPaths = [path.resolve(CWD, ".cae/logs/dashboard.log.jsonl")]
  const toolPaths = [path.resolve(CWD, ".cae/metrics/tool-calls.jsonl")]
  const auditPaths = [path.resolve(CWD, ".cae/metrics/circuit-breakers.jsonl")]

  try {
    const projects = await listProjects()
    for (const p of projects) {
      tailPaths.push(path.resolve(p.path, ".cae/logs/dashboard.log.jsonl"))
      toolPaths.push(path.resolve(p.path, ".cae/metrics/tool-calls.jsonl"))
      auditPaths.push(path.resolve(p.path, ".cae/metrics/circuit-breakers.jsonl"))
    }
  } catch (err) {
    l.warn({ err }, "listProjects failed — using cwd-only paths")
  }

  return [
    { source: "tail", paths: dedupe(tailPaths) },
    { source: "tool", paths: dedupe(toolPaths) },
    { source: "audit", paths: dedupe(auditPaths) },
  ]
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr))
}

/**
 * Encode a single SSE frame.
 * Visible for testing — kept as an internal helper that route.test.ts
 * imports directly so we don't need a live network round-trip.
 */
export function encodeLogFrame(
  source: LogSource | "heartbeat",
  raw: string,
  receivedAt: number = Date.now(),
): string {
  const data = JSON.stringify({ source, raw, receivedAt })
  return `event: ${source}\ndata: ${data}\n\n`
}

async function getHandler(_req: NextRequest): Promise<Response> {
  const session = await auth()
  if (!requireRole(session?.user?.role as Role | undefined, "viewer")) {
    return new Response("forbidden", { status: 403 })
  }

  const sources = await resolveSources()
  const controller = new AbortController()
  const encoder = new TextEncoder()
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined

  const body = new ReadableStream<Uint8Array>({
    async start(streamCtrl) {
      const writeFrame = (frame: string) => {
        try {
          streamCtrl.enqueue(encoder.encode(frame))
        } catch {
          // Stream already closed by client — let cancel() clean up.
        }
      }

      // Initial heartbeat so the client's onopen + first lastMessageAt
      // tick instantly (no 15s blank period on first connect).
      writeFrame(
        encodeLogFrame("heartbeat", JSON.stringify({ ts: new Date().toISOString() })),
      )

      // Periodic heartbeat — same shape, lets the client prove liveness.
      heartbeatTimer = setInterval(() => {
        writeFrame(
          encodeLogFrame(
            "heartbeat",
            JSON.stringify({ ts: new Date().toISOString() }),
          ),
        )
      }, HEARTBEAT_MS)

      // Spin up one watcher per (source, file) pair. Failures are
      // logged but don't abort the whole stream — a missing log file
      // for one project shouldn't kill streams for the others.
      for (const spec of sources) {
        for (const filePath of spec.paths) {
          ;(async () => {
            try {
              const tail = createTailStream(filePath, controller.signal)
              const reader = tail.getReader()
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                if (typeof value === "string" && value.length > 0) {
                  writeFrame(encodeLogFrame(spec.source, value))
                }
              }
            } catch (err) {
              l.debug({ err, filePath, source: spec.source }, "tail watcher exited")
            }
          })()
        }
      }
    },
    cancel() {
      controller.abort()
      if (heartbeatTimer) clearInterval(heartbeatTimer)
    },
  })

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable Nginx buffering — needed for real-time SSE behind proxies.
      "X-Accel-Buffering": "no",
    },
  })
}

export const GET = withLog(getHandler, "/api/logs/stream")
