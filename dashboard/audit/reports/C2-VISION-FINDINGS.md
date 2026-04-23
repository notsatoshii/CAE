# C2 — VISION-FINDINGS (craft)

Scored: **230**  ·  Cache hits: **64**  ·  Skipped: **178**  ·  Spent: **$12.1014** / $500.00

Cells grouped by route, craft score ≤ 3 (and any skipped cells). Each entry shows the LLM's evidence + recommendations verbatim — this is the "what looks bad and why" log.

## 403  (avg craft: 1.18)

### live-spectator · laptop — _skipped_

- error: spawn claude ENOENT

### live-spectator · mobile — _skipped_

- error: spawn claude ENOENT

### live-spectator · wide — _skipped_

- error: spawn claude ENOENT

### operator · laptop — _skipped_

- error: spawn claude ENOENT

### operator · mobile — _skipped_

- error: spawn claude ENOENT

### operator · wide — _skipped_

- error: spawn claude ENOENT

### senior-dev · laptop — _skipped_

- error: spawn claude ENOENT

### senior-dev · mobile — _skipped_

- error: spawn claude ENOENT

### senior-dev · wide — _skipped_

- error: spawn claude ENOENT

### admin · mobile — craft **2**

**Evidence:**
- Header controls overflow and clip at viewport edge on mobile (truncated 'tok today', cut-off avatar)
- 403 card and floating chat panel overlap, card right edge hidden behind chat rail
- Large empty vertical space above/below card; layout not centered for mobile viewport

**Recommendations:**
- Collapse header into mobile nav (hamburger + compact status) so controls stop clipping
- Dismiss/hide chat side panel on mobile or dock below fold so it doesn't occlude 403 card
- Vertically center 403 card in available space, constrain width to viewport with padding

### founder-returning · mobile — craft **2**

**Evidence:**
- Top bar overflows viewport — icons clipped on right edge, header text truncated to '— tok EST. today'
- 403 card clipped on right side, not centered in mobile viewport
- Floating chat icon and bottom-left avatar overlap content area with no safe-area respect

**Recommendations:**
- Make top bar responsive: collapse icons into overflow menu below sm breakpoint
- Center 403 card with mobile-safe max-width and horizontal padding
- Ensure floating elements use fixed positioning with proper z-index and mobile safe-area insets

## build-schedule  (avg craft: 1.33)

### live-spectator · laptop — _skipped_

- error: spawn claude ENOENT

### live-spectator · mobile — _skipped_

- error: spawn claude ENOENT

### live-spectator · wide — _skipped_

- error: spawn claude ENOENT

### operator · laptop — _skipped_

- error: spawn claude ENOENT

### operator · mobile — _skipped_

- error: spawn claude ENOENT

### operator · wide — _skipped_

- error: spawn claude ENOENT

### senior-dev · laptop — _skipped_

- error: spawn claude ENOENT

### senior-dev · mobile — _skipped_

- error: spawn claude ENOENT

### senior-dev · wide — _skipped_

- error: spawn claude ENOENT

### admin · mobile — craft **2**

**Evidence:**
- Content clipped on right edge — header chrome, tab row, empty-state card all truncated mid-text
- Mobile viewport shows desktop sidebar rail instead of responsive nav — no hamburger or bottom tab bar
- Floating chat bubble overlaps header row at top-right, not anchored to bottom

**Recommendations:**
- Add responsive breakpoint: collapse left rail to hamburger under ~768px
- Constrain main content to viewport width with proper padding, stop horizontal overflow
- Reposition chat FAB to bottom-right with safe-area inset

### founder-returning · mobile — craft **2**

**Evidence:**
- Mobile viewport shows desktop sidebar + rail chrome instead of mobile nav; massive empty right half
- Topbar truncates: '— tok today', 'EST. —', '17:57:31', 'Offline' crammed with no responsive collapse
- Schedules card clipped at right edge; description text cut mid-word ('CAE')

**Recommendations:**
- Hide left rail + collapse topbar meta into overflow menu below ~768px
- Make schedules panel full-width on mobile; drop floating chat bubble or dock it
- Truncate or wrap topbar status chips responsively instead of overflow-hidden clipping

### founder-first-time · wide — craft **3**

**Evidence:**
- Auth card centered on vast empty black canvas wastes viewport, feels like placeholder
- Google button pure white against black = harsh contrast, not Linear-calm
- Cyan GitHub button saturation clashes with muted zinc card — no unified accent system

**Recommendations:**
- Tone GitHub button to neutral dark variant or subtle brand tint, match Google button weight
- Add subtle gradient/grid backdrop or reduce card isolation so page reads intentional not empty
- Unify both OAuth buttons to same visual weight (outline or filled, not mixed)

## signin  (avg craft: 1.33)

### founder-returning · laptop — _skipped_

- error: spawn claude ENOENT

### founder-returning · mobile — _skipped_

- error: spawn claude ENOENT

### founder-returning · wide — _skipped_

- error: spawn claude ENOENT

### live-spectator · laptop — _skipped_

- error: spawn claude ENOENT

### live-spectator · mobile — _skipped_

- error: spawn claude ENOENT

### live-spectator · wide — _skipped_

- error: spawn claude ENOENT

### operator · laptop — _skipped_

- error: spawn claude ENOENT

### operator · mobile — _skipped_

- error: spawn claude ENOENT

### operator · wide — _skipped_

- error: spawn claude ENOENT

### admin · mobile — craft **2**

**Evidence:**
- Header overflows mobile viewport — text clipping ('tok', 'today', dash fragments) and crammed icon row
- Empty chat rail column wastes ~50% horizontal space on mobile, leaving signin card cramped on left
- Floating 'N' avatar bottom-left overlaps content area with no clear affordance

**Recommendations:**
- Hide or collapse chat rail + reduce header icon set at mobile breakpoint
- Truncate/stack header meta ('EST tok today') instead of letting it clip
- Center signin card in full viewport width when unauthenticated

### senior-dev · mobile — craft **2**

**Evidence:**
- Top bar overflows viewport: 'tok today' text clipped, icons crammed edge-to-edge on mobile width
- Signin card not centered vertically; large empty black void above and right chat rail steals width making layout feel broken
- Floating chat bubble and 'Compiling' pill overlap main content area with no mobile-responsive repositioning

**Recommendations:**
- Collapse top bar to hamburger + logo + avatar on mobile; hide secondary status chips below breakpoint
- Hide or drawer-ify right chat rail on mobile viewports so signin card uses full width
- Center signin card vertically in viewport; reposition floating elements to avoid overlap

### founder-first-time · wide — craft **3**

**Evidence:**
- Auth card centered on vast empty black canvas wastes viewport, feels like placeholder
- Google button pure white against black = harsh contrast, not Linear-calm
- Cyan GitHub button saturation clashes with muted zinc card — no unified accent system

**Recommendations:**
- Tone GitHub button to neutral dark variant or subtle brand tint, match Google button weight
- Add subtle gradient/grid backdrop or reduce card isolation so page reads intentional not empty
- Unify both OAuth buttons to same visual weight (outline or filled, not mixed)

## build-schedule-new  (avg craft: 1.40)

### admin · mobile — craft **1**

**Evidence:**
- Running Pikachu loader with cartoon GIF and 'Loading...' text dominates viewport
- Header truncates mid-word ('tok today', '17:58:44 Offline') — broken mobile layout
- Empty right gutter wastes ~40% of mobile width; no responsive collapse

**Recommendations:**
- Replace Pikachu loader with neutral skeleton or spinner matching Linear aesthetic
- Collapse sidebar + right panel on mobile breakpoint; single-column flow
- Fix header overflow — truncate or wrap EST/status chips cleanly

### live-spectator · laptop — _skipped_

- error: spawn claude ENOENT

### live-spectator · mobile — _skipped_

- error: spawn claude ENOENT

### live-spectator · wide — _skipped_

- error: spawn claude ENOENT

### operator · laptop — _skipped_

- error: spawn claude ENOENT

### operator · mobile — _skipped_

- error: spawn claude ENOENT

### operator · wide — _skipped_

- error: spawn claude ENOENT

### senior-dev · laptop — _skipped_

- error: spawn claude ENOENT

### senior-dev · mobile — _skipped_

- error: spawn claude ENOENT

### senior-dev · wide — _skipped_

- error: spawn claude ENOENT

### admin · wide — craft **2**

**Evidence:**
- Main content area empty except for 'Running Pikachu' loading placeholder with cartoon image — unprofessional for admin route
- Top bar shows broken/placeholder text '— tok today EST. —' and '— —:—:—' timer stubs
- Vast empty canvas with no layout, skeleton, or scaffolding — route appears non-functional

**Recommendations:**
- Replace Pikachu loader with proper skeleton matching schedule form layout
- Fix header placeholders (time/status) to render real values or hide until ready
- Build actual build-schedule-new form UI instead of shipping empty route

### founder-returning · laptop — craft **2**

**Evidence:**
- Cartoon Pikachu GIF + serif 'Running Pikachu' header clash with pro dashboard chrome
- Loading state fills entire canvas — no skeleton, no layout scaffold, feels like placeholder
- Typography mix (serif title, sans body) inconsistent with rest of shell

**Recommendations:**
- Replace mascot loader with neutral skeleton matching Linear-style shimmer rows
- Drop serif heading; use shell sans stack for all states
- Render route scaffold (header, toolbar) during load instead of blank canvas

### founder-returning · mobile — craft **2**

**Evidence:**
- Pikachu loading placeholder with 'Running Pikachu' heading feels unprofessional for production dashboard
- Top bar truncates 'tok today' and shows em-dash placeholders for est/time values
- Right-side chat column is empty dead space on mobile viewport, wasteful layout

**Recommendations:**
- Replace Pikachu asset with branded skeleton/spinner matching Linear minimalism
- Fix topbar responsive collapse so labels don't wrap or truncate at mobile width
- Hide or overlay chat panel on mobile instead of reserving empty column

### founder-returning · wide — craft **2**

**Evidence:**
- Giant Pikachu GIF with 'Running Pikachu' headline dominates route content — wildly off-brand for Linear-tier product
- Empty 'Loading...' state persists with no skeleton, chrome, or schedule UI rendered
- Header meta 'tok today EST. —' shows unresolved placeholder dashes, looks broken

**Recommendations:**
- Replace Pikachu placeholder with real Schedule view or proper empty state with brand-consistent illustration
- Render skeleton rows matching final schedule layout during load, not centered spinner+GIF
- Fix header time/EST placeholders to hide until resolved or show proper skeleton

### founder-first-time · wide — craft **3**

**Evidence:**
- Auth card centered on vast empty black canvas wastes viewport, feels like placeholder
- Google button pure white against black = harsh contrast, not Linear-calm
- Cyan GitHub button saturation clashes with muted zinc card — no unified accent system

**Recommendations:**
- Tone GitHub button to neutral dark variant or subtle brand tint, match Google button weight
- Add subtle gradient/grid backdrop or reduce card isolation so page reads intentional not empty
- Unify both OAuth buttons to same visual weight (outline or filled, not mixed)

## build-security  (avg craft: 1.44)

### admin · mobile — craft **1**

**Evidence:**
- Pikachu GIF with 'Running Pikachu / Loading...' occupies main content area of admin build-security route
- Header metrics show placeholder dashes ('— tok', '-- : --', 'Offline --')
- Page title truncated ('Running Pikachu' clipped at right edge) on mobile viewport

**Recommendations:**
- Remove Pikachu loader, replace with skeleton matching final layout (metric cards, log rows)
- Render real build-security content or empty-state card instead of generic loader on admin route
- Fix mobile overflow so heading and header chips fit viewport width

### live-spectator · laptop — _skipped_

- error: spawn claude ENOENT

### live-spectator · mobile — _skipped_

- error: spawn claude ENOENT

### live-spectator · wide — _skipped_

- error: spawn claude ENOENT

### operator · laptop — _skipped_

- error: spawn claude ENOENT

### operator · mobile — _skipped_

- error: spawn claude ENOENT

### operator · wide — _skipped_

- error: spawn claude ENOENT

### senior-dev · laptop — _skipped_

- error: spawn claude ENOENT

### senior-dev · mobile — _skipped_

- error: spawn claude ENOENT

### senior-dev · wide — _skipped_

- error: spawn claude ENOENT

### admin · laptop — craft **2**

**Evidence:**
- Pikachu loading GIF dominates content area — unprofessional placeholder for admin/build-security route
- Top bar shows broken placeholders: '-- tok today EST. --' and '--:--:--' timestamp
- Route never resolves past loading state; no actual security content rendered

**Recommendations:**
- Replace Pikachu loader with neutral skeleton or spinner matching Linear minimalism
- Fix timestamp/token placeholders to render real values or hide until hydrated
- Ensure build-security route actually renders content, not stuck in Loading

### admin · wide — craft **2**

**Evidence:**
- Page body shows Pikachu 'Loading...' placeholder instead of real content
- Vast empty black canvas with no layout, cards, or data visible
- Top bar renders broken glyphs (— tok today EST. —, --:--:--) suggesting unresolved state

**Recommendations:**
- Replace Pikachu loader with Linear-style skeleton rows/cards matching final layout
- Ensure route resolves content before screenshot (fix truth-wait gate for build-security)
- Render header values (time, status) with real data or neutral placeholders, not em-dash glyphs

