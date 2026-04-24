import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Class 5G — Badge palette desaturation (fix wave 2026-04-24).
 *
 * Vision scorer (C2) flagged the previous filled/vivid pills as "noisy,
 * over-saturated rhythm unlike Linear's muted palette." Fix is two-fold:
 *
 *   1. Raw chromas on --success/--warning/--info in globals.css were cut
 *      ~40-50% so the same token reads calmer everywhere it's used.
 *   2. Badge variants now follow the StatusPill soft-tint convention:
 *      ~10% tinted background + ~30% border + full-strength text colour.
 *      Result reads as a semantic tag, not a neon screaming label.
 *
 * Danger keeps its chroma (true alert) but drops lightness slightly so it
 * still punches without over-powering. Neutral maps to --text-dim for the
 * zero-contrast muted case. Legacy variants (default/secondary/destructive/
 * outline/ghost/link) are preserved so no call-site breaks.
 */

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        // --- Class 5G semantic tints (soft bg + subtle border + coloured text) ---
        success: "badge-soft-tint badge-soft-tint--success",
        warning: "badge-soft-tint badge-soft-tint--warning",
        danger: "badge-soft-tint badge-soft-tint--danger",
        info: "badge-soft-tint badge-soft-tint--info",
        neutral: "badge-soft-tint badge-soft-tint--neutral",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
