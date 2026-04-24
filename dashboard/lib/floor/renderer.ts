/**
 * Pure Canvas 2D draw routine for the Live Floor scene (D-01, D-03, D-09).
 *
 * Design contract:
 * - NO React imports
 * - NO window / document / performance / requestAnimationFrame access
 * - Pure function of (ctx, scene, viewport) only — fully unit-testable with a stub ctx
 * - Never throws; every branch has a default fill
 * - Animation state is driven by effect.ttl / entity positions mutated by step()
 *
 * Draw order (z-layers):
 *   1. Dark background fill
 *   2. Stations — z-sorted by (tx + ty) ascending so back stations paint first
 *      Each station: filled diamond + text label below center
 *   3. Effects — in scene.effects array order (newest last = on top)
 *   4. Entities — phantoms drawn on top of their current position
 */

import { mapToScreen, TILE_W, TILE_H } from "./iso";
import type { Scene, StationName } from "./scene";
import type { Effect } from "./state";
import { labelFor } from "@/lib/copy/labels";

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
  // 5. Pixel agents — colored squares, one per in-flight forge task
  //    Working: subtle bob offset at source station.
  //    Traveling: linear interpolation from source to target.
  // ------------------------------------------------------------------
  const agents = scene.agents ?? [];
  if (agents.length > 0) {
    const now = performance.now();
    for (let i = 0; i < agents.length; i++) {
      const ag = agents[i];
      let tx: number;
      let ty: number;
      if (ag.phase === "traveling") {
        const t = Math.min(1, Math.max(0, ag.progress));
        tx = ag.tx + (ag.targetTx - ag.tx) * t;
        ty = ag.ty + (ag.targetTy - ag.ty) * t;
      } else {
        const bob = Math.sin((now + i * 170) / 260) * 0.12;
        const bobX = Math.cos((now + i * 170) / 310) * 0.09;
        tx = ag.tx + bobX;
        ty = ag.ty + bob;
      }
      const { x, y } = mapToScreen(tx, ty, cx, cy);
      const fill = `hsl(${ag.hue} 80% 58%)`;
      const glow = `hsla(${ag.hue} 80% 58% / 0.35)`;
      const stackOffset = (i % 4) * 3;
      ctx.fillStyle = glow;
      ctx.fillRect(x - 6, y - 6 - stackOffset, 12, 12);
      ctx.fillStyle = fill;
      ctx.fillRect(x - 3, y - 3 - stackOffset, 6, 6);
    }
  }
}
