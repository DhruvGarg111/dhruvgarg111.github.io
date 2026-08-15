# Visual upgrade ideas + current review findings — dhruvgarg.tech

**Date:** 2026-08-15 (revised same-day after a self-review pass — see "Rethink log")
**Status:** Everything in Part 2 is a **proposal** (Tier C per Task.md — visible changes
require explicit sign-off). Part 1's bug fixes are already applied and browser-verified.

The filter used for every idea below: the site's differentiator is that its motion and
chrome form a *credible field-survey instrument* — depth gauge, strata, survey plate,
evidence-bound capabilities. Out by design: generic portfolio décor (bento grids,
glassmorphism, mascots, stock 3D), fabricated stats presented as measurements, and
**theater chrome** — atmospheric decoration that doesn't report anything, which this
site has already deliberately removed once.

## Rethink log (what the first draft got wrong)

- **"Core tray" as a new left-margin instrument — cut as proposed.** The desktop already
  has a persistent wayfinder (the depth gauge, right rail). A second one duplicates it,
  fights the centered ~1220px plate, and only fits ≥1280px. Replaced by idea 1:
  upgrade the *gauge itself* to carry the strata.
- **"Driller's log" margin ticker — cut.** Self-dimming text ambience is theater
  chrome, not instrumentation. Its one honest datum (scroll velocity) survives inside
  idea 3 instead.
- **Deviation-survey `INC/AZ` tags — cut from idea 6.** Hash-derived inclination numbers
  are fabricated pseudo-data; the geometric wander stays, the fake measurements go.
- **Needle physics re-scoped.** On desktop the marker is driven by ScrollTrigger's
  `scrub: 0.4`; a spring after that is lag-on-lag and reads swampy, not analog. The
  physics belongs on the mobile rod bead (raw scroll, no scrub) — idea 3 re-scoped.
- **Per-stratum noise textures — replaced.** `feTurbulence` tiles on the slab cards
  would add grain to surfaces that already carry dot-grid + brackets + accent bar.
  The calm version is per-section discipline *color* on the existing accent bar (idea 5).

---

## Part 1 — Current review findings (2026-08-15 diff audit)

### Fixed in this pass (browser-verified, mobile + tablet + desktop, zero console errors)

1. **Seismic wave was dead on mobile.** `mobile-motion.js` queried `$('path', seismic)`
   but the markup is a `<polyline>` (`index.html:699`), and the dash window `800` was
   shorter than the ~1062-unit path — even a correct selector would have left the
   line's tail pre-drawn. Now selects `.journey-seismic__line`, uses the authored 1200
   (matches the desktop GSAP tween in `script.js:1098`). Verified live: animates
   1200→0, `fill: forwards` holds, renders in the Journey slab.
2. **Seismic line permanently hidden for reduced-motion / no-JS** (desktop included —
   pre-existing). Added `html:not(.can-depth-drill) .journey-seismic__line
   { stroke-dashoffset: 0 }` — presentation attributes lose to CSS, and both JS
   animators override with inline styles, so the rule only wins when no animator exists.
3. **Stale cache-bust stamps.** `script.js`, `neural-background.js`, `fluid-cursor.js`
   all changed content with unchanged `?v=` (would have served old JS against new
   HTML/CSS to returning visitors). Bumped `script.js?v=8`, `neural-background.js?v=8`,
   `fluid-cursor.js?v=4`; my own edits moved `mobile-motion.js?v=5`, `style.css?v=17`.
4. **Tablet instrument-tab gap (confirmed live at 820px).** mobile-motion runs on touch
   tablets, but the snap-gallery CSS lives at ≤767px — the "02 ARCHITECTURE" tab
   highlighted on tap while scrolling nothing. Tabs now inject only at gallery widths;
   replay + inspect buttons remain at all mobile-motion widths. (Known edge: the gate
   is evaluated once at load; rotating a foldable across 767px mid-session won't add
   tabs. Touch devices essentially never cross that boundary at this site's
   breakpoints, so this is accepted, not fixed.)
5. **Drawer/lightbox focus management.** Both are `role="dialog" aria-modal="true"` but
   never moved focus. Focus now enters on open (active stratum link / close button) and
   returns to the opener on close. Verified.
