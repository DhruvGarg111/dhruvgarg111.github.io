(function () {
  'use strict';

  /* Lightweight canvas2d ambient background for window.__bgMode === 'lite'
     (touch/no-hover devices and low-tier PCs). It carries the same narrative
     signals as the desktop scene: light/dark palette interpolation,
     per-discipline tint and drift, and connective filaments that make the
     field read as a survey network rather than confetti. The budget remains
     intentionally modest: tier-based point counts, DPR <= 1.25, a 30fps cap,
     a bounded O(n^2) link pass, and no work while the page is hidden. */

  var canvas = document.getElementById('neural-bg-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var W = 0;
  var H = 0;
  var dpr = Math.min(window.devicePixelRatio || 1, 1.25);
  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function onResize() { resize(); assignLattice(); }
  window.addEventListener('resize', onResize, { passive: true });
  resize();

  function countForTier(tier) {
    return tier === 'low' ? 28 : tier === 'high' ? 64 : 46;
  }

  var tier = window.__deviceTier || 'med';
  var points = [];
  function fillPoints(count) {
    while (points.length > count) points.pop();
    while (points.length < count) {
      points.push({
        x: Math.random() * W,
        y: Math.random() * H,
        angle: Math.random() * Math.PI * 2,
      });
    }
    assignLattice();
  }

  /* 2D analogue of the WebGL boot morph: the field starts as an even grid and
     eases out to each point's own drifting home. Same latch contract as
     neural-background.js — this module is lazy-loaded, so hero:surface-lock
     may already have fired by the time it runs. */
  var MORPH_MS = 1800;
  /* Same reason as the WebGL path: surface-lock fires while the loader is
     still clearing, so morphing immediately means morphing under the veil
     where nobody sees it. Shorter than the WebGL figure — this renderer is
     2D, capped at 30fps, and runs on the weakest devices, so the gesture is
     kept tighter rather than mirrored exactly. */
  var MORPH_DELAY_MS = 1200;
  var morphT = 1;
  var morphStartedAt = 0;
  var morphState = 'off'; // 'off' | 'armed' | 'running' | 'done'
  var morphEnabled = tier !== 'low';
  function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  /* See neural-background.js: `visibilitychange` never fires for a document
     that loaded already-hidden, so a tab opened in the background would run
     the morph to completion before anyone looked at it. Discount hidden time
     from the morph clock and keep the loop parked while hidden. */
  var hiddenSince = document.hidden ? nowMs() : 0;
  var hiddenTotal = 0;

  function assignLattice() {
    if (!morphEnabled) return;
    var cols = Math.max(1, Math.ceil(Math.sqrt(points.length * (W / Math.max(1, H)))));
    var rows = Math.max(1, Math.ceil(points.length / cols));
    for (var i = 0; i < points.length; i++) {
      points[i].lx = ((i % cols) + 0.5) * (W / cols);
      points[i].ly = (Math.floor(i / cols) + 0.5) * (H / rows);
    }
  }

  function beginMorph() {
    if (morphState !== 'armed') return;
    morphStartedAt = nowMs();
    morphState = 'running';
  }

  function stepMorph() {
    if (morphState !== 'running') return;
    var now = nowMs();
    var age = (now - morphStartedAt - hiddenTotal) - MORPH_DELAY_MS;
    if (age < 0) return;
    var raw = Math.min(1, age / MORPH_MS);
    morphT = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
    if (raw >= 1) { morphState = 'done'; morphT = 1; }
  }

  fillPoints(countForTier(tier));

  if (morphEnabled) {
    morphT = 0;
    morphState = 'armed';
    if (window.__surfaceLocked) {
      beginMorph();
    } else {
      window.addEventListener('hero:surface-lock', beginMorph, { once: true });
      setTimeout(beginMorph, 3000);
    }
  }

  function onTierChange(event) {
    var nextTier = event.detail && event.detail.tier;
    if (!nextTier) return;
    tier = nextTier;
    fillPoints(countForTier(tier));
  }
  window.addEventListener('devicetierchange', onTierChange);

  var SEG_ACCENT = {
    perception: [224, 90, 22],
    training: [130, 178, 228],
    infra: [30, 123, 101],
    interface: [250, 168, 35],
  };
  var SEG_DRIFT = { perception: 1.3, training: 0.6, infra: 1, interface: 0.85 };
  var LIGHT_POINT = [30, 123, 101];
  var DARK_POINT = [143, 212, 184];

  var progress = 0;
  var darkness = 0;
  var darknessTarget = 0;
  var accent = LIGHT_POINT.slice();
  var accentTarget = LIGHT_POINT.slice();
  var drift = 1;
  var driftTarget = 1;

  /* Keep the public renderer hooks identical to neural-background.js. */
  window.__neuralSetSections = function () {};
  window.__neuralSetProgress = function (nextProgress, section) {
    progress = Math.max(0, Math.min(1, nextProgress));
    darknessTarget = section && (section.atmosphereDark || section.dark) ? 1 : 0;
    var segment = section && section.seg;
    accentTarget = (segment && SEG_ACCENT[segment]) || LIGHT_POINT;
    driftTarget = (segment && SEG_DRIFT[segment]) || 1;
  };

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  var running = false;
  var rafId = 0;
  var lastTime = 0;
  var accumulated = 0;
  var FRAME_MS = 33;

  /* Alpha-bucketed link batching — see the link pass in tick(). */
  var LINK_LENGTH_SQ = 110 * 110;
  var LINK_BUCKETS = 8;
  var linkSegs = [];
  var linkLens = new Int32Array(LINK_BUCKETS);
  for (var lb = 0; lb < LINK_BUCKETS; lb++) { linkSegs.push([]); }

  function tick(time) {
    if (!running) return;
    rafId = requestAnimationFrame(tick);

    var delta = Math.min(66, time - (lastTime || time));
    lastTime = time;
    accumulated += delta;
    if (accumulated < FRAME_MS) return;
    delta = accumulated;
    accumulated = 0;

    darkness = lerp(darkness, darknessTarget, 0.06);
    drift = lerp(drift, driftTarget, 0.06);
    for (var channel = 0; channel < 3; channel++) {
      accent[channel] = lerp(accent[channel], accentTarget[channel], 0.06);
    }

    stepMorph();

    ctx.clearRect(0, 0, W, H);

    for (var i = 0; i < points.length; i++) {
      var point = points[i];
      point.angle += 0.0009 * delta * drift * (0.6 + 0.4 * Math.sin(point.x * 0.002 + progress * 6));
      point.x += Math.cos(point.angle) * 0.18 * delta * drift;
      point.y += Math.sin(point.angle) * 0.18 * delta * drift;
      if (point.x < 0) point.x += W;
      if (point.x > W) point.x -= W;
      if (point.y < 0) point.y += H;
      if (point.y > H) point.y -= H;
      /* Drawn position during the boot morph; identical to x/y once resolved.
         The simulation itself always runs on x/y, so nothing downstream has to
         know the morph exists. */
      point.dx = morphT >= 1 ? point.x : lerp(point.lx, point.x, morphT);
      point.dy = morphT >= 1 ? point.y : lerp(point.ly, point.y, morphT);
    }

    /* Link pass. The pair scan is inherently O(n²) (64 points → 2016 pairs at
       tier high), but the *drawing* used to be too: a fresh rgba() string plus
       its own beginPath/stroke per pair, up to ~60k string builds/sec — on the
       weakest devices in the fleet, which are exactly the ones routed here.
       Segments are binned into LINK_BUCKETS alpha levels and each bucket is
       stroked as one path, so the per-frame cost is 8 strings and 8 strokes
       regardless of point count. At a 0.14 alpha ceiling the quantisation is
       not perceivable. The bucket arrays are reused across frames — the length
       counters reset, the backing storage does not reallocate. */
    var red = Math.round(accent[0]);
    var green = Math.round(accent[1]);
    var blue = Math.round(accent[2]);
    ctx.lineWidth = 1;
    for (var b = 0; b < LINK_BUCKETS; b++) { linkLens[b] = 0; }
    for (i = 0; i < points.length; i++) {
      var pi = points[i];
      for (var j = i + 1; j < points.length; j++) {
        var pj = points[j];
        var dx = pi.dx - pj.dx;
        var dy = pi.dy - pj.dy;
        var distanceSquared = dx * dx + dy * dy;
        if (distanceSquared > LINK_LENGTH_SQ) continue;
        var strength = 1 - distanceSquared / LINK_LENGTH_SQ;
        var bucket = strength >= 1 ? LINK_BUCKETS - 1 : (strength * LINK_BUCKETS) | 0;
        var seg = linkSegs[bucket];
        var at = linkLens[bucket];
        seg[at] = pi.dx; seg[at + 1] = pi.dy; seg[at + 2] = pj.dx; seg[at + 3] = pj.dy;
        linkLens[bucket] = at + 4;
      }
    }
    for (b = 0; b < LINK_BUCKETS; b++) {
      var used = linkLens[b];
      if (!used) continue;
      var alpha = 0.14 * ((b + 0.5) / LINK_BUCKETS) * morphT;
      if (alpha < 0.002) continue;
      ctx.strokeStyle = 'rgba(' + red + ',' + green + ',' + blue + ',' + alpha.toFixed(3) + ')';
      ctx.beginPath();
      var sa = linkSegs[b];
      for (var s = 0; s < used; s += 4) {
        ctx.moveTo(sa[s], sa[s + 1]);
        ctx.lineTo(sa[s + 2], sa[s + 3]);
      }
      ctx.stroke();
    }

    var pointRed = Math.round(lerp(LIGHT_POINT[0], DARK_POINT[0], darkness));
    var pointGreen = Math.round(lerp(LIGHT_POINT[1], DARK_POINT[1], darkness));
    var pointBlue = Math.round(lerp(LIGHT_POINT[2], DARK_POINT[2], darkness));
    ctx.fillStyle = 'rgba(' + pointRed + ',' + pointGreen + ',' + pointBlue + ',' + (0.35 * (0.4 + 0.6 * morphT)).toFixed(3) + ')';
    for (i = 0; i < points.length; i++) {
      ctx.beginPath();
      ctx.arc(points[i].dx, points[i].dy, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function start() {
    if (running || document.hidden) return;
    running = true;
    lastTime = 0;
    accumulated = 0;
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function onVisibilityChange() {
    if (document.hidden) {
      if (!hiddenSince) hiddenSince = nowMs();
      stop();
    } else {
      if (hiddenSince) { hiddenTotal += nowMs() - hiddenSince; hiddenSince = 0; }
      start();
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange);

  window.addEventListener('pagehide', function () {
    stop();
    window.removeEventListener('resize', onResize);
    window.removeEventListener('devicetierchange', onTierChange);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }, { once: true });

  document.body.classList.add('has-neural-depth');
  start();
})();
