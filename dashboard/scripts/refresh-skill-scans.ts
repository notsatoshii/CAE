/**
 * refresh-skill-scans.ts — F6 (Wave 1.5)
 *
 * Walks the installed-skill directory (~/.claude/skills/ by default), runs
 * gitleaks scan on each, and appends a fresh JSONL entry per skill to
 * .cae/metrics/skill-scans.jsonl.
 *
 * Why: The Skills Hub UI reads the most-recent entry per skill name from
 * skill-scans.jsonl, so the panel can go stale forever if no one clicks
 * "rescan". The cae-scheduler-watcher runs this once an hour to keep the
 * data fresh without user intervention.
 *
 * Invoked by: scripts/cae-scheduler-watcher.sh (when minute == 00).
 *
 * Usage:
 *   tsx scripts/refresh-skill-scans.ts
 *   ts-node --transpile-only scripts/refresh-skill-scans.ts
 *   node --experimental-strip-types scripts/refresh-skill-scans.ts  (Node 22+)
 *
 * Exit codes:
 *   0 — completed (zero or more skills scanned)
 *   1 — fatal: skills dir unreadable AND fallback empty (genuinely nothing to do)
 *
 * Failure tolerance: a per-skill scan failure logs to stderr but does NOT
 * block remaining skills. The watcher still gets exit 0 unless every skill
 * failed AND we couldn't even enumerate the directory.
 */

import { readLocalSkillsDir, getSkillsDir } from "../lib/cae-skills-local"
import { scanSkill, appendScan } from "../lib/cae-secrets-scan"

async function main(): Promise<void> {
  const dir = getSkillsDir()
  const startedAt = new Date().toISOString()
  // eslint-disable-next-line no-console
  console.log(`[refresh-skill-scans] ${startedAt} dir=${dir}`)

  const skills = await readLocalSkillsDir(dir)

  if (skills.length === 0) {
    // eslint-disable-next-line no-console
    console.log("[refresh-skill-scans] no installed skills found — nothing to refresh")
    return
  }

  let ok = 0
  let failed = 0

  for (const s of skills) {
    try {
      // detailUrl is "file:///abs/path" — strip the prefix to get a usable dir
      const skillDir = s.detailUrl.replace(/^file:\/\//, "")
      const result = await scanSkill(skillDir)
      await appendScan(s.name, result)
      ok += 1
    } catch (e) {
      failed += 1
      // eslint-disable-next-line no-console
      console.error(`[refresh-skill-scans] FAILED ${s.name}:`, (e as Error).message)
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `[refresh-skill-scans] done — ok=${ok} failed=${failed} of ${skills.length}`,
  )
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("[refresh-skill-scans] fatal:", (e as Error).message)
  process.exit(1)
})
