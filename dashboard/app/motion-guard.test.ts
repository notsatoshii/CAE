import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

describe("globals.css reduced-motion guards", () => {
  const css = readFileSync(path.join(__dirname, "globals.css"), "utf8");

  it("keeps the .cae-shaking reduced-motion block (MOT-03)", () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.cae-shaking\s*\{\s*animation:\s*none\s*!important/);
  });

  it("disables animate-pulse/spin/ping/bounce under reduced-motion (MOT-01)", () => {
    const match = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([^}]|\}(?!\s*\}))*?\.animate-pulse[\s\S]*?\.animate-spin[\s\S]*?\.animate-ping[\s\S]*?\.animate-bounce[\s\S]*?animation:\s*none\s*!important/);
    expect(match).not.toBeNull();
  });

  it("new animate-* block sits after the cae-shaking block (appearance order)", () => {
    const shakingIdx = css.indexOf(".cae-shaking");
    const animateIdx = css.indexOf(".animate-pulse");
    expect(shakingIdx).toBeGreaterThan(-1);
    expect(animateIdx).toBeGreaterThan(shakingIdx);
  });
});
