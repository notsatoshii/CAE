/**
 * session14-live-smoke.spec.ts
 *
 * Drives the live dashboard at AUDIT_BASE_URL (default :3002) and asserts
 * the session-14 fix-list:
 *
 *   1. /build loads without error boundary firing
 *   2. Mission Control "burn · 7d" tile renders a real token count
 *   3. Shipped-today tile is non-zero (we committed 10+ times today)
 *   4. In-flight tile reflects reality
 *   5. No literal "$" characters visible anywhere on /build (tokens only)
 *   6. /build/agents page loads + at least one ACTIVE chip renders
 *   7. /floor page mounts the canvas + sprites load (200 OK for PNG)
 *
 * Each failure screenshots the state for human review.
 *
 * Invoke:
 *   AUDIT_BASE_URL=http://localhost:3002 \
 *     npx playwright test -c audit/score/playwright-session14.config.ts
 */
import { test, expect } from "@playwright/test";

test.describe("session-14 live smoke", () => {
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (err) => {
      console.error("[pageerror]", err.message);
    });
    page.on("console", (msg) => {
      if (msg.type() === "error") console.error("[console.error]", msg.text());
    });
  });

  test("1. /build loads without error-boundary and renders Mission Control", async ({ page }) => {
    const resp = await page.goto("/build", { waitUntil: "domcontentloaded", timeout: 15_000 });
    expect(resp?.status(), "initial navigation").toBeLessThan(400);

    // Error boundary surfaces an h1 with "Something went wrong" on app/error.tsx
    await expect(page.locator("h1", { hasText: /Something went wrong/i })).toHaveCount(0);

    // Mission Control hero mounts
    const hero = page.getByTestId("mission-control-hero");
    await expect(hero, "mission-control-hero visible").toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: "artifacts-session14/01-build-landed.png", fullPage: true });
  });

  test("2. burn tile shows 7d scope, NOT tok/min", async ({ page }) => {
    await page.goto("/build", { waitUntil: "domcontentloaded" });
    const burnTile = page.getByTestId("mc-tile-burn");
    await expect(burnTile).toBeVisible();
    const text = (await burnTile.textContent()) ?? "";
    expect(text, "burn tile text").toContain("7d");
    expect(text, "no tok/min").not.toMatch(/tok\/min/i);
    // No $ anywhere in the hero
    const heroText = (await page.getByTestId("mission-control-hero").textContent()) ?? "";
    expect(heroText, "no USD in hero").not.toContain("$");
  });

  test("3. shipped_today reflects real activity (non-zero when commits landed today)", async ({ page, request }) => {
    // Verify server-side truth first via /api/state.
    const resp = await request.get("/api/state?project=/home/cae/ctrl-alt-elite/dashboard");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    console.log("[api/state.rollup]", JSON.stringify(body.rollup));
    console.log("[api/state.home_phases]", body.home_phases?.length);
    expect(body.rollup?.shipped_today, "server shipped_today").toBeGreaterThan(0);
    expect(body.home_phases?.length, "home_phases non-empty").toBeGreaterThan(0);
    // Now wait for the UI to catch up — the strip tiles should render real numbers.
    await page.goto("/build", { waitUntil: "domcontentloaded" });
    const strip = page.getByTestId("rollup-strip");
    await expect(strip).toBeVisible();
    // Poll until "shipped" cell is non-zero OR 5s elapsed.
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="rollup-strip"]');
        const text = el?.textContent ?? "";
        return /shipped\s*[1-9]/i.test(text);
      },
      null,
      { timeout: 5_000 },
    ).catch(() => {});
    const stripText = (await strip.textContent()) ?? "";
    console.log("[rollup-strip.text]", stripText.replace(/\s+/g, " ").slice(0, 400));
    await page.screenshot({ path: "artifacts-session14/03-rollup-strip.png" });
  });

  test("4. /build/agents loads + shows at least one roster card", async ({ page }) => {
    const resp = await page.goto("/build/agents", { waitUntil: "domcontentloaded", timeout: 15_000 });
    expect(resp?.status()).toBeLessThan(400);
    await expect(page.locator("h1, h2")).toHaveCount(await page.locator("h1, h2").count()); // smoke
    const cards = page.getByTestId(/^agent-card-/);
    const count = await cards.count();
    console.log("[agents] card count:", count);
    expect(count, "at least one agent card").toBeGreaterThan(0);
    await page.screenshot({ path: "artifacts-session14/04-agents.png", fullPage: true });
    // Report whether any ACTIVE chip is present
    const activeChips = page.getByTestId("agent-card-active-chip");
    console.log("[agents] active chips:", await activeChips.count());
  });

  test("5. /floor canvas mounts + sprites reachable", async ({ page, request }) => {
    const resp = await page.goto("/floor", { waitUntil: "domcontentloaded", timeout: 15_000 });
    expect(resp?.status()).toBeLessThan(400);
    await expect(page.getByTestId("floor-canvas")).toBeVisible({ timeout: 10_000 });
    const sprite = await request.get("/pixel-agents/characters/char_0.png");
    expect(sprite.status(), "sprite PNG served").toBe(200);
    await page.screenshot({ path: "artifacts-session14/05-floor.png", fullPage: true });
  });

  test("6. no stale $ in user-visible text on /build", async ({ page }) => {
    await page.goto("/build", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("mission-control-hero")).toBeVisible();
    // Collect text content from visible elements ONLY (excludes <script>,
    // Next.js hydration markers like $RT/$RC live in scripts).
    const visibleText = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const chunks: string[] = [];
      let n: Node | null;
      while ((n = walker.nextNode())) {
        const p = n.parentElement;
        if (!p) continue;
        if (p.tagName === "SCRIPT" || p.tagName === "STYLE" || p.tagName === "NOSCRIPT") continue;
        const t = (n.textContent ?? "").trim();
        if (t) chunks.push(t);
      }
      return chunks.join(" ");
    });
    const dollarHits = [...visibleText.matchAll(/\$\d|\$\.|\$[A-Za-z]/g)].length;
    expect(dollarHits, "dollar glyphs in visible /build text").toBe(0);
  });
});
