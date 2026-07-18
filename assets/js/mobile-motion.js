(function () {
  'use strict';

  /* Mobile motion controller — the touch-first counterpart of the desktop
     drill engine. Runs ONLY on linear-flow, motion-OK profiles. One
     IntersectionObserver + WAAPI; no ScrollTrigger, no persistent rAF loop.

     Ownership contract with script.js's initMobile(): initMobile is the
     always-on baseline finalizer (everything readable, counters at final
     values). This module runs later (idle) and selectively OVERRIDES via
     inline styles — but only on sections still entirely below the viewport,
     so already-painted content never flashes hidden. If this file never
     loads (old browser, network), the baseline stands. */

  if (window.__canDepthDrill) return;                     // desktop drill owns motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window) || !Element.prototype.animate) return;

  var EASE_EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)';
  var sections = Array.isArray(window.__groundTruthSections) ? window.__groundTruthSections : [];
  var sectionById = {};
  sections.forEach(function (s) { sectionById[s.id] = s; });

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function belowViewport(el) {
    return el.getBoundingClientRect().top > window.innerHeight;
  }

  /* Generic staged reveal: hide via inline styles now (stage), animate to
     natural state on first entry. Inline styles beat every stylesheet rule
     — no !important arms race with the mobile/reduced-motion overrides. */
  function stage(els, distance) {
    var offset = distance === undefined ? 14 : distance;
    els.forEach(function (el) {
      /* The mobile safety net uses !important final states. Override it only
         while this controller owns a staged element, then release it again. */
      el.style.setProperty('opacity', '0', 'important');
      el.style.setProperty('transform', 'translateY(' + offset + 'px)', 'important');
    });
  }
  function reveal(els, step, distance, onStart) {
    var offset = distance === undefined ? 14 : distance;
    stage(els, offset);
    els.forEach(function (el, i) {
      var delay = i * (step === undefined ? 90 : step);
      var token = (el.__mmRevealToken || 0) + 1;
      el.__mmRevealToken = token;
      el.style.setProperty('transition', 'opacity 480ms ' + EASE_EXPO + ', transform 480ms ' + EASE_EXPO, 'important');
      window.setTimeout(function () {
        requestAnimationFrame(function () {
          if (el.__mmRevealToken !== token) return;
          if (onStart) onStart(el, i);
          el.style.setProperty('opacity', '1', 'important');
          el.style.setProperty('transform', 'none', 'important');
        });
      }, 16 + delay);
      window.setTimeout(function () {
        if (el.__mmRevealToken !== token) return;
        el.style.removeProperty('opacity');
        el.style.removeProperty('transform');
        el.style.removeProperty('transition');
      }, 540 + delay);
    });
  }

  /* ── Depth readout (non-interactive) ─────────────────────── */
  var readout = null, readoutValue = null, readoutLabel = null;
  function buildReadout() {
    readout = document.createElement('div');
    readout.className = 'mm-depth';
    readout.setAttribute('aria-hidden', 'true');
    readout.innerHTML = '<span class="mm-depth__value mono"></span><span class="mm-depth__label mono"></span>';
    document.body.appendChild(readout);
    readoutValue = $('.mm-depth__value', readout);
    readoutLabel = $('.mm-depth__label', readout);
  }

  var announcer = document.getElementById('section-announcer');
  var activeId = null;
  function setActiveSection(id) {
    if (id === activeId) return;
    activeId = id;
    var sec = sectionById[id];
    if (!sec) return;
    if (readoutValue) { readoutValue.textContent = sec.depth; readoutLabel.textContent = sec.label; }
    if (readout) readout.classList.toggle('is-visible', id !== 'hero');
    document.body.classList.toggle('is-dark', !!sec.atmosphereDark);
    if (announcer) announcer.textContent = sec.label + ', ' + sec.depth;
    pushToBackground();
  }

  /* ── Background feed (neural-lite) ───────────────────────── */
  var docProgress = 0;
  function pushToBackground() {
    if (!window.__neuralSetProgress) return;
    window.__neuralSetProgress(docProgress, activeId ? sectionById[activeId] || null : null);
  }
  var scrollScheduled = false;
  window.addEventListener('scroll', function () {
    if (scrollScheduled) return;
    scrollScheduled = true;
    requestAnimationFrame(function () {
      scrollScheduled = false;
      var max = document.documentElement.scrollHeight - window.innerHeight;
      docProgress = max > 0 ? Math.max(0, Math.min(1, window.scrollY / max)) : 0;
      pushToBackground();
    });
  }, { passive: true });

  /* ── Active-section tracking (coarse observer, ~mid-viewport) ── */
  var stratumEls = $$('.stratum');
  var activeIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) setActiveSection(e.target.id);
    });
  }, { rootMargin: '-40% 0px -40% 0px' });
  stratumEls.forEach(function (el) { activeIO.observe(el); });

  /* ── One-time entry choreography ─────────────────────────── */
  /* Phase 3/4 tasks push handlers here: { stageEl, prep(), play(), replayable } */
  var CHOREO = [];                       // filled by registerChoreo below + Phase 3/4 blocks
  var REPLAY_HANDLERS = {};              // stageId -> play()

  function registerChoreo(id, rootEl, prep, play, replayable) {
    if (!rootEl) return;
    if (!belowViewport(rootEl)) {
      /* Already painted — never re-hide. Replay stays available. */
      if (replayable) REPLAY_HANDLERS[id] = play;
      return;
    }
    prep();
    CHOREO.push({ id: id, el: rootEl, play: play });
    if (replayable) REPLAY_HANDLERS[id] = play;
    entryIO.observe(rootEl);
  }

  var entryIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      entryIO.unobserve(e.target);
      for (var i = 0; i < CHOREO.length; i++) {
        if (CHOREO[i].el === e.target) { CHOREO[i].play(); break; }
      }
    });
  }, {
    /* Low threshold on purpose: several strata are 2-3 viewports tall in
       linear flow, so a high intersectionRatio is structurally unreachable
       for them — a 0.35 threshold would never fire. Demo registrations
       observe their small stage elements instead of whole sections for
       precise timing; this low threshold covers the tall narrative ones. */
    threshold: 0.1,
    rootMargin: '0px 0px -10% 0px'
  });

  window.__mmReplay = function (id) {
    if (REPLAY_HANDLERS[id]) REPLAY_HANDLERS[id]();
  };

  /* ── Replay button factory (in-flow, after the stage element) ── */
  function addReplayButton(afterEl, stageId, label) {
    if (!afterEl || !REPLAY_HANDLERS[stageId]) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mm-replay mono';
    btn.textContent = '↺ replay';
    btn.setAttribute('aria-label', label);
    btn.addEventListener('click', function () { window.__mmReplay(stageId); });
    afterEl.insertAdjacentElement('afterend', btn);
  }

  /* ═══ Section choreography registrations (Phases 3 & 4 append here) ═══ */
  window.__mmRegister = registerChoreo;
  window.__mmAddReplay = addReplayButton;
  window.__mmHelpers = { $: $, $$: $$, stage: stage, reveal: reveal, EASE_EXPO: EASE_EXPO };

  /* Searchlight: coarse-to-fine region-of-interest sweep. */
  (function () {
    var stageEl = $('#aerial-stage');
    var sharp = $('.aerial-stage__sharp', stageEl);
    var roi = $('.aerial-stage__roi', stageEl);
    if (!stageEl || !sharp) return;

    function prep() {
      sharp.style.clipPath = 'inset(35% 40% 40% 35%)';
    }
    function play() {
      sharp.animate(
        [{ clipPath: 'inset(35% 40% 40% 35%)' }, { clipPath: 'inset(0% 0% 0% 0%)' }],
        { duration: 1400, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' }
      ).onfinish = function () { sharp.style.clipPath = ''; };
      if (roi) {
        roi.animate(
          [
            { opacity: 0, transform: 'translate(35%, 35%) scale(0.25, 0.25)' },
            { opacity: 1, transform: 'translate(50%, 10%) scale(0.35, 0.65)', offset: 0.7 },
            { opacity: 0, transform: 'translate(50%, 10%) scale(0.35, 0.65)' },
          ],
          { duration: 1700, easing: 'ease-in-out' }
        );
      }
    }
    registerChoreo('searchlight', stageEl, prep, play, true);
    addReplayButton(stageEl, 'searchlight', 'Replay the coarse-to-fine detection sweep');
  })();

  /* Neural Canvas: style-transfer seam sweep. */
  (function () {
    var stageEl = $('#seam-stage');
    var styleLayer = $('.seam-stage__style', stageEl);
    var divider = $('#seam-divider');
    if (!stageEl || !styleLayer) return;

    function prep() {
      styleLayer.style.clipPath = 'inset(0 100% 0 0)';
    }
    function play() {
      var width = stageEl.offsetWidth || 400;
      styleLayer.animate(
        [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }],
        { duration: 1400, easing: 'cubic-bezier(0.45, 0, 0.2, 1)', fill: 'forwards' }
      ).onfinish = function () { styleLayer.style.clipPath = ''; };
      if (divider) {
        divider.animate(
          [
            { opacity: 1, transform: 'translateX(0)' },
            { opacity: 1, transform: 'translateX(' + width + 'px)', offset: 0.9 },
            { opacity: 0, transform: 'translateX(' + width + 'px)' },
          ],
          { duration: 1550, easing: 'cubic-bezier(0.45, 0, 0.2, 1)' }
        );
      }
    }
    registerChoreo('seam', stageEl, prep, play, true);
    addReplayButton(stageEl, 'seam', 'Replay the style-transfer seam sweep');
  })();

  /* PixelQueue: sequential cards and connectors. */
  (function () {
    var pipeline = $('#pipeline');
    if (!pipeline) return;
    var cards = $$('.pipe-card', pipeline);
    var connectors = $$('.pipe-connector svg line', pipeline);
    if (!cards.length) return;

    function prep() {
      stage(cards);
      connectors.forEach(function (line) { line.style.opacity = '0'; });
    }
    function play() {
      reveal(cards, 140);
      connectors.forEach(function (line, index) {
        line.style.opacity = '';
        line.animate(
          [
            { opacity: 0, strokeDashoffset: 40, strokeDasharray: '40 40' },
            { opacity: 1, strokeDashoffset: 0, strokeDasharray: '40 40' },
          ],
          { duration: 320, delay: 120 + index * 140, easing: 'linear', fill: 'backwards' }
        );
      });
    }
    registerChoreo('pipeline', pipeline, prep, play, true);
    addReplayButton(pipeline, 'pipeline', 'Replay the annotation pipeline build-up');
  })();

  /* PyGOG: the transcript remains in the DOM while its lines enter in order. */
  (function () {
    var terminal = $('#terminal');
    if (!terminal) return;
    var lines = $$('.tline', terminal);
    if (!lines.length) return;

    function hideLines() {
      lines.forEach(function (line) { line.classList.remove('is-typed'); });
      stage(lines, 6);
    }
    function prep() {
      hideLines();
    }
    function play() {
      hideLines();
      reveal(lines, 170, 6, function (line) { line.classList.add('is-typed'); });
    }
    registerChoreo('terminal', terminal, prep, play, true);
    addReplayButton(terminal, 'terminal', 'Replay the terminal session');
  })();

  /* Journey: one-time depth line and era cascade. */
  (function () {
    var track = $('.journey-track');
    if (!track) return;
    var eras = $$('.journey-era', track);

    function prep() {
      track.classList.add('mm-line-pending');
      stage(eras);
    }
    function play() {
      track.classList.remove('mm-line-pending');
      track.classList.add('mm-line-grow');
      reveal(eras, 160);
    }
    registerChoreo('journey', track, prep, play, false);
  })();

  /* Capabilities: cascade plus a short touch-only sample highlight. */
  (function () {
    var section = $('#skills');
    if (!section) return;
    var capabilities = $$('.capability', section);
    if (!capabilities.length) return;

    function prep() { stage(capabilities); }
    function play() { reveal(capabilities, 110); }
    registerChoreo('capabilities', section, prep, play, false);

    capabilities.forEach(function (capability) {
      var timer = null;
      capability.addEventListener('touchstart', function () {
        capability.classList.add('mm-sampled');
        if (timer) clearTimeout(timer);
        timer = setTimeout(function () { capability.classList.remove('mm-sampled'); }, 900);
      }, { passive: true });
    });
  })();

  /* Proof: preserve a screen-reader final value while visible numbers count up. */
  (function () {
    var section = $('#proof');
    if (!section) return;
    var cards = $$('.stat-card', section);
    if (!cards.length) return;
    var counters = [];

    function prep() {
      stage(cards);
      cards.forEach(function (card) {
        var counter = card.querySelector('.stat-count');
        if (!counter) return;
        var target = parseInt(counter.getAttribute('data-count'), 10) || 0;
        var accessibleValue = document.createElement('span');
        accessibleValue.className = 'sr-only';
        accessibleValue.textContent = String(target);
        counter.setAttribute('aria-hidden', 'true');
        counter.insertAdjacentElement('afterend', accessibleValue);
        counter.textContent = '0';
        var bar = card.querySelector('.stat-card__bar-fill');
        if (bar) bar.style.setProperty('transform', 'scaleX(0)', 'important');
        counters.push({ counter: counter, target: target, bar: bar });
      });
    }
    function play() {
      reveal(cards, 150);
      counters.forEach(function (item, index) {
        var startsAt = performance.now() + 200 + index * 150;
        var duration = 700;
        function step(now) {
          var progress = Math.max(0, Math.min(1, (now - startsAt) / duration));
          var eased = 1 - Math.pow(1 - progress, 3);
          item.counter.textContent = String(Math.round(item.target * eased));
          if (progress < 1) requestAnimationFrame(step);
          else if (item.bar) item.bar.style.removeProperty('transform');
        }
        requestAnimationFrame(step);
      });
    }
    registerChoreo('proof', section, prep, play, false);
  })();

  /* Contact is deliberately restrained: the only moving element is its card. */
  (function () {
    var section = $('#contact');
    var card = section && $('.contact-card', section);
    if (!card) return;
    function prep() { stage([card]); }
    function play() { reveal([card], 0); }
    registerChoreo('contact', card, prep, play, false);
  })();

  /* The existing flow field already supports touch; make its instructions match. */
  (function () {
    var flow = document.getElementById('hero-flow');
    if (flow && window.__isTouchFirst) {
      flow.setAttribute(
        'aria-label',
        'A live generative vector field - thousands of particles drifting through curl noise. Tap or drag across the panel to bend the flow into a swirl.'
      );
    }
  })();

  buildReadout();
  /* Initial state for visitors landing mid-page (anchor links). */
  docProgress = (function () {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? Math.max(0, Math.min(1, window.scrollY / max)) : 0;
  })();
  pushToBackground();
})();
