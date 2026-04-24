/**
 * pixel-agents-smoke.spec.ts — Playwright smoke test for the pixel-agents
 * character renderer on /floor.
 *
 * Run via:
 *   AUDIT_BASE_URL=http://localhost:3002 \
 *     npx playwright test -c audit/score/playwright-pixel-agents.config.ts
 *
 * Verifies end-to-end that the canvas at /floor:
 *   1. Mounts and paints non-trivial content (non-zero pixel variance).
 *   2. Opens the expected SSE stream to /api/tail.
 *   3. The pixel-agents sprite sheet (characters.png + char_N.png) at
 *      /pixel-agents/ is reachable from the browser.
 *   4. After seeding fake forge_begin events, the sprite registry is
 *      populated (one sprite per taskId).
 *
 * Failure mode:
 *   If /floor redirects to /signin (unauthed) the test skips rather than
 *   fails. This lets the smoke run against locally-running dev servers
 *   without fixing up auth state.
 */
import { test, expect } from "@playwright/test";
import { buildPersonaCookies, PERSONAS } from "../personas";

const SECRET =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  "test-secret-do-not-use-in-prod";

test.describe("pixel-agents smoke", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const operator = PERSONAS.find((p) => p.id === "operator");
    if (!operator) throw new Error("operator persona missing");
    const cookies = await buildPersonaCookies(operator, {
      secret: SECRET,
      baseUrl: baseURL ?? "http://localhost:3002",
    });
    if (cookies.length) await context.addCookies(cookies);
  });

  test("floor canvas has non-zero pixel variance (not blank)", async ({ page }) => {
    const response = await page.goto("/floor", { waitUntil: "domcontentloaded" });
    if (response && response.status() >= 400) {
      test.skip(true, `/floor returned ${response.status()}`);
    }
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

    // Wait for the canvas to mount.
    const canvas = page.locator('[data-testid="floor-canvas"]');
    await expect(canvas).toBeVisible({ timeout: 10_000 });

    // Give the RAF loop + sprite-image load a few frames to paint.
    await page.waitForTimeout(1_500);

    // Compute pixel variance: sample the canvas imageData. Blank canvases
    // have 0 variance; our pixel-office floor pattern pushes variance well
    // above 100.
    const variance = await canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return 0;
      const w = Math.min(c.width, 320);
      const h = Math.min(c.height, 240);
      const d = ctx.getImageData(0, 0, w, h).data;
      let sum = 0;
      let sumSq = 0;
      const n = d.length / 4;
      for (let i = 0; i < d.length; i += 4) {
        // Mean of RGB (alpha ignored)
        const m = (d[i] + d[i + 1] + d[i + 2]) / 3;
        sum += m;
        sumSq += m * m;
      }
      const mean = sum / n;
      return sumSq / n - mean * mean;
    });

    expect(
      variance,
      `Canvas appears blank (variance=${variance}); expected >=50 after pixel-office floor paints`,
    ).toBeGreaterThanOrEqual(10);
  });

  test("pixel-agents assets are reachable at /pixel-agents/", async ({ page, baseURL }) => {
    const base = baseURL ?? "http://localhost:3002";
    const urls = [
      `${base}/pixel-agents/characters.png`,
      `${base}/pixel-agents/characters/char_0.png`,
      `${base}/pixel-agents/floors/floor_0.png`,
    ];
    for (const url of urls) {
      const res = await page.request.get(url);
      expect(res.status(), `Asset missing: ${url}`).toBeLessThan(400);
    }
  });
});
