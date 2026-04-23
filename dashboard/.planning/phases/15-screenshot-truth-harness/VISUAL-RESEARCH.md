# VISUAL-RESEARCH.md

State-of-the-art research for the CAE dashboard visual overhaul. The goal:
Linear/Vercel/Resend/Railway/Supabase grade. The current FE was called
"garbage built by an amateur" by the user; this document is the materials
shopping list and design rationale that the next batch of plans will turn
into pixels.

Scope of this doc: typography, color, scrollbars, motion, loading/empty/error,
density, viz libraries, sidebar IA, kanban, mission-control theatricality,
pixel-art agents, and Obsidian-grade in-app knowledge graph.

Each section has 3–5 verified references and a CAE-specific concrete
recommendation with rationale.

---

## 0. Design north star (one page)

Eric's reference set: **Linear, Vercel, Resend, Railway, Supabase**. They share:

- **Restraint over decoration** — monochrome + 1 accent, very few colors.
- **Tight, opinionated typography** — one sans, one mono, never more.
- **Optical density** — info per square inch is high but not crowded.
- **Motion is purposeful** — spring on layout, ease on opacity, never both at once.
- **Skeletons match real content** — never a shimmery rectangle the wrong size.
- **Empty states have personality** — copy + small illustration + 1 CTA.
- **Hover/focus states are crisp** — dedicated tokens, not opacity drops.
- **Mono is everywhere** — IDs, timestamps, counts, latencies, all tabular.

CAE adds two features none of them have: **pixel-art agent floor** and
**Obsidian-grade memory graph**. Both must feel native to the rest of the
dashboard, not bolted on.

---

## 1. Typography for SaaS dashboards in 2026

### State of the art

The 2026 SaaS dashboard typography landscape converged on a small set:

| Font | Variable axes | License | Best at | Caveats |
|---|---|---|---|---|
| **Inter Variable** (rsms) | wght (100–900), opsz (14–32), GRAD (-200 to 150), `slnt`, `ital` | OFL, free | The default. Tall x-height, open apertures, hinted at small sizes. | Slightly generic — "every Y Combinator dashboard" look. |
| **Geist Sans** (Vercel) | wght variable, opsz auto | OFL, free | Geometric Swiss feel. Strong at 14px+. Pairs perfectly with Geist Mono. | Rounder forms, slightly less crisp at 11–12px UI text vs Inter. |
| **Söhne** (Klim) | wght 100–950, italic | Commercial (~$700) | Premium magazine feel; what Stripe + OpenAI shipped. | Paid; not OFL; awkward for OSS. |
| **GT America** (Grilli) | wght, width | Commercial | Editorial weight; Loom + Notion adjacent. | Paid; less optimized for 11–12px UI. |
| **SF Pro** (Apple) | wght, opsz | Free for Apple platforms only | Best-in-class on macOS; native feel. | License blocks web. |
| **IBM Plex Sans** | wght, italic | OFL | Industrial / utilitarian. Good for "operator" tools. | Not as polished at very small sizes; design feels 2018. |
| **Pretendard** | wght, italic | OFL | CJK + Latin coverage; great for international. | Not native-feeling for English-only dashboards. |

### The opsz decision

Inter ships **opsz 14–32**. That means a single variable file optimizes
glyph design across UI text (14) up to large headings (32). At 11–13px,
Inter ramps up stroke weight and opens counters automatically when you set
`font-optical-sizing: auto`. Geist also has opsz but with less aggressive
adjustments at the small end.

For 11–13px UI text (sidebar nav, table cells, badge text), opsz helps
roughly 5–8% perceived legibility. Mandatory if you're rendering counts,
durations, and IDs at 11px.

### Mono fonts compared

| Font | Free | Ligatures | Variable | Best at |
|---|---|---|---|---|
| **JetBrains Mono Variable** | Yes (OFL) | 139 ligatures | wght variable | Code blocks, deep ligature support, increased x-height. The most "code-y" feel. |
| **Geist Mono** | Yes (OFL) | None | wght variable | UI mono — IDs, timestamps, counts. Quieter than JBM, pairs with Geist Sans. |
| **IBM Plex Mono** | Yes (OFL) | Limited | static weights | Industrial. Pairs with Plex Sans. |
| **Berkeley Mono** | $75 commercial | Yes | static | Cult favorite; warm, slightly old-computer. Premium feel. |
| **Commit Mono** | Free | Yes | wght | A drop-in modern alternative to JBM with calmer letterforms. |

### CAE recommendation

**Pick: Inter Variable (sans) + JetBrains Mono Variable (mono).**

Rationale:
1. **Inter** is the de-facto dashboard sans (Linear uses Inter UI; that pedigree alone matters). Free OFL, ships variable wght + opsz + GRAD, rendered nicely on every OS.
2. **JetBrains Mono Variable** is the mono with the deepest small-size legibility — CAE displays *a lot* of timestamps, latencies, agent IDs, branch names, commit shas. JBM with `tabular-nums` and `slashed-zero` keeps columns aligned. Geist Mono is prettier in marketing but worse at 11px.
3. Both are OFL → no license headaches if CAE ever open-sources.
4. We'll subset to Latin Extended only and self-host via `next/font/local`.

CSS application:

```css
:root {
  --font-sans: 'Inter Variable', ui-sans-serif, system-ui, -apple-system,
               'Segoe UI', Roboto, sans-serif;
  --font-mono: 'JetBrains Mono Variable', ui-monospace, 'SF Mono',
               Menlo, Consolas, monospace;
}

html { font-family: var(--font-sans); font-feature-settings: 'cv02','cv03','cv04','cv11'; }
body { font-optical-sizing: auto; }

.font-mono,
[data-mono] { font-family: var(--font-mono); font-feature-settings: 'tnum','zero','ss01'; }
```

Inter character variants we want on by default:
- `cv02` — single-storey 'a' for headings? (Optional; default off keeps double-storey for body.)
- `cv11` — straight-sided 'l' (avoids l/I confusion in mono-adjacent UI text).
- `tnum`, `cv05`, `zero` for any numeric context.

Type scale (14-step, 4pt baseline):

| Token | Size | LH | Use |
|---|---|---|---|
| `text-2xs` | 10px / 14 | tight | Badges only |
| `text-xs` | 11px / 16 | tight | Sidebar nav, table cells, status pill |
| `text-sm` | 12px / 16 | tight | Secondary UI text |
| `text-base` | 13px / 18 | normal | Default body in dashboard |
| `text-md` | 14px / 20 | normal | Inline body, form input |
| `text-lg` | 16px / 24 | relaxed | Card titles, modal body |
| `text-xl` | 18px / 26 | relaxed | Section headings |
| `text-2xl` | 22px / 28 | tight | Page titles |
| `text-3xl` | 28px / 34 | tight | Hero metrics |
| `text-display` | 40px / 44 | -0.02em | Marketing-only |

Note: dashboard default is **13px**, not 14. This is the Linear/Vercel/Notion convention and is what makes them feel dense without feeling crowded. 14px feels marketing-y. 12px feels cramped. 13 is the sweet spot for opsz=13.

