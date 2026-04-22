export const dynamic = "force-dynamic"

/**
 * /build/workflows — workflow list (Phase 6 Plan 06-04).
 *
 * Server component. Calls `listWorkflows()` directly — no self-HTTP
 * hop through /api/workflows. The API route still exists for client-
 * side revalidation (Phase 6 widget consumers) but a direct library
 * call here avoids an auth round-trip and is strictly faster.
 *
 * Replaces the Phase 5 stub. Interactive "Run now" buttons and the
 * client-side dev-mode flip live in `./workflows-list-client.tsx`.
 */

import Link from "next/link"
import { listWorkflows } from "@/lib/cae-workflows"
import { labelFor } from "@/lib/copy/labels"
import { WorkflowsListClient } from "./workflows-list-client"

export const metadata = { title: "Workflows" }

export default async function WorkflowsPage() {
  const workflows = await listWorkflows()
  workflows.sort((a, b) => b.mtime - a.mtime)
  // Server-render founder copy for the heading; interactive bits live
  // in the client component which flips copy on dev-mode.
  const t = labelFor(false)

  return (
    <main data-testid="workflows-page" className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-[20px] font-semibold">{t.workflowsPageHeading}</h1>
        <Link
          href="/build/workflows/new"
          data-testid="workflows-create-button"
          className="inline-flex h-9 items-center px-4 rounded-md text-sm font-medium bg-[color:var(--accent,#00d4ff)] text-black hover:opacity-90"
        >
          {t.workflowsCreateButton}
        </Link>
      </div>
      <WorkflowsListClient initialWorkflows={workflows} />
    </main>
  )
}
