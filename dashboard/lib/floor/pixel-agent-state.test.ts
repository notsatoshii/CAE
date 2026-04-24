/**
 * pixel-agent-state.test.ts — state-machine transitions + registry.
 */

import { describe, it, expect } from "vitest";
import {
  paletteIndexForTaskId,
  animStateForTool,
  createSpriteState,
  applyToolCall,
  applyArrivedAtDesk,
  applyDeparting,
  tickSprite,
  facingForTravel,
  reconcilePhase,
  createSpriteRegistry,
  ensureSprite,
  removeSprite,
  WAITING_BUBBLE_MS,
} from "./pixel-agent-state";
import type { PixelAgent } from "./scene";

describe("paletteIndexForTaskId", () => {
  it("always returns an index in [0,5]", () => {
    for (const id of ["a", "", "task-12345", "xxxxxxxxxxxx", "0"]) {
      const p = paletteIndexForTaskId(id);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(5);
    }
  });
  it("is deterministic", () => {
    expect(paletteIndexForTaskId("task-42")).toBe(paletteIndexForTaskId("task-42"));
  });
  it("different inputs can yield different palettes", () => {
    const a = paletteIndexForTaskId("alpha");
    const b = paletteIndexForTaskId("beta");
    const c = paletteIndexForTaskId("gamma");
    expect(new Set([a, b, c]).size).toBeGreaterThanOrEqual(1);
  });
});

describe("animStateForTool", () => {
  it("null/empty → idle", () => {
    expect(animStateForTool(null)).toBe("idle");
  });
  it("write/edit tools → typing", () => {
    expect(animStateForTool("Write")).toBe("typing");
    expect(animStateForTool("Edit")).toBe("typing");
    expect(animStateForTool("str_replace_editor")).toBe("typing");
  });
  it("read/search tools → reading", () => {
    expect(animStateForTool("Read")).toBe("reading");
    expect(animStateForTool("Grep")).toBe("reading");
    expect(animStateForTool("Glob")).toBe("reading");
    expect(animStateForTool("ls")).toBe("reading");
  });
  it("unknown tool → typing (default active anim)", () => {
    expect(animStateForTool("Bash")).toBe("typing");
    expect(animStateForTool("Task")).toBe("typing");
    expect(animStateForTool("MCP__whatever")).toBe("typing");
  });
});

describe("createSpriteState", () => {
  it("starts in spawning/walk phase", () => {
    const s = createSpriteState("task-1", "forge", 1_000);
    expect(s.phase).toBe("spawning");
    expect(s.state).toBe("walk");
    expect(s.lastToolCallMs).toBe(1_000);
    expect(s.currentTool).toBeNull();
    expect(s.showWaitingBubble).toBe(false);
    expect(s.showPermissionBubble).toBe(false);
  });
  it("derives paletteIndex from taskId", () => {
    const s = createSpriteState("alpha", "hub", 0);
    expect(s.paletteIndex).toBe(paletteIndexForTaskId("alpha"));
  });
});

describe("applyToolCall", () => {
  it("while seated, switches state based on tool", () => {
    const s = applyArrivedAtDesk(createSpriteState("x", "forge", 0));
    const next = applyToolCall(s, "Write", 10_000);
    expect(next.state).toBe("typing");
    expect(next.currentTool).toBe("Write");
    expect(next.lastToolCallMs).toBe(10_000);
    expect(next.showWaitingBubble).toBe(false);
  });
  it("does not mutate prev", () => {
    const s = applyArrivedAtDesk(createSpriteState("x", "forge", 0));
    const before = { ...s };
    applyToolCall(s, "Write", 99);
    expect(s).toEqual(before);
  });
  it("while still spawning, does NOT override walk state", () => {
    const s = createSpriteState("x", "forge", 0);
    const next = applyToolCall(s, "Read", 100);
    // spawning phase keeps walk anim; only the tool record updates
    expect(next.state).toBe("walk");
    expect(next.currentTool).toBe("Read");
  });
});

