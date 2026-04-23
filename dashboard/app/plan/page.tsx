"use client";

// Client component: Next 16 RSC serialisation refuses to pass a function
// (the Lucide icon) from server → client props. EmptyState is already a
// client component. Page has no server-only work so going client is safe.
import Link from "next/link";
import { Compass } from "lucide-react";
import { labelFor } from "@/lib/copy/labels";
import { PlanHomeHeading } from "@/components/shell/plan-home-heading";
import { EmptyState, EmptyStateActions } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function PlanPage() {
  const labels = labelFor(false);
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      {/* Plan is a coming-soon stub; surface deterministic truth markers
          so the Phase 15 harness can score depth/liveness. */}
      <span className="sr-only" data-truth="plan.healthy">yes</span>
      <span className="sr-only" data-truth="plan.empty">yes</span>
      <span className="sr-only" data-truth="plan.projects-count">0</span>
      <span className="sr-only" data-truth="plan.active-prds-count">0</span>
      <span className="sr-only" data-truth="plan.roadmaps-count">0</span>
      <span className="sr-only" data-truth="plan.uat-count">0</span>
      <span className="sr-only" data-truth="plan.tabs-count">4</span>
      <span className="sr-only" data-truth="plan.stub">true</span>
      {/* Page heading — pillar-1 single focal point */}
      <PlanHomeHeading />

      {/* Sub-copy — pillar-5 typography: 15px body, text-muted */}
      <p className="text-[15px] text-[color:var(--text-muted)] leading-relaxed max-w-xl">
        Plan mode is where Projects, PRDs, Roadmaps, and UAT live. Coming in a
        future phase — for now, head to Build to see execution in progress.
      </p>

      {/* Coming-soon tabs preview — visual density anchor */}
      <div
        aria-label="Upcoming Plan mode tabs (inactive preview)"
        className="flex gap-1 border-b border-[color:var(--border)] pb-0"
      >
        {["Projects", "PRDs", "Roadmaps", "UAT"].map((tab) => (
          <span
            key={tab}
            className="px-4 py-2 text-[13px] font-medium text-[color:var(--text-muted)] opacity-40 select-none"
            aria-hidden="true"
          >
            {tab}
          </span>
        ))}
      </div>

      {/* Empty state — UI-SPEC pattern: icon + headline + sub-copy */}
      <EmptyState
        icon={Compass}
        heading={labels.emptyPlanStubHeading}
        body={labels.emptyPlanStubBody}
        actions={
          <EmptyStateActions>
            <Link href="/build">
              <Button variant="secondary">{labels.emptyPlanStubCtaBuild}</Button>
            </Link>
          </EmptyStateActions>
        }
      />
    </main>
  );
}