6. **`#infrastructure` / `#interface` `.stratum__visual` lacked the
   `role="region" + aria-label`** the other two swipe galleries have. Added.
7. **Lightbox `<img src="">`** (empty `src` resolves against the document URL) and a
   generic alt. No `src` until assigned; alt now carries the source image's alt text.
8. **Fallback section array in mobile-motion.js had drifted** from the real manifest
   (`Contact`/`atmosphereDark:false` vs `Contact Core`/`true`). Aligned.
9. **Print block didn't exclude the new fixed `.mm-*` chrome.** Added to the print
   `display:none` list.
10. **Depth-bead metrics were cached from a half-laid-out page** (`scrollHeight` grows
    as below-fold images/fonts settle). Now also refreshed on `load` and
    `document.fonts.ready`.

### Verified good (no action)

- Vendor libs match the CDN versions they replaced (gsap 3.13.0, three r128, mo 1.7.1,
  splitting 1.1.0); no leftover CDN refs; full network trace all-200; all 8 font faces
  load; desktop drill, mobile drawer/tabs/lightbox/rod, stat count-up (250+/550+/1760+,
  consistent across `data-count`, visible text, `.sr-only`), dark-section atmosphere,
  SVG precision-rounding (SVGO pass) — all confirmed in-browser.
- Hero scanline `top`→`translate3d` conversion is pixel-equivalent (same start/end
  edges, duration/easing/opacity keyframes untouched) — a textbook Task.md §6 fix.

### Flagged — visible trade-offs, not mine to decide

1. **Font preload reversal.** The diff removed the Switzer Medium/SemiBold/Bold
   preloads that `2026-07-26-audit-remediation.md` added to fix above-the-fold late
   swap (`.hero__tagline` = 500, its `strong` = 700, `.hero-manifest__name` = 600),
   and added no preload for the self-hosted Martian Mono. Network trace shows all six
   now discovered from CSS *after* the stratum images. Arguable both ways (five font
   preloads contend with hero assets on slow connections) — but if unintentional,
   re-adding 3–4 `<link rel="preload">` lines restores the remediation state.
2. **"STATIC" state cell is back on the mobile hero rail** — the remediation dropped it
   as drill-only status with no meaning on touch; it renders but never changes on
   phones. Keep for rail symmetry or re-hide?
3. **Depth-rod ticks overlap card content** at phone widths (observed "6.0k" on body
   text, "8.4k" on a hairline). Options: hide tick *labels* below ~400px (bead + track
   survive), or give ticks a paper-backed chip.
4. **Lightbox can't actually zoom** — `touch-action: pinch-zoom` is declared but
   nothing zooms the `<img>`, and these 2160px-wide SVGs carry small type. A
   double-tap toggle to `max-width: none` (pan via existing `overflow: auto`) would
   make INSPECT honest.
5. **mobile-motion.js header comment promises bead "scrub"** — only click handlers
   exist. Implement drag-scrub or fix the comment.
6. **Drawer jumps don't update `location.hash`** (`preventDefault`'d) while desktop has
   real deep-linking — a `history.replaceState` after the smooth scroll would make
   mobile depth links shareable.

---

## Part 1b — "Scroll gets stuck on the Neural Canvas box" investigation

Report: nested scroll inside the style-transfer (Neural Canvas) project box sometimes
gets stuck, on some devices only.

### What the box actually is

