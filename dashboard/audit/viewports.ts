/**
 * audit/viewports.ts — Phase 15 Cap.2.
 *
 * Three viewport sizes per OVERHAUL-PLAN ("laptop 1440×900, wide
 * 1920×1080, mobile 390×844"). Name lives in screenshot filenames so
 * slugs must be filesystem-safe.
 */

export interface ViewportSize {
  width: number
  height: number
}

export interface Viewport {
  /** Filesystem-safe slug used in screenshot paths. */
  name: string
  /** Human label for reports. */
  label: string
  /** Pixel dims handed to page.setViewportSize(). */
  size: ViewportSize
}

export const VIEWPORTS: Viewport[] = [
  { name: "laptop", label: "Laptop 1440×900", size: { width: 1440, height: 900 } },
  { name: "wide", label: "Wide 1920×1080", size: { width: 1920, height: 1080 } },
  { name: "mobile", label: "Mobile 390×844 (iPhone 14)", size: { width: 390, height: 844 } },
]
