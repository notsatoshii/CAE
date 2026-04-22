---
phase: 12-command-palette-polish-empty-states
reviewed: 2026-04-22T19:41:31Z
depth: standard
files_reviewed: 30
files_reviewed_list:
  - dashboard/app/build/agents/page.tsx
  - dashboard/app/build/changes/changes-client.tsx
  - dashboard/app/build/queue/queue-kanban-client.tsx
  - dashboard/app/build/workflows/workflows-list-client.tsx
  - dashboard/app/floor/page.tsx
  - dashboard/app/floor/popout/page.tsx
  - dashboard/app/globals.css
  - dashboard/app/layout.tsx
  - dashboard/app/plan/page.tsx
  - dashboard/components/floor/floor-toolbar.tsx
  - dashboard/components/memory/browse/file-tree.tsx
  - dashboard/components/memory/graph/graph-pane.tsx
  - dashboard/components/metrics/reliability-panel.tsx
  - dashboard/components/metrics/speed-panel.tsx
  - dashboard/components/metrics/spending-panel.tsx
  - dashboard/components/palette/command-palette.tsx
  - dashboard/components/palette/palette-trigger.tsx
  - dashboard/components/shell/top-nav.tsx
  - dashboard/components/ui/empty-state.tsx
  - dashboard/components/ui/shortcut-overlay.tsx
  - dashboard/lib/copy/labels.ts
  - dashboard/lib/hooks/use-command-palette.tsx
  - dashboard/lib/hooks/use-floor-events.tsx
  - dashboard/lib/hooks/use-sheet-keys.ts
  - dashboard/lib/hooks/use-shortcut-overlay.tsx
  - dashboard/lib/keybindings.ts
  - dashboard/lib/palette/actions.ts
  - dashboard/lib/palette/build-index.ts
  - dashboard/lib/palette/fuzzy-rank.ts
  - dashboard/lib/palette/index-sources.ts
  - dashboard/lib/palette/types.ts
  - dashboard/lib/providers/dev-mode.tsx
  - dashboard/lib/providers/explain-mode.tsx
  - dashboard/middleware.ts
  - dashboard/next.config.ts
  - dashboard/scripts/verify-keybindings-wiring.sh
findings:
  critical: 0
  warning: 2
  info: 5
  total: 7
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-04-22T19:41:31Z
**Depth:** standard
**Files Reviewed:** 30
**Status:** issues_found

## Summary

Phase 12 shipped command palette (Cmd/Ctrl+K), keybindings registry, keyboard shortcut overlay, reduced-motion overrides, EmptyState primitive, and 9 route migrations. The code is well-structured, thoroughly tested (63 phase-12 tests, all green), and the security posture of the new surfaces themselves is clean (no eval/innerHTML/dangerouslySetInnerHTML in new code; all dynamic URL parameters pass through `encodeURIComponent`; XSS-safe via React auto-escape).

TypeScript passes cleanly on all phase-12 files (preexisting errors in `lib/cae-ship.test.ts` are unrelated). `@base-ui/react@1.4.0` has no known CVEs; the only npm audit findings are in `dompurify` (via monaco-editor) and `esbuild` (dev-only via vitest), both preexisting and outside phase-12 scope.

Two functional issues warrant attention before UAT sign-off:

1. **Ctrl+Shift+`.` will never fire on real keyboards** — the `task.abort` keybinding registers `keys: ["Ctrl","Shift","."]` and `matchesKeydown` compares against `e.key`, but on US/UK layouts `Shift+.` resolves `e.key === ">"` (the shifted character), never `"."`. Tests pass via synthetic events. Severity P1 — abort is a safety-critical user action.
2. **Metrics panels misbrand loading as empty** — `!data` triggers the "No numbers yet" EmptyState during the initial fetch window (~500ms-5s), regardless of whether data actually exists. Founder users see a false-negative empty state every time they open `/metrics`. Severity P1 UX regression.

