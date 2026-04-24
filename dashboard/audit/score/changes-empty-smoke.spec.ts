/**
 * Class 5C — Playwright smoke for /build/changes empty-state render.
 *
 * Run via:
 *   AUDIT_BASE_URL=http://localhost:3002 \
 *     npx playwright test -c audit/score/playwright-changes-empty.config.ts
 *
 * Acceptance (phantom-empty-state regression guard):
 *   1. /build/changes under an empty fixture renders the EmptyState
 *      primitive (data-testid="changes-empty").
 *   2. ZERO change-row items are present (no Array.from({length:N}) phantom
 *      placeholder rows ever fabricated on the page).
 *   3. The empty copy contains no dummy/lorem/stub placeholder words — we
 *      explicitly grep for them to catch a regression.
 *
 * Route interception: the spec mocks GET /api/changes to return a
 * `{ projects: [] }` body so the client renders its empty branch without
 * depending on the dev machine's git state.
 */
import { test, expect } from "@playwright/test";
import { buildPersonaCookies, PERSONAS } from "../personas";

const SECRET =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  "test-secret-do-not-use-in-prod";

test.describe("/build/changes empty state (class 5C)", () => {
  test.beforeEach(async ({ context, baseURL, page }) => {
    const operator = PERSONAS.find((p) => p.id === "operator");
    if (!operator) throw new Error("operator persona missing");
    const cookies = await buildPersonaCookies(operator, {
      secret: SECRET,
      baseUrl: baseURL ?? "http://localhost:3002",
    });
    if (cookies.length) await context.addCookies(cookies);

    // Intercept the changes API with an empty fixture so the route always
    // renders its empty branch, regardless of the dev repo state.
    await page.route("**/api/changes", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          projects: [],
          generated_at: new Date().toISOString(),
          cache_ttl_ms: 30_000,
        }),
      }),
    );
  });

  test("renders EmptyState with 0 change-row items and no phantom placeholder copy", async ({
    page,
  }) => {
    await page.goto("/build/changes", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});

    // 1. Empty-state root appears.
    const emptyRoot = page.locator('[data-testid="build-changes-empty-root"]');
    await emptyRoot.waitFor({ state: "attached", timeout: 5_000 });

    const emptyCard = page.locator('[data-testid="changes-empty"]');
    await emptyCard.waitFor({ state: "attached", timeout: 5_000 });
    expect(await emptyCard.count()).toBe(1);

    // 2. Zero change-row items — no phantom rows fabricated.
    const rows = await page.locator('[data-testid="change-row"]').count();
    expect(rows, "empty state must not render any change-row items").toBe(0);

    // Safety net: the accordion shell must not be rendered either.
    const accordion = await page.locator('[data-testid="changes-accordion"]').count();
    expect(accordion, "accordion must not render under empty state").toBe(0);

    // 3. No dummy/lorem/stub placeholder copy in the rendered empty card.
    const emptyText = ((await emptyCard.textContent()) ?? "").toLowerCase();
    for (const banned of ["lorem", "ipsum", "dummy", "test row", "stub row"]) {
      expect(emptyText, `empty copy must not contain "${banned}"`).not.toContain(
        banned,
      );
    }

    // 4. Empty copy is non-trivial (actual guidance, not a blank card).
    expect(emptyText.length).toBeGreaterThan(10);
  });
});
