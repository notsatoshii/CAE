import Link from "next/link";
import { Compass } from "lucide-react";
import { labelFor } from "@/lib/copy/labels";
import { PlanHomeHeading } from "@/components/shell/plan-home-heading";
import { EmptyState, EmptyStateActions } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export default function PlanPage() {
  const labels = labelFor(false);
  return (
    <main className="p-8 max-w-3xl">
      <PlanHomeHeading />
      <div className="mt-6">
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
      </div>
    </main>
  );
}
