import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { labelFor } from "@/lib/copy/labels";
import { MetricsClient } from "./metrics-client";

/**
 * Phase 7 — /metrics server shell (REQ-7-* / D-09).
 *
 * - Server component. Session check via `await auth()` + redirect to
 *   `/signin?from=/metrics` mirrors the existing stub pattern.
 * - Heading is server-rendered with `labelFor(false)` (founder default).
 *   The client island below picks up the live DevMode state for panel
 *   headings. Brief flash acceptable — matches the pattern used in the
 *   other routes (build-home-heading, plan-home-heading, etc.).
 * - `max-w-6xl` roughly aligns with UI-SPEC §13 desktop baseline of
 *   1440px minus the 48px rail + chat buffers.
 * - Provider layering (MetricsPollProvider) happens inside MetricsClient
 *   so all three panels share ONE poll cycle.
 */

export default async function MetricsPage() {
  const session = await auth();
  if (!session) redirect("/signin?from=/metrics");

  const L = labelFor(false);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <h1
        data-testid="metrics-page-heading"
        className="text-2xl font-semibold tracking-tight text-[color:var(--text)]"
      >
        {L.metricsPageHeading}
      </h1>
      <MetricsClient />
    </main>
  );
}
