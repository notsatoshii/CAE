"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Clock } from "lucide-react";
import { useStatePoll } from "@/lib/hooks/use-state-poll";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { agentMetaFor } from "@/lib/copy/agent-meta";
import { Panel } from "@/components/ui/panel";
import { LastUpdated } from "@/components/ui/last-updated";
import { EmptyState } from "@/components/ui/empty-state";
import type { RecentEvent } from "@/lib/cae-home-state";

function formatTok(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return (n / 1000).toFixed(1) + "k";
  return (n / 1_000_000).toFixed(2) + "M";
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso.slice(11, 16);
  }
}

// Phase number is encoded in the `phase` label (e.g. "p4") and the leading
// task-id segment ("p4-pl01-t1-...") — extract whichever is available so the
// TaskDetailSheet can match `phaseNumber` in home_phases.
function phaseNumberFromEvent(ev: RecentEvent): number {
  const fromPhase = ev.phase.match(/^p(\d+)$/);
  if (fromPhase) return parseInt(fromPhase[1], 10);
  const fromPlan = ev.plan.match(/^p(\d+)-/);
  if (fromPlan) return parseInt(fromPlan[1], 10);
  return 0;
}

export function RecentLedger() {
  const { data, lastUpdated } = useStatePoll();
  const { dev } = useDevMode();
  const t = labelFor(dev);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const events = (data?.events_recent ?? []).slice(0, 20);

  const openSheetForEvent = useCallback(
    (ev: RecentEvent) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      const phaseNumber = phaseNumberFromEvent(ev);
      params.set("sheet", "open");
      params.set("phase", String(phaseNumber));
      params.set("project", ev.project);
      params.set("plan", ev.plan);
      // Task id mirrors plan id for ledger rows — there's no separate task
      // identifier in RecentEvent. The sheet falls back gracefully if neither
      // matches a live phase.
      params.set("task", ev.plan);
      router.push((pathname ?? "/build") + "?" + params.toString());
    },
    [router, pathname, searchParams],
  );

  if (events.length === 0) {
    return (
      <Panel
        title={t.recentHeading}
        headingId="recent-ledger-heading"
        testId="recent-ledger"
        elevation={1}
        className="mb-6"
      >
        <span className="sr-only" data-truth="recent-ledger.empty">yes</span>
        <span className="sr-only" data-truth="recent-ledger.count">0</span>
        {/* Phase 15 Wave 2.6 (bonus): adopts <EmptyState> for visual rhythm.
            Keeps the existing labelFor(dev) copy verbatim so the regression
            test that greps "nothing shipped yet|no events logged" still passes. */}
        <EmptyState
          icon={Clock}
          testId="recent-ledger-empty"
          title={t.recentEmpty}
          description="Tool calls and ship events light this up the moment work resumes."
        />
      </Panel>
    );
  }

  return (
    <Panel
      title={t.recentHeading}
      headingId="recent-ledger-heading"
      testId="recent-ledger"
      className="mb-6"
      subtitle={<LastUpdated at={lastUpdated} threshold_ms={6000} />}
    >
      <span className="sr-only" data-truth="recent-ledger.count">{events.length}</span>
      <span className="sr-only" data-truth="recent-ledger.healthy">yes</span>
      <ul
        className="divide-y divide-[color:var(--border-subtle)] font-mono text-xs"
        role="list"
      >
        {events.map((ev, i) => (
          <RecentRow
            key={i}
            event={ev}
            index={i}
            t={t}
            dev={dev}
            onOpen={openSheetForEvent}
          />
        ))}
      </ul>
    </Panel>
  );
}

interface RowProps {
  event: RecentEvent;
  index: number;
  t: ReturnType<typeof labelFor>;
  dev: boolean;
  onOpen: (event: RecentEvent) => void;
}

function RecentRow({ event, index, t, dev, onOpen }: RowProps) {
  const ok = event.status === "shipped";
  const iconColor = ok ? "var(--success)" : "var(--danger)";
  const icon = ok ? "✓" : "✗";
  const agentMeta = agentMetaFor(event.agent);
  const agentDisplay = dev ? event.agent : agentMeta.founder_label;

  const middle = dev
    ? buildDevRow(event)
    : ok
      ? t.recentShippedPrefix(agentDisplay) + " (" + event.projectName + ")"
      : "couldn't finish " + event.plan + " — " + t.recentAbortedPrefix(agentDisplay);

  const trailing = dev ? formatTok(event.tokens) + "tok" : "";

  // Accessible name summarises status + agent + plan so a screen reader user
  // hears "Open details: shipped p4-pl01-t1 by the builder" rather than the
  // glyph-only text inside the row.
  const ariaLabel =
    "Open details: " +
    (ok ? "shipped" : "aborted") +
    " " +
    event.plan +
    " by " +
    agentDisplay;

  return (
    <li role="listitem" className="contents">
      <button
        type="button"
        data-testid={"recent-row-" + index}
        data-status={event.status}
        aria-label={ariaLabel}
        onClick={() => onOpen(event)}
        className="flex w-full items-center gap-3 py-1.5 text-left cursor-pointer transition-colors hover:bg-[color:var(--surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] rounded-sm px-1 -mx-1"
      >
        <span aria-hidden="true" style={{ color: iconColor }}>
          {icon}
        </span>
        <span className="text-[color:var(--text-muted)]">{formatTime(event.ts)}</span>
        <span className="text-[color:var(--text)] flex-1 truncate">{middle}</span>
        {trailing && (
          <span className="text-[color:var(--text-muted)] shrink-0">{trailing}</span>
        )}
      </button>
    </li>
  );
}

function buildDevRow(event: RecentEvent): string {
  const prefix = event.projectName + " " + event.plan;
  if (event.status === "shipped") {
    return (
      prefix +
      "    +" +
      event.commits +
      " commits  " +
      event.agent +
      "(" +
      event.model +
      ")"
    );
  }
  return prefix + "    aborted    " + event.agent + " rejected";
}
