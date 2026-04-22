"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { useCommandPalette } from "@/lib/hooks/use-command-palette";
import { useShortcutOverlay } from "@/lib/hooks/use-shortcut-overlay";
import { buildPaletteIndex } from "@/lib/palette/build-index";
import { rankPaletteItems } from "@/lib/palette/fuzzy-rank";
import { PALETTE_GROUP_ORDER } from "@/lib/palette/types";
import type { PaletteItem, PaletteGroupKey } from "@/lib/palette/types";
import { useExplainMode } from "@/lib/providers/explain-mode";
import { useDevMode } from "@/lib/providers/dev-mode";
import { cn } from "@/lib/utils";

const GROUP_LABEL: Record<PaletteGroupKey, string> = {
  projects: "Projects",
  tasks: "Tasks",
  agents: "Agents",
  workflows: "Workflows",
  memory: "Memory",
  commands: "Commands",
};

export function CommandPalette(): React.JSX.Element | null {
  const { open, setOpen } = useCommandPalette();
  const { setOpen: setShortcutsOpen } = useShortcutOverlay();
  const router = useRouter();
  const { toggle: toggleExplain } = useExplainMode();
  const { toggle: toggleDev } = useDevMode();
  const [items, setItems] = useState<PaletteItem[] | null>(null);
  const [query, setQuery] = useState("");

  const close = useCallback(() => setOpen(false), [setOpen]);
  const openShortcuts = useCallback(() => {
    close();
    setShortcutsOpen(true);
  }, [close, setShortcutsOpen]);

  // Rebuild index on open
  useEffect(() => {
    if (!open) {
      // Reset query when closing
      setQuery("");
      setItems(null);
      return;
    }

    const ctx = { router, close };
    const toggles = {
      toggleExplain,
      toggleDev,
      openShortcuts,
    };

    buildPaletteIndex(ctx, toggles).then(setItems).catch(() => setItems([]));
  }, [open, router, close, toggleExplain, toggleDev, openShortcuts]);

  const filteredItems = rankPaletteItems(query, items ?? []);

  function handleValueChange(value: PaletteItem | null) {
    if (!value) return;
    value.run();
    close();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="p-0 sm:max-w-lg"
        showCloseButton={false}
        aria-label="Command palette"
      >
        <Combobox.Root
          items={items ?? []}
          filteredItems={filteredItems as PaletteItem[]}
          onValueChange={handleValueChange}
          itemToStringLabel={(item: PaletteItem) => item.label}
        >
          <div className="border-b border-border p-2">
            <Combobox.Input
              placeholder="Search or jump to…"
              autoFocus
              className={cn(
                "w-full bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground",
              )}
              onChange={(e) => setQuery(e.currentTarget.value)}
              value={query}
            />
          </div>
          <Combobox.List className="max-h-96 overflow-y-auto p-1">
            <Combobox.Empty className="p-4 text-sm text-muted-foreground">
              No matches. Try a different word.
            </Combobox.Empty>
            {PALETTE_GROUP_ORDER.map((gkey) => {
              const groupItems = filteredItems.filter((i) => i.group === gkey);
              if (!groupItems.length) return null;
              return (
                <Combobox.Group
                  key={gkey}
                  role="group"
                  aria-label={GROUP_LABEL[gkey]}
                >
                  <Combobox.GroupLabel className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {GROUP_LABEL[gkey]}
                  </Combobox.GroupLabel>
                  {groupItems.map((it) => (
                    <Combobox.Item
                      key={it.id}
                      value={it}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm",
                        "outline-none data-highlighted:bg-accent data-highlighted:text-accent-foreground",
                      )}
                    >
                      {it.icon && (
                        <it.icon aria-hidden="true" className="size-4 shrink-0" />
                      )}
                      <span className="flex-1 truncate">{it.label}</span>
                      {it.hint && (
                        <span className="ml-auto truncate text-xs text-muted-foreground">
                          {it.hint}
                        </span>
                      )}
                    </Combobox.Item>
                  ))}
                </Combobox.Group>
              );
            })}
          </Combobox.List>
        </Combobox.Root>
      </DialogContent>
    </Dialog>
  );
}
