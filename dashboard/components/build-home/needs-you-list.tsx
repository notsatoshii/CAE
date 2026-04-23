"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, ShieldAlert, FileText, CheckCircle2 } from "lucide-react";
import { useStatePoll } from "@/lib/hooks/use-state-poll";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NeedsYouItem } from "@/lib/cae-home-state";

const ICON_COMPONENT: Record<NeedsYouItem["type"], React.ComponentType<{ className?: string; size?: number; "aria-hidden"?: boolean }>> = {
  blocked: AlertTriangle,
  dangerous: ShieldAlert,
  plan_review: FileText,
};

export function NeedsYouList() {
  const { data } = useStatePoll();
  const { dev } = useDevMode();
  const t = labelFor(dev);

  const items = data?.needs_you ?? [];

  if (items.length === 0) {
    return (
      <section data-testid="needs-you-list" className="mb-6">
        <span className="sr-only" data-truth="needs-you.empty">yes</span>
        <span className="sr-only" data-truth="needs-you.count">0</span>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--text-muted)] mb-3">
          {t.needsYouHeading}
        </h2>
        <Card>
          <CardContent className="py-6 flex items-center gap-2 text-sm text-[color:var(--text-muted)]">
            <CheckCircle2 size={16} className="text-[color:var(--success)] shrink-0" aria-hidden />
            <span>{t.needsYouEmpty}</span>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section data-testid="needs-you-list" className="mb-6">
      <span className="sr-only" data-truth="needs-you.count">{items.length}</span>
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
      {React.createElement(ICON_COMPONENT[item.type], {
        size: 16,
        "aria-hidden": true,
        className: item.type === "blocked"
          ? "text-[color:var(--warning)] shrink-0"
          : item.type === "dangerous"
          ? "text-[color:var(--danger)] shrink-0"
          : "text-[color:var(--text-muted)] shrink-0",
      })}
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
