export const dynamic = "force-dynamic"

/**
 * /build/workflows/[slug] — edit-workflow route (Phase 6 Plan 06-04).
 *
 * Server component: loads the WorkflowRecord via `getWorkflow(slug)`
 * and passes it to the shared WorkflowForm in `edit` mode. Missing
 * workflow → 404. `force-dynamic` because the filesystem is read
 * every request.
 *
 * Next 16 async-params shape: `{ params: Promise<{ slug: string }> }`.
 */

import { notFound } from "next/navigation"
import { getWorkflow } from "@/lib/cae-workflows"
import { labelFor } from "@/lib/copy/labels"
import { WorkflowForm } from "../workflow-form"

export const metadata = { title: "Edit workflow" }

export default async function EditWorkflowPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const record = await getWorkflow(slug)
  if (!record) notFound()
  const t = labelFor(false)
  return (
    <main
      data-testid="workflows-edit-page"
      data-slug={record.slug}
      className="p-8 max-w-6xl"
    >
      <h1 className="text-2xl font-medium mb-6">
        {t.workflowsEditPageHeading(record.spec.name)}
      </h1>
      <WorkflowForm mode="edit" initial={record} />
    </main>
  )
}
