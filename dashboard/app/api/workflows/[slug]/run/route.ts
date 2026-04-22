export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { mkdir, writeFile } from "fs/promises"
import { spawn } from "child_process"
import { join } from "path"
import { randomUUID } from "crypto"
import { auth } from "@/auth"
import { requireRole } from "@/lib/cae-rbac"
import { INBOX_ROOT } from "@/lib/cae-config"
import { getWorkflow } from "@/lib/cae-workflows"
import type { WorkflowStep } from "@/lib/cae-workflows"
import { withLog } from "@/lib/with-log"
import type { Role } from "@/lib/cae-types"

function firstAgentStep(
  steps: WorkflowStep[],
): { agent: string; task: string } | null {
  for (const s of steps) {
    if ("agent" in s && "task" in s && typeof s.task === "string") {
      return { agent: s.agent, task: s.task }
    }
  }
  return null
}

function renderBuildplan(
  slug: string,
  step: { agent: string; task: string },
  fullSpecYaml: string,
): string {
  return [
    "# Objective",
    "",
    "Run the first executable step of workflow `" + slug + "`.",
    "",
    "Agent: `" + step.agent + "`",
    "",
    "Task:",
    "",
    step.task,
    "",
    "---",
    "",
    "## Full workflow (for reference)",
    "",
    "```yaml",
    fullSpecYaml.trimEnd(),
    "```",
    "",
  ].join("\n")
}

async function postHandler(
  _req: NextRequest,
  ctx: { params: Promise<{ slug: string }> },
) {
  const session = await auth()
  if (!session) return Response.json({ error: "unauthorized" }, { status: 401 })

  // Defense-in-depth: re-check role in handler (STRIDE T-14-04-03)
  if (!requireRole(session.user?.role as Role | undefined, "operator")) {
    return Response.json({ error: "forbidden", required: "operator" }, { status: 403 })
  }

  const { slug } = await ctx.params
  const workflow = await getWorkflow(slug)
  if (!workflow) {
    return Response.json({ error: "workflow not found" }, { status: 404 })
  }

  const firstStep = firstAgentStep(workflow.spec.steps)
  if (!firstStep) {
    return Response.json(
      {
        error:
          "workflow has no executable agent step (first runnable step in Phase 6 is an {agent, task} step)",
      },
      { status: 400 },
    )
  }

  const ts = Date.now()
  const taskId = "wf-" + slug + "-" + ts + "-" + randomUUID().slice(0, 4)
  const taskDir = join(INBOX_ROOT, taskId)
  await mkdir(taskDir, { recursive: true })
  await writeFile(
    join(taskDir, "BUILDPLAN.md"),
    renderBuildplan(slug, firstStep, workflow.yaml),
    "utf8",
  )
  await writeFile(
    join(taskDir, "META.yaml"),
    "created_by: dashboard-workflow\nworkflow_slug: " +
      slug +
      "\nagent: " +
      firstStep.agent +
      "\n",
    "utf8",
  )

  const shortId = taskId.replace(/^wf-/, "").slice(0, 32)
  const child = spawn(
    "tmux",
    [
      "new-session",
      "-d",
      "-s",
      "buildplan-" + shortId,
      "cae execute-buildplan " + taskId,
    ],
    { detached: true, stdio: "ignore" },
  )
  child.unref()

  return Response.json({ taskId, slug, ts }, { status: 202 })
}

type SlugCtx = { params: Promise<{ slug: string }> }
export const POST = withLog(
  postHandler as (req: Request, ctx: SlugCtx) => Promise<Response>,
  "/api/workflows/[slug]/run",
)
