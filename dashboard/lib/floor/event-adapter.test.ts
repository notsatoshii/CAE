/**
 * Tests for lib/floor/event-adapter.ts — parseEvent + mapEvent synthesis.
 * RED phase: these tests exist before event-adapter.ts is implemented.
 *
 * Security requirements verified here (D-15, D-16, T-11-01, T-11-02-a):
 * - parseEvent rejects oversize lines (> 4096 bytes)
 * - parseEvent swallows SyntaxError from malformed JSON
 * - parseEvent rejects unknown event names (not in ALLOWED_EVENTS allowlist)
 * - mapEvent never spreads user payload; only dispatches on enumerated event names
 * - reducedMotion=true filters ALL ephemeral effects, leaving only status entries
 */

import { describe, it, expect } from "vitest";
import {
  parseEvent,
  mapEvent,
  ALLOWED_EVENTS,
} from "./event-adapter";
import { STATIONS } from "./scene";

// ─── parseEvent — safety + allowlist ─────────────────────────────────────────

describe("parseEvent — safety (D-15, D-16)", () => {
  it("empty string → null", () => {
    expect(parseEvent("")).toBeNull();
  });

  it("malformed JSON → null (swallows SyntaxError)", () => {
    expect(parseEvent("{not json")).toBeNull();
  });

  it("valid JSON without 'event' field → null", () => {
    expect(parseEvent(JSON.stringify({ ts: "2026-04-23T00:00:00Z" }))).toBeNull();
  });

  it("valid JSON with unknown event → null (not in allowlist)", () => {
    expect(
      parseEvent(JSON.stringify({ ts: "2026-04-23T00:00:00Z", event: "unknown_event" })),
    ).toBeNull();
  });

  it("valid forge_begin event → returns the event object", () => {
    const raw = JSON.stringify({
      ts: "2026-04-23T00:00:00Z",
      event: "forge_begin",
      task_id: "p11-t1",
    });
    const result = parseEvent(raw);
    expect(result).not.toBeNull();
    expect(result!.event).toBe("forge_begin");
    expect(result!.task_id).toBe("p11-t1");
  });

  it("line > 4096 bytes → null (DoS guard D-15)", () => {
    expect(parseEvent("x".repeat(5000))).toBeNull();
  });

  it("forge_end with success:true preserves success field", () => {
    const raw = JSON.stringify({
      ts: "2026-04-23T00:00:00Z",
      event: "forge_end",
      success: true,
    });
    const result = parseEvent(raw);
    expect(result).not.toBeNull();
    expect(result!.success).toBe(true);
  });

  it("null input → null (never throws)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseEvent(null as any)).toBeNull();
  });

  it("undefined input → null (never throws)", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(parseEvent(undefined as any)).toBeNull();
  });
});

describe("ALLOWED_EVENTS — 9-entry allowlist (D-08 + Wave 1.5 F3 heartbeat)", () => {
  const expected = [
    "forge_begin",
    "forge_end",
    "forge_slot_acquired",
    "forge_slot_released",
    "sentinel_json_failure",
    "sentinel_fallback_triggered",
    "escalate_to_phantom",
    "halt",
    "heartbeat",
  ];

  it("has exactly 9 entries", () => {
    expect(ALLOWED_EVENTS).toHaveLength(9);
  });

  for (const ev of expected) {
    it(`includes '${ev}'`, () => {
      expect(ALLOWED_EVENTS).toContain(ev);
    });
  }
});

// ─── mapEvent — synthesis rules (D-08) ───────────────────────────────────────

