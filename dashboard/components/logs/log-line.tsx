"use client"

/**
 * components/logs/log-line.tsx — Phase 15 Wave 5.1.
 *
 * Renders ONE LogLine row inside the virtualised list.
 *
 * Visual contract
 * ---------------
 *   [00:00:05] [TAIL] [INFO] api.tail · req.begin {"url":"/api/tail",...}
 *                                          [collapsible JSON]   [⎘]  [→]
 *
 *   - [HH:MM:SS]      — local time, monospace
 *   - source badge    — colour-coded pill (tail / audit / tool / heartbeat)
 *   - level badge     — colour-coded pill (debug / info / warn / error / fatal)
 *   - scope · msg     — pino name + msg string
 *   - JSON payload    — Shiki-highlighted, fold/expand triangle
 *   - copy-as-cURL    — when raw payload looks like an HTTP req log
 *   - jump-to-code    — when raw contains a file:line stack frame, render
 *                       a button that opens vscode://file/<path>:<line>
 *
 * Shiki is loaded LAZILY (dynamic import) the first time a JSON payload
 * is expanded — keeps initial bundle weight off the cold path.
 */
import { useState, useMemo, useCallback } from "react"
import {
  Copy,
  ExternalLink,
  ChevronRight,
  ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { LogLine, LogLevel, LogSource } from "@/lib/logs/multi-source-merge"
import {
  detectCurlCandidate,
  composeCurl,
  detectStackFrames,
  type StackFrame,
} from "./detectors"
import { JsonTree } from "./json-tree"

interface LogLineRowProps {
  line: LogLine
  /** Optional substring to highlight (search match). */
  highlight?: string
  /** When true, source badge is clickable to filter on it. */
  onSourceClick?: (s: LogSource) => void
  /** When true, level badge is clickable to filter on it. */
  onLevelClick?: (l: LogLevel) => void
}

const LEVEL_COLOR: Record<LogLevel, string> = {
  trace: "var(--text-dim)",
  debug: "var(--text-muted)",
  info: "var(--accent)",
  warn: "var(--warning)",
  error: "var(--danger)",
  fatal: "var(--danger)",
}

const SOURCE_COLOR: Record<LogSource, string> = {
  tail: "var(--accent)",
  audit: "var(--warning)",
  tool: "var(--success)",
  heartbeat: "var(--text-dim)",
}

export function LogLineRow({
  line,
  highlight,
  onSourceClick,
  onLevelClick,
}: LogLineRowProps) {
  const [jsonOpen, setJsonOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const time = useMemo(() => formatTime(line.tsMs), [line.tsMs])
  const curl = useMemo(() => detectCurlCandidate(line.obj), [line.obj])
  const frames = useMemo(() => detectStackFrames(line.raw), [line.raw])
  const headline = useMemo(() => buildHeadline(line), [line])

  const handleCopyCurl = useCallback(() => {
    if (!curl) return
    const cmd = composeCurl(curl)
    void navigator.clipboard?.writeText(cmd)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }, [curl])

  const handleCopyRaw = useCallback(() => {
    void navigator.clipboard?.writeText(line.raw)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }, [line.raw])

  return (
    <div
      data-testid="log-line"
      data-source={line.source}
      data-level={line.level}
      className={cn(
        "group flex flex-col gap-1 border-b border-[color:var(--border-subtle)] px-3 py-1.5",
        "font-mono text-[12px] leading-tight",
        "hover:bg-[color:var(--surface-hover)]",
      )}
    >
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 text-[color:var(--text-dim)]">{time}</span>

        <button
          type="button"
          data-testid="log-line-source"
          onClick={() => onSourceClick?.(line.source)}
          className="shrink-0 rounded border border-transparent px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-wider hover:border-current"
          style={{ color: SOURCE_COLOR[line.source] }}
          aria-label={`Filter by source ${line.source}`}
        >
          {line.source}
        </button>

        <button
          type="button"
          data-testid="log-line-level"
          onClick={() => onLevelClick?.(line.level)}
          className="shrink-0 rounded border border-transparent px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-wider hover:border-current"
          style={{ color: LEVEL_COLOR[line.level] }}
          aria-label={`Filter by level ${line.level}`}
        >
          {line.level}
        </button>

        {line.scope ? (
          <span className="shrink-0 text-[color:var(--text-muted)]">{line.scope}</span>
        ) : null}

        <Headline text={headline} highlight={highlight} />

        <div className="ml-auto flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
          {curl ? (
            <button
              type="button"
              data-testid="log-line-copy-curl"
              onClick={handleCopyCurl}
              title="Copy as cURL"
              aria-label="Copy as cURL command"
              className="rounded border border-[color:var(--border-subtle)] px-1.5 py-[1px] text-[10px] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            >
              cURL
            </button>
          ) : null}
          <button
            type="button"
            data-testid="log-line-copy"
            onClick={handleCopyRaw}
            title={copied ? "Copied!" : "Copy raw line"}
            aria-label="Copy raw line"
            className="rounded border border-[color:var(--border-subtle)] p-1 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
          >
            <Copy className="size-3" aria-hidden="true" />
          </button>
          {line.obj ? (
            <button
              type="button"
              data-testid="log-line-toggle-json"
              onClick={() => setJsonOpen((v) => !v)}
              title={jsonOpen ? "Collapse payload" : "Expand payload"}
              aria-expanded={jsonOpen}
              aria-label={jsonOpen ? "Collapse JSON payload" : "Expand JSON payload"}
              className="rounded border border-[color:var(--border-subtle)] p-1 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            >
              {jsonOpen ? (
                <ChevronDown className="size-3" aria-hidden="true" />
              ) : (
                <ChevronRight className="size-3" aria-hidden="true" />
              )}
            </button>
          ) : null}
        </div>
      </div>

      {frames.length > 0 ? (
        <div className="flex flex-wrap gap-1 pl-12">
          {frames.map((f, i) => (
            <FrameButton key={i} frame={f} />
          ))}
        </div>
      ) : null}

      {jsonOpen && line.obj ? (
        <div className="ml-12 mt-1 rounded border border-[color:var(--border-subtle)] bg-[color:var(--bg)] p-2">
          <JsonTree value={line.obj} />
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(ms: number): string {
  const d = new Date(ms)
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  const ss = String(d.getSeconds()).padStart(2, "0")
  return `${hh}:${mm}:${ss}`
}

/**
 * The "headline" is the human-readable one-liner: msg + key fields if no
 * msg, else just the raw line for plain-text rows.
 */
function buildHeadline(line: LogLine): string {
  if (line.msg) return line.msg
  if (line.obj) {
    // Try a few common keys to surface SOMETHING useful.
    const o = line.obj
    if (typeof o.url === "string") return `${o.method ?? "GET"} ${o.url}`
    if (typeof o.tool === "string") return `tool=${o.tool} task=${o.task ?? "?"}`
    if (typeof o.event === "string") return `event=${o.event}`
    return ""
  }
  return line.raw
}

/**
 * Headline with optional highlight — splits on a case-insensitive substring
 * match and wraps matches in a <mark>.
 */
function Headline({ text, highlight }: { text: string; highlight?: string }) {
  if (!text) return <span className="text-[color:var(--text-dim)]">—</span>
  if (!highlight || !highlight.trim()) {
    return <span className="truncate text-[color:var(--text)]">{text}</span>
  }
  const q = highlight.trim()
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return <span className="truncate text-[color:var(--text)]">{text}</span>
  return (
    <span className="truncate text-[color:var(--text)]">
      {text.slice(0, idx)}
      <mark
        data-testid="log-line-highlight"
        className="rounded bg-[color:var(--accent)] px-0.5 text-[color:var(--accent-foreground)]"
      >
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </span>
  )
}

function FrameButton({ frame }: { frame: StackFrame }) {
  const vscodeUrl = `vscode://file/${frame.path}:${frame.line}`
  const onCopy = (e: React.MouseEvent) => {
    e.preventDefault()
    void navigator.clipboard?.writeText(`${frame.path}:${frame.line}`)
  }
  return (
    <a
      href={vscodeUrl}
      onContextMenu={onCopy}
      data-testid="log-line-frame"
      className="inline-flex items-center gap-1 rounded border border-[color:var(--border-subtle)] px-1.5 py-[1px] text-[10px] text-[color:var(--text-muted)] hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
      title={`Open in VS Code (right-click to copy path)\n${frame.path}:${frame.line}`}
    >
      <ExternalLink className="size-2.5" aria-hidden="true" />
      {frame.short}:{frame.line}
    </a>
  )
}
