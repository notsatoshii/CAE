"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useStatePoll } from "@/lib/hooks/use-state-poll";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { useSheetKeys } from "@/lib/hooks/use-sheet-keys";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { AgentAvatars } from "./agent-avatars";
import { SheetLiveLog } from "./sheet-live-log";
import { SheetActions } from "./sheet-actions";

export function TaskDetailSheet() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data } = useStatePoll();
  const { dev } = useDevMode();
  const t = labelFor(dev);

  const open = searchParams?.get("sheet") === "open";
  const phaseNumber = parseInt(searchParams?.get("phase") ?? "", 10);
  const project = searchParams?.get("project") ?? "";
  const plan = searchParams?.get("plan") ?? "";
  const task = searchParams?.get("task") ?? "";

  const phaseSummary = useMemo(() => {
    if (!data || !phaseNumber || Number.isNaN(phaseNumber)) return null;
    return (
      data.home_phases.find(
        (p) => p.phaseNumber === phaseNumber && (!project || p.project === project)
      ) ?? null
    );
  }, [data, phaseNumber, project]);

  const closeSheet = useCallback(() => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("sheet");
    params.delete("phase");
    params.delete("plan");
    params.delete("task");
    // PROJECT PARAM PRESERVATION: do NOT delete "project" — the founder's
    // project selection survives sheet dismissal. Removing this line would
    // break the project context on Home. Automated guard in <verify> enforces
    // that params.delete with "project" never appears in this file.
    const qs = params.toString();
    router.push((pathname ?? "/build") + (qs ? "?" + qs : ""));
  }, [router, pathname, searchParams]);

  const pauseAction = useCallback(() => {
    toast.info("Pause signal sent — wiring in a future phase", {
      description: "phase=" + phaseNumber + " plan=" + plan + " task=" + task,
    });
    console.info("[sheet] pause", { phase: phaseNumber, project, plan, task });
  }, [phaseNumber, project, plan, task]);

  const abortAction = useCallback(() => {
    if (typeof window !== "undefined" && !window.confirm("Abort this task?")) return;
    toast.info("Abort signal sent — wiring in a future phase", {
      description: "phase=" + phaseNumber + " plan=" + plan + " task=" + task,
    });
    console.info("[sheet] abort", { phase: phaseNumber, project, plan, task });
  }, [phaseNumber, project, plan, task]);

  useSheetKeys({
    enabled: open,
    onClose: closeSheet,
    onPause: pauseAction,
    onAbort: abortAction,
  });

  // Derive log path (heuristic — CONTEXT §Task detail sheet "Live tail integration")
  const logPath = useMemo(() => {
    if (!project || !phaseNumber || Number.isNaN(phaseNumber)) return "";
    const basename = project + "/.cae/logs/p" + phaseNumber;
    if (plan && task) {
      return basename + "-" + plan + "-" + task + ".log";
    }
    return basename + ".log";
  }, [project, phaseNumber, plan, task]);

  const title = phaseSummary
    ? t.phaseCardTitle(phaseSummary.projectName, phaseSummary.phaseNumber)
    : "Phase " + (Number.isNaN(phaseNumber) ? "?" : phaseNumber);

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) closeSheet();
      }}
    >
      <SheetContent
        side="right"
        data-testid="task-detail-sheet"
        className="sm:max-w-[50vw] w-full flex flex-col p-0"
      >
        {/* 1. Header */}
        <SheetHeader className="px-5 py-4 border-b border-[color:var(--border-subtle)] shrink-0">
          <div className="flex items-start justify-between gap-4">
            <SheetTitle className="text-base">{title}</SheetTitle>
            {phaseSummary && <AgentAvatars agents={phaseSummary.agents_active} />}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              data-testid="sheet-pause-button"
              onClick={pauseAction}
              aria-label="Pause this task"
              className={cn(buttonVariants({ variant: "default", size: "sm" }))}
            >
              {t.sheetPauseLabel}
            </button>
            <button
              type="button"
              data-testid="sheet-abort-button"
              onClick={abortAction}
              aria-label="Abort this task"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              {t.sheetAbortLabel}
            </button>
          </div>
        </SheetHeader>

        {/* Sections 2-7 scroll */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* 2. Summary */}
          <section data-testid="sheet-section-summary">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)] mb-2">
              {t.sheetSectionSummary}
            </h3>
            <p className="text-sm text-[color:var(--text)]">
              {phaseSummary
                ? t.phaseCardWaveLabel(
                    phaseSummary.wave_current,
                    phaseSummary.wave_total
                  ) +
                  " · " +
                  t.phaseCardProgressLabel(phaseSummary.progress_pct)
                : "Loading…"}
            </p>
          </section>

          {/* 3. Live log */}
          <section data-testid="sheet-section-log">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)] mb-2">
              {t.sheetSectionLog}
            </h3>
            <SheetLiveLog path={logPath} />
          </section>

          {/* 4. Changes (stub — data not in home state v1) */}
          <section data-testid="sheet-section-changes">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)] mb-2">
              {t.sheetSectionChanges}
            </h3>
            <p className="text-sm text-[color:var(--text-muted)]">
              No commits yet.
            </p>
          </section>

          {/* 5. Memory referenced — SECTION PLACEHOLDER, list ships in Phase 8
               Per CONTEXT.md §Task detail sheet bullet 5 (revised): the LIST of
               memory items and click-through to a filtered Memory tab are deferred
               to Phase 8. In Phase 4 we render only the heading + a subtle "ships
               in Phase 8" line, collapsed by default. */}
          <section data-testid="sheet-section-memory" data-collapsed="true">
            <details>
              <summary className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)] mb-2 cursor-pointer list-none">
                {t.sheetSectionMemory}
              </summary>
              <p className="text-sm text-[color:var(--text-muted)] italic mt-2">
                {t.sheetMemoryStub}
              </p>
            </details>
          </section>

          {/* 6. Comments (stub until Phase 9) */}
          <section data-testid="sheet-section-comments">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)] mb-2">
              {t.sheetSectionComments}
            </h3>
            <p className="text-sm text-[color:var(--text-muted)]">
              {t.sheetCommentsStub}
            </p>
          </section>

          {/* 7. Actions */}
          <section data-testid="sheet-section-actions">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-muted)] mb-2">
              {t.sheetSectionActions}
            </h3>
            <SheetActions
              phase={phaseNumber}
              project={project}
              plan={plan}
              task={task}
            />
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
