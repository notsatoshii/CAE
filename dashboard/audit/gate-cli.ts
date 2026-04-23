/**
 * audit/gate-cli.ts — Phase 15 Cap.8.
 *
 * Thin CLI around checkFixGate(). Usage:
 *   npx tsx audit/gate-cli.ts <cycle> --prior <prior>
 *     [--routes build,build-queue] [--reports-dir <path>]
 *
 * Exit 0 on pass, 1 on fail. Prints reasons + regressions + unresolved.
 */
import { checkFixGate } from "./gate"

function parseArgs(argv: string[]): {
  cycle: string
  prior?: string
  routes?: string[]
  reportsDir?: string
} {
  const args = argv.slice(2)
  let cycle: string | undefined
  let prior: string | undefined
  let routes: string[] | undefined
  let reportsDir: string | undefined
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === "--prior") prior = args[++i]
    else if (a === "--routes") routes = args[++i].split(",").map((s) => s.trim())
    else if (a === "--reports-dir") reportsDir = args[++i]
    else if (!cycle && a && !a.startsWith("--")) cycle = a
  }
  if (!cycle) {
    throw new Error(
      "Usage: npx tsx audit/gate-cli.ts <cycle> [--prior <label>] [--routes a,b,c]",
    )
  }
  return { cycle, prior, routes, reportsDir }
}

export async function main(argv: string[] = process.argv): Promise<number> {
  const a = parseArgs(argv)
  const result = await checkFixGate({
    cycle: a.cycle,
    priorCycle: a.prior,
    reportsDir: a.reportsDir,
    routeFilter: a.routes,
  })
  if (result.pass) {
    console.log(`[gate] PASS — cycle=${a.cycle} prior=${a.prior ?? "(none)"}`)
    if (a.routes) console.log(`[gate] scope: ${a.routes.join(", ")}`)
    return 0
  }
  console.error(`[gate] FAIL — cycle=${a.cycle}`)
  for (const r of result.reasons) console.error(`[gate]   ${r}`)
  if (result.regressions.length > 0) {
    console.error(`[gate] regressions:`)
    for (const r of result.regressions) {
      console.error(
        `[gate]   ${r.slug} · ${r.pillar}: ${r.from} → ${r.to}`,
      )
    }
  }
  if (result.unresolved.length > 0) {
    console.error(`[gate] unresolved (≤3):`)
    for (const u of result.unresolved) {
      console.error(`[gate]   ${u.slug} · ${u.pillar}: ${u.score}`)
    }
  }
  return 1
}

const invoked = process.argv[1] && /gate-cli\.(ts|js)$/.test(process.argv[1])
if (invoked) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err)
      process.exit(2)
    })
}
