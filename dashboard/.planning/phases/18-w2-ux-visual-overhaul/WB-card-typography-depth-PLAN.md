---
phase: 18
plan: WB-card-typography-depth
wave: 2
name: Standardize cards, typography, and visual depth
---

# WB — Design System Foundation: Cards, Typography, Depth

## Context

Cards have inconsistent borders (some visible, some borderless). At least 4-5 competing typography treatments per page. Everything sits at the same z-level — no shadows, no layering. The dashboard feels flat in a bad way.

Reference: `/home/timmy/cae-dashboard-visual-audit.md` items #13-16

## Task

<task>
<name>Standardize Card component, typography scale, and depth hierarchy</name>

<files>
components/ui/card.tsx
app/globals.css
tailwind.config.ts
lib/fonts.ts
components/layout/**/*.tsx
</files>

<action>
1. **Card standardization**: Audit all card variants. Create ONE Card component with variants: `default` (subtle border + shadow-sm), `elevated` (stronger shadow for modals/overlays), `flat` (no border, for nested cards). Apply consistently across all pages.

2. **Typography cleanup**:
   - Ensure Inter is the ONLY body font (no serif fallbacks, no Times New Roman).
   - JetBrains Mono for ALL code/numbers/monospace.
   - Define a type scale: h1 (24px semibold), h2 (20px semibold), h3 (16px medium), body (14px regular), caption (12px regular), mono (13px JetBrains Mono).
   - Apply across all pages. Max 3 sizes per page content area.

3. **Depth hierarchy**:
   - Sidebar: `shadow-md` or a 1px right border with slightly elevated bg.
   - Cards: `shadow-sm` with `hover:shadow-md` transition.
   - Modals/drawers: `shadow-xl` with backdrop blur.
   - Active/selected items: `ring-1 ring-cyan-500/20`.
   - Add these as Tailwind utilities or CSS variables for consistency.

4. **Color system**: Ensure cyan/teal is the ONLY accent color. Remove any gold/amber clashes. Agent avatar colors should use a consistent palette derived from cyan.

5. Remove the Next.js "N" dev watermark — set `devIndicators: false` in `next.config.ts` (or `next.config.js`).
</action>

<verify>
1. No serif fonts render anywhere (inspect with browser devtools).
2. Cards have consistent visual treatment across all pages.
3. Visible depth hierarchy: sidebar > cards > flat content.
4. Next.js "N" watermark is gone.
5. `pnpm vitest run` — all green.
6. `pnpm build` passes.
</verify>
</task>