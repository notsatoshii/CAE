"use client";

import { toast } from "sonner";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface SheetActionsProps {
  phase: number;
  project: string;
  plan: string;
  task: string;
}

export function SheetActions({ phase, project, plan, task }: SheetActionsProps) {
  const { dev } = useDevMode();
  const t = labelFor(dev);

  const buttons: Array<{
    key: string;
    label: string;
    testid: string;
    destructive?: boolean;
  }> = [
    { key: "approve", label: t.sheetActionApprove, testid: "sheet-action-approve" },
    { key: "deny", label: t.sheetActionDeny, testid: "sheet-action-deny", destructive: true },
    { key: "retry", label: t.sheetActionRetry, testid: "sheet-action-retry" },
    { key: "abandon", label: t.sheetActionAbandon, testid: "sheet-action-abandon", destructive: true },
    { key: "reassign", label: t.sheetActionReassign, testid: "sheet-action-reassign" },
    { key: "editPlan", label: t.sheetActionEditPlan, testid: "sheet-action-edit-plan" },
  ];

  function invoke(key: string) {
    toast.info(key + " — wires up in a future phase", {
      description:
        "phase=" + phase + " plan=" + plan + " task=" + task + (project ? " project=" + project : ""),
    });
  }

  return (
    <div data-testid="sheet-actions" className="flex flex-wrap gap-2">
      {buttons.map((b) => (
        <button
          key={b.key}
          type="button"
          data-testid={b.testid}
          onClick={() => invoke(b.key)}
          className={cn(
            buttonVariants({
              variant: b.destructive ? "outline" : "default",
              size: "sm",
            })
          )}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
