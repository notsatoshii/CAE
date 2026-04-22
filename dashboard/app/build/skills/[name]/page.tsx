import React from "react"
import { notFound } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { getSkillsDir } from "@/lib/cae-skills-local"
import { parseSkillMd } from "@/lib/cae-skills-parse"
import * as fs from "node:fs/promises"
import * as path from "node:path"

type Props = {
  params: Promise<{ name: string }>
}

/**
 * /build/skills/[name] — per-skill full-page detail view.
 *
 * Renders SKILL.md via react-markdown. Intended for shareable deep-links
 * (e.g. bookmarkable URL to a specific installed skill).
 *
 * Only works for locally installed skills. External skills show a redirect
 * message with a link to the skill's source registry.
 */
export default async function SkillDetailPage({ params }: Props) {
  const { name } = await params

  // Sanitize: allow only [A-Za-z0-9_.-]
  const safeName = name.replace(/[^A-Za-z0-9_.-]/g, "")
  if (!safeName || safeName !== name) {
    notFound()
  }

  const skillsDir = getSkillsDir()
  const skillDir = path.join(skillsDir, safeName)
  const skillMdPath = path.join(skillDir, "SKILL.md")

  let md: string
  try {
    const raw = await fs.readFile(skillMdPath, "utf8")
    const { body } = parseSkillMd(raw)
    md = body
  } catch {
    notFound()
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-xl font-semibold text-zinc-100">{safeName}</h1>

      {/* Trust score slot — ships in Plan 14-05 */}
      <div className="trust-slot-placeholder mb-6 rounded border border-dashed border-zinc-700 px-3 py-2 text-xs text-zinc-500">
        Trust score coming in the Security panel.
      </div>

      <article className="prose prose-invert prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
      </article>
    </div>
  )
}
