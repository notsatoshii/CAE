import type { PaletteItem } from "./types";
import { PALETTE_GROUP_ORDER } from "./types";
import type { PaletteSourceContext } from "./index-sources";
import {
  fetchProjectItems,
  fetchTaskItems,
  fetchAgentItems,
  fetchWorkflowItems,
  fetchMemoryItems,
  staticCommandItems,
} from "./index-sources";
import { buildStaticCommands } from "./actions";

export interface BuildIndexToggles {
  toggleExplain: () => void;
  toggleDev: () => void;
  openShortcuts: () => void;
}

// Group name for console.warn messages (index matches the sources array below)
const SOURCE_GROUP_NAMES = [
  "projects",
  "tasks",
  "agents",
  "workflows",
  "memory",
] as const;

/**
 * 5-source Promise.allSettled over the fetch sources + appended static commands.
 * Rejected sources are logged to console.warn and omitted — palette still renders.
 * Return order follows PALETTE_GROUP_ORDER (projects → commands).
 */
export async function buildPaletteIndex(
  ctx: PaletteSourceContext,
  toggles: BuildIndexToggles,
): Promise<PaletteItem[]> {
  const sources = [
    fetchProjectItems,
    fetchTaskItems,
    fetchAgentItems,
    fetchWorkflowItems,
    fetchMemoryItems,
  ];

  const settled = await Promise.allSettled(sources.map((fn) => fn(ctx)));

  const groupedByName = new Map<string, PaletteItem[]>();

  settled.forEach((res, i) => {
    const groupName = SOURCE_GROUP_NAMES[i];
    if (res.status === "fulfilled") {
      groupedByName.set(groupName, res.value);
    } else {
      console.warn(
        `[palette] source "${groupName}" failed:`,
        res.reason,
      );
      groupedByName.set(groupName, []);
    }
  });

  // Static commands (always appended, uses full toggles)
  const commands = buildStaticCommands(ctx, toggles);
  groupedByName.set("commands", commands);

  // Assemble in PALETTE_GROUP_ORDER
  const ordered: PaletteItem[] = [];
  for (const key of PALETTE_GROUP_ORDER) {
    const g = groupedByName.get(key);
    if (g) ordered.push(...g);
  }

  // de-dup by id (last writer wins)
  const byId = new Map<string, PaletteItem>();
  for (const item of ordered) {
    byId.set(item.id, item);
  }

  return Array.from(byId.values());
}