`#training .stratum__visual` — a two-pane horizontal scroll-snap strip
(`scroll-snap-type: x mandatory`, `overscroll-behavior-inline: contain`,
`touch-action: pan-x pan-y`, children `flex: 0 0 100%` with `scroll-snap-align: start`)
nested inside vertical page scroll. The Neural Canvas pane content (`.seam-stage`) is
two absolutely-stacked inline `<svg>` layers plus a 3px divider. Nothing in JS touches
it: no wheel/touch handler exists on the gallery or any ancestor on the touch path
(`initNestedScrollHandoff` is desktop-drill wheel-only, `script.js:1410`; the gauge's
non-passive document `touchmove` is `canRunDepthEngine`-gated, `script.js:1689`; the
gallery's own scroll listener is ≤767px-gated and passive). **Nothing author-side can
preventDefault a page scroll over that box — the stuck class is engine-level.**

### Test matrix (CDP `Input.dispatchTouchEvent` — real input pipeline, Android profile)

| Gesture starting on the gallery | Page scrolled | Gallery |
|---|---|---|
| Vertical, gallery at snap point | ✓ +285px | 0 |
| Vertical, finger dwells 400ms mid-drag (reading) | ✓ +265px | +58 |
| Vertical, 120ms after a horizontal swipe (snap settling) | ✓ +266px | — |
| Vertical, gallery mid-snap (resting between panes) | ✓ +285px | — |
| Diagonal (mostly vertical) | ✓ +285px | 0 |
| 6× repeated vertical drags | ✓ 244–246px each | — |

**No stuck state reproduced on Chromium-emulated Android touch.** One real anomaly
measured: after a horizontal swipe ended at `scrollLeft 285` (snap point: 345), the
mandatory snap **had not settled 800ms later** — it completed (+58 → 343) only when the
next vertical gesture began. I.e. this Chromium build can defer snap-settle until the
next gesture: the gallery visually rests mid-pane, then lurches sideways *while the
user is trying to scroll the page* — reads exactly like "scroll got stuck, then jumped".

### Why it's device-specific

- **iOS Safari** (the likeliest reporter): `scroll-snap-type: x mandatory` has a long
  history of WebKit gesture-capture bugs — a snap container mid-settle can hold the
  gesture stream, and re-snap timers keep the scroller "active". Desktop Chrome's touch
  emulation does not reproduce WebKit behavior, so absence of repro here ≠ absence on
  an iPhone. Also `overscroll-behavior-inline` is iOS ≥16 only; on older iOS,
  horizontal flings at the gallery edge chain into the page as a rubber-band tug.
- **Chromium**: the deferred-settle anomaly above (measured here).
- **Every engine**: mandatory snap + nested scrolling is the single most
  bug-prone scroller configuration on touch; the mitigations below are hygiene that
  shrinks the bug surface regardless of engine.

### Changes applied (invisible where they matter)

1. **Hero scanline now gated on the capability class** —
   `html:not(.can-depth-drill) .hero__scanline { animation: none }`. It was an
   always-on GPU layer with a 12px `box-shadow` repainting every 6s-frame over the live
   field canvas on phones/tablets/reduced-motion, where the drill (its meaning) never
   runs. Verified: desktop still `hero-scan 6s`; phone & tablet compute to
   `none`/`opacity:0` (base state hides it — no resting-state change). Less per-frame
   compositor work during gestures = smaller stuck window.
2. **Tab-bar CSS gated to the same ≤767px boundary as the JS** — the styles were
   global while creation is width-gated; now the two can't disagree (they did on
   tablets: live-looking tabs scrolling a non-scroller). Actions bar stays global
   (replay/inspect are injected on tablets too, and work there).

### Deliberately not changed — options for the user

- **`mandatory` → `proximity` snap.** Proximity never traps, but the gallery can then
  *rest* mid-pane (a sliver of each pane visible — worse). Not recommended.
- **iOS-only `proximity`** via `@supports (-webkit-touch-callout: none)`, with the
  instrument tabs (already present, keyboard/AT-operable) providing deterministic jumps.
  Real mitigation if the report is iOS — but a visible resting-state change on one
  platform: **Tier C, needs sign-off and a physical iPhone to validate.**
- **Horizontal-wheel override** for trackpads. Out of scope: galleries only exist in
  the touch path; trackpads get the drill.
- **Residual risk:** true iOS/Android *hardware* validation is still needed — the CDP
  matrix proves the code is clean, not that WebKit's snap engine behaves.

---

## Part 2 — Visual upgrade ideas (revised)

Ordered by metaphor-yield per unit of work. Effort: **S** < half a day, **M** = a day
or two, **L** = multi-day. Each names its tier/touch/reduced-motion fallback.

### 1. The gauge IS the core sample ★ first pick

