export const metadata = {
  title: "Workflows — Coming in Phase 6",
}

/**
 * /build/workflows — Phase 6 stub.
 *
 * Rendered inside BuildLayout, so the left-rail is automatically on the left.
 * Pure server component — no data, no "use client".
 */
export default function WorkflowsStubPage() {
  return (
    <main data-testid="workflows-stub" className="p-10 max-w-2xl">
      <h1 className="text-2xl font-medium text-foreground mb-2">
        Workflows
      </h1>
      <p className="text-[color:var(--text-muted,#8a8a8c)] text-sm mb-6">
        Coming in Phase 6 — chat-drafted routines with a visual step preview and a YAML editor under Advanced.
      </p>
      <div className="rounded-lg border border-[color:var(--border,#1f1f22)] bg-[color:var(--surface,#121214)] p-6 text-sm text-[color:var(--text-muted,#8a8a8c)]">
        Nothing here yet. The rail on the left still works — jump to Home or Agents.
      </div>
    </main>
  )
}
