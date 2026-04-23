/**
 * audit/seed-fixture.ts — Phase 15 Cap.7.
 *
 * CLI shim. Usage:
 *   npx tsx audit/seed-fixture.ts <fixture-name> [--root <dir>]
 *
 * <fixture-name> ∈ { empty, healthy, degraded, broken }.
 * Dynamic-imports audit/fixtures/<name>.ts, calls its seed(root), then
 * prints a summary.
 *
 * Default --root is CAE_ROOT ?? ./audit/.cae-run (scratch dir under the
 * audit harness, gitignored).
 */
import { readdir, stat } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join, resolve } from "node:path"

export type FixtureName = "empty" | "healthy" | "degraded" | "broken"

const VALID: readonly FixtureName[] = [
  "empty",
  "healthy",
  "degraded",
  "broken",
] as const

function isValid(n: string): n is FixtureName {
  return (VALID as readonly string[]).includes(n)
}

export interface SeedSummary {
  fixture: FixtureName
  root: string
  fileCount: number
  totalBytes: number
}

// caveman: walk everything under root and sum bytes — cheap recursive scan.
async function walk(dir: string): Promise<Array<{ path: string; size: number }>> {
  if (!existsSync(dir)) return []
  const out: Array<{ path: string; size: number }> = []
  const entries = await readdir(dir, { withFileTypes: true })
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      out.push(...(await walk(p)))
    } else if (e.isFile()) {
      const s = await stat(p)
      out.push({ path: p, size: s.size })
    }
  }
  return out
}

export async function seedFixture(
  name: string,
  rootArg?: string,
): Promise<SeedSummary> {
  if (!isValid(name)) {
    throw new Error(
      `audit/seed-fixture: unknown fixture "${name}". ` +
        `Valid: ${VALID.join(", ")}`,
    )
  }
  const root = resolve(
    rootArg ?? process.env.CAE_ROOT ?? join(process.cwd(), "audit/.cae-run"),
  )
  // caveman: ./fixtures/<name>.ts relative to this file's runtime location
  const mod = (await import(`./fixtures/${name}.js`).catch(
    () => import(`./fixtures/${name}`),
  )) as { seed: (root: string) => Promise<void> }
  await mod.seed(root)

  const files = await walk(join(root, ".cae"))
  const totalBytes = files.reduce((acc, f) => acc + f.size, 0)
  return { fixture: name, root, fileCount: files.length, totalBytes }
}

// ── CLI entrypoint ─────────────────────────────────────────────────────
function parseArgs(argv: string[]): { name: string; root?: string } {
  const args = argv.slice(2)
  let name: string | undefined
  let root: string | undefined
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === "--root") {
      root = args[++i]
    } else if (!name && a && !a.startsWith("--")) {
      name = a
    }
  }
  if (!name) {
    throw new Error(
      "Usage: npx tsx audit/seed-fixture.ts <empty|healthy|degraded|broken> [--root <dir>]",
    )
  }
  return { name, root }
}

export async function main(argv: string[] = process.argv): Promise<void> {
  const { name, root } = parseArgs(argv)
  const s = await seedFixture(name, root)
  console.log(
    `[seed] fixture=${s.fixture} root=${s.root} files=${s.fileCount} bytes=${s.totalBytes}`,
  )
}

// ESM: run main when invoked directly (tsx / node).
// caveman: cheap check — argv[1] ends with this filename.
const invoked = process.argv[1] && /seed-fixture\.(ts|js)$/.test(process.argv[1])
if (invoked) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
