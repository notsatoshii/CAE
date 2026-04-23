/**
 * audit/playwright.config.ts — Phase 15 Cap.3.
 *
 * Config for the screenshot-truth harness. Invoked as:
 *   AUDIT_BASE_URL=http://localhost:3002 FIXTURE=healthy \
 *     npx playwright test -c audit/playwright.config.ts
 *
 * Why this file (and this file only) imports `@playwright/test`:
 *   Vitest's test discovery greps for `*.test.ts`. If we named anything
 *   under `audit/` `*.test.ts` and it imported `@playwright/test`,
 *   Vitest would load it and explode on Playwright's custom test().
 *   Keeping Playwright confined to `runner.spec.ts` + this config is
 *   the whole reason for the `.spec.ts` suffix convention here.
 *
 * Design decisions:
 *   - baseURL: AUDIT_BASE_URL || http://localhost:3002. The runner uses
 *     relative paths (page.goto("/build")) so baseURL is the single
 *     switch between local dev + any ngrok/preview URL.
 *   - storageState: not set globally. The runner spec calls
 *     context.addCookies() per-persona inside each test case. A global
 *     storageState would force every test to share one auth state, which
 *     is the opposite of what we want.
 *   - outputDir: audit/shots/<fixture>/ — Playwright writes trace/video/
 *     failure artifacts here too, gitignored via audit/.gitignore.
 *   - projects: one per viewport, serialised via fullyParallel=false +
 *     workers=1 so the Next dev server isn't hammered by parallel page
 *     loads (it has no backpressure control).
 */
import { defineConfig, devices } from "@playwright/test"
import { VIEWPORTS } from "./viewports"

const BASE_URL = process.env.AUDIT_BASE_URL ?? "http://localhost:3002"
const FIXTURE = process.env.FIXTURE ?? "healthy"

export default defineConfig({
  testDir: __dirname,
  // Only match the runner. We explicitly avoid `.test.ts` so Vitest won't
  // pick it up. See top-of-file note.
  testMatch: ["runner.spec.ts"],
  outputDir: `shots/${FIXTURE}/_pw-artifacts`,
  // Parallelism: Next dev handles concurrent requests fine; override with
  // AUDIT_WORKERS env (default 4). fs-backed aggregators only RACE on
  // writes, and cycles are read-only against the seeded fixture, so
  // parallel reads are safe.
  fullyParallel: true,
  workers: Number(process.env.AUDIT_WORKERS ?? 4),
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  reporter: [
    ["list"],
    ["json", { outputFile: `shots/${FIXTURE}/_pw-report.json` }],
  ],
  use: {
    baseURL: BASE_URL,
    // Don't snapshot trace/video by default — full-page PNGs + console
    // JSON are the primary artifacts and the runner writes those itself.
    trace: "retain-on-failure",
    screenshot: "off",
    video: "off",
    // Every persona injects its own cookies; start with a clean slate.
    storageState: undefined,
    // Cut down on extraneous motion — the FE still honors
    // prefers-reduced-motion where wired up.
    colorScheme: "dark",
  },
  // One project per viewport so `npx playwright test --project=laptop`
  // runs just that size when debugging.
  projects: VIEWPORTS.map((v) => ({
    name: v.name,
    use: {
      ...devices["Desktop Chrome"],
      viewport: v.size,
    },
  })),
})
