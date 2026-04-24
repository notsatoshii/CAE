/**
 * Canvas 2D draw routine for the Live Floor scene (D-01, D-03, D-09).
 *
 * Design contract:
 * - NO React imports
 * - NO window/document/RAF *scheduling* — ctx/scene/viewport are the inputs
 *   and the scene mutation happens through event-adapter, not here.
 * - performance.now() / Date.now() are used internally to advance pixel-agent
 *   sprite-animation frames; this is a RAF-observable side-effect of render()
 *   but doesn't affect test determinism (dt~0 under jsdom).
 * - Never throws; every branch has a default fill.
 *
 * Draw order (z-layers):
 *   1. Dark background fill
 *   1b. Pixel-office floor — dimmed diamonds under the whole scene
 *   2. Stations — z-sorted by (tx + ty) ascending so back stations paint first
 *      Each station: filled diamond + text label below center
 *   3. Effects — in scene.effects array order (newest last = on top)
 *   4. Entities — phantoms drawn on top of their current position
 *   5. Pixel-agent character sprites (pablodelucca MIT port) at desks
 */

import { mapToScreen, TILE_W, TILE_H } from "./iso";
import type { Scene, StationName, PixelAgent } from "./scene";
import type { Effect } from "./state";
import { labelFor } from "@/lib/copy/labels";
import {
  drawCharacter,
  drawBubble,
  getSpriteSet,
  loadPixelAgentSprites,
  BUBBLE_WAITING,
  BUBBLE_PERMISSION,
  type Direction,
} from "./pixel-agent-sprite";
import {
  createSpriteRegistry,
  ensureSprite,
  removeSprite,
  tickSprite,
  facingForTravel,
  animStateForTool,
  type SpriteRegistry,
  type SpriteAnimState,
} from "./pixel-agent-state";
import { tileToCharacterPixel } from "./office-layout";

// ---------------------------------------------------------------------------
// Viewport
// ---------------------------------------------------------------------------

export interface Viewport {
  /** Canvas width in CSS px. */
  width: number;
  /** Canvas height in CSS px. */
  height: number;
  /** Camera x — typically width/2. */
  cx: number;
  /** Camera y — typically height/2 - 80 (centers scene in 960x720 popout). */
  cy: number;
  /** true = dev copy, false = founder copy (from useDevMode at call site). */
  devLabels: boolean;
}

// ---------------------------------------------------------------------------
// Hardcoded token palette (CSS vars unavailable to canvas ctx — D-09)
// ---------------------------------------------------------------------------

const BG = "#0a0a0a";
const SURFACE = "#121214";
const IDLE = "#3a3a42";
const ACCENT = "#00d4ff";
const WARNING = "#f59e0b";
const DANGER = "#ef4444";
const SUCCESS = "#22c55e";
const PHANTOM = "#8b5cf6";
const BORDER = "#1f1f22";
const TEXT = "#8a8a8c";

/** Dimmed floor-tile colors for the static office floor layer. */
const FLOOR_A = "#15151a";
const FLOOR_B = "#18181e";
const FLOOR_ACCENT = "#1f1f28";

const STATUS_FILL: Record<string, string> = {
  idle: IDLE,
  active: ACCENT,
  warning: WARNING,
  alarm: DANGER,
};

// ---------------------------------------------------------------------------
// Station label key lookup
// ---------------------------------------------------------------------------

const STATION_LABEL_KEY: Record<StationName, keyof ReturnType<typeof labelFor>> = {
  hub: "floorStationHub",
  forge: "floorStationForge",
  watchtower: "floorStationWatchtower",
  overlook: "floorStationOverlook",
  library: "floorStationLibrary",
  shadow: "floorStationShadow",
  armory: "floorStationArmory",
  drafting: "floorStationDrafting",
  pulpit: "floorStationPulpit",
  loadingBay: "floorStationLoadingBay",
};

// ---------------------------------------------------------------------------
// Diamond geometry helpers
// ---------------------------------------------------------------------------

const HALF_W = TILE_W / 2; // 32
const HALF_H = TILE_H / 2; // 16