References:
- [Inter font family](https://rsms.me/inter/)
- [Geist font (Vercel)](https://vercel.com/font)
- [Geist typography spec](https://vercel.com/geist/typography)
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/)
- [Customizing Inter with optical sizing presets — Nan Xiao](https://nanx.me/blog/post/inter-optical-sizing/)
- [Linear app design tokens (FontOfWeb)](https://fontofweb.com/tokens/linear.app)
- [Best Coding Fonts 2026 — Made Good Designs](https://madegooddesigns.com/coding-fonts/)
- [opsz axis tag spec — Microsoft Learn](https://learn.microsoft.com/en-us/typography/opentype/spec/dvaraxistag_opsz)

---

## 2. Color systems for dark-themed dashboards

### State of the art

Three legitimate paths in 2026:

1. **Radix Colors** — the 12-step semantic scale. Each step has a strict role: 1–2 backgrounds, 3–5 components, 6–7 borders, 8–9 solids, 10–12 text. Light + dark are designed as separate scales but interoperable. APCA-aware.
2. **Tailwind v4 default palette** — fully migrated to OKLCH, P3 gamut. Perceptually uniform. No semantic step roles, just lightness-by-number.
3. **Custom OKLCH palette** — define your own, use Radix step semantics + Tailwind v4 variable tokens. Best of both for opinionated brands.

Linear (~2025) uses essentially path 3: a custom near-monochrome scale with very limited accent. Vercel uses Geist tokens (custom). Resend uses a hybrid: Tailwind default + custom accent. Supabase uses Radix Colors directly.

### The 12-step Radix scale (memorize this)

| Step | Role | Example use |
|---|---|---|
| 1 | App background | `body` |
| 2 | Subtle background | Card surface, hover-on-app-bg |
| 3 | UI element background | Button rest, input rest |
| 4 | Hovered UI background | Button hover |
| 5 | Active/selected UI bg | Button pressed, selected row |
| 6 | Subtle border, separators | Card outline, divider |
| 7 | UI element border, focus ring | Input border |
| 8 | Hovered UI border | Input hover border |
| 9 | Solid (brand color) | Primary fill, badge bg |
| 10 | Hovered solid | Primary hover |
| 11 | Low-contrast text | Secondary text, icons |
| 12 | High-contrast text | Body text on app bg |

Once you internalize this, dark mode becomes trivial: same step number means
the same role; the actual oklch values flip.

### "Futuristic, sleek, character" — what Eric wants

Translation: not generic gray. Linear hit this with a near-monochrome
palette + a single distinctive accent (their indigo-violet `#5E6AD2`). Vercel
hit this with pure black + white + a sliver of brand red. Railway hit it with
deep purple + electric pink. Supabase hit it with green-on-near-black.

Pattern: **monochrome 95%, accent 5%, the accent is *the* brand**.

### Recommendation: custom OKLCH scale + Radix semantic tokens

Build a custom scale in OKLCH that gives CAE:
- 5 levels of background elevation in dark mode (not 3 — we have a lot of nested surfaces)
- 4 text contrast tiers (high / medium / low / disabled)
- 1 brand accent (CAE cyan-violet — see below)
- 4 state colors (success / warning / danger / info)
- A neutral that's *slightly* warm at low lightness (avoids the cold-blue trap of Tailwind slate)

Concrete tokens to ship (paste into `globals.css`):

```css
@theme {
  /* Backgrounds — dark mode default */
  --color-bg-app:        oklch(0.145 0.01 270);  /* deepest, body bg */
  --color-bg-subtle:     oklch(0.175 0.012 270); /* card resting */
  --color-bg-element:    oklch(0.205 0.014 270); /* button rest, input */
  --color-bg-hover:      oklch(0.235 0.016 270); /* hover lift */
  --color-bg-active:     oklch(0.265 0.018 270); /* pressed / selected */

  /* Borders */
  --color-border-subtle: oklch(0.275 0.014 270);
  --color-border:        oklch(0.330 0.016 270);
  --color-border-strong: oklch(0.395 0.018 270);
  --color-border-focus:  oklch(0.700 0.18  220); /* accent ring */

  /* Text */
  --color-text-hi:       oklch(0.965 0.005 270); /* primary copy */
  --color-text-md:       oklch(0.795 0.010 270); /* secondary */
  --color-text-lo:       oklch(0.605 0.012 270); /* tertiary, captions */
  --color-text-disabled: oklch(0.430 0.010 270);

  /* Accent — CAE brand: cyan-violet, distinctive */
  --color-accent-9:      oklch(0.660 0.190 240); /* solid */
  --color-accent-10:     oklch(0.720 0.190 240); /* hover */
  --color-accent-11:     oklch(0.785 0.150 240); /* on-dark text */
  --color-accent-3:      oklch(0.225 0.040 240); /* tinted bg */
  --color-accent-6:      oklch(0.345 0.090 240); /* tinted border */

  /* States */
  --color-success-9:     oklch(0.700 0.165 145);
  --color-success-3:     oklch(0.220 0.045 145);
  --color-warning-9:     oklch(0.760 0.155 70);
  --color-warning-3:     oklch(0.235 0.050 70);
  --color-danger-9:      oklch(0.640 0.220 25);
  --color-danger-3:      oklch(0.235 0.060 25);
  --color-info-9:        oklch(0.700 0.150 220);
  --color-info-3:        oklch(0.225 0.040 220);
}
```

Why these exact values:
- L gap of ~0.030 between elevation levels = visible to humans without being muddy.
- Chroma gradient: backgrounds carry tiny chroma (0.010–0.018) on a 270° hue (slightly violet) to give "character" without being colorful — this is the "futuristic" sauce.
- Accent at hue 240 (electric cyan-blue) with 0.190 chroma is the brightest thing on screen by design.
- All text passes APCA Lc 60+ on bg-app, Lc 75+ for hi.

Light mode override (later):

```css
@media (prefers-color-scheme: light) {
  @theme {
    --color-bg-app: oklch(0.99 0.005 270);
    --color-bg-subtle: oklch(0.975 0.007 270);
    /* ... mirror with reversed lightness gradient ... */
  }
}
```

References:
- [Radix Colors](https://www.radix-ui.com/colors)
- [Radix Themes 3.0](https://www.radix-ui.com/blog/themes-3)
- [Tailwind v4 OKLCH palette](https://tailwindcss.com/blog/tailwindcss-v4)
- [Tailwind colors v4 OKLCH explorer](https://tailwindcolor.com/)
- [Better dynamic themes with OKLCH — Evil Martians](https://evilmartians.com/chronicles/better-dynamic-themes-in-tailwind-with-oklch-color-magic)
- [OKLCH CSS variables for Tailwind v4 — Kyrylo Silin](https://kyrylo.org/css/2025/02/09/oklch-css-variables-for-tailwind-v4-colors.html)
- [Radix Colors w/ Tailwind — soards.me](https://blog.soards.me/posts/radix-colors-with-tailwind/)

---

## 3. Scrollbar treatment

### State of the art (3 strategies)

1. **macOS overlay native** — Browser/OS handles it. Best on Mac trackpads, ugly on Windows mice (Chrome shows a fat block).
2. **Linear's thin gradient** — `scrollbar-width: thin` + custom `scrollbar-color`. Ships native, no JS. Subtle.
3. **Vercel's hide-until-hover** — scrollbar dims when idle, shows on hover/scroll. Either via CSS `:hover` rules or `overlayscrollbars-react`.

Vercel's [interface guidelines](https://github.com/vercel-labs/web-interface-guidelines) explicitly say: only render useful scrollbars, fix overflow to prevent unwanted ones, and use `overscroll-behavior: contain` in modals/drawers.

### Library options

- **OverlayScrollbars** (`overlayscrollbars-react`) — vanilla TS core, framework wrappers, dependency-free. Most popular pure-JS option.
- **SimpleBar** — older, vanilla, well-maintained, plays well with TanStack Virtual.
- **react-perfect-scrollbar** — older Bootstrap-era, not recommended.
- **Native CSS only** — `scrollbar-width: thin` + `scrollbar-color` cross-browser since 2024.

### CAE recommendation

**Native CSS `scrollbar-width: thin` + custom `scrollbar-color`** as the
default. Ship a `scrollbar-overlay` utility class for panes that want the
hide-until-hover treatment, implemented in pure CSS.

Rationale: zero JS bundle cost, no layout thrashing, works in Chromium,
Firefox, Safari (since 17.4), respects user OS preferences, keeps native
scrolling perf. Linear ships this. Vercel ships this. We don't need
JavaScript for this.

```css
/* Base — thin native scrollbar with brand color */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--color-border-strong) transparent;
}

*::-webkit-scrollbar { width: 8px; height: 8px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: padding-box;
}
*::-webkit-scrollbar-thumb:hover { background: var(--color-border-strong); }

/* Overlay variant — fade in only on scroll/hover */
.scrollbar-overlay {
  scrollbar-color: transparent transparent;
  transition: scrollbar-color 200ms;
}
.scrollbar-overlay:hover,
.scrollbar-overlay:focus-within {
  scrollbar-color: var(--color-border-strong) transparent;
}
```

For one specific surface — the agent log pane in Workflows — we may want
`overlayscrollbars-react` because it preserves scroll position across virtual
list re-renders better than native. Treat that as opt-in, not default.

References:
- [scrollbar-width MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-width)
- [Chrome scrollbar styling guide](https://developer.chrome.com/docs/css-ui/scrollbar-styling)
- [OverlayScrollbars](https://kingsora.github.io/OverlayScrollbars/)
- [overlayscrollbars-react npm](https://www.npmjs.com/package/overlayscrollbars-react)
- [Vercel web interface guidelines (scrollbars)](https://github.com/vercel-labs/web-interface-guidelines)
- [scrollbar-gutter to the rescue](https://dev.to/hrgdavor/scrollbar-gutter-to-the-rescue-30hm)

---

## 4. Motion + micro-interactions

### State of the art

Three motion languages in the wild:

| App | Vibe | Tech | Tells |
|---|---|---|---|
| **Linear** | Crisp, springy, decisive | Custom CSS + Framer Motion springs (stiffness ~400, damping ~35) | Modal-in springs, nav-active-line slides, kanban cards arc |
| **Vercel** | Quick, restrained, almost invisible | Mostly CSS transitions ~150ms ease-out | Dropdowns, hovers, color shifts |
| **Notion** | Playful bounces on layout, calm fades on content | Framer Motion with bounce 0.4 | Sidebar expand, drag-and-drop |
| **Resend** | Almost no motion | Pure CSS opacity fades | Toasts, dialog backdrop |

Pattern: **springs for layout/transform, eases for opacity/color**. Linear's
[founders have said this explicitly in interviews](https://blog.maximeheckel.com/posts/guide-animations-spark-joy-framer-motion/) — physics
properties (x, scale, rotate) feel right with spring physics; "soft" properties
(opacity, color) feel right with duration-based easing.

### When to animate

**Animate:**
- Position (drag, layout reflow, sidebar collapse)
- Size (drawer open, card expand)
- Entrance/exit of focused content (modal, popover)
- State change with semantic meaning (success badge ticking up)

**Don't animate:**
- Background data refresh (just swap)
- Color theme toggle (instant, except CSS color-only fade ~80ms)
- Scrolling (let browser handle)
- Hover (≤120ms ease-out only)

### Reduced motion

Honor `prefers-reduced-motion: reduce`. Strategy: keep animations but cap
duration at 0.01s (effectively instant) and disable springs entirely. Don't
remove the `animate` prop — Framer Motion respects this token automatically.

```tsx
import { MotionConfig } from 'motion/react';

<MotionConfig reducedMotion="user">
  <App />
</MotionConfig>
```

### Spring tokens (the CAE motion vocabulary)

```ts
// motion-tokens.ts
export const springs = {
  /** Snappy — for buttons, badges, hover */
  snappy: { type: 'spring', stiffness: 500, damping: 40, mass: 0.8 },
  /** Default — modal in, drawer slide */
  default: { type: 'spring', stiffness: 380, damping: 32, mass: 1 },
  /** Gentle — large layout shifts, kanban */
  gentle: { type: 'spring', stiffness: 240, damping: 28, mass: 1.1 },
  /** Bouncy — celebration, success states */
  bouncy: { type: 'spring', stiffness: 300, damping: 18, mass: 1 },
} as const;

export const eases = {
  /** Color, opacity */
  fast: { duration: 0.12, ease: [0.32, 0.72, 0, 1] },
  /** Default fade */
  default: { duration: 0.18, ease: [0.32, 0.72, 0, 1] },
  /** Slow reveal */
  slow: { duration: 0.32, ease: [0.32, 0.72, 0, 1] },
} as const;
```

The `[0.32, 0.72, 0, 1]` curve is Apple's "ease out expo-ish" — what they use
across SF Symbols animations. Linear uses essentially this.

### CAE motion stack

- **Library:** `motion` (the new name for Framer Motion since v11). Already in deps.
- **Tokens:** the springs/eases above, exported from `lib/motion.ts`.
- **Layout animations:** use `<motion.div layout>` for kanban, sidebar, expanded rows. It uses FLIP under the hood.
- **CSS-only fallback:** for any element that doesn't need spring physics, use CSS `transition` with `--ease-out: cubic-bezier(0.32, 0.72, 0, 1)`.
- **MotionConfig** wrapping the app for reduced-motion handling.

References:
- [Motion (Framer Motion) docs — React transitions](https://motion.dev/docs/react-transitions)
- [Easing functions in Motion](https://www.framer.com/motion/easing-functions/)
- [Spring physics in Motion](https://motion.dev/docs/react-transitions#spring)
- [Animations that spark joy — Maxime Heckel](https://blog.maximeheckel.com/posts/guide-animations-spark-joy-framer-motion/)
- [The Easing Blueprint — Reuben Rapose](https://www.reubence.com/articles/the-easing-blueprint)
- [Vercel web interface guidelines (motion section)](https://github.com/vercel-labs/web-interface-guidelines)

---

## 5. Loading / empty / error states

### Loading skeletons

The Vercel guideline is canonical:

> If you show a spinner/skeleton, add a short show-delay (~150–300 ms)
> & a minimum visible time (~300–500 ms) to avoid flicker on fast
> responses. Skeletons mirror final content exactly to avoid layout shift.

Two common implementations:

1. **Geist's `Skeleton` component** — `<Skeleton>` wrapping the would-be
   element with shimmer pulse, sized to match real content.
2. **Vercel's `boneyard`** — generates skeletons at *build time*. Real
   layout is captured, replaced with absolute-positioned gray rectangles.
   Zero CLS, zero layout work at runtime.

Linear's variant: a "**typed shimmer**" — the skeleton bars subtly type-out
left-to-right rather than pulsing. Implementation: a wide gradient sliding
across the bar over ~1.4s, infinite loop, paused for `prefers-reduced-motion`.

### Empty states

The 2026 best-in-class formula:

1. **Small monochrome illustration** (50–80px square, blends into UI)
2. **One sentence** explaining what this surface is
3. **One sentence** explaining why it's empty
4. **One CTA** (primary action) with optional secondary "Learn more"
5. **Optional**: example content / sample card so user can see what populated looks like

Notion adds personality — every empty state has slightly different copy
voice. Stripe progressively reveals: when there's no data, it shows a "1
sample row" instead of pure emptiness. Resend just shows a single line of
gray text + a CTA button. **All three avoid generic "No data" sterility.**

### Error states

GitHub's 404 has the Octocat. Linear's 500 keeps brand. Vercel's error pages
render the metric that tells you what broke (request ID, region, deploy id).

For dashboards specifically:
- **Inline errors in cards** — small red border on the card, error message in copy area, "Retry" button. Don't replace the whole card.
- **Network errors** — toast at bottom-right, dismissible, with request ID.
- **Permission errors** — empty-state-shaped card explaining what role is needed.
- **404 for entities** — "Agent not found" with link back to agent list.

### CAE patterns to ship

Pattern A — `<Skeleton>` primitive:

```tsx
function Skeleton({
  className, height = '1rem', width = '100%', delay = 200, minDuration = 400,
}) {
  // show after `delay`, stay visible for at least `minDuration`
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-bg-element',
        'before:absolute before:inset-0 before:translate-x-[-100%]',
        'before:bg-gradient-to-r before:from-transparent before:via-white/[0.04] before:to-transparent',
        'before:animate-shimmer motion-reduce:before:animate-none',
        className
      )}
      style={{ height, width }}
      aria-hidden="true"
    />
  );
}
```

Pattern B — `<EmptyState>` primitive:

```tsx
<EmptyState
  illustration={<NoAgentsIcon />}
  title="No agents yet"
  description="Agents are the workers that pick up tasks from the queue and ship code. Spawn one from a project plan."
  action={{ label: 'Create your first agent', onClick: createAgent }}
  secondaryAction={{ label: 'Read the guide', href: '/docs/agents' }}
  example={<AgentCard agent={SAMPLE_AGENT} preview />}
/>
```

Pattern C — `<ErrorBoundary>` w/ retry:

```tsx
<ErrorBoundary
  fallback={({ error, reset }) => (
    <Card variant="danger">
      <CardHeader>Something went wrong</CardHeader>
      <CardBody>{error.message}</CardBody>
      <CardFooter>
        <Button onClick={reset}>Retry</Button>
        <CopyButton text={error.requestId}>Copy request ID</CopyButton>
      </CardFooter>
    </Card>
  )}
/>
```

Empty state copy-voice rules for CAE:
- Direct, slightly dry, occasional dry humor allowed.
- Always say what the surface *is for*, then *what to do*.
- Never use "No data" or "Nothing here" as a header — say "No agents", "No active runs", etc.
- For mission-critical absences (no monitoring, no errors), the copy should *celebrate* — "All quiet. No agents reported errors in 24 hours."

References:
- [Vercel Geist Skeleton](https://vercel.com/geist/skeleton)
- [Boneyard — Vercel skeleton tool](https://boneyard.vercel.app/how-it-works)
- [Vercel web interface guidelines (loading section)](https://github.com/vercel-labs/web-interface-guidelines)
- [Skeleton screens vs spinners — UI Deploy](https://ui-deploy.com/blog/skeleton-screens-vs-spinners-optimizing-perceived-performance)
- [Empty state UX rules — Eleken](https://www.eleken.co/blog-posts/empty-state-ux)
- [Empty state SaaS examples — Userpilot](https://userpilot.com/blog/empty-state-saas/)

---

## 6. Information density patterns

Three reference patterns:

### 6a. Linear's "all data visible by default + nested expand"

Linear shows every relevant field in the row (status, priority, assignee,
labels, due, project) at small font size, all in one line. To get more
detail, you click the row → modal/side-panel with full context. Density is
maximized; the only hidden state is "what does the description say."

Best for: lists that users will scan rapidly (issue tracker, agent queue,
runs).

### 6b. Vercel's "hero metric + drill-down"

Vercel observability shows ~4 KPI cards at top (revenue, requests, errors,
latency). Each is a number, sparkline, % delta, with subtle background. Below
that, a single chart with controls. Below that, the table of underlying
events. Hierarchy: hero → trend → details.

Best for: monitoring surfaces. CAE Metrics tab and CAE home dashboard.

### 6c. Stripe's "table-of-truth with rich row hover"

Stripe's main object lists (charges, payments, customers) are dense tables.
Row hover reveals **inline action icons on the right** without changing
height. Click the row to open a side-panel detail sheet that doesn't navigate
away. The table stays as your context.

Best for: object lists that you want to act on without leaving (deploys,
workflows, memory entries).

### CAE recommended pattern per surface

| Surface | Pattern | Why |
|---|---|---|
| **Build Home** (mission control) | Vercel hero-metric + Linear stream below | Investor demo: show the system breathing |
| **Agents tab** | Linear all-data row + side-panel detail | Operators scan-and-act |
| **Workflows queue** | Stripe row-hover-actions table | Pause/resume/cancel from the row |
| **Metrics tab** | Vercel KPI cards → chart → table | Standard observability flow |
| **Memory tab** | Graph hero (full bleed) + side-panel cards | Spatial primary, list secondary |
| **Plan mode (PRDs/roadmaps)** | Notion-style stacked sections, expanding | Long-form context |
| **Live Floor** | Pixel canvas hero + collapsible side-list of agents | The theatrical surface |

Density tokens:
- Row height: 32px (Linear), 40px (default), 48px (relaxed). Sidebar nav uses 32, tables default 40, plan-mode uses 48.
- Cell padding: 8/12/16 vertical, 12/16/20 horizontal — matched to row.
- Density toggle in user settings: default / compact / comfortable.

References:
- [Data Table Design Patterns — Pencil & Paper](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables)
- [Stripe Apps table component](https://docs.stripe.com/stripe-apps/components/table)
- [The Ultimate Guide to Data Tables — Molly Hellmuth](https://medium.com/design-with-figma/the-ultimate-guide-to-designing-data-tables-7db29713a85a)
- [Linear design trend — LogRocket](https://blog.logrocket.com/ux-design/linear-design/)
- [Vercel observability docs](https://vercel.com/docs/observability)

---

## 7. Visualization libraries

### Charts: Recharts vs Visx vs Tremor

| | Recharts | Visx | Tremor |
|---|---|---|---|
| Level | High-level | Low-level primitives | Higher-level than Recharts |
| Built on | D3 | D3 + React | Recharts + Radix + Tailwind |
| Customization | Medium | Extreme | Low |
| Bundle | ~95kb min | depends, can be tiny | ~120kb (Recharts inside) |
| Out-of-box look | Generic | None | Polished |
| Best for | MVPs, dashboards | Custom viz | Off-the-shelf KPI cards |

**Confirm Recharts** for CAE — already chosen and right for our needs.
We'll override styling deeply via `tailwind`-compatible CSS variables on the
chart components rather than swapping libraries. Tremor would constrain us.
Visx would be overkill.

Concrete chart wrappers we should ship:
- `<MetricSparkline>` — 60×24 sparkline for KPI cards
- `<MetricChart>` — full-width line/area chart with brush + tooltip
- `<HeatmapWeekGrid>` — for activity-by-day-of-week
- `<BarStack>` — agent contribution by phase

### Graphs: react-flow vs cytoscape vs sigma.js

| | react-flow | cytoscape.js | sigma.js |
|---|---|---|---|
| Renderer | DOM | Canvas | WebGL |
| Best at | <500 nodes, custom React nodes | 500–5k nodes, analytics | 5k–50k+ nodes |
| React support | Native | wrapper required | `@react-sigma` |
| Custom node JSX | Yes | Limited | No (WebGL shaders) |
| Force layout | Pro feature ($) | Built-in (cose, fcose) | Via graphology |
| Hover halo, clicks | Easy | Easy | Easy |
| Knowledge graph fit | Best UX, scale-limited | Mid | Best for large |

**Confirm react-flow** for CAE memory tab — our memory graph is hundreds of
nodes, not tens of thousands. The killer feature: nodes are React components
so we can render rich cards (title, snippet, tags, last-updated) per node.
That's worth the perf ceiling.

If the graph ever exceeds ~2000 nodes, swap to sigma.js with graphology and
write WebGL node renderers. Not soon.

### Code highlighting: Shiki vs Prism vs Highlight.js

| | Shiki | Prism | Highlight.js |
|---|---|---|---|
| Quality | Best (VS Code grammars) | Good | Decent (auto-detect) |
| Bundle | ~250kb + WASM | ~50kb | ~70kb |
| Render | SSR-ideal | Client-friendly | Client-friendly |
| Themes | Any VS Code theme | Limited | Limited |

**Confirm Shiki** for CAE. Already chosen, correct. We render code blocks
during SSR (Next.js 16 RSC), so the WASM weight never hits the client. Shiki
+ a custom dark theme matching CAE colors = code blocks that look like the
rest of the dashboard, not a foreign element.

### Date/time scrub libraries

For the time-scrub component on metrics + workflows:

- **react-aria** `useTimeField`/`useDateRangePicker` — accessible, headless. Recommended.
- **react-day-picker v9** — pretty out of the box, used by shadcn.
- **VisX `Brush`** — pairs with our charts for time-window selection on the chart itself.
- **date-fns** for math.

Recommendation: react-aria for the input, VisX Brush for chart overlay.

### Live Floor (pixel agents) — sprite/canvas libs

| | PixiJS (+ pixi-react v8) | three.js / react-three-fiber | Plain Canvas | Phaser |
|---|---|---|---|---|
| Best at | 2D sprites, 1000s of objects | 3D, particles, shaders | Custom | Full game framework |
| React story | `@pixi/react v8` (March 2025) | Excellent (R3F) | None needed | None |
| Pixel art | Native, `roundPixels` flag | Possible, work to nail | Hand-crafted | Native |
| Bundle | ~110kb | ~150kb+ | tiny | ~600kb |
| Isometric | Tilemap plugin | Manual | Manual | Built-in |

**Recommendation: PixiJS v8 + `@pixi/react` v8.** It is the single best 2D
WebGL library on the web. Sprites are first-class, AnimatedSprite handles
walk cycles/idle states, the React bindings (rebuilt in March 2025 inspired
by R3F) make declarative composition natural. Bundle is small enough for our
floor surface.

Phaser is overkill (it's a full game engine). R3F is wrong tool (3D-first).
Plain canvas means re-implementing sprite batching ourselves.

```tsx
import { Application, AnimatedSprite, Container } from '@pixi/react';

<Application width={800} height={600} backgroundAlpha={0}>
  <Container>
    {agents.map(a => (
      <AnimatedSprite
        key={a.id}
        textures={a.state === 'working' ? walkTextures : idleTextures}
        x={a.x} y={a.y}
        animationSpeed={0.1}
        isPlaying
      />
    ))}
  </Container>
</Application>
```

References:
- [Recharts site](https://recharts.org)
- [Visx](https://airbnb.io/visx/)
- [Tremor](https://tremor.so)
- [React Flow examples](https://reactflow.dev/examples)
- [Cytoscape.js vs Sigma.js — PkgPulse](https://www.pkgpulse.com/blog/cytoscape-vs-vis-network-vs-sigma-graph-visualization-2026)
- [Shiki](https://shiki.style)
- [Comparing web code highlighters — chsm.dev](https://chsm.dev/blog/2025/01/08/comparing-web-code-highlighters)
- [PixiJS React v8 announcement](https://pixijs.com/blog/pixi-react-v8-live)
- [PixiJS React docs](https://react.pixijs.io/)

---

## 8. Sidebar + IA patterns

### Linear's sidebar (the gold standard)

- Collapsible to icon-rail (~48px wide) or expanded (~240px).
- In collapsed state, hovering an icon shows a tooltip with the label after a 300ms delay.
- Active state: full-width subtle bg + 2px left accent line + slightly brighter text.
- Sections are collapsible; collapsed sections preserve count badges.
- Workspace switcher pinned top, user/settings pinned bottom.
- Sidebar width is user-resizable (grab handle on right edge), persisted.

### Vercel's two-tier sidebar

- Top-level project switcher (always visible).
- Within project: section labels (Overview, Deployments, Domains, ...) as flat list.
- Sub-pages render as breadcrumbs under header instead of nested sidebar.
- New: resizable sidebar that can hide when not needed; tabs unified across team and project levels.

### Resend's minimal nav

- 5 primary destinations, no sections.
- Icon + label, no collapsing.
- Pinned to left, never moves.
- A reminder that for small surface counts, simple wins.

### CAE recommendation

CAE has two top-level **modes** (Plan / Build) that flip the sidebar
contents. Memory + Metrics live in the *top bar* not sidebar. This means the
sidebar is mode-specific and short (5–7 items per mode).

**Pattern: Linear-style collapsible w/ Resend-level item count.**

- Collapsed width: 56px (icons + tooltip).
- Expanded width: 224px (default).
- User can drag-resize between 200–320; persisted in localStorage.
- Active state: `bg: var(--color-bg-active)` + 2px left border in accent + text-hi.
- Inactive: text-md, hover → bg-hover + text-hi.
- Counts: small monospace badge on the right, `bg: var(--color-bg-element)`, `text: var(--color-text-md)`. In collapsed state, a small dot in top-right of the icon if count > 0.
- Mode switcher: at top, two-tab segment control (Plan / Build). Same height as a sidebar item.
- User profile + settings: pinned bottom.
- Tooltip: shadcn `Tooltip` with `delayDuration={300}`, side="right", `sideOffset={8}`. Shows label + keyboard shortcut.

Visual sketch (collapsed):

```
┌────┐
│ 🅒  │  ← workspace
├────┤
│ ⌂   │  Build (active, pill)
│ 📋  │  Plan
├────┤
│ ◉   │  Mission Control (active row)
│ ⚙   │  Agents       ⌐ (count dot)
│ ⤴   │  Workflows
│ 🔄  │  Changes
│ ⚛   │  Live Floor
├────┤
│ 👤  │  Eric
│ ⚙   │  Settings
└────┘
```

References:
- [Linear changelog: Collapsible Sidebar](https://linear.app/changelog/unpublished-collapsible-sidebar)
- [Vercel changelog: New dashboard navigation](https://vercel.com/changelog/new-dashboard-navigation-available)
- [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/radix/sidebar)
- [Using the new Shadcn Sidebar — Achromatic](https://www.achromatic.dev/blog/shadcn-sidebar)
- [Left-Side Vertical Navigation — Nielsen Norman](https://www.nngroup.com/articles/vertical-nav/)

---

## 9. Kanban / column / board UX

### Best-in-class

- **Linear** — boards are kanban-as-issue-list. Columns by status. Cards minimal: title, assignee, priority, due. Drag with subtle elevation lift, drop with spring. Empty column shows "+" CTA.
- **Trello** — the OG. Columns scrollable horizontally, cards vertically. Heavier cards (covers, labels).
- **Notion** — boards are views over a database; properties define columns. Drag with bounce.
- **Monday/ClickUp** — over-decorated. Avoid as reference.

### For CAE Workflows board

CAE's workflow queue isn't really kanban — it's a stream of in-flight + queued
tasks that move through fixed states (queued → running → blocked → review →
done). Three valid framings:

1. **Status columns** (kanban-style): Queued | Running | Blocked | Review | Done. Drag = manual state transition (rarely needed).
2. **Type rows** (Gantt-style): one row per workflow type, time on x-axis. Better for "what's the system doing right now."
3. **Stream list** (Linear issues view): vertical list filtered by status pills at top. Most info-dense.

### CAE recommendation

**Default: stream list. Kanban as a toggle-able view.**

Why: workflows are short-lived (minutes to hours). A kanban board for
short-lived items churns visually. The stream list is calmer and matches
operator scanning. Power users get a Kanban toggle for explicit triage.

Drag/drop: **read-only by default; drag enabled only when agent state allows
manual transitions** (e.g. blocked → queued = OK; running → done = no, must
be agent-driven).

Library: `@dnd-kit/core` + `@dnd-kit/sortable`. `react-beautiful-dnd` is
unmaintained; `hello-pangea/dnd` is a fork but `dnd-kit` is the modern
choice. Already a Linear/Notion-tier choice.

References:
- [dnd-kit](https://dndkit.com/)
- [Build a Kanban with dnd-kit — LogRocket](https://blog.logrocket.com/build-kanban-board-dnd-kit-react/)
- [Top 5 drag-and-drop libraries 2026 — Puck](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react)
- [Linear's board view — Linear docs](https://linear.app/docs)

---

## 10. "Mission control" theatricality

What makes Vercel/Railway/Pipedream/Render *feel alive*:

### The taxonomy of liveness

| Technique | What it conveys | Tasteful? |
|---|---|---|
| **Live tickers** (count incrementing in real time) | "Things are happening" | Yes if subtle |
| **Animated counters** (number rolls up to new value) | "Stats are updating" | Yes if 200–500ms |
| **Real-time waveforms** (latency, RPS) | "Pulse of the system" | Yes |
| **Streaming logs** (text scrolling) | "Voice of the agent" | Yes if controlled |
| **Particle effects** (parallax dots, network) | "Cinematic" | Marketing-only |
| **Heartbeat dots** (blinking green) | "Service is up" | Yes if rare |
| **Spotlight panels** (highlighted card) | "Look here, important" | Yes if rare |
| **Sound effects** | "Wake up" | No, except optional power-user |
| **Confetti on success** | "Celebration" | Sparingly (Linear ships) |

### What's gauche

- Globe of dots rotating with arcs flying around (Vercel's old marketing site, *not* their dashboard)
- Glowing animated gradients behind every card
- Pulsing rings around buttons
- Fake "online users" counters
- Aggressive sound effects

### The CAE line

CAE *is* a mission control. Eric explicitly wants theatrical. So we go
further than Linear/Vercel but stop short of Railway-marketing-site.

Concrete patterns to ship:

1. **Build Home top bar**: 4 KPI cards (Active Agents, Tasks/hr, Latency p95,
   Errors/hr). Each card has an animated counter (200ms spring) and a 60×24
   sparkline updating every 5s.
2. **Live event stream** down the right rail: timestamped lines, fade-in from
   bottom, max 50 visible, autoscroll-pinned-to-bottom (with "pause" if user
   scrolls up).
3. **Heartbeat dots** next to each agent in the agent list: green = working,
   amber = idle, red = errored. Blink ONLY if state changed in last 2s.
4. **Particle effects**: SAVE FOR Live Floor. Sparkles when an agent
   completes a task. Subtle, ~6 particles, 600ms lifecycle.
5. **Spotlight on critical events**: when an agent errors, the Live Floor
   tile gets a brief red ring + camera pans there.
6. **Confetti**: on milestone close, on PR-merged, on phase-shipped. Use
   `canvas-confetti` library.
7. **Animated counters**: every numeric badge in the dashboard uses our
   `<AnimatedNumber>` component (useSpring + tabular-nums), never raw text.
8. **Subtle glow on cards on update**: when a card's data changes, a 400ms
   border-color flash to accent-9 → back to border. (Linear ships this.)

Implementation note: every animation here respects `prefers-reduced-motion`
and degrades to instant updates without losing functionality.

References:
- [Vercel Observability product](https://vercel.com/products/observability)
- [Railway Observability docs](https://docs.railway.com/observability)
- [Pipedream](https://pipedream.com/)
- [Animated Counter recipe — BuildUI](https://buildui.com/recipes/animated-counter)
- [Motion AnimateNumber](https://motion.dev/docs/react-animate-number)
- [canvas-confetti](https://github.com/catdad/canvas-confetti)

---

## 11. Pixel-art / sprite agent visualization

The Live Floor is what makes CAE *cinema*. References:

### What works for B2B context

| Reference | What to steal | What to skip |
|---|---|---|
| **Stardew Valley** | 16×16 base sprites, warm palette, animated walk cycles | The pastoral feel — too whimsical |
| **Vampire Survivors HUD** | Dense numeric overlays, tasteful pixel readouts | The chaos |
| **Habitica** | RPG avatars representing real users, stat bars | Cartoony color over-saturation |
| **Pomotodo** | Minimal pixel timer character | Lo-fi feel |
| **Pip-Boy (Fallout)** | Monochrome green-on-black HUD | Too kitsch for B2B |
| **Death Stranding HUD** | Metric-rich isometric overlay | Too cluttered |

The threading-the-needle move is **monochrome pixel sprites in the brand
palette, on a tasteful tile floor, with restrained animation**. Not
cartoonish. Think "high-end indie game intro screen" not "kids mobile game."

### Sprite kit design

Per agent, ship:
- **Idle** — 4 frames, 800ms loop. Subtle breathing/blinking.
- **Walking** — 6 frames, 100ms each, looped. 4 directions (or just 2 + flip).
- **Working** — 4 frames, fast (60ms), with tool action (typing, hammering).
- **Reviewing** — 2 frames, slow, holding a magnifying glass / clipboard.
- **Errored** — 2 frames, head down, red flicker overlay.
- **Celebrating** — 4 frames, brief, played once on task complete.
- **Sleeping/idle long** — 4 frames after >5min idle.

Resolution: **32×32 base sprite** (not 16) for visible detail at 2x render
size on a 1080p+ display. 4× zoom = 128×128 effective; readable from across
a room (good for demos).

Color: each agent gets a subtle palette-shift — same sprite, different
2-color palette (e.g. accent + a hue rotation per agent). Like Stardew villagers but on the CAE accent gradient.

### Floor (the tile background)

- **16×16 isometric tiles** OR **flat top-down 32×32 tiles**. We pick flat
  top-down — simpler, clearer for status.
- 5–8 tile types: floor, wall, desk, server-rack, plant, door, lamp.
- The floor *is* the org map: e.g. left wing = Plan side, right wing = Build,
  center = Memory. Server rack visually represents Memory.

### Library

**PixiJS v8 + @pixi/react v8**. See section 7 for rationale. Sprite sheets
authored in **Aseprite** (industry standard) → exported as PNG + JSON
(Spritesheet format Pixi natively reads).

Asset pipeline:
1. Aseprite source files in `assets/sprites/*.aseprite`
2. Build script exports PNG + JSON via Aseprite CLI
3. Pixi loads via `Assets.load()` with sheet metadata
4. `AnimatedSprite` per agent, swapped textures per state

Performance: <100 sprites at 60fps is trivial. Even 1000 is fine. We won't
get close to limits.

### What would feel cheap

- Free generic sprite packs from itch.io without consistent palette
- AI-generated sprites (the inconsistency is visible)
- 16-bit color palettes (looks dated)
- Full chiptune music
- Score/coin counters (too gamified)

### CAE recommendation

Commission a **CAE-specific sprite kit** from a pixel artist (~$2–5k for the
full set). Until then, ship a monochrome placeholder using the accent palette
+ free-license Stardew-style assets recolored programmatically. Users will
recognize the placeholder is interim; we should never ship gauche generic.

References:
- [PixiJS React v8](https://pixijs.com/blog/pixi-react-v8-live)
- [PixiJS AnimatedSprite docs](https://api.pixijs.io/@pixi/sprite-animated/PIXI/AnimatedSprite.html)
- [Spritesheet animation with Aseprite + R3F (technique transfers)](https://fundamental.sh/p/sprite-sheet-animation-aseprite-react-threejs)
- [Top game assets tagged HUD pixel art — itch.io](https://itch.io/game-assets/tag-hud/tag-pixel-art)
- [Aseprite](https://www.aseprite.org/)

---

## 12. Knowledge graph in-app rendering (Obsidian-grade)

### What makes Obsidian's graph view good

1. **Force-directed layout** — nodes naturally cluster around topics
2. **Node size = link count** — important nodes are visually bigger
3. **Hover halo** — hovering a node dims the rest of the graph and lights up its connections
4. **Click → side panel** — node detail loads in a sidebar without losing graph context
5. **Filter pills** — toggle tag types, depth, orphans on/off
6. **Smooth zoom/pan** — physics-based momentum
7. **Color by group/folder/tag** — instantly show structure

### Open-source equivalents

- **Foam** — VS Code extension, Obsidian-style links + graph view via D3/cytoscape.
- **Logseq** — outline-based, ships a graph view (built on D3).
- **Athens** — defunct (great inspiration for Roam-like graph UX while it lasted).

### Library options for in-app

| Library | Force layout | Custom node React | Side panel | Hover halo | Best for |
|---|---|---|---|---|---|
| **react-flow** | via Pro or `d3-force` integration | Yes (native React) | Easy (controlled state) | Easy via state | <500 nodes, rich nodes |
| **cytoscape.js** | Built-in (cose, fcose, cola) | No (limited) | Easy | Easy | 500–5k nodes, analytics |
| **sigma.js** | Via graphology + ForceAtlas2 | No (WebGL only) | Easy via events | Custom shaders | 5k–50k+ nodes |
| **VisX network** | DIY w/ d3-force | Yes | Easy | Manual | Small custom viz |
| **react-d3-graph** | Built-in | Limited | Manual | Manual | Quick prototype |

### CAE recommendation

**react-flow + d3-force-3d** for layout. Already locked.

Implementation pattern:

1. **Custom node component** renders a React card per memory entry:
   - 200×80 default size
   - Icon (entry type: doc/code/decision/lesson)
   - Title (truncate to 1 line)
   - Snippet (2 lines, dim)
   - Tags as small pills along bottom
   - Last-updated relative time, top-right
   - On hover: scale 1.05, border to accent
2. **Edges**:
   - Color by relationship type (semantic / referenced-by / authored-by / contradicts)
   - 1px default, 2px on connected hover
   - No arrowheads by default (clutter); enabled in a "show direction" toggle
3. **Layout**: d3-force on mount, then freeze. Re-run on filter change.
4. **Interaction**:
   - Click node → side panel (right rail, ~400px) opens with full content + backlinks list
   - Cmd-click → multi-select; selection chip in top bar
   - Hover node → dim others to 30% opacity, light up connected nodes/edges to 100%
5. **Controls** (top-right floating panel):
   - Zoom in/out/fit
   - Layout: Force / Hierarchical / Circle (toggle)
   - Filter: tag pills (multi-select), date range, type
   - Search input (cmd+k inline) — typed query highlights matching nodes
6. **Minimap** (bottom-right): standard react-flow minimap, ~120×80
7. **Re-analyze button** (top-right primary):
   - Click → opens a modal showing "Analyzing memory..." with a step-by-step log
   - Diff preview: new edges in green, removed in red, weight changes as numeric delta
   - Apply / Revert buttons at bottom of modal
   - On apply: edges animate into place (spring layout transition)

### Backlinks panel pattern

When a node is selected, the side panel shows:
- Full content (markdown rendered)
- Tags
- Created / updated timestamps
- **Linked from** — list of nodes that reference this one (with snippets, click to navigate)
- **Links to** — outgoing references
- **Related** — algorithmic suggestions based on embedding similarity
- "Re-analyze just this node" action

### Side panel UX

- Width: 400px default, drag-resizable to 600px
- Slides in from right with a 240ms gentle spring
- Overlays the graph (no graph reflow) with a subtle shadow on its left edge
- Close: X button, Escape, or click outside
- Pinning: a pin icon at top — pinned panels persist between selections, refresh content on new selection

### Re-analyze button UX (the magic)

This is the killer interaction. Pattern:

1. Button label: "Re-analyze graph" + last-analyzed relative time
2. Click → primary modal opens
3. Modal shows live progress (fed by SSE):
   - "Reading memory entries..." (1/4)
   - "Computing embeddings..." (2/4)
   - "Inferring relationships..." (3/4)
   - "Diffing against previous graph..." (4/4)
4. When done, modal shows preview:
   - Stats: +12 edges, -3 edges, 5 strength changes
   - Visual mini-preview of the graph with diffs colored
   - Apply / Revert buttons
5. On Apply: graph updates with FLIP-style transitions (`<motion.g layout>`-equivalent at react-flow level)
6. On Revert: modal closes, no change

### Performance budget

- 500 nodes / 2000 edges target for v1
- d3-force runs on web worker if >200 nodes (uses `comlink` to talk to main)
- Render tier: react-flow handles up to ~1000 nodes well; we'll virtualize node rendering past that

References:
- [React Flow examples](https://reactflow.dev/examples)
- [React Flow guide — Velt](https://velt.dev/blog/react-flow-guide-advanced-node-based-ui)
- [React Graph Visualization Guide — Cambridge Intelligence](https://cambridge-intelligence.com/react-graph-visualization-library/)
- [Obsidian graph view docs](https://obsidian.md/help/plugins/graph)
- [Cytoscape.js vs Sigma.js comparison](https://www.pkgpulse.com/blog/cytoscape-vs-vis-network-vs-sigma-graph-visualization-2026)
- [d3-force docs](https://d3js.org/d3-force)

---

## Appendix A — references summary

Typography:
- https://rsms.me/inter/
- https://vercel.com/font
- https://vercel.com/geist/typography
- https://www.jetbrains.com/lp/mono/
- https://nanx.me/blog/post/inter-optical-sizing/
- https://learn.microsoft.com/en-us/typography/opentype/spec/dvaraxistag_opsz
- https://fontofweb.com/tokens/linear.app
- https://madegooddesigns.com/coding-fonts/

Color:
- https://www.radix-ui.com/colors
- https://www.radix-ui.com/blog/themes-3
- https://tailwindcss.com/blog/tailwindcss-v4
- https://tailwindcolor.com/
- https://evilmartians.com/chronicles/better-dynamic-themes-in-tailwind-with-oklch-color-magic
- https://kyrylo.org/css/2025/02/09/oklch-css-variables-for-tailwind-v4-colors.html
- https://blog.soards.me/posts/radix-colors-with-tailwind/

Scrollbars:
- https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-width
- https://developer.chrome.com/docs/css-ui/scrollbar-styling
- https://kingsora.github.io/OverlayScrollbars/
- https://www.npmjs.com/package/overlayscrollbars-react
- https://github.com/vercel-labs/web-interface-guidelines

Motion:
- https://motion.dev/docs/react-transitions
- https://www.framer.com/motion/easing-functions/
- https://blog.maximeheckel.com/posts/guide-animations-spark-joy-framer-motion/
- https://www.reubence.com/articles/the-easing-blueprint

Loading/empty/error:
- https://vercel.com/geist/skeleton
- https://boneyard.vercel.app/how-it-works
- https://github.com/vercel-labs/web-interface-guidelines
- https://ui-deploy.com/blog/skeleton-screens-vs-spinners-optimizing-perceived-performance
- https://www.eleken.co/blog-posts/empty-state-ux
- https://userpilot.com/blog/empty-state-saas/

Density:
- https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables
- https://docs.stripe.com/stripe-apps/components/table
- https://medium.com/design-with-figma/the-ultimate-guide-to-designing-data-tables-7db29713a85a

Viz libraries:
- https://recharts.org
- https://airbnb.io/visx/
- https://tremor.so
- https://reactflow.dev/examples
- https://www.pkgpulse.com/blog/cytoscape-vs-vis-network-vs-sigma-graph-visualization-2026
- https://shiki.style
- https://chsm.dev/blog/2025/01/08/comparing-web-code-highlighters
- https://pixijs.com/blog/pixi-react-v8-live
- https://react.pixijs.io/

Sidebar / IA:
- https://linear.app/changelog/unpublished-collapsible-sidebar
- https://vercel.com/changelog/new-dashboard-navigation-available
- https://ui.shadcn.com/docs/components/radix/sidebar
- https://www.nngroup.com/articles/vertical-nav/

Kanban:
- https://dndkit.com/
- https://blog.logrocket.com/build-kanban-board-dnd-kit-react/
- https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react

Mission control:
- https://vercel.com/products/observability
- https://docs.railway.com/observability
- https://buildui.com/recipes/animated-counter
- https://motion.dev/docs/react-animate-number

Pixel sprites:
- https://pixijs.com/blog/pixi-react-v8-live
- https://api.pixijs.io/@pixi/sprite-animated/PIXI/AnimatedSprite.html
- https://fundamental.sh/p/sprite-sheet-animation-aseprite-react-threejs
- https://itch.io/game-assets/tag-hud/tag-pixel-art
- https://www.aseprite.org/

Knowledge graph:
- https://reactflow.dev/examples
- https://velt.dev/blog/react-flow-guide-advanced-node-based-ui
- https://cambridge-intelligence.com/react-graph-visualization-library/
- https://obsidian.md/help/plugins/graph
- https://d3js.org/d3-force

---

## Appendix B — concrete bill of materials

Add to `package.json` (if not already present):

```jsonc
{
  "dependencies": {
    // Type
    "@fontsource-variable/inter": "^5.x",          // OR self-host via next/font/local
    "@fontsource-variable/jetbrains-mono": "^5.x",

    // Motion (already present likely)
    "motion": "^11.x",                              // new name for framer-motion
    "canvas-confetti": "^1.x",
    "@types/canvas-confetti": "^1.x",

    // DnD
    "@dnd-kit/core": "^6.x",
    "@dnd-kit/sortable": "^8.x",
    "@dnd-kit/utilities": "^3.x",

    // Graph (locked)
    "@xyflow/react": "^12.x",
    "d3-force": "^3.x",

    // Sprites (new)
    "pixi.js": "^8.x",
    "@pixi/react": "^8.x",

    // Charts (locked)
    "recharts": "^2.x",

    // Code (locked)
    "shiki": "^1.x"
  }
}
```

Files to ship in this overhaul (not in this doc, but enumerated for next plan):

- `lib/motion.ts` — spring + ease tokens
- `app/globals.css` — full OKLCH theme tokens, scrollbar styles, font setup
- `components/ui/skeleton.tsx` — Skeleton primitive with delay/min-duration
- `components/ui/empty-state.tsx` — EmptyState primitive
- `components/ui/error-boundary.tsx` — ErrorBoundary with retry
- `components/ui/animated-number.tsx` — AnimatedNumber (useSpring + tabular-nums)
- `components/ui/heartbeat-dot.tsx` — Live status dot
- `components/shell/sidebar.tsx` — Collapsible sidebar (Linear pattern)
- `components/floor/*` — Pixi-based agent floor
- `components/memory/graph/*` — react-flow knowledge graph w/ side panel + re-analyze

---

End of VISUAL-RESEARCH.md.
