"use client";

import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";

interface Props {
  phaseNumber: number;
  phaseName: string;
  className?: string;
}

export function PhaseDetailHeading({ phaseNumber, phaseName, className }: Props) {
  const { dev } = useDevMode();
  const t = labelFor(dev);
  return (
    <h1
      data-testid="phase-detail-heading"
      className={
        className ??
        "text-2xl font-semibold tracking-tight text-[color:var(--text)]"
      }
    >
      {t.phaseDetailHeading(phaseNumber, phaseName)}
    </h1>
  );
}
