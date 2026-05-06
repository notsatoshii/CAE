---
phase: 21
plan: 01-glassmorphic
wave: 1
name: Glassmorphic visual pass — backdrop-blur + translucent panels
---

# 01-glassmorphic — Visual Polish Pass

## Context
Eric wants deeper glass/translucent aesthetic across all dashboard surfaces.
Backdrop-blur + translucent panel fills + border-highlight gradients.
Standing P2 UI polish directive from session 13.

## Task

<task>
<name>Apply glassmorphic styling across dashboard surfaces</name>

<files>
app/globals.css
components/ui/card.tsx
components/ui/panel.tsx
components/mc/mc-hero.tsx
components/queue/**/*.tsx
components/floor/floor-legend.tsx
app/layout.tsx
</files>

<action>
1. Add CSS variables for glass effect: --glass-bg, --glass-border, --glass-blur.
2. Create a `.glass` utility class with backdrop-filter: blur(12px), semi-transparent background, subtle border gradient.
3. Apply glass styling to: MC hero banner, sidebar panels, queue cards, modal sheets, the Live Floor legend overlay.
4. Ensure contrast remains readable — test with both dark theme and light content.
5. Keep all existing functionality — this is visual-only, no logic changes.
6. Add subtle border-top or border-left highlight gradient on key surfaces for depth.
</action>

<verify>
1. Visual inspection: panels have visible backdrop blur effect.
2. Text remains readable on all glass surfaces.
3. `pnpm build` passes with no new errors.
4. `pnpm vitest run` passes.
</verify>
</task>

