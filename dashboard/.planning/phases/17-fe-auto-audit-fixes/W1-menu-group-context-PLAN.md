---
phase: 17
plan: W1-menu-group-context
wave: 1
name: Fix Base UI MenuGroupRootContext missing error — 74 console errors
---

# W1 — MenuGroupRootContext missing

## Context

Auto-audit hit #2. 74 console errors. Error body:

```
Base UI: MenuGroupRootContext is missing.
Menu group parts must be used within <Menu.Group>.
```

Affected routes: /403, /build, /build/admin/roles, /build/agents, /build/changes, /build/schedule, /build/workflows/new, /memory. Indicates a Menu primitive (likely `Menu.GroupLabel` or `Menu.Item` w/ group semantics) is rendered outside a `<Menu.Group>` wrapper.

This is a Base UI (`@base-ui-components/react`) library contract violation. The bug is almost certainly in a shared dropdown or popover component — once fixed centrally, all 8 affected routes heal.

## Task

<task>
<name>Find + wrap Menu group parts in Menu.Group provider</name>

<files>
components/**/*.tsx
components/ui/**/*.tsx
</files>

<action>
1. `rg -n "Menu\.(GroupLabel|Item|Separator|Checkbox|Radio|SubmenuTrigger|RadioGroup)" components/`.
2. For each cluster of Menu.* primitives, verify they are wrapped in `<Menu.Group>` when group semantics are implied (GroupLabel always requires it; Item does not).
3. Primary suspects: top-bar overflow menu, agent-card context menu, phase-card kebab menu, workflow-card actions. Re-read the Base UI Menu docs: `https://base-ui.com/react/components/menu#group`.
4. Fix each offending site. Keep the fix minimal — wrap only the smallest subtree that needs group semantics.
5. If the error originates from a single shared component (e.g. `components/ui/menu.tsx`), patch it once; its consumers inherit the fix.
6. Update any unit tests for dropdown components to mount the component at the full subtree (not just the Menu.Item in isolation) so this regression doesn't slip in again.
</action>

<verify>
1. `pnpm vitest run` — all green.
2. Re-run audit capture + score. C6 `audit/shots/healthy/*/*.console.json` count of "MenuGroupRootContext is missing" must be ZERO.
3. Verify manually by opening the top-bar overflow menu, agent card context menu, phase kebab — no console errors.
</verify>
</task>
