/**
 * audit/runner.spec.ts — Phase 15 Cap.3.
 *
 * Playwright spec. Walks ROUTES × PERSONAS for the currently-selected
 * viewport project (one project per viewport — see playwright.config.ts),
 * and for each cell:
 *   1. Applies the persona's cookies (skip for role:"none" — first-time
 *      founder).
 *   2. Navigates to the route with waitUntil:"networkidle".
 *   3. Writes a full-page PNG to
 *        audit/shots/<fixture>/<persona>/<slug>--<viewport>.png
 *   4. Writes a DOM truth extract to <...>.truth.json
 *   5. Writes captured console errors + page errors to <...>.console.json
 *
 * Why this file is `.spec.ts` not `.test.ts`:
 *   Vitest greps for `*.test.ts`. Playwright's test() is not Vitest's
 *   test(). Keeping runner as `.spec.ts` guarantees Vitest ignores it.
 *
 * Secret handling:
 *   AUTH_SECRET (or NEXTAUTH_SECRET for v4 compat) must be in env. The
 *   runner exits hard at test-collection time if missing — no point
 *   driving screenshots of a signed-out /signin page by accident.
 *
 * Gotcha — networkidle:
 *   Dashboard pages open SSE streams (/api/tail etc). SSE keeps the
 *   network "active" forever, so waitUntil:"networkidle" alone hangs.
 *   We cap with a `page.waitForLoadState` + 3s grace, then screenshot
 *   whatever we have. This matches the Phase 13 screenshot harness
 *   convention.
 */
import { test, expect, type Cookie } from "@playwright/test"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { ROUTES, type PersonaId } from "./routes"
import { PERSONAS, buildPersonaCookies, type Persona } from "./personas"
import { extractTruth } from "./scrape/data-truth"
import { clickwalkRoute } from "./scrape/clickwalk"

const FIXTURE = process.env.FIXTURE ?? "healthy"
const BASE_URL = process.env.AUDIT_BASE_URL ?? "http://localhost:3002"
const SECRET = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET

if (!SECRET) {
  throw new Error(
    "audit/runner: AUTH_SECRET (or NEXTAUTH_SECRET) is required. " +
      "Run: export AUTH_SECRET=$(openssl rand -base64 32)",
  )
}

// Pre-mint cookies once per persona — mintSessionState involves JWE
// encryption and we don't need to do it inside every test case.
const cookieCache = new Map<PersonaId, Cookie[]>()

test.beforeAll(async () => {
  for (const persona of PERSONAS) {
    const cookies = await buildPersonaCookies(persona, {
      secret: SECRET,
      baseUrl: BASE_URL,
    })
    cookieCache.set(persona.id, cookies)
  }
})

function baseOutPath(persona: Persona, slug: string, viewport: string): string {
  return join(
    __dirname,
    "shots",
    FIXTURE,
    persona.name,
    `${slug}--${viewport}`,
  )
}

async function ensureDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true })
}

for (const route of ROUTES) {
  for (const persona of PERSONAS) {
    // Persona gating: some admin-only routes only list `admin` in their
    // personas[] — skip capture for other personas rather than burning
    // a 403 screenshot per cell (we still capture /403 itself once via
    // the explicit /403 entry).
    if (!route.personas.includes(persona.id)) continue

    test(`${route.slug} · ${persona.name}`, async ({ page, context }, testInfo) => {
      const viewport = testInfo.project.name
      const outBase = baseOutPath(persona, route.slug, viewport)
      await ensureDir(outBase + ".png")

      // ── Cookies: skip for the no-auth persona (first-time founder) ──
      const cookies = cookieCache.get(persona.id) ?? []
      if (cookies.length > 0) {
        await context.addCookies(cookies)
      }

      // ── Console + page-error capture ────────────────────────────────
      interface ConsoleCapture {
        type: string
        text: string
        location?: string
      }
      const consoleEvents: ConsoleCapture[] = []
      page.on("console", (msg) => {
        const t = msg.type()
        // Only retain warning + error levels — the dev build spams log/
        // info/debug on every keystroke and we don't care.
        if (t === "error" || t === "warning") {
          const loc = msg.location()
          consoleEvents.push({
            type: t,
            text: msg.text(),
            location: loc.url ? `${loc.url}:${loc.lineNumber}:${loc.columnNumber}` : undefined,
          })
        }
      })
      const pageErrors: Array<{ name: string; message: string; stack?: string }> = []
      page.on("pageerror", (err) => {
        pageErrors.push({ name: err.name, message: err.message, stack: err.stack })
      })

      // ── Navigate. SSE-heavy pages never hit networkidle, so we fall
      //    back to domcontentloaded + a small settle grace. ────────────
      let navOk = true
      try {
        await page.goto(route.path, {
          waitUntil: "domcontentloaded",
          timeout: 20_000,
        })
        // Best-effort wait for JS-driven content to render. Failure here
        // is fine — we still screenshot whatever rendered.
        await page
          .waitForLoadState("networkidle", { timeout: 5_000 })
          .catch(() => undefined)
      } catch (err) {
        navOk = false
        pageErrors.push({
          name: "NavigationError",
          message: err instanceof Error ? err.message : String(err),
        })
      }

      // ── Screenshot ──────────────────────────────────────────────────
      await page
        .screenshot({ path: outBase + ".png", fullPage: true })
        .catch(async (err) => {
          // Page may be too tall / crashed — fall back to a viewport shot.
          pageErrors.push({
            name: "ScreenshotError",
            message: err instanceof Error ? err.message : String(err),
          })
          await page.screenshot({ path: outBase + ".png" }).catch(() => undefined)
        })

      // ── Truth extract (data-truth annotations) ──────────────────────
      const truth = await extractTruth(page)
      await writeFile(outBase + ".truth.json", JSON.stringify(truth, null, 2), "utf8")

      // ── Optional clickwalk (AUDIT_CLICKWALK=1) — time-bound ────────
      if (process.env.AUDIT_CLICKWALK === "1") {
        try {
          const walk = await clickwalkRoute(
            page as unknown as Parameters<typeof clickwalkRoute>[0],
            { path: route.path, slug: route.slug },
          )
          await writeFile(
            outBase.replace(/--[^-]+$/, `--clickwalk`) + ".json",
            JSON.stringify(walk, null, 2),
            "utf8",
          )
        } catch (err) {
          pageErrors.push({
            name: "ClickwalkError",
            message: err instanceof Error ? err.message : String(err),
          })
        }
      }

      // ── Console JSON sidecar ────────────────────────────────────────
      await writeFile(
        outBase + ".console.json",
        JSON.stringify(
          {
            route: route.path,
            persona: persona.id,
            viewport,
            fixture: FIXTURE,
            navigated_ok: navOk,
            console: consoleEvents,
            page_errors: pageErrors,
          },
          null,
          2,
        ),
        "utf8",
      )

      // Assertion: the file must exist. We don't fail the test on
      // nav errors — those are valid data points for the audit.
      expect(truth).toBeDefined()
    })
  }
}
