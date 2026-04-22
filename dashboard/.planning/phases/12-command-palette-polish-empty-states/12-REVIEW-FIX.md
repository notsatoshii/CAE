---
phase: 12-command-palette-polish-empty-states
fixed_at: 2026-04-23T05:00:00Z
review_path: .planning/phases/12-command-palette-polish-empty-states/12-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 12: Code Review Fix Report

**Fixed at:** 2026-04-23T05:00:00Z
**Source review:** `.planning/phases/12-command-palette-polish-empty-states/12-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (WR-01, WR-02, IN-01, IN-03, IN-04)
- Fixed: 5
- Skipped: 0
- IN-02 (platform chip cosmetic) — excluded per instructions
- IN-05 (pre-existing API auth gap) — excluded per instructions

---

## Fixed Issues

### WR-01: `task.abort` (Ctrl+Shift+.) never fires on real keyboards

**Files modified:** `lib/keybindings.ts`, `lib/keybindings.test.ts`
**Commit:** `69a96b7`

**Root cause:** `KEYBINDINGS` registered `task.abort` as `["Ctrl","Shift","."]`. On US/UK keyboards `Shift+.` produces `e.key === ">"` not `"."`, so `matchesKeydown` always returned false on real hardware.

**Applied fix:** Changed `task.abort` key chip from `"."` to `">"` in `lib/keybindings.ts`. The registered chord now matches what browsers actually emit. The shortcut overlay renders `Ctrl Shift >` which is accurate — that is the character users see when they press the chord.

**Regression test added:** Two new test cases in `lib/keybindings.test.ts`:
- `"does NOT match Ctrl+Shift+. with key='.' (wrong — real browsers emit '>')"` — confirms old synthetic event now returns false
- `"matches Ctrl+Shift+. as typed on US QWERTY real keyboard (e.key === '>')"` — confirmed fails before fix, passes after

**Before/after:**
```ts
// Before
keys: ["Ctrl", "Shift", "."],   // matchesKeydown always returned false on hardware
// After
keys: ["Ctrl", "Shift", ">"],   // matches real browser KeyboardEvent.key
```

---

### WR-02: Metrics panels show EmptyState during loading window

**Files modified:** `lib/hooks/use-metrics-poll.tsx`, `components/metrics/reliability-panel.tsx`, `components/metrics/speed-panel.tsx`, `components/metrics/spending-panel.tsx`
**New test file:** `components/metrics/metrics-panels-loading.test.tsx`
**Commit:** `ffbbd2f`

**Root cause:** All three panels had a single `!data` branch that rendered the "No numbers yet." EmptyState regardless of whether the fetch was still in-flight. `useMetricsPoll` returned `{ data, error }` with no way to distinguish loading from post-fetch empty.

**Applied fix:**
1. Added `loading: boolean` to `MetricsPollValue` interface in `use-metrics-poll.tsx`. Starts `true`, cleared in a `finally` block after the first poll attempt completes (success or error).
2. Each panel now has three explicit branches:
   - `error && !data` → error card (unchanged)
   - `loading && !data` → loading copy (`L.metricsEmptyState` = "Pulling the numbers…") with `data-testid="*-panel-loading"`
   - `!loading && !data` → EmptyState with `data-testid="*-panel-empty"` (renamed from `-loading`)
   - `data` → full panel (unchanged)

**Regression tests added:** 6 tests in `metrics-panels-loading.test.tsx` (2 per panel), covering:
- `loading: true, data: null` → loading section renders, EmptyState absent
- `loading: false, data: null` → EmptyState renders, loading section absent

---

### IN-01: FileTree "Regenerate" CTA navigates instead of regenerating

**Files modified:** `components/memory/browse/file-tree.tsx`, `components/memory/browse/file-tree.test.tsx`
**Commit:** `764cc10`

**Root cause:** The empty-state CTA `onClick` called `router.push("/memory?view=graph")` — navigating to the graph tab — instead of calling the regeneration endpoint. Users clicking "Regenerate" were sent to a different view that also showed empty state.

**Applied fix:**
1. Added `import { toast } from "sonner"` to file-tree.tsx.
2. Added `regenerating` state and `handleRegenerate` async callback: POSTs to `/api/memory/regenerate`, calls `router.refresh()` on success, shows `toast.error` on failure.
3. CTA button now: `onClick={handleRegenerate}`, `disabled={regenerating}`, `aria-busy={regenerating}`, shows `labels.memoryBtnRegeneratePending` while in-flight.
4. `useRouter` mock in test extended with `refresh: mockRefresh`.
5. Added `vi.mock("sonner", ...)` to test file.

**Regression test added:** `"IN-01 regression: Regenerate CTA POSTs to /api/memory/regenerate, does NOT navigate"` — spies on `fetch`, clicks button, asserts POST was called and `mockPush` was NOT called, `mockRefresh` was called once.

---

### IN-03: `staticCommandItems` silently no-ops toggle commands

**Files modified:** `lib/palette/actions.ts`, `lib/palette/index-sources.test.ts`
**Commit:** `c84b5a3`

**Root cause:** `staticCommandItems` passed `ctx.close` as the `toggleExplain`, `toggleDev`, and `openShortcuts` callbacks to `buildStaticCommands`. Any future caller invoking a toggle via this path would see the palette close with no toggle actually executed — a silent misdirection.

**Applied fix:** Replaced the silent `ctx.close` callbacks with an `errorOnToggle(name)` factory that calls `console.warn(msg)` then `throw new Error(msg)`. This makes misuse immediately visible in the console and in tests rather than silently swallowed. Navigation items (`cmd:goto-*`, `cmd:regenerate-memory`) are unaffected — only the three toggle commands throw.

**Regression tests added:** 4 new tests in `lib/palette/index-sources.test.ts`:
- `cmd:toggle-explain`, `cmd:toggle-dev`, `cmd:open-shortcuts` each `.run()` → throws matching `/staticCommandItems cannot execute toggle/`
- `cmd:goto-home` `.run()` → does NOT throw (navigation items unaffected)

---

### IN-04: `use-command-palette.tsx` crashes if `palette.open.keys` is empty

**Files modified:** `lib/hooks/use-command-palette.tsx`, `lib/hooks/use-command-palette.test.tsx` (header update only)
**New test file:** `lib/hooks/use-command-palette-empty-keys.test.tsx`
**Commit:** `4c6f7bf`

**Root cause:** The Ctrl+K cross-platform fallback at line 48 called `kb.keys[kb.keys.length - 1].toLowerCase()` unconditionally. If `kb.keys` is `[]`, `kb.keys[-1]` is `undefined`, and `.toLowerCase()` throws a `TypeError` on every subsequent `keydown` event — freezing global keyboard handling app-wide.

**Applied fix:** Added guard before the `lastKey` extraction:
```ts
if (kb.keys.length === 0) {
  console.error("[palette] palette.open has no keys defined — Ctrl+K fallback disabled");
  return;
}
```

**Regression tests added:** 2 tests in `use-command-palette-empty-keys.test.tsx` (separate file to avoid `vi.mock` hoisting conflicts):
- Keydown with empty-keys binding does NOT throw — palette stays closed
- `console.error` is called with the `[palette]` message (not swallowed silently)

The test file uses `vi.mock("@/lib/keybindings", async importOriginal => ...)` to override only `keybindingById("palette.open")` while keeping the real `matchesKeydown`.

---

## Skipped Issues

None — all 5 in-scope findings were fixed.

---

_Fixed: 2026-04-23T05:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
