/**
 * Tests for lib/floor/iso.ts — diamond isometric projection math.
 * RED phase: these tests exist before iso.ts is implemented.
 */

import { describe, it, expect } from "vitest";
import { TILE_W, TILE_H, mapToScreen, screenToMap } from "./iso";

describe("iso math — mapToScreen", () => {
  it("origin maps to screen (0, 0)", () => {
    expect(mapToScreen(0, 0)).toEqual({ x: 0, y: 0 });
  });

  it("(1, 0) maps one step east-and-south: {x: TILE_W/2, y: TILE_H/2}", () => {
    expect(mapToScreen(1, 0)).toEqual({ x: TILE_W / 2, y: TILE_H / 2 });
  });

  it("(0, 1) maps one step west-and-south: {x: -TILE_W/2, y: TILE_H/2}", () => {
    expect(mapToScreen(0, 1)).toEqual({ x: -TILE_W / 2, y: TILE_H / 2 });
  });

  it("(2, 2) with camera offset (100, 200) produces {x: 100, y: 2*TILE_H + 200}", () => {
    // (tx - ty) * TILE_W/2 + cx = (2 - 2) * 32 + 100 = 100
    // (tx + ty) * TILE_H/2 + cy = (2 + 2) * 16 + 200 = 64 + 200 = 264
    expect(mapToScreen(2, 2, 100, 200)).toEqual({ x: 100, y: 2 * TILE_H + 200 });
  });
});

describe("iso math — roundtrip inverses", () => {
  const pairs: [number, number][] = [
    [0, 0],
    [5, 5],
    [-3, 7],
    [12, 6],
    [14, 10],
  ];

  for (const [tx, ty] of pairs) {
    it(`roundtrip (${tx}, ${ty}) without camera`, () => {
      const { x, y } = mapToScreen(tx, ty);
      const { tx: rtx, ty: rty } = screenToMap(x, y);
      expect(rtx).toBeCloseTo(tx, 9);
      expect(rty).toBeCloseTo(ty, 9);
    });
  }

  for (const [tx, ty] of pairs) {
    it(`roundtrip (${tx}, ${ty}) with camera (100, 200)`, () => {
      const cx = 100;
      const cy = 200;
      const { x, y } = mapToScreen(tx, ty, cx, cy);
      const { tx: rtx, ty: rty } = screenToMap(x, y, cx, cy);
      expect(rtx).toBeCloseTo(tx, 9);
      expect(rty).toBeCloseTo(ty, 9);
    });
  }
});
