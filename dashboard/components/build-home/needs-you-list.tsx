"use client";

import Link from "next/link";
import { useStatePoll } from "@/lib/hooks/use-state-poll";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NeedsYouItem } from "@/lib/cae-home-state";

const ICON: Record<NeedsYouItem["type"], string> = {
  blocked: "⚠",
  dangerous: "🛡",
  plan_review: "📝",
};

export function NeedsYouList() {
  const { data } = useStatePoll();
  const { dev } = useDevMode();
  const t = labelFor(dev);

  const items = data?.needs_you ?? [];

  if (items.length === 0) {
    return (
      <section data-testid="needs-you-list" className="mb-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--text-muted)] mb-3">
          {t.needsYouHeading}
        </h2>
        <Card>
          <CardContent className="py-6 text-sm text-[color:var(--text-muted)]">
            {t.needsYouEmpty}
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section data-testid="needs-you-list" className="mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--text-muted)] mb-3">
        {t.needsYouHeading} ({items.length})
      </h2>
      <Card>
        <CardContent className="py-2 px-3">
          <ul className="divide-y divide-[color:var(--border-subtle)]">
            {items.map((item, i) => (
              <NeedsYouRow key={i} item={item} index={i} t={t} dev={dev} />
            ))}
          </ul>
        </CardContent>
      </Card>
    </section>
  );
}

interface RowProps {
  item: NeedsYouItem;
  index: number;
  t: ReturnType<typeof labelFor>;
  dev: boolean;
}

function NeedsYouRow({ item, index, t, dev }: RowProps) {
  const summary =
    !dev && item.type === "plan_review"
      ? t.needsYouPlanReviewLabel
      : item.summary;

  const breadcrumb =
    item.phase && item.task
      ? item.projectName + " · " + item.phase + "-" + item.task
      : item.projectName;

  return (
    <li
      data-testid={"needs-you-row-" + index}
      data-type={item.type}
      className="flex items-center gap-3 py-2 text-sm"
    >
      <span className="text-base leading-none" aria-hidden="true">
        {ICON[item.type]}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-[color:var(--text-muted)]">
            {breadcrumb}
          </span>
          <span className="text-[color:var(--text-dim)]" aria-hidden="true">·</span>
          <span className="text-[color:var(--text)]">{summary}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {item.actions.map((action, j) => {
          const isDeny = action.label.toLowerCase().includes("deny");
          return (
            <Link
              key={j}
              href={action.href}
              data-testid={"needs-you-action-" + index + "-" + j}
              className={cn(
                buttonVariants({
                  variant: isDeny ? "outline" : "default",
                  size: "sm",
                })
              )}
            >
              {action.label}
            </Link>
          );
        })}
      </div>
    </li>
  );
}
