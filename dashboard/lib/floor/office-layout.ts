/**
 * Minimal static office floor layout for the pixel-agents port.
 *
 * Adapted from pablodelucca/pixel-agents (MIT — see /public/pixel-agents/CREDITS.md).
 * Upstream uses a rich editable grid with TileType + furniture autotiling; we
 * collapse that to the *exact subset* the cae-dashboard needs:
 *
 *  1. A floor-tile grid covering the full 16×16 map, with a sparse variation
 *     pattern (checkerboard mixing `floor_0` and `floor_1`).
 *  2. Per-station desk anchor in pixel space, plus a seat pixel position where
 *     a sitting sprite can be rendered.
 *  3. Per-station walk-in entrance (the tile a spawning agent walks to before
 *     sitting down — gives the walk animation somewhere to go).
 *
 * All coordinates flow through the existing isometric math in `iso.ts`
 * (mapToScreen) so desks z-sort naturally with STATIONS.
 *
 * STATION coords come verbatim from scene.ts — we do NOT redeclare positions
 * here. The station diamond-grid layout has already been shipped + tested, and
 * the desk-anchor/seat calculation is a pure function of those.
 */

import { mapToScreen } from "./iso";
import { STATIONS, type StationName } from "./scene";

// ---------------------------------------------------------------------------
// Floor-tile pattern
// ---------------------------------------------------------------------------

/**
 * Grid dimensions for the office floor layer — kept loose around the 16×16
 * STATION grid so edges aren't visible at normal zoom.
 */
export const FLOOR_COLS = 16;
export const FLOOR_ROWS = 16;

/** One of the 3 floor patterns we ship in /public/pixel-agents/floors/. */
export type FloorPatternId = 0 | 1 | 2;

export interface FloorTile {
  /** Tile-space column (0..FLOOR_COLS-1). */
  tx: number;
  /** Tile-space row (0..FLOOR_ROWS-1). */
  ty: number;
  /** Which pattern PNG to use. */
  pattern: FloorPatternId;
}

/**
 * Generate the static floor-tile grid. Pure function — deterministic output,
 * tests assert `floor[0]` + count.
 *
 * We use a simple 2-pattern checkerboard: pattern_0 on even (tx+ty), pattern_1
 * on odd. A single plant accent (pattern_2) is dropped at every 7th tile so
 * scenes aren't too uniform.
 */
export function generateFloorTiles(): FloorTile[] {
  const tiles: FloorTile[] = [];
  let accent = 0;
  for (let ty = 0; ty < FLOOR_ROWS; ty++) {
    for (let tx = 0; tx < FLOOR_COLS; tx++) {
      accent += 1;
      const pattern: FloorPatternId =
        accent % 7 === 0
          ? 2
          : ((tx + ty) % 2 === 0
              ? 0
              : 1);
      tiles.push({ tx, ty, pattern });
    }
  }
  return tiles;
}

// ---------------------------------------------------------------------------
// Desk placement — one per STATION, keyed by StationName
// ---------------------------------------------------------------------------

/**
 * Per-station desk placement. All coordinates are in tile space; convert to
 * pixel space with mapToScreen() at draw time.
 */
export interface DeskPlacement {
  /** Station the desk belongs to. */
  station: StationName;
  /** Desk center (same as STATION.tx/ty). */
  tx: number;
  ty: number;
  /** Seat tile — where the sprite sits. Offset from desk so the character
   *  doesn't overlap with the diamond-fill of the station. */
  seatTx: number;
  seatTy: number;
  /** Walk-in tile — where the sprite spawns and walks from toward the seat. */
  entranceTx: number;
  entranceTy: number;
  /** Direction the character should face when seated. */
  facing: "down" | "up" | "right" | "left";
}

/**
 * Build the desk placement table. Pure function — the seat offset is always
 * one tile south of the desk so the character sits "in front of" the station
 * from the camera's perspective.
 */
export function buildDeskPlacements(): Record<StationName, DeskPlacement> {
  const result = {} as Record<StationName, DeskPlacement>;
  for (const name of Object.keys(STATIONS) as StationName[]) {
    const def = STATIONS[name];
    result[name] = {
      station: name,
      tx: def.tx,
      ty: def.ty,
      // Seat 1 tile north of the station diamond (isometrically "in front"
      // of the desk from the viewer — avoids character-diamond overlap).
      seatTx: def.tx,
      seatTy: def.ty - 0.4,
      // Entrance — all stations share one open workspace room, so every
      // agent walks in from loadingBay (the room entrance).
      entranceTx: STATIONS.loadingBay.tx,
      entranceTy: STATIONS.loadingBay.ty,
      // All characters face "up" when seated at a desk in the upstream
      // layout — matches the top-of-desk-facing-viewer idiom.
      facing: "up",
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Pixel-space helpers
// ---------------------------------------------------------------------------

/**
 * Convert a tile-space coordinate to pixel-space using the shared iso math,
 * with a small vertical offset so the character's feet land on the tile
 * center (16 px up from the diamond apex, since a char is 32 px tall).
 */
export function tileToCharacterPixel(
  tx: number,
  ty: number,
  cx: number,
  cy: number,
): { x: number; y: number } {
  const base = mapToScreen(tx, ty, cx, cy);
  // Lift the sprite so its bottom-center sits ~8px below the diamond top.
  // Character frame is 16×32 at scale=CHAR_RENDER_SCALE (renderer.ts).
  // At scale=3 that's 48×96 → half-width 24, feet at dy+96 → dy = base.y+8-96.
  const SCALE = 3;
  const frameW = 16 * SCALE;
  const frameH = 32 * SCALE;
  return { x: base.x - frameW / 2, y: base.y + 8 - frameH };
}
