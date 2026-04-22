/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import path from "node:path";

// Phase 8 Wave 0 (D-13): first-run Vitest config for the dashboard.
// - jsdom env covers component tests later (Browse / Graph panes).
// - `@` alias mirrors tsconfig paths so tests and production code import
//   the same way.
// - Setup file registers @testing-library/jest-dom custom matchers.
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
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
