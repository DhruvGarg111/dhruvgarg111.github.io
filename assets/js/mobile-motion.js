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

  /* The same authored sigils that mark the desktop strata labels — one
     vocabulary, two surfaces (the drawer's rows carry them statically;
     the draw-in belongs to the sections themselves). */
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

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var modalState = { active: null, opener: null, inerted: [] };
  function setModalBackground(on) {
    if (on) {
      modalState.inerted = Array.prototype.slice.call(document.body.children).filter(function (el) {
        return el !== modalState.active;
      }).map(function (el) {
        return {
          el: el,
          ariaHidden: el.getAttribute('aria-hidden'),
          inert: 'inert' in el ? el.inert : el.hasAttribute('inert')
        };
      });
      modalState.inerted.forEach(function (item) {
        item.el.setAttribute('aria-hidden', 'true');
        if ('inert' in item.el) item.el.inert = true; else item.el.setAttribute('inert', '');
      });
    } else {
      modalState.inerted.forEach(function (item) {
        if (item.ariaHidden === null) item.el.removeAttribute('aria-hidden');
        else item.el.setAttribute('aria-hidden', item.ariaHidden);
        if ('inert' in item.el) item.el.inert = item.inert;
        else if (item.inert) item.el.setAttribute('inert', '');
        else item.el.removeAttribute('inert');
      });
      modalState.inerted = [];
    }
  }
  function modalKeydown(e) {
    if (!modalState.active) return;
    if (e.key === 'Escape') {
      if (modalState.active === drawer) closeStratumDrawer();
      else closeLightbox();
      return;
    }
    if (e.key !== 'Tab') return;
    var focusable = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', modalState.active)
      .filter(function (el) { return !el.disabled && el.getAttribute('aria-hidden') !== 'true'; });
    if (!focusable.length) return;
    var first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function openModal(el, opener) {
    modalState.active = el;
    modalState.opener = opener || document.activeElement;
    setModalBackground(true);
    document.addEventListener('keydown', modalKeydown);
  }
  function closeModal(el) {
    if (modalState.active !== el) return;
    document.removeEventListener('keydown', modalKeydown);
    setModalBackground(false);
    var opener = modalState.opener;
    modalState.active = null;
    modalState.opener = null;
    if (opener && opener.isConnected && opener.focus) opener.focus();
  }

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
      return '<button type="button" class="mm-depth-tick mono' + (i === 0 ? ' is-active' : '') + '" data-section="' + s.id + '" style="top:' + topPct + '%" aria-label="Go to ' + s.label + ', ' + s.depth + '">' + shortDepth + '</button>';
    }).join('');

    depthRod.innerHTML =
      '<div class="mm-depth-rod__track">' +
        '<button type="button" class="mm-depth-rod__bead" id="mm-depth-bead" title="Tap to open stratum jump drawer" aria-label="Open stratum navigation drawer"></button>' +
      '</div>' +
      '<div class="mm-depth-rod__ticks">' + ticksHtml + '</div>';

    document.body.appendChild(depthRod);

    /* Same core column as the desktop gauge, one scale down — band
       proportions come from the shared SECTIONS manifest via script.js. */
    var rodTrack = $('.mm-depth-rod__track', depthRod);
    if (rodTrack && window.__coreColumnGradient) {
      rodTrack.style.backgroundImage = window.__coreColumnGradient;
    }

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
  function buildStratumDrawer() {
    if (document.querySelector('.mm-drawer')) return;
    drawer = document.createElement('div');
    drawer.className = 'mm-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-labelledby', 'mm-drawer-title');

    var listHtml = sections.map(function (s, i) {
      var num = i < 10 ? '0' + i : String(i);
      return '<li class="mm-drawer__item">' +
        '<a href="#' + s.id + '" class="mm-drawer__link mono' + (i === 0 ? ' is-active' : '') + '" data-section="' + s.id + '">' +
          sigilSvg(s.id, s.core) +
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
          '<span class="mm-drawer__title mono" id="mm-drawer-title">CORE SAMPLE DRILL · 9 STRATA</span>' +
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

  }

  function openStratumDrawer() {
    if (!drawer) return;
    drawer.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    openModal(drawer, document.activeElement);
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
    closeModal(drawer);
  }

  /* ── Fullscreen Architecture SVG Lightbox Modal ─────────── */
  var lightbox = null, lightboxImg = null, lightboxCaption = null;
  function buildLightbox() {
    if (document.querySelector('.mm-lightbox')) return;
    lightbox = document.createElement('div');
    lightbox.className = 'mm-lightbox';
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-labelledby', 'mm-lightbox-title');

    /* No src on the img until one is assigned: an empty src attribute
       resolves against the document URL and some browsers fetch it. */
    lightbox.innerHTML =
      '<div class="mm-lightbox__backdrop"></div>' +
      '<div class="mm-lightbox__content">' +
        '<div class="mm-lightbox__header">' +
          '<span class="mm-lightbox__title mono" id="mm-lightbox-title">SYSTEM ARCHITECTURE · INSPECT</span>' +
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
    lightboxImg.alt = altText || 'System architecture diagram';
    lightboxImg.src = imgSrc;
    if (lightboxCaption) lightboxCaption.textContent = captionText || 'High-resolution system architecture specification.';
    lightbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    openModal(lightbox, opener);
    /* role=dialog + aria-modal without moving focus strands keyboard/screen-
       reader users on the page behind the modal. */
    var closeBtn = $('.mm-lightbox__close', lightbox);
    if (closeBtn) closeBtn.focus();
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('is-open');
    document.body.style.removeProperty('overflow');
    closeModal(lightbox);
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

    /* Living favicon follows the descent here too (hero restores the
       authored beacon; the swap function is owned by script.js). */
    if (typeof window.__groundTruthFavicon === 'function') {
      window.__groundTruthFavicon(sec);
    }

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
    /* A late layout settle (images/fonts) changes the bead's travel range —
       re-aim the spring so it lands where the document now says it should. */
    if (typeof beadTravelTarget === 'function') {
      beadTarget = beadTravelTarget(docProgress);
      beadWake();
    }
  }
  window.addEventListener('resize', refreshScrollMetrics, { passive: true });
  /* scrollHeight keeps growing as below-fold images/fonts settle — without
     these the bead's travel range is computed from a half-laid-out page. */
  window.addEventListener('load', refreshScrollMetrics);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refreshScrollMetrics);

  /* Bead spring: the rod bead chases a target with a lightly damped spring
     instead of tracking raw scroll 1:1 — a fast flick overshoots a few px,
     then the bead seats with a velocity-scaled squash. Real instruments
     have inertia, and mobile is where touch velocity is highest. The
     desktop gauge is excluded by design: its marker rides ScrollTrigger's
     scrub, and a spring after scrubbing is lag-on-lag. dtN normalizes to
     60fps so 120Hz phones get identical physics. */
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
    var dtN = Math.min(dt / 16.666, 3); // cap huge gaps (background-tab resume)
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
      beadTarget = beadTravelTarget(docProgress);
      beadWake();
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

  /* Section sigil dash-draw — the same ~400ms stroke-draw as the seismic
     wave, fired from each section choreo's prep/play. Default state is
     fully drawn, so sections without a choreo (or above the fold at load)
     never hide anything. */
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

  /* Sigils draw on their OWN label's entry, not the section choreo's: the
     label sits at the section top while the choreo root (stage, pipeline,
     terminal) may still be below the fold — tying them left a hidden glyph
     next to already-visible text on a slow read. */
  var sigilIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      sigilIO.unobserve(e.target);
      var sec = e.target.closest('.stratum');
      if (sec) drawSigil(sec.id);
    });
  }, { rootMargin: '0px 0px -10% 0px' });

  $$('.stratum__label').forEach(function (label) {
    var sec = label.closest('.stratum');
    if (!sec) return;
    if (belowViewport(label)) {
      prepSigil(sec.id);
      sigilIO.observe(label);
    }
  });

  /* ── Choreography System with State Reset ─────────────────── */
  var CHOREO = [];
  var CHOREO_MAP = {}; // id -> { prep, play }

  function registerChoreo(id, rootEl, prep, play) {
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

  /* ── Architecture Figure Wiring (tap-to-inspect lightbox) ──
     R3: the dual-mode tab bar and its instrument wrapper are gone — the
     apparatus stage and the architecture figure now stack vertically in
     the ≤767px visual (see style.css), both visible without a swipe.
     What remains is the direct tap-to-inspect on the figure itself. */
  function setupProjectArchInspect(sectionId) {
    var sec = document.getElementById(sectionId);
    if (!sec) return;
    var visual = $('.stratum__visual', sec);
    if (!visual) return;

    var archFig = $('.arch-figure', visual);
    if (!archFig) return;

    var archImg = $('img', archFig);
    var figCap = $('figcaption', archFig);
    var imgSrc = archImg ? archImg.src : '';
    var altText = archImg ? archImg.alt : '';
    var captionText = figCap ? figCap.textContent : '';

    archFig.style.cursor = 'pointer';
    archFig.setAttribute('role', 'button');
    archFig.setAttribute('tabindex', '0');
    archFig.setAttribute('aria-label', 'Inspect high-resolution architecture diagram');
    function inspectFigure() {
      openArchLightbox(imgSrc, captionText, altText, archFig);
    }
    archFig.addEventListener('click', inspectFigure);
    archFig.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      inspectFigure();
    });
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
    registerChoreo('searchlight', stageEl, prep, play);
    setupProjectArchInspect('perception');
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
    registerChoreo('seam', stageEl, prep, play);
    setupProjectArchInspect('training');
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
    registerChoreo('pipeline', pipeline, prep, play);
    setupProjectArchInspect('infrastructure');
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
    registerChoreo('terminal', terminal, prep, play);
    setupProjectArchInspect('interface');
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
    registerChoreo('journey', track, prep, play);
  })();

  /* Stratum VI: Capabilities */
  (function () {
    var section = $('#skills');
    if (!section) return;
    var capabilities = $$('.capability', section);
    if (!capabilities.length) return;

    function prep() { stage(capabilities); }
    function play() { reveal(capabilities, 110); }
    registerChoreo('capabilities', section, prep, play);

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
    registerChoreo('proof', section, prep, play);
  })();

  /* Stratum VIII: Contact */
  (function () {
    var section = $('#contact');
    var card = section && $('.contact-card', section);
    if (!card) return;
    function prep() { stage([card]); }
    function play() { reveal([card], 0); }
    registerChoreo('contact', card, prep, play);
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

  refreshScrollMetrics();
  docProgress = maxScroll > 0 ? Math.max(0, Math.min(1, window.scrollY / maxScroll)) : 0;
  /* Power-on: on a mid-page reload the bead springs from the top to the
     restored position — the instrument settling into the survey. */
  beadTarget = beadTravelTarget(docProgress);
  beadWake();
  pushToBackground();
})();
