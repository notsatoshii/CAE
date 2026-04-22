"use client";

/**
 * Per-agent success-rate gauge (Phase 7 Reliability panel).
 *
 * Uses `@base-ui/react` Meter primitive — an unstyled, accessible meter with
 * Root / Label / Track / Indicator / Value composable parts. base-ui does NOT
 * support `asChild` (AGENTS.md p2-plA-t1-e81f6c) so we style via className.
 *
 * Thresholds (UI-SPEC §13 + 07-RESEARCH §Example 2):
 *   rate >= 0.85 → green
 *   rate >= 0.70 → yellow
 *   else         → red
 *
 * Insufficient-samples gate: when sampleN < 5 we render a small non-gauge card
 * with the "not enough jobs yet" copy. Aggregator emits sample_n for every
 * agent (even sample_n=0); the UI decides the policy, not the data layer.
 *
 * Meter.Value note: base-ui's Meter.Value `children` must be a render-prop
 * function `(formattedValue, value) => ReactNode` (or null) — not a raw string.
 * We pass our own formatted string via the render prop.
 */

import { Meter } from "@base-ui/react/meter";
import { labelFor } from "@/lib/copy/labels";
import { useDevMode } from "@/lib/providers/dev-mode";

interface Props {
  rate: number;         // 0..1
  sampleN: number;
  founderLabel: string; // e.g. "the builder"
  label: string;        // e.g. "Forge"
}

const MIN_SAMPLES = 5;

export function SuccessGauge({ rate, sampleN, founderLabel, label }: Props) {
  const { dev } = useDevMode();
  const L = labelFor(dev);
  const shown = dev ? label : founderLabel;

  if (sampleN < MIN_SAMPLES) {
    return (
      <div
        data-testid={"success-gauge-insufficient-" + label.toLowerCase()}
        className="flex flex-col gap-1 rounded-md bg-[color:var(--surface)] p-3"
      >
        <span className="text-xs text-[color:var(--text-muted)]">{shown}</span>
        <span className="text-xs italic text-[color:var(--text-dim)]">
          {L.metricsWellAgentInsufficientSamples}
        </span>
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, rate * 100));
  const color =
    rate >= 0.85 ? "var(--success, #22c55e)" :
    rate >= 0.70 ? "var(--warning, #eab308)" :
                   "var(--danger, #ef4444)";

  return (
    <Meter.Root
      value={pct}
      data-testid={"success-gauge-" + label.toLowerCase()}
      className="flex flex-col gap-1 rounded-md bg-[color:var(--surface)] p-3"
    >
      <Meter.Label className="text-xs text-[color:var(--text-muted)]">
        {shown}
      </Meter.Label>
      <Meter.Track className="relative h-2 w-full overflow-hidden rounded bg-[color:var(--surface-hover)]">
        <Meter.Indicator
          className="block h-full rounded"
          style={{ background: color, width: pct + "%" }}
        />
      </Meter.Track>
      <Meter.Value className="font-mono text-xs text-[color:var(--text)]">
        {() => L.metricsWellAgentGaugeLabel(shown, rate)}
      </Meter.Value>
    </Meter.Root>
  );
}
