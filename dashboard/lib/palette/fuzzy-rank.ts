import fuzzysort from "fuzzysort";
import type { PaletteItem } from "./types";

/**
 * Rank `items` against `query`. Empty/whitespace query returns the input array
 * unchanged (preserves source order → D-05 groups render as-is).
 * Multi-key: label (primary), hint (secondary). threshold -10000.
 */
export function rankPaletteItems(
  query: string,
  items: readonly PaletteItem[],
): readonly PaletteItem[] {
  const q = query.trim();
  if (!q) return items;
  const results = fuzzysort.go(q, items as PaletteItem[], {
    keys: ["label", "hint"],
    threshold: -10000,
  });
  return results.map((r) => r.obj);
}
