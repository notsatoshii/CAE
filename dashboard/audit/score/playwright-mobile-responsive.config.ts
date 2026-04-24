/**
 * audit/score/playwright-mobile-responsive.config.ts — class5A smoke config.
 *
 * Invoked as:
 *   AUDIT_BASE_URL=http://localhost:3002 \
 *     npx playwright test -c audit/score/playwright-mobile-responsive.config.ts
 *
 * Kept separate from the main audit/playwright.config.ts so the Phase 15
 * screenshot harness stays untouched — this file matches ONLY the
 * mobile-responsive smoke spec + runs on a 375x667 mobile viewport.
 */
import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.AUDIT_BASE_URL ?? "http://localhost:3002";

export default defineConfig({
  testDir: __dirname,
  testMatch: ["mobile-responsive-smoke.spec.ts"],
  outputDir: "artifacts-mobile-responsive",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: !!process.env.CI,
  timeout: 30_000,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    storageState: undefined,
    colorScheme: "dark",
  },
  projects: [
    {
      name: "mobile-375",
      use: { ...devices["iPhone SE"], viewport: { width: 375, height: 667 } },
    },
  ],
});
