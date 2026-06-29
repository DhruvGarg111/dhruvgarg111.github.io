/**
 * Ground Truth v7 — Z-Axis Depth Drill Engine
 *
 * One master ScrollTrigger on a 1000vh spacer drives everything:
 *   scroll progress 0-1 → camera depth position
 *                        → section visibility (fixed overlays)
 *                        → per-section GSAP timelines
 *                        → atmospheric shifts (fog, dark mode)
 *                        → depth-gauge fill
 */
;(function () {
  'use strict';

  /* ─── Feature Detection ─── */
  var rmQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  var prefersRM = rmQuery.matches;
  try { rmQuery.addEventListener('change', function (e) { prefersRM = e.matches; }); } catch (e) { /* Safari < 14 */ }
  var isDesktop = window.matchMedia('(min-width: 768px)').matches;

  /* ─── Shortcuts ─── */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.from((r || document).querySelectorAll(s)); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function mapRange(v, inLo, inHi, outLo, outHi) { return outLo + ((v - inLo) / (inHi - inLo)) * (outHi - outLo); }

  /* ─── Section Definitions ─── */
  var SECTIONS = [
    { id: 'hero',           start: 0.00, end: 0.10, dark: false, seg: null },
    { id: 'perception',     start: 0.10, end: 0.22, dark: false, seg: 'perception' },
    { id: 'training',       start: 0.22, end: 0.35, dark: true,  seg: 'training' },
    { id: 'infrastructure', start: 0.35, end: 0.48, dark: false, seg: 'infra' },
    { id: 'interface',      start: 0.48, end: 0.60, dark: true,  seg: 'interface' },
    { id: 'journey',        start: 0.60, end: 0.72, dark: false, seg: null },
    { id: 'skills',         start: 0.72, end: 0.83, dark: false, seg: null },
    { id: 'proof',          start: 0.83, end: 0.93, dark: false, seg: null },
    { id: 'contact',        start: 0.93, end: 1.00, dark: true,  seg: null },
  ];

  var currentSection = -1;
  var scrollVelocity = 0;
  var lastScrollY = 0;
  var sectionTimelines = {};
  var triggeredSections = new Set();
  var sectionVisible = new Array(SECTIONS.length).fill(false);
  var isDragging = false;
  var scrollTriggerInstance = null;
  var activeTweens = [];

  /* ─── Element Cache ─── */
  var els = {};
  var sectionEls = []; /* cached section DOM nodes — avoids getElementById per tick */
  var prevHud = { fill: '' }; /* dirty-checking for depth-gauge fill */

  function cacheElements() {
    els.depthFill = $('#depth-fill');
    els.depthMarker = $('#depth-marker');
    els.depthGaugeTrack = $('#depth-gauge-track');
    els.fogVignette = $('#fog-vignette');
    els.heroScrollCue = $('#hero-scroll-cue');
    els.stSegs = $$('.st-seg');
    els.depthLabels = $$('.depth-gauge__label');

    /* Pre-cache all section elements once */
    sectionEls = SECTIONS.map(function (sec) {
      return document.getElementById(sec.id);
    });
  }

  /* ═════════════════════════════════════════════════════════ */
  /* SECTION VISIBILITY — z-axis depth transforms              */
  /* ═════════════════════════════════════════════════════════ */

  function updateSections(progress) {
    var newSection = -1;
    var overlapMargin = 0.015; // 1.5% overlap for crossfade

    SECTIONS.forEach(function (sec, idx) {
      var el = sectionEls[idx];
      if (!el) return;

      /* Extend ranges by overlap margin for crossfade */
      var rangeStart = idx === 0 ? sec.start : sec.start - overlapMargin;
      var rangeEnd = idx === SECTIONS.length - 1 ? sec.end : sec.end + overlapMargin;

      if (progress >= rangeStart && progress <= rangeEnd) {
        /* ── This section is in range ── */
        sectionVisible[idx] = true;
        if (progress >= sec.start && progress <= sec.end) newSection = idx;
        var local = clamp((progress - sec.start) / (sec.end - sec.start), 0, 1);

        /* z-depth envelope:
           local 0.0-0.12 → entering (from deep)
           local 0.12-0.88 → active (at camera depth)
           local 0.88-1.0 → exiting (past camera)
           EXCEPT hero (idx=0) which starts fully visible */
        var enterEnd = idx === 0 ? 0 : 0.08;
        var exitStart = idx === SECTIONS.length - 1 ? 1.0 : 0.92;
        var z, sc, op, rx, ry;

        if (enterEnd > 0 && local < enterEnd) {
          /* Entering from depth */
          var t = local / enterEnd;
          var eased = t * t * (3 - 2 * t); // smoothstep
          z = lerp(-1200, 0, eased);
          sc = lerp(0.5, 1, eased);
          op = lerp(0, 1, eased);
          rx = lerp(5, 0, eased);
          ry = lerp(idx % 2 === 0 ? -4 : 4, 0, eased);
        } else if (local > exitStart) {
          /* Flying past camera */
          var t2 = (local - exitStart) / (1 - exitStart);
          var eased2 = t2 * t2;
          z = lerp(0, 350, eased2);
          sc = lerp(1, 1.12, eased2);
          op = lerp(1, 0, eased2);
          rx = lerp(0, -2.5, eased2);
          ry = 0;
        } else {
          /* Active — fully present */
          z = 0; sc = 1; op = 1; rx = 0; ry = 0;
        }

        el.style.transform = 'translateZ(' + z.toFixed(1) + 'px) scale(' + sc.toFixed(4) + ') rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg)';
        el.style.opacity = op.toFixed(4);
        el.classList.add('is-active');

        /* Seek section timeline */
        if (sectionTimelines[sec.id]) {
          var innerProgress = clamp(mapRange(local, enterEnd, exitStart, 0, 1), 0, 1);
          sectionTimelines[sec.id].progress(innerProgress);
        }

      } else {
        /* ── Out of range — skip if already hidden ── */
        if (!sectionVisible[idx]) return;
        sectionVisible[idx] = false;
        el.classList.remove('is-active');
        if (progress < rangeStart) {
          el.style.transform = 'translateZ(-1200px) scale(0.5) rotateX(5deg)';
          el.style.opacity = '0';
        } else {
          el.style.transform = 'translateZ(350px) scale(1.12) rotateX(-2.5deg)';
          el.style.opacity = '0';
        }
      }
    });

    /* ── Section change ── */
    if (newSection !== currentSection) {
      currentSection = newSection;
      if (newSection >= 0 && !triggeredSections.has(newSection)) {
        triggeredSections.add(newSection);
        playTransitionEffect(newSection, SECTIONS[newSection]);
      }
      if (newSection >= 0) {
        var sec = SECTIONS[newSection];

        /* Dark mode */
        document.body.classList.toggle('is-dark', sec.dark);

        /* Fog vignette */
        if (els.fogVignette) {
          if (sec.dark) {
            els.fogVignette.style.background = 'radial-gradient(ellipse at center, transparent 34%, rgba(18,26,38,0.38) 100%)';
          } else {
            els.fogVignette.style.background = 'radial-gradient(ellipse at center, transparent 40%, rgba(240,235,224,0.5) 100%)';
          }
        }

        /* Stack trace */
        els.stSegs.forEach(function (seg) {
          seg.classList.toggle('is-active', sec.seg && seg.dataset.seg === sec.seg);
        });

        /* Depth gauge labels */
        els.depthLabels.forEach(function (lbl) {
          lbl.classList.toggle('is-active', lbl.dataset.section === sec.id);
        });

      }
    }
  }

  /* ═════════════════════════════════════════════════════════ */
  /* TRANSITION EFFECTS — section-specific enter animations    */
  /* ═════════════════════════════════════════════════════════ */

  /* Read CSS variable as string for mo.js color values */
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /* Clear mo.js container after transition */
  function clearFx() {
    var fx = $('#transition-fx');
    if (fx) fx.innerHTML = '';
  }

  function withWillChange(targets, props, tween) {
    var nodes = gsap.utils.toArray(targets);
    nodes.forEach(function (node) {
      if (node && node.style) node.style.willChange = props;
    });
    tween.eventCallback('onComplete', function () {
      nodes.forEach(function (node) {
        if (node && node.style) node.style.willChange = '';
      });
      var idx = activeTweens.indexOf(tween);
      if (idx !== -1) activeTweens.splice(idx, 1);
    });
    activeTweens.push(tween);
    return tween;
  }

  function killActiveTweens() {
    activeTweens.splice(0).forEach(function (tween) {
      if (tween && tween.kill) tween.kill();
    });
  }

  /* Split label text into chars and return a GSAP tween for the text */
  function animateLabel(labelEl, text, fromVars, toVars) {
    if (!labelEl) return null;
    if (typeof Splitting === 'undefined') {
      labelEl.textContent = text;
      labelEl.style.opacity = '1';
      return null;
    }
    labelEl.textContent = text;
    Splitting({ target: labelEl, by: 'chars' });
    var chars = labelEl.querySelectorAll('.char');
    if (!chars.length) {
      labelEl.textContent = text;
      labelEl.style.opacity = '1';
      return null;
    }
    return withWillChange(chars, 'transform, opacity', gsap.fromTo(chars, fromVars, toVars));
  }

  function playTransitionEffect(idx, sec) {
    if (prefersRM) return;
    var label = $('#transition-label');
    var layer = $('#transition-layer');
    var glitch = $('#transition-glitch');
    var cracks = $('#transition-cracks');
    if (!layer || typeof gsap === 'undefined') return;

    var hasMo = typeof mo !== 'undefined';
    var fx = $('#transition-fx');

    var labels = [
      'INITIALIZING SURFACE',
      'DRILLING TO STRATUM I · 1200m',
      'DRILLING TO STRATUM II · 2400m',
      'DRILLING TO STRATUM III · 3600m',
      'DRILLING TO STRATUM IV · 4800m',
      'ANALYZING CORE SAMPLE · 6000m',
      'SCANNING SENSOR MATRIX · 7200m',
      'RUNNING VERIFICATION · 8400m',
      'REACHING CORE · 9000m'
    ];
    var labelText = labels[idx] || '';

    /* Clear previous effects */
    clearFx();
    if (cracks) gsap.set(cracks, { opacity: 0 });
    if (cracks) gsap.set('.crack-path', { strokeDashoffset: 3000 });

    var tl = gsap.timeline({
      onComplete: function () { clearFx(); }
    });

    /* ── idx 1: Perception — Surface Penetration ── */
    if (idx === 1) {
      tl.set(layer, { opacity: 1, background: 'transparent' });
      tl.fromTo(layer,
        { clipPath: 'inset(50% 0 50% 0)' },
        { clipPath: 'inset(0% 0 0% 0)', duration: 0.22, ease: 'power3.out' }
      );
      tl.fromTo(glitch, { opacity: 0 }, { opacity: 1, duration: 0.08 }, 0.05);

      if (hasMo && fx) {
        var burst1 = new mo.Burst({
          parent: fx, count: 18, radius: { 0: 250 },
          children: {
            shape: 'rect', fill: cssVar('--survey'),
            radiusX: 4, radiusY: 8, duration: 600,
            easing: 'cubic.out', isSwirl: true, swirlSize: 15,
            opacity: { 1: 0 },
          }
        });
        var ripple1 = new mo.Ripple({
          parent: fx, radius: { 0: 350 },
          fill: 'transparent', stroke: cssVar('--survey'),
          strokeWidth: { 8: 0 }, duration: 700,
          opacity: { 0.8: 0 }, easing: 'cubic.out',
        });
        tl.call(function () { burst1.play(); ripple1.play(); }, null, 0.05);
      }

      var lbl1 = animateLabel(label, labelText,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.2, stagger: 0.025, ease: 'power2.out' }
      );
      if (lbl1) tl.add(lbl1, 0.1);

      tl.to(layer, { clipPath: 'inset(50% 0 50% 0)', duration: 0.22, ease: 'power3.in' }, 0.35);
      tl.set(layer, { opacity: 0, clipPath: 'inset(50% 0 50% 0)' });

    /* ── idx 2: Training — Stratum Fracture ── */
    } else if (idx === 2) {
      tl.set(layer, { opacity: 0, background: 'oklch(12% 0.03 250)' });
      tl.to(layer, { opacity: 0.85, duration: 0.12, ease: 'power4.in' });

      if (cracks) {
        tl.set(cracks, { opacity: 1 }, 0.02);
        tl.to('.crack-path', {
          strokeDashoffset: 0, duration: 0.3, stagger: 0.06, ease: 'power2.out'
        }, 0.05);
        tl.to(cracks, { opacity: 0, duration: 0.2 }, 0.4);
      }

      if (hasMo && fx) {
        var burst2 = new mo.Burst({
          parent: fx, count: 14, radius: { 0: 180 },
          angle: { 90: 90 },
          children: {
            shape: 'circle', fill: cssVar('--ink-soft'),
            radius: { 4: 0 }, duration: 800,
            easing: 'cubic.in', y: { 0: 200 },
            opacity: { 0.6: 0 },
          }
        });
        tl.call(function () { burst2.play(); }, null, 0.1);
      }

      tl.fromTo(glitch, { opacity: 0 }, { opacity: 1, duration: 0.06 }, 0.08);

      var lbl2 = animateLabel(label, labelText,
        { opacity: 0, x: 4 },
        { opacity: 1, x: 0, duration: 0.15, stagger: 0.02, ease: 'power2.out' }
      );
      if (lbl2) tl.add(lbl2, 0.1);

      tl.to(layer, { opacity: 0, duration: 0.25, ease: 'power3.out' }, 0.3);

    /* ── idx 3: Infrastructure — Core Extraction ── */
    } else if (idx === 3) {
      tl.set(layer, { opacity: 1, background: 'transparent' });
      tl.fromTo(layer,
        { clipPath: 'inset(50% 0 50% 0)' },
        { clipPath: 'inset(0% 0 0% 0)', duration: 0.22, ease: 'power3.out' }
      );
      tl.fromTo(glitch, { opacity: 0 }, { opacity: 1, duration: 0.08 }, 0.05);

      if (hasMo && fx) {
        var beam3 = new mo.Shape({
          parent: fx, shape: 'rect',
          radiusX: 8, radiusY: { 0: 400 },
          fill: cssVar('--datum'), duration: 500,
          easing: 'cubic.out', opacity: { 0.8: 0 },
        });
        var burst3 = new mo.Burst({
          parent: fx, count: 22, radius: { 0: 280 },
          children: {
            shape: 'circle', fill: cssVar('--datum'),
            radius: { 5: 0 }, duration: 700,
            easing: 'cubic.out', isSwirl: true, swirlSize: 10,
            opacity: { 1: 0 },
          }
        });
        var ripple3 = new mo.Ripple({
          parent: fx, radius: { 0: 300 },
          fill: 'transparent', stroke: cssVar('--datum'),
          strokeWidth: { 6: 0 }, duration: 600,
          opacity: { 0.7: 0 }, easing: 'cubic.out',
        });
        tl.call(function () { beam3.play(); burst3.play(); ripple3.play(); }, null, 0.05);
      }

      var lbl3 = animateLabel(label, labelText,
        { opacity: 0, filter: 'blur(8px)' },
        { opacity: 1, filter: 'blur(0px)', duration: 0.2, stagger: 0.02, ease: 'power2.out' }
      );
      if (lbl3) tl.add(lbl3, 0.1);

      tl.to(layer, { clipPath: 'inset(50% 0 50% 0)', duration: 0.22, ease: 'power3.in' }, 0.35);
      tl.set(layer, { opacity: 0, clipPath: 'inset(50% 0 50% 0)' });

    /* ── idx 4: Interface — Tectonic Shift ── */
    } else if (idx === 4) {
      tl.set(layer, { opacity: 0, background: 'oklch(12% 0.03 250)' });
      tl.to(layer, { opacity: 0.85, duration: 0.12, ease: 'power4.in' });

      if (hasMo && fx) {
        var burst4 = new mo.Burst({
          parent: fx, count: 16, radius: { 0: 400 },
          angle: { [-30]: 30 },
          children: {
            shape: 'line', stroke: cssVar('--survey'),
            strokeWidth: { 3: 0 }, radiusX: 12, radiusY: 0,
            duration: 500, easing: 'cubic.out',
            opacity: { 1: 0 },
          }
        });
        var ripple4 = new mo.Ripple({
          parent: fx, radius: { 0: 350 },
          fill: 'transparent', stroke: cssVar('--survey'),
          strokeWidth: { 6: 0 }, duration: 700,
          opacity: { 0.6: 0 }, easing: 'cubic.out',
        });
        tl.call(function () { burst4.play(); ripple4.play(); }, null, 0.08);
      }

      tl.fromTo(glitch, { opacity: 0 }, { opacity: 1, duration: 0.06 }, 0.08);

      var lbl4 = animateLabel(label, labelText,
        { opacity: 0, x: -15 },
        { opacity: 1, x: 0, duration: 0.2, stagger: 0.02, ease: 'power3.out' }
      );
      if (lbl4) tl.add(lbl4, 0.1);

      tl.to(layer, { opacity: 0, duration: 0.25, ease: 'power3.out' }, 0.3);

    /* ── idx 5: Journey — Borehole Descent ── */
    } else if (idx === 5) {
      tl.set(layer, { opacity: 1, background: 'transparent' });
      tl.fromTo(layer,
        { clipPath: 'circle(0% at 50% 50%)' },
        { clipPath: 'circle(120% at 50% 50%)', duration: 0.28, ease: 'power2.out' }
      );
      tl.fromTo(glitch, { opacity: 0.5 }, { opacity: 0, duration: 0.15 }, 0.1);

      if (hasMo && fx) {
        var ripple5a = new mo.Ripple({
          parent: fx, radius: { 400: 0 },
          fill: 'transparent', stroke: cssVar('--survey'),
          strokeWidth: { 6: 0 }, duration: 500,
          opacity: { 0.6: 0 }, easing: 'cubic.in',
        });
        var ripple5b = new mo.Ripple({
          parent: fx, radius: { 350: 0 },
          fill: 'transparent', stroke: cssVar('--validated'),
          strokeWidth: { 5: 0 }, duration: 500, delay: 100,
          opacity: { 0.5: 0 }, easing: 'cubic.in',
        });
        var burst5 = new mo.Burst({
          parent: fx, count: 16, radius: { 0: 150 },
          angle: { 90: 90 },
          children: {
            shape: 'rect', fill: cssVar('--ink-soft'),
            radiusX: 3, radiusY: 6, duration: 700,
            easing: 'cubic.in', y: { 0: 250 },
            opacity: { 0.5: 0 },
          }
        });
        tl.call(function () { ripple5a.play(); ripple5b.play(); burst5.play(); }, null, 0.05);
      }

      var lbl5 = animateLabel(label, labelText,
        { opacity: 0, y: -15 },
        { opacity: 1, y: 0, duration: 0.2, stagger: 0.02, ease: 'power3.out' }
      );
      if (lbl5) tl.add(lbl5, 0.05);

      tl.to(layer, { clipPath: 'circle(120% at 50% 50%)', opacity: 0, duration: 0.2, ease: 'power2.in' }, 0.32);

    /* ── idx 6: Skills — Mineral Bloom ── */
    } else if (idx === 6) {
      tl.set(layer, { opacity: 1, background: 'transparent' });
      tl.fromTo(layer,
        { clipPath: 'circle(0% at 50% 50%)' },
        { clipPath: 'circle(120% at 50% 50%)', duration: 0.28, ease: 'power2.out' }
      );
      tl.fromTo(glitch, { opacity: 0.5 }, { opacity: 0, duration: 0.15 }, 0.1);

      if (hasMo && fx) {
        var hexBurst = new mo.Burst({
          parent: fx, count: 12, radius: { 0: 220 },
          children: {
            shape: 'polygon', points: 6,
            fill: 'transparent',
            stroke: [cssVar('--survey'), '#c45c26', '#3d8a65', cssVar('--validated')],
            strokeWidth: { 3: 0 }, duration: 700,
            easing: 'cubic.out', opacity: { 1: 0 },
          }
        });
        var hexShape = new mo.Shape({
          parent: fx, shape: 'polygon', points: 6,
          radius: { 0: 250 }, fill: 'transparent',
          stroke: cssVar('--survey'), strokeWidth: { 4: 0 },
          duration: 600, opacity: { 0.6: 0 }, easing: 'cubic.out',
        });
        tl.call(function () { hexBurst.play(); hexShape.play(); }, null, 0.05);
      }

      var lbl6 = animateLabel(label, labelText,
        { opacity: 0, scale: 0 },
        { opacity: 1, scale: 1, duration: 0.25, stagger: 0.02, ease: 'back.out(2)' }
      );
      if (lbl6) tl.add(lbl6, 0.05);

      tl.to(layer, { clipPath: 'circle(120% at 50% 50%)', opacity: 0, duration: 0.2, ease: 'power2.in' }, 0.32);

    /* ── idx 7: Proof — Verification Pulse ── */
    } else if (idx === 7) {
      tl.set(layer, { opacity: 1, background: 'transparent' });
      tl.fromTo(layer,
        { clipPath: 'circle(0% at 50% 50%)' },
        { clipPath: 'circle(120% at 50% 50%)', duration: 0.28, ease: 'power2.out' }
      );
      tl.fromTo(glitch, { opacity: 0.5 }, { opacity: 0, duration: 0.15 }, 0.1);

      if (hasMo && fx) {
        var pulse7a = new mo.Ripple({
          parent: fx, radius: { 0: 300 },
          fill: 'transparent', stroke: cssVar('--validated'),
          strokeWidth: { 5: 0 }, duration: 600,
          opacity: { 0.7: 0 }, easing: 'cubic.out',
        });
        var pulse7b = new mo.Ripple({
          parent: fx, radius: { 0: 300 },
          fill: 'transparent', stroke: cssVar('--validated'),
          strokeWidth: { 5: 0 }, duration: 600, delay: 150,
          opacity: { 0.6: 0 }, easing: 'cubic.out',
        });
        var pulse7c = new mo.Ripple({
          parent: fx, radius: { 0: 300 },
          fill: 'transparent', stroke: cssVar('--validated'),
          strokeWidth: { 5: 0 }, duration: 600, delay: 300,
          opacity: { 0.5: 0 }, easing: 'cubic.out',
        });
        var sweep7 = new mo.Shape({
          parent: fx, shape: 'rect',
          radiusX: 200, radiusY: 2,
          fill: cssVar('--validated'), duration: 600,
          rotation: { 0: 360 }, opacity: { 0.5: 0 },
          easing: 'cubic.out',
        });
        tl.call(function () { pulse7a.play(); pulse7b.play(); pulse7c.play(); sweep7.play(); }, null, 0.05);
      }

      var lbl7 = animateLabel(label, labelText,
        { opacity: 0, scale: 0.5 },
        { opacity: 1, scale: 1, duration: 0.25, stagger: 0.02, ease: 'elastic.out(1, 0.5)' }
      );
      if (lbl7) tl.add(lbl7, 0.05);

      tl.to(layer, { clipPath: 'circle(120% at 50% 50%)', opacity: 0, duration: 0.2, ease: 'power2.in' }, 0.32);

    /* ── idx 8: Contact — Core Breach ── */
    } else if (idx === 8) {
      tl.set(layer, { opacity: 1, background: 'radial-gradient(circle at center, oklch(18% 0.04 250) 0%, transparent 70%)' });
      tl.fromTo(layer,
        { clipPath: 'circle(8% at 50% 50%)' },
        { clipPath: 'circle(150% at 50% 50%)', duration: 0.4, ease: 'expo.out' }
      );

      if (hasMo && fx) {
        var megaBurst = new mo.Burst({
          parent: fx, count: 30, radius: { 0: 450 },
          children: {
            shape: 'circle',
            fill: [cssVar('--survey'), cssVar('--validated'), cssVar('--datum'), '#E8B86D'],
            radius: { 6: 0 }, duration: 800,
            easing: 'cubic.out', isSwirl: true, swirlSize: 20,
            opacity: { 1: 0 },
          }
        });
        var shockwave = new mo.Ripple({
          parent: fx, radius: { 0: 600 },
          fill: 'transparent', stroke: cssVar('--survey'),
          strokeWidth: { 15: 0 }, duration: 900,
          opacity: { 1: 0 }, easing: 'expo.out',
        });
        var hex1 = new mo.Shape({
          parent: fx, shape: 'polygon', points: 6,
          radius: { 400: 100 }, fill: 'transparent',
          stroke: cssVar('--validated'), strokeWidth: { 3: 0 },
          duration: 700, opacity: { 0.5: 0 }, easing: 'cubic.out',
        });
        var hex2 = new mo.Shape({
          parent: fx, shape: 'polygon', points: 6,
          radius: { 400: 100 }, fill: 'transparent',
          stroke: cssVar('--survey'), strokeWidth: { 3: 0 },
          duration: 700, delay: 100, opacity: { 0.5: 0 }, easing: 'cubic.out',
        });
        tl.call(function () { megaBurst.play(); shockwave.play(); hex1.play(); hex2.play(); }, null, 0.1);
      }

      var lbl8 = animateLabel(label, labelText,
        { opacity: 0, scale: 3, rotation: -12 },
        { opacity: 1, scale: 1, rotation: 0, duration: 0.3, stagger: 0.015, ease: 'back.out(3)' }
      );
      if (lbl8) tl.add(lbl8, 0.1);

      tl.to(layer, { opacity: 0, duration: 0.3, ease: 'power3.in' }, 0.5);
    }
    /* idx === 0: no transition (initial load) */
  }

  /* ═════════════════════════════════════════════════════════ */
  /* HUD UPDATES                                               */
  /* ═════════════════════════════════════════════════════════ */

  /* Smoothed velocity — drives fog intensity */
  var displayVelocity = 0;
  var velocityRafId = 0;

  function updateHud(progress) {
    /* Depth gauge position — only update when pct changes */
    var pct = (progress * 100).toFixed(1);
    if (pct !== prevHud.fill) {
      var normalized = (progress || 0).toFixed(4);
      if (els.depthFill) els.depthFill.style.transform = 'scaleY(' + normalized + ')';
      if (els.depthMarker) {
        var trackH = els.depthGaugeTrack ? els.depthGaugeTrack.clientHeight : 0;
        els.depthMarker.style.setProperty('--depth-offset', (trackH * progress).toFixed(1) + 'px');
      }
      prevHud.fill = pct;
    }
  }

  /* ═════════════════════════════════════════════════════════ */
  /* FOG INTENSITY — reactive to scroll velocity               */
  /* ═════════════════════════════════════════════════════════ */

  function updateFogVelocity(speed) {
    if (!els.fogVignette) return;
    var intensity = clamp(0.3 + Math.abs(speed) * 0.3, 0.3, 0.85);
    els.fogVignette.style.setProperty('--fog-opacity', intensity.toFixed(3));
    els.fogVignette.style.opacity = intensity.toFixed(3);
  }

  /* ═════════════════════════════════════════════════════════ */
  /* HERO — 3D letter scatter/assemble on load                 */
  /* ═════════════════════════════════════════════════════════ */

  function initHero() {
    var chars = $$('.hero__char');
    if (chars.length === 0 || typeof gsap === 'undefined') return;

    if (prefersRM) {
      chars.forEach(function (c) { c.style.opacity = '1'; });
      return;
    }

    /* Scatter to random 3D positions */
    chars.forEach(function (c) {
      gsap.set(c, {
        x: (Math.random() - 0.5) * 400,
        y: (Math.random() - 0.5) * 300,
        z: Math.random() * -600 - 200,
        rotationX: (Math.random() - 0.5) * 90,
        rotationY: (Math.random() - 0.5) * 90,
        opacity: 0,
        transformPerspective: 1200,
      });
    });

    /* Assemble */
    withWillChange(chars, 'transform, opacity', gsap.to(chars, {
      x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, opacity: 1,
      duration: 1.0,
      ease: 'power4.out',
      stagger: { each: 0.04, from: 'random' },
      delay: 0.3
    }));

    /* Tagline stagger */
    var role = $('.hero__role');
    var tagline = $('.hero__tagline');
    [role, tagline].forEach(function (el, i) {
      if (!el) return;
      withWillChange(el, 'transform, opacity', gsap.fromTo(el,
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', delay: 0.9 + i * 0.1 }
      ));
    });

    /* Image */
    var imgWrap = $('.hero__image-wrap');
    if (imgWrap) {
      withWillChange(imgWrap, 'transform, opacity', gsap.fromTo(imgWrap,
        { opacity: 0, scale: 0.92 },
        { opacity: 1, scale: 1, duration: 1, ease: 'power3.out', delay: 0.6 }
      ));
    }
  }

  /* ═════════════════════════════════════════════════════════ */
  /* PER-SECTION TIMELINES                                     */
  /* ═════════════════════════════════════════════════════════ */

  /* All timelines are paused and progress-driven by scroll.
     local progress 0 = section just entered, 1 = about to exit.
     Internal animations should span 0-1 within the timeline. */

  function buildSectionTimelines() {
    if (typeof gsap === 'undefined') return;

    /* ── Perception: ROI crop animation ── */
    (function () {
      var sharp = $('.aerial-stage__sharp');
      var roi = $('.aerial-stage__roi');
      if (!sharp) return;
      var tl = gsap.timeline({ paused: true });
      /* Animate clip-path from tight crop to wider view */
      tl.fromTo(sharp,
        { clipPath: 'inset(35% 40% 40% 35%)' },
        { clipPath: 'inset(10% 15% 25% 50%)', duration: 1, ease: 'power2.inOut' }
      );
      if (roi) {
        tl.fromTo(roi,
          { xPercent: 35, yPercent: 35, scaleX: 0.25, scaleY: 0.25, opacity: 0 },
          { xPercent: 50, yPercent: 10, scaleX: 0.35, scaleY: 0.65, opacity: 1, duration: 1, ease: 'power2.inOut' },
          0
        );
      }
      sectionTimelines.perception = tl;
    })();

    /* ── Training: seam wipe ── */
    (function () {
      var styleLayer = $('.seam-stage__style');
      var divider = $('#seam-divider');
      var stage = $('.seam-stage');
      if (!styleLayer || !stage) return;
      var tl = gsap.timeline({ paused: true });
      var stageW = stage.offsetWidth || 400;
      tl.fromTo(styleLayer,
        { clipPath: 'inset(0 100% 0 0)' },
        { clipPath: 'inset(0 0% 0 0)', duration: 1, ease: 'power2.inOut' }
      );
      if (divider) {
        tl.fromTo(divider, { x: 0 }, { x: stageW, duration: 1, ease: 'power2.inOut' }, 0);
      }
      sectionTimelines.training = tl;
    })();

    /* ── Infrastructure: pipeline build ── */
    (function () {
      var cards = $$('#pipeline .pipe-card');
      var connectors = $$('#pipeline .pipe-connector svg line');
      if (cards.length === 0) return;
      var tl = gsap.timeline({ paused: true });
      cards.forEach(function (card, i) {
        tl.fromTo(card,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.15, ease: 'power3.out' },
          i * 0.12
        );
      });
      connectors.forEach(function (line, i) {
        tl.fromTo(line,
          { strokeDashoffset: 40, strokeDasharray: '40 40' },
          { strokeDashoffset: 0, duration: 0.1, ease: 'none' },
          0.06 + i * 0.12
        );
      });
      /* Normalize timeline to 0-1 */
      tl.totalDuration(1);
      sectionTimelines.infrastructure = tl;
    })();

    /* ── Interface: terminal typing ── */
    (function () {
      var lines = $$('#terminal .tline');
      if (lines.length === 0) return;
      var tl = gsap.timeline({ paused: true });
      lines.forEach(function (line, i) {
        var pos = i / lines.length;
        tl.call(function () { line.classList.add('is-typed'); }, null, pos);
        tl.fromTo(line,
          { opacity: 0, y: 6 },
          { opacity: 1, y: 0, duration: 0.08, ease: 'power2.out' },
          pos
        );
      });
      tl.totalDuration(1);
      sectionTimelines.interface = tl;
    })();

    /* ── Journey: horizontal timeline reveal ── */
    (function () {
      var eras = $$('.journey-era');
      var seismicLine = document.querySelector('.journey-seismic__line');
      if (!eras.length) return;
      var tl = gsap.timeline({ paused: true });

      if (seismicLine) {
        tl.to(seismicLine, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.inOut' }, 0);
      }

      eras.forEach(function (era, i) {
        var pos = 0.08 + i * 0.16;
        tl.fromTo(era,
          { opacity: 0, y: 24, scale: 0.92 },
          { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: 'back.out(1.4)' },
          pos
        );
        tl.call(function () { era.classList.add('is-cracked'); }, null, pos + 0.08);
      });

      tl.totalDuration(1);
      sectionTimelines.journey = tl;
    })();

    /* ── Capabilities: core-sample log reveal ── */
    (function () {
      var rows = $$('.capability');
      if (!rows.length) return;

      var tl = gsap.timeline({ paused: true });

      rows.forEach(function (row, i) {
        var pos = 0.06 + i * 0.18;
        tl.fromTo(row,
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' },
          pos
        );
        tl.call(function () {
          row.classList.add('is-active');
          /* stagger tool chips inside */
          var chips = row.querySelectorAll('.capability__tools li');
          chips.forEach(function (chip, ci) {
            chip.style.opacity = '0';
            chip.style.transform = 'translateY(6px)';
            setTimeout(function () {
              chip.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
              chip.style.opacity = '1';
              chip.style.transform = 'none';
            }, ci * 40);
          });
        }, null, pos + 0.06);
      });

      tl.totalDuration(1);
      sectionTimelines.skills = tl;
    })();

    /* ── Proof: stat cards cinematic reveal ── */
    (function () {
      var cards = $$('.stat-card');
      if (!cards.length) return;
      var tl = gsap.timeline({ paused: true });

      cards.forEach(function (card, i) {
        var target = parseInt(card.getAttribute('data-target'), 10);
        var counterEl = card.querySelector('.stat-count');
        var pos = i * 0.22;

        tl.fromTo(card,
          { opacity: 0, y: 50, scale: 0.85, rotationX: 8 },
          { opacity: 1, y: 0, scale: 1, rotationX: 0, duration: 0.28, ease: 'back.out(1.6)' },
          pos
        );
        tl.call(function () { card.classList.add('is-filled'); }, null, pos + 0.1);

        if (counterEl) {
          var obj = { v: 0 };
          tl.to(obj, {
            v: target, duration: 0.4, ease: 'power3.out',
            snap: { v: 1 },
            onUpdate: function () { counterEl.textContent = Math.round(obj.v); }
          }, pos + 0.05);
        }
      });

      tl.totalDuration(1);
      sectionTimelines.proof = tl;
    })();

    /* ── Contact: fade in ── */
    (function () {
      var block = $('.contact-block');
      if (!block) return;
      var tl = gsap.timeline({ paused: true });
      tl.fromTo(block,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' }
      );
      tl.totalDuration(1);
      sectionTimelines.contact = tl;
    })();
  }


  /* ═════════════════════════════════════════════════════════ */
  /* DEPTH GAUGE — click & drag navigation                    */
  /* ═════════════════════════════════════════════════════════ */

  function initDepthGaugeDrag() {
    var track = els.depthGaugeTrack;
    var marker = els.depthMarker;
    var fill = els.depthFill;
    if (!track || !marker) return;

    function getProgressFromY(clientY) {
      var rect = track.getBoundingClientRect();
      return clamp((clientY - rect.top) / rect.height, 0, 1);
    }

    function scrollToProgress(progress) {
      var spacer = $('#scroll-spacer');
      if (!spacer) return;
      var spacerH = spacer.offsetHeight;
      window.scrollTo({ top: progress * spacerH, behavior: 'auto' });
    }

    function updateDirectly(progress) {
      updateSections(progress);
      updateHud(progress);
      updateScrollCue(progress);
      if (window.__neuralSetProgress) window.__neuralSetProgress(progress);
    }

    function updateAria(progress) {
      track.setAttribute('aria-valuenow', Math.round(progress * 100));
    }

    /* ── Click on track (jump to position) ── */
    track.addEventListener('mousedown', function (e) {
      /* Only respond to left click */
      if (e.button !== 0) return;
      isDragging = true;
      marker.classList.add('is-dragging');
      if (fill) fill.classList.add('is-dragging');
      document.body.style.userSelect = 'none';

      var progress = getProgressFromY(e.clientY);
      updateDirectly(progress);
      updateAria(progress);
      scrollToProgress(progress);
      e.preventDefault();
    });

    /* ── Drag move (document-level) ── */
    function onDragMove(e) {
      if (!isDragging) return;
      e.preventDefault();
      var clientY = e.clientY;
      if (clientY == null && e.touches) clientY = e.touches[0].clientY;
      if (clientY == null) return;
      var progress = getProgressFromY(clientY);
      updateDirectly(progress);
      updateAria(progress);
      scrollToProgress(progress);
    }

    /* ── Drag end (document-level) ── */
    function onDragEnd() {
      if (!isDragging) return;
      isDragging = false;
      marker.classList.remove('is-dragging');
      if (fill) fill.classList.remove('is-dragging');
      document.body.style.userSelect = '';
      /* Sync ScrollTrigger to actual scroll position */
      if (scrollTriggerInstance) scrollTriggerInstance.update();
    }

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);

    /* ── Touch support ── */
    track.addEventListener('touchstart', function (e) {
      isDragging = true;
      marker.classList.add('is-dragging');
      if (fill) fill.classList.add('is-dragging');
      var clientY = e.touches[0].clientY;
      var progress = getProgressFromY(clientY);
      updateDirectly(progress);
      updateAria(progress);
      scrollToProgress(progress);
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', onDragMove, { passive: false });
    document.addEventListener('touchend', onDragEnd);

    /* ── Click on labels (jump to section) ── */
    els.depthLabels.forEach(function (lbl) {
      lbl.addEventListener('click', function () {
        var sectionId = lbl.dataset.section;
        if (!sectionId) return;
        for (var i = 0; i < SECTIONS.length; i++) {
          if (SECTIONS[i].id === sectionId) {
            var progress = SECTIONS[i].start;
            if (prefersRM) {
              updateDirectly(progress);
              scrollToProgress(progress);
            } else {
              /* Smooth scroll for label clicks */
              var spacer = $('#scroll-spacer');
              if (spacer) {
                var spacerH = spacer.offsetHeight;
                window.scrollTo({ top: progress * spacerH, behavior: 'smooth' });
              }
            }
            break;
          }
        }
      });
    });

    /* ── Keyboard support on track ── */
    track.addEventListener('keydown', function (e) {
      var key = e.key;
      if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'Home' && key !== 'End') return;
      e.preventDefault();
      var spacer = $('#scroll-spacer');
      if (!spacer) return;
      var spacerH = spacer.offsetHeight;
      var currentY = window.scrollY || window.pageYOffset;
      var currentProgress = currentY / spacerH;
      var newProgress = currentProgress;

      if (key === 'ArrowUp') newProgress = clamp(currentProgress - 0.02, 0, 1);
      else if (key === 'ArrowDown') newProgress = clamp(currentProgress + 0.02, 0, 1);
      else if (key === 'Home') newProgress = 0;
      else if (key === 'End') newProgress = 1;

      window.scrollTo({ top: newProgress * spacerH, behavior: prefersRM ? 'auto' : 'smooth' });
    });
  }

  /* ═════════════════════════════════════════════════════════ */
  /* KEYBOARD NAV                                              */
  /* ═════════════════════════════════════════════════════════ */

  function initKeyboard() {
    if (!isDesktop) return;
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      var key = parseInt(e.key, 10);
      if (key >= 1 && key <= SECTIONS.length) {
        e.preventDefault();
        var sec = SECTIONS[key - 1];
        var spacer = $('#scroll-spacer');
        if (!spacer) return;
        var spacerH = spacer.offsetHeight;
        var targetScroll = sec.start * spacerH;
        window.scrollTo({ top: targetScroll, behavior: prefersRM ? 'auto' : 'smooth' });
      }
    });
  }

  /* ═════════════════════════════════════════════════════════ */
  /* SCROLL CUE HIDE                                           */
  /* ═════════════════════════════════════════════════════════ */

  function updateScrollCue(progress) {
    if (!els.heroScrollCue) return;
    if (progress > 0.02) {
      els.heroScrollCue.style.opacity = '0';
      els.heroScrollCue.style.pointerEvents = 'none';
    } else {
      els.heroScrollCue.style.opacity = '';
      els.heroScrollCue.style.pointerEvents = '';
    }
  }

  /* ═════════════════════════════════════════════════════════ */
  /* MASTER SCROLL TRIGGER                                     */
  /* ═════════════════════════════════════════════════════════ */

  function initScrollEngine() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined' || !isDesktop) return;

    gsap.registerPlugin(ScrollTrigger);
    gsap.ticker.lagSmoothing(500, 33);

    var spacer = $('#scroll-spacer');
    if (!spacer) return;

    var lastProgress = 0;

    scrollTriggerInstance = ScrollTrigger.create({
      trigger: spacer,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.4,
      onUpdate: function (self) {
        lastProgress = self.progress;

        /* Skip during depth gauge drag — drag handler updates directly */
        if (isDragging) return;

        /* Velocity tracking */
        var newY = window.scrollY || window.pageYOffset;
        scrollVelocity = (newY - lastScrollY) * 0.01;
        lastScrollY = newY;

        /* Update everything */
        updateSections(lastProgress);
        updateHud(lastProgress);
        updateScrollCue(lastProgress);

        /* Keep the slider's reported value in sync for assistive tech */
        if (els.depthGaugeTrack) {
          els.depthGaugeTrack.setAttribute('aria-valuenow', Math.round(lastProgress * 100));
        }

        /* Pass to neural background */
        if (window.__neuralSetProgress) {
          window.__neuralSetProgress(lastProgress);
        }

        /* Restart velocity tick if it stopped while idle */
        startVelocityTick();
      }
    });

    /* Velocity decay loop — stops when idle to save CPU */
    function velocityTick() {
      scrollVelocity *= 0.92;
      if (Math.abs(scrollVelocity) < 0.005) scrollVelocity = 0;
      displayVelocity += (scrollVelocity - displayVelocity) * 0.15;
      if (Math.abs(displayVelocity) < 0.01) displayVelocity = 0;
      if (displayVelocity !== 0) {
        updateFogVelocity(displayVelocity);
      }

      if (scrollVelocity === 0 && displayVelocity === 0) {
        velocityRafId = 0;
        gsap.ticker.remove(velocityTick);
        return;
      }
    }

    function startVelocityTick() {
      if (!velocityRafId) {
        velocityRafId = 1;
        gsap.ticker.add(velocityTick);
      }
    }

    function stopVelocityTick() {
      if (velocityRafId) {
        gsap.ticker.remove(velocityTick);
        velocityRafId = 0;
      }
    }

    startVelocityTick();
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stopVelocityTick();
      else startVelocityTick();
    });
    window.addEventListener('pagehide', function () {
      stopVelocityTick();
      killActiveTweens();
      if (scrollTriggerInstance) {
        scrollTriggerInstance.kill();
        scrollTriggerInstance = null;
      }
    }, { once: true });
  }

  /* ═════════════════════════════════════════════════════════ */
  /* MOBILE FALLBACK                                           */
  /* ═════════════════════════════════════════════════════════ */

  function initMobile() {
    if (isDesktop) return;
    /* On mobile, sections are in normal flow. Remove scroll spacer height */
    var spacer = $('#scroll-spacer');
    if (spacer) spacer.style.height = '0';

    /* Make all sections visible and remove 3D */
    $$('.stratum').forEach(function (s) {
      s.classList.add('is-active');
      s.style.opacity = '1';
      s.style.transform = 'none';
    });

    /* Show all animated elements immediately */
    $$('.tline').forEach(function (l) { l.classList.add('is-typed'); l.style.opacity = '1'; l.style.transform = 'none'; });
    $$('.journey-era').forEach(function (e) { e.classList.add('is-cracked'); e.style.opacity = '1'; e.style.transform = 'none'; });
    $$('.journey-era__card').forEach(function (c) { c.style.clipPath = 'none'; });
    $$('.capability').forEach(function (c) {
      c.classList.add('is-active');
      c.style.opacity = '1';
      c.style.transform = 'none';
      c.querySelectorAll('.capability__tools li').forEach(function (t) { t.style.opacity = '1'; t.style.transform = 'none'; });
    });
    $$('.stat-card').forEach(function (c) {
      c.classList.add('is-visible', 'is-filled');
      c.style.opacity = '1';
      c.style.transform = 'none';
    });
    $$('.pipe-card').forEach(function (c) { c.style.opacity = '1'; c.style.transform = 'none'; });

    /* Set counters */
    $$('.stat-count').forEach(function (el) { el.textContent = el.getAttribute('data-count'); });

  }

  /* ═════════════════════════════════════════════════════════ */
  /* BOOT                                                      */
  /* ═════════════════════════════════════════════════════════ */

  function boot() {
    cacheElements();
    document.body.classList.add('is-ready');

    if (typeof gsap !== 'undefined') {
      gsap.defaults({ overwrite: 'auto' });
      gsap.ticker.lagSmoothing(500, 33);
    }

    initHero();
    buildSectionTimelines();

    initKeyboard();

    if (isDesktop) {
      initScrollEngine();
      initDepthGaugeDrag();
      /* Set initial state */
      updateSections(0);
      updateHud(0);
    } else {
      initMobile();
    }
  }

  /* ═════════════════════════════════════════════════════════ */
  /* LOADING SCREEN                                            */
  /* ═════════════════════════════════════════════════════════ */

  function initLoader() {
    var loader = document.getElementById('loader');
    var barFill = document.getElementById('loader-bar');
    var statusEl = document.getElementById('loader-status');
    var depthEl = document.getElementById('loader-depth');
    if (!loader) return;

    var steps = [
      { t: 0,    w: '0%',   status: 'INITIALIZING DEPTH ENGINE', depth: '0m' },
      { t: 120,  w: '18%',  status: 'CALIBRATING SENSOR ARRAY',   depth: '240m' },
      { t: 280,  w: '42%',  status: 'LOADING NEURAL NETWORK',     depth: '1800m' },
      { t: 500,  w: '68%',  status: 'MAPPING STRATA LAYERS',      depth: '4200m' },
      { t: 720,  w: '88%',  status: 'PRIMING DRILL HEAD',         depth: '7800m' },
      { t: 900,  w: '100%', status: 'READY · SURFACE LOCKED',      depth: '9000m' },
    ];

    steps.forEach(function (step) {
      setTimeout(function () {
        if (barFill) barFill.style.transform = 'scaleX(' + (parseFloat(step.w) / 100).toFixed(3) + ')';
        if (statusEl) statusEl.textContent = step.status;
        if (depthEl) depthEl.textContent = step.depth;
      }, step.t);
    });

    setTimeout(function () {
      loader.classList.add('is-done');
      setTimeout(function () {
        loader.style.display = 'none';
      }, 450);
    }, 1050);
  }

  function start() {
    initLoader();

    if (prefersRM) {
      var loaderEl = document.getElementById('loader');
      if (loaderEl) loaderEl.style.display = 'none';
    }

    if (typeof gsap === 'undefined') {
      document.body.classList.add('is-ready');
      cacheElements();
      /* Static fallback */
      $$('.stratum').forEach(function (s) {
        s.style.opacity = '1'; s.style.transform = 'none'; s.classList.add('is-active');
      });
      $$('.tline').forEach(function (l) { l.style.opacity = '1'; l.style.transform = 'none'; });
      $$('.journey-era').forEach(function (e) { e.style.opacity = '1'; e.style.transform = 'none'; });
      $$('.capability').forEach(function (c) { c.classList.add('is-active'); c.style.opacity = '1'; c.style.transform = 'none'; });
      $$('.stat-card').forEach(function (c) { c.style.opacity = '1'; c.style.transform = 'none'; });
      $$('.pipe-card').forEach(function (c) { c.style.opacity = '1'; c.style.transform = 'none'; });
      return;
    }

    /* Boot once fonts settle, but never block on a slow/stalled font load:
       race against a timeout so content can't get stuck behind the loader. */
    var fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    var booted = false;
    var bootOnce = function () { if (!booted) { booted = true; boot(); } };
    fontsReady.then(bootOnce);
    setTimeout(bootOnce, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
