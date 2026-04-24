/**
 * Sprite-sheet slicer + frame-animation helpers for the pixel-agents port.
 *
 * Adapted from pablodelucca/pixel-agents (MIT — see /public/pixel-agents/CREDITS.md).
 *
 * What this file owns:
 * - Loading the 6 per-character 112x96 PNGs from /public/pixel-agents/characters/
 *   and slicing each into 7 frames × 3 directions (down/up/right) × 16×32 each.
 * - Frame index advancement for each animation state (walk, typing, reading, idle).
 * - A simple module-level cache so sprite loading only happens once.
 *
 * Sprite sheet layout (inherited from upstream):
 *   Row 0: DOWN-facing — frames [0..6] are walk/walk/walk/walk/type/type/read/read
 *   Row 1: UP-facing   — same frame layout
 *   Row 2: RIGHT-facing — same (LEFT is derived by horizontal flip at render time)
 *
 *   walk       = frames [0, 1, 2, 1]  (4-frame ping-pong cycle)
 *   typing     = frames [3, 4]        (2-frame alternation)
 *   reading    = frames [5, 6]        (2-frame alternation)
 *
 * Design decisions:
 * - SSR-safe: no top-level window/document access. `loadPixelAgentSprites()`
 *   is the only entry point and checks `typeof window !== "undefined"` before
 *   touching DOM APIs. Calling it in Node is a no-op that returns `null`.
 * - Never throws — failed image loads resolve to `null` so the renderer can
 *   fall back to its colored-square fallback.
 * - Pure data helpers (advanceFrame, frameFor) do NOT need DOM and are the
 *   primary unit-testable surface.
 */

// ---------------------------------------------------------------------------
// Constants — mirror upstream shared/assets/constants.ts
// ---------------------------------------------------------------------------

/** Width of one sprite frame in pixels. */
export const CHAR_FRAME_W = 16;
/** Height of one sprite frame in pixels. */
export const CHAR_FRAME_H = 32;
/** Frames per direction row on a per-character sheet. */
export const CHAR_FRAMES_PER_ROW = 7;
/** Number of distinct character palettes shipped in /public/pixel-agents/characters/. */
export const CHARACTER_COUNT = 6;

/** Four directions; LEFT is derived from RIGHT at draw time via horizontal flip. */
export type Direction = "down" | "up" | "right" | "left";

/** Animation states the renderer can request. */
export type AnimState = "walk" | "typing" | "reading" | "idle";

// ---------------------------------------------------------------------------
// Frame-index maps — authoritative mapping from (state, step) → sheet frame
// ---------------------------------------------------------------------------

/**
 * Frame indices within a direction row for each animation state.
 * walk is a 4-step ping-pong (0,1,2,1) so characters bob their legs naturally.
 * idle maps to typing[0] — it's the "sitting, breathe" default pose.
 */
const FRAME_MAP: Record<AnimState, readonly number[]> = {
  walk: [0, 1, 2, 1],
  typing: [3, 4],
  reading: [5, 6],
  idle: [3, 3],
} as const;

/** Number of frames in a state's animation cycle. */
export function frameCountFor(state: AnimState): number {
  return FRAME_MAP[state].length;
}

/**
 * Given an animation state and a monotonic step counter, return the frame
 * index on the character sprite sheet's direction row. Pure function — no DOM.
 */
export function frameFor(state: AnimState, step: number): number {
  const cycle = FRAME_MAP[state];
  if (cycle.length === 0) return 0;
  const s = step < 0 ? 0 : Math.floor(step);
  return cycle[s % cycle.length];
}

/**
 * Advance an animation step counter by dt seconds at a given FPS.
 * Pure — returns the new step + fractional accumulator.
 */
export function advanceFrame(
  step: number,
  accumulator: number,
  dt: number,
  fps: number,
): { step: number; accumulator: number } {
  if (dt <= 0 || fps <= 0) return { step, accumulator };
  const next = accumulator + dt * fps;
  const whole = Math.floor(next);
  return { step: step + whole, accumulator: next - whole };
}

// ---------------------------------------------------------------------------
// Sprite image cache — loaded once per page from /public/pixel-agents/*
// ---------------------------------------------------------------------------

/**
 * The sprite sheet handle the renderer draws from. Each entry is one of the
 * 6 characters; the image is the raw 112×96 per-character sheet.
 */
export interface PixelAgentSpriteSet {
  /** Per-character HTMLImageElement, indexed 0..CHARACTER_COUNT-1. */
  images: HTMLImageElement[];
  /** True when every image has fired its `load` event. */
  ready: boolean;
}

let cache: PixelAgentSpriteSet | null = null;
let loadPromise: Promise<PixelAgentSpriteSet | null> | null = null;

