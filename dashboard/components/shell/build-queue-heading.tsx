"use client";

import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";

interface Props {
  className?: string;
}

export function BuildQueueHeading({ className }: Props) {
  const { dev } = useDevMode();
  const t = labelFor(dev);
  // Class 5F: page-title tier.
  return (
    <h1
      data-testid="build-queue-heading"
      className={className ?? "type-hero"}
    >
      {t.queueHeading}
    </h1>
  );
}
