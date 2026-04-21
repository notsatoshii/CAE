"use client";

import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";

interface Props {
  className?: string;
}

export function BuildQueueHeading({ className }: Props) {
  const { dev } = useDevMode();
  const t = labelFor(dev);
  return (
    <h1
      data-testid="build-queue-heading"
      className={
        className ??
        "text-2xl font-semibold tracking-tight text-[color:var(--text)]"
      }
    >
      {t.queueHeading}
    </h1>
  );
}
