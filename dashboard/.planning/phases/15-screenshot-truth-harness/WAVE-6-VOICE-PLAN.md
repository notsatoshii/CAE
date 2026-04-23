# Wave 6 — Voice + Character pass (Cycle 19)

Closes Eric's "no character" + generic-error-page complaints. After Wave 2 EmptyState lands the primitives, Wave 6 makes EVERY surface speak with personality.

## Voice principles

1. **Direct, not corporate.** "Queue is clear" beats "There are no items in your queue."
2. **Action-oriented when relevant.** Empty/error always offers a next step.
3. **Slight wit when safe.** "Either nothing's queued, or your agents are blazing fast." Not "wacky." Not "stiff."
4. **Acknowledge state, not blame.** "Tokens haven't been recorded" not "Token data unavailable due to upstream issue."
5. **Founder-first language.** "Your agents" not "the agents." "What's running now" not "Active processes."
6. **Dev-mode toggle adds context.** Same surface, with explain mode on, shows raw IDs / paths / SHAs as parenthetical.

## 6.1 — Voice audit + rewrite of every empty/error/loading

**Action:** scan all components for these copy patterns:
```bash
grep -rn 'No data\|no data\|empty\|Loading\|Error\|Failed' components/ app/
```

For each match, rewrite to character voice. Use `lib/copy/voice.ts` as the new source-of-truth dictionary.

**Surfaces to cover:**
- Every existing EmptyState already covered via EMPTY_COPY (Wave 2.6) — verify each entry passes voice principles
- Every error toast — replace "Failed to load X" with "X didn't load — check the audit log" + retry CTA
- Every loading copy — replace "Loading..." with surface-specific shimmer, no text
- Every confirmation dialog — make the question specific ("Abort task X?" not "Are you sure?")
- Every disabled-button tooltip — say WHY ("You're a viewer; ask an operator to run this" not "Disabled")

**Tests:** snapshot all rewritten copy strings; assert non-generic regex (no /loading\.\.\.|no data|error/i alone).

**Commit:** `style(voice): rewrite N empty/error/loading copy strings with character`

## 6.2 — Loading shimmer with branded animation

**Component:** `components/ui/branded-shimmer.tsx`

**Render:** subtle CAE-accent gradient sweeping across skeleton boxes. Slower than default tw-animate-css pulse — 2s cycle. Looks intentional, not loading-spinner-tier.

**CSS:**
```css
@keyframes cae-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.cae-shimmer {
  background: linear-gradient(90deg,
    var(--surface-hover) 0%,
    var(--surface-hover) 40%,
    var(--accent-muted) 50%,
    var(--surface-hover) 60%,
    var(--surface-hover) 100%);
  background-size: 200% 100%;
  animation: cae-shimmer 2s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
  .cae-shimmer { animation: none; background: var(--surface-hover); }
}
```

**Adoption:** swap `animate-pulse` (current) for `cae-shimmer` in skeleton primitives + key loading states.

**Commit:** `feat(branded-shimmer): subtle CAE-accent shimmer replaces generic pulse`

## 6.3 — Confirm dialog standardization

**Component:** `components/ui/confirm-action-dialog.tsx` (extend existing if present, otherwise new)

**Standard pattern:** title (specific), body (impact statement), primary action (named verb, not "Confirm"), secondary action ("Cancel"). Destructive = red border + red primary.

**Adopt across:** abort task, delete schedule, uninstall skill, revert phase, force-stop workflow.

**Commit:** `refactor(confirm-dialog): unify destructive/safe variants + named verbs`

## 6.4 — Tooltip standardization

**Component:** wrap base-ui Tooltip in `components/ui/info-tooltip.tsx` (or extend existing ExplainTooltip)

**Standard pattern:** 300ms delay, 8px offset, max 240px width, rich-formatted markdown allowed. Include "kbd shortcut" inline when applicable.

**Adopt:** every disabled element, every icon-only button, every metric tile.

**Commit:** `refactor(tooltips): standardize delay/offset/width across surfaces`

## 6.5 — Toast standardization

**Component:** Sonner is already in project (seen in app/layout.tsx Toaster).

**Standard variants:**
- `toast.success(msg)` — green check icon, 3s auto-dismiss
- `toast.error(msg, { action: { label: "Retry", onClick } })` — red X icon, sticky until dismissed
- `toast.info(msg)` — accent dot icon, 4s auto-dismiss
- `toast.loading(msg)` — spinner icon, replaces with success/error on completion

**Adopt:** every action handler — replace inline alert/console with toast.

**Commit:** `refactor(toasts): unify Sonner usage with named variants + retry actions`

## 6.6 — Wave 6 acceptance

- [ ] tsc clean
- [ ] All affected tests pass
- [ ] Eric: no surface ever shows "Loading..." text alone; every empty has next-step CTA; every error suggests recovery; every dialog asks specific question

## Sequencing

Single agent — all sub-tasks are pure copy/style work, tightly coupled, low file conflict risk.

## Acceptance gate

Eric live walkthrough — pick 5 random routes, verify each has character.
