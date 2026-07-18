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
  window.addEventListener('resize', resize, { passive: true });
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
  }
  fillPoints(countForTier(tier));

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
    }

    var linkLength = 110;
    var linkLengthSquared = linkLength * linkLength;
    var red = Math.round(accent[0]);
    var green = Math.round(accent[1]);
    var blue = Math.round(accent[2]);
    ctx.lineWidth = 1;
    for (i = 0; i < points.length; i++) {
      for (var j = i + 1; j < points.length; j++) {
        var dx = points[i].x - points[j].x;
        var dy = points[i].y - points[j].y;
        var distanceSquared = dx * dx + dy * dy;
        if (distanceSquared > linkLengthSquared) continue;
        var alpha = 0.14 * (1 - distanceSquared / linkLengthSquared);
        ctx.strokeStyle = 'rgba(' + red + ',' + green + ',' + blue + ',' + alpha.toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(points[i].x, points[i].y);
        ctx.lineTo(points[j].x, points[j].y);
        ctx.stroke();
      }
    }

    var pointRed = Math.round(lerp(LIGHT_POINT[0], DARK_POINT[0], darkness));
    var pointGreen = Math.round(lerp(LIGHT_POINT[1], DARK_POINT[1], darkness));
    var pointBlue = Math.round(lerp(LIGHT_POINT[2], DARK_POINT[2], darkness));
    ctx.fillStyle = 'rgba(' + pointRed + ',' + pointGreen + ',' + pointBlue + ',0.35)';
    for (i = 0; i < points.length; i++) {
      ctx.beginPath();
      ctx.arc(points[i].x, points[i].y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function start() {
    if (running) return;
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
    if (document.hidden) stop();
    else start();
  }
  document.addEventListener('visibilitychange', onVisibilityChange);

  window.addEventListener('pagehide', function () {
    stop();
    window.removeEventListener('resize', resize);
    window.removeEventListener('devicetierchange', onTierChange);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }, { once: true });

  document.body.classList.add('has-neural-depth');
  start();
})();
