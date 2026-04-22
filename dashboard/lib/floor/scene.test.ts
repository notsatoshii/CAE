/**
 * Tests for lib/floor/scene.ts — static station coord map + createScene().
 * RED phase: these tests exist before scene.ts is implemented.
 */

import { describe, it, expect } from "vitest";
import { STATIONS, createScene } from "./scene";

describe("STATIONS — static coordinate map (D-07)", () => {
  it("hub = {tx: 8, ty: 8, persona: 'nexus'}", () => {
    expect(STATIONS.hub).toEqual({ tx: 8, ty: 8, persona: "nexus" });
  });

  it("forge = {tx: 12, ty: 6, persona: 'forge'}", () => {
    expect(STATIONS.forge).toEqual({ tx: 12, ty: 6, persona: "forge" });
  });

  it("watchtower = {tx: 13, ty: 2, persona: 'sentinel'}", () => {
    expect(STATIONS.watchtower).toEqual({ tx: 13, ty: 2, persona: "sentinel" });
  });

  it("overlook = {tx: 2, ty: 2, persona: 'scout'}", () => {
    expect(STATIONS.overlook).toEqual({ tx: 2, ty: 2, persona: "scout" });
  });

  it("library = {tx: 4, ty: 12, persona: 'scribe'}", () => {
    expect(STATIONS.library).toEqual({ tx: 4, ty: 12, persona: "scribe" });
  });

  it("shadow = {tx: 10, ty: 14, persona: 'phantom'}", () => {
    expect(STATIONS.shadow).toEqual({ tx: 10, ty: 14, persona: "phantom" });
  });

  it("armory = {tx: 14, ty: 10, persona: 'aegis'}", () => {
    expect(STATIONS.armory).toEqual({ tx: 14, ty: 10, persona: "aegis" });
  });

  it("drafting = {tx: 6, ty: 4, persona: 'arch'}", () => {
    expect(STATIONS.drafting).toEqual({ tx: 6, ty: 4, persona: "arch" });
  });

  it("pulpit = {tx: 8, ty: 13, persona: 'herald'}", () => {
    expect(STATIONS.pulpit).toEqual({ tx: 8, ty: 13, persona: "herald" });
  });

  it("loadingBay = {tx: 1, ty: 8, persona: null}", () => {
    expect(STATIONS.loadingBay).toEqual({ tx: 1, ty: 8, persona: null });
  });

  it("has exactly 10 keys — no extras, no missing", () => {
    expect(Object.keys(STATIONS)).toHaveLength(10);
  });

  it("loadingBay.persona is null (not a string)", () => {
    expect(STATIONS.loadingBay.persona).toBeNull();
  });

  it("STATIONS is frozen — mutation throws in strict mode", () => {
    expect(() => {
      // @ts-expect-error — intentional mutation test
      STATIONS.hub = { tx: 99, ty: 99, persona: "nexus" };
    }).toThrow();
  });
});

describe("createScene()", () => {
  it("returns an object with effects: [], entities: [], queueDepth: 0, paused: false", () => {
    const scene = createScene();
    expect(scene.effects).toEqual([]);
    expect(scene.entities).toEqual([]);
    expect(scene.queueDepth).toBe(0);
    expect(scene.paused).toBe(false);
  });

  it("lastDelegationTs defaults to 0 or a small placeholder", () => {
    const scene = createScene();
    expect(scene.lastDelegationTs).toBeLessThan(1e13);
  });

  it("hub station has status 'idle' by default", () => {
    expect(createScene().stations.hub.status).toBe("idle");
  });

  it("all 10 stations present in scene.stations", () => {
    expect(Object.keys(createScene().stations)).toHaveLength(10);
  });

  it("two createScene() calls return distinct references", () => {
    const s1 = createScene();
    const s2 = createScene();
    expect(s1).not.toBe(s2);
    expect(s1.effects).not.toBe(s2.effects);
  });

  it("mutating s1 does NOT mutate s2", () => {
    const s1 = createScene();
    const s2 = createScene();
    s1.effects.push({ kind: "fireworks", atTx: 0, atTy: 0, ttl: 1 });
    expect(s2.effects).toHaveLength(0);
  });

  it("scene.stations.hub.tx === STATIONS.hub.tx (copies coords correctly)", () => {
    const scene = createScene();
    expect(scene.stations.hub.tx).toBe(STATIONS.hub.tx);
    expect(scene.stations.hub.ty).toBe(STATIONS.hub.ty);
  });
});
