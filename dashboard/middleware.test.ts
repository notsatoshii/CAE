/**
 * Tests for middleware.ts — role-based route gating
 * Phase 14 Plan 04 — Task 2
 *
 * Strategy: middleware is a NextAuth-wrapped function. We test the inner
 * logic by constructing fake NextRequest objects with req.auth attached,
 * bypassing the NextAuth layer.
 *
 * NOTE: middleware.test.ts is at root — add to vitest include via tests/ alias
 * by moving to tests/middleware/.
 */
export {} // make TS treat as module
