import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Class 13A (depth pass — Eric session 12 "UI lacks depth"):
 *   - `elevation` 0..4 maps to `shadow-elevation-{0..4}` utilities backed
 *     by `--elevation-{0..4}` tokens in globals.css. Default `0` preserves
 *     the legacy ring-only look so existing Card callers aren't disturbed.
 *   - `interactive` opts into the hover-bump treatment: elevation-1 resting,
 *     elevation-2 hover, 1% scale lift, 150ms ease-out. Intended for cards
 *     that act as a single clickable surface (agent tiles, rollup slots,
 *     phase cards). Pair with `role="button"` / `tabIndex={0}` at the call
 *     site for a11y.
 *
 * Class 5H (glassmorphic pass — Eric session 13 P2 directive):
 *   - `glass` replaces the opaque `bg-card` + `ring-1 ring-foreground/10`
 *     with the `.glass-surface` utility (translucent fill + backdrop-blur
 *     + top-edge-brighter border gradient). Default off for Kanban/queue
 *     cards (perf concern on long lists); opt in per surface.
 */
export type CardElevation = 0 | 1 | 2 | 3 | 4

const CARD_ELEVATION_CLASS: Record<CardElevation, string> = {
  0: "",
  1: "shadow-elevation-1",
  2: "shadow-elevation-2",
  3: "shadow-elevation-3",
  4: "shadow-elevation-4",
}

interface CardExtraProps {
  size?: "default" | "sm"
  elevation?: CardElevation
  interactive?: boolean
  /**
   * Class 5H — when true, Card renders as a glass surface (translucent
   * fill + backdrop-blur + border-gradient). Default off. Perf guard at
   * <768px drops the blur automatically.
   */
  glass?: boolean
}

function Card({
  className,
  size = "default",
  elevation = 0,
  interactive = false,
  glass = false,
  ...props
}: React.ComponentProps<"div"> & CardExtraProps) {
  const elevationClass = CARD_ELEVATION_CLASS[elevation] ?? ""
  const interactiveClass = interactive
    ? "shadow-elevation-1 hover:shadow-elevation-2 hover:scale-[1.01] transition-all duration-150 ease-out will-change-transform"
    : ""
  // Class 5H — toggle between opaque card surface and glass-surface utility.
  // The opaque path keeps the legacy ring-1 ring-foreground/10 outline; the
  // glass path relies on border-image from .glass-surface itself (ring would
  // fight with the gradient border).
  const surfaceClass = glass
    ? "glass-surface"
    : "bg-card ring-1 ring-foreground/10"
  return (
    <div
      data-slot="card"
      data-size={size}
      data-elevation={elevation}
      data-interactive={interactive ? "true" : undefined}
      data-glass={glass ? "true" : undefined}
      className={cn(
        "group/card flex flex-col gap-4 overflow-hidden rounded-xl py-4 text-sm text-card-foreground has-data-[slot=card-footer]:pb-0 has-[>img:first-child]:pt-0 data-[size=sm]:gap-3 data-[size=sm]:py-3 data-[size=sm]:has-data-[slot=card-footer]:pb-0 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
        surfaceClass,
        elevationClass,
        interactiveClass,
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl px-4 group-data-[size=sm]/card:px-3 has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-4 group-data-[size=sm]/card:[.border-b]:pb-3",
        className
      )}
      {...props}
    />
  )
}

interface CardTitleProps extends React.ComponentProps<"div"> {
  /**
   * Class 5F typography hierarchy:
   *   - "hero"    → .type-hero (page-dominant card, e.g. the primary KPI).
   *   - "section" → .type-section (uppercase muted; card/panel header).
   *   - undefined → legacy base-size title, preserved for back-compat.
   */
  level?: "hero" | "section"
}

function CardTitle({ className, level, ...props }: CardTitleProps) {
  const tierClass =
    level === "hero"
      ? "type-hero"
      : level === "section"
        ? "type-section"
        : "font-heading text-base leading-snug font-medium group-data-[size=sm]/card:text-sm"
  return (
    <div
      data-slot="card-title"
      data-level={level}
      className={cn(tierClass, className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-4 group-data-[size=sm]/card:px-3", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "flex items-center rounded-b-xl border-t bg-muted/50 p-4 group-data-[size=sm]/card:p-3",
        className
      )}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
