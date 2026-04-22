import type { LucideIcon } from "lucide-react";

export type PaletteGroupKey =
  | "projects"
  | "tasks"
  | "agents"
  | "workflows"
  | "memory"
  | "commands";

/** D-05 render order; also the map for empty-state default group rendering. */
export const PALETTE_GROUP_ORDER: readonly PaletteGroupKey[] = [
  "projects",
  "tasks",
  "agents",
  "workflows",
  "memory",
  "commands",
] as const;

export interface PaletteItem {
  /** Stable unique id ("project:cae-dashboard", "agent:forge", ...). */
  readonly id: string;
  readonly group: PaletteGroupKey;
  /** Primary display string — founder-first. */
  readonly label: string;
  /** Optional secondary one-liner; fuzzy key #2. Never undefined after build — coerce to "" in builder. */
  readonly hint: string;
  /** Optional lucide glyph. */
  readonly icon?: LucideIcon;
  /** Runs when user selects the item. MUST close the palette via the closer passed in OR no-op if navigation. */
  readonly run: () => void;
}
