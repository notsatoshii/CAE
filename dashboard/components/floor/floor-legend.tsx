"use client";

/**
 * FloorLegend — Explain-mode a11y fallback per D-13 + P11-07.
 *
 * Shows one row per station: a colored swatch matching the renderer's
 * STATUS_FILL palette + the founder/dev label from labelFor(dev).floorStation*.
 *
 * Rendered BY the page shell when Explain mode is ON (Plan 04 wires this in).
 * This component is purely presentational — it does not read Explain state itself.
 *
 * Color swatches use the same hardcoded token palette as renderer.ts:
 * - All 10 stations default to idle → surface color (#121214)
 * - The swatch represents the default station appearance, not live status.
 *
 * No dollar signs in this file (lint-no-dollar.sh guard).
 */

import React from "react";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";

// ---------------------------------------------------------------------------
// Station swatch config — same token palette as renderer.ts (D-09)
// ---------------------------------------------------------------------------

const SURFACE = "#121214";
const ACCENT = "#00d4ff";
const PHANTOM = "#8b5cf6";

interface StationEntry {
  labelKey:
    | "floorStationHub"
    | "floorStationForge"
    | "floorStationWatchtower"
    | "floorStationOverlook"
    | "floorStationLibrary"
    | "floorStationShadow"
    | "floorStationArmory"
    | "floorStationDrafting"
    | "floorStationPulpit"
    | "floorStationLoadingBay";
  color: string;
}

const STATIONS: StationEntry[] = [
  { labelKey: "floorStationHub", color: ACCENT },
  { labelKey: "floorStationForge", color: ACCENT },
  { labelKey: "floorStationWatchtower", color: ACCENT },
  { labelKey: "floorStationOverlook", color: ACCENT },
  { labelKey: "floorStationLibrary", color: ACCENT },
  { labelKey: "floorStationShadow", color: PHANTOM },
  { labelKey: "floorStationArmory", color: SURFACE },
  { labelKey: "floorStationDrafting", color: SURFACE },
  { labelKey: "floorStationPulpit", color: ACCENT },
  { labelKey: "floorStationLoadingBay", color: SURFACE },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Legend — a11y fallback. Shows 10 station rows: swatch + label.
 * Visible whenever Explain mode is ON (Plan 04 controls visibility).
 */
export function FloorLegend(): React.JSX.Element {
  const { dev } = useDevMode();
  const L = labelFor(dev);

  return (
    <ul className="flex flex-col gap-1 text-sm">
      {STATIONS.map(({ labelKey, color }) => (
        <li key={labelKey} className="flex items-center gap-2">
          <span
            data-testid="floor-legend-swatch"
            style={{ background: color }}
            className="inline-block h-3 w-3 flex-shrink-0 rounded-sm border border-[color:var(--border)]"
            role="presentation"
            aria-hidden="true"
          />
          <span className="text-[color:var(--text-muted)]">
            {L[labelKey]}
          </span>
        </li>
      ))}
    </ul>
  );
}