/** Drop the cache. Testing only. */
export function __resetSpriteCache(): void {
  cache = null;
  loadPromise = null;
}

/** Return the cached sprite set, or null if none loaded yet / we're in SSR. */
export function getSpriteSet(): PixelAgentSpriteSet | null {
  return cache;
}

/**
 * Kick off sprite loading. Safe to call multiple times — subsequent calls
 * return the same promise. Returns null synchronously during SSR.
 */
export function loadPixelAgentSprites(
  basePath = "/pixel-agents/characters",
): Promise<PixelAgentSpriteSet | null> {
  if (typeof window === "undefined" || typeof Image === "undefined") {
    return Promise.resolve(null);
  }
  if (cache !== null && cache.ready) return Promise.resolve(cache);
  if (loadPromise !== null) return loadPromise;

  const images: HTMLImageElement[] = [];
  const promises: Promise<void>[] = [];
  for (let i = 0; i < CHARACTER_COUNT; i++) {
    const img = new Image();
    // Same-origin fetch from /public, so CORS shouldn't matter; setting anon
    // keeps us safe if the PNG ever moves to a CDN later.
    img.crossOrigin = "anonymous";
    const p = new Promise<void>((resolve) => {
      img.addEventListener("load", () => resolve(), { once: true });
      img.addEventListener("error", () => resolve(), { once: true });
    });
    img.src = `${basePath}/char_${i}.png`;
    images.push(img);
    promises.push(p);
  }

  loadPromise = Promise.all(promises).then(() => {
    const set: PixelAgentSpriteSet = {
      images,
      ready: images.every((img) => img.complete && img.naturalWidth > 0),
    };
    cache = set;
    return set;
  });
  return loadPromise;
}

// ---------------------------------------------------------------------------
// Draw helper — pure(ish): takes a ctx and destination coords.
// ---------------------------------------------------------------------------

export interface DrawCharOpts {
  /** 0..CHARACTER_COUNT-1. */
  paletteIndex: number;
  direction: Direction;
  state: AnimState;
  /** Monotonic step counter (from advanceFrame). */
  step: number;
  /** Destination pixel x (top-left of the 16×32 sprite). */
  dx: number;
  /** Destination pixel y (top-left). */
  dy: number;
  /** Render scale — 1 = native 16×32; 2 = double-size etc. Default 2. */
  scale?: number;
  /** Optional hue filter shift in degrees for agent tinting. */
  hueShift?: number;
}

const DIRECTION_ROW: Record<Direction, number> = {
  down: 0,
  up: 1,
  right: 2,
  left: 2, // Same row as right; flipped at draw time.
};

/**
 * Draw one character frame to a canvas context. Returns true if drawn,
 * false if the sprite set wasn't loaded yet (caller should use fallback).
 *
 * Never throws — missing image / out-of-range palette returns false.
 */
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  set: PixelAgentSpriteSet | null,
  opts: DrawCharOpts,
): boolean {
  if (!set || !set.ready) return false;

  const palette =
    ((opts.paletteIndex % CHARACTER_COUNT) + CHARACTER_COUNT) %
    CHARACTER_COUNT;
  const img = set.images[palette];
  if (!img || img.naturalWidth === 0) return false;

  const direction = opts.direction;
  const rowIdx = DIRECTION_ROW[direction];
  const frameIdx = frameFor(opts.state, opts.step);
  const sx = frameIdx * CHAR_FRAME_W;
  const sy = rowIdx * CHAR_FRAME_H;
  const scale = opts.scale ?? 2;
  const dw = CHAR_FRAME_W * scale;
  const dh = CHAR_FRAME_H * scale;

  // Preserve pixel art: the RAF caller should set imageSmoothingEnabled=false
  // once on the context (render() does this); don't repeatedly toggle here.
  ctx.save();

  // Horizontal flip for left-facing sprites by mirroring around the draw x.
  if (direction === "left") {
    ctx.translate(opts.dx + dw, opts.dy);
    ctx.scale(-1, 1);
    if (opts.hueShift && opts.hueShift !== 0) {
      ctx.filter = `hue-rotate(${opts.hueShift}deg)`;
    }
    try {
      ctx.drawImage(img, sx, sy, CHAR_FRAME_W, CHAR_FRAME_H, 0, 0, dw, dh);
    } catch {
      ctx.restore();
      return false;
    }
  } else {
    if (opts.hueShift && opts.hueShift !== 0) {
      ctx.filter = `hue-rotate(${opts.hueShift}deg)`;
    }
    try {
      ctx.drawImage(
        img,
        sx,
        sy,
        CHAR_FRAME_W,
        CHAR_FRAME_H,
        opts.dx,
        opts.dy,
        dw,
        dh,
      );
    } catch {
      ctx.restore();
      return false;
    }
  }

  ctx.restore();
  return true;
}

