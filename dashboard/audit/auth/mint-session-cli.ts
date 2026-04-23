/**
 * CLI entry for mint-session — split off the library so Playwright's
 * CJS transform chain (personas.ts → mint-session.ts) doesn't choke on
 * `import.meta.url`. Only this file uses ESM-specific features.
 *
 * Usage: AUTH_SECRET=... npx tsx audit/auth/mint-session-cli.ts
 */
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { loadEnvLocal, mintSessionState } from "./mint-session"

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url))
  // audit/auth → audit → dashboard
  const repoRoot = join(here, "..", "..")

  await loadEnvLocal(repoRoot)

  const baseUrl = process.env.AUDIT_BASE_URL ?? "http://localhost:3002"
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error(
      "AUTH_SECRET (or NEXTAUTH_SECRET) is required. Add it to .env.local " +
        "or run: openssl rand -base64 32",
    )
  }

  const email = process.env.AUDIT_HARNESS_EMAIL
  const role = process.env.AUDIT_HARNESS_ROLE
  const state = await mintSessionState({ baseUrl, secret, email, role })

  const outPath = join(here, "storage-state.json")
  await mkdir(dirname(outPath), { recursive: true })
  await writeFile(outPath, JSON.stringify(state, null, 2) + "\n", "utf8")

  // eslint-disable-next-line no-console
  console.log(
    `mint-session: wrote ${outPath}\n` +
      `  baseUrl  = ${baseUrl}\n` +
      `  cookie   = ${state.cookies[0].name}\n` +
      `  domain   = ${state.cookies[0].domain}\n` +
      `  email    = ${email ?? "harness@cae.local"}\n` +
      `  role     = ${role ?? "admin"}\n` +
      `  expires  = ${new Date(state.cookies[0].expires * 1000).toISOString()}`,
  )
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("mint-session failed:", err)
  process.exit(1)
})
