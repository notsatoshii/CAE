/**
 * StationStatus + Effect union types + the step() RAF-tick reducer.
 *
 * step() is called every animation frame with dt (delta-time in seconds).
 * It mutates the scene in-place: decrements ttl on all active effects and
 * removes any whose ttl has reached 0 or below.
 *
 * When scene.paused === true, step() is a no-op (respects user-pause control).
 */

import type { Scene } from "./scene";

/** Visual status of a station — drives color tint in the renderer (D-13). */
export type StationStatus = "idle" | "active" | "warning" | "alarm";

/** Ephemeral visual effects spawned by events. Each carries a ttl in seconds. */
export type Effect =
  | { kind: "fireworks"; atTx: number; atTy: number; ttl: number }
  | { kind: "redX"; atTx: number; atTy: number; ttl: number }
  | { kind: "pulse"; atTx: number; atTy: number; ttl: number }
  | { kind: "alarm"; atTx: number; atTy: number; ttl: number }
  | {
      kind: "phantomWalk";
      fromTx: number;
      fromTy: number;
      toTx: number;
      toTy: number;
      ttl: number;
    };

/**
 * MappedEffect — what event-adapter.ts returns before ttl is filled in.
 * The canvas glue converts these to concrete Effects by assigning ttl values.
 */
export type MappedEffect =
  | { kind: "effect"; effect: Effect }
  | { kind: "status"; station: import("./scene").StationName; status: StationStatus }
  | { kind: "agent_spawn"; taskId: string; atStation: import("./scene").StationName }
  | { kind: "agent_travel"; taskId: string; toStation: import("./scene").StationName }
  | { kind: "agent_remove"; taskId: string };

/** Seconds for an agent to traverse one leg (source → target station). */
export const AGENT_TRAVEL_SEC = 2.0;
/** Max concurrent pixel agents; bounds memory + canvas cost. */
export const AGENT_CAP = 24;

/**
 * Apply one RAF tick to the scene.
 *
 * - If scene.paused, returns immediately (no mutations).
 * - If dt === 0, returns immediately (no-op).
 * - Decrements ttl on every effect by dt.
 * - Filters out any effect whose ttl <= 0 after decrement.
 * - Advances traveling pixel agents; interpolates tx/ty; removes on arrival.
 */
export function step(scene: Scene, dt: number): void {
  if (scene.paused || dt === 0) return;

  for (const effect of scene.effects) {
    effect.ttl -= dt;
  }

  let i = scene.effects.length;
  while (i-- > 0) {
    if (scene.effects[i].ttl <= 0) {
      scene.effects.splice(i, 1);
    }
  }

  const agents = scene.agents ?? [];
  let j = agents.length;
  while (j-- > 0) {
    const ag = agents[j];
    if (ag.phase !== "traveling") continue;
    ag.progress += dt / AGENT_TRAVEL_SEC;
    if (ag.progress >= 1) {
      agents.splice(j, 1);
    }
  }

  if (agents.length > AGENT_CAP) {
    agents.splice(0, agents.length - AGENT_CAP);
  }
}