### founder-returning · laptop — craft **2**

**Evidence:**
- Dense list of grep-* rows with no visual hierarchy or grouping — reads like raw log dump
- Red/orange pill badges saturate right column, clash and create noise instead of signal
- Tiny illegible text at laptop viewport; no section headers, filters, or whitespace rhythm

**Recommendations:**
- Group rows by severity/category with headers and generous row padding, Linear-style
- Replace saturated red pills with subtle tinted badges (muted bg, low-chroma text)
- Add scannable left metadata column and increase base font size for laptop density

### founder-returning · mobile — craft **2**

**Evidence:**
- Placeholder Pikachu game content on security route — unprofessional, breaks product illusion
- Header metrics show em-dash placeholders (`— tok`, `-- : --`) indicating unpopulated data
- Title 'Running Pikachu' clips at right edge on mobile viewport

**Recommendations:**
- Replace placeholder game with real security dashboard content or empty state
- Render skeleton/loading shimmer instead of raw em-dash placeholders in header
- Fix title overflow — truncate or wrap on narrow viewports

### founder-returning · wide — craft **2**

**Evidence:**
- Loading state shows 'Running Pikachu' placeholder with cartoon image — unprofessional for production dashboard
- Vast empty canvas with no skeleton loaders or structural hints to anchor user expectation
- Top bar shows broken/placeholder text ('— tok today EST. —', '--:--:--', 'Offline · —') indicating incomplete data wiring

**Recommendations:**
- Replace Pikachu loader with branded skeleton matching Security route layout
- Populate or hide top-bar status widgets until data resolves instead of showing em-dash placeholders
- Add route-specific shell (header, panel frames) during load so identity persists across navigation

### founder-first-time · wide — craft **3**

**Evidence:**
- Auth card centered on vast empty black canvas wastes viewport, feels like placeholder
- Google button pure white against black = harsh contrast, not Linear-calm
- Cyan GitHub button saturation clashes with muted zinc card — no unified accent system

**Recommendations:**
- Tone GitHub button to neutral dark variant or subtle brand tint, match Google button weight
- Add subtle gradient/grid backdrop or reduce card isolation so page reads intentional not empty
- Unify both OAuth buttons to same visual weight (outline or filled, not mixed)

## build-queue  (avg craft: 1.46)

### live-spectator · laptop — _skipped_

- error: spawn claude ENOENT

### live-spectator · mobile — _skipped_

- error: spawn claude ENOENT

### live-spectator · wide — _skipped_

- error: spawn claude ENOENT

### operator · laptop — _skipped_

- error: spawn claude ENOENT

### operator · mobile — _skipped_

- error: spawn claude ENOENT

### operator · wide — _skipped_

- error: spawn claude ENOENT

### senior-dev · laptop — _skipped_

- error: spawn claude ENOENT

### senior-dev · mobile — _skipped_

- error: spawn claude ENOENT

### senior-dev · wide — _skipped_

- error: spawn claude ENOENT

### admin · mobile — craft **2**

**Evidence:**
- Header overflows viewport: 'tok today', 'New jo' clipped, Offline pill truncated
- Card content clipped on right edge — titles cut mid-word with no ellipsis handling
- Desktop sidebar rendered on mobile width alongside main rail, wasting ~40% horizontal space and empty black void right of cards

**Recommendations:**
- Hide or collapse left sidebar below md breakpoint; use hamburger/drawer pattern
- Constrain header chips with truncate + responsive hiding (drop EST/timestamp on <sm)
- Make queue cards full-width on mobile with proper text truncation

### founder-returning · mobile — craft **2**

**Evidence:**
- Desktop sidebar + rail rendered on mobile viewport instead of collapsed nav — horizontal overflow clips 'New job' button and card titles
- Top bar metrics show placeholder dashes ('— tok', '--:--', '— / —') creating broken/unfinished impression
- Chat bubble icon floats mid-canvas with no anchor; overlaps content area awkwardly

**Recommendations:**
- Collapse sidebar+rail into hamburger/drawer below md breakpoint; make Work queue the full-width primary surface
- Hide or skeleton-load metric chips when values unavailable instead of showing em-dashes
- Dock floating chat launcher to fixed bottom-right with safe-area padding, not free-floating

### admin · laptop — craft **3**

**Evidence:**
- Kanban columns lack visual separation — no card backgrounds, borders bleed into page bg
- Header meta row shows broken placeholders (`— tok today EST. —`, `--:--:--`)
- Card metadata rendered as em-dash stub (`— · 3d ago`) signals missing fields

**Recommendations:**
- Give columns subtle surface bg + border, match Linear column chrome
- Hide or gracefully degrade unpopulated header/meta instead of rendering literal dashes
- Render card author/assignee avatar or drop the stub separator entirely

### founder-first-time · wide — craft **3**

**Evidence:**
- Auth card centered on vast empty black canvas wastes viewport, feels like placeholder
- Google button pure white against black = harsh contrast, not Linear-calm
- Cyan GitHub button saturation clashes with muted zinc card — no unified accent system

**Recommendations:**
- Tone GitHub button to neutral dark variant or subtle brand tint, match Google button weight
- Add subtle gradient/grid backdrop or reduce card isolation so page reads intentional not empty
- Unify both OAuth buttons to same visual weight (outline or filled, not mixed)

## root  (avg craft: 1.53)

### founder-returning · laptop — _skipped_

- error: spawn claude ENOENT

### founder-returning · mobile — _skipped_

- error: spawn claude ENOENT

### founder-returning · wide — _skipped_

- error: spawn claude ENOENT

### live-spectator · laptop — _skipped_

- error: spawn claude ENOENT

### live-spectator · mobile — _skipped_

- error: spawn claude ENOENT

### live-spectator · wide — _skipped_

- error: spawn claude ENOENT

### operator · laptop — _skipped_

- error: spawn claude ENOENT

### operator · mobile — _skipped_

- error: spawn claude ENOENT

### operator · wide — _skipped_

- error: spawn claude ENOENT

### admin · laptop — craft **2**

**Evidence:**
- Pikachu GIF + 'Running Pikachu' loading screen on admin root — unprofessional placeholder
- Top bar shows broken tokens: '— tok today EST. —' and '--:--:--' placeholders unreplaced
- Offline pill with trailing dash '• Offline • —' looks half-rendered

**Recommendations:**
- Replace Pikachu loader with branded skeleton/spinner matching Linear aesthetic
- Resolve placeholder tokens (date/time/status) before paint or hide until hydrated
- Clean offline indicator formatting; drop trailing em-dash

### admin · mobile — craft **2**

**Evidence:**
- Top bar overflows viewport — timer/status glyphs clipped and unreadable on mobile width
- Pikachu loading GIF with white box on dark theme breaks visual language, feels placeholder/tacky
- Dead empty right panel + narrow middle rail waste mobile real estate, no responsive collapse

**Recommendations:**
- Collapse/stack header controls into overflow menu below md breakpoint so nothing clips
- Replace Pikachu placeholder with themed skeleton or spinner matching dark palette
- Hide or bottom-sheet the secondary rail on mobile; give primary content full width

### senior-dev · mobile — craft **2**

**Evidence:**
- Pikachu loading GIF with serif 'Running Pikachu' heading clashes hard with dashboard chrome
- Top bar overflows on mobile: truncated 'tok'/'EST.'/'today' fragments, broken time placeholder '--:--'
- Empty vast dark panels on right, no mobile layout adaptation — desktop chrome squeezed into narrow viewport

**Recommendations:**
- Replace placeholder Pikachu loader with proper skeleton/spinner matching dark theme
- Rework top bar for mobile: collapse/hide metrics, use icon-only or hamburger
- Stack or hide side rails on mobile breakpoint instead of rendering empty columns

### senior-dev · wide — craft **2**

**Evidence:**
- Pikachu loading placeholder with cartoon image feels juvenile, not Linear-grade
- Vast empty dark canvas with lone centered loader — no skeleton, no content scaffold
- Top bar shows placeholder dashes (`— —:—:—`, `Offline · —`) instead of real state

**Recommendations:**
- Replace mascot loader with subtle skeleton rows matching actual route layout
- Render chrome + content skeletons immediately; avoid full-screen loader state
- Resolve offline/time placeholders or hide until hydrated

### admin · wide — craft **3**

**Evidence:**
- Live Floor panel overlaps Mission Control tile — popover z-index or positioning bug breaks layout
- Mission Control tiles show placeholder skeleton bars with 'appears when...' helper text stacked, reads as unfinished
- Sidebar icons unevenly spaced, lone avatar 'N' floats mid-rail with no grouping

**Recommendations:**
- Fix Live Floor popover anchoring so it does not overlap adjacent cards
- Replace empty-state skeletons with single concise empty label per tile, drop redundant helper copy
- Tighten sidebar icon rhythm and anchor avatar to bottom with divider like Linear

### founder-first-time · wide — craft **3**

**Evidence:**
- Auth card centered on vast empty black canvas wastes viewport, feels like placeholder
- Google button pure white against black = harsh contrast, not Linear-calm
- Cyan GitHub button saturation clashes with muted zinc card — no unified accent system

**Recommendations:**
- Tone GitHub button to neutral dark variant or subtle brand tint, match Google button weight
- Add subtle gradient/grid backdrop or reduce card isolation so page reads intentional not empty
- Unify both OAuth buttons to same visual weight (outline or filled, not mixed)

## build-security-audit  (avg craft: 1.56)

### live-spectator · laptop — _skipped_

- error: spawn claude ENOENT

### live-spectator · mobile — _skipped_

- error: spawn claude ENOENT

### live-spectator · wide — _skipped_

- error: spawn claude ENOENT

### operator · laptop — _skipped_

- error: spawn claude ENOENT

### operator · mobile — _skipped_

- error: spawn claude ENOENT

### operator · wide — _skipped_

- error: spawn claude ENOENT

### admin · mobile — craft **2**

**Evidence:**
- Table clips hard right edge — columns cut mid-word (Dire…, /root)
- Huge empty void right of content — no mobile layout, desktop table shoved into phone viewport
- Floating chat bubble overlaps table header area, no safe-area offset

**Recommendations:**
- Stack table as cards or enable horizontal scroll container on <640px
- Constrain tab bar + filters to viewport width, wrap date pickers below selector
- Reposition FAB/chat to bottom-right with margin, clear of content

### admin · laptop — craft **3**

**Evidence:**
- Header time/status shows placeholder glyphs '—:—:—' and '-' instead of real values
- Huge empty canvas below single-row table — no empty-state treatment for other columns/context
- Floating chat bubble and bottom-left 'N' avatar overlap content with no visual hierarchy

**Recommendations:**
- Render real timestamps/status or hide until hydrated; no em-dash placeholders
- Add empty-state messaging + column density (status, result, duration) instead of blank void
- Unify floating affordances into single toolbar; drop stray 'N' badge

### admin · wide — craft **3**

**Evidence:**
- Vast empty canvas below single row — no empty-state guidance or density
- Header strip cramped with cryptic glyphs (tok today EST, offline dashes) that read as debug output
- Filter row uses raw mm/dd/yyyy browser date inputs — inconsistent with dark theme polish

**Recommendations:**
- Add empty-state affordance or skeleton rows so table doesn't float in void
- Replace native date inputs with styled date picker matching token system
- Clean header telemetry — either render real values or hide placeholders

## build-changes  (avg craft: 1.56)

### live-spectator · laptop — _skipped_

- error: spawn claude ENOENT

### live-spectator · mobile — _skipped_

- error: spawn claude ENOENT

### live-spectator · wide — _skipped_

- error: spawn claude ENOENT

### operator · laptop — _skipped_

- error: spawn claude ENOENT

### operator · mobile — _skipped_

- error: spawn claude ENOENT

### operator · wide — _skipped_

- error: spawn claude ENOENT

### senior-dev · laptop — _skipped_

- error: spawn claude ENOENT

### senior-dev · mobile — _skipped_

- error: spawn claude ENOENT

### senior-dev · wide — _skipped_

- error: spawn claude ENOENT

### admin · laptop — craft **2**

**Evidence:**
- 9 identical 'CAE shipped 2 changes to dashboard Monday.' rows — clear placeholder/broken template leak
- Header '— tok today EST. —' reads as debug string, not polished copy
- Empty-state text 'Nothing's shipped today — yet.' contradicts list below showing 8 shipped items

**Recommendations:**
- De-duplicate shipped entries; show actual changelog content per row (title, diff summary, timestamp)
- Replace header tokens with rendered date/time string
- Reconcile empty-state vs populated-list logic so only one renders

### admin · mobile — craft **2**

**Evidence:**
- Header text overlaps with top-right icons and clock, unreadable collision
- Large empty right panel on mobile viewport — broken responsive layout
- Lone speech-bubble icon floating in whitespace with no context

**Recommendations:**
- Stack header elements vertically on mobile, fix z-index/overflow on title row
- Collapse or hide secondary panel below breakpoint instead of leaving blank column
- Anchor chat/comment affordance to a fixed position or remove until content exists

### admin · wide — craft **2**

**Evidence:**
- Massive empty canvas with single centered empty-state string — no layout, header, or filters to frame admin context
- Top bar shows placeholder dashes ('— tok today EST. —', '--:--:--', 'Offline · —') indicating unresolved data bindings shipped to UI
- Sidebar icons lack labels/tooltip affordance; active item is a raw dot glyph, no section heading for the route