**What:** Don't add an instrument — deepen the one that exists. The depth gauge's track
is currently a flat 4px line with a fill. Make the track a miniature stratigraphic
column: nine sediment bands stacked in the exact proportions of `SECTIONS[].start/end`,
each tinted with its section's discipline color at low alpha (with a hairline boundary
and, for the two dark strata, a darker fill). The existing fill/marker/marker-label
behavior is untouched — the marker now literally points into the rock column it claims
to measure. On mobile, the same bands become the rod's track (2px → 4px to carry them)
— one shared fragment of markup logic, two scales.

**Why it fits:** The gauge stops being a scrollbar dressed as a gauge and becomes the
thing it represents: the core pulled from the hole you're descending. Band heights are
real scroll geography. And unlike the cut left-margin tray, it costs zero new screen
space and adds zero new chrome — the instrument count stays the same.

**Honest-data hook:** proportions come straight from the manifest; nothing is drawn
that isn't true of the page.

**Cost:** S–M. The gauge is one element; bands are generated from `SECTIONS` at boot
(same loop that already builds gauge labels). Fallback: flat track under reduced
motion is *not needed* (static bands move nothing); `tier-low` unaffected.

### 2. "TD — CORE RECOVERED" — narrative closure at 9000m

**What:** The contact section is the bottom of the hole and currently knows it only in
name (`Contact Core · 9000m`, `core-breach` motion cue). Close the loop: when the
contact card first enters, a one-time stamp — `TOTAL DEPTH · 9000M · RECOVERY 100%` —
rotates into the card's corner in validated-green with a paper-deboss shadow. The
card's ghat illustration is the surface photo from the drill site; the stamp certifies
the core beneath it. Mobile: one extra staged element in the existing entry choreo.

**Why it fits:** The entire page is a descent that currently just… ends. The loader
opens with INITIALIZING DEPTH ENGINE; this is the payoff. It also gives the proof stats
their conceptual frame — they're the assay, this is the custody seal. ("RECOVERY 100%"
is metaphor, not a skill claim — it certifies the page, not Dhruv.)

