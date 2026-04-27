/**
 * Static station coordinate map (D-07) + createScene() factory.
 *
 * STATIONS is frozen — mutation throws in strict mode.
 * createScene() deep-copies station coords into a mutable scene object.
 *
 * Scene lives in useRef — never in React state (D-05, Pattern 2).
 */

import type { StationStatus, Effect } from "./state";

/** The 10 named stations in the CAE HQ floor plan. */
export type StationName =
  | "hub"
  | "forge"
  | "watchtower"
  | "overlook"
  | "library"
  | "shadow"
  | "armory"
  | "drafting"
  | "pulpit"
  | "loadingBay";

/** Static definition of a station (frozen in STATIONS). */
export interface StationDef {
  readonly tx: number;
  readonly ty: number;
  readonly persona:
    | "nexus"
    | "forge"
    | "sentinel"
    | "scout"
    | "scribe"
    | "phantom"
    | "aegis"
    | "arch"
    | "herald"
    | null;
}

/**
 * Frozen static map — D-07 exact coordinates on the 16×16 grid.
 * Import and read; never mutate.
 */
export const STATIONS: Readonly<Record<StationName, StationDef>> =
  Object.freeze({
    hub: Object.freeze({ tx: 8, ty: 8, persona: "nexus" as const }),
    forge: Object.freeze({ tx: 7, ty: 7, persona: "forge" as const }),
    watchtower: Object.freeze({ tx: 9, ty: 7, persona: "sentinel" as const }),
    overlook: Object.freeze({ tx: 10, ty: 8, persona: "scout" as const }),
    library: Object.freeze({ tx: 10, ty: 9, persona: "scribe" as const }),
    shadow: Object.freeze({ tx: 9, ty: 10, persona: "phantom" as const }),
    armory: Object.freeze({ tx: 7, ty: 10, persona: "aegis" as const }),
    drafting: Object.freeze({ tx: 7, ty: 9, persona: "arch" as const }),
    pulpit: Object.freeze({ tx: 9, ty: 9, persona: "herald" as const }),
    loadingBay: Object.freeze({ tx: 5, ty: 8, persona: null }),
  });

/** Entity moving through the floor (e.g. phantom walk animation). */
export interface FloorEntity {
  kind: "phantom";
  tx: number;
  ty: number;
  targetTx: number;
  targetTy: number;
  speed: number;
}

/**
 * Live pixel agent — one per in-flight forge task. Spawned on forge_begin,
 * transitions to "traveling" on forge_end, removed after reaching target.
 * Multiple agents visible simultaneously when multiple forges run.
 */
export interface PixelAgent {
  id: string;
  taskId: string;
  tx: number;
  ty: number;
  targetTx: number;
  targetTy: number;
  progress: number;
  hue: number;
  phase: "working" | "traveling";
}

/** Full mutable scene — lives in useRef, never in React state (D-05). */
export interface Scene {
  stations: Record<
    StationName,
    StationDef & { status: StationStatus }
  >;
  effects: Effect[];
  entities: FloorEntity[];
  /** Pixel agents — forge tasks rendered as colored squares traveling between stations. */
  agents: PixelAgent[];
  queueDepth: number;
  paused: boolean;
  /** ms epoch; used for loadingBay pulse-on-recent-change (D-12). */
  lastDelegationTs: number;
}

/**
 * Create a fresh mutable scene. Use as: `const sceneRef = useRef(createScene())`.
 * Two calls return distinct objects; mutating one does NOT affect the other.
 */
export function createScene(): Scene {
  const stations = {} as Record<StationName, StationDef & { status: StationStatus }>;
  for (const key of Object.keys(STATIONS) as StationName[]) {
    const def = STATIONS[key];
    stations[key] = {
      tx: def.tx,
      ty: def.ty,
      persona: def.persona,
      status: "idle",
    };
  }

  return {
    stations,
    effects: [],
    entities: [],
    agents: [],
    queueDepth: 0,
    paused: false,
    lastDelegationTs: 0,
  };
}