**Recommendations:**
- Render skeleton/page header with route title + filter chips so empty state sits inside structure, not a void
- Replace dash placeholders with real values or hide chips until data resolves (Linear never shows '—:—:—')
- Add empty-state illustration/CTA ('No builds in last 30d — trigger build') instead of a bare sentence

### founder-returning · mobile — craft **2**

**Evidence:**
- Header text overlaps/clips — '— tok', 'EST. —', 'today' stacking awkwardly at top
- Massive empty canvas with only 'Nothing's shipped in the last 30 days.' stranded top-left — no mobile layout adaptation
- Two vertical icon rails consume significant width on mobile; desktop chrome not collapsed for small viewport

**Recommendations:**
- Collapse left rail to hamburger + hide/stack header meta on mobile breakpoint
- Center empty state with illustration/CTA instead of lone sentence flush-left
- Fix header token/estimate row wrapping — truncate or move to secondary line

### founder-returning · wide — craft **2**

**Evidence:**
- Empty state lone sentence floating top-center, no illustration/CTA/structure
- Header shows broken/placeholder data: '— tok today EST. —', '——:——:——', 'Offline · —'
- Vast dead canvas below empty state, no card/container framing the message

**Recommendations:**
- Center empty state vertically with icon + heading + secondary action (e.g., 'Connect repo')
- Replace em-dash placeholders with skeleton loaders or hide metrics until populated
- Wrap content in panel/card with padding instead of bare body text

### founder-first-time · wide — craft **3**

**Evidence:**
- Auth card centered on vast empty black canvas wastes viewport, feels like placeholder
- Google button pure white against black = harsh contrast, not Linear-calm
- Cyan GitHub button saturation clashes with muted zinc card — no unified accent system

**Recommendations:**
- Tone GitHub button to neutral dark variant or subtle brand tint, match Google button weight
- Add subtle gradient/grid backdrop or reduce card isolation so page reads intentional not empty
- Unify both OAuth buttons to same visual weight (outline or filled, not mixed)

### founder-returning · laptop — craft **3**

**Evidence:**
- Vast empty canvas with single centered empty-state line feels unfinished, not intentional
- Top bar shows raw placeholder text `— tok today EST. —` with stray em-dashes, looks like broken template
- Dense icon cluster top-right lacks grouping/spacing, reads cluttered next to otherwise barren layout

**Recommendations:**
- Replace placeholder header string with real metric or hide until data exists
- Give empty state structure: icon, heading, subtext, CTA — not one faint sentence floating
- Group top-right icons into logical clusters with dividers, match Linear's tight toolbar rhythm

## build-security-skills  (avg craft: 1.56)

### live-spectator · laptop — _skipped_

- error: spawn claude ENOENT

### live-spectator · mobile — _skipped_

- error: spawn claude ENOENT

### live-spectator · wide — _skipped_

- error: spawn claude ENOENT

### operator · laptop — _skipped_

- error: spawn claude ENOENT

### operator · mobile — _skipped_

- error: spawn claude ENOENT

### operator · wide — _skipped_

- error: spawn claude ENOENT

### senior-dev · laptop — _skipped_

- error: spawn claude ENOENT

### senior-dev · mobile — _skipped_

- error: spawn claude ENOENT

### senior-dev · wide — _skipped_

- error: spawn claude ENOENT

### admin · laptop — craft **2**

**Evidence:**
- Dense list of repeated red 'Medium' severity badges dominate right rail — monotonous, no visual hierarchy
- Row labels (gsd-*) left-aligned with huge whitespace gap to badges — broken two-column density
- No header, filters, counts, or grouping visible; looks like raw dump not curated admin view

**Recommendations:**
- Add table header + severity distribution summary at top; group or collapse identical-severity runs
- Tighten row density or add zebra striping; move badges closer to labels to kill dead whitespace
- Vary badge color/weight by actual risk tier instead of wall of red/orange Medium pills

### admin · mobile — craft **2**

**Evidence:**
- Dense unstyled list of gsd-* commands with no visual hierarchy or grouping
- Every row shows same yellow Medium badge — looks like raw dump, not curated UI
- Mobile viewport but content not adapted: tiny text, cramped rows, no breathing room

**Recommendations:**
- Group commands by category with section headers; collapse by default on mobile
- Differentiate badge colors/weights so Medium isn't visual noise across every row
- Increase row padding and font size for mobile; add search/filter at top

### founder-first-time · wide — craft **2**

**Evidence:**
- Auth screen shown instead of build-security-skills route — likely redirect/gating misfire on wide viewport
- Persistent 'Compiling' pill bottom-left leaks dev state into captured shot
- Vast empty canvas around small centered card reads as unfinished at wide breakpoint

**Recommendations:**
- Authenticate fixture session before shot so actual route renders
- Suppress Next.js dev indicator in audit builds (devIndicators false)
- If auth wall is intentional, widen/illustrate it so wide viewport does not feel like blank page

### founder-returning · laptop — craft **2**

**Evidence:**
- Dense list of near-identical rows with uniform red 'Medium' badges creates monotonous, brute-force layout
- Badge treatment inconsistent — some rows show double badges (orange + red) with no visual hierarchy
- No grouping, spacing, or visual rhythm; feels like raw data dump rather than curated UI

**Recommendations:**
- Group skills by category or priority; add section headers and whitespace
- Vary badge severity colors meaningfully or collapse to single status column
- Introduce row hover states, icons, or descriptions to break monotony

### founder-returning · mobile — craft **2**

**Evidence:**
- Dense uniform list of gsd-* slash commands with no visual hierarchy or grouping
- Every row shows identical 'medium' orange badge creating heavy repetitive noise
- Mobile viewport crammed with desktop-style rail; text truncated, tap targets tiny

**Recommendations:**
- Group commands by category with section headers; collapse by default on mobile
- Replace per-row badge with subtle dot or drop when value uniform
- Adopt mobile-first layout: larger rows, search-first, hide rail behind sheet

### admin · wide — craft **3**

**Evidence:**
- Badge colors clash — bright red/orange/green pills on every row create noisy, over-saturated rhythm unlike Linear's muted palette
- Dense list lacks vertical rhythm and grouping; rows feel like raw dump, no section headers or dividers
- Left sidebar icons cramped and inconsistently aligned; top bar controls feel undersized vs content density

**Recommendations:**
- Desaturate severity badges — use Linear-style low-chroma tints with subtle colored text, not filled vivid pills
- Add row grouping or category headers plus tighter typographic hierarchy (weight, muted meta text)
- Normalize sidebar icon sizing/padding and align top bar control sizes to a single 28/32px grid

### founder-returning · wide — craft **3**

**Evidence:**
- Dense list of gsd-* rows with heavy colored risk/severity badges feels noisy vs Linear's restraint
- Low-contrast row text against dark bg hurts scannability; no grouping or hierarchy
- Left nav icons lack labels/tooltips at this width, uncertain affordance

**Recommendations:**
- Group skills by category with section headers; reduce badge saturation
- Lift row text contrast; add zebra or hover states for scan rhythm
- Add labels/tooltips to left-rail icons; limit to 2 badge colors max

## build-skills-installed  (avg craft: 1.60)

### live-spectator · laptop — _skipped_

- error: spawn claude ENOENT

### live-spectator · mobile — _skipped_

- error: spawn claude ENOENT

### live-spectator · wide — _skipped_

- error: spawn claude ENOENT

### operator · laptop — _skipped_

- error: spawn claude ENOENT

### operator · mobile — _skipped_

- error: spawn claude ENOENT

### operator · wide — _skipped_

- error: spawn claude ENOENT

### senior-dev · laptop — _skipped_

- error: claude -p exited 1: Error: claude native binary not installed.

Either postinstall did not run (--ignore-scripts, some pnpm configs)
or the platform-native optional dependency was not downloaded
(--omit=optional).

Run the postinstall manually (adjust path for local vs global install):
  node node_modules/@anthropic-ai/claude-code/install.cjs

Or reinstall without --ignore-scripts / --omit=optional.


### senior-dev · mobile — _skipped_

- error: claude -p exited 1: Error: claude native binary not installed.

Either postinstall did not run (--ignore-scripts, some pnpm configs)
or the platform-native optional dependency was not downloaded
(--omit=optional).

Run the postinstall manually (adjust path for local vs global install):
  node node_modules/@anthropic-ai/claude-code/install.cjs

Or reinstall without --ignore-scripts / --omit=optional.


### senior-dev · wide — _skipped_

- error: claude -p exited 2: /usr/bin/claude: 1: ELF: not found
/usr/bin/claude: 2: Syntax error: ")" unexpected


### admin · mobile — craft **2**

**Evidence:**
- Header title 'Running Pikachu — tok EST. today' truncates and wraps awkwardly on mobile width
- Large empty right panel (chat/side area) consumes ~45% of viewport with no content, wasting mobile real estate
- Pikachu image rendered as raw sharp-edged bitmap on dark bg — no container, radius, or framing; reads as placeholder art not product UI

**Recommendations:**
- Collapse or hide right chat panel on mobile breakpoint; stack single-column
- Truncate header with ellipsis or move EST/tok meta to secondary line
- Frame media in rounded container matching surface tokens; center content column instead of left-aligning against sidebar

### admin · wide — craft **2**

**Evidence:**
- Main content area dominated by 'Running Pikachu' loading placeholder — looks like debug/Easter egg leaked into prod view
- Top bar shows broken/placeholder text: '- tok today EST. -' and '--:--:--' time placeholders unrendered
- Vast empty black canvas with no skills UI, no skeleton, no structure — route appears unimplemented

**Recommendations:**
- Replace cartoon Pikachu loader with proper skeleton matching final skills layout
- Fix header placeholders (time, token counter) to render real values or hide until ready
- Ship actual skills-installed content — current state reads as dev stub, not admin surface

### founder-returning · mobile — craft **2**

**Evidence:**
- Pikachu GIF + 'Running Pikachu' heading looks like placeholder/demo content, not production skill surface
- Top bar truncates text ('tok today', '- -') — broken layout on mobile width
- Massive empty canvas with floating chat bubble icon, no mobile-optimized skill list or controls

**Recommendations:**
- Replace demo Pikachu content with real installed-skills list or empty state
- Fix top bar overflow: stack or truncate metrics cleanly at mobile width
- Collapse left rail on mobile, use full width for skill content

### admin · laptop — craft **3**

**Evidence:**
- Dense card grid lacks clear hierarchy — title, description, and green 'Installed' pills compete visually
- Inconsistent card heights and wrapping create ragged vertical rhythm across columns
- Bright green tag color clashes with muted dark palette; too saturated vs Linear's restrained accent use

**Recommendations:**
- Tone down pill color (desaturate green, smaller weight) and unify tag styling
- Normalize card heights or use truncation with tooltip for consistent grid
- Add stronger typographic hierarchy — bolder titles, dimmer descriptions, consistent spacing

### founder-first-time · wide — craft **3**

**Evidence:**
- Auth card centered on vast empty black canvas wastes viewport, feels like placeholder
- Google button pure white against black = harsh contrast, not Linear-calm
- Cyan GitHub button saturation clashes with muted zinc card — no unified accent system

**Recommendations:**
- Tone GitHub button to neutral dark variant or subtle brand tint, match Google button weight
- Add subtle gradient/grid backdrop or reduce card isolation so page reads intentional not empty
- Unify both OAuth buttons to same visual weight (outline or filled, not mixed)

### founder-returning · wide — craft **3**

**Evidence:**
- Dense 3-column card grid feels cramped, tight padding, weak visual hierarchy vs Linear's airy lists
- Bright teal 'Installed' badges + teal command names overpower the dark surface, no tonal restraint
- Cards uniform and repetitive with no grouping, sorting affordance, or scannable metadata columns

**Recommendations:**
- Drop to 2 columns or switch to table/list with name · tag · description columns for scannability
- Mute badge to subtle teal tint on neutral chip; reserve saturated accent for primary action only
- Add section grouping or category filters; increase card padding + row gap for breathing room

## build-agents  (avg craft: 1.62)

### live-spectator · laptop — _skipped_

- error: spawn claude ENOENT

### live-spectator · mobile — _skipped_

- error: spawn claude ENOENT

### live-spectator · wide — _skipped_

- error: spawn claude ENOENT

### operator · laptop — _skipped_

- error: spawn claude ENOENT

### operator · mobile — _skipped_

- error: spawn claude ENOENT

### operator · wide — _skipped_

- error: spawn claude ENOENT

### senior-dev · laptop — _skipped_

- error: spawn claude ENOENT

### senior-dev · mobile — _skipped_

- error: spawn claude ENOENT

### senior-dev · wide — _skipped_

- error: spawn claude ENOENT

### admin · laptop — craft **3**

**Evidence:**
- Inconsistent card density — Forge card shows Today/100% bar, others show Never/0% but identical layout wastes space
- Header microcopy '— tok today EST. —' looks like broken template placeholders
- Avatar color palette (orange/green/red/purple/blue) lacks hierarchy — feels random vs Linear's restrained accent use

**Recommendations:**
- Collapse Quiet agents to dense list rows; reserve card treatment for Active
- Fix header status string truncation/placeholder rendering
- Constrain avatar palette to 2-3 semantic colors or use monochrome initials

### admin · mobile — craft **3**

