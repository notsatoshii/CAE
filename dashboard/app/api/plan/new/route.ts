export const dynamic = "force-dynamic"

import { NextRequest } from "next/server"
import { auth } from "@/auth"
import { buildAnswersFile, runShiftNew, type WizardAnswers } from "@/lib/cae-shift"
import { log } from "@/lib/log"
import { withLog } from "@/lib/with-log"

const l = log("api.plan.new")

const NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/

interface NewPlanBody {
  name?: unknown
  answers?: unknown
}

async function postHandler(req: NextRequest) {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })
  const body = (await req.json().catch(() => null)) as NewPlanBody | null
  if (!body) return Response.json({ error: "invalid_json" }, { status: 400 })

  const name = typeof body.name === "string" ? body.name : ""
  if (!NAME_RE.test(name)) {
    return Response.json({ error: "invalid_name", detail: "lowercase letters/digits/_/- only, max 64" }, { status: 400 })
  }

  const a = body.answers as Partial<WizardAnswers> | null | undefined
  if (!a || typeof a !== "object") {
    return Response.json({ error: "answers_required" }, { status: 400 })
  }
  const required: (keyof WizardAnswers)[] = ["idea.what", "idea.who", "idea.type_ok"]
  for (const k of required) {
    if (typeof a[k] !== "string" || !(a[k] as string).trim()) {
      return Response.json({ error: "answers_incomplete", missing: k }, { status: 400 })
    }
  }
  const answers: WizardAnswers = {
    "idea.what": a["idea.what"] as string,
    "idea.who": a["idea.who"] as string,
    "idea.type_ok": a["idea.type_ok"] as string,
  }

  try {
    const answersFile = await buildAnswersFile(answers)
    const { sid, projectPath, logFile } = await runShiftNew(name, answersFile)
    return Response.json({ sid, slug: name, projectPath, logFile }, { status: 202 })
  } catch (err) {
    l.error({ err, name }, "shift new failed")
    return Response.json({ error: "shift_new_failed", detail: String(err) }, { status: 500 })
  }
}

export const POST = withLog(postHandler, "/api/plan/new")