describe("mapEvent — synthesis (D-08)", () => {
  const opts = { reducedMotion: false };

  it("forge_begin → pulse at forge + status active", () => {
    const e = parseEvent(
      JSON.stringify({ ts: "2026-04-23T00:00:00Z", event: "forge_begin" }),
    )!;
    const results = mapEvent(e, opts);
    const effect = results.find((r) => r.kind === "effect" && r.effect.kind === "pulse");
    expect(effect).toBeDefined();
    expect((effect as { kind: "effect"; effect: { atTx: number; atTy: number } }).effect.atTx).toBe(
      STATIONS.forge.tx,
    );
    expect((effect as { kind: "effect"; effect: { atTx: number; atTy: number } }).effect.atTy).toBe(
      STATIONS.forge.ty,
    );
    const status = results.find((r) => r.kind === "status");
    expect(status).toBeDefined();
    expect((status as { kind: "status"; station: string; status: string }).station).toBe("forge");
    expect((status as { kind: "status"; station: string; status: string }).status).toBe("active");
  });

  it("forge_end success=true → fireworks at hub + status idle for forge", () => {
    const e = parseEvent(
      JSON.stringify({ ts: "2026-04-23T00:00:00Z", event: "forge_end", success: true }),
    )!;
    const results = mapEvent(e, opts);
    const fireworks = results.find(
      (r) => r.kind === "effect" && r.effect.kind === "fireworks",
    );
    expect(fireworks).toBeDefined();
    expect(
      (fireworks as { kind: "effect"; effect: { atTx: number; atTy: number } }).effect.atTx,
    ).toBe(STATIONS.hub.tx);
    const status = results.find((r) => r.kind === "status");
    expect(status).toBeDefined();
    expect((status as { kind: "status"; station: string; status: string }).station).toBe("forge");
    expect((status as { kind: "status"; station: string; status: string }).status).toBe("idle");
  });

  it("forge_end success=false → redX at forge + status warning", () => {
    const e = parseEvent(
      JSON.stringify({ ts: "2026-04-23T00:00:00Z", event: "forge_end", success: false }),
    )!;
    const results = mapEvent(e, opts);
    const redX = results.find((r) => r.kind === "effect" && r.effect.kind === "redX");
    expect(redX).toBeDefined();
    expect(
      (redX as { kind: "effect"; effect: { atTx: number; atTy: number } }).effect.atTx,
    ).toBe(STATIONS.forge.tx);
    const status = results.find((r) => r.kind === "status");
    expect(status).toBeDefined();
    expect((status as { kind: "status"; station: string; status: string }).status).toBe("warning");
  });

  it("sentinel_json_failure → pulse at watchtower + status warning", () => {
    const e = parseEvent(
      JSON.stringify({ ts: "2026-04-23T00:00:00Z", event: "sentinel_json_failure" }),
    )!;
    const results = mapEvent(e, opts);
    const effect = results.find((r) => r.kind === "effect" && r.effect.kind === "pulse");
    expect(effect).toBeDefined();
    expect(
      (effect as { kind: "effect"; effect: { atTx: number } }).effect.atTx,
    ).toBe(STATIONS.watchtower.tx);
    const status = results.find((r) => r.kind === "status");
    expect((status as { kind: "status"; station: string; status: string }).status).toBe("warning");
  });

  it("sentinel_fallback_triggered → alarm at watchtower + status alarm", () => {
    const e = parseEvent(
      JSON.stringify({ ts: "2026-04-23T00:00:00Z", event: "sentinel_fallback_triggered" }),
    )!;
    const results = mapEvent(e, opts);
    const alarm = results.find((r) => r.kind === "effect" && r.effect.kind === "alarm");
    expect(alarm).toBeDefined();
    expect(
      (alarm as { kind: "effect"; effect: { atTx: number } }).effect.atTx,
    ).toBe(STATIONS.watchtower.tx);
    const status = results.find((r) => r.kind === "status");
    expect((status as { kind: "status"; station: string; status: string }).status).toBe("alarm");
  });

  it("escalate_to_phantom → phantomWalk from shadow to target", () => {
    const e = parseEvent(
      JSON.stringify({ ts: "2026-04-23T00:00:00Z", event: "escalate_to_phantom" }),
    )!;
    const results = mapEvent(e, opts);
    const walk = results.find(
      (r) => r.kind === "effect" && r.effect.kind === "phantomWalk",
    );
    expect(walk).toBeDefined();
    const eff = (walk as { kind: "effect"; effect: { fromTx: number; fromTy: number; ttl: number } }).effect;
    expect(eff.fromTx).toBe(STATIONS.shadow.tx);
    expect(eff.fromTy).toBe(STATIONS.shadow.ty);
    expect(eff.ttl).toBeGreaterThan(0);
  });

  it("halt → alarm at hub", () => {
    const e = parseEvent(
      JSON.stringify({ ts: "2026-04-23T00:00:00Z", event: "halt" }),
    )!;
    const results = mapEvent(e, opts);
    const alarm = results.find((r) => r.kind === "effect" && r.effect.kind === "alarm");
    expect(alarm).toBeDefined();
    expect(
      (alarm as { kind: "effect"; effect: { atTx: number } }).effect.atTx,
    ).toBe(STATIONS.hub.tx);
  });

  it("forge_slot_acquired → [] (valid event, no scene change — NOT null)", () => {
    const e = parseEvent(
      JSON.stringify({ ts: "2026-04-23T00:00:00Z", event: "forge_slot_acquired" }),
    )!;
    expect(mapEvent(e, opts)).toEqual([]);
  });

  it("forge_slot_released → []", () => {
    const e = parseEvent(
      JSON.stringify({ ts: "2026-04-23T00:00:00Z", event: "forge_slot_released" }),
    )!;
    expect(mapEvent(e, opts)).toEqual([]);
  });

  // ─── F3 (Wave 1.5): heartbeat synthesis ─────────────────────────────────
  it("heartbeat → subtle pulse at hub, NO station status change", () => {
    const e = parseEvent(
      JSON.stringify({
        ts: "2026-04-23T00:00:00Z",
        event: "heartbeat",
        source: "heartbeat-emitter",
      }),
    )!;
    const results = mapEvent(e, opts);
    const pulse = results.find((r) => r.kind === "effect" && r.effect.kind === "pulse");
    expect(pulse).toBeDefined();
    expect((pulse as { kind: "effect"; effect: { atTx: number; atTy: number } }).effect.atTx).toBe(
      STATIONS.hub.tx,
    );
    expect((pulse as { kind: "effect"; effect: { atTx: number; atTy: number } }).effect.atTy).toBe(
      STATIONS.hub.ty,
    );
    // No status entry — heartbeats must NOT change station status
    const status = results.find((r) => r.kind === "status");
    expect(status).toBeUndefined();
  });

  it("heartbeat ttl is short (< regular pulse) so it doesn't dominate", () => {
    const e = parseEvent(
      JSON.stringify({ ts: "2026-04-23T00:00:00Z", event: "heartbeat" }),
    )!;
    const results = mapEvent(e, opts);
    const pulse = results.find((r) => r.kind === "effect");
    expect(pulse).toBeDefined();
    const ttl = (pulse as { kind: "effect"; effect: { ttl: number } }).effect.ttl;
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThan(2.0); // pulse TTL = 2.0s; heartbeat must be shorter
  });
});