**Evidence:**
- Large empty whitespace to right of stacked agent cards wastes mobile viewport
- Typography hierarchy weak — 'Never' and '0%' same weight as labels, hard to scan
- Button trio (Start/Stop/Archive) repeats per card without visual grouping or primary action emphasis

**Recommendations:**
- Collapse quiet agents into summary row or accordion; only expand on tap
- Demote secondary stats (0 working, 0 waiting, 0/day) to single subdued line
- Make cards full-width on mobile and de-emphasize Stop/Archive (icon-only or overflow menu)

### founder-first-time · wide — craft **3**

**Evidence:**
- Sign-in card centered on empty void — no product chrome, feels like placeholder
- Generic robot icon + 'CTRL + ALT + ELITE' wordmark reads boilerplate, not branded
- 'Compiling' pill bottom-left floats disconnected from layout, low-polish

**Recommendations:**
- Replace stock robot glyph with custom mark; tighten wordmark tracking/weight
- Add subtle background texture or product screenshot to reduce empty-canvas feel
- Anchor status pill to consistent toast region; match card border radius/elevation

### founder-returning · mobile — craft **3**

**Evidence:**
- Repetitive agent cards with identical 0% / Never / 0 working stats create monotonous wall of empty state
- Horizontal overflow: right-side empty dark area suggests layout not adapted to mobile viewport
- Floating chat bubble overlaps header area awkwardly, and avatar badge (N) floats mid-left with no clear anchor

**Recommendations:**
- Collapse quiet/offline agents into compact list rows; reserve full cards for active agents
- Fix mobile viewport — content should fill width, no dead right gutter
- Anchor floating elements (chat toggle, avatar) to consistent screen edges with safe-area padding

## chat  (avg craft: 1.69)

### live-spectator · laptop — _skipped_

- error: spawn claude ENOENT

### live-spectator · mobile — _skipped_

- error: spawn claude ENOENT

### live-spectator · wide — _skipped_

- error: spawn claude ENOENT

### operator · laptop — _skipped_

- error: spawn claude ENOENT

### operator · mobile — _skipped_

- error: spawn claude ENOENT

### operator · wide — _skipped_

- error: spawn claude ENOENT

### admin · laptop — craft **2**

**Evidence:**
- Left pane stuck on 'Loading…' — dead空白 dominate half viewport
- Top bar cramped, dash separators '— tok today EST. —' look raw/unstyled
- Empty chat panel vast black void, tiny centered text feel unbalanced

**Recommendations:**
- Skeleton loader for Mirror pane instead of bare 'Loading…'
- Tighten top bar: replace '— … —' with proper divider + label hierarchy
- Constrain chat empty-state width, add subtle card bg so panel no feel void

### admin · mobile — craft **2**

**Evidence:**
- Top header overflows mobile viewport — icon row clipped right edge, timestamp text fragmented ('--:--', '— tok today')
- Empty 'Mirror: Home' sidebar visible on mobile instead of collapsed/drawer pattern — wastes ~40% of width
- Composer 'Send' button uses raw cyan fill with no radius harmony, clashes with muted palette

**Recommendations:**
- Collapse sidebar behind hamburger on <768px; reclaim canvas width
- Truncate or stack header meta (tokens/time/status) into overflow menu instead of clipping
- Restyle Send button to match Linear-grade subtle accent (filled but tonal, matched radius)

### admin · wide — craft **2**

**Evidence:**
- Left pane stuck on 'Loading…' with no skeleton — dead space dominates viewport
- Header shows broken/empty state: '— tok today EST. —' dashes where values should be, orphan '—' next to Offline pill
- Empty chat canvas has no visual container, divider, or card — message floats in void with inconsistent alignment vs input bar

**Recommendations:**
- Replace 'Loading…' with skeleton rows matching final layout; never ship raw text loaders
- Hide or collapse header metrics when values null instead of rendering em-dash placeholders
- Wrap chat thread + composer in bounded card with consistent padding; align empty-state copy to composer width

### founder-returning · laptop — craft **2**

**Evidence:**
- Left pane stuck on 'Loading…' — broken state dominates half the viewport
- Top bar crowded with unlabeled icons, cryptic '— tok today EST. —' fragment, redundant help glyphs
- Empty chat canvas with tiny centered placeholder feels hollow; no visual hierarchy or density

**Recommendations:**
- Resolve or skeleton the Mirror pane — never ship a persistent 'Loading…' to screenshot
- Collapse top-bar icon soup: label or group, drop duplicate '?' glyphs, clarify token meter
- Add starter content or richer empty state in chat (recent threads, suggestions) to fill dead space

### founder-returning · mobile — craft **2**

**Evidence:**
- Top bar overcrowded with unlabeled icons on mobile viewport, causing cramped layout
- Empty 'Loading...' state in sidebar alongside populated chat area feels unfinished
- Desktop-style two-pane layout retained on mobile width — sidebar eats half the screen, chat column cramped

**Recommendations:**
- Collapse sidebar behind hamburger on mobile; give chat full width
- Consolidate top-bar icons into overflow menu at narrow breakpoints
- Resolve mirror sidebar loading state before render or show skeleton matching final layout

### founder-returning · wide — craft **2**

**Evidence:**
- Left pane stuck on 'Loading…' with no skeleton or placeholder, leaves half the viewport empty
- Top bar crowded with raw debug-looking tokens ('— tok today EST. —', '— 21:49:08', 'Offline · —') that read as unstyled metadata
- Chat empty state floats mid-right with no framing, card, or alignment to a column grid — feels ungridded

**Recommendations:**
- Replace 'Loading…' with skeleton rows matching final layout; gate mirror pane until ready
- Consolidate top-bar status chips: hide em-dashes when values absent, group time/presence into one pill
- Anchor chat empty state to a centered container with max-width; add subtle divider between mirror pane and chat

### senior-dev · laptop — craft **2**

**Evidence:**
- Left pane stuck on 'Loading…' — empty half-screen reads broken, not polished
- Top bar icon cluster unlabeled and cramped; 'tok today EST.' status string looks like debug output
- Chat empty state floats mid-pane with no visual anchor, composer pinned bottom-right feels disconnected from greeting

**Recommendations:**
- Replace Loading… with skeleton rows matching Home mirror layout so pane has structure during fetch
- Group/space top-bar icons with tooltips; format status as readable chip (e.g. 'Offline · 21:29 EST')
- Center empty-state block vertically in chat pane and widen composer to full pane width for Linear-grade balance

### senior-dev · mobile — craft **2**

**Evidence:**
- Top bar overflows mobile viewport: timestamps clipped, icon row crammed edge-to-edge with no breathing room
- Persistent 'Mirror:' sidebar consumes ~40% of mobile width, leaving chat column squeezed and awkwardly centered
- Stray 'N' avatar floats over content bottom-left with no clear anchor or purpose

**Recommendations:**
- Collapse sidebar behind hamburger on mobile breakpoint; give chat full width
- Hide or condense top-bar metrics row below sm breakpoint, keep only brand + Plan/Build + avatar
- Reposition floating 'N' element into a proper FAB slot or remove on mobile

### senior-dev · wide — craft **2**

**Evidence:**
- Massive empty left panel with only 'Home' heading and stuck 'Loading…' state — broken split layout
- Chat empty state floats dead-center in right panel with no visual anchoring or card treatment
- Top bar crowded with placeholder dashes ('— —:—:—', 'Offline · —') signaling unfinished telemetry

**Recommendations:**
- Collapse or populate Mirror panel — don't ship a half-width loading void
- Wrap chat empty state in a contained card with bounded width, center vertically within a defined region
- Hide or format null telemetry values instead of rendering em-dash placeholders

### founder-first-time · wide — craft **3**

**Evidence:**
- Auth card centered on vast empty black canvas wastes viewport, feels like placeholder
- Google button pure white against black = harsh contrast, not Linear-calm
- Cyan GitHub button saturation clashes with muted zinc card — no unified accent system

**Recommendations:**
- Tone GitHub button to neutral dark variant or subtle brand tint, match Google button weight
- Add subtle gradient/grid backdrop or reduce card isolation so page reads intentional not empty
- Unify both OAuth buttons to same visual weight (outline or filled, not mixed)

## floor  (avg craft: 1.69)

### live-spectator · laptop — _skipped_

- error: spawn claude ENOENT

### live-spectator · mobile — _skipped_

- error: spawn claude ENOENT

### live-spectator · wide — _skipped_

- error: spawn claude ENOENT

### operator · laptop — _skipped_

- error: spawn claude ENOENT

### operator · mobile — _skipped_

- error: spawn claude ENOENT

### operator · wide — _skipped_

- error: spawn claude ENOENT

### admin · laptop — craft **2**

**Evidence:**
- Huge empty black void dominating center — no content, no skeleton, no empty state
- Top bar text truncated/broken: '— tok today EST. —' reads as placeholder garbage
- Floating room legend clipped at right edge, overlapping viewport boundary

**Recommendations:**
- Render actual floor content or proper empty state instead of black canvas
- Fix header string formatting so timestamp/label renders cleanly
- Constrain legend panel inside viewport with proper padding/max-width

### admin · mobile — craft **2**

**Evidence:**
- Header controls overflow viewport — timer/status chips clipped right edge
- Large empty black void mid-canvas between header and floating panel — no mobile layout adaptation
- Floating role panel anchored bottom-right desktop-style, overlaps canvas awkwardly on narrow width

**Recommendations:**
- Stack header into two rows on mobile or collapse timer/EST/status into menu
- Replace desktop floating panel with bottom sheet or full-width stacked list under canvas
- Add responsive breakpoint for /admin/floor — current layout appears to be desktop shrunk, not reflowed

### admin · wide — craft **2**

**Evidence:**
- Vast empty black canvas dominates viewport — no content hierarchy or layout structure visible
- Floating legend chip bottom-right clips off-screen and lacks container framing
- Top bar controls crowded/misaligned: truncated 'tok today EST.' label, placeholder dashes where values should render

**Recommendations:**
- Fill main canvas with floor visualization or skeleton state instead of blank void
- Anchor legend in properly-padded panel aligned to grid, not floating against edge
- Resolve placeholder/loading states in header so timestamps and status render real values

### founder-returning · laptop — craft **2**

**Evidence:**
- Vast empty black canvas with no content, hierarchy, or loading state
- Floating legend panel clipped at right edge with no container, shadow, or alignment to layout
- Top bar shows broken/truncated text '— tok today EST. —' suggesting unrendered template

**Recommendations:**
- Render actual floor map/visualization or skeleton state instead of blank void
- Anchor legend to a proper sidebar or card with padding; prevent viewport clipping
- Fix top-bar label rendering so no raw em-dashes or partial template strings leak through

### founder-returning · mobile — craft **2**

**Evidence:**
- Top bar overflows viewport — timestamps clipped, icons crammed edge-to-edge with no breathing room
- Massive empty black void between header and floating list — no mobile layout adaptation, feels broken
- Floating list card bleeds off right edge, FAB-like chat bubble overlaps header awkwardly

**Recommendations:**
- Collapse top-bar icons into overflow menu on narrow widths; stack status cluster below
- Reflow floor list to full-width mobile layout instead of clipped desktop panel
- Fill empty canvas with actual floor content or skeleton — current void reads as render failure

### founder-returning · wide — craft **2**

**Evidence:**
- Massive empty black void dominates center of viewport with no content, skeleton, or loading state
- Compiling indicator with 'Waiting for first heartbeat' stuck in corner while main area renders nothing
- Legend/list clipped at bottom-right edge, items cut off mid-row

**Recommendations:**
- Add skeleton loader or empty-state illustration in main canvas while compiling
- Reserve layout space so legend anchors properly instead of overflowing viewport
- Surface loading progress inline in main area, not just corner toast

### senior-dev · laptop — craft **2**

**Evidence:**
- Massive empty viewport with no content, header, or context — looks broken not minimal
- Top bar renders cryptic fragment '— tok today EST. —' with stray em-dashes suggesting truncation/render bug
- Floating legend panel clipped off right edge, overlapping nothing, no clear anchor or purpose

**Recommendations:**
- Render actual floor/room visualization in main canvas instead of void
- Fix header string — show real timestamp/status, drop broken separator glyphs
- Anchor legend inside viewport bounds with proper padding; give it a title

### senior-dev · mobile — craft **2**

**Evidence:**
- Top bar controls overflow viewport, truncated status text '--:--' and cut-off persona badge
- Large empty black canvas with floating controls lacks structure or mobile layout adaptation
- Popover/menu clips off right edge, items bleed past screen boundary

**Recommendations:**
- Stack top-bar controls vertically or collapse into hamburger on mobile widths
- Constrain popover width to viewport with max-w and right-anchor positioning
- Fill empty canvas with mobile-appropriate content layout instead of desktop-scaled void

### senior-dev · wide — craft **2**

**Evidence:**
- Massive empty black void dominates viewport with no content skeleton or loading affordance
- Top bar shows broken/missing data: '— tok today EST. —' placeholders and stray em-dashes near status indicators
- Floor legend crammed in bottom-right corner, clipped at right edge, disconnected from any visible floor visualization

**Recommendations:**
- Render skeleton/placeholder for floor canvas during 'waiting for first heartbeat' state instead of blank void
- Replace em-dash placeholders with proper empty states (e.g. '0 tok' or '—' with consistent treatment)
- Anchor legend as proper panel with padding and prevent right-edge clipping

