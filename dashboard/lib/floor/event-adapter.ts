/**
 * SSE line parser + event→effect synthesizer for the Live Floor scene.
 *
 * Security contract (T-11-01, T-11-02-a, D-15, D-16):
 * - parseEvent: try/catch JSON.parse, size guard before parse, allowlist check
 * - mapEvent: exhaustive switch on allowlisted names; NEVER spreads parsed payload
 * - reducedMotion=true: filters all ephemeral effects, returns status-tint entries only
 */

import type { CbEvent } from "@/lib/cae-types";
import type { MappedEffect } from "./state";
import { STATIONS } from "./scene";

/**
 * 9-entry allowlist (D-08 + Wave 1.5 F3 heartbeat).
 * parseEvent rejects everything else.
 *
 * F3 (Wave 1.5): "heartbeat" added so the synthetic emitter
 * (scripts/heartbeat-emitter.sh, cron @30s) can keep Floor visibly alive
 * during stretches of no real GSD activity. See mapEvent for the subtle
 * hub-pulse mapping (no station status change).
 */
export const ALLOWED_EVENTS = [
  "forge_begin",
  "forge_end",
  "forge_slot_acquired",
  "forge_slot_released",
  "sentinel_json_failure",
  "sentinel_fallback_triggered",
  "escalate_to_phantom",
  "halt",
  "heartbeat",
] as const satisfies readonly string[];

/** Effect TTL values in seconds (per CONTEXT.md §Claude's Discretion). */
const TTL = {
  fireworks: 1.2,
  redX: 0.8,
  pulse: 2.0,
  alarm: 1.5,
  phantomWalk: 2.5,
  /** F3: shorter than regular pulse so heartbeats don't dominate the canvas. */
  heartbeat: 0.6,
} as const;

export interface FloorMapEventOpts {
  /** When true, returns ONLY status-tint entries — no ephemeral effect entries. (D-13) */
  reducedMotion: boolean;
}

/**
 * Safe SSE line parser.
 *
 * Returns null for:
 * - Non-string input
 * - Lines > 4096 bytes (DoS guard — D-15)
 * - Invalid JSON (SyntaxError swallowed)
 * - Parsed object missing string `.event` field
 * - `.event` not in ALLOWED_EVENTS
 * - Missing required `.ts` field
 *
 * NEVER throws. NEVER spreads parsed payload into a new object.
 */
export function parseEvent(rawLine: string): CbEvent | null {
  if (typeof rawLine !== "string") return null;
  if (rawLine.length > 4096) return null; // D-15: size cap before JSON.parse
  if (rawLine.length === 0) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawLine);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;

  // Required fields check
  if (typeof obj.ts !== "string") return null;
  if (typeof obj.event !== "string") return null;

  // Allowlist check (D-16)
  if (!(ALLOWED_EVENTS as readonly string[]).includes(obj.event)) return null;

  // Safe cast — only passes after all guards; CbEvent fields are all optional except ts + event
  return obj as unknown as CbEvent;
}

/**
 * Map a parsed CbEvent to scene actions.
 *
 * Returns [] for valid-but-no-scene-change events (forge_slot_acquired, forge_slot_released).
 * When reducedMotion=true, filters out all entries with kind === "effect" before returning.
 *
 * Implementation uses an exhaustive switch on the 9-entry allowlist — no runtime property
 * lookup against the parsed payload beyond the enumerated field set (D-16).
 */
export function mapEvent(e: CbEvent, opts: FloorMapEventOpts): MappedEffect[] {
  const full: MappedEffect[] = [];

  switch (e.event) {
    case "forge_begin":
      full.push({
        kind: "effect",
        effect: {
          kind: "pulse",
          atTx: STATIONS.forge.tx,
          atTy: STATIONS.forge.ty,
          ttl: TTL.pulse,
        },
      });
      full.push({ kind: "status", station: "forge", status: "active" });
      if (typeof e.task_id === "string" && e.task_id.length > 0) {
        full.push({ kind: "agent_spawn", taskId: e.task_id, atStation: "forge" });
      }
      break;

    case "forge_end":
      if (e.success === true) {
        full.push({
          kind: "effect",
          effect: {
            kind: "fireworks",
            atTx: STATIONS.hub.tx,
            atTy: STATIONS.hub.ty,
            ttl: TTL.fireworks,
          },
        });
        full.push({ kind: "status", station: "forge", status: "idle" });
        if (typeof e.task_id === "string" && e.task_id.length > 0) {
          full.push({ kind: "agent_travel", taskId: e.task_id, toStation: "hub" });
        }
      } else {
        full.push({
          kind: "effect",
          effect: {
            kind: "redX",
            atTx: STATIONS.forge.tx,
            atTy: STATIONS.forge.ty,
            ttl: TTL.redX,
          },
        });
        full.push({ kind: "status", station: "forge", status: "warning" });
        if (typeof e.task_id === "string" && e.task_id.length > 0) {
          full.push({ kind: "agent_travel", taskId: e.task_id, toStation: "shadow" });
        }
      }
      break;

    case "sentinel_json_failure":
      full.push({
        kind: "effect",
        effect: {
          kind: "pulse",
          atTx: STATIONS.watchtower.tx,
          atTy: STATIONS.watchtower.ty,
          ttl: TTL.pulse,
        },
      });
      full.push({ kind: "status", station: "watchtower", status: "warning" });
      break;

    case "sentinel_fallback_triggered":
      full.push({
        kind: "effect",
        effect: {
          kind: "alarm",
          atTx: STATIONS.watchtower.tx,
          atTy: STATIONS.watchtower.ty,
          ttl: TTL.alarm,
        },
      });
      full.push({ kind: "status", station: "watchtower", status: "alarm" });
      break;

    case "escalate_to_phantom":
      // Default target: forge (no task_id stream to derive real target in v1)
      full.push({
        kind: "effect",
        effect: {
          kind: "phantomWalk",
          fromTx: STATIONS.shadow.tx,
          fromTy: STATIONS.shadow.ty,
          toTx: STATIONS.forge.tx,
          toTy: STATIONS.forge.ty,
          ttl: TTL.phantomWalk,
        },
      });
      full.push({ kind: "status", station: "shadow", status: "active" });
      break;

    case "halt":
      full.push({
        kind: "effect",
        effect: {
          kind: "alarm",
          atTx: STATIONS.hub.tx,
          atTy: STATIONS.hub.ty,
          ttl: TTL.alarm,
        },
      });
      full.push({ kind: "status", station: "hub", status: "alarm" });
      break;

    case "heartbeat":
      // F3 (Wave 1.5): subtle hub pulse — keeps Floor visibly alive during
      // long stretches of no real activity. NO station status change so the
      // hub doesn't get stuck in an "active" state. Short TTL so the effect
      // fades quickly and doesn't accumulate visually under EFFECTS_CAP.
      full.push({
        kind: "effect",
        effect: {
          kind: "pulse",
          atTx: STATIONS.hub.tx,
          atTy: STATIONS.hub.ty,
          ttl: TTL.heartbeat,
        },
      });
      break;

    case "forge_slot_acquired":
    case "forge_slot_released":
      // Valid events, no scene change — return empty array (not null)
      break;

    default:
      // Unknown event past the allowlist guard — return empty (should not reach here
      // after parseEvent filtering, but defensively safe)
      break;
  }

  // D-13: reduced-motion gate — filter out all ephemeral effect entries
  if (opts.reducedMotion) {
    return full.filter((item) => item.kind !== "effect");
  }

  return full;
}
