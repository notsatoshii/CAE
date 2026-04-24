/**
 * playwright-session14.config.ts — live smoke runner for session-14 fixes.
 *
 * Invoke:
 *   AUDIT_BASE_URL=http://localhost:3002 \
 *     npx playwright test -c audit/score/playwright-session14.config.ts
 */
import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

const BASE_URL = process.env.AUDIT_BASE_URL ?? "http://localhost:3002";

export default defineConfig({
  testDir: __dirname,
  testMatch: ["session14-live-smoke.spec.ts"],
  outputDir: "artifacts-session14",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
    colorScheme: "dark",
    storageState: resolve(__dirname, "../auth/storage-state.json"),
  },
  projects: [
    {
      name: "desktop-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
});
