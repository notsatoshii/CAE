/**
 * office-layout.test.ts — desk placement + floor-tile grid + pixel helpers.
 */

import { describe, it, expect } from "vitest";
import {
  FLOOR_COLS,
  FLOOR_ROWS,
  generateFloorTiles,
  buildDeskPlacements,
  tileToCharacterPixel,
} from "./office-layout";
import { STATIONS } from "./scene";

describe("generateFloorTiles", () => {
  it("produces FLOOR_COLS × FLOOR_ROWS tiles", () => {
    const tiles = generateFloorTiles();
    expect(tiles.length).toBe(FLOOR_COLS * FLOOR_ROWS);
  });
  it("every tile has valid coords within the grid", () => {
    const tiles = generateFloorTiles();
    for (const t of tiles) {
      expect(t.tx).toBeGreaterThanOrEqual(0);
      expect(t.tx).toBeLessThan(FLOOR_COLS);
      expect(t.ty).toBeGreaterThanOrEqual(0);
      expect(t.ty).toBeLessThan(FLOOR_ROWS);
      expect([0, 1, 2]).toContain(t.pattern);
    }
  });
  it("includes at least one accent (pattern 2) tile", () => {
    const tiles = generateFloorTiles();
    expect(tiles.some((t) => t.pattern === 2)).toBe(true);
  });
  it("checkerboard: tx=0,ty=0 is pattern 0 when not an accent slot", () => {
    const tiles = generateFloorTiles();
    const t = tiles.find((x) => x.tx === 0 && x.ty === 0);
    expect(t).toBeDefined();
    // (0+0)%2 = 0 → pattern 0 (accent doesn't hit (0,0) with our stride).
    expect([0, 2]).toContain(t!.pattern);
  });
  it("is deterministic across calls", () => {
    const a = generateFloorTiles();
    const b = generateFloorTiles();
    expect(a).toEqual(b);
  });
});

describe("buildDeskPlacements", () => {
  it("returns a placement for every station in STATIONS", () => {
    const placements = buildDeskPlacements();
    for (const name of Object.keys(STATIONS)) {
      expect(placements[name as keyof typeof STATIONS]).toBeDefined();
    }
  });
  it("desk tx/ty match the station coords (desk is the anchor)", () => {
    const placements = buildDeskPlacements();
    for (const name of Object.keys(STATIONS) as Array<keyof typeof STATIONS>) {
      expect(placements[name].tx).toBe(STATIONS[name].tx);
      expect(placements[name].ty).toBe(STATIONS[name].ty);
    }
  });
  it("seat is offset from desk (not identical)", () => {
    const placements = buildDeskPlacements();
    for (const name of Object.keys(STATIONS) as Array<keyof typeof STATIONS>) {
      const p = placements[name];
      const sameAsDesk = p.seatTx === p.tx && p.seatTy === p.ty;
      expect(sameAsDesk).toBe(false);
    }
  });
  it("hub uses loadingBay as its entrance (self-reference guard)", () => {
    const placements = buildDeskPlacements();
    expect(placements.hub.entranceTx).toBe(STATIONS.loadingBay.tx);
    expect(placements.hub.entranceTy).toBe(STATIONS.loadingBay.ty);
  });
  it("all non-hub stations use hub as entrance", () => {
    const placements = buildDeskPlacements();
    for (const name of Object.keys(STATIONS) as Array<keyof typeof STATIONS>) {
      if (name === "hub") continue;
      expect(placements[name].entranceTx).toBe(STATIONS.hub.tx);
      expect(placements[name].entranceTy).toBe(STATIONS.hub.ty);
    }
  });
});

describe("tileToCharacterPixel", () => {
  it("returns a numeric x/y for valid input", () => {
    const r = tileToCharacterPixel(5, 5, 480, 280);
    expect(Number.isFinite(r.x)).toBe(true);
    expect(Number.isFinite(r.y)).toBe(true);
  });
  it("different cx/cy shifts the output", () => {
    const a = tileToCharacterPixel(5, 5, 480, 280);
    const b = tileToCharacterPixel(5, 5, 0, 0);
    expect(a.x).not.toBe(b.x);
    expect(a.y).not.toBe(b.y);
  });
});
