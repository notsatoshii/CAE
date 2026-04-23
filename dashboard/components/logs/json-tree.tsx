"use client"

/**
 * components/logs/json-tree.tsx — Phase 15 Wave 5.1.
 *
 * Lightweight collapsible JSON tree. Why not react-json-view-lite?
 *   - Project already runs without it; one fewer dep to vet (T-03 supply
 *     chain principle).
 *   - We only need 5 things: collapsible objects, collapsible arrays,
 *     coloured primitives, copy-key-path, and value truncation. Easier
 *     to write 60 lines of TSX than to wrap an opinionated lib.
 *
 * Shiki is overkill for short payloads (and adds ~150 KB on first load).
 * For payloads > 500 chars we fall back to a single Shiki block — at
 * that size collapsibility doesn't help anyway.
 */
import { useState, useEffect, useMemo } from "react"
import { ChevronRight, ChevronDown } from "lucide-react"

type JsonValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | JsonValue[]
  | { [k: string]: JsonValue }

interface JsonTreeProps {
  value: unknown
}

const SHIKI_THRESHOLD = 500

export function JsonTree({ value }: JsonTreeProps) {
  const stringified = useMemo(() => {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return "[unserialisable]"
    }
  }, [value])

  if (stringified.length > SHIKI_THRESHOLD) {
    return <ShikiBlock code={stringified} lang="json" />
  }
  return (
    <div className="font-mono text-[11px] leading-snug">
      <Node v={value as JsonValue} k={null} depth={0} initiallyOpen />
    </div>
  )
}

function Node({
  v,
  k,
  depth,
  initiallyOpen = false,
}: {
  v: JsonValue
  k: string | null
  depth: number
  initiallyOpen?: boolean
}) {
  const [open, setOpen] = useState(initiallyOpen || depth < 1)

  const indent = { paddingLeft: `${depth * 12}px` }

  if (v === null) return <Leaf k={k} value="null" color="var(--text-dim)" indent={indent} />
  if (v === undefined) return <Leaf k={k} value="undefined" color="var(--text-dim)" indent={indent} />
  if (typeof v === "string")
    return <Leaf k={k} value={JSON.stringify(v)} color="var(--success)" indent={indent} />
  if (typeof v === "number")
    return <Leaf k={k} value={String(v)} color="var(--accent)" indent={indent} />
  if (typeof v === "boolean")
    return <Leaf k={k} value={String(v)} color="var(--warning)" indent={indent} />

  // array | object
  const isArray = Array.isArray(v)
  const entries: [string, JsonValue][] = isArray
    ? (v as JsonValue[]).map((item, i) => [String(i), item])
    : Object.entries(v as Record<string, JsonValue>)

  if (entries.length === 0) {
    return (
      <Leaf
        k={k}
        value={isArray ? "[]" : "{}"}
        color="var(--text-dim)"
        indent={indent}
      />
    )
  }

  return (
    <div style={indent}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-[color:var(--text)] hover:text-[color:var(--accent)]"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="size-3" aria-hidden="true" />
        ) : (
          <ChevronRight className="size-3" aria-hidden="true" />
        )}
        {k !== null ? (
          <span className="text-[color:var(--text-muted)]">&quot;{k}&quot;:</span>
        ) : null}
        <span className="text-[color:var(--text-dim)]">
          {isArray ? `Array(${entries.length})` : `Object(${entries.length})`}
        </span>
      </button>
      {open ? (
        <div>
          {entries.map(([key, child]) => (
            <Node key={key} k={key} v={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Leaf({
  k,
  value,
  color,
  indent,
}: {
  k: string | null
  value: string
  color: string
  indent: React.CSSProperties
}) {
  return (
    <div style={indent} className="flex items-baseline gap-1">
      {k !== null ? (
        <span className="text-[color:var(--text-muted)]">&quot;{k}&quot;:</span>
      ) : null}
      <span style={{ color }} className="break-all">{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shiki block (lazy-loaded on demand)
// ---------------------------------------------------------------------------

function ShikiBlock({ code, lang }: { code: string; lang: string }) {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Lazy import — keeps Shiki off the cold path until a payload is
        // actually big enough to justify it.
        const { codeToHtml } = await import("shiki")
        const out = await codeToHtml(code, {
          lang,
          theme: "github-dark",
        })
        if (!cancelled) setHtml(out)
      } catch {
        // Shiki failed (bundling issue / network) — fall back to raw <pre>.
        if (!cancelled) setHtml(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code, lang])

  if (html) {
    return (
      <div
        data-testid="log-line-shiki"
        className="overflow-auto text-[11px]"
        // codeToHtml returns sanitised HTML; Shiki escapes < > & itself.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }
  return (
    <pre className="overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-[color:var(--text)]">
      {code}
    </pre>
  )
}
