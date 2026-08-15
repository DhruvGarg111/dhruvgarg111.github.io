# Visual Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement visual-upgrade ideas 1–10 from the 2026-08-15 review (gauge-as-core, TD stamp, bead physics, sigils, slab colors, borehole wander, chain-cursor prototype, living favicon, print field report, 404 dry hole) plus the one approved Part-1 flagged item (font preloads).

**Architecture:** A single per-section discipline-color source (CSS custom properties read into the `SECTIONS` manifest at boot) feeds four features (gauge bands, slab bars, favicon, sigil strokes). Desktop motion integrates with the existing scrubbed GSAP timelines; mobile extends mobile-motion.js's WAAPI choreographies. Every feature defaults to its visible/static state so reduced-motion/no-JS paths need nothing new.

**Tech Stack:** Vanilla HTML/CSS/JS, GSAP 3.13 + ScrollTrigger (vendored), WAAPI (mobile-motion), Chrome DevTools MCP + Playwright MCP for verification. No build step, no test framework — **verification is browser-based evidence per CLAUDE.md**, so each task ends with a browser-check step instead of a unit-test step.

**Spec:** `docs/superpowers/specs/2026-08-15-visual-upgrades-design.md` (approved).

## Global Constraints

- Type system fixed: Aldrich (display), Switzer (body), Martian Mono (labels). No new fonts; do not remove Switzer.
- No percentages/ratings in skills; no mascot hero; no bento/glass décor. Every new visual must report real state.
- **Fallback invariant:** every animated addition is visible and static by default; hidden start states only ever come from `html.can-depth-drill` CSS or from JS animators. Reduced-motion and no-JS visitors need zero new rules.
- Do not recompute capability flags independently — read `window.__canDepthDrill` / `html.can-depth-drill`.
- Cache-bust convention: any JS/CSS file whose content changes gets its `?v=` in index.html bumped (done once, in the closing task).
- Commits end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Local verification server: `python -m http.server 8781` from the repo root; drive Chrome via MCP. Headless SwiftShader makes the WebGL background render as empty navy in screenshots — known confound (see `headless-webgl-debugging` memory), not a regression.
- Never commit `verify/`, `.commandcode/`, `.agents/`, `.hermes/`.

---

### Task 1: Discipline-color foundation (CSS tokens + manifest bridge)

**Files:**
- Modify: `assets/css/style.css` (after the `--heading-accent` section block, ~line 766)
- Modify: `assets/js/script.js` (`serializeSection` ~line 139, `cacheElements` ~line 161)

**Interfaces:**
- Produces: `SECTIONS[].core` (string|null) and `SECTIONS[].band` (string|null), serialized onto `window.__groundTruthSections` for mobile-motion. Consumed by Tasks 2, 3, 4, 6, 9.

- [ ] **Step 1: CSS tokens**

Insert after the `#proof { --heading-accent: var(--gold); }` line:

```css
/* Per-section discipline accents — one source for the core-sample gauge
   bands, the mobile slab accent bars, the section sigil strokes, and the
   living favicon. script.js reads the computed values into SECTIONS[].core /
   .band at boot, so no second copy of the palette exists in JS.
   Base hex/rgba here; oklch/color-mix redeclarations in the @supports block.
   --strata-accent-bright exists only on the two dark strata: the variant
   legible on their navy windows. #hero deliberately has no accent (the
   favicon keeps its authored red beacon at the surface) — only a band. */
#hero           { --strata-band: rgba(26, 43, 60, 0.14); }
#perception     { --strata-accent: #B24F20; --strata-band: rgba(178, 79, 32, 0.20); }
#training       { --strata-accent: #2A6054; --strata-band: rgba(42, 96, 84, 0.50); --strata-accent-bright: #75C4A4; }
#infrastructure { --strata-accent: #3D72A4; --strata-band: rgba(61, 114, 164, 0.20); }
#interface      { --strata-accent: #75C4A4; --strata-band: rgb(35, 66, 69); --strata-accent-bright: #E8B86D; }
#journey        { --strata-accent: #B88530; --strata-band: rgba(184, 133, 48, 0.20); }
#skills         { --strata-accent: #3C6176; --strata-band: rgba(60, 97, 118, 0.20); }
#proof          { --strata-accent: #D8A246; --strata-band: rgba(216, 162, 70, 0.22); }
#contact        { --strata-accent: #1D2938; --strata-band: rgba(29, 41, 56, 0.55); }

@supports (color: oklch(50% 0.1 50)) {
  #hero           { --strata-band: color-mix(in oklch, var(--ink) 14%, transparent); }
  #perception     { --strata-accent: var(--survey);          --strata-band: color-mix(in oklch, var(--survey) 20%, transparent); }
  #training       { --strata-accent: var(--validated);       --strata-band: color-mix(in oklch, var(--validated) 50%, transparent); --strata-accent-bright: var(--validated-bright); }
  #infrastructure { --strata-accent: var(--datum);           --strata-band: color-mix(in oklch, var(--datum) 20%, transparent); }
  #interface      { --strata-accent: var(--validated-bright); --strata-band: color-mix(in oklch, var(--validated) 45%, var(--dark-bg-solid)); --strata-accent-bright: #E8B86D; }
  #journey        { --strata-accent: var(--cap-generation);  --strata-band: color-mix(in oklch, var(--cap-generation) 20%, transparent); }
  #skills         { --strata-accent: var(--hero-role);       --strata-band: color-mix(in oklch, var(--hero-role) 20%, transparent); }
  #proof          { --strata-accent: var(--gold);            --strata-band: color-mix(in oklch, var(--gold) 22%, transparent); }
  #contact        { --strata-accent: var(--dark-bg-solid);   --strata-band: color-mix(in oklch, var(--dark-bg-solid) 55%, transparent); }
}
```

- [ ] **Step 2: script.js — serialize the new fields**

In `serializeSection` (script.js:139), add two fields before the closing brace:

```js
      seg: sec.seg,
      motion: sec.motion,
      core: sec.core || null,
      band: sec.band || null,
```

- [ ] **Step 3: script.js — read tokens at boot**

In `cacheElements`, immediately before `publishSectionManifest();`:

```js
    /* Discipline accents live in CSS (one source, two-layer hex/oklch like
       every other token). Read the computed values into the manifest so the
       core-sample gauge bands, mobile rod, drawer sigils and favicon all
       draw from one palette. serializedSections must be rebuilt after this
       read — it was mapped at module init, before these fields existed. */
    sectionEls.forEach(function (el, idx) {
      if (!el) return;
      var cs = getComputedStyle(el);
      SECTIONS[idx].core = cs.getPropertyValue('--strata-accent').trim() || null;
      SECTIONS[idx].band = cs.getPropertyValue('--strata-band').trim() || null;
    });
    serializedSections = SECTIONS.map(serializeSection);
```

- [ ] **Step 4: Verify in browser**

Serve locally (`python -m http.server 8781`), open `http://localhost:8781/` in Chrome via MCP, then `evaluate_script`:

```js
() => window.__groundTruthSections.map(s => [s.id, s.core, s.band])
```

Expected: 9 rows; `hero` has `core: null`; `perception` core is terracotta; `interface` core bright teal; no console errors. No visual change anywhere.

- [ ] **Step 5: Commit**

```bash
git add assets/css/style.css assets/js/script.js
git commit -m "feat(tokens): per-section discipline accents + manifest bridge"
```

---

