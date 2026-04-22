// Phase 12 (SHO-01): single source of truth for every keystroke the dashboard
// responds to. Providers import by `id`; the shortcut overlay renders the full
// list, grouped by `area`, picking `founderLabel` when ExplainMode is on and
// `devLabel` when DevMode is on.
//
// Rule: add a binding here BEFORE wiring the keydown handler. The overlay
// surfaces it to users; missing entries are invisible to them.

export interface Keybinding {
  /** Stable identifier. Providers reference by this string. */
  readonly id: string;
  /** Key badges rendered as <kbd>. Use "⌘" for mac-cmd, "Ctrl" for ctrl, word-case for letters. */
  readonly keys: readonly string[];
  /** Grouping in the overlay. */
  readonly area: "global" | "sheets" | "task" | "palette";
  /** Plain-English sentence — shown when ExplainMode ON (default). */
  readonly founderLabel: string;
  /** Dev label — shown when DevMode ON. */
  readonly devLabel: string;
}

// Order here = order in overlay (within area).
export const KEYBINDINGS: readonly Keybinding[] = [
  // --- global ---
  {
    id: "palette.open",
    keys: ["⌘", "K"],
    area: "global",
    founderLabel: "Jump to anything",
    devLabel: "Open command palette",
  },
  {
    id: "shortcuts.open",
    keys: ["?"],
    area: "global",
    founderLabel: "See all shortcuts",
    devLabel: "Open keyboard-shortcut overlay",
  },
  {
    id: "explain.toggle",
    keys: ["Ctrl", "E"],
    area: "global",
    founderLabel: "Show or hide explanations",
    devLabel: "Toggle ExplainMode",
  },
  {
    id: "devmode.toggle",
    keys: ["⌘", "Shift", "D"],
    area: "global",
    founderLabel: "Advanced mode",
    devLabel: "Toggle DevMode",
  },
  // --- sheets / drawers ---
  {
    id: "sheet.close",
    keys: ["Esc"],
    area: "sheets",
    founderLabel: "Close the side panel",
    devLabel: "Close sheet / drawer",
  },
  // --- task (in-flight job actions) ---
  {
    id: "task.pause",
    keys: ["Ctrl", "."],
    area: "task",
    founderLabel: "Pause this job",
    devLabel: "Pause running task",
  },
  {
    id: "task.abort",
    keys: ["Ctrl", "Shift", "."],
    area: "task",
    founderLabel: "Stop this job",
    devLabel: "Abort running task",
  },
  // --- palette (once open) ---
  {
    id: "palette.navigate",
    keys: ["↑", "↓"],
    area: "palette",
    founderLabel: "Move through results",
    devLabel: "Navigate results",
  },
  {
    id: "palette.execute",
    keys: ["Enter"],
    area: "palette",
    founderLabel: "Pick this one",
    devLabel: "Execute selection",
  },
  {
    id: "palette.close",
    keys: ["Esc"],
    area: "palette",
    founderLabel: "Never mind",
    devLabel: "Dismiss palette",
  },
] as const;

/** Lookup helper. Returns `undefined` for unknown ids so callers stay type-safe. */
export function keybindingById(id: string): Keybinding | undefined {
  return KEYBINDINGS.find((k) => k.id === id);
}

/** Group for the overlay render. */
export function keybindingsByArea(area: Keybinding["area"]): readonly Keybinding[] {
  return KEYBINDINGS.filter((k) => k.area === area);
}