// ---------------------------------------------------------------------------
// Speech-bubble sprite data — inlined from upstream bubble-*.json (MIT).
// ---------------------------------------------------------------------------

export interface BubbleSprite {
  width: number;
  height: number;
  /** Each row is `height` long; each cell is "" (transparent) or "#rrggbb". */
  pixels: string[][];
}

const BUBBLE_WAITING_RAW = {
  width: 11,
  height: 13,
  palette: { _: "", B: "#555566", F: "#EEEEFF", G: "#44BB66" },
  pixels: [
    ["_", "B", "B", "B", "B", "B", "B", "B", "B", "B", "_"],
    ["B", "F", "F", "F", "F", "F", "F", "F", "F", "F", "B"],
    ["B", "F", "F", "F", "F", "F", "F", "F", "F", "F", "B"],
    ["B", "F", "F", "F", "F", "F", "F", "F", "G", "F", "B"],
    ["B", "F", "F", "F", "F", "F", "F", "G", "F", "F", "B"],
    ["B", "F", "F", "G", "F", "F", "G", "F", "F", "F", "B"],
    ["B", "F", "F", "F", "G", "G", "F", "F", "F", "F", "B"],
    ["B", "F", "F", "F", "F", "F", "F", "F", "F", "F", "B"],
    ["B", "F", "F", "F", "F", "F", "F", "F", "F", "F", "B"],
    ["_", "B", "B", "B", "B", "B", "B", "B", "B", "B", "_"],
    ["_", "_", "_", "_", "B", "B", "B", "_", "_", "_", "_"],
    ["_", "_", "_", "_", "_", "B", "_", "_", "_", "_", "_"],
    ["_", "_", "_", "_", "_", "_", "_", "_", "_", "_", "_"],
  ],
};

const BUBBLE_PERMISSION_RAW = {
  width: 11,
  height: 13,
  palette: { _: "", B: "#555566", F: "#EEEEFF", A: "#CCA700" },
  pixels: [
    ["B", "B", "B", "B", "B", "B", "B", "B", "B", "B", "B"],
    ["B", "F", "F", "F", "F", "F", "F", "F", "F", "F", "B"],
    ["B", "F", "F", "F", "F", "F", "F", "F", "F", "F", "B"],
    ["B", "F", "F", "F", "F", "F", "F", "F", "F", "F", "B"],
    ["B", "F", "F", "F", "F", "F", "F", "F", "F", "F", "B"],
    ["B", "F", "F", "A", "F", "A", "F", "A", "F", "F", "B"],
    ["B", "F", "F", "F", "F", "F", "F", "F", "F", "F", "B"],
    ["B", "F", "F", "F", "F", "F", "F", "F", "F", "F", "B"],
    ["B", "F", "F", "F", "F", "F", "F", "F", "F", "F", "B"],
    ["B", "B", "B", "B", "B", "B", "B", "B", "B", "B", "B"],
    ["_", "_", "_", "_", "B", "B", "B", "_", "_", "_", "_"],
    ["_", "_", "_", "_", "_", "B", "_", "_", "_", "_", "_"],
    ["_", "_", "_", "_", "_", "_", "_", "_", "_", "_", "_"],
  ],
};

interface RawBubble {
  width: number;
  height: number;
  palette: Record<string, string>;
  pixels: string[][];
}

function resolveBubble(raw: RawBubble): BubbleSprite {
  const pixels = raw.pixels.map((row) =>
    row.map((k) => {
      const v = raw.palette[k];
      return typeof v === "string" ? v : "";
    }),
  );
  return { width: raw.width, height: raw.height, pixels };
}

export const BUBBLE_WAITING: BubbleSprite = resolveBubble(BUBBLE_WAITING_RAW);
export const BUBBLE_PERMISSION: BubbleSprite = resolveBubble(BUBBLE_PERMISSION_RAW);

/**
 * Draw a speech bubble at (dx, dy) (top-left). Pure — doesn't throw, no DOM
 * side effects besides ctx fillRect. Safe under test ctx stubs.
 */
export function drawBubble(
  ctx: CanvasRenderingContext2D,
  bubble: BubbleSprite,
  dx: number,
  dy: number,
  scale = 2,
): void {
  for (let r = 0; r < bubble.height; r++) {
    const row = bubble.pixels[r];
    if (!row) continue;
    for (let c = 0; c < bubble.width; c++) {
      const color = row[c];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(dx + c * scale, dy + r * scale, scale, scale);
    }
  }
}
