import { labelFor } from "@/lib/copy/labels";
import { PlanHomeHeading } from "@/components/shell/plan-home-heading";

export default function PlanPage() {
  const labels = labelFor(false);
  return (
    <main className="p-8 max-w-3xl">
      <PlanHomeHeading />
      <p className="mt-4 text-sm text-[color:var(--text-muted)]">{labels.planPlaceholder}</p>
    </main>
  );
}
