import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ChangesClient } from "./changes-client";

/**
 * /build/changes — Phase 9 (plan 09-04, CHG-01, D-12).
 *
 * Replaces the Phase 8 stub. Server shell: auth-gates, then mounts the
 * <ChangesClient /> island which fetches /api/changes (frozen by 09-02) and
 * renders a prose-default, project-grouped accordion timeline.
 *
 * Pattern mirrors /memory/page.tsx — auth redirect + tiny server shell +
 * client-island data fetch.
 */

export const metadata = {
  title: "Changes — CAE",
};

export default async function ChangesPage() {
  const session = await auth();
  if (!session) redirect("/signin?from=/build/changes");

  return (
    <main
      data-testid="changes-page"
      className="mx-auto max-w-5xl p-8 flex flex-col gap-0"
    >
      <ChangesClient />
    </main>
  );
}
