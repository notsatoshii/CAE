"use client"

/**
 * PersonaMarkdown — restricted safe-MD renderer for agent persona files.
 *
 * All text flows through React children (React escapes everything by default).
 * Raw-HTML injection props are FORBIDDEN in this file. Even if the persona
 * contains `<script>`, it renders as the literal characters.
 *
 * Supported syntax (anything else renders as plain text):
 *   - headings (#, ##, ###)
 *   - paragraphs (blank-line separated)
 *   - unordered lists (lines starting with "- ")
 *   - fenced code blocks (``` on its own line to open/close)
 *   - inline `code`
 *
 * See .planning/phases/05-agents-tab/05-CONTEXT.md §Persona file lookup for
 * the scope decision — no markdown library dep, inline parser by design.
 */

import * as React from "react"

interface PersonaMarkdownProps {
  source: string
}

export function PersonaMarkdown({ source }: PersonaMarkdownProps) {
  const blocks = parseBlocks(source)
  return (
    <div
      data-testid="persona-markdown"
      className="space-y-3 text-sm leading-relaxed text-[color:var(--text,#e5e5e5)]"
    >
      {blocks.map((b, i) => {
        if (b.kind === "h1")
          return (
            <h3 key={i} className="text-lg font-medium">
              {b.text}
            </h3>
          )
        if (b.kind === "h2")
          return (
            <h4 key={i} className="text-base font-medium">
              {b.text}
            </h4>
          )
        if (b.kind === "h3")
          return (
            <h5 key={i} className="text-sm font-medium">
              {b.text}
            </h5>
          )
        if (b.kind === "code")
          return (
            <pre
              key={i}
              className="rounded-md bg-[color:var(--surface-hover,#1a1a1d)] p-3 font-mono text-xs overflow-auto"
            >
              <code>{b.text}</code>
            </pre>
          )
        if (b.kind === "list")
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {b.items.map((it, j) => (
                <li key={j}>{renderInline(it)}</li>
              ))}
            </ul>
          )
        return <p key={i}>{renderInline(b.text)}</p>
      })}
    </div>
  )
}

type Block =
  | { kind: "h1" | "h2" | "h3" | "p" | "code"; text: string }
  | { kind: "list"; items: string[] }

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n")
  const out: Block[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith("```")) {
      const chunk: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith("```")) {
        chunk.push(lines[i])
        i++
      }
      i++ // consume closing fence (if present)
      out.push({ kind: "code", text: chunk.join("\n") })
      continue
    }
    if (line.startsWith("### ")) {
      out.push({ kind: "h3", text: line.slice(4) })
      i++
      continue
    }
    if (line.startsWith("## ")) {
      out.push({ kind: "h2", text: line.slice(3) })
      i++
      continue
    }
    if (line.startsWith("# ")) {
      out.push({ kind: "h1", text: line.slice(2) })
      i++
      continue
    }
    if (line.startsWith("- ")) {
      const items: string[] = []
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2))
        i++
      }
      out.push({ kind: "list", items })
      continue
    }
    if (line.trim() === "") {
      i++
      continue
    }
    // gather paragraph
    const buf: string[] = [line]
    i++
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !isBlockStart(lines[i])
    ) {
      buf.push(lines[i])
      i++
    }
    out.push({ kind: "p", text: buf.join(" ") })
  }
  return out
}

function isBlockStart(line: string): boolean {
  return line.startsWith("#") || line.startsWith("- ") || line.startsWith("```")
}

function renderInline(text: string): React.ReactNode {
  // Inline `code` only — everything else renders as plain text.
  const parts = text.split(/(`[^`]+`)/)
  return parts.map((p, i) => {
    if (p.startsWith("`") && p.endsWith("`") && p.length >= 2) {
      return (
        <code
          key={i}
          className="font-mono text-xs bg-[color:var(--surface-hover,#1a1a1d)] px-1 py-0.5 rounded"
        >
          {p.slice(1, -1)}
        </code>
      )
    }
    return <React.Fragment key={i}>{p}</React.Fragment>
  })
}
