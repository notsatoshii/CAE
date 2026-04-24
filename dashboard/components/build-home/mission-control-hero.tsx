"use client";

/**
 * MissionControlHero — full-bleed banner at the top of /build (Phase 15
 * Wave 3.1).
 *
 * Five tiles in a single row on desktop, collapsing to a 2-up grid on
 * tablet/mobile. Each tile is keyboard-reachable, drillable, and renders a
 * subtle dim placeholder when its data slot is empty so the banner never
 * looks broken.
 *
 *   1. Active count       -> /build/agents
 *   2. Token burn rate    -> /metrics
 *   3. Cost vs budget     -> /metrics
 *   4. 60s sparkline      -> /build/changes
 *   5. Since-you-left     -> expanded inline (or /build/history)
 *
 * Data: GET /api/mission-control every 5s (matches the route's cache TTL).
 *
 * Motion: animated number on the active count + pulsing sparkline polyline.
 * Both respect prefers-reduced-motion via Framer Motion's useReducedMotion.
 *
 * No dollar signs in this file (lint-no-dollar.sh guard).
 *
 * Class 20F (data-feed recovery): the "cost vs budget" tile now renders an
 * explicit "unbounded" state when the user has never configured a daily
 * budget (CAE_DAILY_BUDGET_USD env unset). The tile used to coerce 0 into
 * a phantom $50 and show "1% of budget" for a budget that didn't exist —
 * which is what Eric called out. The burn tile still shows the raw spend-
 * today total, so no information is lost.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { Activity, Coins, Flame, History, LineChart } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { LastUpdated } from "@/components/ui/last-updated";
import { formatUsd } from "@/lib/cae-cost-table";
import type { MissionControlState } from "@/lib/cae-mission-control-state";

const POLL_INTERVAL_MS = 5_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeAgo(ms: number): string {
  if (ms < 60_000) return Math.max(1, Math.floor(ms / 1000)) + "s";
  if (ms < 3_600_000) return Math.floor(ms / 60_000) + "m";
  if (ms < 86_400_000) return Math.floor(ms / 3_600_000) + "h";
  return Math.floor(ms / 86_400_000) + "d";
}

// ---------------------------------------------------------------------------
// Animated number — uses Framer Motion useSpring for a smooth integer tween.
// Falls back to instant updates under prefers-reduced-motion.
// ---------------------------------------------------------------------------

function AnimatedNumber({
  value,
  reduced,
}: {
  value: number;
  reduced: boolean;
}) {
  const motionValue = useMotionValue(value);
  const spring = useSpring(motionValue, { stiffness: 140, damping: 22 });
  const display = useTransform(spring, (v) => Math.round(v).toString());
  const [text, setText] = useState<string>(value.toString());

  useEffect(() => {
    if (reduced) {
      motionValue.jump(value);
      setText(value.toString());
      return;
    }
    motionValue.set(value);
    const unsub = display.on("change", (v) => setText(v));
    return () => unsub();
  }, [value, reduced, motionValue, display]);

  return (
    <span
      className="font-mono text-3xl font-semibold tabular-nums leading-none text-[color:var(--text)]"
      style={{ fontVariantNumeric: "tabular-nums" }}
      data-testid="mc-animated-number"
      data-truth="mission-control.active-count"
    >
      {text}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Token burn — small bar over a daily-budget line.
// ---------------------------------------------------------------------------

function TokenBurnBar({
  burnUsdPerMin,
  costTodayUsd,
  budgetUsd,
}: {
  burnUsdPerMin: number;
  costTodayUsd: number;
  budgetUsd: number;
}) {
  // Burn rate scaled to a "fast burn" reference of $1/min for the bar.
  // Anything beyond that fills the bar fully.
  const fillPct = Math.max(0, Math.min(100, (burnUsdPerMin / 1) * 100));
  const todayPct = budgetUsd > 0 ? Math.min(100, (costTodayUsd / budgetUsd) * 100) : 0;
  const budgetUnbounded = budgetUsd <= 0;
  return (
    <div className="w-full" data-testid="mc-token-burn-bar">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-[color:var(--surface-hover)]">
        <motion.div
          className="absolute left-0 top-0 h-full rounded-full bg-[color:var(--accent)]"
          initial={false}
          animate={{ width: fillPct + "%" }}
          transition={{ type: "spring", stiffness: 140, damping: 22 }}
          data-testid="mc-burn-fill"
          aria-hidden="true"
        />
        {/* Daily-budget marker — hidden when there's no budget to mark. */}
        {!budgetUnbounded && (
          <span
            aria-hidden="true"
            className="absolute top-0 h-full w-px bg-[color:var(--text-muted)]/60"
            style={{ left: todayPct + "%" }}
            data-testid="mc-budget-marker"
          />
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-[color:var(--text-dim)]">
        <span>
          <span className="sr-only" data-truth="mission-control.token-burn-usd-per-min">
            {burnUsdPerMin.toFixed(2)}
          </span>
          {formatUsd(burnUsdPerMin)}/min
        </span>
        <span>
          <span className="sr-only" data-truth="mission-control.cost-today-usd">
            {costTodayUsd.toFixed(2)}
          </span>
          <span className="sr-only" data-truth="mission-control.daily-budget-usd">
            {budgetUsd.toFixed(2)}
          </span>
          {budgetUnbounded
            ? formatUsd(costTodayUsd) + " today"
            : formatUsd(costTodayUsd) + " / " + formatUsd(budgetUsd) + " today"}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Radial gauge — semi-circle SVG. Color band by % of daily budget.
// ---------------------------------------------------------------------------

function CostRadial({ pct }: { pct: number }) {
  // Clamp to 0..1.5 — display 100% as full and 100-150% as overshoot red.
  const clamped = Math.max(0, Math.min(1.5, pct));
  const sweep = Math.min(1, clamped); // primary fill 0..1
  const overshoot = Math.max(0, clamped - 1); // overflow ring

  // Semi-circle: 180-degree arc from (-1,0) to (1,0).
  // We use a 100x55 viewBox; outer radius 45, inner 35 -> 10px ring width.
  const r = 45;
  const cx = 50;
  const cy = 50;

  function arcPath(progress: number): string {
    if (progress <= 0) return "";
    const angle = Math.PI * progress; // 0..PI
    const endX = cx - r * Math.cos(angle);
    const endY = cy - r * Math.sin(angle);
    const largeArc = angle > Math.PI ? 1 : 0;
    return [
      "M",
      cx - r,
      cy,
      "A",
      r,
      r,
      0,
      largeArc,
      1,
      endX.toFixed(2),
      endY.toFixed(2),
    ].join(" ");
  }

  // Color band: green <60, amber 60..80, red >=80
  const color =
    clamped < 0.6
      ? "var(--success)"
      : clamped < 0.8
        ? "var(--warning)"
        : "var(--danger)";

  return (
    <div className="flex w-full items-center gap-3" data-testid="mc-cost-radial">
      <svg
        viewBox="0 0 100 55"
        width="64"
        height="36"
        role="img"
        aria-label={"Cost is " + Math.round(clamped * 100) + " percent of daily budget"}
        className="shrink-0"
      >
        {/* Track */}
        <path
          d={arcPath(1)}
          fill="none"
          stroke="var(--surface-hover)"
          strokeWidth={10}
          strokeLinecap="round"
        />
        {/* Fill */}
        {sweep > 0 && (
          <path
            d={arcPath(sweep)}
            fill="none"
            stroke={color}
            strokeWidth={10}
            strokeLinecap="round"
            data-testid="mc-radial-fill"
          />
        )}
        {/* Overshoot ring */}
        {overshoot > 0 && (
          <path
            d={arcPath(Math.min(0.5, overshoot))}
            fill="none"
            stroke="var(--danger)"
            strokeWidth={4}
            strokeLinecap="round"
            data-testid="mc-radial-overshoot"
          />
        )}
      </svg>
      <div className="flex flex-col leading-tight">
        <span
          className="font-mono text-lg font-semibold tabular-nums text-[color:var(--text)]"
          data-truth="mission-control.cost-pct-of-budget"
        >
          {Math.round(clamped * 100)}%
        </span>
        <span className="text-[10px] text-[color:var(--text-dim)]">of budget</span>
      </div>
    </div>
  );
}

/**
 * CostUnbounded — rendered in the Cost tile when no daily budget is set.
 * Shows the raw spend today + an "unbounded" hint rather than a gauge
 * against a phantom budget. Class 20F.
 */
function CostUnbounded({ costTodayUsd }: { costTodayUsd: number }) {
  return (
    <div className="flex w-full flex-col leading-tight" data-testid="mc-cost-unbounded">
      <span
        className="font-mono text-lg font-semibold tabular-nums text-[color:var(--text)]"
        data-truth="mission-control.cost-today-usd"
      >
        {formatUsd(costTodayUsd)}
      </span>
      <span className="text-[10px] text-[color:var(--text-dim)]">
        today · unbounded
      </span>
      <span className="sr-only" data-truth="mission-control.budget-unbounded">
        yes
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 60s sparkline — full-tile SVG, 32px tall.
// ---------------------------------------------------------------------------

function Sparkline60s({
  buckets,
}: {
  buckets: Array<{ ts: number; count: number }>;
}) {
  const w = 1000;
  const h = 32;
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const allZero = buckets.every((b) => b.count === 0);
  const step = buckets.length > 1 ? w / (buckets.length - 1) : 0;

  const points = buckets
    .map((b, i) => {
      const x = i * step;
      const y = h - (b.count / max) * h;
      return x.toFixed(2) + "," + y.toFixed(2);
    })
    .join(" ");

  return (
    <svg
      viewBox={"0 0 " + w + " " + h}
      preserveAspectRatio="none"
      width="100%"
      height={h}
      role="img"
      aria-label={"Tool activity, last 60 seconds, peak " + max + " per second"}
      data-testid="mc-sparkline-60s"
      className="block"
    >
      {allZero ? (
        <line
          x1={0}
          x2={w}
          y1={h - 1}
          y2={h - 1}
          stroke="var(--text-dim)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      ) : (
        <polyline
          points={points}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Tile shell — keyboard-reachable Link wrapper with a11y label.
// ---------------------------------------------------------------------------

interface TileProps {
  testId: string;
  href: string;
  ariaLabel: string;
  Icon: LucideIcon;
  label: string;
  children: React.ReactNode;
  /** Optional sub-label rendered under the icon row. */
  subLabel?: string;
  /** When true, renders a dim placeholder strap across the tile body. */
  empty?: boolean;
  /** Empty-state hint shown only when empty=true. */
  emptyTip?: string;
  /** Allow callers to override the link with an onClick (for since-you-left expand). */
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

function Tile({
  testId,
  href,
  ariaLabel,
  Icon,
  label,
  children,
  subLabel,
  empty,
  emptyTip,
  onClick,
}: TileProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-label={ariaLabel}
      data-testid={testId}
      className={
        "group flex min-h-[110px] flex-col justify-between gap-2 rounded-lg " +
        "border border-[color:var(--border-subtle)] bg-[color:var(--surface)] " +
        "p-3 transition-colors hover:border-[color:var(--accent)] " +
        "focus-visible:outline-2 focus-visible:outline-[color:var(--accent)]"
      }
    >
      <div className="flex items-center justify-between text-[color:var(--text-muted)]">
        <div className="flex items-center gap-1.5">
          <Icon aria-hidden="true" className="size-4 shrink-0" />
          <span className="text-[12px] font-medium uppercase tracking-wide">
            {label}
          </span>
        </div>
        {subLabel ? (
          <span className="text-[10px] text-[color:var(--text-dim)]">
            {subLabel}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col justify-end">
        {empty ? (
          <div
            data-testid={testId + "-empty"}
            className="flex flex-col items-start gap-1.5 opacity-60"
          >
            <div
              aria-hidden="true"
              className="h-2 w-3/5 rounded-full bg-[color:var(--surface-hover)]"
            />
            <span className="text-[11px] text-[color:var(--text-dim)]">
              {emptyTip}
            </span>
          </div>
        ) : (
          children
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Since-you-left chip — slimmer tile content; expandable inline.
// ---------------------------------------------------------------------------

function SinceYouLeftBody({
  syl,
  expanded,
}: {
  syl: MissionControlState["since_you_left"];
  expanded: boolean;
}) {
  if (!syl.show) return null;

  const ago = syl.last_seen_at ? Date.now() - syl.last_seen_at : 0;
  return (
    <div className="flex flex-col gap-1" data-testid="mc-syl-body">
      <div className="font-mono text-xl font-semibold tabular-nums text-[color:var(--text)]">
        {syl.tasks_touched} tasks
      </div>
      <div className="text-[11px] text-[color:var(--text-muted)]">
        {syl.tool_calls_since} tool calls · {formatUsd(syl.usd_since)} ·{" "}
        {ago > 0 ? formatRelativeAgo(ago) + " ago" : "moments ago"}
      </div>
      {expanded ? (
        <div
          data-testid="mc-syl-expanded"
          className="mt-1 rounded-md border border-[color:var(--border-subtle)] bg-[color:var(--surface-hover)]/60 p-2 text-[11px] text-[color:var(--text-muted)]"
        >
          {syl.tasks_touched} task
          {syl.tasks_touched === 1 ? "" : "s"} active since you stepped away.
          History view ships in Wave 4.
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top-level component
// ---------------------------------------------------------------------------

interface MissionControlHeroProps {
  /** Test hook: bypass the network fetch with an initial value. */
  initialData?: MissionControlState;
  /** Test hook: skip the polling effect entirely. */
  disablePolling?: boolean;
}

export function MissionControlHero({
  initialData,
  disablePolling,
}: MissionControlHeroProps = {}) {
  const reduced = useReducedMotion() ?? false;
  const [data, setData] = useState<MissionControlState | null>(initialData ?? null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(
    initialData ? Date.now() : null,
  );
  const [sylExpanded, setSylExpanded] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (disablePolling) return;
    let intervalId: number | undefined;

    async function poll() {
      try {
        const res = await fetch("/api/mission-control");
        if (!mountedRef.current || !res.ok) return;
        const json = (await res.json()) as MissionControlState;
        if (!mountedRef.current) return;
        setData(json);
        setLastUpdated(Date.now());
      } catch {
        // Swallow — last-good data stays + LastUpdated chip will go stale.
      }
    }

    poll();
    intervalId = window.setInterval(poll, POLL_INTERVAL_MS);

    const onVisibility = () => {
      if (document.hidden) {
        if (intervalId !== undefined) window.clearInterval(intervalId);
        intervalId = undefined;
      } else {
        poll();
        intervalId = window.setInterval(poll, POLL_INTERVAL_MS);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (intervalId !== undefined) window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [disablePolling]);

  const isLoading = data === null;

  // Resolve display values up-front so empty-state checks read clearly.
  const activeCount = data?.active_count ?? 0;
  const burnRate = data?.token_burn_usd_per_min ?? 0;
  const costToday = data?.cost_today_usd ?? 0;
  // Class 20F: when CAE_DAILY_BUDGET_USD env is unset, the aggregator
  // returns 0. Render that as "unbounded" below rather than coerce to a
  // phantom $50 and show "1% of budget" for a budget that doesn't exist.
  const budget = data?.daily_budget_usd ?? 0;
  const pct = data?.cost_pct_of_budget ?? 0;
  const budgetUnbounded = budget <= 0;
  const sparkline = data?.sparkline_60s ?? [];
  const syl = data?.since_you_left ?? {
    show: false,
    last_seen_at: null,
    tool_calls_since: 0,
    usd_since: 0,
    tasks_touched: 0,
  };

  const sparklineHasData = sparkline.some((b) => b.count > 0);

  const sparklineTotal60s = sparkline.reduce((s, b) => s + b.count, 0);

  return (
    <section
      data-testid="mission-control-hero"
      aria-labelledby="mission-control-heading"
      aria-busy={isLoading}
      // Class 5H — build-home hero is glass-on. Replaces opaque surface +
      // solid border with `.glass-surface` (translucent + backdrop-blur +
      // top-edge-brighter gradient border). Elevation-1 gives the hero a
      // drop-shadow against the page canvas so it reads as raised chrome.
      // Perf guard at <768px drops the blur automatically at the utility.
      data-glass="true"
      className="glass-surface shadow-elevation-1 rounded-lg p-3 lg:p-4"
    >
      {/* Liveness markers — sr-only so visual layout unchanged. */}
      {isLoading ? (
        <span className="sr-only" data-truth="mission-control.loading">
          yes
        </span>
      ) : (
        <span className="sr-only" data-truth="mission-control.healthy">
          yes
        </span>
      )}
      <span className="sr-only" data-truth="mission-control.empty">
        {!isLoading && activeCount === 0 ? "true" : "false"}
      </span>
      <span className="sr-only" data-truth="mission-control.sparkline-total-60s">
        {sparklineTotal60s}
      </span>
      <span className="sr-only" data-truth="mission-control.last-event-at">
        {data?.last_event_at ?? 0}
      </span>
      <header className="mb-3 flex items-center justify-between">
        <h2
          id="mission-control-heading"
          className="type-section"
        >
          Mission Control
        </h2>
        <LastUpdated at={lastUpdated} threshold_ms={POLL_INTERVAL_MS + 1_000} />
      </header>

      {/* 5-tile grid — collapses to 2-up on tablet, full row on desktop. */}
      <div
        className={
          "grid gap-3 " +
          // Mobile: 2 cols. Tablet: 3 cols. Desktop: 5 cols (or 4 when SYL hidden).
          "grid-cols-2 md:grid-cols-3 " +
          (syl.show ? "lg:grid-cols-5" : "lg:grid-cols-4")
        }
      >
        <Tile
          testId="mc-tile-active"
          href="/build/agents"
          ariaLabel={"Active agents: " + activeCount + ". Open agents page."}
          Icon={Activity}
          label="active"
          empty={!isLoading && activeCount === 0}
          emptyTip="appears when an agent picks up work"
        >
          <div className="flex items-baseline gap-2">
            <AnimatedNumber value={activeCount} reduced={reduced} />
            <span className="text-[11px] text-[color:var(--text-muted)]">
              agents working
            </span>
          </div>
        </Tile>

        <Tile
          testId="mc-tile-burn"
          href="/metrics"
          ariaLabel={"Token burn rate: " + formatUsd(burnRate) + " per minute."}
          Icon={Flame}
          label="burn"
          empty={!isLoading && burnRate === 0}
          emptyTip="appears when tokens start flowing"
        >
          <TokenBurnBar
            burnUsdPerMin={burnRate}
            costTodayUsd={costToday}
            budgetUsd={budget}
          />
        </Tile>

        <Tile
          testId="mc-tile-cost"
          href="/metrics"
          ariaLabel={
            budgetUnbounded
              ? "Cost today is " +
                formatUsd(costToday) +
                ". No daily budget set."
              : "Cost today is " +
                formatUsd(costToday) +
                " of " +
                formatUsd(budget) +
                " budget — " +
                Math.round(pct * 100) +
                " percent."
          }
          Icon={Coins}
          label="budget"
          subLabel={budgetUnbounded ? "unbounded" : undefined}
          empty={!isLoading && costToday === 0}
          emptyTip={
            budgetUnbounded
              ? "set CAE_DAILY_BUDGET_USD to enable"
              : "appears when token usage is recorded"
          }
        >
          {budgetUnbounded ? (
            <CostUnbounded costTodayUsd={costToday} />
          ) : (
            <CostRadial pct={pct} />
          )}
        </Tile>

        <Tile
          testId="mc-tile-sparkline"
          href="/build/changes"
          ariaLabel="Tool calls in the last 60 seconds. Open recent changes."
          Icon={LineChart}
          label="last 60s"
          subLabel={sparklineHasData ? "live" : "idle"}
          empty={!isLoading && !sparklineHasData}
          emptyTip="appears when an agent runs a tool"
        >
          <Sparkline60s buckets={sparkline} />
        </Tile>

        {syl.show && (
          <Tile
            testId="mc-tile-since"
            href="/build/changes"
            ariaLabel={
              "Since you left, " +
              syl.tool_calls_since +
              " tool calls and " +
              formatUsd(syl.usd_since) +
              " spent."
            }
            Icon={History}
            label="since you left"
            subLabel="welcome back"
            onClick={(e) => {
              // First click toggles the inline expansion; second navigates.
              if (!sylExpanded) {
                e.preventDefault();
                setSylExpanded(true);
              }
            }}
          >
            <SinceYouLeftBody syl={syl} expanded={sylExpanded} />
          </Tile>
        )}
      </div>
    </section>
  );
}

export default MissionControlHero;
