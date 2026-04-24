/**
 * Per-agent state machine for the pixel-agents port.
 *
 * Adapted from pablodelucca/pixel-agents transcriptParser conventions (MIT —
 * see /public/pixel-agents/CREDITS.md). We keep the *lifecycle shape* from
 * upstream (spawn → walk → sit/type → walk out) but wire the transitions to
 * cae-dashboard events instead of Claude transcript JSONL.
 *
 * The state machine is a pure function of (previous agent state, incoming
 * event, current time). It does NOT touch the DOM and has no side effects,
 * so it's fully unit-testable.
 *
 * Events that drive transitions:
 *   forge_begin    — spawn a new character at the entrance walking to the desk
 *   tool_call      — switch a seated character to "typing" (or "reading" for
 *                    read-style tools) and refresh its last-activity timestamp
 *   forge_end      — start the character walking back toward the hub / out
 *   (silence > 10s while phase==="working") — character shows waiting bubble
 *
 * Why a dedicated module rather than folding into scene.ts / state.ts:
 *   The Scene.agents[] shape is SHIPPED (v0.1, commit c955f03) and consumed
 *   by Plan 11 tests. We can't mutate its fields without breaking drain/event-
 *   adapter contracts, so the per-sprite anim state (direction, animStep,
 *   lastToolCallMs, currentTool) lives in a *parallel* map keyed by taskId.
 */

import type { PixelAgent, StationName } from "./scene";
import type { AnimState, Direction } from "./pixel-agent-sprite";
import { advanceFrame } from "./pixel-agent-sprite";
import type { DeskPlacement } from "./office-layout";

// ---------------------------------------------------------------------------
// Per-agent sprite state — the fields Scene.agents[] does NOT carry.
// ---------------------------------------------------------------------------

/** Lifecycle phase of a pixel-agent sprite. */
export type SpritePhase =
  | "spawning" // walking from entrance toward desk
  | "seated" // at desk; typing/reading/idle
  | "departing"; // walking from desk back to exit

export interface SpriteAnimState {
  /** Which of the 6 character palettes to use (derived from taskId hash). */
  paletteIndex: number;
  /** Current facing direction. */
  direction: Direction;
  /** Monotonically incrementing frame step (advances while animating). */
  animStep: number;
  /** Fractional accumulator for sub-frame time. */
  animAccumulator: number;
  /** Current animation state machine value. */
  state: AnimState;
  /** Current lifecycle phase. */
  phase: SpritePhase;
  /** Epoch ms of the last tool-call tied to this taskId. */
  lastToolCallMs: number;
  /** Current tool name (from most recent tool_call) or null. */
  currentTool: string | null;
  /** Whether a waiting-for-input bubble should render above the sprite. */
  showWaitingBubble: boolean;
  /** Whether a permission-request bubble should render above the sprite. */
  showPermissionBubble: boolean;
  /** Station the sprite is bound to (where the desk is). */
  station: StationName;
}

/** Idle threshold — seated agents with no tool_call in this window get the
 *  waiting bubble. Match upstream 10_000 ms. */
export const WAITING_BUBBLE_MS = 10_000;

/** Frames/second at which the character animation advances. */
export const ANIM_FPS = 6;

// ---------------------------------------------------------------------------
// Pure helpers — no DOM, no side effects
// ---------------------------------------------------------------------------

/** Derive a deterministic 0..5 palette index from a taskId string. */
export function paletteIndexForTaskId(taskId: string): number {
  let hash = 0;
  for (let i = 0; i < taskId.length; i++) {
    hash = (hash * 31 + taskId.charCodeAt(i)) | 0;
  }
  // Absolute value modulo 6 — keep in [0,5]
  const mod = ((hash % 6) + 6) % 6;
  return mod;
}

/**
 * Initial sprite-anim state for a freshly-spawned agent.
 * `nowMs` is injected so tests don't depend on Date.now().
 */
export function createSpriteState(
  taskId: string,
  station: StationName,
  nowMs: number,
): SpriteAnimState {
  return {
    paletteIndex: paletteIndexForTaskId(taskId),
    direction: "right",
    animStep: 0,
    animAccumulator: 0,
    state: "walk",
    phase: "spawning",
    lastToolCallMs: nowMs,
    currentTool: null,
    showWaitingBubble: false,
    showPermissionBubble: false,
    station,
  };
}

/**
 * Classify a Claude tool name into an animation state. Upstream uses finer
 * categories; we group into the 3 we have sprites for plus idle.
 */
export function animStateForTool(tool: string | null): AnimState {
  if (!tool) return "idle";
  const t = tool.toLowerCase();
  if (t.includes("write") || t.includes("edit") || t === "str_replace_editor") {
    return "typing";
  }
  if (t.includes("read") || t.includes("grep") || t.includes("glob") || t === "ls") {
    return "reading";
  }
  // Bash / Task / other — treat as "typing" (thinking/executing) rather than
  // idle so the sprite stays animated and the scene feels alive.
  return "typing";
}

/**
 * Apply a tool_call event to an existing sprite state.
 * Pure — returns a new state; does NOT mutate `prev`.
 */