### Task 2: Idea 1 — the gauge IS the core sample

**Files:**
- Modify: `assets/js/script.js` (new builder + application in `cacheElements`)
- Modify: `assets/css/style.css` (`.depth-gauge__track` ~line 558, remove dark overrides ~lines 657, 2979)
- Modify: `assets/js/mobile-motion.js` (`buildMobileDepthRod` ~line 95)

**Interfaces:**
- Consumes: `SECTIONS[].band` from Task 1.
- Produces: `window.__coreColumnGradient` (string|null) — consumed by mobile-motion in this same task.

- [ ] **Step 1: script.js — gradient builder**

Add near the HUD helpers (before `updateHud`):

```js
  /* The gauge track stops being a styled scrollbar and becomes the core
     pulled from the hole: one gradient whose bands ARE the manifest's
     section ranges, separated by 1px hairlines, dark strata filled darker.
     Honest data: proportions come straight from SECTIONS — nothing is drawn
     that isn't true of the page. */
  function buildCoreColumnGradient() {
    if (!SECTIONS[0].band) return null;
    var hairline = 'rgba(26, 43, 60, 0.30)';
    var stops = [];
    SECTIONS.forEach(function (sec, i) {
      var top = (sec.start * 100).toFixed(2) + '%';
      var bottom = (sec.end * 100).toFixed(2) + '%';
      stops.push(sec.band + ' ' + top, sec.band + ' ' + bottom);
      if (i < SECTIONS.length - 1) {
        stops.push(hairline + ' ' + bottom, hairline + ' calc(' + bottom + ' + 1px)');
      }
    });
    return 'linear-gradient(180deg, ' + stops.join(', ') + ')';
  }
```

- [ ] **Step 2: script.js — apply in `cacheElements`**

Immediately after the token-read block from Task 1 Step 3:

```js
    /* backgroundImage only — the CSS background-color substrate stays
       underneath, so the column reads as a paper-lit object even while the
       page behind it descends into the dark strata. Shared with the mobile
       rod so both scales draw the same geology. */
    window.__coreColumnGradient = buildCoreColumnGradient();
    if (window.__coreColumnGradient && els.depthGaugeTrack) {
      els.depthGaugeTrack.style.backgroundImage = window.__coreColumnGradient;
    }
```

- [ ] **Step 3: style.css — track substrate + remove dead dark overrides**

`.depth-gauge__track` (~line 558): replace `background: var(--ink-08);` with:

```css
  /* Core-sample substrate: the recovered core is a physical, paper-lit
     object — it stays light even when the page descends into dark strata.
     script.js lays the per-section band gradient over this as an inline
     background-image. */
  background-color: var(--paper-58);
```

Delete the now-dead rule `body.is-dark .depth-gauge__track { background: rgba(244, 240, 232, 0.08); }` (the inline gradient + light substrate replace it by design).

`.mm-depth-rod__track` (~line 2972): change `width: 2px;` → `width: 4px;`, `background: var(--ink-14);` → `background-color: var(--paper-58);`, `border-radius: 1px;` → `border-radius: 2px;`. Delete `body.is-dark .mm-depth-rod__track { background: rgba(244, 240, 232, 0.16); }`.

- [ ] **Step 4: mobile-motion.js — rod bands**

In `buildMobileDepthRod`, after `document.body.appendChild(depthRod);`:

```js
    /* Same core column as the desktop gauge, one scale down. */
    var rodTrack = $('.mm-depth-rod__track', depthRod);
    if (rodTrack && window.__coreColumnGradient) {
      rodTrack.style.backgroundImage = window.__coreColumnGradient;
    }
```

- [ ] **Step 5: Verify in browser**

Desktop (1280×800): evaluate `() => getComputedStyle(document.getElementById('depth-gauge-track')).backgroundImage` → a `linear-gradient` with 9 band colors + 8 hairlines; screenshot the right rail at the hero and again mid-Training (dark section — column stays paper-lit). Mobile emulation (360×740, touch): reload, scroll past the hero, evaluate the same on `.mm-depth-rod__track` → identical gradient string; rod is 4px wide. No console errors.

- [ ] **Step 6: Commit**

```bash
git add assets/css/style.css assets/js/script.js assets/js/mobile-motion.js
git commit -m "feat(gauge): depth gauge + mobile rod render the core-sample column"
```

---

### Task 3: Idea 5 — discipline color on the mobile slab accent bar

**Files:**
- Modify: `assets/css/style.css` (mobile `.stratum__window::before` rules, ~lines 2265-2279)

**Interfaces:**
- Consumes: `--strata-accent` / `--strata-accent-bright` from Task 1.

- [ ] **Step 1: CSS**

In the `@media (max-width: 767px)` block, change the light-card bar:

```css
  .stratum__window::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    /* Each stratum's discipline color on the one existing accent strip —
       the mobile counterpart of the desktop's full atmospheric shift. */
    background: linear-gradient(90deg, var(--strata-accent, var(--survey)) 0%, transparent 60%);
    opacity: 0.65;
    border-radius: 14px 14px 0 0;
    z-index: 2;
  }
```

and the dark-card bar:

```css
  .stratum--dark .stratum__window::before {
    background: linear-gradient(90deg, var(--strata-accent-bright, var(--strata-accent, var(--survey))) 0%, transparent 60%);
    opacity: 0.6;
  }
```

- [ ] **Step 2: Verify in browser**

Mobile emulation (360×740): screenshot the top edge of each stratum window — Perception terracotta, Training bright teal, Infrastructure datum blue, Interface amber, Journey ochre, Capabilities slate, Proof gold. Desktop (1280×800): confirm the window bars are unchanged (still survey / survey→validated).

- [ ] **Step 3: Commit**

```bash
git add assets/css/style.css
git commit -m "feat(mobile): discipline-colored slab accent bars"
```

---

### Task 4: Idea 2 — "TD — CORE RECOVERED" stamp

**Files:**
- Modify: `index.html` (contact card, ~line 836)
- Modify: `assets/css/style.css` (CONTACT section, after `.contact-card__dot` rules ~line 2044)
- Modify: `assets/js/script.js` (contact timeline, ~line 1185)
- Modify: `assets/js/mobile-motion.js` (contact choreo, ~line 701)

**Interfaces:**
- Produces: `#contact-stamp` element — the print task (Task 10) adds a print reset for it.

- [ ] **Step 1: index.html markup**

Inside `#contact-card`, immediately after the four `.contact-card__dot` spans:

```html
        <!-- Certification mark for the completed descent — the payoff of the
             loader's INITIALIZING DEPTH ENGINE. Content, not chrome: visible
             by default; only JS animators hide-then-stamp it. -->
        <div class="contact-card__stamp mono" id="contact-stamp">TOTAL DEPTH · 9000M<br>CORE RECOVERY 100%</div>
```

- [ ] **Step 2: style.css**

```css
.contact-card__stamp {
  position: absolute;
  top: clamp(3.2rem, 7vw, 4.4rem);
  right: clamp(1rem, 3vw, 2.2rem);
  z-index: 4;
  padding: 0.4rem 0.65rem;
  font-size: 0.56rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  line-height: 1.55;
  text-align: center;
  color: var(--validated);
  border: 2px solid var(--validated);
  border-radius: 3px;
  transform: rotate(-7deg);
  opacity: 0.9;
  pointer-events: none;
  /* debossed rubber-stamp ink */
  background: rgba(244, 240, 232, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.28), 0 1px 3px rgba(26, 43, 60, 0.18);
}
/* Hidden start state exists only where the GSAP timeline will stamp it in. */
html.can-depth-drill .contact-card__stamp { opacity: 0; }
```

