"use client"

import React, { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { CatalogSkill, Role } from "@/lib/cae-types"
import type { SkillFrontmatter } from "@/lib/cae-skills-parse"
import { InstallButton } from "./install-button"

type Props = {
  skill: CatalogSkill | null
  onClose: () => void
  onInstalled?: () => void
  /** Role from server-component parent — forwarded to InstallButton. */
  currentRole?: Role
}

type DetailData = {
  md: string
  frontmatter: SkillFrontmatter
} | null

/**
 * SkillDetailDrawer — right-slide drawer showing SKILL.md for a selected skill.
 *
 * For local skills: fetches /api/skills/[name] for full markdown.
 * For external skills: shows description + external link.
 *
 * Footer: Install button (if not installed) + copy installCmd to clipboard.
 * Trust score slot: placeholder div (ships in Plan 14-05).
 *
 * Phase 14 Plan 04: currentRole forwarded to InstallButton for gating.
 */
export function SkillDetailDrawer({ skill, onClose, onInstalled, currentRole }: Props) {
  const [detail, setDetail] = useState<DetailData>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!skill) {
      setDetail(null)
      return
    }
    if (skill.source !== "local") {
      setDetail(null)
      return
    }

    setLoading(true)
    fetch(`/api/skills/${encodeURIComponent(skill.name)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setDetail({ md: data.md, frontmatter: data.frontmatter })
      })
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [skill])

  if (!skill) return null

  async function copyCmd() {
    await navigator.clipboard.writeText(skill!.installCmd)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Skill details: ${skill.name}`}
        data-testid="skill-detail-drawer"
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[640px] flex-col border-l border-zinc-800 bg-[#0e0e10] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">
              {skill.name}
            </h2>
            <p className="text-xs text-zinc-400">{skill.owner}</p>
          </div>
          <button
            type="button"
            aria-label="Close detail"
            onClick={onClose}
            className="rounded p-1 text-zinc-500 hover:text-zinc-300"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Trust score placeholder — ships in Plan 14-05 */}
          <div className="trust-slot-placeholder mb-4 rounded border border-dashed border-zinc-700 px-3 py-2 text-xs text-zinc-500">
            Trust score coming in the Security panel.
          </div>

          {loading && (
            <p className="text-xs text-zinc-500">Loading skill details…</p>
          )}

          {skill.source === "local" && detail ? (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {detail.md}
              </ReactMarkdown>
            </div>
          ) : skill.source !== "local" ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-zinc-300">{skill.description}</p>
              <a
                href={skill.detailUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[color:var(--accent,#00d4ff)] hover:underline"
              >
                View on {skill.source === "skills.sh" ? "skills.sh" : "ClawHub"}
                &nbsp;↗
              </a>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-zinc-800 px-6 py-3">
          <button
            type="button"
            title={skill.installCmd}
            onClick={copyCmd}
            className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
          >
            Copy install command
          </button>
          {!skill.installed && (
            <InstallButton skill={skill} onInstalled={onInstalled} currentRole={currentRole} />
          )}
        </div>
      </aside>
    </>
  )
}