export function applyToolCall(
  prev: SpriteAnimState,
  tool: string,
  nowMs: number,
): SpriteAnimState {
  return {
    ...prev,
    state: prev.phase === "seated" ? animStateForTool(tool) : prev.state,
    currentTool: tool,
    lastToolCallMs: nowMs,
    showWaitingBubble: false,
    showPermissionBubble: false,
  };
}

/**
 * Mark a sprite as having arrived at its desk (called when the PixelAgent
 * travel progress hits 1 for phase=spawning). Transitions to seated/idle.
 */
export function applyArrivedAtDesk(prev: SpriteAnimState): SpriteAnimState {
  return {
    ...prev,
    phase: "seated",
    state: animStateForTool(prev.currentTool),
    direction: "up",
    animStep: 0,
    animAccumulator: 0,
  };
}

/**
 * Apply a forge_end for this taskId. Character starts walking toward exit.
 */
export function applyDeparting(prev: SpriteAnimState): SpriteAnimState {
  return {
    ...prev,
    phase: "departing",
    state: "walk",
    direction: "down",
    animStep: 0,
    animAccumulator: 0,
    showWaitingBubble: false,
    showPermissionBubble: false,
  };
}

/**
 * Advance one RAF tick for a sprite. Updates animStep/accumulator based on
 * dt seconds and the sprite's current state, and recomputes derived flags
 * (waiting-bubble if lastToolCall is too old).
 *
 * Pure — returns a new state; does NOT mutate `prev`.
 */
export function tickSprite(
  prev: SpriteAnimState,
  dt: number,
  nowMs: number,
): SpriteAnimState {
  const { step, accumulator } = advanceFrame(
    prev.animStep,
    prev.animAccumulator,
    dt,
    ANIM_FPS,
  );
  const idleTooLong =
    prev.phase === "seated" &&
    nowMs - prev.lastToolCallMs >= WAITING_BUBBLE_MS;
  return {
    ...prev,
    animStep: step,
    animAccumulator: accumulator,
    showWaitingBubble: idleTooLong && !prev.showPermissionBubble,
  };
}

/**
 * Derive the current facing direction for a TRAVELING agent by comparing
 * its current (tx, ty) against its target (targetTx, targetTy).
 */
export function facingForTravel(
  fromTx: number,
  fromTy: number,
  toTx: number,
  toTy: number,
): Direction {
  const dx = toTx - fromTx;
  const dy = toTy - fromTy;
  // Prefer the dominant axis; ties go to horizontal.
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "down" : "up";
}

/**
 * Given a PixelAgent and its sprite-anim companion, reconcile the anim state
 * so that:
 *  - a "traveling" PixelAgent (v0.1) maps to phase=spawning/departing + walk
 *  - a "working" PixelAgent with no progress maps to seated + current-tool
 *    anim
 *  - arrival transitions are idempotent
 *
 * This is the glue that lets the v0.1 Scene.agents[] API stay compatible
 * with the new sprite renderer.
 */
export function reconcilePhase(
  agent: PixelAgent,
  sprite: SpriteAnimState,
): SpriteAnimState {
  // v0.1 contract: PixelAgent.phase is "working" | "traveling".
  // - "working" at spawn station → seated
  // - "traveling" on initial spawn (progress 0 → 1, source==dest) is impossible
  //   in v0.1; traveling always fires on forge_end, so treat as departing.
  if (agent.phase === "traveling") {
    // Only flip to departing if we weren't already
    if (sprite.phase !== "departing") {
      return {
        ...sprite,
        phase: "departing",
        state: "walk",
        direction: facingForTravel(
          agent.tx,
          agent.ty,
          agent.targetTx,
          agent.targetTy,
        ),
      };
    }
    return sprite;
  }
  // agent.phase === "working" — make sure we're seated.
  if (sprite.phase !== "seated") {
    return applyArrivedAtDesk(sprite);
  }
  return sprite;
}

// ---------------------------------------------------------------------------
// Sprite registry — module-level map keyed by taskId.
// ---------------------------------------------------------------------------

/**
 * Map keyed by taskId. The renderer reads from this every frame; the
 * event-driven spawn/tool_call/departure code writes to it. Kept as an
 * exported Map (not a singleton class) so tests can freely reset it.
 */
export type SpriteRegistry = Map<string, SpriteAnimState>;

/** Create a fresh empty registry. */
export function createSpriteRegistry(): SpriteRegistry {
  return new Map();
}

/**
 * Ensure a sprite-anim record exists for the given taskId. Returns the
 * existing record if present, otherwise creates a new spawning record.
 * Mutates the registry in place.
 */
export function ensureSprite(
  registry: SpriteRegistry,
  taskId: string,
  station: StationName,
  nowMs: number,
): SpriteAnimState {
  const existing = registry.get(taskId);
  if (existing) return existing;
  const fresh = createSpriteState(taskId, station, nowMs);
  registry.set(taskId, fresh);
  return fresh;
}

/** Remove a sprite record (called after the agent walks out). */
export function removeSprite(
  registry: SpriteRegistry,
  taskId: string,
): void {
  registry.delete(taskId);
}
