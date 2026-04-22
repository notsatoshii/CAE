"use client"

import React, { useState, useRef } from "react"
import type { CatalogSkill } from "@/lib/cae-types"

type Props = {
  skill: CatalogSkill
  onInstalled?: () => void
}

type LogLine = { type: "line" | "err"; text: string }

/**
 * InstallButton — triggers skill install via POST /api/skills/install.
 *
 * Opens a dialog showing a live SSE log of install output.
 * On done:0 → calls onInstalled(). On done != 0 → shows error state.
 *
 * SSE format:
 *   event: line\ndata: "..."\n\n
 *   event: err\ndata: "..."\n\n
 *   event: done\ndata: "0"\n\n
 */
export function InstallButton({ skill, onInstalled }: Props) {
  const [open, setOpen] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [log, setLog] = useState<LogLine[]>([])
  const [done, setDone] = useState<"idle" | "success" | "error">("idle")
  const logRef = useRef<HTMLTextAreaElement>(null)

  async function startInstall() {
    setOpen(true)
    setInstalling(true)
    setLog([])
    setDone("idle")

    // Extract repo slug from installCmd
    const repo = skill.installCmd.replace(/^npx skills add /, "").trim()

    try {
      const res = await fetch("/api/skills/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo }),
      })

      if (!res.ok || !res.body) {
        setLog((l) => [...l, { type: "err", text: "Install request failed" }])
        setDone("error")
        setInstalling(false)
        return
      }

      // Parse SSE from body stream
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let buf = ""

      while (true) {
        const { done: streamDone, value } = await reader.read()
        if (streamDone) break

        buf += dec.decode(value, { stream: true })

        // Split on double newlines (SSE event separator)
        const parts = buf.split("\n\n")
        buf = parts.pop() ?? ""

        for (const part of parts) {
          const lines = part.split("\n")
          let event = "message"
          let data = ""
          for (const line of lines) {
            if (line.startsWith("event: ")) event = line.slice(7).trim()
            if (line.startsWith("data: ")) data = line.slice(6).trim()
          }
          if (!data) continue
          let parsed: string
          try {
            parsed = JSON.parse(data)
          } catch {
            parsed = data
          }

          if (event === "line") {
            setLog((l) => [...l, { type: "line", text: parsed }])
            // Auto-scroll log
            requestAnimationFrame(() => {
              if (logRef.current) {
                logRef.current.scrollTop = logRef.current.scrollHeight
              }
            })
          } else if (event === "err") {
            setLog((l) => [...l, { type: "err", text: parsed }])
          } else if (event === "done") {
            const exitCode = String(parsed)
            setInstalling(false)
            if (exitCode === "0") {
              setDone("success")
              onInstalled?.()
            } else {
              setDone("error")
            }
          }
        }
      }
    } catch (err) {
      setLog((l) => [...l, { type: "err", text: String(err) }])
      setDone("error")
      setInstalling(false)
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Install ${skill.name}`}
        onClick={startInstall}
        disabled={installing}
        className="rounded bg-[color:var(--accent,#00d4ff)] px-2.5 py-1 text-xs font-medium text-black transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        {installing ? "Installing…" : "Install"}
      </button>

      {/* Install dialog */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Installing ${skill.name}`}
          data-testid="install-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !installing) setOpen(false)
          }}
        >
          <div className="flex w-full max-w-lg flex-col gap-3 rounded-xl border border-zinc-700 bg-[#0e0e10] p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-200">
                {done === "success"
                  ? `${skill.name} installed`
                  : done === "error"
                  ? `Failed to install ${skill.name}`
                  : `Installing ${skill.name}…`}
              </h2>
              {!installing && (
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Live log output */}
            <textarea
              ref={logRef}
              readOnly
              data-testid="install-log"
              value={log.map((l) => l.text).join("")}
              rows={12}
              className="w-full resize-none rounded bg-black/60 p-2 font-mono text-xs text-zinc-300 outline-none"
            />

            {done === "success" && (
              <p className="text-xs text-emerald-400">
                Skill installed successfully.
              </p>
            )}
            {done === "error" && (
              <p className="text-xs text-red-400">
                Install failed. Check the log above for details.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