### founder-first-time · wide — craft **3**

**Evidence:**
- Auth card centered on vast empty black canvas wastes viewport, feels like placeholder
- Google button pure white against black = harsh contrast, not Linear-calm
- Cyan GitHub button saturation clashes with muted zinc card — no unified accent system

**Recommendations:**
- Tone GitHub button to neutral dark variant or subtle brand tint, match Google button weight
- Add subtle gradient/grid backdrop or reduce card isolation so page reads intentional not empty
- Unify both OAuth buttons to same visual weight (outline or filled, not mixed)

## memory  (avg craft: 1.69)

### live-spectator · laptop — _skipped_

- error: spawn claude ENOENT

### live-spectator · mobile — _skipped_

- error: spawn claude ENOENT

### live-spectator · wide — _skipped_

- error: spawn claude ENOENT

### operator · laptop — _skipped_

- error: spawn claude ENOENT

### operator · mobile — _skipped_

- error: spawn claude ENOENT

### operator · wide — _skipped_

- error: spawn claude ENOENT

### admin · laptop — craft **2**

**Evidence:**
- Loading… state captured as final screenshot; right pane stuck on empty 'Pick a file from the left to read it.' placeholder
- Top bar cramped with unlabeled icons, stray dashes, and low-contrast 'tok today EST.' fragment — looks debug not production
- Heavy serif 'Memory' heading clashes with mono UI chrome; Browse/Graph tabs have weak affordance, near-invisible dividers

**Recommendations:**
- Wait for loaded state before screenshot, or show skeletons instead of bare 'Loading…' text
- Replace serif H1 with UI sans; tighten top bar — label or drop stray icons, fix 'tok today EST.' copy
- Give right-pane empty state real illustration/guidance and stronger visual hierarchy vs file list

### admin · mobile — craft **2**

**Evidence:**
- Content stuck on 'Loading…' — mobile view shows unfinished state, not real UI
- Second panel (speech-bubble icon) floats disconnected, overlaps main column awkwardly on narrow width
- Large dead black space right half of screen; no mobile layout collapse, desktop chrome bleeding through

**Recommendations:**
- Collapse side rails on mobile breakpoint, single-column stack
- Resolve loader skeleton instead of raw 'Loading…' text
- Hide or dock secondary panels below main content at <768px

### admin · wide — craft **2**

**Evidence:**
- Massive empty canvas — content occupies <20% of viewport, rest dead black
- Top bar cluttered with unlabeled icons, raw timestamp `17:50:26`, and stray `—` separators
- Loading… stuck in left pane with placeholder `-` header and orphaned `Pick a file` hint

**Recommendations:**
- Constrain content width and add empty-state illustration/CTA instead of void
- Replace icon soup in header with labeled groups; drop raw clock or style as subtle status
- Resolve loading state before screenshot or show skeleton rows, not bare `Loading…` text

### founder-returning · laptop — craft **2**

**Evidence:**
- Page stuck in 'Loading…' state — no content rendered for scoring of actual memory UI
- Vast empty right pane with lone 'Pick a file from the left to read it.' placeholder — poor empty-state density
- Top bar cramped with unlabeled icons and cryptic '— tok today EST. —' text, low polish vs Linear

**Recommendations:**
- Add skeleton rows in left pane instead of bare 'Loading…' text
- Replace right-pane placeholder with illustrated empty state or recent-items suggestion
- Clarify or remove '— tok today EST. —' header fragment; label top-bar icons on hover at minimum

### founder-returning · mobile — craft **2**

**Evidence:**
- Large empty black void on right half of viewport — mobile layout broken, desktop rail not collapsed
- Top bar truncated/overlapping: '— tok today EST. —' text wraps awkwardly next to Plan/Build toggle
- Content stuck on 'Loading...' with no skeleton state; floating 'N' avatar overlaps content area

**Recommendations:**
- Collapse side rail + hide right pane on mobile breakpoints; single-column flow
- Fix top-bar overflow — truncate or stack meta chips below brand on narrow widths
- Replace 'Loading...' text with skeleton rows matching memory list shape

### founder-returning · wide — craft **2**

**Evidence:**
- Massive empty canvas with tiny left panel stuck in 'Loading...' — no skeleton, no layout balance
- Right pane shows bare hyphen header and placeholder 'Pick a file from the left to read it' — unstyled empty state
- Top bar crowded with low-contrast icon+label pairs, stray dashes around 'tok today EST.', offline dot floating next to clock

**Recommendations:**
- Render skeleton rows in file list instead of 'Loading…' text; fill right pane with branded empty state (icon, title, hint)
- Constrain content width and add panel chrome (borders, headers) so Memory page doesn't read as blank dark rectangle
- Clean top bar: drop dash separators, unify status cluster, give Memory/Chat/Metrics consistent icon sizing and spacing

### senior-dev · laptop — craft **2**

**Evidence:**
- Page stuck in 'Loading…' state with empty detail pane showing only placeholder text
- Header metadata reads '— tok today EST. —' with stray em-dashes and missing values
- Large empty right pane wastes space; no skeleton states or content hierarchy visible

**Recommendations:**
- Add skeleton loaders for file list and detail pane instead of bare 'Loading…' text
- Fix header metadata rendering so dashes/units only show when values present
- Populate empty state with useful guidance (recent files, search tips) rather than blank void

### senior-dev · mobile — craft **2**

**Evidence:**
- Stuck 'Loading...' state dominates viewport — no skeleton or progress affordance
- Massive empty black void on right side of mobile layout suggests broken responsive breakpoint
- Top bar crams truncated 'tok EST. today' text, leaving cramped unreadable header

**Recommendations:**
- Add skeleton rows for memory list instead of raw 'Loading...' text
- Fix responsive layout — memory panel should fill width on mobile, not leave half-screen void
- Collapse or wrap top-bar metadata on narrow viewports to avoid text truncation

### senior-dev · wide — craft **2**

**Evidence:**
- Stuck 'Loading…' state captured as final render — no skeleton or shimmer
- Vast empty right pane with tiny centered placeholder text, poor use of space
- Top bar cluttered with cryptic '— tok today EST. —' fragment and redundant help icons

**Recommendations:**
- Replace raw 'Loading…' with skeleton rows matching final list density
- Center placeholder in viewport with icon + primary CTA, not bare sentence
- Clean top-bar copy: drop em-dashes, consolidate duplicate question-mark icons

### founder-first-time · wide — craft **3**

**Evidence:**
- Auth card centered on vast empty black canvas wastes viewport, feels like placeholder
- Google button pure white against black = harsh contrast, not Linear-calm
- Cyan GitHub button saturation clashes with muted zinc card — no unified accent system

**Recommendations:**
- Tone GitHub button to neutral dark variant or subtle brand tint, match Google button weight
- Add subtle gradient/grid backdrop or reduce card isolation so page reads intentional not empty
- Unify both OAuth buttons to same visual weight (outline or filled, not mixed)

## build-security-secrets  (avg craft: 1.75)

### live-spectator · laptop — _skipped_

- error: spawn claude ENOENT

### live-spectator · mobile — _skipped_

- error: spawn claude ENOENT

### live-spectator · wide — _skipped_

- error: spawn claude ENOENT

### operator · laptop — _skipped_

- error: spawn claude ENOENT

### operator · mobile — _skipped_

- error: spawn claude ENOENT

### operator · wide — _skipped_

- error: spawn claude ENOENT

### senior-dev · laptop — _skipped_

- error: spawn claude ENOENT

### senior-dev · mobile — _skipped_

- error: spawn claude ENOENT

### senior-dev · wide — _skipped_

- error: spawn claude ENOENT

### admin · wide — craft **2**

**Evidence:**
- Dense uniform list no visual hierarchy group header
- Row height too cramped text near border
- Only two columns name plus repeating 'No findings' status — dead right half

**Recommendations:**
- Add column headers sticky with sort affordance
- Group by category or introduce zebra striping and severity badges
- Increase row padding widen status column add counts or timestamps

### founder-returning · mobile — craft **2**

**Evidence:**
- Massive empty black void dominates viewport below tabs — no content, no skeleton, no empty state illustration
- Top bar text overlaps/truncates awkwardly (`— tok` `EST.` `today` fragments visible) — broken responsive layout on mobile
- Empty-state copy 'No scans available. Install a skill...' truncates mid-word at right edge, no word-wrap

**Recommendations:**
- Fix top-bar mobile layout — collapse or hide secondary meta (tokens, EST, time) below breakpoint
- Give empty state proper centered layout with icon + full-width copy, not left-aligned truncated line
- Constrain content area width on mobile so tabs and panel align; kill dead right-column space

### admin · laptop — craft **3**

**Evidence:**
- Dense uniform list of rows with near-identical right-side status pills creates monotonous scannability
- Row heights generous but lack hierarchy — every gsd-* entry visually equal weight, no grouping or section headers
- Top bar controls render tiny/cramped at this zoom; filter chips and search lack Linear's crisp alignment

**Recommendations:**
- Add zebra striping or subtle dividers every N rows, or group by category with sticky headers
- Introduce secondary metadata column (updated-at, owner) to break row symmetry and add scanning anchors
- Tighten top toolbar spacing and use consistent pill styling between header tabs and status column

### admin · mobile — craft **3**

**Evidence:**
- Mobile viewport but desktop sidebar still rendered, squeezing main content
- Table rows repeat identical 'No findings / Rescan' pattern with no visual hierarchy or grouping
- Top toolbar overflows — tabs and controls cramped against right edge

**Recommendations:**
- Collapse sidebar to hamburger under mobile breakpoint
- Add zebra striping or section dividers; right-align Rescan as secondary action
- Stack or scroll toolbar; ensure tap targets ≥44px

### founder-first-time · wide — craft **3**

**Evidence:**
- Auth card centered on vast empty black canvas wastes viewport, feels like placeholder
- Google button pure white against black = harsh contrast, not Linear-calm
- Cyan GitHub button saturation clashes with muted zinc card — no unified accent system

**Recommendations:**
- Tone GitHub button to neutral dark variant or subtle brand tint, match Google button weight
- Add subtle gradient/grid backdrop or reduce card isolation so page reads intentional not empty
- Unify both OAuth buttons to same visual weight (outline or filled, not mixed)

### founder-returning · laptop — craft **3**

**Evidence:**
- Empty state is a single bare sentence with no icon, heading, or CTA button
- Topbar clock/offline indicator render as raw ASCII-ish text ('— tok today EST. —', '• Offline • —') looking unfinished
- Vast empty canvas below short tab row feels unbalanced; no content scaffolding or skeleton

**Recommendations:**
- Design proper empty state: icon + heading + description + primary CTA ('Install skill') matching Linear's empty-state pattern
- Replace placeholder topbar text with formatted status chips (typography, dot indicators, proper spacing)
- Add content container/card around empty state so it anchors visually instead of floating in void

### founder-returning · wide — craft **3**

**Evidence:**
- Vast empty canvas with single empty-state line left-aligned at top — no centered empty-state card, icon, or CTA
- Top bar shows placeholder glyphs ('— tok today EST. —', '—:—:—', 'Offline · —') indicating unfinished data bindings visible to user
- Tab row lacks underline weight/indicator polish; active 'Secrets' tab reads as flat filled block rather than Linear-style subtle accent

**Recommendations:**
- Replace bare text with centered empty-state: icon + headline + description + primary CTA ('Install a skill')
- Hide or gracefully format placeholder metrics in top bar until real data resolves instead of em-dash filler
- Refine tab active state to Linear pattern: transparent bg + 2px bottom border accent, consistent typographic weight

## build-skills  (avg craft: 1.80)

### live-spectator · laptop — _skipped_

- error: spawn claude ENOENT

### live-spectator · mobile — _skipped_

- error: spawn claude ENOENT

### live-spectator · wide — _skipped_

- error: spawn claude ENOENT

### operator · laptop — _skipped_

- error: spawn claude ENOENT

### operator · mobile — _skipped_

- error: spawn claude ENOENT

### operator · wide — _skipped_

- error: spawn claude ENOENT

### senior-dev · laptop — _skipped_

- error: spawn claude ENOENT

### senior-dev · mobile — _skipped_

- error: claude -p exited 1: Error: claude native binary not installed.

Either postinstall did not run (--ignore-scripts, some pnpm configs)
or the platform-native optional dependency was not downloaded
(--omit=optional).

Run the postinstall manually (adjust path for local vs global install):
  node node_modules/@anthropic-ai/claude-code/install.cjs

Or reinstall without --ignore-scripts / --omit=optional.


### senior-dev · wide — _skipped_

- error: claude -p exited 1: Error: claude native binary not installed.

Either postinstall did not run (--ignore-scripts, some pnpm configs)
or the platform-native optional dependency was not downloaded
(--omit=optional).

Run the postinstall manually (adjust path for local vs global install):
  node node_modules/@anthropic-ai/claude-code/install.cjs

Or reinstall without --ignore-scripts / --omit=optional.


### admin · mobile — craft **3**

**Evidence:**
- Mobile layout renders as single long scroll of near-identical card rows with no grouping, density variation, or section anchors
- Typography hierarchy is flat — title/meta/body blend into one gray mass per card
- No visible filter/sort/search affordances despite long list; header region minimal