- [ ] **Step 3: script.js — contact timeline beat**

In `buildSectionTimelines`, replace the whole contact IIFE:

```js
    /* ── Contact: fade in + TD certification stamp ── */
    (function () {
      var card = $('.contact-card');
      if (!card) return;
      var tl = gsap.timeline({ paused: true });
      tl.fromTo(card,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }
      );
      /* The stamp slams once the card has arrived — fast power-in with a
         slight overshoot, like a rubber stamp. Scrub-linked like every other
         drill beat (reversible on re-arrival, same as the stat count-up).
         Final values match the CSS resting state exactly. */
      var stamp = $('#contact-stamp');
      if (stamp) {
        tl.fromTo(stamp,
          { opacity: 0, scale: 1.8, rotation: -14 },
          { opacity: 0.9, scale: 1, rotation: -7, duration: 0.18, ease: 'power4.in' },
          0.55
        );
      }
      tl.totalDuration(1);
      sectionTimelines.contact = tl;
    })();
```

- [ ] **Step 4: mobile-motion.js — contact choreo**

Replace the contact choreo IIFE (`registerChoreo('contact', ...)` block):

```js
  /* Stratum VIII: Contact + TD stamp */
  (function () {
    var section = $('#contact');
    var card = section && $('.contact-card', section);
    if (!card) return;
    var stamp = $('#contact-stamp');
    function prep() {
      stage([card]);
      if (stamp) stamp.style.setProperty('opacity', '0', 'important');
    }
    function play() {
      reveal([card], 0);
      if (!stamp) return;
      /* Rubber-stamp slam after the card lands. fill:forwards then cancel():
         the CSS resting state is identical, so handback is seamless. */
      window.setTimeout(function () {
        stamp.style.removeProperty('opacity');
        var anim = stamp.animate(
          [
            { opacity: 0, transform: 'rotate(-14deg) scale(1.8)' },
            { opacity: 0.9, transform: 'rotate(-7deg) scale(1)' }
          ],
          { duration: 220, easing: EASE_EXPO, fill: 'forwards' }
        );
        anim.onfinish = function () { anim.cancel(); };
      }, 320);
    }
    registerChoreo('contact', card, prep, play, false);
  })();
```

- [ ] **Step 5: Verify in browser**

Desktop: scroll to the bottom → card fades in, stamp slams ~0.5s later, rotated, green; scroll up and back → re-stamps (scrub-linked, by design). Mobile emulation: same in the contact choreo. Reduced-motion emulation: stamp statically visible, no animation. Check 1280px / 820px / 360px for collisions with the copyright cell and socials. No console errors.

- [ ] **Step 6: Commit**

```bash
git add index.html assets/css/style.css assets/js/script.js assets/js/mobile-motion.js
git commit -m "feat(contact): TD CORE RECOVERED stamp closes the descent"
```

---

### Task 5: Idea 3 — bead physics on the mobile depth rod

**Files:**
- Modify: `assets/js/mobile-motion.js` (scroll handler ~line 322, new spring block, init tail ~line 727)
- Modify: `assets/css/style.css` (`.mm-depth-rod__bead` ~line 2983)

**Interfaces:**
- Consumes: nothing new.
- Produces: `--bead-squash-x` / `--bead-squash-y` custom properties on the bead.

- [ ] **Step 1: mobile-motion.js — spring block**

Add after `refreshScrollMetrics` definition (~line 311):

```js
  /* Bead spring: the rod bead chases a target with a lightly damped spring
     instead of tracking raw scroll 1:1 — a fast flick overshoots a few px,
     then the bead seats with a velocity-scaled squash. Real instruments
     have inertia; mobile is where touch velocity is highest. Desktop's
     gauge is excluded by design: its marker rides ScrollTrigger's scrub,
     and a spring after scrubbing is lag-on-lag. dtN normalizes to 60fps so
     120Hz phones get identical physics. */
  var beadPos = 0, beadVel = 0, beadTarget = 0, beadRaf = 0, beadLastT = 0;
  function beadTravelTarget(p) {
    return trackH ? (p * trackH * 0.96 + trackH * 0.02) : (p * 200);
  }
  function beadWrite(squash) {
    if (!depthBead) return;
    depthBead.style.setProperty('--bead-offset', beadPos.toFixed(2) + 'px');
    if (squash) {
      var v = Math.abs(beadVel);
      depthBead.style.setProperty('--bead-squash-y', (1 + Math.min(v * 0.03, 0.28)).toFixed(3));
      depthBead.style.setProperty('--bead-squash-x', (1 - Math.min(v * 0.015, 0.14)).toFixed(3));
    } else {
      depthBead.style.setProperty('--bead-squash-y', '1');
      depthBead.style.setProperty('--bead-squash-x', '1');
    }
  }
  function beadTick(t) {
    var dt = beadLastT ? t - beadLastT : 16.7;
    beadLastT = t;
    var dtN = Math.min(dt / 16.666, 3);
    beadVel += (beadTarget - beadPos) * 0.14 * dtN;
    beadVel *= Math.pow(0.75, dtN);
    beadPos += beadVel;
    if (Math.abs(beadTarget - beadPos) < 0.05 && Math.abs(beadVel) < 0.05) {
      beadPos = beadTarget;
      beadVel = 0;
      beadWrite(false);
      beadRaf = 0;
      beadLastT = 0;
      return;
    }
    beadWrite(true);
    beadRaf = requestAnimationFrame(beadTick);
  }
  function beadWake() {
    if (!beadRaf && depthBead) {
      beadLastT = 0;
      beadRaf = requestAnimationFrame(beadTick);
    }
  }
```

- [ ] **Step 2: mobile-motion.js — retarget the scroll handler**

In the scroll listener's rAF callback, replace:

```js
      if (depthBead) {
        var offsetPx = trackH ? (docProgress * (trackH * 0.96) + trackH * 0.02) : (docProgress * 200);
        depthBead.style.setProperty('--bead-offset', offsetPx.toFixed(1) + 'px');
      }
```

with:

```js
      beadTarget = beadTravelTarget(docProgress);
      beadWake();
```

At the end of `refreshScrollMetrics`, add (so a late layout settle re-aims the spring):

```js
    beadTarget = beadTravelTarget(docProgress);
    beadWake();
```

At the file's init tail, replace the `docProgress = (function () {...})(); pushToBackground();` block with:

```js
  refreshScrollMetrics();
  docProgress = maxScroll > 0 ? Math.max(0, Math.min(1, window.scrollY / maxScroll)) : 0;
  /* Power-on: the bead springs from the top to a restored scroll position. */
  beadTarget = beadTravelTarget(docProgress);
  beadWake();
  pushToBackground();
```

- [ ] **Step 3: style.css — bead transform**

`.mm-depth-rod__bead`: replace the `transform` and `transition` lines with:

```css
  transform: translate3d(-50%, calc(var(--bead-offset) - 5px), 0) scale(var(--bead-squash-x, 1), var(--bead-squash-y, 1));
  transform-origin: center;
  /* No CSS transition: mobile-motion drives a per-frame spring on this
     transform — a transition on the same property would be lag-on-lag. */
```

(delete `transition: transform 0.15s ease-out;`, keep `will-change: transform;`).