/** Draw a filled + stroked isometric diamond (flat-topped). */
function drawDiamond(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  fillColor: string,
): void {
  ctx.beginPath();
  // top → right → bottom → left → close
  ctx.moveTo(cx, cy - HALF_H);
  ctx.lineTo(cx + HALF_W, cy);
  ctx.lineTo(cx, cy + HALF_H);
  ctx.lineTo(cx - HALF_W, cy);
  ctx.closePath();

  ctx.fillStyle = fillColor;
  ctx.fill();

  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ---------------------------------------------------------------------------
// Effect draw helpers
// ---------------------------------------------------------------------------

function drawFireworks(
  ctx: CanvasRenderingContext2D,
  e: Extract<Effect, { kind: "fireworks" }>,
  vp: Viewport,
): void {
  const { x, y } = mapToScreen(e.atTx, e.atTy, vp.cx, vp.cy);
  const alpha = Math.min(1, e.ttl * 1.2);
  const radius = (1.2 - e.ttl) * 30 + 8;
  const numParticles = 8;

  ctx.globalAlpha = alpha;

  for (let i = 0; i < numParticles; i++) {
    const angle = (i / numParticles) * Math.PI * 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;

    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fillStyle = SUCCESS;
    ctx.fill();
  }

  // Center sparkle
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fillStyle = SUCCESS;
  ctx.fill();

  ctx.globalAlpha = 1;
}

function drawRedX(
  ctx: CanvasRenderingContext2D,
  e: Extract<Effect, { kind: "redX" }>,
  vp: Viewport,
): void {
  const { x, y } = mapToScreen(e.atTx, e.atTy, vp.cx, vp.cy);
  const alpha = Math.min(1, e.ttl * 1.5);
  const size = 14;

  ctx.globalAlpha = alpha;
  ctx.strokeStyle = DANGER;
  ctx.lineWidth = 3;

  // First diagonal (\)
  ctx.beginPath();
  ctx.moveTo(x - size, y - size);
  ctx.lineTo(x + size, y + size);
  ctx.stroke();

  // Second diagonal (/)
  ctx.beginPath();
  ctx.moveTo(x + size, y - size);
  ctx.lineTo(x - size, y + size);
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
}

function drawPulse(
  ctx: CanvasRenderingContext2D,
  e: Extract<Effect, { kind: "pulse" }>,
  vp: Viewport,
): void {
  const { x, y } = mapToScreen(e.atTx, e.atTy, vp.cx, vp.cy);
  // ttl starts at 2.0; alpha ramps from 0 → 1 → 0 (peak at 1.0)
  const alpha = Math.max(0, 0.7 - Math.abs(e.ttl - 1.0) * 0.7);
  const radius = (2.0 - e.ttl) * 24 + 10;

  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1, radius), 0, Math.PI * 2);
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
}

function drawAlarm(
  ctx: CanvasRenderingContext2D,
  e: Extract<Effect, { kind: "alarm" }>,
  vp: Viewport,
): void {
  const { x, y } = mapToScreen(e.atTx, e.atTy, vp.cx, vp.cy);
  // Flash: alternating high-alpha fills
  const alpha = (Math.sin(e.ttl * Math.PI * 6) + 1) / 2;

  ctx.globalAlpha = Math.max(0.1, alpha * 0.6);
  ctx.fillStyle = DANGER;
  ctx.fillRect(x - HALF_W, y - HALF_H, TILE_W, TILE_H);

  ctx.globalAlpha = 1;
}

function drawPhantomWalk(
  ctx: CanvasRenderingContext2D,
  e: Extract<Effect, { kind: "phantomWalk" }>,
  vp: Viewport,
): void {
  const from = mapToScreen(e.fromTx, e.fromTy, vp.cx, vp.cy);
  const to = mapToScreen(e.toTx, e.toTy, vp.cx, vp.cy);

  // Progress: 0 at start (full ttl), 1 at end (ttl=0)
  const progress = Math.max(0, 1 - e.ttl / 2.5);
  const alpha = Math.min(1, e.ttl);

  ctx.globalAlpha = alpha;

  // Trail line from start to current position
  const currX = from.x + (to.x - from.x) * progress;
  const currY = from.y + (to.y - from.y) * progress;

  ctx.strokeStyle = PHANTOM;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(currX, currY);
  ctx.stroke();

  // Phantom dot at current position
  ctx.fillStyle = PHANTOM;
  ctx.fillRect(currX - 4, currY - 4, 8, 8);

  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
}

