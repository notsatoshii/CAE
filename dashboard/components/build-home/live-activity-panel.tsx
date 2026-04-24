"use client"

/**
 * LiveActivityPanel — surfaces live tool-call activity at the top of /build.
 *
 * Eric's P15 critique: "dashboard shows nothing active when actively running".
 * This panel is the answer — it polls /api/activity/live every 5 seconds and
 * renders three tiles + a 30-minute sparkline + a 5-minute tool-kind stacked
 * bar so the dashboard always carries a live signal even when other surfaces
 * are quiescent.
 *
 * Data shape comes from lib/cae-activity-state.ts. The audit-hook
 * (tools/audit-hook.sh) writes the underlying JSONL on every PostToolUse.
 *
 * Empty state: when there's no recorded activity in the last 24h we show a
 * tip explaining where activity comes from rather than a sad blank box.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import { LastUpdated } from "@/components/ui/last-updated"
import type { LiveActivity } from "@/lib/cae-activity-state"

const POLL_INTERVAL_MS = 5_000
const ACTIVE_WINDOW_MS = 30_000
const SPARKLINE_HEIGHT = 32

/**
 * Color per tool kind. We reuse --chart-1..5 (defined in globals.css) and
 * fall back to --text-muted for the sixth slot since we cannot add a
 * --chart-6 token without touching globals.css (owned by another agent).
 *
 * Order is the rendering order in the stacked bar + legend.
 */
const TOOL_COLORS: Record<string, string> = {
  Bash: "var(--chart-1)",
  Edit: "var(--chart-2)",
  Read: "var(--chart-3)",
  Write: "var(--chart-4)",
  Agent: "var(--chart-5)",
  Task: "var(--text-muted)",
}

const TOOL_ORDER = ["Bash", "Edit", "Read", "Write", "Agent", "Task"] as const

function formatHHMM(ts: number): string {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return hh + ":" + mm
}

interface SparklineProps {
  buckets: Array<{ ts: number; count: number }>
}

/**
 * 30-bucket sparkline with hover guide + tooltip. Pure SVG, scales to
 * container width via viewBox + preserveAspectRatio="none".
 *
 * When all buckets are zero (idle) we render a dotted baseline so the panel
 * still conveys "we're listening, nothing to plot yet" instead of looking
 * broken.
 */
function ActivitySparkline({ buckets }: SparklineProps) {
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef<SVGSVGElement | null>(null)

  const max = Math.max(1, ...buckets.map((b) => b.count))
  const allZero = buckets.every((b) => b.count === 0)
  const w = 1000 // virtual width for the viewBox; SVG scales to container.
  const h = SPARKLINE_HEIGHT
  const step = buckets.length > 1 ? w / (buckets.length - 1) : 0

  const points = buckets
    .map((b, i) => {
      const x = i * step
      const y = h - (b.count / max) * h
      return x.toFixed(2) + "," + y.toFixed(2)
    })
    .join(" ")

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = ref.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const xRel = e.clientX - rect.left
    const xVirt = (xRel / rect.width) * w
    const idx = Math.round(xVirt / Math.max(1, step))
    const clamped = Math.max(0, Math.min(buckets.length - 1, idx))
    setHover(clamped)
  }

  return (
    <div className="relative w-full" data-testid="activity-sparkline">
      <svg
        ref={ref}
        viewBox={"0 0 " + w + " " + h}
        preserveAspectRatio="none"
        width="100%"
        height={h}
        className="block"
        role="img"
        aria-label={"Tool activity, last 30 minutes, peak " + max + " per minute"}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
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
        {hover !== null && (
          <line
            x1={hover * step}
            x2={hover * step}
            y1={0}
            y2={h}
            stroke="var(--accent)"
            strokeWidth={1}
            strokeOpacity={0.4}
          />
        )}
      </svg>
      {hover !== null && buckets[hover] && (
        <div
          data-testid="sparkline-tooltip"
          className="pointer-events-none absolute -top-7 z-10 rounded border border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-2 py-1 font-mono text-[11px] text-[color:var(--text)] shadow-md"
          style={{
            left: `calc(${(hover / Math.max(1, buckets.length - 1)) * 100}% - 40px)`,
          }}
        >
          {formatHHMM(buckets[hover].ts)} — {buckets[hover].count} tools
        </div>
      )}
    </div>
  )
}

interface BreakdownProps {
  counts: Record<string, number>
}

/**
 * 5-minute tool-kind stacked bar + legend. Hides tools with zero count from
 * both the bar segments and the legend so the legend stays compact when the
 * activity is one-sided (e.g. only Bash + Read during a long compile).
 */
function ToolBreakdown({ counts }: BreakdownProps) {
  const total = TOOL_ORDER.reduce((sum, k) => sum + (counts[k] ?? 0), 0)

  return (
    <div data-testid="tool-breakdown" className="space-y-2">
      <div className="flex h-2 w-full overflow-hidden rounded bg-[color:var(--surface-hover)]">
        {total === 0 ? null : (
          TOOL_ORDER.map((kind) => {
            const n = counts[kind] ?? 0
            if (n === 0) return null
            const pct = (n / total) * 100
            return (
              <div
                key={kind}
                title={kind + ": " + n}
                style={{
                  width: pct + "%",
                  backgroundColor: TOOL_COLORS[kind],
                }}
                data-testid={"breakdown-segment-" + kind}
              />
            )
          })
        )}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[color:var(--text-muted)]">
        {TOOL_ORDER.map((kind) => {
          const n = counts[kind] ?? 0
          if (n === 0) return null
          return (
            <span
              key={kind}
              data-testid={"legend-item-" + kind}
              className="inline-flex items-center gap-1"
            >
              <span
                aria-hidden
                className="inline-block size-1.5 rounded-full"
                style={{ backgroundColor: TOOL_COLORS[kind] }}
              />
              <span>{kind}</span>
              <span className="font-mono tabular-nums">{n}</span>
            </span>
          )
        })}
        {total === 0 && (
          <span className="text-[color:var(--text-dim)]">no tool calls in last 5 minutes</span>
        )}
      </div>
    </div>
  )
}