// ─── mapEvent — reduced-motion gate (D-13) ────────────────────────────────────

describe("mapEvent — reducedMotion=true (D-13)", () => {
  const opts = { reducedMotion: true };

  it("forge_begin reducedMotion=true → no effect entries, only status entries", () => {
    const e = parseEvent(
      JSON.stringify({ ts: "2026-04-23T00:00:00Z", event: "forge_begin" }),
    )!;
    const results = mapEvent(e, opts);
    expect(results.every((r) => r.kind === "status")).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it("forge_end success=true reducedMotion=true → no fireworks, only status forge:idle", () => {
    const e = parseEvent(
      JSON.stringify({ ts: "2026-04-23T00:00:00Z", event: "forge_end", success: true }),
    )!;
    const results = mapEvent(e, opts);
    const hasFireworks = results.some(
      (r) => r.kind === "effect" && r.effect.kind === "fireworks",
    );
    expect(hasFireworks).toBe(false);
    const status = results.find((r) => r.kind === "status");
    expect(status).toBeDefined();
    expect((status as { kind: "status"; station: string; status: string }).station).toBe("forge");
    expect((status as { kind: "status"; station: string; status: string }).status).toBe("idle");
  });

  it("halt reducedMotion=true → no alarm effect entries", () => {
    const e = parseEvent(
      JSON.stringify({ ts: "2026-04-23T00:00:00Z", event: "halt" }),
    )!;
    const results = mapEvent(e, opts);
    const hasEffect = results.some((r) => r.kind === "effect");
    expect(hasEffect).toBe(false);
  });

  it("sentinel_fallback_triggered reducedMotion=true → only status entries", () => {
    const e = parseEvent(
      JSON.stringify({ ts: "2026-04-23T00:00:00Z", event: "sentinel_fallback_triggered" }),
    )!;
    const results = mapEvent(e, opts);
    expect(results.every((r) => r.kind === "status")).toBe(true);
  });

  it("heartbeat reducedMotion=true → empty (no status either, since heartbeats only emit pulses)", () => {
    const e = parseEvent(
      JSON.stringify({ ts: "2026-04-23T00:00:00Z", event: "heartbeat" }),
    )!;
    const results = mapEvent(e, opts);
    // Heartbeats emit only a pulse effect; reduced-motion strips that, leaving []
    expect(results).toEqual([]);
  });
});
