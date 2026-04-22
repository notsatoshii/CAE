"use client"

import { useEffect, useRef, useState } from "react"
import { useSseHealth } from "@/lib/hooks/use-sse-health"
import { LastUpdated } from "@/components/ui/last-updated"

const MAX_LINES = 500

interface TailPanelProps {
  path: string
}

// Tiny colored dot indicating SSE connection status
function SseDot({ status }: { status: "connecting" | "open" | "closed" }) {
  const color =
    status === "open"
      ? "var(--success)"
      : status === "connecting"
        ? "var(--warning)"
        : "var(--danger)"
  return (
    <span
      className="inline-block size-1.5 rounded-full shrink-0"
      style={{ backgroundColor: color }}
      aria-label={`SSE ${status}`}
      title={`Stream: ${status}`}
    />
  )
}

export function TailPanel({ path }: TailPanelProps) {
  const [lines, setLines] = useState<string[]>([])
  const [paused, setPaused] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  // SSE health — tracks lastMessageAt + connection status for the tail stream
  const sseUrl = `/api/tail?path=${encodeURIComponent(path)}`
  const { lastMessageAt, status: sseStatus } = useSseHealth(sseUrl)

  useEffect(() => {
    const es = new EventSource(sseUrl)
    es.onmessage = (e) => {
      setLines((prev) => {
        const next = [...prev, e.data as string]
        return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
      })
    }
    return () => es.close()
  }, [sseUrl])

  useEffect(() => {
    if (!pausedRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" })
    }
  }, [lines])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0 gap-2">
        <span className="text-xs font-mono text-muted-foreground truncate flex-1">{path}</span>
        {/* SSE health indicators */}
        <SseDot status={sseStatus} />
        <LastUpdated at={lastMessageAt} threshold_ms={30000} />
        <button
          onClick={() => setPaused((p) => !p)}
          className="text-xs px-2 py-1 rounded border hover:bg-muted ml-1 shrink-0"
        >
          {paused ? "Resume" : "Pause"}
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">
          {lines.join("\n")}
        </pre>
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
