"use client";

import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";

interface Props {
  className?: string;
}

export function PlanHomeHeading({ className }: Props) {
  const { dev } = useDevMode();
  const t = labelFor(dev);
  return (
    <h1
      data-testid="plan-home-heading"
      className={
        className ??
        "text-2xl font-semibold tracking-tight text-[color:var(--text)]"
      }
    >
      {t.planHomeHeading}
    </h1>
  );
}
