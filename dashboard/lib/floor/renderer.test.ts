/**
 * renderer.test.ts — Pure Canvas 2D draw routine tests.
 *
 * Uses a fake CanvasRenderingContext2D (all methods are vi.fn() spies)
 * so the renderer is testable without a real browser or jsdom canvas.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, type Viewport } from "./renderer";
import { createScene } from "./scene";
import { labelFor } from "@/lib/copy/labels";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Captured fill/stroke style values (set via property setters). */
const fillStyleSets: string[] = [];
const strokeStyleSets: string[] = [];
const globalAlphaSets: number[] = [];

function mkFakeCtx(): CanvasRenderingContext2D {
  const fns = [
    "fillRect",
    "strokeRect",
    "beginPath",
    "closePath",
    "moveTo",
    "lineTo",
    "arc",
    "fill",
    "stroke",
    "fillText",
    "save",
    "restore",
    "translate",
    "clearRect",
    "setTransform",
  ];
  const ctx = {} as Record<string, unknown>;
  for (const f of fns) ctx[f] = vi.fn();
  ctx["canvas"] = { width: 960, height: 720 };
  Object.defineProperties(ctx, {
    fillStyle: {
      set: vi.fn((v: string) => { fillStyleSets.push(v); }),
      get: () => "#000",
      configurable: true,
    },
    strokeStyle: {
      set: vi.fn((v: string) => { strokeStyleSets.push(v); }),
      get: () => "#000",
      configurable: true,
    },
    globalAlpha: {
      set: vi.fn((v: number) => { globalAlphaSets.push(v); }),
      get: () => 1,
      configurable: true,
    },
    lineWidth: {
      set: vi.fn(),
      get: () => 1,
      configurable: true,
    },
    font: {
      set: vi.fn(),
      get: () => "13px sans-serif",
      configurable: true,
    },
    textAlign: {
      set: vi.fn(),
      get: () => "left",
      configurable: true,
    },
  });
  return ctx as unknown as CanvasRenderingContext2D;
}

