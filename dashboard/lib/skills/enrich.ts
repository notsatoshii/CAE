/**
 * lib/skills/enrich.ts — merges git-log "last updated" ISO onto catalog entries
 * so the /build/skills page can render freshness per card without widening
 * the global CatalogSkill type.
 *
 * Kept deliberately tiny: all it does is map over a catalog, consult the
 * last-updated map, and attach `lastUpdatedISO`. Import from server code only.
 */
import type { CatalogSkill } from "@/lib/cae-types";

/**
 * Catalog entry decorated with a git-sourced last-updated ISO. Added as a
 * named augmentation rather than extending CatalogSkill directly to avoid
 * touching the shared type used by Phase 14 install/trust-score plumbing.
 */
export type CatalogSkillWithFreshness = CatalogSkill & {
  lastUpdatedISO?: string | null;
};

export function enrichSkillsWithLastUpdated(
  catalog: CatalogSkill[],
  lastUpdatedMap: Record<string, string | null>
): CatalogSkillWithFreshness[] {
  return catalog.map((skill) => {
    // Match by skill name — the local loader uses the directory name, which
    // is identical to the repo-root skills/<name> folder.
    const iso = lastUpdatedMap[skill.name];
    return {
      ...skill,
      lastUpdatedISO: iso ?? null,
    };
  });
}
