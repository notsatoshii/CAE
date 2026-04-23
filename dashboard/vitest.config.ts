/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import path from "node:path";

// Phase 8 Wave 0 (D-13): first-run Vitest config for the dashboard.
// - jsdom env covers component tests later (Browse / Graph panes).
// - `@` alias mirrors tsconfig paths so tests and production code import
//   the same way.
// - Setup file registers @testing-library/jest-dom custom matchers.
// Phase 15 Cap.1: include audit/**/*.test.ts so harness unit tests run with
// the rest of the suite. Playwright runner specs are excluded by name (they
// are driven by `npx playwright test`, not Vitest).
export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: [
      "lib/**/*.test.ts",
      "lib/**/*.test.tsx",
      "components/**/*.test.tsx",
      "app/**/*.test.ts",
      "app/**/*.test.tsx",
      "tests/**/*.test.ts",
      "tests/**/*.test.tsx",
      "audit/**/*.test.ts",
    ],
    exclude: [
      "**/node_modules/**",
      "audit/runner.ts",
      "audit/shots/**",
      "audit/reports/**",
      // node:test runner files — driven by `npx tsx <file>`, not Vitest.
      // Vitest chokes on `test()` imported from node:test.
      "lib/cae-nl-draft.test.ts",
      "lib/cae-queue-state.test.ts",
      "lib/cae-workflows.test.ts",
      "app/api/workflows/route.test.ts",
      "components/workflows/step-graph.test.tsx",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
