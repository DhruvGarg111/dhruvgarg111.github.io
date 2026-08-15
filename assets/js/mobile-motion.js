(function () {
  'use strict';

  /* Mobile motion & tactile instrument controller.
     Runs ONLY on linear-flow, motion-OK profiles. One
     IntersectionObserver + WAAPI; no ScrollTrigger, no persistent rAF loop.

     Delivers:
     - Specimen Slab telemetry & active tracking
     - Mini Depth Rod with live sliding bead & scrub
     - Stratum Quick-Jump Drawer
     - Dual-Mode Instrument Tabs (01 APPARATUS / 02 ARCHITECTURE)
     - Tap-to-Inspect High-Res Architecture Lightbox
     - Replay reset logic with clean state preservation
     - Seismic Wave and section entry choreographies
  */

  if (window.__canDepthDrill) return;                     // desktop drill owns motion
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window) || !Element.prototype.animate) return;

  var EASE_EXPO = 'cubic-bezier(0.16, 1, 0.3, 1)';
  var sections = Array.isArray(window.__groundTruthSections) ? window.__groundTruthSections : [
    { id: 'hero', depth: '0m', label: 'Surface', atmosphereDark: false },
    { id: 'perception', depth: '1200m', label: 'Perception', atmosphereDark: false },
    { id: 'training', depth: '2400m', label: 'Training', atmosphereDark: true },
    { id: 'infrastructure', depth: '3600m', label: 'Infrastructure', atmosphereDark: false },
    { id: 'interface', depth: '4800m', label: 'Interface', atmosphereDark: true },
    { id: 'journey', depth: '6000m', label: 'Journey', atmosphereDark: false },
    { id: 'skills', depth: '7200m', label: 'Capabilities', atmosphereDark: false },
    { id: 'proof', depth: '8400m', label: 'Proof', atmosphereDark: false },
    { id: 'contact', depth: '9000m', label: 'Contact Core', atmosphereDark: true }
  ];
  var sectionById = {};
  sections.forEach(function (s) { sectionById[s.id] = s; });

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function belowViewport(el) {
    return el.getBoundingClientRect().top > window.innerHeight;
  }

  /* Generic staged reveal: hide via inline styles now (stage), animate to
     natural state on first entry. */
  function stage(els, distance) {
    var offset = distance === undefined ? 14 : distance;
    els.forEach(function (el) {
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

  /* ── Depth readout (Floating interactive pill) ───────────── */
  var readout = null, readoutValue = null, readoutLabel = null;
  function buildReadout() {
    if (document.querySelector('.mm-depth')) return;
    readout = document.createElement('button');
    readout.type = 'button';
    readout.className = 'mm-depth';
    readout.setAttribute('aria-label', 'Open stratum navigation drawer');
    readout.innerHTML = '<span class="mm-depth__value mono"></span><span class="mm-depth__label mono"></span>';
    readout.addEventListener('click', function () { openStratumDrawer(); });
    document.body.appendChild(readout);
    readoutValue = $('.mm-depth__value', readout);
    readoutLabel = $('.mm-depth__label', readout);
  }

  /* ── Mobile Mini Depth Rod (Right rail wayfinder) ────────── */
  var depthRod = null, depthBead = null, depthTicks = [];
  function buildMobileDepthRod() {
    if (document.querySelector('.mm-depth-rod')) return;
    depthRod = document.createElement('aside');
    depthRod.className = 'mm-depth-rod';
    depthRod.setAttribute('aria-label', 'Depth gauge indicator');

    var ticksHtml = sections.map(function (s, i) {
      var topPct = Math.round((i / (sections.length - 1)) * 96 + 2);
      var shortDepth = s.depth === '0m' ? '0m' : s.depth === '9000m' ? '9.0k' : (parseInt(s.depth, 10) / 1000).toFixed(1) + 'k';
      return '<span class="mm-depth-tick mono' + (i === 0 ? ' is-active' : '') + '" data-section="' + s.id + '" style="top:' + topPct + '%">' + shortDepth + '</span>';
    }).join('');

    depthRod.innerHTML =
      '<div class="mm-depth-rod__track">' +
        '<div class="mm-depth-rod__bead" id="mm-depth-bead" title="Tap to open stratum jump drawer"></div>' +
      '</div>' +
      '<div class="mm-depth-rod__ticks">' + ticksHtml + '</div>';

    document.body.appendChild(depthRod);
    depthBead = $('#mm-depth-bead', depthRod);
    depthTicks = $$('.mm-depth-tick', depthRod);

    if (depthBead) {
      depthBead.addEventListener('click', function (e) {
        e.stopPropagation();
        openStratumDrawer();
      });
    }

    depthTicks.forEach(function (tick) {
      tick.addEventListener('click', function (e) {
        e.stopPropagation();
        var secId = tick.getAttribute('data-section');
        var target = document.getElementById(secId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  /* ── Stratum Quick-Jump Drawer ───────────────────────────── */
  var drawer = null;
  var drawerOpener = null;
  function buildStratumDrawer() {
    if (document.querySelector('.mm-drawer')) return;
    drawer = document.createElement('div');
    drawer.className = 'mm-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-label', 'Stratum Core Sample Navigation');

    var listHtml = sections.map(function (s, i) {
      var num = i < 10 ? '0' + i : String(i);
      return '<li class="mm-drawer__item">' +
        '<a href="#' + s.id + '" class="mm-drawer__link mono' + (i === 0 ? ' is-active' : '') + '" data-section="' + s.id + '">' +
          '<span class="mm-drawer__depth">' + s.depth + '</span>' +
          '<span class="mm-drawer__name">' + s.label + '</span>' +
          '<span class="mm-drawer__tag">' + num + '</span>' +
        '</a>' +
      '</li>';
    }).join('');

    drawer.innerHTML =
      '<div class="mm-drawer__backdrop"></div>' +
      '<div class="mm-drawer__panel">' +
        '<div class="mm-drawer__header">' +
          '<span class="mm-drawer__title mono">CORE SAMPLE DRILL · 9 STRATA</span>' +
          '<button type="button" class="mm-drawer__close mono" aria-label="Close navigation drawer">✕ CLOSE</button>' +
        '</div>' +
        '<ul class="mm-drawer__list">' + listHtml + '</ul>' +
      '</div>';

    document.body.appendChild(drawer);

    $('.mm-drawer__backdrop', drawer).addEventListener('click', closeStratumDrawer);
    $('.mm-drawer__close', drawer).addEventListener('click', closeStratumDrawer);

    $$('.mm-drawer__link', drawer).forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var secId = link.getAttribute('data-section');
        var target = document.getElementById(secId);
        closeStratumDrawer();
        if (target) {
          setTimeout(function () {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 120);
        }
      });
    });

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) {
        closeStratumDrawer();
      }
    });
  }

  function openStratumDrawer() {
    if (!drawer) return;
    drawerOpener = document.activeElement;
    drawer.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    $$('.mm-drawer__link', drawer).forEach(function (link) {
      link.classList.toggle('is-active', link.getAttribute('data-section') === activeId);
    });
    /* aria-modal without a focus move leaves keyboard users on the page
       behind the dialog; land on the active stratum link. */
    var activeLink = $('.mm-drawer__link.is-active', drawer) || $('.mm-drawer__close', drawer);
    if (activeLink) activeLink.focus();
  }

  function closeStratumDrawer() {
    if (!drawer) return;
    drawer.classList.remove('is-open');
    document.body.style.removeProperty('overflow');
    if (drawerOpener && drawerOpener.focus) drawerOpener.focus();
    drawerOpener = null;
  }

  /* ── Fullscreen Architecture SVG Lightbox Modal ─────────── */
  var lightbox = null, lightboxImg = null, lightboxCaption = null;
  var lightboxOpener = null;
  function buildLightbox() {
    if (document.querySelector('.mm-lightbox')) return;
    lightbox = document.createElement('div');
    lightbox.className = 'mm-lightbox';
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', 'System Architecture Diagram Inspection');

    /* No src on the img until one is assigned: an empty src attribute
       resolves against the document URL and some browsers fetch it. */
    lightbox.innerHTML =
      '<div class="mm-lightbox__backdrop"></div>' +
      '<div class="mm-lightbox__content">' +
        '<div class="mm-lightbox__header">' +
          '<span class="mm-lightbox__title mono">SYSTEM ARCHITECTURE · INSPECT</span>' +
          '<button type="button" class="mm-lightbox__close mono" aria-label="Close architecture view">✕ CLOSE</button>' +
        '</div>' +
        '<div class="mm-lightbox__viewport">' +
          '<img class="mm-lightbox__img" alt="" />' +
        '</div>' +
        '<div class="mm-lightbox__caption mono"></div>' +
      '</div>';

    document.body.appendChild(lightbox);
    lightboxImg = $('.mm-lightbox__img', lightbox);
    lightboxCaption = $('.mm-lightbox__caption', lightbox);

    $('.mm-lightbox__backdrop', lightbox).addEventListener('click', closeLightbox);
    $('.mm-lightbox__close', lightbox).addEventListener('click', closeLightbox);

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && lightbox.classList.contains('is-open')) {
        closeLightbox();
      }
    });
  }

  function openArchLightbox(imgSrc, captionText, altText, opener) {
    if (!lightbox || !lightboxImg) return;
    lightboxOpener = opener || null;
    lightboxImg.alt = altText || 'System architecture diagram';
    lightboxImg.src = imgSrc;
    if (lightboxCaption) lightboxCaption.textContent = captionText || 'High-resolution system architecture specification.';
    lightbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    /* role=dialog + aria-modal without moving focus strands keyboard/screen-
       reader users on the page behind the modal. */
    var closeBtn = $('.mm-lightbox__close', lightbox);
    if (closeBtn) closeBtn.focus();
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('is-open');
    document.body.style.removeProperty('overflow');
    if (lightboxOpener && lightboxOpener.focus) lightboxOpener.focus();
    lightboxOpener = null;
  }

  /* ── Active Section & Progress Tracking ──────────────────── */
  var announcer = document.getElementById('section-announcer');
  var activeId = null;
  function setActiveSection(id) {
    if (id === activeId) return;
    activeId = id;
    var sec = sectionById[id];
    if (!sec) return;

    if (readoutValue) { readoutValue.textContent = sec.depth; readoutLabel.textContent = sec.label; }
    if (readout) readout.classList.toggle('is-visible', id !== 'hero');
    if (depthRod) depthRod.classList.toggle('is-visible', id !== 'hero');

    document.body.classList.toggle('is-dark', !!sec.atmosphereDark);
    if (announcer) announcer.textContent = sec.label + ', ' + sec.depth;

    depthTicks.forEach(function (tick) {
      tick.classList.toggle('is-active', tick.getAttribute('data-section') === id);
    });

    pushToBackground();
  }

  /* ── Background feed (neural-lite) & mini depth rod ─────── */
  var docProgress = 0;
  var maxScroll = 0;
  var trackEl = null;
  var trackH = 0;

  function refreshScrollMetrics() {
    maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    if (!trackEl && depthRod) { trackEl = $('.mm-depth-rod__track', depthRod); }
    if (trackEl) { trackH = trackEl.clientHeight; }
  }
  window.addEventListener('resize', refreshScrollMetrics, { passive: true });
  /* scrollHeight keeps growing as below-fold images/fonts settle — without
     these the bead's travel range is computed from a half-laid-out page. */
  window.addEventListener('load', refreshScrollMetrics);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refreshScrollMetrics);

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
      if (!maxScroll) refreshScrollMetrics();
      docProgress = maxScroll > 0 ? Math.max(0, Math.min(1, window.scrollY / maxScroll)) : 0;
      if (depthBead) {
        var offsetPx = trackH ? (docProgress * (trackH * 0.96) + trackH * 0.02) : (docProgress * 200);
        depthBead.style.setProperty('--bead-offset', offsetPx.toFixed(1) + 'px');
      }
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

  /* ── Choreography System with State Reset ─────────────────── */
  var CHOREO = [];
  var CHOREO_MAP = {}; // id -> { prep, play }

  function registerChoreo(id, rootEl, prep, play, replayable) {
    if (!rootEl) return;
    CHOREO_MAP[id] = { prep: prep, play: play };
    if (!belowViewport(rootEl)) {
      return;
    }
    prep();
    CHOREO.push({ id: id, el: rootEl, play: play });
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
    threshold: 0.1,
    rootMargin: '0px 0px -10% 0px'
  });

  window.__mmReplay = function (id) {
    if (CHOREO_MAP[id]) {
      if (CHOREO_MAP[id].prep) CHOREO_MAP[id].prep();
      requestAnimationFrame(function () {
        if (CHOREO_MAP[id].play) CHOREO_MAP[id].play();
      });
    }
  };

  /* ── Dual-Mode Instrument Tabs & Actions Factory ──────────── */
  function setupProjectVisualTabs(sectionId, stageId, replayLabel) {
    var sec = document.getElementById(sectionId);
    if (!sec) return;
    var visual = $('.stratum__visual', sec);
    if (!visual) return;

    if (sec.querySelector('.mm-instrument-bar')) return;

    var archFig = $('.arch-figure', visual);

    /* The tabs only make sense while .stratum__visual is a horizontal
       scroll-snap gallery — and that CSS lives in the max-width:767px block.
       On touch tablets (768px+) mobile-motion still runs, but the visual is
       normal stacked flow there, so a tab bar would highlight on tap while
       scrolling nothing. Replay/inspect still apply everywhere. */
    var galleryMode = window.matchMedia('(max-width: 767px)').matches;

    // Create instrument wrapper
    var instrumentWrap = document.createElement('div');
    instrumentWrap.className = 'stratum__instrument';

    visual.parentNode.insertBefore(instrumentWrap, visual);

    // 1. Injected segmented tab bar (gallery widths only — see above)
    if (galleryMode) {
      var tabGroup = document.createElement('div');
      tabGroup.className = 'mm-instrument-bar';
      tabGroup.setAttribute('role', 'tablist');
      tabGroup.setAttribute('aria-label', 'Visual Instrument Mode');

      tabGroup.innerHTML =
        '<button type="button" role="tab" class="mm-tab is-active mono" aria-selected="true" data-tab="stage">' +
          '<span class="mm-tab__dot"></span> 01 APPARATUS' +
        '</button>' +
        (archFig ? '<button type="button" role="tab" class="mm-tab mono" aria-selected="false" data-tab="arch">02 ARCHITECTURE</button>' : '');

      instrumentWrap.appendChild(tabGroup);
    }
    instrumentWrap.appendChild(visual);

    if (galleryMode) {
      var tabs = $$('.mm-tab', instrumentWrap);
      var tabStage = tabs[0];
      var tabArch = tabs[1];

      if (tabStage) {
        tabStage.addEventListener('click', function () {
          visual.scrollTo({ left: 0, behavior: 'smooth' });
          setActiveTab(0);
        });
      }
      if (tabArch) {
        tabArch.addEventListener('click', function () {
          visual.scrollTo({ left: visual.offsetWidth || 340, behavior: 'smooth' });
          setActiveTab(1);
        });
      }

      function setActiveTab(index) {
        tabs.forEach(function (t, i) {
          var active = i === index;
          t.classList.toggle('is-active', active);
          t.setAttribute('aria-selected', active ? 'true' : 'false');
        });
      }

      // Sync tabs when swiping horizontally
      var visualW = visual.offsetWidth || 1;
      window.addEventListener('resize', function () { visualW = visual.offsetWidth || 1; }, { passive: true });
      visual.addEventListener('scroll', function () {
        var scrollFraction = visual.scrollLeft / visualW;
        setActiveTab(scrollFraction >= 0.5 ? 1 : 0);
      }, { passive: true });
    }

    // 2. Injected Action Controls underneath visual
    var actionsBar = document.createElement('div');
    actionsBar.className = 'mm-stage-actions';

    var replayBtn = document.createElement('button');
    replayBtn.type = 'button';
    replayBtn.className = 'mm-replay mono';
    replayBtn.textContent = '↺ replay';
    replayBtn.setAttribute('aria-label', replayLabel || 'Replay animation');
    replayBtn.addEventListener('click', function () { window.__mmReplay(stageId); });
    actionsBar.appendChild(replayBtn);

    if (archFig) {
      var inspectBtn = document.createElement('button');
      inspectBtn.type = 'button';
      inspectBtn.className = 'mm-expand-arch mono';
      inspectBtn.textContent = '⤢ INSPECT ARCHITECTURE';
      inspectBtn.setAttribute('aria-label', 'Inspect high-resolution architecture diagram');

      var archImg = $('img', archFig);
      var figCap = $('figcaption', archFig);
      var imgSrc = archImg ? archImg.src : '';
      var altText = archImg ? archImg.alt : '';
      var captionText = figCap ? figCap.textContent : '';

      inspectBtn.addEventListener('click', function () {
        openArchLightbox(imgSrc, captionText, altText, inspectBtn);
      });

      archFig.style.cursor = 'pointer';
      archFig.addEventListener('click', function () {
        openArchLightbox(imgSrc, captionText, altText, inspectBtn);
      });

      actionsBar.appendChild(inspectBtn);
    }

    instrumentWrap.appendChild(actionsBar);
  }

  /* ═══ Section Choreographies ════════════════════════════════ */

  /* Stratum I: Searchlight */
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
    setupProjectVisualTabs('perception', 'searchlight', 'Replay the coarse-to-fine detection sweep');
  })();

  /* Stratum II: Neural Canvas */
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
    setupProjectVisualTabs('training', 'seam', 'Replay the style-transfer seam sweep');
  })();

  /* Stratum III: PixelQueue */
  (function () {
    var pipeline = $('#pipeline');
    if (!pipeline) return;
    var cards = $$('.pipe-card', pipeline);
    if (!cards.length) return;

    function prep() {
      stage(cards);
    }
    function play() {
      reveal(cards, 120);
    }
    registerChoreo('pipeline', pipeline, prep, play, true);
    setupProjectVisualTabs('infrastructure', 'pipeline', 'Replay the annotation pipeline build-up');
  })();

  /* Stratum IV: PyGOG CLI */
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
      reveal(lines, 160, 6, function (line) { line.classList.add('is-typed'); });
    }
    registerChoreo('terminal', terminal, prep, play, true);
    setupProjectVisualTabs('interface', 'terminal', 'Replay the terminal session');
  })();

  /* Stratum V: Journey with Seismic Wave */
  (function () {
    var track = $('.journey-track');
    var seismic = $('.journey-seismic');
    if (!track) return;
    var eras = $$('.journey-era', track);

    /* The seismic element is a <polyline>, not a <path> — and its length is
       ~1062 units, so the dash window has to cover 1200 (the authored value
       desktop GSAP animates from). A shorter window leaves the line's tail
       permanently drawn at the start of the "sweep". */
    function prep() {
      track.classList.add('mm-line-pending');
      stage(eras);
      if (seismic) {
        var line = $('.journey-seismic__line', seismic);
        if (line) {
          line.style.strokeDasharray = '1200';
          line.style.strokeDashoffset = '1200';
        }
      }
    }
    function play() {
      track.classList.remove('mm-line-pending');
      track.classList.add('mm-line-grow');
      reveal(eras, 150);
      if (seismic) {
        var line = $('.journey-seismic__line', seismic);
        if (line) {
          line.animate(
            [{ strokeDashoffset: '1200' }, { strokeDashoffset: '0' }],
            { duration: 1800, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', fill: 'forwards' }
          );
        }
      }
    }
    registerChoreo('journey', track, prep, play, false);
  })();

  /* Stratum VI: Capabilities */
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

  /* Stratum VII: Proof */
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
        counter.textContent = '0';
        var bar = card.querySelector('.stat-card__bar-fill');
        if (bar) bar.style.setProperty('transform', 'scaleX(0)', 'important');
        counters.push({ counter: counter, target: target, bar: bar });
      });
    }
    function play() {
      reveal(cards, 140);
      counters.forEach(function (item, index) {
        var startsAt = performance.now() + 200 + index * 140;
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

  /* Stratum VIII: Contact */
  (function () {
    var section = $('#contact');
    var card = section && $('.contact-card', section);
    if (!card) return;
    function prep() { stage([card]); }
    function play() { reveal([card], 0); }
    registerChoreo('contact', card, prep, play, false);
  })();

  /* Flow field touch instructions */
  (function () {
    var flow = document.getElementById('hero-flow');
    if (flow && window.__isTouchFirst) {
      flow.setAttribute(
        'aria-label',
        'A live attention field - thousands of particles drifting through curl noise. On touch, a searchlight sweeps automatically and resolves the coarse field into sharper detail; tap or drag to drop a core sample.'
      );
    }
  })();

  /* Initialize Instruments */
  buildReadout();
  buildMobileDepthRod();
  buildStratumDrawer();
  buildLightbox();

  docProgress = (function () {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? Math.max(0, Math.min(1, window.scrollY / max)) : 0;
  })();
  pushToBackground();
})();
