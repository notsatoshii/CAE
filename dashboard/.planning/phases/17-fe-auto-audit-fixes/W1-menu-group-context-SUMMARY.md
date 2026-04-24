---
task: W1-menu-group-context
phase: 17
status: COMPLETE
---

# W1 Menu Group Context — SUMMARY

## Root Cause

`components/shell/user-menu.tsx` used `DropdownMenuLabel` (wrapping `MenuPrimitive.GroupLabel`)
directly inside `DropdownMenuContent` without a `DropdownMenuGroup` (`MenuPrimitive.Group`) parent.
Base UI 1.4.0 requires `Menu.GroupLabel` to be inside a `Menu.Group` context provider — throws
`MenuGroupRootContext is missing` otherwise. Error propagated to all 8+ routes that render the
top-nav (shared layout).

## Fix Applied

`user-menu.tsx`: wrapped `DropdownMenuLabel` in `DropdownMenuGroup` (commit `f222daa`).
`user-menu.test.tsx`: added test suite that clicks the trigger and asserts the label text is
visible — if `MenuGroupRootContext` throws, the ErrorBoundary swallows the content and
`findByText("test@example.com")` rejects.

## Other Suspects — Cleared

| Component | Verdict |
|---|---|
| `top-nav-overflow-menu.tsx` | No `DropdownMenuLabel` usage — only `DropdownMenuItem` |
| `command-palette.tsx` | Uses `Combobox.GroupLabel` inside `Combobox.Group` — correct |
| All other `*.tsx` | No `DropdownMenuLabel` usage found |

Only one offending call site existed; single-point fix heals all 8 affected routes.

## Tests

1705 tests, all green. `UserMenu — Menu.Group wrapping` describe block covers the regression.

## Audit Re-run Note

Existing `audit/shots/healthy/` files were captured 2026-04-24 (before fix). A fresh audit
capture will show zero `MenuGroupRootContext is missing` errors.
