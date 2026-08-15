# Visual upgrades — design spec

**Date:** 2026-08-15
**Source:** `docs/analysis/2026-08-15-visual-upgrades-and-review.md` (Part 2 ideas + Part 1 flagged items)
**Status:** Approved by user (2026-08-15), with the three scope decisions below.

## Scope decisions (user-approved)

- **Implement ideas 1–10.** Idea 11 (auto-descent) stays deferred. Idea 7 (surveyor's chain cursor) ships **behind a `?chain=1` flag**, off by default, with before/after screenshots for a later ship/drop call.
- **Idea 2 (TD stamp) ships as designed** despite the historical removal of the "VERIFIED" stamp — the distinction is that this certifies page state (the descent completed), not a skill claim.
- **Part 1 flagged items:** only the **font preloads** get restored. The STATIC rail cell, rod tick overlap, lightbox zoom, drawer hash, and bead-comment items stay exactly as they are.

## Shared foundation — per-section discipline tokens

Three ideas (1 gauge bands, 5 slab bars, 8 favicon) plus the sigil strokes (4) all need "this section's color". Single source of truth: CSS custom properties declared per section id, next to the existing `--heading-accent` assignments (`assets/css/style.css`, the block after `.stratum--dark .stratum__copy`). Repo two-layer pattern: hex/rgba literals in the base rules, oklch/color-mix inside `@supports (color: oklch(50% 0.1 50))`.

```css
#hero           { --strata-band: rgba(26,43,60,0.14); }            /* no accent — see §8 */
#perception     { --strata-accent: #B24F20; --strata-band: rgba(178,79,32,0.20); }
#training       { --strata-accent: #2A6054; --strata-band: rgba(42,96,84,0.50);  --strata-accent-bright: #75C4A4; }
#infrastructure { --strata-accent: #3D72A4; --strata-band: rgba(61,114,164,0.20); }
#interface      { --strata-accent: #75C4A4; --strata-band: rgb(35,66,69);        --strata-accent-bright: #E8B86D; }
#journey        { --strata-accent: #B88530; --strata-band: rgba(184,133,48,0.20); }
#skills         { --strata-accent: #3C6176; --strata-band: rgba(60,97,118,0.20); }
#proof          { --strata-accent: #D8A246; --strata-band: rgba(216,162,70,0.22); }
#contact        { --strata-accent: #1D2938; --strata-band: rgba(29,41,56,0.55); }
```

The `@supports oklch` layer redeclares each as color-mix derivatives of the existing oklch tokens (e.g. training band = `color-mix(in oklch, var(--validated) 50%, transparent)`, interface band = `color-mix(in oklch, var(--validated) 45%, var(--dark-bg-solid))`, so the two dark strata read as denser/darker fills in the column; interface's `--strata-accent-bright` is the terminal-amber `#E8B86D` already used inside dark sections, so its slab bar differs from Training's teal.

Dark strata (training, interface, contact) get *darker fills* for the band (color-mix toward `--dark-bg-solid`) so the column shows dark rock units; their slab bars use the bright variant so the 3px strip doesn't sink into the navy card.

**JS bridge:** at boot (`cacheElements`, after `sectionEls` is cached, before `publishSectionManifest`), script.js reads `getComputedStyle(sectionEl).getPropertyValue('--strata-accent'/'--strata-band')` into `SECTIONS[].core` / `SECTIONS[].band`. `serializeSection` gains the two fields; the hoisted `serializedSections` map (script.js:220) is **rebuilt after the token read** (it currently runs at module init, before CSS values would be read). mobile-motion.js receives both fields through the existing `__groundTruthSections` channel — no second palette copy.

Failure mode: stylesheet missing/unreadable → tokens read as '' → callers skip the feature (flat track, static favicon, default bars). Never a broken render.

## 1 — The gauge IS the core sample

- `buildCoreColumnGradient()` in script.js: one `linear-gradient(180deg, …)` string from `SECTIONS` — hard color stops at each `start`/`end` (percentages to 2dp), a ~0.5% hairline of `--ink-18`-family tone at each internal boundary, dark strata using their darker `band` value. Set as inline `background` on `#depth-gauge-track`. Exposed as `window.__coreColumnGradient` (a string) so mobile-motion can reuse the identical computation.
- The existing `.depth-gauge__fill` (z-index 2) and marker (z-index 3) are untouched — recovered depth reads as the survey→validated fill laid over the column.
- Mobile rod (`buildMobileDepthRod` in mobile-motion.js): track 2px → 4px wide, same gradient string applied inline. Bands use manifest proportions (the rod is already a schematic — its ticks are evenly spaced; this matches).
- Cleanup in scope: `body.is-dark .depth-gauge__track` and `body.is-dark .mm-depth-rod__track` background overrides are dead once the inline gradient lands (inline style wins regardless) — remove both rules.
- Fallbacks: none needed. Gauge only renders under `can-depth-drill` (JS-driven), rod only exists under mobile-motion. `tier-low` unaffected — static paint.

## 2 — "TD — CORE RECOVERED" stamp

- Markup: `<div class="contact-card__stamp mono">TOTAL DEPTH · 9000M<br>CORE RECOVERY 100%</div>` inside `#contact-card` (z-index above the card's content rows, below nothing).
- CSS: absolute, top-right below the copyright line, `transform: rotate(-7deg)`, 2px `--validated` border + matching text at 0.9 opacity, small padding, `letter-spacing: 0.14em`, paper-deboss shadow (subtle inset highlight + outer ink shadow), `border-radius: 3px`. Default state **visible** — it's content: reduced-motion/no-JS/print all show it statically.
- Desktop: `html.can-depth-drill .contact-card__stamp { opacity: 0; }` + a stamp beat appended to the existing contact GSAP timeline (script.js:1185): `fromTo(scale 1.8/rotation -14 → scale 1/rotation -7, opacity 0→0.9, duration ~0.18, ease power4.in)` at timeline position 0.55 (the card fade occupies 0→0.5), before the existing `totalDuration(1)` normalization. **Scrub-linked, reversible** — same convention as every other drill section (stats re-count on re-arrival too). Explicitly not once-per-session.
- Mobile: mobile-motion's contact choreo stages and slams it with WAAPI (`fill: 'forwards'`, then inline styles cleared on finish — the searchlight choreo's cleanup pattern).
- Collision-checked at 1280px / 820px / 360px viewports; print keeps it (with a `@media print` `!important` visibility reset, see §9).

## 3 — Bead physics on the mobile depth rod

- mobile-motion.js scroll handler sets a **spring target** instead of writing `--bead-offset` directly. Integrator: `v += (target − pos) · 0.14 · dtN; v *= 0.75 ^ dtN; pos += v` (dtN = frame-time normalized to 60fps so 120Hz phones feel identical). Sleeps when `|target−pos| < 0.05 && |v| < 0.05`; wakes on scroll/resize metrics refresh.
- Squash: velocity-scaled — `scaleY = 1 + min(|v|·0.03, 0.28)`, `scaleX = 1 − min(|v|·0.015, 0.14)` — written as `--bead-squash-x/y` custom properties; CSS composes `translate3d(...) scale(...)`. Transform-only, `will-change: transform` already present.
- CSS change: remove the bead's `transition: transform 0.15s ease-out` (spring replaces it; the bead element only exists when mobile-motion runs, so no path loses smoothing). On boot the bead springs from 0 to the restored scroll position once — reads as the instrument powering on.
- Desktop gauge excluded (ScrollTrigger `scrub: 0.4` + spring = lag-on-lag). Reduced-motion: mobile-motion never runs → zero work.

## 4 — Section sigils

Replace the generic `.stratum__label::before` rotated-square diamond with a 14–16px inline-SVG sigil per labeled stratum. The label **text** keeps its accessible `--survey-text` color (accents like ochre fail AA at 0.62rem); only the sigil glyph takes the section accent, via `.stratum__sigil { color: var(--strata-accent) }` + `stroke="currentColor"` in the SVG:

| Stratum | Sigil |
|---|---|
| Perception (Searchlight) | sweep wedge — two rays from an apex + arc |
| Training (Neural Canvas) | seam split — square bisected vertically |
| Infrastructure (PixelQueue) | four-node flow — 4 dots + connecting path |
| Interface (PyGOG) | `>_` prompt |
| Journey | the seismic polyline miniaturized (already authored shape) |
| Capabilities | core cross-section — concentric circles |
| Proof | assay diamond — faceted diamond |
| Surface (drawer only) | reticle — circle + cross ticks |
| Contact (drawer only) | core plug — cylinder |

- Every shape gets `pathLength="1"`; default CSS state fully drawn (`stroke-dashoffset: 0`). Desktop: each section's GSAP timeline opens with `fromTo(shapes, dashoffset 1→0, ~0.15 duration)` — paused/scrubbed like the seismic line, `immediateRender` gives the hidden start state, and no-GSAP paths never hide it. Mobile: `drawSigil(sectionId)` helper in mobile-motion, called from each section choreo's `play()` (WAAPI, ~400ms, expo ease), with matching `prep` staging. Reduced motion / no-JS: statically drawn, always.
- Mobile drawer rows gain the same sigils (static, no draw animation in the drawer) from a `SIGILS` path map in mobile-motion keyed by section id, stroked via inline `style="color: …"` from `sec.core`, falling back to the link's `currentColor` when a section has no accent (hero).
- The `.stratum__label::before` diamond rule is removed once all labels carry sigils.
- **Design call (per the doc's own caveat):** this replaces the consistent diamond. Before/after screenshots from the real page are part of the verification packet; revert = restore one CSS rule + remove the SVGs.

## 5 — Discipline color on the slab accent bar (mobile)

In the `max-width: 767px` block: `.stratum__window::before` switches from flat `var(--survey)` to `var(--strata-accent, var(--survey)))` — one rule, custom properties inherit into the pseudo-element. Dark-strata bars (training/interface) use a bright-variant token (`--strata-accent-bright`, declared only on those two ids) so the strip reads on the navy card. Desktop untouched (full atmospheric shifts already carry the signal). Static paint; no fallback needed.

## 6 — Borehole wander (desktop Journey)

- New inline SVG inside `.journey-track`: `<svg class="journey-bore" viewBox="0 0 1000 24" preserveAspectRatio="none" aria-hidden="true">` with one path wandering ±5px of deterministic dogleg between the five era-marker centers (x = 100/300/500/700/900 ⇔ the flex-equalized 10/30/50/70/90%), passing through each marker's y-center. Stroke keeps the current 4-stop gradient via CSS `stop-color: var(--…)`.
- CSS: `.journey-bore` hidden by default; `html.can-depth-drill` shows it (absolute, vertically centered on the old 20px line) and hides `.journey-track::before`. Mobile keeps the straight pseudo-element line (its ≤767px vertical override is untouched), as do reduced-motion and no-JS desktops.
- Draw-in: dash-draw (`pathLength="1000"`) opening the journey timeline (0→0.3), seismic sweep shifted to overlap its tail (~0.2→0.8), era pops unchanged; `totalDuration(1)` normalization preserved. Print: SVG hidden, straight line restored (print block overrides with `!important`).

## 7 — Surveyor's chain cursor (prototype behind `?chain=1`)

fluid-cursor.js, gated like `?fps=1`: `var CHAIN = /[?&]chain=1\b/.test(location.search)`.
- Distance accumulator in `handleMouseMove`: every 40px of cursor travel stamps one tick `{x, y, angle (perpendicular to travel), birth}` into a 24-entry ring buffer; suppressed over the hero panel like particle spawns.
- Ticks render in the existing `updateFrame` pass: ~7px perpendicular line, `theme.cursor` color, alpha fading over `nodeLife`. Reuses the pool/render pass; zero cost when the flag is off (one boolean check).
- Ship/drop decision comes from before/after screenshots — **not** description.

## 8 — Living favicon

- script.js: lazily fetch `assets/img/favicon.svg` once (same-origin, already in cache from the tab icon), then per section change `window.__groundTruthFavicon(sec)` string-replaces the authored dot color `#FF5B62` with `sec.core` and assigns `link[rel=icon].href` the encoded data URI. Hero's `core` is `null` → no swap at the surface (the authored red beacon stays). The `apple-touch-icon` link is not touched (iOS doesn't follow SVG/data-URI icons anyway).
- Lazy-on-first-call, so no fetch is ever wasted on a visitor who never leaves the hero; failure → static favicon.
- Desktop calls it from the `updateSections` section-change branch; mobile-motion calls it from `setActiveSection` (typeof-guarded). Reduced-motion/no-JS: static favicon, per the doc.

## 9 — Print = field report

- New `display:none` masthead as the first element in `<body>`: `GROUND TRUTH · FIELD REPORT · dhruvgarg.tech · <date>`, shown only by `@media print`. Date stamped by JS at boot (`cacheElements` runs on every JS path) + refreshed on `beforeprint` where supported; no-JS prints the masthead without a date.
- Print CSS: each `.stratum__label` restyled as a ruled log-entry header (it already carries the depth tag); stat cluster becomes a bordered assay-table row (bars hidden, values/labels bordered); `@page` gets modest margins.
- **Pre-existing print bug fixed in passing (required for the report to contain anything):** the `html.can-depth-drill` hidden-initial-state rules (`.journey-era`, `.capability`, `.stat-card`, `.pipe-card`, `.tline` opacity:0; `.journey-era__card` clip-path; `.stat-card__bar-fill` scaleX(0); `.aerial-stage__sharp`/`seam-stage__style` clip-crops) survive into print output when a desktop user prints without a full scroll. The print block gains the same `!important` reset set the reduced-motion block already carries, plus `clip-path: none` for the aerial image and a static 50/50 seam split (`inset(0 50% 0 0)`), the stamp reset, and `.journey-bore` hidden / `.journey-track::before` restored.

## 10 — 404: dry hole

404.html (standalone, inline styles): adds an inline-SVG mini core column (~90px wide) — nine bands in the discipline palette with one mid-column band replaced by a hatched, dashed-outline void — annotated `0m` top / `9000m` bottom / `∅ 404` at the void. Copy: eyebrow `404 · DRY HOLE`, heading `DRY HOLE` + accent line `NO FORMATION AT THIS DEPTH`, body sentence, return link becomes "Trip out to surface →". No new assets, no JS.

## Flagged — font preloads

Re-add to `index.html` `<head>` after the existing two preloads (restores the 2026-07-26 remediation state; hero tagline = 500, its strong = 700, manifest name = 600, rail/labels = Martian Mono Regular):

```html
<link rel="preload" href="assets/fonts/Switzer-Medium.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/Switzer-SemiBold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/Switzer-Bold.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/MartianMono-Regular.woff2" as="font" type="font/woff2" crossorigin>
```

## Cross-cutting

- **Cache-bust bumps** (repo convention): `style.css?v=17→18`, `script.js?v=8→9`, `mobile-motion.js?v=5→6`, `fluid-cursor.js?v=4→5` — one closing chore commit.
- **Commits** on `mobile-creative-parity`: (0) the already-verified Part-1 changes + the untracked vendor/font assets they reference, (1) this spec, then one commit per idea.
- **Explicit non-goals:** idea 11; the unselected Part-1 flagged items; no teardown/rebuild of the breakpoint-reload; no changes to fonts, palette structure, or the scroll engine.

## Verification (per Task.md § fidelity rules — visible changes are the point here, so each gets evidence)

Local server (`python -m http.server 8781`) + Chrome DevTools MCP matrix, zero console errors everywhere:

1. Desktop drill (1280×800): gauge column renders with 9 proportional bands; each section's sigil draws on entry; stamp slams at contact; wander path draws in Journey; favicon data-URI swaps per section; `?chain=1` ticks.
2. Mobile emulation (360×740, touch): rod 4px banded track + bead spring overshoot on flick; slab bar colors per section; sigil draws in choreos; stamp in contact choreo; drawer rows carry sigils; favicon swaps.
3. Touch tablet (820×1180): no tab-bar regression; rod/bead behave; bands fine.
4. `prefers-reduced-motion`: everything static and fully visible (sigils drawn, stamp visible, straight journey line, static favicon, no bead).
5. No-JS: same guarantees as 4 minus the JS-injected chrome.
6. Print preview (desktop, without scrolling first): masthead with date, all sections visible (regression check for the opacity/clip resets), assay table, stamp prints.
7. 404 page renders the dry-hole column.
8. Screenshots: sigil-vs-diamond A/B and chain-on/off A/B captured for the user's ship call.