**Recommendations:**
- Add sticky section headers or category grouping to break the uniform vertical rhythm
- Differentiate title vs metadata with weight/color contrast closer to Linear's 2-tier scale
- Introduce filter chips or a search field at top of list for long-list navigation

### admin · wide — craft **3**

**Evidence:**
- Dense card grid lacks visual hierarchy — every card weighted equally with no grouping or scannable headers
- Cyan badge accents clash with muted neutrals; saturation feels arbitrary vs. Linear's restrained palette
- Card padding and line-height feel cramped; descriptions truncate awkwardly and titles blur together at wide viewport

**Recommendations:**
- Introduce category grouping or sectioned headers to break the uniform wall of cards
- Tone down badge saturation and standardize badge variants (level vs. status) with consistent color semantics
- Increase card padding, tighten typographic scale (title/meta/description), and add hover affordance for Linear-grade polish

### founder-first-time · wide — craft **3**

**Evidence:**
- Auth card centered on vast empty black canvas wastes viewport, feels like placeholder
- Google button pure white against black = harsh contrast, not Linear-calm
- Cyan GitHub button saturation clashes with muted zinc card — no unified accent system

**Recommendations:**
- Tone GitHub button to neutral dark variant or subtle brand tint, match Google button weight
- Add subtle gradient/grid backdrop or reduce card isolation so page reads intentional not empty
- Unify both OAuth buttons to same visual weight (outline or filled, not mixed)

### founder-returning · laptop — craft **3**

**Evidence:**
- Uniform teal badges on every card create monotonous visual rhythm, no hierarchy
- Card grid dense but typography scale flat — titles and descriptions blend at glance
- Excessive vertical scroll with no section grouping or filtering affordance visible beyond two tabs

**Recommendations:**
- Vary badge color by skill category or status to break visual monotony
- Stronger type hierarchy: bolder/larger skill names, muted descriptions
- Add category sections or sticky filter chips to chunk the long list

### founder-returning · mobile — craft **3**

**Evidence:**
- Mobile view renders as long uniform scroll of repeated cards with no grouping, section headers, or visual hierarchy
- Cards appear flat and monotonous — identical sizing/padding creates wall-of-text feel
- No sticky header, filter chips, or progress affordance visible on mobile to orient user

**Recommendations:**
- Add section grouping (by level/track) with sticky subheaders to break scroll
- Introduce density/hierarchy: larger title, muted meta row, subtle card elevation or divider variation
- Add filter/search chip row pinned to top for navigation in long list

### founder-returning · wide — craft **3**

**Evidence:**
- Dense uniform card grid lacks visual hierarchy — all skills weighted equally with no grouping or sorting affordance
- Teal badges fight for attention across every card creating noisy rhythm vs Linear's restrained accent usage
- Tab row ('Skills'/unreadable second) and header sit cramped against content with weak spacing scale

**Recommendations:**
- Introduce grouping (category sections or filter chips) and reduce badge saturation to tertiary weight
- Tighten typographic hierarchy: larger card titles, muted metadata, consistent 8pt spacing between card rows
- Add empty-state/search affordance and sticky filter bar so 100+ cards become navigable not a wall

## build  (avg craft: 1.81)

### live-spectator · laptop — _skipped_

- error: spawn claude ENOENT

### live-spectator · mobile — _skipped_

- error: spawn claude ENOENT

### live-spectator · wide — _skipped_

- error: spawn claude ENOENT

### operator · laptop — _skipped_

- error: spawn claude ENOENT

### operator · mobile — _skipped_

- error: spawn claude ENOENT

### operator · wide — _skipped_

- error: spawn claude ENOENT

### senior-dev · laptop — _skipped_

- error: spawn claude ENOENT

### senior-dev · mobile — _skipped_

- error: spawn claude ENOENT

### senior-dev · wide — _skipped_

- error: spawn claude ENOENT

### founder-returning · mobile — craft **2**

**Evidence:**
- Top header overflows viewport — controls clip off right edge
- Mission Control cards (BURN, LAST 60S) clipped at right; content cut mid-text
- Floating chat bubble overlaps 'Building cae-dashboard' heading and tag

**Recommendations:**
- Stack header into mobile layout; hide non-essential chrome below sm breakpoint
- Make MissionControl grid single-column on mobile so cards aren't clipped
- Reposition floating chat icon to bottom-right with safe-area offset, not overlapping H1

### admin · laptop — craft **3**

**Evidence:**
- Live Floor dropdown overlaps and visually collides with Live activity card, breaking layout hierarchy
- Four Mission Control tiles (ACTIVE/BURN/BUDGET/LAST 60S) render empty with only placeholder 'appears when...' text — looks broken, not intentional
- Status row cards (shipped/in-flight/warnings/blocked/tok) all show identical 0 NOMINAL state, flat and repetitive without visual differentiation

**Recommendations:**
- Fix Live Floor popover z-index/position so it docks cleanly instead of floating over adjacent card
- Replace empty-state placeholder text in Mission Control tiles with proper skeleton loaders or dashed empty-state treatment
- Vary typographic weight/color on status tiles so zero-states read as calm rather than stamped-out duplicates

### admin · mobile — craft **3**

**Evidence:**
- Header crowding: top bar elements overflow/truncate (EST. —, tok today, icon cluster squeezed)
- Layout break: 'cae-dashboard' pill overlaps Mission Control card boundary; Live activity card right edge clipped
- Inconsistent spacing between stat tiles and stray sections (LIVE OPS, ACTIVE PHASES) break the card grid rhythm

**Recommendations:**
- Collapse header icons into overflow menu below ~420px; stack EST/tok meta under title
- Constrain all cards to viewport width with uniform gutter; fix overlap of title pill and Mission Control panel
- Unify stat tiles into 2-col grid with equal padding; promote LIVE OPS/ACTIVE PHASES into same card system as top tiles

### admin · wide — craft **3**

**Evidence:**
- Live Floor panel overflows container — bullet list bleeds outside card right edge, header 'Live Floor' clipped
- Top-right header row has orphaned dashes/em-dashes ('— ——:——:—— —') where timers/status should render, reads like unpopulated template strings
- Empty-state density uneven: Live activity shows 3 blank skeleton tiles while Recent shows centered clock illustration — inconsistent empty-state language

**Recommendations:**
- Constrain Live Floor list to card bounds with overflow scroll or truncate; fix z-index/width so it does not escape the grid cell
- Replace unpopulated timer placeholders with explicit 'idle' or '—' tokens matching the existing 'idle' label on Last 60s, or hide until data present
- Unify empty states: pick either skeleton shimmer or iconographic message and apply consistently across Live activity, Recent, Needs you

### founder-first-time · wide — craft **3**

**Evidence:**
- Auth card centered on vast empty black canvas wastes viewport, feels like placeholder
- Google button pure white against black = harsh contrast, not Linear-calm
- Cyan GitHub button saturation clashes with muted zinc card — no unified accent system

**Recommendations:**
- Tone GitHub button to neutral dark variant or subtle brand tint, match Google button weight
- Add subtle gradient/grid backdrop or reduce card isolation so page reads intentional not empty
- Unify both OAuth buttons to same visual weight (outline or filled, not mixed)

### founder-returning · laptop — craft **3**

**Evidence:**
- Live Floor tooltip/popover overlaps and obscures the Live Floor panel content, creating visible layout collision
- Mission Control cards show only tiny placeholder labels ('appears when...') with large empty vertical space — unfinished empty states
- Inconsistent card density and typographic hierarchy: 'Live activity' metrics (0, Idle, 1) feel oversized vs adjacent shipped/in-flight/blocked/tok tiles

**Recommendations:**
- Fix z-index/positioning so Live Floor hover content does not cover the panel it belongs to
- Design proper empty states for Mission Control tiles (skeleton, muted hint centered, or hide until data)
- Normalize metric tile heights and number sizing across Live activity and status row for Linear-grade rhythm

### founder-returning · wide — craft **3**

**Evidence:**
- Live Floor panel overlaps main content as floating popover, breaking layout grid
- Mission Control metric cards show empty states (0 agents, 0% budget, idle sparkline) making hero row feel hollow
- Inconsistent typography weight/size between 'Building cae-dashboard' title and smaller section headers; monospace timestamp in header clashes with sans body

**Recommendations:**
- Anchor Live Floor to a proper dock slot instead of overlapping content, or hide until data arrives
- Replace empty zero-state cards with skeletons or contextual copy so idle state reads intentional not broken
- Unify header typography — pick one family for chrome (drop monospace EST timestamp or apply consistently)

## floor-popout  (avg craft: 1.88)

### founder-returning · wide — craft **1**

**Evidence:**
- Near-empty black canvas — main content area blank except small 'N' avatar bottom-left
- Floating legend panel bottom-right detached from any visible content, orphaned
- Top-right icon cluster (pause/collapse/help) and chat bubble float without context or grouping

**Recommendations:**
- Render actual floor content in main canvas — current state reads as broken/loading
- Anchor legend to a visible map/diagram or remove until content exists
- Add empty-state treatment if popout genuinely has no data yet

### live-spectator · wide — _skipped_

- error: spawn claude ENOENT

### operator · wide — _skipped_

- error: spawn claude ENOENT

### admin · laptop — craft **2**

**Evidence:**
- Massive empty black canvas — no admin content rendered, only chrome remnants visible
- Floating legend panel clipped at right edge with no container framing or alignment to grid
- Top-right icon cluster overlaps chat bubble icon, no spacing discipline

**Recommendations:**
- Render actual admin floor content instead of empty void — route appears broken or pre-hydration
- Anchor legend in proper sidebar/panel with full visibility, not bleeding off viewport
- Separate header icon controls from floating chat affordance with clear spacing tokens

### admin · mobile — craft **2**

**Evidence:**
- Massive empty black void dominates viewport with no content or skeleton
- Floor popout menu clipped off right edge, items extend past viewport
- Top-right icon cluster lacks spacing/grouping, floats against void

**Recommendations:**
- Constrain popout width to viewport with proper right-edge padding on mobile
- Render primary route content instead of empty dark canvas
- Group header controls with consistent gap and container background

### admin · wide — craft **2**

**Evidence:**
- Vast empty black canvas with no content framing, headers, or layout structure
- Legend panel clipped at right edge, items overflow viewport
- Waiting state badge ('waiting for first heartbeat') text clipped behind avatar circle bottom-left

**Recommendations:**
- Constrain legend to a bounded panel inside viewport, not absolute-positioned off-screen
- Render skeleton or empty-state placeholder in main canvas while heartbeat pending
- Fix z-index/overflow on status pill so text not occluded by avatar

### founder-returning · laptop — craft **2**

**Evidence:**
- Massive empty black canvas — no admin content rendered, only chrome remnants visible
- Floating legend panel clipped at right edge with no container framing or alignment to grid
- Top-right icon cluster overlaps chat bubble icon, no spacing discipline

**Recommendations:**
- Render actual admin floor content instead of empty void — route appears broken or pre-hydration
- Anchor legend in proper sidebar/panel with full visibility, not bleeding off viewport
- Separate header icon controls from floating chat affordance with clear spacing tokens

### founder-returning · mobile — craft **2**

**Evidence:**
- Vast empty black canvas with no content rendered on mobile viewport
- Legend panel overflows right edge, text clipped
- Status pill 'Waiting for first heartbeat' overlaps avatar in bottom-left

**Recommendations:**
- Render floor content or skeleton state instead of blank void on mobile
- Constrain legend to viewport width with proper mobile layout
- Separate heartbeat status from avatar with spacing or stack vertically

### live-spectator · laptop — craft **2**

**Evidence:**
- Massive empty black canvas — no admin content rendered, only chrome remnants visible
- Floating legend panel clipped at right edge with no container framing or alignment to grid
- Top-right icon cluster overlaps chat bubble icon, no spacing discipline

**Recommendations:**
- Render actual admin floor content instead of empty void — route appears broken or pre-hydration
- Anchor legend in proper sidebar/panel with full visibility, not bleeding off viewport
- Separate header icon controls from floating chat affordance with clear spacing tokens

### live-spectator · mobile — craft **2**

**Evidence:**
- Massive empty black void dominates viewport with no content or skeleton
- Floor popout menu clipped off right edge, items extend past viewport
- Top-right icon cluster lacks spacing/grouping, floats against void

**Recommendations:**
- Constrain popout width to viewport with proper right-edge padding on mobile
- Render primary route content instead of empty dark canvas
- Group header controls with consistent gap and container background

### operator · laptop — craft **2**

**Evidence:**
- Massive empty black canvas — no admin content rendered, only chrome remnants visible
- Floating legend panel clipped at right edge with no container framing or alignment to grid
- Top-right icon cluster overlaps chat bubble icon, no spacing discipline

**Recommendations:**
- Render actual admin floor content instead of empty void — route appears broken or pre-hydration
- Anchor legend in proper sidebar/panel with full visibility, not bleeding off viewport
- Separate header icon controls from floating chat affordance with clear spacing tokens

### operator · mobile — craft **2**

**Evidence:**
- Vast empty black canvas with no content rendered on mobile viewport
- Legend panel overflows right edge, text clipped
- Status pill 'Waiting for first heartbeat' overlaps avatar in bottom-left

**Recommendations:**
- Render floor content or skeleton state instead of blank void on mobile
- Constrain legend to viewport width with proper mobile layout
- Separate heartbeat status from avatar with spacing or stack vertically

