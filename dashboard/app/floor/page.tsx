/**
 * /floor — server shell (D-10, D-11, D-17, Plan 11-04).
 *
 * Mirrors app/memory/page.tsx pattern exactly:
 *   - Auth-gated: unauthenticated users redirect to /signin?from=/floor
 *   - Reads searchParams.project (optional) + searchParams.popout (optional)
 *   - Resolves projectPath: explicit > most-recent Shift > first project > null
 *   - Passes { cbPath, projectPath, popout } to FloorClient
 *
 * Layout:
 *   - h-screen when popout=true (no top-nav chrome subtraction needed)
 *   - h-[calc(100vh-40px)] otherwise (subtracts 40px top-nav height)
 *
 * Server-only: no "use client". Zero dollar signs in this file.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { listProjects } from "@/lib/cae-state";
import { resolveCbPath } from "@/lib/floor/cb-path";
import FloorClient from "@/components/floor/floor-client";

interface PageProps {
  searchParams: { project?: string; popout?: string };
}

export default async function FloorPage({ searchParams }: PageProps) {
  // Belt-and-suspenders auth check (middleware.ts also guards this route — D-17)
  const session = await auth();
  if (!session) {
    redirect("/signin?from=/floor");
  }

  // Project resolution: explicit > most-recent Shift > first project > null (D-10)
  let projectPath: string | null = null;

  if (searchParams.project) {
    // Trust the explicit path — /api/tail enforces ALLOWED_ROOTS (T-11-04)
    projectPath = searchParams.project;
  } else {
    try {
      const projects = await listProjects();
      if (projects.length > 0) {
        // Sort Shift projects by shiftUpdated descending; fall back to first project
        const shiftProjects = projects
          .filter((p) => p.shiftUpdated)
          .sort((a, b) => (b.shiftUpdated ?? "").localeCompare(a.shiftUpdated ?? ""));
        projectPath = shiftProjects[0]?.path ?? projects[0]?.path ?? null;
      }
    } catch {
      // listProjects threw — use null (idle scene)
      projectPath = null;
    }
  }

  const cbPath = resolveCbPath(projectPath);
  const popout = searchParams.popout === "1";

  return (
    <main className={popout ? "h-screen" : "h-[calc(100vh-40px)]"}>
      <FloorClient cbPath={cbPath} projectPath={projectPath} popout={popout} />
    </main>
  );
}
