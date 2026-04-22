/**
 * Diamond isometric projection math for the Live Floor scene (D-03).
 *
 * Formulas: clintbellanger.net/articles/isometric_math — 2:1 diamond.
 * TILE_W = 64, TILE_H = 32 (2:1 ratio).
 *
 * Map coordinates: (tx, ty) — tile column and row on the 16×16 grid.
 * Screen coordinates: (sx, sy) — pixels relative to the camera origin (cx, cy).
 *
 * Convention: camera origin (cx, cy) = point where tile (0,0) lands.
 * Pass cx = canvas.width/2, cy = some_offset to center the scene.
 */

export const TILE_W = 64;
export const TILE_H = 32;

/**
 * Map tile (tx, ty) → screen (sx, sy) with optional camera offset (cx, cy).
 *
 * Formula (clintbellanger):
 *   sx = (tx - ty) * (TILE_W / 2) + cx
 *   sy = (tx + ty) * (TILE_H / 2) + cy
 */
export function mapToScreen(
  tx: number,
  ty: number,
  cx = 0,
  cy = 0,
): { x: number; y: number } {
  return {
    x: (tx - ty) * (TILE_W / 2) + cx,
    y: (tx + ty) * (TILE_H / 2) + cy,
  };
}

/**
 * Inverse of mapToScreen — screen (sx, sy) → map (tx, ty).
 * Approximate within floating-point tolerance.
 *
 * Derivation from mapToScreen:
 *   x' = sx - cx  →  x' = (tx - ty) * TILE_W/2
 *   y' = sy - cy  →  y' = (tx + ty) * TILE_H/2
 *
 *   tx - ty = x' * (2/TILE_W)
 *   tx + ty = y' * (2/TILE_H)
 *
 *   tx = (y' / TILE_H) + (x' / TILE_W)
 *   ty = (y' / TILE_H) - (x' / TILE_W)
 */
export function screenToMap(
  sx: number,
  sy: number,
  cx = 0,
  cy = 0,
): { tx: number; ty: number } {
  const x = sx - cx;
  const y = sy - cy;
  return {
    tx: y / TILE_H + x / TILE_W,
    ty: y / TILE_H - x / TILE_W,
  };
}
