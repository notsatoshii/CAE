import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Hand-rolled SVG sparkline primitive. No chart library.
 *
 * Normalises `values` to the given `height` via min/max range then emits a
 * single `<polyline>`. Empty arrays render an empty SVG of the requested size
 * so cards don't shift layout while data is loading.
 *
 * Default stroke uses `var(--accent, #00d4ff)` (cyan) per UI-SPEC §13.
 * Accessible by opt-in: pass `ariaLabel` when the sparkline conveys information
 * not also shown as text; otherwise it stays `aria-hidden` to avoid SR noise.
 */

interface SparklineProps {
  values: number[]
  width?: number
  height?: number
  color?: string
  className?: string
  ariaLabel?: string
}

export function Sparkline({
  values,
  width = 120,
  height = 24,
  color = "var(--accent, #00d4ff)",
  className,
  ariaLabel,
}: SparklineProps) {
  if (!values || values.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        className={cn("block", className)}
        aria-hidden={ariaLabel ? undefined : true}
        aria-label={ariaLabel}
        role={ariaLabel ? "img" : undefined}
        data-testid="sparkline-empty"
      />
    )
  }

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = values.length > 1 ? width / (values.length - 1) : 0
  const points = values
    .map((v, i) => {
      const x = i * step
      const y = height - ((v - min) / range) * height
      return x.toFixed(2) + "," + y.toFixed(2)
    })
    .join(" ")

  return (
    <svg
      width={width}
      height={height}
      viewBox={"0 0 " + width + " " + height}
      className={cn("block", className)}
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
      data-testid="sparkline"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
