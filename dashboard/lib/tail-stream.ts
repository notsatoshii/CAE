import fs from "fs"
import path from "path"

export function createTailStream(filepath: string, signal: AbortSignal): ReadableStream<string> {
  return new ReadableStream<string>({
    start(controller) {
      let byteOffset = 0
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
