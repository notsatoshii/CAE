/**
 * cb-path.test.ts — unit tests for resolveCbPath pure resolver.
 *
 * 9 assertions covering: happy-path, trailing-slash normalization, null, undefined,
 * empty, whitespace-only, non-string type-guard, relative-with-dotdot (no normalization),
 * and no-throw for every input.
 */

import { describe, it, expect } from "vitest";
import { resolveCbPath } from "./cb-path";

describe("resolveCbPath", () => {
  // 1. Happy path — absolute path without trailing slash
  it("returns cb path for a valid absolute project path", () => {
    expect(resolveCbPath("/home/cae/ctrl-alt-elite")).toBe(
      "/home/cae/ctrl-alt-elite/.cae/metrics/circuit-breakers.jsonl",
    );
  });

  // 2. Trailing slash normalized
  it("normalizes a trailing slash and returns the correct cb path", () => {
    expect(resolveCbPath("/home/cae/ctrl-alt-elite/")).toBe(
      "/home/cae/ctrl-alt-elite/.cae/metrics/circuit-breakers.jsonl",
    );
  });

  // 3. null → null
  it("returns null for null input", () => {
    expect(resolveCbPath(null)).toBeNull();
  });

  // 4. undefined → null
  it("returns null for undefined input", () => {
    expect(resolveCbPath(undefined)).toBeNull();
  });

  // 5. empty string → null
  it("returns null for an empty string", () => {
    expect(resolveCbPath("")).toBeNull();
  });

  // 6. whitespace-only → null
  it("returns null for whitespace-only input", () => {
    expect(resolveCbPath("   ")).toBeNull();
  });

  // 7. non-string type (runtime) → null
  it("returns null for a non-string type (runtime guard)", () => {
    expect(resolveCbPath(123 as unknown as string)).toBeNull();
  });

  // 8. relative path with dotdot — no normalization applied (API-level concern)
  it("appends the cb suffix without normalizing dotdot segments", () => {
    expect(resolveCbPath("/relative/../path")).toBe(
      "/relative/../path/.cae/metrics/circuit-breakers.jsonl",
    );
  });

  // 9. no-throw for every input variant
  it("never throws for any of the above inputs", () => {
    const inputs: Array<unknown> = [
      "/home/cae/ctrl-alt-elite",
      "/home/cae/ctrl-alt-elite/",
      null,
      undefined,
      "",
      "   ",
      123,
      "/relative/../path",
    ];
    for (const input of inputs) {
      expect(() => resolveCbPath(input as string)).not.toThrow();
    }
  });
});