- [ ] **Step 4: Verify in browser**

Mobile emulation (360×740, touch): scroll slowly to mid-page; then evaluate a fast jump + sampling:

```js
async () => {
  const bead = document.querySelector('.mm-depth-rod__bead');
  const seen = [];
  window.scrollTo(0, document.documentElement.scrollHeight * 0.7);
  const t0 = performance.now();
  await new Promise(res => {
    (function poll() {
      seen.push(parseFloat(bead.style.getPropertyValue('--bead-offset')) || 0);
      if (performance.now() - t0 < 900) requestAnimationFrame(poll); else res();
    })();
  });
  const target = parseFloat(bead.style.getPropertyValue('--bead-offset'));
  return { frames: seen.length, overshot: seen.some(v => v > target + 0.5), settled: Math.abs(seen[seen.length - 1] - target) < 0.06 };
}
```

Expected: `overshot: true`, `settled: true`. Bead still opens the drawer on tap. Desktop: no `.mm-depth-rod` exists at all. No console errors.

- [ ] **Step 5: Commit**

```bash
git add assets/js/mobile-motion.js assets/css/style.css
git commit -m "feat(mobile): spring physics + velocity squash on the depth-rod bead"
```

---

### Task 6: Idea 4 — section sigils

**Files:**
- Modify: `index.html` (7 `.stratum__label` lines: perception, training, infrastructure, interface, journey, skills, proof)
- Modify: `assets/css/style.css` (`.stratum__label::before` ~line 881, new `.stratum__sigil` rules, `.mm-drawer__link` grid ~line 3168)
- Modify: `assets/js/script.js` (new `addSigilDraw` helper + 7 timeline hooks in `buildSectionTimelines`)
- Modify: `assets/js/mobile-motion.js` (`SIGILS` map, drawer rows, `prepSigil`/`drawSigil`, 7 choreo hooks)

**Interfaces:**
- Consumes: `--strata-accent` / `--strata-accent-bright` (Task 1).
- Produces: `.stratum__sigil [pathLength]` shapes (drawn by both engines); `SIGILS` map in mobile-motion (drawer).

**Before-and-after evidence:** capture a "before" screenshot of a `.stratum__label` row (diamond marker) BEFORE editing; the verification step produces the "after". The pair goes to the user for the ship call (the doc flagged this replacement as worth seeing first).

- [ ] **Step 1: index.html — sigil markup in the 7 labels**

Each label gets an inline SVG as its first child. Wrapper for all of them:

```html
<svg class="stratum__sigil" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">PATHS</g></svg>
```

`PATHS` per section (every animated shape carries `pathLength="1" stroke-dasharray="1"`; dots are static fills):

- perception (sweep wedge):
  `<path pathLength="1" stroke-dasharray="1" d="M8 2.5 L2.8 13.2"/><path pathLength="1" stroke-dasharray="1" d="M8 2.5 L13.2 13.2"/><path pathLength="1" stroke-dasharray="1" d="M2.8 13.2 A 7.9 7.9 0 0 0 13.2 13.2"/>`
- training (seam split):
  `<path pathLength="1" stroke-dasharray="1" d="M2.5 2.5 H13.5 V13.5 H2.5 Z"/><path pathLength="1" stroke-dasharray="1" d="M8 2.5 V13.5"/>`
- infrastructure (four-node flow):
  `<circle cx="3" cy="3" r="1.4" fill="currentColor" stroke="none"/><circle cx="13" cy="3" r="1.4" fill="currentColor" stroke="none"/><circle cx="13" cy="13" r="1.4" fill="currentColor" stroke="none"/><circle cx="3" cy="13" r="1.4" fill="currentColor" stroke="none"/><path pathLength="1" stroke-dasharray="1" d="M4.8 3 H11.2 M13 4.8 V11.2 M11.2 13 H4.8 M3 11.2 V4.8"/>`
- interface (`>_` prompt):
  `<path pathLength="1" stroke-dasharray="1" d="M3 4 L7 8 L3 12"/><path pathLength="1" stroke-dasharray="1" d="M9 12.5 H13.5"/>`
- journey (seismic miniaturized):
  `<path pathLength="1" stroke-dasharray="1" d="M1 8 H4.5 L6 4 L8 12 L9.5 5.5 L11 10.5 L12.2 8 H15"/>`
- skills (core cross-section):
  `<path pathLength="1" stroke-dasharray="1" d="M8 2 A6 6 0 1 1 8 14 A6 6 0 1 1 8 2"/><path pathLength="1" stroke-dasharray="1" d="M8 5.2 A2.8 2.8 0 1 1 8 10.8 A2.8 2.8 0 1 1 8 5.2"/><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none"/>`
- proof (assay diamond):
  `<path pathLength="1" stroke-dasharray="1" d="M8 2 L14 8 L8 14 L2 8 Z"/><path pathLength="1" stroke-dasharray="1" d="M2 8 H14"/><path pathLength="1" stroke-dasharray="1" d="M5 8 L8 14 M11 8 L8 14"/>`

- [ ] **Step 2: style.css**

Delete the `.stratum__label::before { … }` block (~lines 881-887). Add:

```css
/* Per-section sigil: a tiny authored glyph in the section's discipline
   color, dash-drawn on entry by whichever motion engine owns the layout.
   Default state is fully drawn, so reduced-motion/no-JS need nothing. */
.stratum__sigil {
  width: 0.72rem;
  height: 0.72rem;
  flex: 0 0 auto;
  color: var(--strata-accent, currentColor);
  opacity: 0.85;
}
.stratum--dark .stratum__sigil {
  color: var(--strata-accent-bright, var(--strata-accent, currentColor));
}
```

In the drawer CSS, change `.mm-drawer__link`'s grid to make room for the leading sigil and add the sigil rule:

```css
.mm-drawer__link {
  display: grid;
  grid-template-columns: 1rem 3.2rem minmax(0, 1fr) auto;
  /* …rest unchanged… */
}
.mm-drawer__sigil {
  width: 0.85rem;
  height: 0.85rem;
  opacity: 0.8;
}
```

- [ ] **Step 3: script.js — desktop draw-in**

Add the helper before `buildSectionTimelines`:

```js
  /* Sigil draw-in opens each section's timeline: the 14px authored glyph
     dash-draws across the first 15% of local scroll — the site's stroke-draw
     micro-pattern, same as the seismic line. pathLength=1 in the markup
     keeps the dash math unitless; the paused fromTo's immediateRender
     provides the hidden start state, and paths without GSAP never hide. */
  function addSigilDraw(tl, sectionId) {
    var sec = document.getElementById(sectionId);
    var shapes = sec ? $$('.stratum__sigil [pathLength]', sec) : [];
    if (!shapes.length) return;
    tl.fromTo(shapes,
      { strokeDashoffset: 1 },
      { strokeDashoffset: 0, duration: 0.15, ease: 'power2.out' },
      0
    );
  }
```

Then one call per timeline, as the first tween after each `var tl = gsap.timeline({ paused: true });`:
- perception IIFE: `addSigilDraw(tl, 'perception');`
- training IIFE: `addSigilDraw(tl, 'training');`
- infrastructure IIFE: `addSigilDraw(tl, 'infrastructure');`
- interface IIFE: `addSigilDraw(tl, 'interface');`
- journey IIFE: `addSigilDraw(tl, 'journey');`
- skills IIFE: `addSigilDraw(tl, 'skills');`
- proof IIFE: `addSigilDraw(tl, 'proof');`

