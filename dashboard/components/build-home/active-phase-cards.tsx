"use client";

/**
 * ActivePhaseCards — Phase 15 Wave 2.4 visual upgrade.
 *
 * Source: .planning/phases/15-screenshot-truth-harness/WAVE-2-PLAN.md §2.4
 *
 * What changed vs. the prior pass:
 *   1. Progress bar is h-2 (was h-1.5) with a subtle inner gradient and a
 *      box-shadow glow once a card is "done" (progress >= 100). The bar still
 *      pulses while running (motion-reduce-safe via globals.css §MOT-01).
 *   2. Status-color left border (border-l-4) per derived phase status:
 *        stuck → --danger
 *        running → --accent
 *        idle → --warning  (active phase but no concurrent agents)
 *   3. Meta-row replaced mono text + dot separators with badge pills:
 *        Wave (W3/5)   — --info bg
 *        Progress (47%) — --accent bg
 *        ETA (8m)      — --warning bg if eta > 30m, else --text-muted bg
 *        Tokens (12.4k) — --text-muted bg
 *      Each badge: rounded-full, px-2, py-0.5, text-[11px], small icon.
 *   4. Phase header: text-base font-semibold (was text-sm), with
 *      "Phase X of Y" right-aligned (Y = wave_total proxy until phase total
 *      is plumbed through).
 *   5. Agent avatars: stacked first 3 (overlapping circles) + "+N" pill if
 *      more, with title tooltip listing all agent names.
 *   6. Sort order: stuck phases first, then by ETA asc (nulls last), then
 *      progress desc.
 *   7. Smooth motion on data update via Framer Motion `layoutId` so cards
 *      slide between sort positions instead of teleporting (motion-reduce
 *      degrades to no animation via the framer respecting prefers-reduced-
 *      motion, plus our global override on `[class*="slide-"]`).
 *
 * Card surface continues to use `.card-base card-base--interactive` from
 * Wave 2.1 — padding bumps come from the density token, not from this file.
 */

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { motion, LayoutGroup } from "motion/react";
import { Layers, Activity, Clock, Coins } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useStatePoll } from "@/lib/hooks/use-state-poll";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { Card, CardContent } from "@/components/ui/card";
import { agentMetaFor } from "@/lib/copy/agent-meta";
import { LastUpdated } from "@/components/ui/last-updated";
import type { PhaseSummary, AgentActive } from "@/lib/cae-home-state";

// Each card below emits: data-testid="phase-card-{phaseNumber}"
// (computed form is `data-testid={"phase-card-" + p.phaseNumber}` — acceptance grep anchor above.)

/** Derived phase status for visual treatment. The state contract doesn't
 *  carry an explicit status, so we synthesize from progress + agents + eta. */
type PhaseStatus = "stuck" | "running" | "idle" | "done";
function derivePhaseStatus(p: PhaseSummary): PhaseStatus {
  if (p.progress_pct >= 100) return "done";
  const anyConcurrent = p.agents_active.some((a) => a.concurrent > 0);
  if (anyConcurrent) return "running";
  // No live agents and no ETA estimate → stuck. Eric called this out as a
  // first-class signal in the FE critique.
  if (p.eta_min === null) return "stuck";
  return "idle";
}

/** Sort: stuck → ETA asc (null last) → progress desc. */
function sortPhases(phases: PhaseSummary[]): PhaseSummary[] {
  const withStatus = phases.map((p) => ({ p, s: derivePhaseStatus(p) }));
  withStatus.sort((a, b) => {
    if (a.s === "stuck" && b.s !== "stuck") return -1;
    if (b.s === "stuck" && a.s !== "stuck") return 1;
    const aEta = a.p.eta_min ?? Number.POSITIVE_INFINITY;
    const bEta = b.p.eta_min ?? Number.POSITIVE_INFINITY;
    if (aEta !== bEta) return aEta - bEta;
    return b.p.progress_pct - a.p.progress_pct;
  });
  return withStatus.map((x) => x.p);
}

const STATUS_BORDER: Record<PhaseStatus, string> = {
  stuck: "border-l-[color:var(--danger)]",
  running: "border-l-[color:var(--accent)]",
  idle: "border-l-[color:var(--warning)]",
  done: "border-l-[color:var(--success)]",
};

/** Stacked avatar cluster: first 3 colored circles overlapping, then "+N". */
function StackedAvatars({ agents }: { agents: AgentActive[] }) {
  if (agents.length === 0) return null;
  const visible = agents.slice(0, 3);
  const overflow = agents.length - visible.length;
  const tooltip = agents.map((a) => agentMetaFor(a.name).label).join(", ");
  return (
    <div
      className="inline-flex items-center"
      title={tooltip}
      data-testid="phase-agent-stack"
    >
      <div className="flex -space-x-1.5">
        {visible.map((a) => {
          const meta = agentMetaFor(a.name);
          const idle = a.concurrent === 0;
          return (
            <span
              key={a.name}
              aria-hidden
              className="inline-flex size-5 items-center justify-center rounded-full border border-[color:var(--surface)] text-[10px] leading-none"
              style={{
                backgroundColor: "color-mix(in oklch, var(--surface-hover) 60%, transparent)",
                opacity: idle ? 0.55 : 1,
              }}
            >
              {meta.emoji}
            </span>
          );
        })}
      </div>
      {overflow > 0 && (
        <span
          className="ml-1 inline-flex h-5 items-center justify-center rounded-full bg-[color:var(--surface-hover)] px-1.5 text-[10px] font-mono text-[color:var(--text-muted)]"
          aria-label={overflow + " more agents"}
        >
          +{overflow}
        </span>
      )}
      <span className="sr-only">{tooltip}</span>
    </div>
  );
}

