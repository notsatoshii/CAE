"use client";

/**
 * StatusPill primitive — Phase 15 Wave 2.9.
 *
 * Single source of truth for the small status pills sprinkled across the
 * dashboard (queue cards, agent cards, recent ledger, audit table, etc).
 *
 * Variants map to semantic colour tokens already defined in globals.css:
 *
 *   variant      dot colour            label tone
 *   --------------------------------------------------------
 *   idle         --text-dim            muted (resting state)
 *   running      --accent              accent (live / in-progress)
 *   waiting      --warning             warning (queued / pending)
 *   done         --success             success (shipped / passed)
 *   failed       --danger              danger (errored / aborted)
 *   warning      --warning             warning (degraded but not failed)
 *   offline      --text-muted          muted (no recent activity)
 *
 * Output shape: a small rounded-full pill with a 6×6 dot + uppercase label
 * in tracking-wide text-[11px]. Border + tinted background (10% opacity
 * via `/10`) on coloured variants give the pill enough contrast in dark
 * mode without overwhelming the row it lives on.
 *
 * Tests live in status-pill.test.tsx and snapshot every variant.
 */

import { Circle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusPillVariant =
  | "idle"
  | "running"
  | "waiting"
  | "done"
  | "failed"
  | "warning"
  | "offline";

export interface StatusPillProps {
  /** Semantic state. Drives dot colour + tinted background + border. */
  variant: StatusPillVariant;
  /**
   * Optional override for the visible label. Defaults to a verb derived
   * from the variant (e.g. "Running"). Pass to localise or shorten.
   */
  label?: ReactNode;
  /** Extra Tailwind classes merged onto the root pill. */
  className?: string;
  /** data-testid for vitest queries. Default: "status-pill". */
  testId?: string;
}

interface VariantDescriptor {
  defaultLabel: string;
  /** CSS variable name (without `var(...)` wrapper) for the dot fill. */
  colourVar: string;
}

const VARIANTS: Record<StatusPillVariant, VariantDescriptor> = {
  idle:    { defaultLabel: "Idle",    colourVar: "--text-dim"    },
  running: { defaultLabel: "Running", colourVar: "--accent"      },
  waiting: { defaultLabel: "Waiting", colourVar: "--warning"     },
  done:    { defaultLabel: "Done",    colourVar: "--success"     },
  failed:  { defaultLabel: "Failed",  colourVar: "--danger"      },
  warning: { defaultLabel: "Warning", colourVar: "--warning"     },
  offline: { defaultLabel: "Offline", colourVar: "--text-muted"  },
};

export function StatusPill({
  variant,
  label,
  className,
  testId = "status-pill",
}: StatusPillProps) {
  const v = VARIANTS[variant];
  const display = label ?? v.defaultLabel;

  return (
    <span
      data-testid={testId}
      data-variant={variant}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5",
        "text-[11px] font-medium uppercase tracking-wide",
        className,
      )}
      style={{
        // Coloured variants get a 10% tinted background + matching border so
        // the pill reads as a status indicator (not just text). The dot itself
        // uses the full-strength colour for emphasis.
        backgroundColor: `color-mix(in oklch, var(${v.colourVar}) 10%, transparent)`,
        borderColor: `color-mix(in oklch, var(${v.colourVar}) 30%, transparent)`,
        color: `var(${v.colourVar})`,
      }}
    >
      <Circle
        size={6}
        aria-hidden="true"
        className="fill-current"
        data-testid={`${testId}-dot`}
      />
      <span data-testid={`${testId}-label`}>{display}</span>
    </span>
  );
}
