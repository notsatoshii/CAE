import fs from "fs"
import path from "path"

/**
 * Seek to approximately `seekLines` lines before EOF.
 * Returns a byte offset that's guaranteed to be at a newline boundary.
 */
function seekToTail(filepath: string, seekLines: number = 500): number {
  let stat: fs.Stats
  try { stat = fs.statSync(filepath) } catch { return 0 }
  if (stat.size === 0) return 0

  // Estimate: average JSONL line ~200 bytes. Read a chunk from the end.
  const estimatedBytes = seekLines * 200
  const start = Math.max(0, stat.size - estimatedBytes)
  if (start === 0) return 0

  // Read a small chunk to find the first newline after our start position
  const fd = fs.openSync(filepath, "r")
  try {
    const buf = Buffer.alloc(Math.min(4096, stat.size - start))
    fs.readSync(fd, buf, 0, buf.length, start)
    const newlineIdx = buf.indexOf(0x0a) // '\n'
    if (newlineIdx >= 0) return start + newlineIdx + 1
    return start
  } finally {
    fs.closeSync(fd)
  }
}

export function createTailStream(filepath: string, signal: AbortSignal): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      // Start near EOF — the old code started at byte 0, blasting 177K+ old
      // heartbeat lines before reaching live data. For a 14MB circuit-breakers
      // file this made the Live Floor stuck on "waiting for first heartbeat".
      let byteOffset = seekToTail(filepath, 500)
      let lineBuffer = ""
      let watcher: fs.FSWatcher | null = null
      let closed = false
      let reading = false
      let pendingRead = false

      function close() {
        if (closed) return
        closed = true
        watcher?.close()
        try { controller.close() } catch {}
      }

      signal.addEventListener("abort", close)

      function readNewData() {
        if (closed) return
        if (reading) {
          pendingRead = true
          return
        }

        let stat: fs.Stats
        try { stat = fs.statSync(filepath) } catch { return }

        if (stat.size < byteOffset) {
          byteOffset = 0
          lineBuffer = ""
        }
        if (stat.size <= byteOffset) return

        reading = true
        pendingRead = false

        const stream = fs.createReadStream(filepath, { start: byteOffset })
        stream.on("data", (chunk: Buffer | string) => {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string, "utf8")
          byteOffset += buf.length
          lineBuffer += buf.toString("utf8")
          const lines = lineBuffer.split("\n")
          lineBuffer = lines.pop() ?? ""
          for (const line of lines) {
            if (!closed) controller.enqueue(line)
          }
        })
        stream.on("end", () => {
          reading = false
          if (pendingRead) readNewData()
        })
        stream.on("error", () => {
          reading = false
          if (pendingRead) readNewData()
        })
      }

      readNewData()

      try {
        watcher = fs.watch(path.dirname(filepath), { persistent: false }, (_event, filename) => {
          if (filename === path.basename(filepath)) readNewData()
        })
        watcher.on("error", () => {})
      } catch {}
    },
  })
}
