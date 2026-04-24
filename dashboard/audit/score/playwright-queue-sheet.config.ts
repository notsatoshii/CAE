/**
 * audit/score/playwright-queue-sheet.config.ts — class19b smoke config.
 *
 * Invoked as:
 *   AUDIT_BASE_URL=http://localhost:3002 \
 *     npx playwright test -c audit/score/playwright-queue-sheet.config.ts
 *
 * Kept separate from the main audit/playwright.config.ts so the Phase 15
 * screenshot harness stays untouched — this file matches ONLY the
 * queue-sheet smoke spec + runs on a single viewport (laptop).
 */
import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.AUDIT_BASE_URL ?? "http://localhost:3002";

export default defineConfig({
  testDir: __dirname,
  testMatch: ["queue-sheet-smoke.spec.ts"],
  outputDir: "artifacts-queue-sheet",
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
      name: "laptop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
});
