"use client"

import React, { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { CatalogSkill, Role, TrustScore } from "@/lib/cae-types"
import type { SkillFrontmatter } from "@/lib/cae-skills-parse"
import { InstallButton } from "./install-button"
import { TrustBadge } from "@/components/security/trust-badge"

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

type TrustData = {
  skill: CatalogSkill
  trust: TrustScore
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
  const [trustData, setTrustData] = useState<TrustData>(null)
  const [trustLoading, setTrustLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState("")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  /** Stores the raw SKILL.md (frontmatter + body) for editing */
  const [rawMd, setRawMd] = useState("")

  useEffect(() => {
    if (!skill) {
      setDetail(null)
      setTrustData(null)
      return
    }
    if (skill.source !== "local") {
      setDetail(null)
    } else {
      setLoading(true)
      fetch(`/api/skills/${encodeURIComponent(skill.name)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) {
            setDetail({ md: data.md, frontmatter: data.frontmatter })
            // Use the raw SKILL.md content (frontmatter + body) for editing
            setRawMd(data.raw ?? data.md)
          }
        })
        .catch(() => setDetail(null))
        .finally(() => setLoading(false))
    }

    // Fetch trust score for any skill (local or external)
    setTrustLoading(true)
    fetch("/api/security/trust")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Array<{ skill: CatalogSkill; trust: TrustScore }> | null) => {
        if (!data) return
        const match = data.find(
          (e) => e.skill.name === skill.name && e.skill.owner === skill.owner
        )
        if (match) setTrustData(match)
      })
      .catch(() => setTrustData(null))
      .finally(() => setTrustLoading(false))
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
        {/* Edit toggle — only for local skills */}
        {skill.source === "local" && detail && !editing && (
          <button
            type="button"
            onClick={() => { setEditing(true); setEditContent(rawMd); setSaveError(null) }}
            className="mt-2 rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
          >
            ✎ Edit SKILL.md
          </button>
        )}
        {editing && (
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                if (!skill) return
                setSaving(true)
                setSaveError(null)
                try {
                  const res = await fetch(`/api/skills/${encodeURIComponent(skill.name)}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ content: editContent }),
                  })
                  if (res.ok) {
                    const data = await res.json()
                    setDetail({ md: data.md, frontmatter: data.frontmatter })
                    setRawMd(editContent)
                    setEditing(false)
                  } else {
                    const err = await res.json().catch(() => ({ error: "save failed" }))
                    setSaveError(err.error || "save failed")
                  }
                } catch {
                  setSaveError("network error")
                } finally {
                  setSaving(false)
                }
              }}
              className="rounded border border-emerald-700 bg-emerald-900/50 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-800/50 hover:text-emerald-200 disabled:opacity-50"
            >
              {saving ? "Saving…" : "💾 Save"}
            </button>
            {saveError && (
              <span className="text-xs text-red-400">{saveError}</span>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Trust score — fetched from /api/security/trust */}
          <div className="mb-4">
            {trustLoading && (
              <span className="text-xs text-zinc-500">Loading trust score…</span>
            )}
            {!trustLoading && trustData && (
              <TrustBadge trust={trustData.trust} size="sm" />
            )}
            {!trustLoading && !trustData && (
              <span className="text-xs text-zinc-500">Trust score unavailable</span>
            )}
          </div>

          {loading && (
            <p className="text-xs text-zinc-500">Loading skill details…</p>
          )}

          {skill.source === "local" && detail ? (
            editing ? (
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full min-h-[500px] bg-zinc-900 text-zinc-100 font-mono text-xs leading-relaxed p-3 rounded border border-zinc-700 resize-y focus:border-zinc-500 focus:outline-none"
                spellCheck={false}
              />
            ) : (
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {detail.md}
                </ReactMarkdown>
              </div>
            )
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