**Cost:** S. One rotated mono block + class toggle on the existing observer path.
Fallback: statically visible under reduced motion / no-JS (it's content, not theater).

### 3. Bead physics on the mobile depth rod (re-scoped)

**What:** The mobile rod bead tracks raw scroll 1:1. Give it a lightly damped spring —
it overshoots a few px when a fast flick stops, then seats into the track with a tiny
velocity-scaled squash. Desktop gauge explicitly **excluded**: its marker rides
ScrollTrigger's `scrub: 0.4`, and a spring after scrubbing is lag-on-lag.

**Why it fits:** The instrument claim is the brand; real instruments have inertia.
Mobile is where the metaphor is thinnest (no WebGL, no drill) and where touch velocity
is highest — a flick deserves a needle that notices.

**Cost:** S. Spring integration inside the existing rAF-throttled scroll handler;
transform-only. Fallback: static bead under reduced motion (mobile-motion never runs
there anyway — zero work).

### 4. Section sigils — one drawn glyph per stratum

**What:** The stratum label rows all carry the same diamond (`◇ STRATUM I · 1200M`).
Replace the generic diamond with a 14px per-section sigil that dash-draws itself on
entry (~400ms, the established draw-in pattern): Searchlight = sweep wedge, Neural
Canvas = seam split, PixelQueue = four-node flow, PyGOG = `>_`, Journey = the seismic
polyline miniaturized (already authored), Capabilities = core cross-section, Proof =
assay diamond, Contact = recovered core plug. The same sigils then mark the mobile
drawer's rows — two surfaces, one vocabulary.

**Why it fits:** Nine tiny authored marks, each earned by its section's content — the
opposite of an icon font, and stroke-draw is already the site's signature micro-motion.
Design call to note: this *replaces* the consistent diamond marker, which is currently
the drill-site symbol — worth a look at both before committing.

**Cost:** M (mostly art). Fallback: fully-drawn static under reduced motion, same gate
as the seismic line.

### 5. Discipline color on the slab accent bar (mobile)

**What:** The mobile slab cards' top accent bar (`.stratum__window::before`) is
survey-terracotta everywhere. Give each stratum its own discipline color on that one
3px strip — Perception terracotta, Training the dark teal, Infrastructure datum blue,
Proof gold — matching the palette the desktop atmosphere and the proof stat bars
already use. One line per section, no texture, no grain.

**Why it fits:** The desktop communicates "you've crossed into a different rock unit"
through full atmospheric shifts; mobile currently gets a same-ish card every time.
Color on the one existing accent element carries the signal with zero added noise —
this replaces the first draft's noisier per-section texture tiles.

**Cost:** S. Fallback: none needed — it's static paint.

### 6. Borehole wander for the Journey timeline (de-faked)

**What:** Real boreholes drift. The Journey track is a perfectly straight line; let it
wander a few px of deterministic dogleg between era markers — geometry only. **No
INC/AZ tags** (first draft's hash-derived numbers were fabricated pseudo-data — cut).
If the line wants labels, the honest ones are already there: the era years.

**Why it fits:** Converts the most conventional element on the site (a vertical
timeline) into a surveyed path — measured, not drawn — without inventing a single
number.

**Cost:** S–M. The track line becomes an SVG path (currently a pseudo-element — the
one structural change); the draw-in becomes dash-draw, the site's established pattern.
Mobile keeps the straight line for space. Fallback: straight line is the default;
wander is progressive enhancement.

### 7. Surveyor's chain in the desktop cursor (prototype-gated)

**What:** `fluid-cursor.js` already renders a particle trail. Add a distance
accumulator: every ~40px of cursor travel, stamp one small perpendicular tick onto the
trail's fade — a surveyor's chain being laid down. Ticks fade with the trail.

**Why it fits:** The cursor is the one desktop effect that's generic — every third
portfolio has a particle trail; chain ticks make it a measuring instrument. Reuses the
existing pool and render pass. **Honest caveat:** this is the one idea whose taste
can't be judged from a description — ticks could read as instrument or as dandruff.
Prototype behind a flag, screenshot both, then decide. It does not ship on description
alone.

**Cost:** S. Fallback: the module's existing coarse-pointer/reduced-motion self-disable
already gates it.

### 8. Living favicon

**What:** The favicon's reticle dot shifts to the active stratum's discipline color as
you descend — a data-URI swap fired from the section state machine that already
announces every change.

**Why it fits:** The one site surface visible while the tab is *backgrounded* is the
tab itself. Ten lines, zero layout risk, real delight for anyone who notices.

**Cost:** S. Fallback: static favicon; swap at most once per section change.

### 9. Print = field report

**What:** The print stylesheet already collapses the drill correctly. Go further:
`@media print` gets a masthead — `GROUND TRUTH · FIELD REPORT · dhruvgarg.tech ·
<date>` — section headers as log entries with depth tags, stats as an assay table.
Recruiters do print portfolios to PDF; make the PDF a designed artifact instead of a
rescue job.

**Cost:** S–M. Print-only CSS + a `display:none` masthead. Zero screen impact by
definition.

### 10. 404: dry hole

**What:** The 404 already says "Depth not found." Full treatment: a mini stratigraphic
column with a gap where the page should be, `DRY HOLE — NO FORMATION AT THIS DEPTH`, a
"trip out to surface" link. The page is already standalone-styled; one inline SVG.

**Cost:** S. Fallback: it *is* the fallback page.

### 11. Auto-descent ("RUN FULL HOLE") — optional, largest scope

**What:** A barely-advertised trigger (footer `▼ RUN FULL HOLE`) that auto-scrolls
0→9000m at a steady rate — the site presenting itself as a survey film. Esc / any
wheel / touch aborts.

**Honest caveats:** a forced ~10,000px journey through `scrub: 0.4` is a long watch and
most users will abort; the mo.js transition bursts need to not pile up. This adds a new
*mode*, not a surface — listed for completeness, not recommended ahead of 1–10.

**Cost:** M. Fallback: trigger hidden under reduced motion and on `tier-low`.

---

## Priority suggestion

Ship **1 (gauge-as-core)**, **2 (TD stamp)**, **3 (bead physics)** first: one deepens
the persistent instrument, one fixes the ending, one fixes the mobile feel — and all
three present state the code already computes, which is the site's design rule.

Then **4 (sigils)** and **5 (slab colors)** as the art pass, **9 (print report)** as
the practical one. **7** only as a flagged prototype. **11** waits for its own
go-ahead.
