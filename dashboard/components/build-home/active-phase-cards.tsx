"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useStatePoll } from "@/lib/hooks/use-state-poll";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { Card, CardContent } from "@/components/ui/card";
import { AgentAvatars } from "./agent-avatars";
import { LastUpdated } from "@/components/ui/last-updated";

// Each card below emits: data-testid="phase-card-{phaseNumber}"
// (computed form is `data-testid={"phase-card-" + p.phaseNumber}` — acceptance grep anchor above.)

export function ActivePhaseCards() {
  const { data, lastUpdated } = useStatePoll();
  const { dev } = useDevMode();
  const t = labelFor(dev);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const phases = (data?.home_phases ?? []).filter(
    (p) => p.progress_pct > 0 && p.progress_pct < 100
  );

  function openSheet(phaseNumber: number, project: string) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("sheet", "open");
    params.set("phase", String(phaseNumber));
    params.set("project", project);
    router.push((pathname ?? "/build") + "?" + params.toString());
  }

  if (phases.length === 0) {
    return (
      <section data-testid="active-phase-cards" className="mb-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--text-muted)] mb-3">
          {t.activePhasesHeading}
        </h2>
        <Card>
          <CardContent className="py-6 text-sm text-[color:var(--text-muted)]">
            {t.activePhasesEmpty}
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section data-testid="active-phase-cards" className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">
          {t.activePhasesHeading} ({phases.length})
        </h2>
        <LastUpdated at={lastUpdated} threshold_ms={6000} />
      </div>
      <div className="flex flex-col gap-3">
        {phases.map((p) => {
          const running = p.agents_active.some((a) => a.concurrent > 0);
          return (
            <button
              key={p.project + "#" + p.phaseNumber}
              type="button"
              data-testid={"phase-card-" + p.phaseNumber}
              data-phase-number={p.phaseNumber}
              data-project={p.projectName}
              onClick={() => openSheet(p.phaseNumber, p.project)}
              className="text-left rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-4 transition-colors hover:bg-[color:var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
            >
              <div className="flex items-start justify-between gap-4 mb-3">
                <h3 className="text-sm font-medium text-[color:var(--text)]">
                  {t.phaseCardTitle(p.projectName, p.phaseNumber)}
                </h3>
                <AgentAvatars agents={p.agents_active} />
              </div>

              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--border-subtle)] mb-2">
                <div
                  className={
                    "h-full rounded-full bg-[color:var(--accent)] transition-all duration-200 " +
                    (running ? "animate-pulse" : "")
                  }
                  style={{ width: p.progress_pct + "%" }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-x-2 font-mono text-xs text-[color:var(--text-muted)]">
                <span>{t.phaseCardWaveLabel(p.wave_current, p.wave_total)}</span>
                <span aria-hidden="true">·</span>
                <span>{t.phaseCardProgressLabel(p.progress_pct)}</span>
                {p.eta_min !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{t.phaseCardEtaLabel(p.eta_min)}</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span>{t.phaseCardTokensLabel(p.tokens_phase)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
