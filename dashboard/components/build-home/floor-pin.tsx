"use client";

/**
 * FloorPin — pinned-widget wrapper around FloorClient for /build home
 * right-column aside (Phase 15 Wave 3.2, E2).
 *
 * Header row: title + expand (link → /floor) + pop-out (window.open → /floor).
 * Body: scoped FloorClient sized to 320×240.
 */

import Link from "next/link";
import FloorClient from "@/components/floor/floor-client";

export interface FloorPinProps {
  cbPath: string | null;
  projectPath: string | null;
}

export function FloorPin({ cbPath, projectPath }: FloorPinProps) {
  const openPopout = () => {
    if (typeof window === "undefined") return;
    window.open(
      "/floor?popout=1",
      "cae-floor",
      "width=960,height=720,menubar=no,toolbar=no",
    );
  };

  return (
    <section
      data-testid="floor-pin"
      aria-label="Live Floor — pinned"
      className="sticky top-6 rounded-lg border border-border bg-card overflow-hidden"
    >
      <header className="flex items-center justify-between px-3 py-2 border-b border-border text-xs">
        <Link
          href="/floor"
          className="font-medium hover:underline"
          data-testid="floor-pin-expand"
        >
          Live Floor
        </Link>
        <button
          type="button"
          onClick={openPopout}
          data-testid="floor-pin-popout"
          className="text-muted hover:text-foreground"
          aria-label="Open Live Floor in a new window"
        >
          ⧉
        </button>
      </header>
      <div style={{ height: 240, width: "100%" }}>
        <FloorClient cbPath={cbPath} projectPath={projectPath} popout={false} />
      </div>
    </section>
  );
}

export default FloorPin;
