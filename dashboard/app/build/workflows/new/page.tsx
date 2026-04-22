/**
 * /build/workflows/new — create-workflow route (Phase 6 Plan 06-04).
 *
 * Pure server component that renders the shared WorkflowForm in
 * `create` mode. No disk reads here — the form's initial YAML is a
 * static starter template.
 */

import { labelFor } from "@/lib/copy/labels"
import { WorkflowForm } from "../workflow-form"

export const metadata = { title: "New workflow" }

export default function NewWorkflowPage() {
  // Server-render founder copy — the form itself flips on dev-mode.
  const t = labelFor(false)
  return (
    <main data-testid="workflows-new-page" className="p-8 max-w-6xl">
      <h1 className="text-2xl font-medium mb-6">
        {t.workflowsNewPageHeading}
      </h1>
      <WorkflowForm mode="create" />
    </main>
  )
}
