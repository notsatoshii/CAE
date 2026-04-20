"use client"

import { useEffect, useRef, useState } from "react"

const MAX_LINES = 500

interface TailPanelProps {
  path: string
}

export function TailPanel({ path }: TailPanelProps) {
  const [lines, setLines] = useState<string[]>([])
  const [paused, setPaused] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  useEffect(() => {
    const es = new EventSource(`/api/tail?path=${encodeURIComponent(path)}`)
    es.onmessage = (e) => {
      setLines((prev) => {
        const next = [...prev, e.data as string]
        return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
      })
    }
    return () => es.close()
  }, [path])

  useEffect(() => {
    if (!pausedRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" })
    }
  }, [lines])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <span className="text-xs font-mono text-muted-foreground truncate">{path}</span>
        <button
          onClick={() => setPaused((p) => !p)}
          className="text-xs px-2 py-1 rounded border hover:bg-muted ml-2 shrink-0"
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
