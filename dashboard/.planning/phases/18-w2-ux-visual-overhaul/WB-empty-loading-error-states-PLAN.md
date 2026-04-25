---
phase: 18
plan: WB-empty-loading-error-states
wave: 2
name: Create reusable EmptyState, LoadingState, and ErrorBoundary components
---

# WB — Design System Foundation: State Components

## Context

Almost every page has a different (bad) way of handling empty/loading/error states. "Loading..." plain text, "No items" floating in void, infinite spinners. This is the single highest-impact design system fix.

Reference: `/home/timmy/cae-dashboard-visual-audit.md` items #7-8

## Task

<task>
<name>Create and deploy EmptyState, LoadingState, and ErrorBoundary components</name>

<files>
components/ui/empty-state.tsx
components/ui/loading-state.tsx
components/ui/error-boundary.tsx
components/ui/skeleton-card.tsx
</files>

<action>
1. **EmptyState component**: Props: `icon` (Lucide icon name), `title`, `description`, `action` (optional button label + onClick). Centered layout, muted icon (48px), semibold title, muted description, optional cyan CTA button. Dark card with subtle border matching existing card style.

2. **LoadingState component**: Shimmer skeleton cards. Props: `variant` ("cards" | "list" | "detail"), `count` (how many skeleton items). Uses CSS animation pulse, not a spinner. Matches card dimensions of the page it's on.

3. **ErrorBoundary component**: Wraps children. On error: shows inline banner with red/orange accent, error message, "Retry" button. For offline specifically: "Dashboard is offline — data may be stale" with a "Reconnect" button. Replace the tiny red "Offline" dot in the header with this component wrapping page content.

4. **Deploy across ALL pages**: Search for every instance of "Loading...", "No items", "Nothing's shipped", "No recipes", empty string states, and replace with the new components. Target pages: build, queue, changes, floor, chat, memory, workflows, agents, skills, security.

5. Add Storybook-style vitest snapshot tests for each component variant.
</action>

<verify>
1. `grep -r "Loading\.\.\." app/ components/ --include="*.tsx"` returns ZERO hits (all replaced).
2. Every page with no data shows the EmptyState component (icon + title + description minimum).
3. `pnpm vitest run` — all green.
4. `pnpm build` passes.
</verify>
</task>