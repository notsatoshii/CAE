"use client"

import React, { useRef, useState } from "react"
import { CronPreview } from "./cron-preview"

export type ParseResult = {
  cron: string
  source: "rule" | "llm"
  confidence: "high" | "medium"
  english: string
  nextRun: string | null
}

export type NlInputProps = {
  onResult: (result: ParseResult) => void
  timezone?: string
}

/**
 * NlInput — debounced natural-language schedule textarea.
 *
 * Waits 300ms after the user stops typing, then POSTs to /api/schedule/parse
 * and shows a CronPreview with the result.
 */
export function NlInput({ onResult, timezone }: NlInputProps) {
  const [value, setValue] = useState("")
  const [preview, setPreview] = useState<ParseResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const nl = e.target.value
    setValue(nl)
    setError(null)

    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!nl.trim()) {
      setPreview(null)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch("/api/schedule/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nl: nl.trim(),
            timezone: timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        })
        const data = (await res.json()) as ParseResult & { error?: string }
        if (!res.ok) {
          setError(data.error ?? "Could not parse schedule")
          setPreview(null)
        } else {
          setPreview(data)
          onResult(data)
        }
      } catch {
        setError("Network error")
        setPreview(null)
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={handleChange}
        placeholder="every morning at 9am"
        rows={2}
        className="w-full resize-none rounded-md border border-[color:var(--border,#1f1f22)] bg-[color:var(--surface,#121214)] px-3 py-2 text-sm text-[color:var(--text,#e5e5e5)] placeholder:text-[color:var(--text-muted,#8a8a8c)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent,#00d4ff)]"
        aria-label="Schedule description"
      />
      {loading && (
        <p className="text-xs text-[color:var(--text-muted,#8a8a8c)]">Parsing…</p>
      )}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
      {preview && !loading && (
        <CronPreview
          cron={preview.cron}
          source={preview.source}
          english={preview.english}
          nextRun={preview.nextRun}
        />
      )}
    </div>
  )
}
