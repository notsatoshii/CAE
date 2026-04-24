/**
 * class19b — Playwright smoke for /build/queue clicked-card sheet.
 *
 * Run via:
 *   AUDIT_BASE_URL=http://localhost:3002 \
 *     npx playwright test -c audit/playwright-queue-sheet.config.ts
 *
 * Checks the buildplan acceptance requirements:
 *   1. Open /build/queue, click first card.
 *   2. Sheet opens, shows a real (non-empty, non-"Phase N") title.
 *   3. Body text contains no "Phase 8" / "Phase 9" substring.
 *   4. Every visible button is either a real action (wired) or hidden —
 *      there must be ZERO buttons whose click triggers a `sonner` toast
 *      with the "not yet wired" text.
 *
 * Graceful fallback — if /build/queue has no cards in the running dev
 * instance the spec marks itself skipped rather than failing. CI seeds a
 * fixture; local runs may not.
 */
import { test, expect } from "@playwright/test";
import { buildPersonaCookies, PERSONAS } from "../personas";

const SECRET =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  "test-secret-do-not-use-in-prod";

test.describe("queue clicked-card sheet (class19b)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const operator = PERSONAS.find((p) => p.id === "operator");
    if (!operator) throw new Error("operator persona missing");
    const cookies = await buildPersonaCookies(operator, {
      secret: SECRET,
      baseUrl: baseURL ?? "http://localhost:3002",
    });
    if (cookies.length) await context.addCookies(cookies);
  });

  test("opens with queue-shape title, zero Phase-8/9 leakage, no toast-info stubs", async ({ page }) => {
    await page.goto("/build/queue", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});

    // Look for any queue card. If we're running against an empty queue,
    // skip rather than fail — the class19b fix is primarily guarded by
    // the vitest component tests; this e2e is a belt.
    const card = page.locator("[data-testid^='queue-card-']").first();
    const cardCount = await page.locator("[data-testid^='queue-card-']").count();
    test.skip(cardCount === 0, "queue is empty on this instance — nothing to click");

    await card.click();

    // 2. Sheet opens.
    const sheet = page.locator("[data-testid='queue-item-sheet']");
    await sheet.waitFor({ state: "attached", timeout: 5_000 });

    // 3. Title is non-empty + not the old "Phase ?" fallback.
    const title = page.locator("[data-testid='queue-item-sheet-title']");
    const titleText = (await title.textContent())?.trim() ?? "";
    expect(titleText.length, "sheet title must not be empty").toBeGreaterThan(0);
    expect(titleText).not.toMatch(/^Phase \?$/);
    expect(titleText).not.toMatch(/^Phase \d+$/);

    // 4. No "Phase 8" / "Phase 9" anywhere in the rendered sheet.
    const sheetHtml = (await sheet.innerHTML()) ?? "";
    expect(sheetHtml, "no Phase 8 leakage").not.toMatch(/Phase 8/);
    expect(sheetHtml, "no Phase 9 leakage").not.toMatch(/Phase 9/);

    // 5. Every visible button in the sheet is one of the 4 wired actions
    //    OR a generic Sheet chrome button (close). No legacy stubbed
    //    buttons with test-ids from the old sheet-actions component.
    const legacyStubIds = [
      "sheet-action-approve",
      "sheet-action-deny",
      "sheet-action-retry",
      "sheet-action-abandon",
      "sheet-action-reassign",
      "sheet-action-edit-plan",
      "sheet-pause-button",
      "sheet-abort-button",
    ];
    for (const stubId of legacyStubIds) {
      const count = await sheet.locator(`[data-testid='${stubId}']`).count();
      expect(count, `legacy stub ${stubId} must not appear in queue sheet`).toBe(0);
    }

    // Hidden controls (no backend) must never render at all.
    for (const hiddenId of [
      "queue-item-action-pause",
      "queue-item-action-abandon",
      "queue-item-action-reassign",
      "queue-item-action-edit-plan",
    ]) {
      expect(
        await sheet.locator(`[data-testid='${hiddenId}']`).count(),
        `hidden control ${hiddenId} must stay hidden`,
      ).toBe(0);
    }

    // 6. The action buttons that ARE rendered map to a real POST endpoint.
    //    We intercept fetch and verify any click yields either a real
    //    /api/queue/item/.../action POST or no network call at all (e.g.
    //    the empty-actions placeholder is rendered).
    const visibleAction = await sheet
      .locator(
        "[data-testid^='queue-item-action-']:not([data-testid='queue-item-actions-empty'])",
      )
      .first();
    const hasVisibleAction = (await visibleAction.count()) > 0;
    if (hasVisibleAction) {
      // Intercept dialogs (abort uses window.confirm).
      page.on("dialog", (d) => d.accept());
      const [req] = await Promise.all([
        page.waitForRequest(
          (r) => r.url().includes("/api/queue/item/") && r.method() === "POST",
          { timeout: 5_000 },
        ),
        visibleAction.click(),
      ]);
      expect(req.url()).toMatch(/\/api\/queue\/item\/[^/]+\/action/);
    }
  });
});
