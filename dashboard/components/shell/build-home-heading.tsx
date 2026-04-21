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
  return (
    <h1
      data-testid="build-home-heading"
      className={
        className ??
        "text-2xl font-semibold tracking-tight text-[color:var(--text)]"
      }
    >
      {t.buildHomeHeading(projectName)}
    </h1>
  );
}
