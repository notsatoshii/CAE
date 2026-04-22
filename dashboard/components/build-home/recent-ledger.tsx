"use client";

import { Clock } from "lucide-react";
import { useStatePoll } from "@/lib/hooks/use-state-poll";
import { useDevMode } from "@/lib/providers/dev-mode";
import { labelFor } from "@/lib/copy/labels";
import { agentMetaFor } from "@/lib/copy/agent-meta";
import { Panel } from "@/components/ui/panel";
import { LastUpdated } from "@/components/ui/last-updated";
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

export function RecentLedger() {
  const { data, lastUpdated } = useStatePoll();
  const { dev } = useDevMode();
  const t = labelFor(dev);

  const events = (data?.events_recent ?? []).slice(0, 20);

  if (events.length === 0) {
    return (
      <Panel
        title={t.recentHeading}
        headingId="recent-ledger-heading"
        testId="recent-ledger"
        className="mb-6"
      >
        <div className="flex items-center gap-2 text-sm text-[color:var(--text-muted)]">
          <Clock size={16} className="shrink-0 text-[color:var(--text-muted)]" aria-hidden />
          <span>{t.recentEmpty}</span>
        </div>
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
      <ul className="divide-y divide-[color:var(--border-subtle)] font-mono text-xs">
        {events.map((ev, i) => (
          <RecentRow key={i} event={ev} index={i} t={t} dev={dev} />
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
}

function RecentRow({ event, index, t, dev }: RowProps) {
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

  return (
    <li
      data-testid={"recent-row-" + index}
      data-status={event.status}
      className="flex items-center gap-3 py-1.5"
    >
      <span aria-hidden="true" style={{ color: iconColor }}>
        {icon}
      </span>
      <span className="text-[color:var(--text-muted)]">{formatTime(event.ts)}</span>
      <span className="text-[color:var(--text)] flex-1 truncate">{middle}</span>
      {trailing && (
        <span className="text-[color:var(--text-muted)] shrink-0">{trailing}</span>
      )}
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
