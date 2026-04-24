"use client";

/**
 * MissionControlHero — full-bleed banner at the top of /build (Phase 15
 * Wave 3.1).
 *
 * Four tiles in a single row on desktop (five when since-you-left shows),
 * collapsing to a 2-up grid on tablet/mobile. Each tile is keyboard-reachable,
 * drillable, and renders a subtle dim placeholder when its data slot is
 * empty so the banner never looks broken.
 *
 *   1. Active count       -> /build/agents
 *   2. Token burn rate    -> /metrics
 *   3. Tokens today       -> /metrics
 *   4. 60s sparkline      -> /build/changes
 *   5. Since-you-left     -> expanded inline (or /build/history)
 *
 * Data: GET /api/mission-control every 5s (matches the route's cache TTL).
 *
 * Motion: animated number on the active count + pulsing sparkline polyline.
 * Both respect prefers-reduced-motion via Framer Motion's useReducedMotion.
 *
 * Tokens-only display — no USD (D-07). Eric runs CAE on Claude Max so any
 * derived USD figure is misleading; we render raw token counts.
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
import type { MissionControlState } from "@/lib/cae-mission-control-state";

const POLL_INTERVAL_MS = 5_000;

/**
 * "Hot burn" reference used to scale the TokenBurnBar fill. 100k tok/min
 * (~6M tok/hr) corresponds to heavy Opus-driven work across 3-4 parallel
 * forge agents; the bar saturates at that rate so normal load stays
 * visibly varied instead of pinning at 1%.
 */
const HOT_BURN_REF_PER_MIN = 100_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeAgo(ms: number): string {
  if (ms < 60_000) return Math.max(1, Math.floor(ms / 1000)) + "s";
  if (ms < 3_600_000) return Math.floor(ms / 60_000) + "m";
  if (ms < 86_400_000) return Math.floor(ms / 3_600_000) + "h";
  return Math.floor(ms / 86_400_000) + "d";
}

/**
 * formatTokens — compact human token count. `<1000 -> "N"`,
 * `<1M -> "12.3k"`, `<1B -> "1.23M"`. No leading currency sign.
 */
function formatTokens(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  const rounded = Math.round(n);
  if (rounded < 1_000) return rounded.toString();
  if (rounded < 1_000_000) {
    return (rounded / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  if (rounded < 1_000_000_000) {
    return (rounded / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + "M";
  }
  return (rounded / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "") + "B";
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
// Token burn — small bar scaled to the HOT_BURN_REF_PER_MIN reference.
// ---------------------------------------------------------------------------

function TokenBurnBar({
  burnPerMin,
  tokensToday,
}: {
  burnPerMin: number;
  tokensToday: number;
}) {
  // Scale bar fill against a "hot burn" reference so normal traffic stays
  // visibly varied. Past-reference saturates at 100%.
  const fillPct = Math.max(0, Math.min(100, (burnPerMin / HOT_BURN_REF_PER_MIN) * 100));
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
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[10px] text-[color:var(--text-dim)]">
        <span>
          <span className="sr-only" data-truth="mission-control.tokens-burn-per-min">
            {burnPerMin}
          </span>
          {formatTokens(burnPerMin)} tok/min
        </span>
        <span>
          <span className="sr-only" data-truth="mission-control.tokens-today">
            {tokensToday}
          </span>
          {formatTokens(tokensToday)} tok today
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tokens-today tile body — big number + "today" caption. Replaces the old
// CostRadial / CostUnbounded components entirely.
// ---------------------------------------------------------------------------

function TokensTodayBody({ tokensToday }: { tokensToday: number }) {
  return (
    <div className="flex w-full flex-col leading-tight" data-testid="mc-tokens-today-body">
      <span
        className="font-mono text-lg font-semibold tabular-nums text-[color:var(--text)]"
        data-truth="mission-control.tokens-today"
      >
        {formatTokens(tokensToday)} tok
      </span>
      <span className="text-[10px] text-[color:var(--text-dim)]">today</span>
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
        {syl.tool_calls_since} tool calls · {formatTokens(syl.tokens_since)} tok ·{" "}
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
  const burnRate = data?.tokens_burn_per_min ?? 0;
  const tokensToday = data?.tokens_today ?? 0;
  const sparkline = data?.sparkline_60s ?? [];
  const syl = data?.since_you_left ?? {
    show: false,
    last_seen_at: null,
    tool_calls_since: 0,
    tokens_since: 0,
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

      {/* 4-tile grid (5 when SYL visible) — collapses to 2-up on tablet. */}
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
          ariaLabel={"Token burn rate: " + formatTokens(burnRate) + " tokens per minute."}
          Icon={Flame}
          label="burn"
          empty={!isLoading && burnRate === 0}
          emptyTip="appears when tokens start flowing"
        >
          <TokenBurnBar burnPerMin={burnRate} tokensToday={tokensToday} />
        </Tile>

        <Tile
          testId="mc-tile-tokens-today"
          href="/metrics"
          ariaLabel={"Tokens today: " + formatTokens(tokensToday) + " tokens consumed since UTC midnight."}
          Icon={Coins}
          label="tokens today"
          empty={!isLoading && tokensToday === 0}
          emptyTip="appears when token usage is recorded"
        >
          <TokensTodayBody tokensToday={tokensToday} />
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
              formatTokens(syl.tokens_since) +
              " tokens consumed."
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