const baseViewport: Viewport = {
  width: 960,
  height: 720,
  cx: 480,
  cy: 280,
  devLabels: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("renderer", () => {
  beforeEach(() => {
    fillStyleSets.length = 0;
    strokeStyleSets.length = 0;
    globalAlphaSets.length = 0;
    vi.clearAllMocks();
  });

  // Test 1: bg fill happens first
  it("bg fill happens first — fillRect(0,0,960,720) is the first call", () => {
    const ctx = mkFakeCtx();
    const scene = createScene();
    render(ctx, scene, baseViewport);

    const calls = (ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]).toEqual([0, 0, 960, 720]);
  });

  // Test 2: each station draws at least one fill() AND one fillText
  // Stations use diamond paths (moveTo/lineTo/closePath/fill), not fillRect
  it("draws at least 10 fill() calls (10 station diamonds) and 10 fillText calls", () => {
    const ctx = mkFakeCtx();
    const scene = createScene();
    render(ctx, scene, baseViewport);

    // Stations draw via path fill(); bg uses fillRect; both are valid draw calls
    const fillCalls = (ctx.fill as ReturnType<typeof vi.fn>).mock.calls;
    const fillTextCalls = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls;

    // At least 10 fill() calls — one per station diamond
    expect(fillCalls.length).toBeGreaterThanOrEqual(10);
    expect(fillTextCalls.length).toBeGreaterThanOrEqual(10);
  });

  // Test 3: status tints — alarm = danger (#ef4444), active = accent (#00d4ff)
  it("uses danger token for alarm station and accent token for active station", () => {
    const ctx = mkFakeCtx();
    const scene = createScene();
    scene.stations.hub.status = "alarm";
    scene.stations.forge.status = "active";

    render(ctx, scene, baseViewport);

    expect(fillStyleSets).toContain("#ef4444");
    expect(fillStyleSets).toContain("#00d4ff");
  });

  // Test 4: Z-sort by (tx + ty)
  it("draws stations z-sorted by (tx + ty) ascending — back stations before front", () => {
    // overlook (2,2) tx+ty=4 should render BEFORE shadow (10,14) tx+ty=24
    // Verify by checking which fill colors appear in which order
    const ctx = mkFakeCtx();
    const fills: string[] = [];
    Object.defineProperty(ctx, "fillStyle", {
      set: (v: string) => { fills.push(v); },
      get: () => "#000",
      configurable: true,
    });

    const scene = createScene();
    // overlook at (2,2) tx+ty=4 → drawn first (back)
    scene.stations.overlook.status = "active";  // accent #00d4ff
    // shadow at (10,14) tx+ty=24 → drawn last (front)
    scene.stations.shadow.status = "alarm";      // danger #ef4444

    render(ctx, scene, { ...baseViewport });

    // accent should appear before danger in fillStyle sets
    const accentIdx = fills.indexOf("#00d4ff");
    const dangerIdx = fills.indexOf("#ef4444");
    expect(accentIdx).toBeGreaterThanOrEqual(0);
    expect(dangerIdx).toBeGreaterThanOrEqual(0);
    expect(accentIdx).toBeLessThan(dangerIdx);
  });

  // Test 5: Effect rendering — fireworks uses arc (sparkle ring)
  it("fireworks effect calls ctx.arc at least once", () => {
    const ctx = mkFakeCtx();
    const scene = createScene();
    scene.effects = [{ kind: "fireworks", atTx: 8, atTy: 8, ttl: 1.0 }];
    render(ctx, scene, baseViewport);
    const arcCalls = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls;
    expect(arcCalls.length).toBeGreaterThanOrEqual(1);
  });

  // Test 6: Effect rendering — redX uses moveTo + lineTo (two diagonals = X)
  it("redX effect calls ctx.moveTo >= 2 times and ctx.lineTo >= 2 times", () => {
    const ctx = mkFakeCtx();
    const scene = createScene();
    scene.effects = [{ kind: "redX", atTx: 12, atTy: 6, ttl: 0.5 }];
    render(ctx, scene, baseViewport);
    const moveToCalls = (ctx.moveTo as ReturnType<typeof vi.fn>).mock.calls;
    const lineToCalls = (ctx.lineTo as ReturnType<typeof vi.fn>).mock.calls;
    expect(moveToCalls.length).toBeGreaterThanOrEqual(2);
    expect(lineToCalls.length).toBeGreaterThanOrEqual(2);
  });

  // Test 7: Effect rendering — pulse uses arc + globalAlpha < 1
  it("pulse effect calls ctx.arc >= 1 and sets globalAlpha < 1", () => {
    const ctx = mkFakeCtx();
    const alphas: number[] = [];
    Object.defineProperty(ctx, "globalAlpha", {
      set: (v: number) => { alphas.push(v); },
      get: () => 1,
      configurable: true,
    });

    const scene = createScene();
    scene.effects = [{ kind: "pulse", atTx: 12, atTy: 6, ttl: 1.0 }];
    render(ctx, scene, baseViewport);

    const arcCalls = (ctx.arc as ReturnType<typeof vi.fn>).mock.calls;
    expect(arcCalls.length).toBeGreaterThanOrEqual(1);
    expect(alphas.some((a) => a < 1)).toBe(true);
  });

  // Test 8: Effect rendering — alarm sets danger fill color
  it("alarm effect sets danger fillStyle #ef4444 during effect drawing", () => {
    const ctx = mkFakeCtx();
    const fills: string[] = [];
    Object.defineProperty(ctx, "fillStyle", {
      set: (v: string) => { fills.push(v); },
      get: () => "#000",
      configurable: true,
    });

    const scene = createScene();
    // All stations idle so no danger from station phase
    scene.effects = [{ kind: "alarm", atTx: 8, atTy: 8, ttl: 1.0 }];
    render(ctx, scene, { ...baseViewport });

    expect(fills).toContain("#ef4444");
  });

  // Test 9: Effect rendering — phantomWalk uses moveTo + lineTo
  it("phantomWalk effect calls ctx.moveTo >= 1 and ctx.lineTo >= 1", () => {
    const ctx = mkFakeCtx();
    const scene = createScene();
    scene.effects = [
      { kind: "phantomWalk", fromTx: 10, fromTy: 14, toTx: 12, toTy: 6, ttl: 1.0 },
    ];
    render(ctx, scene, baseViewport);

    const moveToCalls = (ctx.moveTo as ReturnType<typeof vi.fn>).mock.calls;
    const lineToCalls = (ctx.lineTo as ReturnType<typeof vi.fn>).mock.calls;
    expect(moveToCalls.length).toBeGreaterThanOrEqual(1);
    expect(lineToCalls.length).toBeGreaterThanOrEqual(1);
  });

  // Test 10: No effects → no effect draw calls; adding fireworks increases arc count
  it("no effects produces 0 arc calls; adding fireworks increases arc count", () => {
    const ctx1 = mkFakeCtx();
    const scene1 = createScene();
    scene1.effects = [];
    render(ctx1, scene1, baseViewport);
    const arcsBefore = (ctx1.arc as ReturnType<typeof vi.fn>).mock.calls.length;

    const ctx2 = mkFakeCtx();
    const scene2 = createScene();
    scene2.effects = [{ kind: "fireworks", atTx: 8, atTy: 8, ttl: 1.0 }];
    render(ctx2, scene2, baseViewport);
    const arcsAfter = (ctx2.arc as ReturnType<typeof vi.fn>).mock.calls.length;

    expect(arcsAfter).toBeGreaterThan(arcsBefore);
  });

  // Test 11: devLabels flag flips text — dev="Nexus hub", founder="The conductor's desk"
  it("devLabels=false renders founder copy, devLabels=true renders dev copy", () => {
    const founderL = labelFor(false);
    const devL = labelFor(true);

    // founder copy
    const ctx1 = mkFakeCtx();
    const calls1: string[] = [];
    (ctx1.fillText as ReturnType<typeof vi.fn>).mockImplementation((text: string) => {
      calls1.push(text);
    });
    render(ctx1, createScene(), { ...baseViewport, devLabels: false });
    expect(calls1).toContain(founderL.floorStationHub);

    // dev copy
    const ctx2 = mkFakeCtx();
    const calls2: string[] = [];
    (ctx2.fillText as ReturnType<typeof vi.fn>).mockImplementation((text: string) => {
      calls2.push(text);
    });
    render(ctx2, createScene(), { ...baseViewport, devLabels: true });
    expect(calls2).toContain(devL.floorStationHub);
  });

  // Test 12: Viewport camera offset applies
  // Stations are drawn via path (moveTo/lineTo) — camera offset shifts moveTo positions
  it("different cx/cy produces different draw positions (moveTo coords shift with camera)", () => {
    const ctx1 = mkFakeCtx();
    const moves1: number[][] = [];
    (ctx1.moveTo as ReturnType<typeof vi.fn>).mockImplementation((x: number, y: number) => {
      moves1.push([x, y]);
    });
    render(ctx1, createScene(), { ...baseViewport, cx: 0, cy: 0 });

    const ctx2 = mkFakeCtx();
    const moves2: number[][] = [];
    (ctx2.moveTo as ReturnType<typeof vi.fn>).mockImplementation((x: number, y: number) => {
      moves2.push([x, y]);
    });
    render(ctx2, createScene(), { ...baseViewport, cx: 100, cy: 50 });

    // Both renders should have station moveTo calls
    expect(moves1.length).toBeGreaterThan(0);
    expect(moves2.length).toBeGreaterThan(0);
    // At least one moveTo should differ between the two camera offsets
    const differ = moves1.some((m, i) => {
      const m2 = moves2[i];
      return m2 && (m[0] !== m2[0] || m[1] !== m2[1]);
    });
    expect(differ).toBe(true);
  });

  // Test 13: Entities drawn AFTER effects (pulse before phantom entity)
  it("effect calls appear before entity calls in invocation order", () => {
    const ctx = mkFakeCtx();
    const callOrder: string[] = [];

    (ctx.arc as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callOrder.push("arc");
    });
    (ctx.fillRect as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callOrder.push("fillRect");
    });

    const scene = createScene();
    scene.effects = [{ kind: "pulse", atTx: 8, atTy: 8, ttl: 1.0 }];
    scene.entities = [
      { kind: "phantom", tx: 10, ty: 14, targetTx: 10, targetTy: 14, speed: 1 },
    ];
    render(ctx, scene, baseViewport);

    // Find the last arc call index (from pulse effect) and the entity fillRect call
    // Entity fillRect should come after all effect arcs
    const arcIndices = callOrder
      .map((v, i) => (v === "arc" ? i : -1))
      .filter((i) => i >= 0);
    // The last arc from the effect should come before any entity fillRect that
    // appears after stations + effects (station fillRects come early; entity fillRect comes last)
    // Since we can't distinguish which fillRect is entity vs station, we simply verify
    // arc calls exist (effect drawn) and that the last fillRect comes after the last arc
    expect(arcIndices.length).toBeGreaterThan(0);
    const lastArcIdx = arcIndices[arcIndices.length - 1];
    const fillRectIndices = callOrder
      .map((v, i) => (v === "fillRect" ? i : -1))
      .filter((i) => i >= 0);
    const lastFillRectIdx = fillRectIndices[fillRectIndices.length - 1];
    // Entity is drawn after effects, which includes arcs; last fillRect >= last arc
    expect(lastFillRectIdx).toBeGreaterThan(lastArcIdx);
  });

  // Test 14: No throw on empty scene
  it("does not throw on an empty createScene()", () => {
    const ctx = mkFakeCtx();
    expect(() => render(ctx, createScene(), baseViewport)).not.toThrow();
  });
});