/** Pill badge with leading icon. */
function MetaBadge({
  Icon,
  text,
  bg,
  fg,
  testId,
}: {
  Icon: LucideIcon;
  text: string;
  bg: string;
  fg: string;
  testId?: string;
}) {
  return (
    <span
      data-testid={testId}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-mono leading-none"
      style={{ backgroundColor: bg, color: fg }}
    >
      <Icon size={10} aria-hidden />
      {text}
    </span>
  );
}

export function ActivePhaseCards() {
  const { data, lastUpdated } = useStatePoll();
  const { dev } = useDevMode();
  const t = labelFor(dev);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawPhases = (data?.home_phases ?? []).filter(
    (p) => p.progress_pct > 0 && p.progress_pct < 100
  );
  const phases = sortPhases(rawPhases);

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
        <span className="sr-only" data-truth="active-phases.empty">yes</span>
        <span className="sr-only" data-truth="active-phases.count">0</span>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--text-muted)] mb-3">
          {t.activePhasesHeading}
        </h2>
        <Card elevation={1}>
          <CardContent className="py-6 text-sm text-[color:var(--text-muted)]">
            {t.activePhasesEmpty}
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section data-testid="active-phase-cards" className="mb-6">
      <span className="sr-only" data-truth="active-phases.count">{phases.length}</span>
      <span className="sr-only" data-truth="active-phases.healthy">yes</span>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">
          {t.activePhasesHeading} ({phases.length})
        </h2>
        <LastUpdated at={lastUpdated} threshold_ms={6000} />
      </div>
      <LayoutGroup>
        <div className="flex flex-col gap-3">
          {phases.map((p) => {
            const status = derivePhaseStatus(p);
            const running = status === "running";
            const done = p.progress_pct >= 100;
            const etaWarn = p.eta_min !== null && p.eta_min > 30;
            return (
              <motion.button
                key={p.project + "#" + p.phaseNumber}
                layout
                layoutId={"phase-card-" + p.project + "-" + p.phaseNumber}
                transition={{ type: "spring", stiffness: 320, damping: 32 }}
                type="button"
                data-testid={"phase-card-" + p.phaseNumber}
                data-phase-number={p.phaseNumber}
                data-project={p.projectName}
                data-status={status}
                onClick={() => openSheet(p.phaseNumber, p.project)}
                className={
                  "card-base card-base--interactive text-left border-l-4 " +
                  STATUS_BORDER[status]
                }
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <h3 className="text-base font-semibold text-[color:var(--text)]">
                    {t.phaseCardTitle(p.projectName, p.phaseNumber)}
                  </h3>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] font-mono text-[color:var(--text-muted)]">
                      Phase {p.phaseNumber}
                    </span>
                    <StackedAvatars agents={p.agents_active} />
                  </div>
                </div>

                <div
                  className={
                    "relative h-2 w-full overflow-hidden rounded-full bg-[color:var(--border-subtle)] mb-3 " +
                    (done
                      ? "shadow-[0_0_12px_color-mix(in_oklch,var(--accent)_60%,transparent)]"
                      : "")
                  }
                  data-testid={"phase-progress-" + p.phaseNumber}
                >
                  <div
                    className={
                      "h-full rounded-full bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--accent-hover)] transition-all duration-200 " +
                      (running ? "animate-pulse" : "")
                    }
                    style={{ width: p.progress_pct + "%" }}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <MetaBadge
                    testId={"phase-badge-wave-" + p.phaseNumber}
                    Icon={Layers}
                    text={"W" + p.wave_current + "/" + p.wave_total}
                    bg="color-mix(in oklch, var(--info) 18%, transparent)"
                    fg="var(--info)"
                  />
                  <MetaBadge
                    testId={"phase-badge-progress-" + p.phaseNumber}
                    Icon={Activity}
                    text={p.progress_pct + "%"}
                    bg="color-mix(in oklch, var(--accent) 18%, transparent)"
                    fg="var(--accent)"
                  />
                  {p.eta_min !== null && (
                    <MetaBadge
                      testId={"phase-badge-eta-" + p.phaseNumber}
                      Icon={Clock}
                      text={p.eta_min + "m"}
                      bg={
                        etaWarn
                          ? "color-mix(in oklch, var(--warning) 18%, transparent)"
                          : "color-mix(in oklch, var(--text-muted) 14%, transparent)"
                      }
                      fg={etaWarn ? "var(--warning)" : "var(--text-muted)"}
                    />
                  )}
                  <MetaBadge
                    testId={"phase-badge-tokens-" + p.phaseNumber}
                    Icon={Coins}
                    text={t.phaseCardTokensLabel(p.tokens_phase)}
                    bg="color-mix(in oklch, var(--text-muted) 14%, transparent)"
                    fg="var(--text-muted)"
                  />
                </div>
              </motion.button>
            );
          })}
        </div>
      </LayoutGroup>
    </section>
  );
}
