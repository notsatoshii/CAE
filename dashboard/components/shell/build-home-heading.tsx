"use client";

import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";

interface Props {
  projectName: string;
  className?: string;
}

export function BuildHomeHeading({ projectName, className }: Props) {
  const { dev } = useDevMode();
  const t = labelFor(dev);
  // Class 5F: page-title tier. Keeps the `data-testid` selector the existing
  // tests rely on; swaps the ad-hoc Tailwind string for the shared type-hero
  // utility so every top-level heading ships the same cadence.
  return (
    <h1
      data-testid="build-home-heading"
      className={className ?? "type-hero"}
    >
      {t.buildHomeHeading(projectName)}
    </h1>
  );
}
