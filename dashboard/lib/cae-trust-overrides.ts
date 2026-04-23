/**
 * cae-trust-overrides.ts — Atomic read/write for admin trust override list.
 *
 * Plan 14-05: Admins can mark a skill as "trusted" to override a low trust score.
 * Persisted to .cae/trust-overrides.json (relative to CAE_ROOT env var).
 *
 * T-14-05-01: File is 0600 (admin-only shell access); dashboard writes via this module only.
 * Writes use atomic temp-file + rename to avoid partial writes.
 */
import { readFile, writeFile, chmod, rename, mkdir } from "node:fs/promises"
import path from "node:path"

const getOverridesFile = (): string =>
  path.join(
    process.env.CAE_ROOT ?? "/home/cae/ctrl-alt-elite",
    ".cae/trust-overrides.json"
  )

/**
 * readOverrides — load the current set of admin-trusted skill keys.
 *
 * Returns empty Set if file is missing or malformed (graceful degradation).
 * Key format: "owner/name" normalized to lowercase (see overrideKey()).
 */
export async function readOverrides(): Promise<Set<string>> {
  try {
    const raw = await readFile(getOverridesFile(), "utf8")
    const list = JSON.parse(raw) as string[]
    return new Set(Array.isArray(list) ? list : [])
  } catch {
    return new Set()
  }
}

/**
 * writeOverride — atomically add or remove a skill from the trust override list.
 *
 * @param key - Skill key from overrideKey(owner, name).
 * @param trusted - true to add, false to remove.
 */
export async function writeOverride(key: string, trusted: boolean): Promise<void> {
  const file = getOverridesFile()
  await mkdir(path.dirname(file), { recursive: true }).catch(() => undefined)

  const current = await readOverrides()
  if (trusted) {
    current.add(key)
  } else {
    current.delete(key)
  }

  const tmp = file + ".tmp"
  await writeFile(tmp, JSON.stringify([...current], null, 2), "utf8")
  await chmod(tmp, 0o600)
  await rename(tmp, file)
}

/**
 * overrideKey — normalize owner/name to a consistent key for Set lookups.
 *
 * @example overrideKey("Vercel-Labs", "Agent-Skills") → "vercel-labs/agent-skills"
 */
export function overrideKey(owner: string, name: string): string {
  return `${owner}/${name}`.toLowerCase()
}
