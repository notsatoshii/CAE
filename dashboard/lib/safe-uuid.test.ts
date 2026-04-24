import { describe, it, expect, vi, afterEach } from "vitest";
import { safeUUID } from "./safe-uuid";

describe("safeUUID", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses native crypto.randomUUID when available", () => {
    const fakeId = "11111111-1111-4111-8111-111111111111" as ReturnType<typeof crypto.randomUUID>;
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(fakeId);
    expect(safeUUID()).toBe(fakeId);
  });

  it("returns v4-shaped fallback when crypto.randomUUID is absent", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
        return arr;
      },
    });
    const id = safeUUID();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
