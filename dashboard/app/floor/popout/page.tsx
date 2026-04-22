/**
 * /floor/popout — dedicated pop-out window route (Plan 11-05, Task 1).
 *
 * Mirrors app/floor/page.tsx with these differences:
 *   (a) ALWAYS mounts FloorPopoutHost (forced popout=true internally)
 *   (b) Project resolved strictly from searchParams.project (D-10 — pop-out pins
 *       to the project it opened from); falls back to most-recent Shift project
 *       so the URL is still bookmarkable/typeable directly
 *   (c) Emits a route-scoped <style> that hides the TopNav chrome via display:none
 *       (Option C from Q1 — pragmatic, reversible, no refactor of app/layout.tsx)
 *
 * Auth guard: same-origin session cookie + middleware + page-level auth() (D-17).
 * Zero dollar signs in this file.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { listProjects } from "@/lib/cae-state";
import { resolveCbPath } from "@/lib/floor/cb-path";
import FloorPopoutHost from "@/components/floor/floor-popout-host";

interface PageProps {
  searchParams: Promise<{ project?: string }>;
}

export default async function FloorPopoutPage({ searchParams }: PageProps) {
  // Belt-and-suspenders auth check (middleware.ts /floor/:path* also guards — D-17)
  const session = await auth();
  if (!session) {
    redirect("/signin?from=/floor/popout");
  }

  // Next 16 requires searchParams to be awaited before reading (CR-01)
  const { project } = await searchParams;

  // Project resolution for pop-out:
  // 1. Explicit searchParams.project (set by toolbar's window.open call)
  // 2. Most-recent Shift project (bookmarked / typed URL fallback)
  // 3. First project in list
  // 4. null (empty project list or listProjects threw) — idle scene, no SSE
  let projectPath: string | null = null;

  if (project) {
    // Trust the explicit path — /api/tail enforces ALLOWED_ROOTS (T-11-04)
    projectPath = project;
  } else {
    try {
      const projects = await listProjects();
      if (projects.length > 0) {
        const shiftProjects = projects
          .filter((p) => p.shiftUpdated)
          .sort((a, b) => (b.shiftUpdated ?? "").localeCompare(a.shiftUpdated ?? ""));
        projectPath = shiftProjects[0]?.path ?? projects[0]?.path ?? null;
      }
    } catch {
      projectPath = null;
    }
  }

  const cbPath = resolveCbPath(projectPath);

  return (
    <>
      {/*
        Chrome-suppression CSS (Q1 Option C): hide the root TopNav that is
        injected by app/layout.tsx into every route. This <style> is mounted
        and unmounted with the /floor/popout route — no global side-effect.
        aria-hidden is set on mount by FloorPopoutHost (Task 2) for a11y.
      */}
      <style
        dangerouslySetInnerHTML={{
          __html: `header[data-testid="top-nav"] { display: none !important; }`,
        }}
      />
      <main className="h-screen w-screen bg-[color:var(--bg)]">
        <FloorPopoutHost cbPath={cbPath} projectPath={projectPath} />
      </main>
    </>
  );
}
