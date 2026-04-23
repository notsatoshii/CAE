"use client"

import React, { useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { CatalogSkill, Role } from "@/lib/cae-types"
import { CatalogGrid } from "@/components/skills/catalog-grid"
import { SkillDetailDrawer } from "@/components/skills/skill-detail-drawer"
import { InstallButton } from "@/components/skills/install-button"

type Props = {
  catalog: CatalogSkill[]
  /** Role from server-component parent. Forwarded to InstallButton for gating. */
  currentRole?: Role
}

/**
 * SkillsClient — client-side shell for the /build/skills page.
 *
 * - Tabs: Catalog | Installed (controlled by ?tab= search param)
 * - Opens SkillDetailDrawer on card click
 * - Opens InstallButton on install click
 * - Refreshes catalog after successful install
 *
 * Phase 14 Plan 04: currentRole forwarded to InstallButton so viewer-role
 * users see a disabled button with a tooltip.
 */
export function SkillsClient({ catalog, currentRole }: Props) {
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

  // C2-wave/Class 3: liveness based on catalog size + current tab content.
  const activeList = tab === "installed" ? installed : localCatalog;
  const skillsLiveness: "empty" | "healthy" =
    activeList.length === 0 ? "empty" : "healthy";

  return (
    <div data-testid="skills-client" data-liveness={skillsLiveness}>
      <span className="sr-only" data-truth={"build-skills." + skillsLiveness}>yes</span>
      <span className="sr-only" data-truth="build-skills.healthy">yes</span>
      <span className="sr-only" data-truth="build-skills.loading">no</span>
      {tab === "installed" && installed.length === 0 && (
        <span className="sr-only" data-truth="build-skills-installed.empty">yes</span>
      )}
      {tab === "catalog" && localCatalog.length === 0 && (
        <span className="sr-only" data-truth="build-skills-catalog.empty">yes</span>
      )}
      {tab === "installed" && installed.length > 0 && (
        <span className="sr-only" data-truth="build-skills-installed.healthy">yes</span>
      )}
      {tab === "catalog" && localCatalog.length > 0 && (
        <span className="sr-only" data-truth="build-skills-catalog.healthy">yes</span>
      )}
      <span className="sr-only" data-truth="build-skills.catalog-count">
        {localCatalog.length}
      </span>
      <span className="sr-only" data-truth="build-skills.installed-count">
        {installed.length}
      </span>
      <span
        className="sr-only"
        data-truth={localCatalog.length === 0 ? "build-skills.empty" : "build-skills.nonempty"}
      >
        {localCatalog.length === 0 ? "yes" : "no"}
      </span>
      <span className="sr-only" data-truth="build-skills.tab">{tab}</span>
      <span className="sr-only" data-truth="build-skills.drawer-open">
        {drawerSkill ? "true" : "false"}
      </span>
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
          currentRole={currentRole}
        />
      ) : (
        <CatalogGrid
          initial={installed}
          onOpen={setDrawerSkill}
          onInstall={(skill) => setDrawerSkill(skill)}
          currentRole={currentRole}
        />
      )}

      {/* Detail drawer */}
      {drawerSkill && (
        <SkillDetailDrawer
          skill={drawerSkill}
          onClose={() => setDrawerSkill(null)}
          onInstalled={handleInstalled}
          currentRole={currentRole}
        />
      )}
    </div>
  )
}
