/**
 * audit/score/playwright-pixel-agents.config.ts — pixel-agents smoke config.
 *
 * Invoked as:
 *   AUDIT_BASE_URL=http://localhost:3002 \
 *     npx playwright test -c audit/score/playwright-pixel-agents.config.ts
 */
import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.AUDIT_BASE_URL ?? "http://localhost:3002";

export default defineConfig({
  testDir: __dirname,
  testMatch: ["pixel-agents-smoke.spec.ts"],
  outputDir: "artifacts-pixel-agents",
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
      name: "desktop-1280",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
});
