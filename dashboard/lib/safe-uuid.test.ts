/**
 * safe-uuid.test.ts — class 18B.
 *
 * Coverage:
 *   1. Returns native `crypto.randomUUID()` value when the API is present.
 *   2. Returns a v4-shaped fallback when `globalThis.crypto.randomUUID` is
 *      undefined (simulates the insecure-context path that crashes chat).
 *   3. Fallback still yields unique ids across many calls.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { safeUUID } from "./safe-uuid";

const V4_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("safeUUID", () => {
  it("prefers native crypto.randomUUID when available", () => {
    const sentinel = "11111111-2222-4333-8444-555555555555";
    const spy = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValue(sentinel);

    expect(safeUUID()).toBe(sentinel);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("falls back to a v4-shaped UUID when randomUUID is missing (insecure context)", () => {
    // Simulate the insecure-context behaviour: the `crypto` object exists
    // (getRandomValues is still available over plain http), but randomUUID
    // is not a function. Reading it returns undefined → optional chaining
    // short-circuits to the fallback path.
    vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(
      undefined as unknown as () => `${string}-${string}-${string}-${string}-${string}`,
    );
    // Some runtimes refuse to spy-away a data property; belt-and-braces
    // override the descriptor so the helper sees `undefined`.
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value: undefined,
    });

    const id = safeUUID();
    expect(id).toMatch(V4_SHAPE);
  });

  it("fallback yields unique ids across many calls", () => {
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value: undefined,
    });
    const n = 200;
    const ids = new Set<string>();
    for (let i = 0; i < n; i++) ids.add(safeUUID());
    expect(ids.size).toBe(n);
  });
});
