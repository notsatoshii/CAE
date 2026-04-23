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
  {
    // C2 fix-wave Class 7 — Eric: "current left side tab and other icons have
    // no labels… there should be minimizable menu but there currently isn't."
    // VSCode convention: Cmd/Ctrl + \ hides the side bar.
    id: "rail.toggle",
    keys: ["⌘", "\\"],
    area: "global",
    founderLabel: "Hide or show the left menu",
    devLabel: "Toggle sidebar collapse",
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
    // WR-01 fix: On US/UK keyboards Shift+. produces e.key === ">" not ".".
    // Register ">" so real KeyboardEvents from browsers are matched correctly.
    // The shortcut overlay renders ">" which is what the user actually presses.
    keys: ["Ctrl", "Shift", ">"],
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

/**
 * Returns true when a KeyboardEvent matches the given Keybinding.
 *
 * Convention for kb.keys:
 *   - Modifier chips: "Ctrl", "⌘", "Shift", "Alt"
 *   - Key chip (last element): the printable key, e.g. "E", "K", ".", "?", "Esc"
 *
 * Modifiers that are NOT listed in kb.keys are expected to be false on the event.
 * If the registry entry is missing a key chip (empty keys array), returns false
 * so callers never crash on a malformed entry.
 */
export function matchesKeydown(kb: Keybinding, e: KeyboardEvent): boolean {
  if (kb.keys.length === 0) return false;

  const expectedKey = kb.keys[kb.keys.length - 1].toLowerCase();
  // Normalise: browser fires "Escape" for the Esc key
  const eventKey = e.key === "Escape" ? "esc" : e.key.toLowerCase();
  if (eventKey !== expectedKey) return false;

  if (Boolean(e.ctrlKey) !== kb.keys.includes("Ctrl")) return false;
  if (Boolean(e.metaKey) !== kb.keys.includes("⌘")) return false;
  if (Boolean(e.shiftKey) !== kb.keys.includes("Shift")) return false;
  if (Boolean(e.altKey) !== kb.keys.includes("Alt")) return false;

  return true;
}
