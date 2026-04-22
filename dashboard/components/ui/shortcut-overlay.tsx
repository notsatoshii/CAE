"use client";

import React from "react";
import { HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useShortcutOverlay } from "@/lib/hooks/use-shortcut-overlay";
import { useExplainMode } from "@/lib/providers/explain-mode";
import { useDevMode } from "@/lib/providers/dev-mode";
import { KEYBINDINGS, keybindingsByArea, type Keybinding } from "@/lib/keybindings";

const AREAS: Keybinding["area"][] = ["global", "palette", "sheets", "task"];

const AREA_LABEL: Record<Keybinding["area"], { founder: string; dev: string }> =
  {
    global: { founder: "Everywhere", dev: "Global" },
    palette: { founder: "In the jump-to palette", dev: "Palette" },
    sheets: { founder: "Side panels & drawers", dev: "Sheets / drawers" },
    task: { founder: "While a job is running", dev: "Task actions" },
  };

function labelFor(k: Keybinding, founderMode: boolean) {
  return founderMode ? k.founderLabel : k.devLabel;
}

const TITLE_ID = "shortcut-overlay-title";

export function ShortcutOverlay(): React.JSX.Element | null {
  const { open, setOpen } = useShortcutOverlay();
  const { explain } = useExplainMode();
  const { dev } = useDevMode();

  // Founder-first (D-15): founder copy unless DevMode ON AND ExplainMode OFF
  const founderMode = !(dev && !explain);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="sm:max-w-md"
        aria-labelledby={TITLE_ID}
      >
        <DialogTitle
          id={TITLE_ID}
          className="text-sm font-semibold"
        >
          {founderMode ? "Keyboard shortcuts" : "Keybindings"}
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          {founderMode
            ? "Hit any of these from anywhere."
            : "Registered via lib/keybindings.ts"}
        </DialogDescription>
        <div className="mt-2 space-y-4">
          {AREAS.map((area) => {
            const items = keybindingsByArea(area);
            if (!items.length) return null;
            const areaLabel = AREA_LABEL[area][founderMode ? "founder" : "dev"];
            return (
              <section key={area} aria-label={areaLabel}>
                <h4 className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {areaLabel}
                </h4>
                <ul className="space-y-1">
                  {items.map((k) => (
                    <li
                      key={k.id}
                      className="flex items-center justify-between gap-4 py-1"
                    >
                      <span className="text-sm">{labelFor(k, founderMode)}</span>
                      <span className="flex items-center gap-1">
                        {k.keys.map((chip, i) => (
                          <kbd
                            key={i}
                            className={cn(
                              "rounded border border-border bg-muted px-1.5 py-0.5",
                              "font-mono text-[10px] text-foreground",
                            )}
                          >
                            {chip}
                          </kbd>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ShortcutHelpButton(): React.JSX.Element {
  const { toggle } = useShortcutOverlay();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Open keyboard shortcuts"
      className={cn(
        "inline-flex size-6 items-center justify-center rounded",
        "text-muted-foreground hover:text-foreground hover:bg-accent",
        "focus-visible:outline-2 focus-visible:outline-ring",
      )}
      data-testid="shortcut-help-button"
    >
      <HelpCircle className="size-4" aria-hidden="true" />
    </button>
  );
}

// Re-export for convenience (avoids separate import of KEYBINDINGS in overlay consumers)
export { KEYBINDINGS };
