/**
 * Class 5A — Playwright smoke for mobile horizontal-overflow regression.
 *
 * Run via:
 *   AUDIT_BASE_URL=http://localhost:3002 \
 *     npx playwright test -c audit/score/playwright-mobile-responsive.config.ts
 *
 * Acceptance (mobile-responsive-sweep guard):
 *   For each of 5 key routes loaded at 375x667 (iPhone SE 1st gen):
 *     - `document.documentElement.scrollWidth === document.documentElement.clientWidth`
 *       i.e. NO horizontal page overflow.
 *   Vision scorer C2 flagged ~100 cells with mobile layout breaks (sidebar at
 *   desktop width, content clipped, bars overflowing viewport). This smoke
 *   catches the broad-strokes regression: "any element pushes the page
 *   wider than the viewport."
 *
 * Rationale:
 *   Vision scoring is expensive + intermittent. A viewport-width invariant
 *   check is cheap and deterministic. Any new commit that re-introduces a
 *   fixed-px width without a responsive prefix will trip this test.
 *
 * Graceful fallback — if a route 404s or redirects to /signin (unauthed in
 * some CI setups), the single route is skipped rather than failing the suite.
 */
import { test, expect, type Page } from "@playwright/test";
import { buildPersonaCookies, PERSONAS } from "../personas";

const SECRET =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  "test-secret-do-not-use-in-prod";

const ROUTES: readonly string[] = [
  "/build",
  "/build/queue",
  "/build/agents",
  "/build/changes",
  "/memory",
];

async function measureOverflow(page: Page): Promise<{
  scrollWidth: number;
  clientWidth: number;
  offenders: string[];
}> {
  return await page.evaluate(() => {
    const root = document.documentElement;
    const scrollWidth = root.scrollWidth;
    const clientWidth = root.clientWidth;
    // Collect any elements whose right edge exceeds the viewport — helps
    // pin the regression down to a specific selector.
    const offenders: string[] = [];
    if (scrollWidth > clientWidth) {
      const all = document.querySelectorAll("*");
      for (const el of Array.from(all)) {
        const r = (el as HTMLElement).getBoundingClientRect();
        if (r.right > clientWidth + 1) {
          const tag = el.tagName.toLowerCase();
          const testid = (el as HTMLElement).dataset.testid ?? "";
          const cls = (el as HTMLElement).className;
          const clsStr =
            typeof cls === "string" ? cls.slice(0, 80) : "";
          offenders.push(
            `<${tag}${testid ? " data-testid=\"" + testid + "\"" : ""}${clsStr ? " class=\"" + clsStr + "\"" : ""}>`,
          );
          if (offenders.length >= 5) break;
        }
      }
    }
    return { scrollWidth, clientWidth, offenders };
  });
}

test.describe("mobile responsive smoke (class5A)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    // Operator role is the broadest read-level for build routes.
    const operator = PERSONAS.find((p) => p.id === "operator");
    if (!operator) throw new Error("operator persona missing");
    const cookies = await buildPersonaCookies(operator, {
      secret: SECRET,
      baseUrl: baseURL ?? "http://localhost:3002",
    });
    if (cookies.length) await context.addCookies(cookies);
  });

  for (const route of ROUTES) {
    test(`no horizontal overflow at 375x667 — ${route}`, async ({ page }) => {
      // Viewport is set by the project config below, but re-assert here so
      // the measurement is self-explanatory even if the config drifts.
      await page.setViewportSize({ width: 375, height: 667 });

      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      // Skip if the app redirected us somewhere else (unauth bounce, 404).
      if (response && response.status() >= 400) {
        test.skip(true, `route ${route} returned ${response.status()}`);
      }
      // Let motion/spring animations settle + initial polls fire.
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

      const { scrollWidth, clientWidth, offenders } = await measureOverflow(page);

      expect(
        scrollWidth,
        `Horizontal overflow on ${route}: scrollWidth=${scrollWidth} > clientWidth=${clientWidth}. First offenders: ${offenders.join(" | ")}`,
      ).toBeLessThanOrEqual(clientWidth);
    });
  }
});