Three info-level items flag copy/behavior mismatches (FileTree "Regenerate" CTA navigates instead of regenerating; `palette-trigger` hardcodes `⌘` on all platforms; `staticCommandItems` silently no-ops toggle commands when called outside `buildStaticCommands`).

**Scope note (not new in P12, flagged for awareness):** `/api/queue`, `/api/agents`, `/api/workflows` (both GET and POST) are not in `middleware.ts` matcher and contain no inline `auth()` checks. The palette now fetches from these endpoints on every `Cmd+K` open. Anyone reaching the Next origin unauthenticated can enumerate queue state, agent roster, and workflow list — and `POST /api/workflows` accepts YAML and writes a workflow file with no auth check. This predates phase 12 (11-REVIEW fixed `/api/tail` and `/api/state` only), but phase 12 now depends on and amplifies the attack surface. Flagged as IN-05 and recommended for Phase 13 scope expansion.

## Warnings

### WR-01 [P1]: `task.abort` (Ctrl+Shift+.) never fires on real keyboards

**File:** `dashboard/lib/keybindings.ts:70-75`, `dashboard/lib/hooks/use-sheet-keys.ts:44-48`, `dashboard/lib/keybindings.test.ts:125-128`

**Issue:** `KEYBINDINGS` registers `task.abort` as `["Ctrl","Shift","."]`. `matchesKeydown()` compares `e.key.toLowerCase()` against the last chip `"."`. On US/UK/most Latin keyboards, **`Shift+.` produces `e.key === ">"`**, not `"."` — `KeyboardEvent.key` returns the resolved character after modifier application, not the physical key. Consequence: pressing Ctrl+Shift+`.` on a real keyboard yields `e.key === ">"`, `matchesKeydown` returns false, and `abortAction` is never invoked. Pause (Ctrl+`.` without Shift) works correctly because `e.key === "."`.

Tests pass because `keybindings.test.ts:125-128` constructs a synthetic `KeyboardEvent({ key: ".", ctrlKey: true, shiftKey: true })` — which real browsers never emit. The test validates the registry shape, not real-world key dispatch. `task.pause` (Ctrl+`.`) works because no shift is involved.

This is a functional regression for a safety-critical UX affordance ("Stop this job"). The task-detail sheet at `dashboard/components/build-home/task-detail-sheet.tsx:78` wires `onAbort: abortAction` through `useSheetKeys` — that action is unreachable via keyboard on real hardware.