interface TileProps {
  label: string
  value: React.ReactNode
  testId: string
  small?: boolean
}

function Tile({ label, value, testId, small }: TileProps) {
  return (
    <div
      data-testid={testId}
      className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-4"
    >
      <div
        className={
          (small ? "text-xl" : "text-2xl") +
          " font-semibold tabular-nums leading-none text-[color:var(--text)]"
        }
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </div>
      <div className="mt-2 text-sm text-[color:var(--text-muted)]">{label}</div>
    </div>
  )
}

function SkeletonTile() {
  return (
    <div
      className="h-[68px] animate-pulse rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface)]"
      data-testid="activity-skeleton-tile"
    />
  )
}

interface PanelProps {
  /** Test hook: provide an initial state to bypass the network fetch. */
  initialData?: LiveActivity
  /** Test hook: skip the polling effect entirely. */
  disablePolling?: boolean
}

export function LiveActivityPanel({ initialData, disablePolling }: PanelProps = {}) {
  const [data, setData] = useState<LiveActivity | null>(initialData ?? null)
  const [lastUpdated, setLastUpdated] = useState<number | null>(
    initialData ? Date.now() : null,
  )

  useEffect(() => {
    if (disablePolling) return
    let mounted = true

    async function poll() {
      try {
        const res = await fetch("/api/activity/live")
        if (!mounted || !res.ok) return
        const json = (await res.json()) as LiveActivity
        if (!mounted) return
        setData(json)
        setLastUpdated(Date.now())
      } catch {
        // swallow — panel stays on last good data, LastUpdated chip will go stale
      }
    }

    poll()
    let id = window.setInterval(poll, POLL_INTERVAL_MS)
    const onVisibility = () => {
      if (document.hidden) {
        window.clearInterval(id)
      } else {
        poll()
        id = window.setInterval(poll, POLL_INTERVAL_MS)
      }
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      mounted = false
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [disablePolling])

  const isActive = useMemo(() => {
    if (!data?.last_event_at) return false
    return Date.now() - data.last_event_at < ACTIVE_WINDOW_MS
  }, [data])

  const isLoading = data === null
  const isEmpty = !isLoading && data.last_24h_count === 0

  return (
    <section
      data-testid="live-activity-panel"
      aria-labelledby="live-activity-heading"
      className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-4"
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2
            id="live-activity-heading"
            className="type-section"
          >
            Live activity
          </h2>
          <span
            data-testid="live-activity-status-dot"
            data-active={isActive ? "true" : "false"}
            aria-label={isActive ? "Active" : "Idle"}
            className={
              "inline-block size-2 rounded-full " +
              (isActive ? "animate-pulse" : "")
            }
            style={{
              backgroundColor: isActive ? "var(--accent)" : "var(--text-dim)",
            }}
          />
        </div>
        <LastUpdated at={lastUpdated} threshold_ms={POLL_INTERVAL_MS + 1_000} />
      </header>

      {isLoading ? (
        <>
          <span className="sr-only" data-truth="live-activity.loading">yes</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SkeletonTile />
            <SkeletonTile />
            <SkeletonTile />
          </div>
        </>
      ) : (
        <>
          <span className="sr-only" data-truth="live-activity.healthy">yes</span>
          <span className="sr-only" data-truth="live-activity.active">
            {isActive ? "yes" : "no"}
          </span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Tile
              testId="activity-tile-tools-per-min"
              label="tools/min"
              value={
                <span className="font-mono" data-truth="live-activity.tools-per-min-now">
                  {data.tools_per_min_now}
                </span>
              }
            />
            <Tile
              testId="activity-tile-active-stream"
              label="active stream"
              value={
                <span
                  className="text-[color:var(--text)]"
                  data-truth="live-activity.most-frequent-tool"
                >
                  {data.most_frequent_tool ?? "Idle"}
                </span>
              }
            />
            <Tile
              testId="activity-tile-last-24h"
              label="last 24h"
              value={
                <span className="font-mono" data-truth="live-activity.last-24h-count">
                  {data.last_24h_count}
                </span>
              }
              small
            />
          </div>

          <div className="mt-4">
            <ActivitySparkline buckets={data.sparkline} />
          </div>

          <div className="mt-4">
            <div className="type-section mb-1.5 text-[color:var(--text-dim)]">
              Last 5 minutes
            </div>
            <ToolBreakdown counts={data.tool_breakdown_5m} />
          </div>

          {isEmpty && (
            <>
              <span className="sr-only" data-truth="live-activity.empty">yes</span>
              <p
                data-testid="activity-empty-tip"
                className="mt-3 text-[12px] text-[color:var(--text-muted)]"
              >
                Tip: tool calls will appear here once activity resumes. The audit-hook
                captures every Bash/Edit/Read/Write/Agent/Task invocation.
              </p>
            </>
          )}
        </>
      )}
    </section>
  )
}