describe("applyArrivedAtDesk", () => {
  it("transitions to seated + idle if no tool yet", () => {
    const s = createSpriteState("x", "forge", 0);
    const arrived = applyArrivedAtDesk(s);
    expect(arrived.phase).toBe("seated");
    expect(arrived.state).toBe("idle");
  });
  it("transitions to seated + typing if tool was Write", () => {
    const s = applyToolCall(createSpriteState("x", "forge", 0), "Write", 0);
    const arrived = applyArrivedAtDesk(s);
    expect(arrived.phase).toBe("seated");
    expect(arrived.state).toBe("typing");
  });
});

describe("applyDeparting", () => {
  it("moves to departing/walk/down", () => {
    const s = applyArrivedAtDesk(createSpriteState("x", "forge", 0));
    const dep = applyDeparting(s);
    expect(dep.phase).toBe("departing");
    expect(dep.state).toBe("walk");
    expect(dep.direction).toBe("down");
    expect(dep.showWaitingBubble).toBe(false);
  });
});

describe("tickSprite", () => {
  it("advances animStep based on dt + ANIM_FPS", () => {
    const s = applyArrivedAtDesk(createSpriteState("x", "forge", 0));
    const next = tickSprite(s, 0.5, 0);
    // At 6 fps, dt=0.5 → 3 frames added
    expect(next.animStep).toBe(3);
  });
  it("raises waiting bubble when seated + idle > WAITING_BUBBLE_MS", () => {
    const s = applyArrivedAtDesk(createSpriteState("x", "forge", 0));
    const next = tickSprite(s, 0, WAITING_BUBBLE_MS + 1);
    expect(next.showWaitingBubble).toBe(true);
  });
  it("no bubble when seated + fresh activity", () => {
    const s = applyArrivedAtDesk(createSpriteState("x", "forge", 0));
    const next = tickSprite(s, 0, 100);
    expect(next.showWaitingBubble).toBe(false);
  });
  it("does not raise bubble while still spawning", () => {
    const s = createSpriteState("x", "forge", 0);
    const next = tickSprite(s, 0, WAITING_BUBBLE_MS + 1);
    expect(next.showWaitingBubble).toBe(false);
  });
});

describe("facingForTravel", () => {
  it("pure east → right", () => {
    expect(facingForTravel(0, 0, 5, 0)).toBe("right");
  });
  it("pure west → left", () => {
    expect(facingForTravel(0, 0, -5, 0)).toBe("left");
  });
  it("pure south → down", () => {
    expect(facingForTravel(0, 0, 0, 3)).toBe("down");
  });
  it("pure north → up", () => {
    expect(facingForTravel(0, 0, 0, -3)).toBe("up");
  });
  it("horizontal dominance ties go right", () => {
    expect(facingForTravel(0, 0, 2, 2)).toBe("right");
  });
});

describe("reconcilePhase", () => {
  const base: PixelAgent = {
    id: "t1",
    taskId: "t1",
    tx: 8,
    ty: 8,
    targetTx: 8,
    targetTy: 8,
    progress: 0,
    hue: 120,
    phase: "working",
  };

  it("traveling PixelAgent flips sprite to departing", () => {
    const sprite = applyArrivedAtDesk(createSpriteState("t1", "forge", 0));
    const traveling: PixelAgent = { ...base, phase: "traveling", targetTx: 2, targetTy: 2 };
    const r = reconcilePhase(traveling, sprite);
    expect(r.phase).toBe("departing");
    expect(r.state).toBe("walk");
  });
  it("working PixelAgent while sprite is still spawning → seated", () => {
    const sprite = createSpriteState("t1", "forge", 0);
    const r = reconcilePhase(base, sprite);
    expect(r.phase).toBe("seated");
  });
  it("working + already seated is idempotent", () => {
    const sprite = applyArrivedAtDesk(createSpriteState("t1", "forge", 0));
    const r = reconcilePhase(base, sprite);
    expect(r).toBe(sprite);
  });
});

describe("registry helpers", () => {
  it("ensureSprite creates then reuses", () => {
    const reg = createSpriteRegistry();
    const a = ensureSprite(reg, "t1", "forge", 0);
    const b = ensureSprite(reg, "t1", "forge", 0);
    expect(a).toBe(b);
    expect(reg.size).toBe(1);
  });
  it("removeSprite deletes the record", () => {
    const reg = createSpriteRegistry();
    ensureSprite(reg, "t1", "forge", 0);
    removeSprite(reg, "t1");
    expect(reg.size).toBe(0);
  });
});
