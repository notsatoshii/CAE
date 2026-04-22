/**
 * Unit tests for lib/chat-suggestions.ts — Phase 9 Plan 01 (Wave 0).
 *
 * Covers D-11:
 *   - SUGGESTIONS has entries for every listed route.
 *   - Each entry has 2–3 items with non-empty label + message.
 *   - suggestionsFor() does exact > longest-prefix > empty-array matching.
 *   - Founder-speak lint parity: zero `$` in any label or message.
 */

import { describe, it, expect } from "vitest";

import { SUGGESTIONS, suggestionsFor } from "./chat-suggestions";

const REQUIRED_ROUTES = [
  "/build",
  "/build/queue",
  "/build/changes",
  "/build/agents",
  "/build/workflows",
  "/metrics",
  "/memory",
  "/chat",
];

describe("SUGGESTIONS map (D-11)", () => {
  it("has an entry for every required route", () => {
    for (const r of REQUIRED_ROUTES) {
      expect(SUGGESTIONS).toHaveProperty(r);
    }
  });

  it("every entry is an array of 2 or 3 items", () => {
    for (const r of REQUIRED_ROUTES) {
      const entry = SUGGESTIONS[r as keyof typeof SUGGESTIONS];
      expect(Array.isArray(entry)).toBe(true);
      expect(entry.length).toBeGreaterThanOrEqual(2);
      expect(entry.length).toBeLessThanOrEqual(3);
    }
  });

  it("every item has non-empty label and message", () => {
    for (const r of REQUIRED_ROUTES) {
      const entry = SUGGESTIONS[r as keyof typeof SUGGESTIONS];
      for (const item of entry) {
        expect(typeof item.label).toBe("string");
        expect(item.label.length).toBeGreaterThan(0);
        expect(typeof item.message).toBe("string");
        expect(item.message.length).toBeGreaterThan(0);
      }
    }
  });

  it("no literal `$` appears in any label or message (D-13 founder-speak)", () => {
    for (const r of REQUIRED_ROUTES) {
      const entry = SUGGESTIONS[r as keyof typeof SUGGESTIONS];
      for (const item of entry) {
        expect(item.label).not.toMatch(/\$/);
        expect(item.message).not.toMatch(/\$/);
      }
    }
  });
});

describe("suggestionsFor — pathname matching", () => {
  it("exact match returns the corresponding entry", () => {
    const got = suggestionsFor("/build");
    expect(got).toBe(SUGGESTIONS["/build"]);
  });

  it("longest-prefix match: /build/queue/foo → /build/queue entry", () => {
    const got = suggestionsFor("/build/queue/foo");
    expect(got).toBe(SUGGESTIONS["/build/queue"]);
  });

  it("longest-prefix match prefers more specific route over /build", () => {
    // /build/changes is more specific than /build — should win.
    const got = suggestionsFor("/build/changes/abc");
    expect(got).toBe(SUGGESTIONS["/build/changes"]);
  });

  it("/plan returns empty array (scope fence D-18)", () => {
    // No fallback to /build; unknown routes return empty.
    expect(suggestionsFor("/plan")).toEqual([]);
  });

  it('"/" returns empty array', () => {
    expect(suggestionsFor("/")).toEqual([]);
  });

  it('"" returns empty array', () => {
    expect(suggestionsFor("")).toEqual([]);
  });

  it("/buildfoo (no slash boundary) does NOT match /build prefix", () => {
    // Prefix check is /build OR /build/*, never /buildfoo.
    expect(suggestionsFor("/buildfoo")).toEqual([]);
  });

  it("/metrics/details resolves to /metrics entry", () => {
    expect(suggestionsFor("/metrics/details")).toBe(SUGGESTIONS["/metrics"]);
  });

  it("/memory/file/foo resolves to /memory entry", () => {
    expect(suggestionsFor("/memory/file/foo")).toBe(SUGGESTIONS["/memory"]);
  });
});