// ---------------------------------------------------------------------------
// Pixel-agent sprite registry — module-level, keyed by taskId.
// Kept here (rather than in scene) because it's an animation-layer concern
// that the RAF loop advances; the Scene.agents[] contract (v0.1) stays pure
// data for the SSE drain to mutate.
// ---------------------------------------------------------------------------

const spriteRegistry: SpriteRegistry = createSpriteRegistry();
let spriteLoadKicked = false;
let lastTickMs: number | null = null;

/** Reset the registry. Testing only. */
export function __resetRenderer(): void {
  spriteRegistry.clear();
  spriteLoadKicked = false;
  lastTickMs = null;
}

/**
 * Advance sprite-animation timers. Called once per RAF tick from the canvas
 * host, *after* step() has run on the scene. Pure with respect to DOM —
 * only touches the sprite registry.
 *
 * Sprite records are also reconciled against Scene.agents[]:
 *   - Any taskId in Scene.agents[] but not in the registry → new record.
 *   - Any taskId in the registry but not in Scene.agents[] → removed.
 *   - Direction is recomputed from travel vector if the agent is traveling.
 */
export function tickPixelAgents(scene: Scene, dt: number, nowMs: number): void {
  const agents = scene.agents ?? [];
  const seen = new Set<string>();

  for (const ag of agents) {
    seen.add(ag.taskId);
    let sprite = spriteRegistry.get(ag.taskId);
    if (!sprite) {
      sprite = ensureSprite(spriteRegistry, ag.taskId, "forge", nowMs);
    }
    // Reconcile phase/direction against the v0.1 PixelAgent contract.
    if (ag.phase === "traveling") {
      sprite = {
        ...sprite,
        phase: "departing",
        state: "walk",
        direction: facingForTravel(ag.tx, ag.ty, ag.targetTx, ag.targetTy),
      };
    } else if (sprite.phase === "spawning") {
      // The SSE agent_spawn currently drops the agent at its source station
      // with tx/ty already set (no interpolation). Treat that as "arrived".
      sprite = {
        ...sprite,
        phase: "seated",
        state: sprite.currentTool ? animStateForTool(sprite.currentTool) : "idle",
        direction: "up",
      };
    }
    // Always advance animation frame.
    sprite = tickSprite(sprite, dt, nowMs);
    spriteRegistry.set(ag.taskId, sprite);
  }

  // Garbage-collect sprites whose agent has been removed from the scene.
  for (const taskId of spriteRegistry.keys()) {
    if (!seen.has(taskId)) removeSprite(spriteRegistry, taskId);
  }
}