- [ ] **Step 4: mobile-motion.js — drawer sigils + choreo draws**

Add after the `sections`/`sectionById` block:

```js
  /* The same authored sigils that mark the desktop strata labels — one
     vocabulary, two surfaces. Drawer rows show them statically (the draw-in
     belongs to the sections themselves). */
  var SIGILS = {
    hero: '<path pathLength="1" d="M8 3 A5 5 0 1 1 8 13 A5 5 0 1 1 8 3"/><path pathLength="1" d="M8 1 V3.5 M8 12.5 V15 M1 8 H3.5 M12.5 8 H15"/>',
    perception: '<path pathLength="1" d="M8 2.5 L2.8 13.2"/><path pathLength="1" d="M8 2.5 L13.2 13.2"/><path pathLength="1" d="M2.8 13.2 A 7.9 7.9 0 0 0 13.2 13.2"/>',
    training: '<path pathLength="1" d="M2.5 2.5 H13.5 V13.5 H2.5 Z"/><path pathLength="1" d="M8 2.5 V13.5"/>',
    infrastructure: '<circle cx="3" cy="3" r="1.4" fill="currentColor" stroke="none"/><circle cx="13" cy="3" r="1.4" fill="currentColor" stroke="none"/><circle cx="13" cy="13" r="1.4" fill="currentColor" stroke="none"/><circle cx="3" cy="13" r="1.4" fill="currentColor" stroke="none"/><path pathLength="1" d="M4.8 3 H11.2 M13 4.8 V11.2 M11.2 13 H4.8 M3 11.2 V4.8"/>',
    interface: '<path pathLength="1" d="M3 4 L7 8 L3 12"/><path pathLength="1" d="M9 12.5 H13.5"/>',
    journey: '<path pathLength="1" d="M1 8 H4.5 L6 4 L8 12 L9.5 5.5 L11 10.5 L12.2 8 H15"/>',
    skills: '<path pathLength="1" d="M8 2 A6 6 0 1 1 8 14 A6 6 0 1 1 8 2"/><path pathLength="1" d="M8 5.2 A2.8 2.8 0 1 1 8 10.8 A2.8 2.8 0 1 1 8 5.2"/><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none"/>',
    proof: '<path pathLength="1" d="M8 2 L14 8 L8 14 L2 8 Z"/><path pathLength="1" d="M2 8 H14"/><path pathLength="1" d="M5 8 L8 14 M11 8 L8 14"/>',
    contact: '<path pathLength="1" d="M4.5 4.5 A3.5 1.6 0 0 1 11.5 4.5 M4.5 4.5 V11.5 A3.5 1.6 0 0 0 11.5 11.5 V4.5"/>'
  };
  function sigilSvg(id, color) {
    var body = SIGILS[id];
    if (!body) return '';
    return '<svg class="mm-drawer__sigil" viewBox="0 0 16 16" aria-hidden="true"' +
      (color ? ' style="color:' + color + '"' : '') +
      '><g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
      body + '</g></svg>';
  }
```

In `buildStratumDrawer`'s `listHtml` map, add the sigil as the first child of the link:

```js
        '<a href="#' + s.id + '" class="mm-drawer__link mono' + (i === 0 ? ' is-active' : '') + '" data-section="' + s.id + '">' +
          sigilSvg(s.id, s.core) +
          '<span class="mm-drawer__depth">' + s.depth + '</span>' +
```

Add the choreo helpers (next to `stage`/`reveal`):

```js
  /* Section sigil dash-draw — same ~400ms stroke-draw as the seismic wave. */
  function prepSigil(sectionId) {
    var sec = document.getElementById(sectionId);
    $$('.stratum__sigil [pathLength]', sec || undefined).forEach(function (sh) {
      sh.style.strokeDashoffset = '1';
    });
  }
  function drawSigil(sectionId) {
    var sec = document.getElementById(sectionId);
    $$('.stratum__sigil [pathLength]', sec || undefined).forEach(function (sh, i) {
      sh.style.strokeDashoffset = '';
      var anim = sh.animate(
        [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }],
        { duration: 400, delay: i * 60, easing: EASE_EXPO, fill: 'forwards' }
      );
      anim.onfinish = function () { anim.cancel(); };
    });
  }
```

(`$$` in mobile-motion takes `(sel, root)` and handles a falsy root via `document`.)

Hook the 7 choreos — add `prepSigil('<id>');` at the end of each `prep()` and `drawSigil('<id>');` at the start of each `play()`:
- searchlight → `'perception'`
- seam → `'training'`
- pipeline → `'infrastructure'`
- terminal → `'interface'`
- journey → `'journey'`
- capabilities → `'skills'`
- proof → `'proof'`

- [ ] **Step 5: Verify in browser**

Desktop: for each of the 7 labeled strata, scroll it in — the sigil dash-draws (~first 15% of local scroll, reversible with scrub) in the section's discipline color; label text color unchanged. Screenshot one label; pair with the "before" diamond screenshot for the user's ship call. Mobile emulation: sigils draw when each section's choreo fires; open the drawer — all 9 rows carry their sigil (hero reticle, contact plug), colored where the section has an accent. Reduced-motion: sigils fully drawn, no animation. No console errors.

- [ ] **Step 6: Commit**

```bash
git add index.html assets/css/style.css assets/js/script.js assets/js/mobile-motion.js
git commit -m "feat(strata): per-section sigils replace the generic label diamond"
```

---

### Task 7: Idea 6 — borehole wander for the Journey timeline

**Files:**
- Modify: `index.html` (`.journey-track`, ~line 636)
- Modify: `assets/css/style.css` (JOURNEY section, ~line 1698)
- Modify: `assets/js/script.js` (journey timeline, ~line 1091)

**Interfaces:**
- Produces: `.journey-bore__path` — the print task (Task 10) hides it and restores `::before`.

