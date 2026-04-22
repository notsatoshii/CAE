"use client";

/**
 * FloorPopoutHost — placeholder stub (Task 1).
 * Full implementation in Task 2.
 */

export interface FloorPopoutHostProps {
  cbPath: string | null;
  projectPath: string | null;
}

export function FloorPopoutHost({ cbPath, projectPath }: FloorPopoutHostProps) {
  return (
    <div
      data-testid="floor-popout-host"
      data-cbpath={cbPath ?? ""}
      data-projectpath={projectPath ?? ""}
    />
  );
}

export default FloorPopoutHost;