**Fix:** Switch the abort chord to either (a) use `e.code` ("Period") for layout-independent physical-key matching, or (b) register both `.` and `>` in the abort keybinding, or (c) pick a less layout-dependent chord (e.g., `Ctrl+Shift+Backspace` — shift doesn't remap Backspace). Option (b) is the cheapest:

```ts
// lib/keybindings.ts — matchesKeydown (add after the eventKey normalisation)
const eventKey = e.key === "Escape" ? "esc" : e.key.toLowerCase();
const expectedKey = kb.keys[kb.keys.length - 1].toLowerCase();
// Shift-remap fallback for US QWERTY: ">" is Shift+".", "?" is Shift+"/", etc.
// If the registered key doesn't match, try a layout-remap synonym.
const SHIFT_REMAP: Record<string, string> = {
  ".": ">",
  "/": "?",
  ",": "<",
  "1": "!",
};
if (eventKey !== expectedKey && e.shiftKey && SHIFT_REMAP[expectedKey] !== eventKey) {
  return false;
}
```

Or, cleaner, register `keys: ["Ctrl","Shift",">"]` in `keybindings.ts` (rendering shows `Ctrl Shift >` in the overlay, which is accurate) AND update `keybindings.test.ts:125-128` to fire `key: ">"` not `"."`.

Add a real-browser-shape test:

```ts
it("matches Ctrl+Shift+. as typed on US QWERTY (e.key === '>')", () => {
  const kb = keybindingById("task.abort")!;
  expect(matchesKeydown(kb, makeEvent({ key: ">", ctrlKey: true, shiftKey: true }))).toBe(true);
});
```

### WR-02 [P1]: Metrics panel EmptyStates misbrand loading as "no data"

**File:** `dashboard/components/metrics/reliability-panel.tsx:68-95`, `dashboard/components/metrics/speed-panel.tsx:60-87`, `dashboard/components/metrics/spending-panel.tsx:76-103`

**Issue:** All three metrics panels treat `!data` as an empty state and render `emptyMetricsPanelHeading` ("No numbers yet.") + CTA "Send a test job". But `useMetricsPoll()` starts with `data: null` and only populates on first poll (which can take >1s due to network and server aggregation time). This means every user who opens `/metrics` sees "No numbers yet. Once CAE runs a few jobs, this panel fills in. [Send a test job]" for a beat before real data arrives — even on a system with thousands of successful jobs.

This inverts the intent of EmptyState: it's meant to signal "there is truly nothing here," not "loading." The section `data-testid="…-loading"` hints at loading in test fixtures, but the user-visible copy contradicts that test ID.

**Fix:** Distinguish loading from empty. Either:
- Extend `useMetricsPoll` to return `{ data, error, loading }` and split the branches:
  ```tsx
  if (loading && !data) return <LoadingCard heading={L.metricsFastHeading} />;
  if (data && isEmpty(data.speed)) return <EmptyState ... />;
  ```
- Or gate the EmptyState behind post-fetch emptiness detection (e.g., `data && data.reliability.per_agent_7d.every((p) => p.sample_n === 0)`), and show a loading skeleton while `!data && !error`.

Pre-phase-12 these panels showed `loading && <SkeletonCard>` via `{L.metricsEmptyState}` with founder copy "Pulling the latest numbers…" — the EMP-03 migration replaced that nuanced loading copy with a blunt empty-state.

## Info

### IN-01 [P2]: FileTree "Regenerate" CTA navigates instead of regenerating

**File:** `dashboard/components/memory/browse/file-tree.tsx:119-125`

**Issue:** When the memory file tree is empty, the EmptyState renders a button labeled `emptyMemoryBrowseCtaRegenerate` ("Regenerate"). The handler is `router.push("/memory?view=graph")` — i.e., switch to the graph tab. The user clicks "Regenerate" expecting the memory index to rebuild; instead they're moved to another tab which also shows empty state and requires *another* click of a *different* Regenerate button that actually POSTs to `/api/memory/regenerate`.

The copy promise ("Regenerate") and the handler ("navigate to another view") are inconsistent. Founder user tests will almost certainly hit this as a dead-end.

**Fix:** Two options, pick one:
- Change the handler to actually regenerate: `onClick={async () => { await fetch("/api/memory/regenerate", { method: "POST" }); router.refresh(); }}` (with a pending-state and toast). Keep the "Regenerate" label.
- Change the label to match the handler: `emptyMemoryBrowseCtaOpenGraph: "Open graph view"` (founder) / `"Switch to graph tab"` (dev). Keep `router.push("/memory?view=graph")`.

Option 1 is better UX — the graph tab's RegenerateButton already encapsulates the debounce + toast pattern; re-use it here.

### IN-02 [P2]: `palette-trigger` hardcodes `⌘` on all platforms

**File:** `dashboard/components/palette/palette-trigger.tsx:28-35`

**Issue:** The palette trigger button always renders `<kbd>⌘</kbd><kbd>K</kbd>` as the hint chips, regardless of whether the user is on mac, windows, or linux. The keybinding handler (`use-command-palette.tsx:48-49`) correctly accepts Ctrl+K as a fallback on non-mac platforms, but the visual affordance lies to non-mac users about which key to press. Audit notes 12-AUDIT-NOTES.md:117 flagged this as an open ticket for Phase 13.

Given this trigger isn't currently mounted in top-nav (only `ShortcutHelpButton` is — see `top-nav.tsx:46`), the impact is deferred. But the overlay ALSO shows `⌘K` as the chip for `palette.open` (`keybindings.ts:27`), which IS rendered and IS platform-blind.

**Fix:** Detect platform once at module load and render conditionally:

```tsx
// components/palette/palette-trigger.tsx
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
// ...
<kbd>{isMac ? "⌘" : "Ctrl"}</kbd><kbd>K</kbd>
```

For the overlay, either (a) add a second KEYBINDINGS entry `palette.open.win: ["Ctrl","K"]` and filter by platform, or (b) teach `ShortcutOverlay` to substitute `⌘` → `Ctrl` on non-mac at render time. Option (b) is cheaper.

### IN-03 [P3]: `staticCommandItems` silently no-ops toggle commands

**File:** `dashboard/lib/palette/actions.ts:86-97`

**Issue:** `staticCommandItems(ctx)` is a thin wrapper around `buildStaticCommands(ctx, { toggleExplain: ctx.close, toggleDev: ctx.close, openShortcuts: ctx.close })`. If anything outside the palette build path imports `staticCommandItems` directly (the symbol is re-exported from `index-sources.ts:10`), clicking "Toggle Explain Mode" / "Toggle Dev Mode" / "Open Keyboard Shortcuts" will silently close the palette without toggling anything. A comment at line 87-90 notes this trade-off but it's still a latent footgun for a symbol with an inviting name.

Currently `CommandPalette` goes through `buildPaletteIndex` → `buildStaticCommands(ctx, toggles)` with real toggles, so no live consumer is broken. But `staticCommandItems` is re-exported from `index-sources.ts` and could trick future callers.

**Fix:** Either remove the no-op wrapper entirely (callers who need static commands should call `buildStaticCommands` directly with explicit toggles), or throw when any toggle is invoked in no-op mode:

```ts
export function staticCommandItems(ctx: PaletteSourceContext): PaletteItem[] {
  const errorOnToggle = () => {
    throw new Error("[palette] staticCommandItems cannot toggle — use buildStaticCommands with real toggles");
  };
  return buildStaticCommands(ctx, {
    toggleExplain: errorOnToggle,
    toggleDev: errorOnToggle,
    openShortcuts: errorOnToggle,
  });
}
```

### IN-04 [P3]: `use-command-palette.tsx` will crash if `palette.open.keys` is empty

**File:** `dashboard/lib/hooks/use-command-palette.tsx:48`

**Issue:** The Ctrl+K fallback extracts `const lastKey = kb.keys[kb.keys.length - 1].toLowerCase();` unconditionally. If a future edit to `KEYBINDINGS` sets `palette.open.keys: []` by accident, `kb.keys[-1]` is `undefined` and `.toLowerCase()` throws — on every subsequent keydown, which would freeze the app's global keyboard handling.

`matchesKeydown` handles the empty-keys case gracefully (returns false early), but the Ctrl+K fallback bypasses that safety. Low probability of ever firing, but a trivial hardening.

**Fix:**

```ts
if (kb.keys.length === 0) {
  console.error("[palette] palette.open has no keys defined");
  return;
}
const lastKey = kb.keys[kb.keys.length - 1].toLowerCase();
```

Or reuse `matchesKeydown`'s empty-guard and gate the fallback on the same check.

### IN-05 [P1, scope-note — pre-existing]: Palette fetches unauthenticated API endpoints

**File:** `dashboard/middleware.ts:13-24`, `dashboard/app/api/queue/route.ts`, `dashboard/app/api/agents/route.ts`, `dashboard/app/api/workflows/route.ts`

**Issue:** The middleware matcher includes only two `/api/*` paths — `/api/tail` and `/api/state` (added by CR-03 in phase 11-REVIEW). The following endpoints, which the command palette now fetches on every `Cmd+K`, are neither in the matcher nor contain inline `auth()` checks:

- `GET /api/queue` (returns queue state — task IDs, projects, titles)
- `GET /api/agents` (returns agent roster — names, roles, telemetry)
- `GET /api/workflows` (returns all saved workflow records)
- **`POST /api/workflows`** (accepts YAML and writes a workflow file — no auth, no rate limit)

Any unauthenticated request to the Next origin can enumerate queue/agent/workflow state and create new workflows. In production behind a Caddy/Tailscale gate this is mitigated at the network layer, but defense-in-depth is the pattern already established for `/api/tail`, `/api/state`, `/api/changes`, `/api/memory/*`, and `/api/chat/*`.

This is **not new in phase 12** — the endpoints predate this phase. However, phase 12's palette now depends on three of them, materially expanding the "discoverable attack surface": Eric's Phase 13 UI auditor and any Playwright probe will hit these endpoints on every palette open, and the lack of auth means any Hermes bridge or external caller can script against them.

**Fix:** Add to `middleware.ts` matcher:

```ts
export const config = {
  matcher: [
    "/plan/:path*",
    "/build/:path*",
    "/memory",
    "/metrics",
    "/floor",
    "/floor/:path*",
    "/api/tail",
    "/api/state",
    "/api/queue",       // enumerates active tasks
    "/api/agents",      // enumerates agent roster + telemetry
    "/api/workflows",   // GET enumerates, POST writes — both need auth
    "/api/workflows/:path*",  // /run endpoint in the [slug] subdir
  ],
};
```

Verify each route still works for authenticated sessions (no regressions in existing tests), then audit `/api/workflows/[slug]/run` for CSRF protection separately since it mutates state.

Recommend tracking this as a first-class Phase 13 hardening task rather than a 12-fix; scoping here to flag visibility.

---

## Learnings for AGENTS.md

- **KeyboardEvent.key is layout-aware.** When registering chorded shortcuts with punctuation (`.`, `/`, `,`, `1`) plus Shift, the resulting `e.key` is the *shifted character* (`>`, `?`, `<`, `!`), not the unshifted one. Test with real browser events, not just `new KeyboardEvent({ key: ".", shiftKey: true })`. Pattern: either register the shifted character in `KEYBINDINGS`, or compare against `e.code` (physical key) instead of `e.key` (character).
- **EmptyState primitive is opinionated about "empty" vs "loading".** Use it only when data has resolved AND is genuinely empty. For pre-resolution rendering, prefer a dedicated `LoadingCard` or skeleton. When migrating existing loading copy to `<EmptyState>`, preserve the loading/empty distinction at the branch level, don't collapse both into `!data`.
- **CTA label ↔ handler parity.** When a button label contains an action verb ("Regenerate", "Delete", "Publish"), the handler should perform that action directly, not navigate elsewhere to find the real button. Reviewers should grep button `onClick={() => router.push(...)}` paired with action-verb labels.
- **Platform-blind key chips leak a mac assumption.** Any user-visible `<kbd>⌘</kbd>` must be platform-gated against `navigator.platform` / `userAgentData.platform`. Centralize in a `<Kbd modifier="cmd-or-ctrl" />` helper if this pattern recurs.
- **Middleware matcher is an allowlist, not a denylist.** New `/api/*` routes default to unauthenticated. Add a CI lint that fails if any `app/api/**/route.ts` is neither in the middleware matcher nor contains an inline `auth()` check — preventing future regressions like the pre-existing `/api/queue` / `/api/agents` / `/api/workflows` gap.

---

_Reviewed: 2026-04-22T19:41:31Z_
_Reviewer: Claude Opus 4.7 (cae-sentinel persona)_
_Depth: standard_
_Test suite: 63 phase-12 tests green; TypeScript clean on phase-12 files_