**Measure first:** the old `::before` line sits at `top: 20px`, but the era markers are 16px tall starting at the column top (center ≈ 8px). Before authoring, measure live: `document.querySelector('.journey-era__marker').getBoundingClientRect()` vs the track's rect on a 1280×800 desktop. Set the bore SVG's `top` so its viewBox midline (y=12) lands exactly on the measured marker center. (This also fixes a possible pre-existing misalignment of the old line; if the old line really doesn't thread the markers, note it and let the new path do the threading.)

- [ ] **Step 1: index.html — the SVG**

First child inside `.journey-track`:

```html
            <!-- Surveyed borehole path — desktop drill only (CSS). A few px of
                 deterministic dogleg between era markers: real boreholes drift.
                 Geometry only — the honest labels remain the era years. -->
            <svg class="journey-bore" viewBox="0 0 1000 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <defs>
                <linearGradient id="journey-bore-gradient" x1="0" y1="0" x2="1" y2="0">
                  <stop class="journey-bore__stop--edge" offset="0"/>
                  <stop class="journey-bore__stop--survey" offset="0.4"/>
                  <stop class="journey-bore__stop--validated" offset="0.8"/>
                  <stop class="journey-bore__stop--edge" offset="1"/>
                </linearGradient>
              </defs>
              <path class="journey-bore__path" pathLength="1000" fill="none" stroke="url(#journey-bore-gradient)" stroke-width="2"
                d="M0 12 L82 12 Q100 12 118 9 L210 4 Q262 3 285 8 Q300 12 315 15 L430 19 Q472 20 500 12 L516 8 Q560 3 620 6 L684 10 Q700 12 716 15 L820 20 Q862 21 886 16 Q900 12 914 9 L1000 7"/>
            </svg>
```

- [ ] **Step 2: style.css**

In the JOURNEY section (after `.journey-track::before`):

```css
/* Surveyed borehole — replaces the ruler-straight ::before line on the
   desktop drill. Mobile keeps the straight line for space; reduced-motion
   and no-JS desktops keep it too (the class is never set there). */
.journey-bore { display: none; }
html.can-depth-drill .journey-bore {
  display: block;
  position: absolute;
  top: 2px; /* tune from the measured marker center: top = center − 12px */
  left: 0;
  width: 100%;
  height: 24px;
  z-index: 0;
  pointer-events: none;
}
html.can-depth-drill .journey-track::before { content: none; }
.journey-bore__stop--edge { stop-color: var(--depth-line); }
.journey-bore__stop--survey { stop-color: var(--survey); }
.journey-bore__stop--validated { stop-color: var(--validated); }
.journey-bore__path { stroke-dasharray: 1000; stroke-dashoffset: 0; }
```

- [ ] **Step 3: script.js — draw-in at the head of the journey timeline**

In the journey IIFE, add after `addSigilDraw(tl, 'journey');` (Task 6):

```js
      /* The surveyed bore draws first — the line the eras hang on — then the
         seismic trace sweeps through behind it (moved off 0 so the two
         stroke-draws don't compete). */
      var borePath = document.querySelector('.journey-bore__path');
      if (borePath) {
        tl.fromTo(borePath,
          { strokeDashoffset: 1000 },
          { strokeDashoffset: 0, duration: 0.3, ease: 'power2.inOut' },
          0
        );
      }
```

and change the existing seismic tween's position from `0` to `0.2`:

```js
      if (seismicLine) {
        tl.to(seismicLine, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.inOut' }, 0.2);
      }
```

- [ ] **Step 4: Verify in browser**

Desktop: scroll into Journey — the bore path dash-draws, threading all five marker centers with visible-but-subtle wander; seismic sweep follows. Screenshot. Mobile emulation: vertical straight line unchanged, no `.journey-bore` rendered. Reduced-motion desktop: straight `::before` line, no SVG. No console errors.

- [ ] **Step 5: Commit**

```bash
git add index.html assets/css/style.css assets/js/script.js
git commit -m "feat(journey): surveyed borehole wander replaces the ruler-straight track"
```

---

### Task 8: Idea 7 — surveyor's chain cursor (prototype behind `?chain=1`)

**Files:**
- Modify: `assets/js/fluid-cursor.js`

**Interfaces:**
- Produces: nothing consumed elsewhere. Off by default; enabled only with `?chain=1` in the URL.

- [ ] **Step 1: fluid-cursor.js**

After the `config` block, add:

```js
  /* Surveyor's chain (prototype, ?chain=1): every ~40px of cursor travel,
     stamp one short perpendicular tick that fades with the trail — a
     surveyor's chain being laid down. Off by default: whether it reads as
     instrument or as dandruff is a screenshot decision, not a description
     one. */
  var CHAIN_ENABLED = /[?&]chain=1\b/.test(location.search);
  var chain = { acc: 0, ticks: [], MAX: 24, SPACING: 40, LIFE: 900 };
```

In `handleMouseMove`, inside the `if (dist > 2 && !overHeroPanel(mouse.x, mouse.y))` block, add:

```js
      if (CHAIN_ENABLED) {
        chain.acc += dist;
        while (chain.acc >= chain.SPACING) {
          chain.acc -= chain.SPACING;
          chain.ticks.push({ x: mouse.x, y: mouse.y, angle: mouse.angle + Math.PI / 2, birth: performance.now() });
          if (chain.ticks.length > chain.MAX) chain.ticks.shift();
        }
      }
```

Add the renderer (next to `drawConnections`):

```js
  function drawChainTicks(now, theme) {
    var i = 0;
    while (i < chain.ticks.length) {
      var t = chain.ticks[i];
      var age = now - t.birth;
      if (age > chain.LIFE) { chain.ticks.splice(i, 1); continue; }
      var pct = 1 - age / chain.LIFE;
      var dx = Math.cos(t.angle) * 3.5, dy = Math.sin(t.angle) * 3.5;
      ctx.beginPath();
      ctx.moveTo(t.x - dx, t.y - dy);
      ctx.lineTo(t.x + dx, t.y + dy);
      ctx.strokeStyle = theme.cursor;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = pct * 0.55;
      ctx.stroke();
      i++;
    }
    ctx.globalAlpha = 1;
  }
```

In `updateFrame`, after `drawConnections(now, theme);`:

```js
    if (CHAIN_ENABLED) drawChainTicks(now, theme);
```

and extend the idle-stop condition so live ticks keep the loop alive:

```js
    if (particles.length === 0 && (!CHAIN_ENABLED || chain.ticks.length === 0) && (!mouse.active || settled)) {
```

- [ ] **Step 2: Verify in browser**

Desktop, `http://localhost:8781/?chain=1`: sweep the cursor — perpendicular ticks appear at ~40px intervals along the path and fade; none over the hero panel. Screenshot. Reload without the flag: no ticks anywhere. Screenshot. Both go to the user for the ship/drop call. No console errors.

- [ ] **Step 3: Commit**

```bash
git add assets/js/fluid-cursor.js
git commit -m "feat(cursor): surveyor's chain ticks, prototype behind ?chain=1"
```

---

### Task 9: Idea 8 — living favicon

**Files:**
- Modify: `assets/js/script.js` (new module + one call site in `updateSections`)
- Modify: `assets/js/mobile-motion.js` (one call in `setActiveSection`)

**Interfaces:**
- Consumes: `SECTIONS[].core` (Task 1); `sec.core === null` on hero.
- Produces: `window.__groundTruthFavicon(sec)` — called by both engines.

- [ ] **Step 1: script.js — the module**

Add after `pushSectionToBackground`:

```js
  /* Living favicon: the tab's reticle dot takes the active stratum's
     discipline color as you descend — the one site surface visible while
     the tab is backgrounded. The authored SVG is fetched once (same-origin,
     and warm in the cache from rendering the tab icon) and recolored by
     string replacement: one source of art, no duplicated SVG markup in JS.
     Lazy on first call — a visitor who never leaves the surface never pays
     the fetch. Sections without an accent (hero) restore the authored icon. */
  var faviconState = { text: null, link: null, failed: false, requested: false, pending: null };
  function applyFavicon(color) {
    faviconState.link.href = 'data:image/svg+xml,' + encodeURIComponent(faviconState.text.split('#FF5B62').join(color));
  }
  function initFaviconSwap() {
    if (faviconState.requested) return;
    faviconState.requested = true;
    faviconState.link = document.querySelector('link[rel="icon"]');
    if (!faviconState.link || !window.fetch) { faviconState.failed = true; return; }
    window.fetch('assets/img/favicon.svg').then(function (res) {
      if (!res.ok) throw new Error('favicon fetch failed');
      return res.text();
    }).then(function (text) {
      if (text.indexOf('#FF5B62') === -1) throw new Error('favicon marker color missing');
      faviconState.text = text;
      if (faviconState.pending) {
        applyFavicon(faviconState.pending);
        faviconState.pending = null;
      }
    }).catch(function () { faviconState.failed = true; });
  }
  window.__groundTruthFavicon = function (sec) {
    if (!sec) return;
    if (!sec.core) {
      /* Surface (or an accent-less section): restore the authored beacon. */
      if (faviconState.link) faviconState.link.href = 'assets/img/favicon.svg';
      return;
    }
    initFaviconSwap();
    if (faviconState.failed) return;
    if (!faviconState.text) { faviconState.pending = sec.core; return; }
    applyFavicon(sec.core);
  };
```

- [ ] **Step 2: script.js — desktop call site**

In `updateSections`'s section-change branch, after `window.__groundTruthCurrentSection = serializeSection(sec);`:

```js
        if (window.__groundTruthFavicon) window.__groundTruthFavicon(sec);
```

- [ ] **Step 3: mobile-motion.js — mobile call site**

In `setActiveSection`, just before `pushToBackground();`:

```js
    if (typeof window.__groundTruthFavicon === 'function') {
      window.__groundTruthFavicon(sec);
    }
```

- [ ] **Step 4: Verify in browser**

Desktop: scroll into Perception, then evaluate:

```js
() => {
  const href = document.querySelector('link[rel="icon"]').href;
  return href.startsWith('data:image/svg+xml,') && decodeURIComponent(href).includes('#B24F20');
}
```

Expected: `true` (terracotta; oklch browsers substitute the oklch string — accept either). Scroll back to the hero → href is `assets/img/favicon.svg` again. Mobile emulation: same swap happens from `setActiveSection`. No console errors; no extra network fetch after the first.

- [ ] **Step 5: Commit**

```bash
git add assets/js/script.js assets/js/mobile-motion.js
git commit -m "feat(favicon): reticle dot follows the active stratum's discipline color"
```

---

### Task 10: Idea 9 — print = field report (plus the drill's print-visibility resets)

**Files:**
- Modify: `index.html` (first child of `<body>`)
- Modify: `assets/css/style.css` (`@media print` block ~line 3265, new `.print-masthead` base rule near the loader CSS)
- Modify: `assets/js/script.js` (date stamp in `cacheElements`)

**Interfaces:**
- Consumes: `#contact-stamp` (Task 4), `.journey-bore` (Task 7) — both get print resets here.

- [ ] **Step 1: index.html — masthead**

Immediately after `<body>`:

```html
  <!-- Print-only masthead. display:none on screen; the @media print block
       shows it. The date is stamped by script.js at boot (and refreshed on
       beforeprint); with no JS it prints without a date. -->
  <div class="print-masthead" aria-hidden="true">
    <span class="print-masthead__brand mono">GROUND TRUTH · FIELD REPORT</span>
    <span class="print-masthead__meta mono">dhruvgarg.tech<span id="print-date"></span></span>
  </div>
```

- [ ] **Step 2: script.js — date stamp**

In `cacheElements`, after the core-column application (Task 2):

```js
    /* Print field-report date. Stamped once at boot and refreshed on
       beforeprint so the PDF carries the day it was printed. */
    var printDateEl = document.getElementById('print-date');
    function stampPrintDate() {
      if (printDateEl) printDateEl.textContent = ' · ' + new Date().toISOString().slice(0, 10);
    }
    stampPrintDate();
    window.addEventListener('beforeprint', stampPrintDate);
```

- [ ] **Step 3: style.css — base + print rules**

Near the loader CSS (screen base):

```css
/* Print-only masthead — shown by the @media print block. */
.print-masthead { display: none; }
```

Extend the `@media print` block with:

```css
  @page { margin: 1.4cm; }

  .print-masthead {
    display: flex !important;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    padding-bottom: 0.5rem;
    margin-bottom: 1rem;
    border-bottom: 2px solid #142236;
    font-size: 0.65rem;
    letter-spacing: 0.14em;
    color: #142236;
  }
  .print-masthead__meta { opacity: 0.7; }

  /* The drill's hidden-until-scrolled initial states must not survive into
     print: a desktop printing without a full scroll used to get invisible
     eras, cards, counters, and a cropped aerial image. Mirror the
     reduced-motion reset set, plus the drill-only clip states. */
  html.can-depth-drill .tline,
  html.can-depth-drill .journey-era,
  html.can-depth-drill .capability,
  html.can-depth-drill .stat-card,
  html.can-depth-drill .pipe-card { opacity: 1 !important; transform: none !important; }
  html.can-depth-drill .capability__tools li { opacity: 1 !important; }
  html.can-depth-drill .journey-era__card { clip-path: none !important; }
  html.can-depth-drill .stat-card__bar-fill { transform: scaleX(1) !important; }
  html.can-depth-drill .aerial-stage__sharp { clip-path: none !important; }
  /* Static half/half seam split — the one honest print state for a wipe. */
  html.can-depth-drill .seam-stage__style { clip-path: inset(0 50% 0 0) !important; }
  html.can-depth-drill .contact-card__stamp { opacity: 0.9 !important; transform: rotate(-7deg) !important; }
  .journey-bore { display: none !important; }
  html.can-depth-drill .journey-track::before { content: '' !important; }

  /* Section labels as log entries — the depth tag is already in the text. */
  .stratum__label {
    display: flex;
    width: 100%;
    padding: 0.35rem 0;
    border-top: 1.5px solid #142236;
    border-bottom: 1px solid rgba(20, 34, 54, 0.25);
    margin-bottom: 1rem;
    color: #142236;
  }

  /* Proof stats as an assay table. */
  .stat-cluster { display: table; width: 100%; border-collapse: collapse; margin-bottom: 0; }
  .stat-card { display: table-cell; width: auto; border: 1px solid #142236; border-radius: 0; box-shadow: none; }
  .stat-card__value { font-size: 1.6rem; }
  .stat-card__bar, .stat-card__texture { display: none; }
```

- [ ] **Step 4: Verify in browser (Playwright — it can emulate print media)**

Via Playwright MCP `browser_run_code_unsafe`:

```js
async (page) => {
  await page.goto('http://localhost:8781/');
  await page.emulateMedia({ media: 'print' });
  await page.screenshot({ path: 'verify/print-report.png', fullPage: true });
  const visible = await page.evaluate(() => ({
    masthead: getComputedStyle(document.querySelector('.print-masthead')).display === 'flex',
    date: document.getElementById('print-date').textContent,
    erasVisible: getComputedStyle(document.querySelector('.journey-era')).opacity === '1',
    stampVisible: getComputedStyle(document.getElementById('contact-stamp')).opacity !== '0',
    straightLine: getComputedStyle(document.querySelector('.journey-track'), '::before').content !== 'none',
  }));
  await page.emulateMedia({ media: 'screen' });
  return visible;
}
```

Expected: all true / date populated. Review the screenshot: masthead, ruled log-entry labels, assay table, static seam split. Also `page.pdf()` once and eyeball the artifact. No console errors.

- [ ] **Step 5: Commit**

```bash
git add index.html assets/css/style.css assets/js/script.js
git commit -m "feat(print): field-report masthead, log-entry labels, assay table + drill visibility resets"
```

---

### Task 11: Idea 10 — 404 dry hole

**Files:**
- Modify: `404.html`

**Interfaces:**
- None. Standalone page, inline styles, no JS.

- [ ] **Step 1: 404.html**

Add to the inline `<style>`:

```css
        .dry-hole { width: 96px; height: auto; margin: 0 auto 1.4rem; color: var(--ink); }
        .dry-hole text {
            font-family: "Martian Mono", ui-monospace, monospace;
            font-size: 8px;
            fill: var(--ink-soft);
            letter-spacing: 0.08em;
        }
```

Replace the `<main>` content with:

```html
    <main>
        <svg class="dry-hole" viewBox="0 0 120 210" role="img" aria-label="A stratigraphic core column with a gap where this page should be">
            <defs>
                <pattern id="void-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="6" height="6" fill="#EDE7DA"/>
                    <line x1="0" y1="0" x2="0" y2="6" stroke="#B24F20" stroke-width="0.8" opacity="0.5"/>
                </pattern>
            </defs>
            <!-- borehole ruler -->
            <line x1="14" y1="12" x2="14" y2="198" stroke="currentColor" stroke-width="1" opacity="0.35"/>
            <g stroke="currentColor" stroke-width="1" opacity="0.5">
                <line x1="10" y1="12" x2="14" y2="12"/><line x1="10" y1="32" x2="14" y2="32"/>
                <line x1="10" y1="52" x2="14" y2="52"/><line x1="10" y1="72" x2="14" y2="72"/>
                <line x1="10" y1="92" x2="14" y2="92"/><line x1="10" y1="112" x2="14" y2="112"/>
                <line x1="10" y1="132" x2="14" y2="132"/><line x1="10" y1="152" x2="14" y2="152"/>
                <line x1="10" y1="172" x2="14" y2="172"/><line x1="10" y1="198" x2="14" y2="198"/>
            </g>
            <!-- the column, in the site's section order; the fifth slot is the void -->
            <rect x="30" y="12" width="60" height="20" fill="#5F6870" opacity="0.25"/>
            <rect x="30" y="32" width="60" height="20" fill="#B24F20" opacity="0.3"/>
            <rect x="30" y="52" width="60" height="20" fill="#2A6054" opacity="0.45"/>
            <rect x="30" y="72" width="60" height="20" fill="#3D72A4" opacity="0.3"/>
            <rect x="30" y="92" width="60" height="20" fill="url(#void-hatch)" stroke="#B24F20" stroke-width="1" stroke-dasharray="3 3"/>
            <rect x="30" y="112" width="60" height="20" fill="#B88530" opacity="0.3"/>
            <rect x="30" y="132" width="60" height="20" fill="#3C6176" opacity="0.3"/>
            <rect x="30" y="152" width="60" height="20" fill="#D8A246" opacity="0.3"/>
            <rect x="30" y="172" width="60" height="20" fill="#1D2938" opacity="0.6"/>
            <text x="18" y="15">0m</text>
            <text x="18" y="201">9000m</text>
            <text x="96" y="104" text-anchor="end">∅ 404</text>
        </svg>
        <div class="eyebrow">404 · dry hole</div>
        <h1><span style="color: var(--heading-primary);">Dry hole</span><br><span style="color: var(--heading-accent);">no formation at this depth</span></h1>
        <p>The drill came up empty here — this page was never cored, or the bore log is wrong.</p>
        <p><a href="/">← Trip out to surface</a></p>
    </main>
```

(Keep `<title>Depth not found — Dhruv Garg</title>` and everything else unchanged.)

- [ ] **Step 2: Verify in browser**

Open `http://localhost:8781/404.html` directly (python http.server doesn't map 404s to it). Screenshot: column renders with 8 bands + hatched void, ruler ticks, labels legible, link works.

- [ ] **Step 3: Commit**

```bash
git add 404.html
git commit -m "feat(404): dry-hole core column with a gap where the page should be"
```

---

### Task 12: Font preloads (approved Part-1 flagged item)

**Files:**
- Modify: `index.html` (`<head>`, after the Switzer-Regular preload)

**Interfaces:**
- None.

- [ ] **Step 1: index.html**

After the existing two font preloads:

```html
  <!-- Above-the-fold faces, restored per the 2026-07-26 remediation: the
       tagline is 500, its <strong> 700, the manifest names 600, and the
       rails/labels are Martian Mono Regular — all discovered late (after the
       stratum images) when these preloads were dropped. -->
  <link rel="preload" href="assets/fonts/Switzer-Medium.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="assets/fonts/Switzer-SemiBold.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="assets/fonts/Switzer-Bold.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="assets/fonts/MartianMono-Regular.woff2" as="font" type="font/woff2" crossorigin>
```

- [ ] **Step 2: Verify in browser**

Network tab (Chrome DevTools MCP): all 6 preloaded fonts fetch with high priority, all 200, no double-fetch, no console warnings about unused preloads. Hero renders with no late font swap.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "perf(fonts): restore above-the-fold font preloads incl. self-hosted Martian Mono"
```

---

### Task 13: Cache-bust bumps + full verification matrix

**Files:**
- Modify: `index.html` (version query strings)

**Interfaces:**
- Consumes: every previous task's file changes.

- [ ] **Step 1: index.html version bumps**

`style.css?v=17` → `?v=18`; `script.js?v=8` → `?v=9`; `mobile-motion.js?v=5` → `?v=6`; `fluid-cursor.js?v=4` → `?v=5`. (hero-flow.js, neural-background.js, neural-lite.js unchanged — no bumps.)

- [ ] **Step 2: Full verification matrix**

Serve locally and run the whole matrix with Chrome DevTools MCP (Playwright for print), zero console errors everywhere:

1. Desktop drill (1280×800): full 0→9000m pass — gauge column bands; sigil draw per section; wander path in Journey; stamp at Contact; favicon href swaps; `?chain=1` ticks.
2. Mobile emulation (360×740, touch): rod bands + bead spring; slab bar colors; sigil draws; stamp choreo; drawer sigils; favicon.
3. Touch tablet (820×1180): no tab-bar regression; rod + bands fine.
4. `prefers-reduced-motion` (emulated): everything static and fully visible — sigils drawn, stamp visible, straight Journey line, static favicon, no bead.
5. No-JS (disable JavaScript in DevTools): same guarantees minus the JS chrome.
6. Print (Playwright `emulateMedia`): masthead + date, all sections visible, assay table, stamp.
7. `/404.html`: dry-hole column.
8. Collect the evidence screenshots into `verify/` (untracked): sigil before/after, chain on/off, gauge column, stamp, slab bars, print page 1, 404.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "chore: cache-bust bumps for the visual-upgrades pass"
```

---

## Self-review notes (run at plan write time)

- **Spec coverage:** ideas 1–10 → Tasks 2–11; font preloads → Task 12; shared token foundation → Task 1; cache-bust convention → Task 13. Idea 11 excluded per scope decision; unselected Part-1 flagged items excluded.
- **Ordering:** Task 1 (tokens) precedes 2/3/6/9; Task 4 (stamp) and Task 7 (bore) precede Task 10 (print resets reference both); Task 6 precedes Task 7 (both touch the journey timeline — 7 adjusts what 6 adds).
- **Type/name consistency:** `SECTIONS[].core/.band`, `window.__coreColumnGradient`, `window.__groundTruthFavicon(sec)`, `addSigilDraw(tl, sectionId)`, `prepSigil/drawSigil(sectionId)`, `SIGILS`, `sigilSvg(id, color)`, `beadTravelTarget(p)`, `beadWake()`, `--bead-squash-x/--bead-squash-y`, `.stratum__sigil`, `.mm-drawer__sigil`, `.journey-bore__path`, `#contact-stamp`, `#print-date` — same names in producing and consuming tasks.