/** Expose the registry for tests + optional external consumers. */
export function getPixelAgentRegistry(): SpriteRegistry {
  return spriteRegistry;
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

/**
 * Pure draw routine. Draws in this order:
 *   1. Dark-bg fill
 *   2. Stations — z-sorted by (tx + ty) ascending
 *   3. Effects — in scene.effects array order
 *   4. Entities — drawn on top
 *
 * Never throws; every branch has a default. Never reads time — ttl/position
 * are driven by the caller via step().
 */
export function render(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  viewport: Viewport,
): void {
  const { width, height, cx, cy, devLabels } = viewport;
  const L = labelFor(devLabels);

  // ------------------------------------------------------------------
  // 1. Background fill
  // ------------------------------------------------------------------
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, width, height);

  // ------------------------------------------------------------------
  // 1b. Pixel-office floor — dimmed diamond tiles under the whole scene.
  //     Characters are the star; the floor is just "there".
  // ------------------------------------------------------------------
  drawOfficeFloor(ctx, cx, cy);

  // ------------------------------------------------------------------
  // 2. Stations — z-sorted ascending by (tx + ty)
  // ------------------------------------------------------------------
  const sorted = (Object.entries(scene.stations) as [StationName, { tx: number; ty: number; status: string }][])
    .sort((a, b) => (a[1].tx + a[1].ty) - (b[1].tx + b[1].ty));

  for (const [name, station] of sorted) {
    const { x, y } = mapToScreen(station.tx, station.ty, cx, cy);
    const fillColor = STATUS_FILL[station.status] ?? SURFACE;

    drawDiamond(ctx, x, y, fillColor);

    // Station label below center
    const labelKey = STATION_LABEL_KEY[name as StationName];
    const label = (L as unknown as Record<string, string>)[labelKey as string] ?? name;

    ctx.fillStyle = TEXT;
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, x, y + HALF_H + 14);
  }

  // ------------------------------------------------------------------
  // 3. Effects
  // ------------------------------------------------------------------
  for (const effect of scene.effects) {
    switch (effect.kind) {
      case "fireworks":
        drawFireworks(ctx, effect, viewport);
        break;
      case "redX":
        drawRedX(ctx, effect, viewport);
        break;
      case "pulse":
        drawPulse(ctx, effect, viewport);
        break;
      case "alarm":
        drawAlarm(ctx, effect, viewport);
        break;
      case "phantomWalk":
        drawPhantomWalk(ctx, effect, viewport);
        break;
      default:
        // Unknown effect kind — silently skip
        break;
    }
  }

  // ------------------------------------------------------------------
  // 4. Entities — drawn on top of everything else
  // ------------------------------------------------------------------
  for (const entity of scene.entities) {
    if (entity.kind === "phantom") {
      const { x, y } = mapToScreen(entity.tx, entity.ty, cx, cy);
      ctx.fillStyle = PHANTOM;
      ctx.fillRect(x - 5, y - 5, 10, 10);
    }
  }

  // ------------------------------------------------------------------
  // 5. Pixel agents — pablodelucca-style character sprites at desks.
  //    Fallback to colored squares when the sprite sheet hasn't loaded
  //    yet (first frames after mount, or SSR).
  // ------------------------------------------------------------------
  // Kick off sprite loading on the first render — safe no-op in SSR.
  if (!spriteLoadKicked) {
    spriteLoadKicked = true;
    // Fire-and-forget; no await. The draw below probes getSpriteSet() per frame.
    void loadPixelAgentSprites();
  }

  // Advance sprite animations using wall-clock delta. Safe in jsdom / SSR:
  // when Date.now() is called in tests the delta is ~0 so nothing animates
  // unexpectedly.
  {
    const now =
      typeof performance !== "undefined" && typeof performance.now === "function"
        ? performance.now()
        : Date.now();
    const dt =
      lastTickMs == null ? 0 : Math.min(0.1, (now - lastTickMs) / 1000);
    lastTickMs = now;
    tickPixelAgents(scene, dt, now);
  }

  const agents = scene.agents ?? [];
  if (agents.length > 0) {
    const set = getSpriteSet();
    // Disable smoothing once for crisp pixel art — safe if ctx doesn't
    // implement it (test stubs use vi.fn property setters that swallow
    // the assignment).
    ctx.imageSmoothingEnabled = false;

    for (let i = 0; i < agents.length; i++) {
      const ag = agents[i];
      const tx = ag.phase === "traveling"
        ? ag.tx + (ag.targetTx - ag.tx) * Math.min(1, Math.max(0, ag.progress))
        : ag.tx;
      const ty = ag.phase === "traveling"
        ? ag.ty + (ag.targetTy - ag.ty) * Math.min(1, Math.max(0, ag.progress))
        : ag.ty;

      if (set && set.ready) {
        drawCharacterForAgent(ctx, ag, tx, ty, cx, cy, i);
      } else {
        drawColoredSquareFallback(ctx, ag, tx, ty, cx, cy, i);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Character-sprite draw (pablodelucca port)
// ---------------------------------------------------------------------------

/**
 * Draw a single agent as a 16×32 pixel-art character. The sprite's frame
 * is taken from the module-level registry (ticked via tickPixelAgents).
 */
function drawCharacterForAgent(
  ctx: CanvasRenderingContext2D,
  agent: PixelAgent,
  tx: number,
  ty: number,
  cx: number,
  cy: number,
  idx: number,
): void {
  const { x, y } = tileToCharacterPixel(tx, ty, cx, cy);
  const stackOffset = (idx % 4) * 4; // cluster-friendly vertical nudge

  const sprite = spriteRegistry.get(agent.taskId);
  const direction: Direction = sprite?.direction ?? "right";
  const step = sprite?.animStep ?? 0;
  // While traveling: always "walk". Sitting: state-driven. If no registry
  // entry exists yet (race between drain + tick), default to walk.
  const state =
    agent.phase === "traveling"
      ? "walk"
      : sprite?.state ?? "idle";

  const drawn = drawCharacter(ctx, getSpriteSet(), {
    paletteIndex: sprite?.paletteIndex ?? (agent.hue % 6),
    direction,
    state,
    step,
    dx: x,
    dy: y - stackOffset,
    scale: 2,
    hueShift: 0,
  });

  if (!drawn) {
    drawColoredSquareFallback(ctx, agent, tx, ty, cx, cy, idx);
    return;
  }

  // Speech bubble overlay — only for seated agents with either flag set.
  if (sprite && (sprite.showWaitingBubble || sprite.showPermissionBubble)) {
    const bubble = sprite.showPermissionBubble ? BUBBLE_PERMISSION : BUBBLE_WAITING;
    // Bubble drawn above head — 16px over the sprite, 2× scale so it
    // matches character zoom.
    const bubbleX = x + 2;
    const bubbleY = y - bubble.height * 2 - 2 - stackOffset;
    drawBubble(ctx, bubble, bubbleX, bubbleY, 2);
  }
}

/**
 * Fallback when the sprite sheet hasn't loaded yet. Matches v0.1 behavior
 * so the scene is never blank.
 */
function drawColoredSquareFallback(
  ctx: CanvasRenderingContext2D,
  agent: PixelAgent,
  tx: number,
  ty: number,
  cx: number,
  cy: number,
  idx: number,
): void {
  const { x, y } = mapToScreen(tx, ty, cx, cy);
  const fill = `hsl(${agent.hue} 80% 58%)`;
  const glow = `hsla(${agent.hue} 80% 58% / 0.35)`;
  const stackOffset = (idx % 4) * 3;
  ctx.fillStyle = glow;
  ctx.fillRect(x - 6, y - 6 - stackOffset, 12, 12);
  ctx.fillStyle = fill;
  ctx.fillRect(x - 3, y - 3 - stackOffset, 6, 6);
}

/**
 * Paint the pixel-office floor as dimmed isometric diamonds under the
 * entire scene. We don't blit the floor PNG tiles here (they'd require
 * an additional image-load gate) — dim diamonds read as "tiled floor"
 * at this zoom and never make the station diamonds disappear.
 */
function drawOfficeFloor(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
): void {
  // Floor spans from a bit beyond the station grid (0..15) so there's no
  // visible edge at a normal 960×720 viewport.
  const MIN = -2;
  const MAX = 18;
  for (let ty = MIN; ty <= MAX; ty++) {
    for (let tx = MIN; tx <= MAX; tx++) {
      const { x, y } = mapToScreen(tx, ty, cx, cy);
      const color =
        (tx + ty) % 5 === 0
          ? FLOOR_ACCENT
          : (tx + ty) % 2 === 0
            ? FLOOR_A
            : FLOOR_B;
      // Filled diamond without stroke — border would make it too noisy.
      ctx.beginPath();
      ctx.moveTo(x, y - HALF_H);
      ctx.lineTo(x + HALF_W, y);
      ctx.lineTo(x, y + HALF_H);
      ctx.lineTo(x - HALF_W, y);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }
  }
}