### senior-dev · laptop — craft **2**

**Evidence:**
- Massive empty black canvas — no admin content rendered, only chrome remnants visible
- Floating legend panel clipped at right edge with no container framing or alignment to grid
- Top-right icon cluster overlaps chat bubble icon, no spacing discipline

**Recommendations:**
- Render actual admin floor content instead of empty void — route appears broken or pre-hydration
- Anchor legend in proper sidebar/panel with full visibility, not bleeding off viewport
- Separate header icon controls from floating chat affordance with clear spacing tokens

### senior-dev · mobile — craft **2**

**Evidence:**
- Vast empty black canvas with no content rendered on mobile viewport
- Legend panel overflows right edge, text clipped
- Status pill 'Waiting for first heartbeat' overlaps avatar in bottom-left

**Recommendations:**
- Render floor content or skeleton state instead of blank void on mobile
- Constrain legend to viewport width with proper mobile layout
- Separate heartbeat status from avatar with spacing or stack vertically

### senior-dev · wide — craft **2**

**Evidence:**
- Vast empty black canvas — content occupies <10% of viewport, rest is dead space
- Floating legend pinned bottom-right with no container/card treatment, looks orphaned
- Top-right icon cluster and chat bubble float without grouping or visual anchor

**Recommendations:**
- Fill canvas with actual floor plan visualization or constrain viewport to content bounds
- Wrap legend in bordered panel with padding, align to consistent edge gutter
- Group header controls into toolbar with shared background/border

### founder-first-time · wide — craft **3**

**Evidence:**
- Auth card centered on vast empty black canvas wastes viewport, feels like placeholder
- Google button pure white against black = harsh contrast, not Linear-calm
- Cyan GitHub button saturation clashes with muted zinc card — no unified accent system

**Recommendations:**
- Tone GitHub button to neutral dark variant or subtle brand tint, match Google button weight
- Add subtle gradient/grid backdrop or reduce card isolation so page reads intentional not empty
- Unify both OAuth buttons to same visual weight (outline or filled, not mixed)

## metrics  (avg craft: 1.88)

### founder-returning · wide — craft **1**

**Evidence:**
- Next.js build error overlay — route fails to render
- Parsing error in workflows-list-client.tsx (114:9): Expression expected
- No dashboard content visible, only error dialog

**Recommendations:**
- Fix JSX syntax error at workflows-list-client.tsx:114 (unclosed/mismatched tag near </>)
- Re-run build and recapture screenshot once route renders
- Add pre-capture build-health gate to skip broken routes in audit

### live-spectator · laptop — _skipped_

- error: spawn claude ENOENT

### live-spectator · mobile — _skipped_

- error: spawn claude ENOENT

### live-spectator · wide — _skipped_

- error: spawn claude ENOENT

### operator · laptop — _skipped_

- error: spawn claude ENOENT

### operator · mobile — _skipped_

- error: spawn claude ENOENT

### operator · wide — _skipped_

- error: spawn claude ENOENT

### admin · laptop — craft **2**

**Evidence:**
- Giant '0 tok' / '~0 tok' numerals dominate Spending card with weak hierarchy and awkward spacing
- Incident Stream rows are repetitive red pills with cramped timestamps — visually noisy, not Linear-calm
- Bar chart on right is oversized, unlabeled axes, floating '3 waiting' pill collides with chart area

**Recommendations:**
- Tighten type scale: smaller metric numerals, clearer labels, consistent card padding
- Replace solid red pill spam with muted severity dots + tabular rows; group or collapse duplicates
- Normalize chart sizing, add axis labels/units, separate status chips from plot area

### admin · mobile — craft **2**

**Evidence:**
- Header overlaps body content — 'tok today' text bleeds into sidebar area
- Sidebar rail renders as full-width overlay on mobile instead of collapsing, crushing main content
- Skeleton loaders dominate viewport; no real data visible in captured state

**Recommendations:**
- Fix mobile layout: sidebar should collapse to drawer/off-canvas, not overlap header
- Resolve header truncation — 'EST.' and token counter clipping into sidebar
- Wait for data hydration before screenshot or add proper empty-state instead of persistent skeletons

### admin · wide — craft **2**

**Evidence:**
- All four panels stuck in skeleton-loader state on 'healthy' capture — no real data rendered
- Top bar cramped/broken: stray dashes around 'tok today EST.', empty time field '--:--:--', orphan icons with no labels
- Massive empty canvas below cards; no density, hierarchy, or Linear-grade polish — reads as unfinished scaffold

**Recommendations:**
- Ensure healthy fixture resolves data before screenshot so skeletons are replaced with real metrics
- Fix top-bar string interpolation (remove leading/trailing dashes, populate time, label icon cluster)
- Tighten grid: reduce card heights to content, add section rhythm, or fill lower canvas with real widgets

### founder-returning · mobile — craft **2**

**Evidence:**
- Top bar overflows viewport — 'tok today', timestamp, Offline badge, and avatar clip/wrap awkwardly on mobile width
- Floating chat FAB overlaps page header region instead of docking bottom-right
- Entire page stuck in skeleton-loading state with no visible content or staggered fade, reads as broken

**Recommendations:**
- Collapse top-bar meta (EST, clock, status) into overflow menu below ~400px
- Anchor chat launcher to bottom-right with safe-area padding, not mid-page
- Cap skeleton duration + show empty/error state if data stalls so mobile users see real content

### founder-first-time · wide — craft **3**

**Evidence:**
- Auth card centered on vast empty black canvas wastes viewport, feels like placeholder
- Google button pure white against black = harsh contrast, not Linear-calm
- Cyan GitHub button saturation clashes with muted zinc card — no unified accent system

**Recommendations:**
- Tone GitHub button to neutral dark variant or subtle brand tint, match Google button weight
- Add subtle gradient/grid backdrop or reduce card isolation so page reads intentional not empty
- Unify both OAuth buttons to same visual weight (outline or filled, not mixed)

### founder-returning · laptop — craft **3**

**Evidence:**
- Empty `0 tok` / `~0 tok` metric tiles dominate top-left with no visual hierarchy or empty-state treatment
- Giant `3 waiting` number in Flow Zeit card clashes with compact scale of adjacent tiles — inconsistent typographic rhythm
- Heatmap/grid in `How well it's going` card renders as loose scattered cells, reads unpolished vs Linear's dense aligned grids

**Recommendations:**
- Add proper empty states for zero-value metrics (muted copy, not giant `0 tok`)
- Normalize number-display scale across cards — one hero metric per card max
- Tighten heatmap cell sizing/alignment and align card internal padding to shared grid

### senior-dev · laptop — craft **3**

**Evidence:**
- Giant '0 tok' / '~0 tok' numerals dominate Spending card, crude scale vs other text
- Empty-state copy bleeds into card body with no illustration or hierarchy; feels placeholder
- Bar chart labels overflow/clip ('3 waiting' overlapping bars), axis ticks dense and unstyled

**Recommendations:**
- Right-size KPI numerals and add unit/label pair styling like Linear metric cards
- Design proper empty states (icon + single line) instead of raw sentences centered in card
- Fix chart label layout: truncate or move legend out of plot area, thin axis ticks

### senior-dev · mobile — craft **3**

**Evidence:**
- Top bar cramped on mobile — 'EST.' and 'today' text overlap with clock placeholder ('--:--') and icon row, no responsive stacking
- Skeleton loaders dominate viewport; 'Spending' and 'How fast' sections show only shimmer blocks with no real data hierarchy
- Floating 'N' and chat bubble widgets sit awkwardly mid-canvas, clipping content edges rather than docked/safe-area aligned

**Recommendations:**
- Collapse top bar into hamburger + title on <640px; hide EST/clock secondary text or move to overflow menu
- Stagger skeleton reveal or show partial real content to avoid full-screen shimmer state
- Anchor floating action buttons to bottom-right with proper safe-area insets, not overlapping card borders

### senior-dev · wide — craft **3**

**Evidence:**
- Heavy skeleton loaders dominate view — no actual metrics rendered
- Top bar crowded with cryptic '— tok today EST. —' placeholder text
- Incident Stream card renders but other three quadrants remain empty shells

**Recommendations:**
- Replace skeletons with real data or tighten perceived load time
- Fix placeholder token/time string in top bar to show real values or hide until ready
- Align card heights and content density across quadrants for balance

## plan  (avg craft: 1.88)

### founder-returning · mobile — _skipped_

- error: spawn claude ENOENT

### founder-returning · wide — _skipped_

- error: spawn claude ENOENT

### live-spectator · laptop — _skipped_

- error: spawn claude ENOENT

### live-spectator · mobile — _skipped_

- error: spawn claude ENOENT

### live-spectator · wide — _skipped_

- error: spawn claude ENOENT

### operator · laptop — _skipped_

- error: spawn claude ENOENT

### operator · mobile — _skipped_

- error: spawn claude ENOENT

### operator · wide — _skipped_

- error: spawn claude ENOENT

### admin · mobile — craft **2**

**Evidence:**
- Top bar overflows viewport — 'today', time, 'Offline' clipped; icon row crammed edge-to-edge
- Chat pop-out panel overlays main content, truncating heading and body copy mid-word
- Mobile layout shows desktop chrome instead of responsive treatment — no hamburger, tabs unstyled

**Recommendations:**
- Collapse top-bar icons into overflow menu <768px; hide clock/status or move to drawer
- Make chat pop-out a bottom sheet or dismissable FAB on mobile, not fixed overlay
- Apply responsive padding + stack tabs; ensure main content gets full viewport width

### senior-dev · mobile — craft **2**

**Evidence:**
- Top bar overflows viewport — token counter, timestamps, and Live indicator wrap/clip awkwardly on mobile width
- Chat rail panel occupies right half of screen with empty black void, breaking mobile layout
- Main content truncated mid-sentence ('Plan mode is where Projects, PRDs, Roadmaps, and...') due to rail overlap

**Recommendations:**
- Collapse top bar into hamburger/overflow menu at mobile breakpoints; hide secondary metrics below md
- Make chat rail a drawer/sheet on mobile instead of persistent side panel
- Constrain main content to full viewport width; stack tabs and empty state properly below sm

### admin · laptop — craft **3**

**Evidence:**
- Empty-state card centered but body copy orphaned high on page with massive whitespace gap below
- Top bar typography mixes serif heading with monospaced status text inconsistently
- Tabs (Projects/PRDs/Roadmaps/UAT) render as flat low-contrast text, no active indicator or Linear-style pill treatment

**Recommendations:**
- Anchor empty-state card to intro copy or vertically center in remaining viewport to kill dead space
- Promote active tab with underline/pill and raise inactive tab contrast to match Linear nav
- Unify header typography — drop serif or commit to it consistently, tighten status chip styling

### admin · wide — craft **3**

**Evidence:**
- Empty-state card centered with tiny compass glyph, minimal visual hierarchy — reads thin and placeholder-y
- Top chrome cluster (status dots, offline pill, avatar) crammed without spacing rhythm; dashes used as literal separators look like render glitches
- Tab row (Projects/PRDs/Roadmaps/UAT) low-contrast and non-interactive feel — no active state, no underline system

**Recommendations:**
- Replace em-dash separators in header with proper divider component or gap spacing; tighten status cluster to Linear-style pill group
- Give empty state real structure: larger illustration, primary+secondary CTA, or skeleton of future content instead of single card
- Add active-tab treatment (underline/filled) and hover states to tab row; raise label contrast to match Linear's token scale

### founder-first-time · wide — craft **3**

**Evidence:**
- Auth card centered on vast empty black canvas wastes viewport, feels like placeholder
- Google button pure white against black = harsh contrast, not Linear-calm
- Cyan GitHub button saturation clashes with muted zinc card — no unified accent system

**Recommendations:**
- Tone GitHub button to neutral dark variant or subtle brand tint, match Google button weight
- Add subtle gradient/grid backdrop or reduce card isolation so page reads intentional not empty
- Unify both OAuth buttons to same visual weight (outline or filled, not mixed)

### founder-returning · laptop — craft **3**

**Evidence:**
- Empty-state card centered but page has huge unused whitespace below, layout feels unbalanced
- Top bar mixes cryptic tokens ('0 tok today EST.', 'just now 21:27:02', 'Live · 0s') — noisy, non-Linear
- Headline 'Plan' uses serif font that clashes with rest of sans-serif UI chrome

**Recommendations:**
- Drop serif headline, use consistent sans type scale like Linear's Inter
- Consolidate top-bar status chips, hide debug/token counters from founder view
- Tighten vertical rhythm — move empty-state up or add secondary content so page doesn't feel abandoned

### senior-dev · laptop — craft **3**

**Evidence:**
- Empty-state card centered but page has vast dead space below — feels unfinished not intentional
- Top bar icons cluster with no labels or grouping; 'tok today EST.' string looks like debug text
- Tab row (Projects/PRDs/Roadmaps/UAT) all inactive with no default selection — user lands on nothing

**Recommendations:**
- Select a default tab and show skeleton/empty states per tab instead of global placeholder
- Constrain page height or add footer/context so empty state doesn't float in void
- Replace 'tok today EST.' debug string with real clock or remove; label top-bar icons on hover

### senior-dev · wide — craft **3**

