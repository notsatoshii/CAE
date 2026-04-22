"use client"

import React, { useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { CatalogSkill } from "@/lib/cae-types"
import { CatalogGrid } from "@/components/skills/catalog-grid"
import { SkillDetailDrawer } from "@/components/skills/skill-detail-drawer"
import { InstallButton } from "@/components/skills/install-button"

type Props = {
  catalog: CatalogSkill[]
}

/**
 * SkillsClient — client-side shell for the /build/skills page.
 *
 * - Tabs: Catalog | Installed (controlled by ?tab= search param)
 * - Opens SkillDetailDrawer on card click
 * - Opens InstallButton on install click
 * - Refreshes catalog after successful install
 */
export function SkillsClient({ catalog }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab = searchParams.get("tab") === "installed" ? "installed" : "catalog"

  const [drawerSkill, setDrawerSkill] = useState<CatalogSkill | null>(null)
  const [localCatalog, setLocalCatalog] = useState<CatalogSkill[]>(catalog)

  const installed = localCatalog.filter((s) => s.installed)

  function setTab(t: "catalog" | "installed") {
    const params = new URLSearchParams(searchParams.toString())
    if (t === "installed") {
      params.set("tab", "installed")
    } else {
      params.delete("tab")
    }
    router.replace(`/build/skills?${params.toString()}`)
  }

  const handleInstalled = useCallback(() => {
    // Refresh catalog from server after install
    fetch("/api/skills")
      .then((r) => r.json())
      .then((fresh) => {
        if (Array.isArray(fresh)) setLocalCatalog(fresh)
      })
      .catch(() => {/* ignore refresh failures */})
    setDrawerSkill(null)
  }, [])

  const tabCls = (t: "catalog" | "installed") =>
    `px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
      tab === t
        ? "bg-zinc-800 text-zinc-100"
        : "text-zinc-400 hover:text-zinc-200"
    }`

  return (
    <>
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-zinc-800 pb-3 mb-4">
        <button
          type="button"
          className={tabCls("catalog")}
          onClick={() => setTab("catalog")}
          data-testid="tab-catalog"
        >
          Catalog
        </button>
        <button
          type="button"
          className={tabCls("installed")}
          onClick={() => setTab("installed")}
          data-testid="tab-installed"
        >
          Installed ({installed.length})
        </button>
      </div>

      {/* Content */}
      {tab === "catalog" ? (
        <CatalogGrid
          initial={localCatalog}
          onOpen={setDrawerSkill}
          onInstall={(skill) => setDrawerSkill(skill)}
        />
      ) : (
        <CatalogGrid
          initial={installed}
          onOpen={setDrawerSkill}
          onInstall={(skill) => setDrawerSkill(skill)}
        />
      )}

      {/* Detail drawer */}
      {drawerSkill && (
        <SkillDetailDrawer
          skill={drawerSkill}
          onClose={() => setDrawerSkill(null)}
          onInstalled={handleInstalled}
        />
      )}
    </>
  )
}
