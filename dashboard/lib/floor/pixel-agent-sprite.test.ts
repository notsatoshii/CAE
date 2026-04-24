/**
 * pixel-agent-sprite.test.ts — unit tests for the sprite-sheet slicer.
 *
 * No real image loading is exercised; instead we verify the pure helpers
 * (frameFor, advanceFrame, frameCountFor) and the pure bubble-draw path.
 */

import { describe, it, expect, vi } from "vitest";
import {
  frameFor,
  frameCountFor,
  advanceFrame,
  drawBubble,
  BUBBLE_WAITING,
  BUBBLE_PERMISSION,
  drawCharacter,
  CHAR_FRAME_W,
  CHAR_FRAME_H,
  type AnimState,
  __resetSpriteCache,
} from "./pixel-agent-sprite";

describe("frameCountFor", () => {
  it("returns 4 for walk (ping-pong cycle)", () => {
    expect(frameCountFor("walk")).toBe(4);
  });
  it("returns 2 for typing", () => {
    expect(frameCountFor("typing")).toBe(2);
  });
  it("returns 2 for reading", () => {
    expect(frameCountFor("reading")).toBe(2);
  });
  it("returns 2 for idle", () => {
    expect(frameCountFor("idle")).toBe(2);
  });
});

describe("frameFor", () => {
  it("walk cycle is [0,1,2,1] mod 4", () => {
    expect(frameFor("walk", 0)).toBe(0);
    expect(frameFor("walk", 1)).toBe(1);
    expect(frameFor("walk", 2)).toBe(2);
    expect(frameFor("walk", 3)).toBe(1);
    expect(frameFor("walk", 4)).toBe(0);
  });
  it("typing alternates 3,4", () => {
    expect(frameFor("typing", 0)).toBe(3);
    expect(frameFor("typing", 1)).toBe(4);
    expect(frameFor("typing", 2)).toBe(3);
  });
  it("reading alternates 5,6", () => {
    expect(frameFor("reading", 0)).toBe(5);
    expect(frameFor("reading", 1)).toBe(6);
  });
  it("negative or non-integer step is floored safely", () => {
    expect(frameFor("walk", -1)).toBe(0);
    expect(frameFor("walk", 0.9)).toBe(0);
  });
  it("works across all AnimStates without throwing", () => {
    const states: AnimState[] = ["walk", "typing", "reading", "idle"];
    for (const s of states) {
      expect(() => frameFor(s, 10)).not.toThrow();
    }
  });
});

describe("advanceFrame", () => {
  it("no-op on dt <= 0", () => {
    const r = advanceFrame(3, 0.2, 0, 6);
    expect(r).toEqual({ step: 3, accumulator: 0.2 });
  });
  it("adds fractional accumulator without incrementing step under 1 frame", () => {
    // at 6 fps, dt=0.1 s → 0.6 frame
    const r = advanceFrame(0, 0, 0.1, 6);
    expect(r.step).toBe(0);
    expect(r.accumulator).toBeCloseTo(0.6, 5);
  });
  it("increments step when accumulator crosses 1.0", () => {
    // at 6 fps, dt=0.2 s → 1.2 frame; first call pushes accumulator to 1.2
    const r = advanceFrame(0, 0, 0.2, 6);
    expect(r.step).toBe(1);
    expect(r.accumulator).toBeCloseTo(0.2, 5);
  });
  it("large dt increments multiple steps in one call", () => {
    const r = advanceFrame(0, 0, 1, 6); // 6 frames
    expect(r.step).toBe(6);
    expect(r.accumulator).toBeCloseTo(0, 5);
  });
});

describe("drawBubble (pure draw)", () => {
  it("fills at least one rect per opaque pixel in BUBBLE_WAITING", () => {
    const calls: Array<[number, number, number, number]> = [];
    const ctx = {
      fillRect: vi.fn((a: number, b: number, c: number, d: number) => {
        calls.push([a, b, c, d]);
      }),
    } as unknown as CanvasRenderingContext2D;
    Object.defineProperty(ctx, "fillStyle", {
      set: vi.fn(),
      get: () => "",
      configurable: true,
    });
    drawBubble(ctx, BUBBLE_WAITING, 100, 200, 2);
    // Count opaque pixels in the sprite — every non-empty cell produces 1 fillRect.
    let opaque = 0;
    for (const row of BUBBLE_WAITING.pixels)
      for (const c of row) if (c) opaque++;
    expect(calls.length).toBe(opaque);
  });
  it("permission bubble also renders", () => {
    const ctx = {
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    Object.defineProperty(ctx, "fillStyle", {
      set: vi.fn(),
      get: () => "",
      configurable: true,
    });
    drawBubble(ctx, BUBBLE_PERMISSION, 0, 0, 2);
    expect((ctx.fillRect as unknown as ReturnType<typeof vi.fn>).mock.calls.length)
      .toBeGreaterThan(0);
  });
});

describe("drawCharacter", () => {
  it("returns false when sprite set is null", () => {
    __resetSpriteCache();
    const ctx = {
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    Object.defineProperty(ctx, "filter", {
      set: vi.fn(),
      get: () => "",
      configurable: true,
    });

    const drawn = drawCharacter(ctx, null, {
      paletteIndex: 0,
      direction: "down",
      state: "walk",
      step: 0,
      dx: 0,
      dy: 0,
    });
    expect(drawn).toBe(false);
  });

  it("returns false when set.ready is false", () => {
    const ctx = {
      drawImage: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    const drawn = drawCharacter(
      ctx,
      { images: [], ready: false },
      { paletteIndex: 0, direction: "down", state: "walk", step: 0, dx: 0, dy: 0 },
    );
    expect(drawn).toBe(false);
  });

  it("frame width matches CHAR_FRAME_W/CHAR_FRAME_H constants", () => {
    expect(CHAR_FRAME_W).toBe(16);
    expect(CHAR_FRAME_H).toBe(32);
  });
});