**Evidence:**
- Vast empty canvas with single small centered card reads as unfinished placeholder, not intentional empty state
- Top bar cluttered with broken/placeholder text ('— tok today EST. —', '—:—:—', 'Offline · —') undermining polish
- Tab row (Projects/PRDs/Roadmaps/UAT) visually inert — no active state, no content, no hierarchy

**Recommendations:**
- Replace placeholder dashes with real values or hide until ready; empty state should feel designed, not broken
- Give tabs a selected state and show skeleton/preview content per tab instead of single generic card
- Tighten vertical rhythm — card floating mid-page wastes space; anchor nearer content or add supporting structure

## build-workflows  (avg craft: 1.93)

### live-spectator · laptop — _skipped_

- error: spawn claude ENOENT

### live-spectator · mobile — _skipped_

- error: spawn claude ENOENT

### live-spectator · wide — _skipped_

- error: spawn claude ENOENT

### operator · laptop — _skipped_

- error: spawn claude ENOENT

### operator · mobile — _skipped_

- error: spawn claude ENOENT

### operator · wide — _skipped_

- error: spawn claude ENOENT

### admin · mobile — craft **2**

**Evidence:**
- Top bar overflows viewport — tokens/EST/timer truncated to dashes and labels clip mid-word
- Recipes panel right-clipped: 'New recipe' button and card content cut off at ~345px
- Chat bubble FAB overlaps page content, no safe-area offset on mobile

**Recommendations:**
- Collapse top bar into hamburger + essentials on <480px; move meters to drawer
- Constrain main content to viewport width with horizontal padding; stop fixed desktop widths leaking to mobile
- Reposition floating chat button to bottom-right with content padding to avoid overlap

### founder-returning · mobile — craft **2**

**Evidence:**
- Top bar content clipped: 'tok today', 'EST.', '— —' fragments bleed past viewport on mobile width
- Chat drawer overlays mid-canvas leaving large empty black void to its right — not responsive, desktop layout squeezed into mobile
- 'New recipe' button and Recipes heading truncated at right edge; horizontal overflow instead of mobile-adapted layout

**Recommendations:**
- Add mobile breakpoint: collapse left rail to drawer, stack top-bar meta, hide secondary status chips under menu
- Make chat panel full-width bottom sheet on mobile, not floating desktop column
- Constrain content to viewport width; truncate or wrap top-bar telemetry instead of clipping

### senior-dev · mobile — craft **2**

**Evidence:**
- Chat panel overlays main content, clipping 'New recipe' button and right side of empty state
- Top bar text truncated/wrapped awkwardly ('— tok' / 'today' / 'EST.')
- Large empty right region where chat extends past content with no visual containment

**Recommendations:**
- Make chat panel modal/drawer on mobile, not overlay clipping primary actions
- Collapse top-bar meta (tokens/EST/time) into overflow menu at mobile widths
- Constrain content column width so empty state centers without being clipped by chat

### admin · laptop — craft **3**

**Evidence:**
- Header shows raw debug text '— tok today EST. —' next to brand, unprofessional
- Empty-state card duplicates 'No recipes yet' heading and body copy verbatim
- Two 'New recipe' buttons with inconsistent styling (cyan primary top-right vs dark secondary in card) compete for attention

**Recommendations:**
- Remove or properly format the 'tok today EST' header text
- Dedupe empty-state copy: keep heading once, use body for description only
- Consolidate to single primary CTA or differentiate purposes clearly

### admin · wide — craft **3**

**Evidence:**
- Empty state card centered-left instead of center; huge dead space right half
- Top bar cluster right side cryptic: bare em-dashes, '—:—:—' timer placeholder, unlabeled status dots feel unfinished
- Duplicate 'New recipe' CTAs (header + empty state) with inconsistent styling — header pill bright cyan, card button muted gray

**Recommendations:**
- Center empty state in full content area or constrain max-width with auto margins
- Replace placeholder dashes/timers with real labels or hide until data available
- Unify CTA: drop duplicate or match visual weight between header and empty-state buttons

### founder-first-time · wide — craft **3**

**Evidence:**
- Auth card centered on vast empty black canvas wastes viewport, feels like placeholder
- Google button pure white against black = harsh contrast, not Linear-calm
- Cyan GitHub button saturation clashes with muted zinc card — no unified accent system

**Recommendations:**
- Tone GitHub button to neutral dark variant or subtle brand tint, match Google button weight
- Add subtle gradient/grid backdrop or reduce card isolation so page reads intentional not empty
- Unify both OAuth buttons to same visual weight (outline or filled, not mixed)

### founder-returning · laptop — craft **3**

**Evidence:**
- Empty state card centered but page uses serif 'Recipes' heading mixed with sans-serif body, inconsistent typographic system
- Duplicate 'New recipe' CTA (top-right + empty state) with different styling — top cyan-filled, inline ghost — weak hierarchy
- Top bar dense with unlabeled icons and raw telemetry ('0 tok today EST.', 'just now 21:25:52', 'Live · 0s') reads like debug HUD, not Linear-grade chrome

**Recommendations:**
- Unify heading font to sans-serif matching Linear's Inter-style stack; drop serif 'Recipes'
- Collapse telemetry strip into single tooltip or hide behind dev flag; keep top bar to product-relevant actions
- Remove redundant top-right CTA when empty state already has primary action, or demote empty-state button to secondary

### senior-dev · laptop — craft **3**

**Evidence:**
- Empty state centered but large blank canvas below feels unbalanced
- Duplicate 'New recipe' CTAs (top-right + empty state) redundant
- Top bar cramped with cryptic '— tok today EST. —' text, low polish

**Recommendations:**
- Remove redundant top-right CTA when empty state owns primary action
- Replace cryptic status text with clear labels (e.g. 'Tokens today')
- Constrain empty state card width or add secondary content to balance viewport

## build-workflows-new  (avg craft: 2.13)

### live-spectator · laptop — _skipped_

- error: spawn claude ENOENT

### live-spectator · mobile — _skipped_

- error: spawn claude ENOENT

### live-spectator · wide — _skipped_

- error: spawn claude ENOENT

### operator · laptop — _skipped_

- error: spawn claude ENOENT

### operator · mobile — _skipped_

- error: spawn claude ENOENT

### operator · wide — _skipped_

- error: spawn claude ENOENT

### admin · mobile — craft **2**

**Evidence:**
- Massive empty black void on right half of mobile viewport — content column ~330px wide with ~390px of dead space, breaks responsive expectation
- Top header truncated/broken: '— tok today EST. — -:-' and '-:-' fragments suggest unrendered template values or clipped labels
- Floating chat bubble overlaps form area; bottom-left circular 'N' badge floats with no anchor or label

**Recommendations:**
- Fix mobile layout to use full viewport width — container appears desktop-locked at ~330px
- Resolve header placeholder strings (tok/EST/time) so no raw '—' or ':' fragments render
- Reposition or hide floating overlays (chat, 'N' badge) on mobile to avoid covering form controls

### founder-returning · mobile — craft **2**

**Evidence:**
- Mobile viewport shows desktop sidebar + rail eating half the screen, leaving form cramped in middle column
- Large empty black void on right side — layout not responsive, no mobile breakpoint applied
- Top bar truncated ('— tok today EST. —') and controls overlap awkwardly at this width

**Recommendations:**
- Collapse left rail + sidebar into hamburger/drawer below md breakpoint
- Make form column fill viewport width on mobile instead of fixed desktop grid
- Fix top-bar overflow — stack or hide secondary controls under sm breakpoint

### admin · laptop — craft **3**

**Evidence:**
- Header text '— tok today EST. —' reads as debug/placeholder, not polished copy
- Right panel 'No steps yet' box is oversized empty rectangle with weak hierarchy vs left form
- Two-column split unbalanced: left form short, right preview huge whitespace, no visual rhythm

**Recommendations:**
- Replace header dashes with proper timestamp/context chip, remove EST. artifact
- Collapse empty-state panel height or add illustrative placeholder steps to balance columns
- Tighten button styles: 'Draft it' and 'Save recipe' use different fill tones, unify primary/secondary hierarchy

### admin · wide — craft **3**

**Evidence:**
- Header shows raw placeholder text '— tok today EST. —' indicating unfilled template values
- Huge empty 'Here's the recipe' canvas dominates right column with only italic 'No steps yet' — wastes viewport, no empty-state guidance
- Right rail chat bubble and bottom-left avatar float without visual anchor; left-column form ends at ~30% height leaving vast dead space

**Recommendations:**
- Replace placeholder tokens and suppress estimate chip when null instead of rendering em-dashes
- Design proper empty state for recipe canvas: illustration or structured hint cards ('Step 1: trigger', 'Step 2: action') instead of italic text
- Constrain form/canvas to shared max-height or add preview content so layout doesn't collapse into whitespace on wide viewports

### founder-first-time · wide — craft **3**

**Evidence:**
- Auth gate shown instead of target route — screenshot captures sign-in card, not build-workflows-new page
- 'Compiling' toast bottom-left indicates dev build in progress during capture
- Card composition is clean but generic — logo + two OAuth buttons, no Linear-grade polish (no subtle gradient depth, typography hierarchy thin)

**Recommendations:**
- Re-capture after build settles and auth bypass applied so target route renders
- Tighten sign-in card: refine robot logo stroke weight, add subtle border highlight, soften button shadows for Linear-like depth
- Remove or reposition 'Compiling' indicator during audit runs

### founder-returning · laptop — craft **3**

**Evidence:**
- Huge empty right column with solitary 'new-recipe' name field floats disconnected from preview card
- Left column buttons stacked vertically with inconsistent colors (teal 'Draft it', cyan 'Save recipe') and no visual hierarchy
- Vast unused canvas below fold — no density, no supporting context, page feels half-built

**Recommendations:**
- Collapse to single-column form or tighten two-column grid; align Name field with preview card top
- Unify button styling — primary/secondary pair, same hue family, consistent sizing
- Add step scaffolding, examples, or recipe templates to fill canvas and guide first use

### founder-returning · wide — craft **3**

**Evidence:**
- Massive empty right-column whitespace below Name field — layout feels unfinished
- Top bar shows raw placeholder text '- tok today EST. -' with literal dashes
- Two stacked primary-colored buttons (Draft it / Save recipe) compete visually, no hierarchy

**Recommendations:**
- Fix top-bar time/status rendering — strip placeholder dashes, use proper typography
- Differentiate button hierarchy: primary for Save, secondary/ghost for Draft it
- Tighten vertical rhythm or add content/helper text to balance left vs right column

### senior-dev · laptop — craft **3**

**Evidence:**
- Vast empty canvas right of form — no visual hierarchy or density
- Two stacked CTAs (Draft it / Save recipe) misaligned, no primary/secondary distinction
- 'Here's the recipe' panel huge but empty, Name field floats below disconnected

**Recommendations:**
- Group Draft/Save horizontally, mark one primary
- Constrain form column width, move recipe preview into card with Name inside
- Add empty-state illustration or hint copy in steps panel

### senior-dev · mobile — craft **3**

**Evidence:**
- Massive empty right-side gutter on mobile viewport — content column narrow, rest of screen black
- Two stacked CTAs (Draft it / Save recipe) left-aligned with no hierarchy grouping, cramped in narrow column
- Top bar overflows: date label wraps mid-word ('— tok today'), icon row crowds timer/status chips

**Recommendations:**
- Collapse left rail to drawer on mobile; let content fill viewport width
- Group CTAs in horizontal row or add primary/secondary visual weight split
- Truncate or hide non-essential top-bar chips below md breakpoint

### senior-dev · wide — craft **3**

**Evidence:**
- Massive empty canvas below form — huge right column and bottom half unused, feels unfinished
- Form controls misaligned: 'Draft it' and 'Save recipe' buttons stacked awkwardly, different widths, no visual grouping
- Low-contrast placeholder text and teal buttons clash with dark theme; buttons look flat, no hover/elevation cues

**Recommendations:**
- Collapse empty space: put Name field inline with prompt, or move recipe preview adjacent to input as live panel
- Group actions in single button row (primary + secondary) with consistent sizing and spacing like Linear's form footers
- Replace teal filled buttons with Linear-style subtle-bordered buttons; raise placeholder contrast to meet WCAG AA

## build-admin-roles  (avg craft: 2.50)

### admin · mobile — craft **2**

**Evidence:**
- Mobile viewport shows desktop sidebar + rail, content clipped mid-sentence ('admin e…', 'resolved when…')
- Massive empty black void right half of screen — no responsive reflow
- Floating chat bubble overlaps content area with no safe spacing

**Recommendations:**
- Collapse left sidebar + rail behind hamburger below md breakpoint
- Let Permissions content span full width on mobile, not fixed desktop column
- Reposition/hide chat FAB on narrow viewports or add bottom-right safe area

### admin · wide — craft **3**

**Evidence:**
- Vast empty canvas below content — page feels unfinished, no visual weight or hierarchy past row 1
- Chrome dense with cryptic glyphs (top-right cluster, sidebar icons unlabeled) — Linear uses restrained, labeled affordances
- Permissions content reads as static prose + monospace env vars, not interactive role management — looks like docs pasted into admin shell

**Recommendations:**
- Replace empty-state prose with structured role table (columns: email, role, added) even when empty — show the schema
- Add inline 'Add admin/operator' affordance instead of pointing users to .env.local edits
- Tighten chrome: label or group the top-right icon cluster, reduce cognitive load
