/**
 * Tests for lib/floor/state.ts — StationStatus + Effect unions + step() reducer.
 * RED phase: these tests exist before state.ts is implemented.
 */

import { describe, it, expect } from "vitest";
import { step, type StationStatus } from "./state";
import { createScene } from "./scene";

describe("step() — effect ttl decrement", () => {
  it("step(scene, 0.5) decrements ttl=1.0 to 0.5 (within ε)", () => {
    const scene = createScene();
    scene.effects.push({ kind: "fireworks", atTx: 8, atTy: 8, ttl: 1.0 });
    step(scene, 0.5);
    expect(scene.effects[0].ttl).toBeCloseTo(0.5, 9);
  });

  it("step(scene, 1.5) with ttl=1.0 → effects.length === 0 (expired removed)", () => {
    const scene = createScene();
    scene.effects.push({ kind: "fireworks", atTx: 8, atTy: 8, ttl: 1.0 });
    step(scene, 1.5);
    expect(scene.effects).toHaveLength(0);
  });

  it("step with 3 effects of ttls [0.2, 0.05, 2.0] → length 2, 0.05 one removed", () => {
    const scene = createScene();
    scene.effects.push({ kind: "fireworks", atTx: 0, atTy: 0, ttl: 0.2 });
    scene.effects.push({ kind: "redX", atTx: 1, atTy: 1, ttl: 0.05 });
    scene.effects.push({ kind: "pulse", atTx: 2, atTy: 2, ttl: 2.0 });
    step(scene, 0.1);
    expect(scene.effects).toHaveLength(2);
    // The 0.05 one should be removed (0.05 - 0.1 = -0.05 <= 0)
    expect(scene.effects.every((e) => e.ttl > 0)).toBe(true);
  });

  it("step with scene.paused === true does NOT decrement ttl", () => {
    const scene = createScene();
    scene.paused = true;
    scene.effects.push({ kind: "fireworks", atTx: 8, atTy: 8, ttl: 1.0 });
    step(scene, 0.5);
    expect(scene.effects[0].ttl).toBe(1.0);
  });

  it("step with dt === 0 is a no-op", () => {
    const scene = createScene();
    scene.effects.push({ kind: "fireworks", atTx: 8, atTy: 8, ttl: 1.0 });
    step(scene, 0);
    expect(scene.effects[0].ttl).toBe(1.0);
    expect(scene.effects).toHaveLength(1);
  });
});

// Type-level exhaustiveness check for StationStatus
describe("StationStatus union — type coverage", () => {
  it("handles all 4 values in exhaustive switch", () => {
    function exhaustiveStatusCheck(s: StationStatus): string {
      switch (s) {
        case "idle":
          return "idle";
        case "active":
          return "active";
        case "warning":
          return "warning";
        case "alarm":
          return "alarm";
        default: {
          // This should never happen — TypeScript will error if union is incomplete
          const _never: never = s;
          return _never;
        }
      }
    }

    const statuses: StationStatus[] = ["idle", "active", "warning", "alarm"];
    for (const s of statuses) {
      expect(exhaustiveStatusCheck(s)).toBe(s);
    }
  });
});
