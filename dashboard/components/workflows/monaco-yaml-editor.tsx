"use client"

/**
 * MonacoYamlEditor — dev-mode YAML editor for workflow specs.
 *
 * The entire @monaco-editor/react package is pulled in via `dynamic(() =>
 * import(...), { ssr: false })` so founder-mode pages (which never mount
 * this component) do not fetch the Monaco bundle. SSR is disabled because
 * Monaco references `window` on import.
 *
 * This is a dumb controlled component — the parent owns `value` and
 * `onChange`. No internal state beyond a one-shot YAML-language registration
 * guard (useRef) inside `onMount`.
 */

import dynamic from "next/dynamic"
import { useRef } from "react"

const MonacoEditor = dynamic(() => import("@monaco-editor/react").then((m) => m.default), {
  ssr: false,
  loading: () => (
    <div
      data-testid="monaco-loading"
      className="flex items-center justify-center h-[400px] rounded-md border border-[color:var(--border,#1f1f22)] bg-[color:var(--surface,#121214)] text-xs text-[color:var(--text-muted,#8a8a8c)]"
    >
      Loading editor…
    </div>
  ),
})

export interface MonacoYamlEditorProps {
  value: string
  onChange: (next: string) => void
  height?: number
  readOnly?: boolean
}

export function MonacoYamlEditor({
  value,
  onChange,
  height = 400,
  readOnly = false,
}: MonacoYamlEditorProps) {
  // Guard so the YAML language registration runs at most once per page load.
  const registered = useRef(false)

  return (
    <div
      data-testid="monaco-yaml-editor"
      className="rounded-md overflow-hidden border border-[color:var(--border,#1f1f22)]"
    >
      <MonacoEditor
        height={height}
        language="yaml"
        theme="vs-dark"
        value={value}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily: "var(--font-geist-mono, ui-monospace, monospace)",
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          tabSize: 2,
          insertSpaces: true,
          wordWrap: "on",
          readOnly,
          automaticLayout: true,
        }}
        onMount={(_editor, monaco) => {
          if (registered.current) return
          registered.current = true
          const languages = monaco.languages.getLanguages()
          if (!languages.some((l: { id: string }) => l.id === "yaml")) {
            monaco.languages.register({ id: "yaml" })
          }
        }}
        onChange={(v) => onChange(v ?? "")}
      />
    </div>
  )
}
