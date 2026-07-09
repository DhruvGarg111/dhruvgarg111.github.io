(function () {
  'use strict';

  /* ─────────────────────────────────────────────────────────────
     HERO FLOW FIELD — reactive curl-noise survey instrument
     Particles drift through a gradient-noise vector field, coloured
     in coherent regions from the site's survey palette and rendered
     as a live readout: cursor reticle, field telemetry, and vortex
     "samples" on click. Colours are derived from the CSS design
     tokens (--survey terracotta, --validated teal, --datum blue).
     Self-contained, no dependencies.
     ───────────────────────────────────────────────────────────── */

  var canvas = document.getElementById('hero-flow');
  if (!canvas) { return; }

  var ctx = canvas.getContext('2d');
  if (!ctx) { return; }

  var wrap = canvas.parentNode;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Perf: cap particle count by device tier (window.__deviceTier, set
     synchronously in index.html <head> — see the tier-detection script —
     before this defer script ever runs). 760 additive 16-point ribbons is
     the heaviest cost in this module (was ~12k stroke segments/frame before
     the gradient-batching above); low/mid-tier devices don't need the full
     density to read as a coherent flow field. */
  var deviceTier = window.__deviceTier || 'med';
  var hwMaxParticles = deviceTier === 'low' ? 260 : (deviceTier === 'med' ? 420 : 760);

  var config = {
    density: 373,        // px² per particle (lower = more particles) — ~10% denser
    minParticles: 220,
    maxParticles: hwMaxParticles,
    noiseScale: 0.0032,  // spatial frequency of the field (css px)
    timeScale: 0.0015,   // how fast the field morphs
    turn: 2.3,           // field angle = noise * PI * turn
    speed: 1.2,          // base advection speed (css px / frame)
    trail: 16,           // points of motion history per particle (the ribbon length)
    lineWidth: 1.3,

    swirlRadius: 104,    // cursor influence radius (css px)
    swirl: 2.7,          // tangential swirl strength near cursor
    swirlSpeedGain: 0.9, // extra swirl scaled by how fast the cursor moves

    pulseGrow: 3.0,      // vortex ring expansion (css px / frame)
    pulseLife: 64,       // vortex lifetime (frames)
    pulseBand: 26,       // thickness of the impulse ring
    pulseForce: 3.4,     // outward kick imparted by a sample pulse
    maxPulses: 4,

    // Survey palette — brightened from the site's design tokens
    // so it glows on the dark navy panel. Terracotta leads (brand).
    palette: [
      '#E87428', // --survey terracotta (brand)
      '#E8B86D', // warm amber / gold
      '#75C4A4', // --validated teal
      '#82B2E4'  // --datum slate-blue
    ],
    paletteWeights: [42, 27, 17, 14], // brand-forward distribution
    active: '#FF8243',    // hot terracotta near the cursor
    instrument: '#E87428' // reticle / pulse / HUD accent
  };

  var W = 0, H = 0;
  var particles = [];
  var pulses = [];
  var colorLut = [];
  var time = 0;
  var running = false;
  var rafId = 0;
  var useGsapTicker = !!(window.gsap && window.gsap.ticker);
  var visible = true;
  var sampleFlash = 0; // frames remaining on the "SAMPLE" HUD state
  var hudCache = { deg: 0, mag: 0 }; // last-sampled telemetry, reused between throttled HUD updates

  var pointer = { x: 0, y: 0, lastX: 0, lastY: 0, speed: 0, active: false };

  /* Perf: cache the canvas's viewport rect instead of calling
     getBoundingClientRect() inside setPointer() on every mousemove (a forced
     layout read in a hot path that can fire dozens of times per second).
     Refreshed on resize/layout-affecting events and, while the hero can still
     be moving under the depth-engine's intro/exit transform, on scroll via a
     rAF-throttled listener — never synchronously inside the pointer handler. */
  var canvasRect = null;
  function refreshCanvasRect() { canvasRect = canvas.getBoundingClientRect(); }

  /* ── compact gradient (Perlin-style) value noise ── */
  var perm = new Uint8Array(512);
  (function seedNoise() {
    var p = new Uint8Array(256);
    for (var i = 0; i < 256; i++) { p[i] = i; }
    for (var j = 255; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var t = p[j]; p[j] = p[k]; p[k] = t;
    }
    for (var n = 0; n < 512; n++) { perm[n] = p[n & 255]; }
  })();

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function grad(h, x, y) {
    switch (h & 3) {
      case 0: return x + y;
      case 1: return -x + y;
      case 2: return x - y;
      default: return -x - y;
    }
  }
  function noise2(x, y) {
    var X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    var u = fade(x), v = fade(y);
    var aa = perm[perm[X] + Y], ab = perm[perm[X] + Y + 1];
    var ba = perm[perm[X + 1] + Y], bb = perm[perm[X + 1] + Y + 1];
    return lerp(
      lerp(grad(aa, x, y), grad(ba, x - 1, y), u),
      lerp(grad(ab, x, y - 1), grad(bb, x - 1, y - 1), u),
      v
    ); // ~[-1, 1]
  }

  function fieldNoise(x, y) {
    return noise2(x * config.noiseScale, y * config.noiseScale + time);
  }
  function fieldAngle(x, y) {
    return fieldNoise(x, y) * Math.PI * config.turn;
  }

  // Colour lookup honouring the brand-forward weights.
  function buildColorLut() {
    colorLut.length = 0;
    for (var i = 0; i < config.palette.length; i++) {
      for (var k = 0; k < config.paletteWeights[i]; k++) {
        colorLut.push(config.palette[i]);
      }
    }
  }
  // Coherent colour "strata": nearby spawns share a hue via low-freq noise.
  function regionColor(x, y) {
    var rn = noise2(x * config.noiseScale * 0.42 + 31.7, y * config.noiseScale * 0.42 + 11.3);
    var idx = Math.floor((rn * 0.5 + 0.5) * colorLut.length);
    if (idx < 0) { idx = 0; } else if (idx >= colorLut.length) { idx = colorLut.length - 1; }
    return colorLut[idx];
  }

  /* Perf: parse "#rrggbb" → "r,g,b" once per particle spawn (cached on the
     particle) rather than re-parsing every frame — used to build the ribbon's
     gradient stops in drawParticles(). */
  function hexToRgbStr(hex) {
    return parseInt(hex.substr(1, 2), 16) + ',' + parseInt(hex.substr(3, 2), 16) + ',' + parseInt(hex.substr(5, 2), 16);
  }
  var activeRgb = hexToRgbStr(config.active);

  /* ── particles ── */
  function Particle() { this.reset(true); }

  Particle.prototype.reset = function (initial) {
    this.x = Math.random() * W;
    this.y = Math.random() * H;
    this.xs = [this.x]; // motion-history ribbon (x)
    this.ys = [this.y]; // motion-history ribbon (y)
    this.life = initial ? Math.random() * 200 : 0;
    this.maxLife = 90 + Math.random() * 230;
    this.speed = config.speed * (0.65 + Math.random() * 0.9);
    this.color = regionColor(this.x, this.y);
    this.rgb = hexToRgbStr(this.color); // cached parse, reused each frame's gradient build
    this.boost = 0; // cursor-proximity highlight 0..1
  };

  Particle.prototype.step = function () {
    var a = fieldAngle(this.x, this.y);
    var vx = Math.cos(a) * this.speed;
    var vy = Math.sin(a) * this.speed;

    // cursor swirl — particles orbit the cursor, harder when it moves fast
    this.boost *= 0.9;
    if (pointer.active) {
      var dx = this.x - pointer.x;
      var dy = this.y - pointer.y;
      var d2 = dx * dx + dy * dy;
      var r = config.swirlRadius;
      if (d2 < r * r) {
        var d = Math.sqrt(d2) || 0.001;
        var f = (1 - d / r);
        var sw = config.swirl + pointer.speed * config.swirlSpeedGain;
        vx += (-dy / d) * f * sw;
        vy += (dx / d) * f * sw;
        if (f > this.boost) { this.boost = f; }
      }
    }

    // vortex sample pulses — expanding rings that kick particles outward
    for (var i = 0; i < pulses.length; i++) {
      var pl = pulses[i];
      var pdx = this.x - pl.x;
      var pdy = this.y - pl.y;
      var pd = Math.sqrt(pdx * pdx + pdy * pdy) || 0.001;
      var rad = pl.age * config.pulseGrow;
      if (Math.abs(pd - rad) < config.pulseBand) {
        var s = (1 - pl.age / config.pulseLife) * config.pulseForce;
        vx += (pdx / pd) * s + (-pdy / pd) * s * 0.6;
        vy += (pdy / pd) * s + (pdx / pd) * s * 0.6;
        if (s > this.boost) { this.boost = Math.min(1, s); }
      }
    }

    this.x += vx;
    this.y += vy;
    this.life++;

    if (this.x < -2 || this.x > W + 2 || this.y < -2 || this.y > H + 2 || this.life > this.maxLife) {
      this.reset(false); // teleport + fresh ribbon (no streak across the jump)
      return;
    }

    this.xs.push(this.x);
    this.ys.push(this.y);
    if (this.xs.length > config.trail) { this.xs.shift(); this.ys.shift(); }
  };

  function buildParticles() {
    var target = Math.round((W * H) / config.density);
    target = Math.max(config.minParticles, Math.min(config.maxParticles, target));
    particles.length = 0;
    for (var i = 0; i < target; i++) { particles.push(new Particle()); }
  }

  /* ── rendering ── */
  function drawParticles() {
    ctx.clearRect(0, 0, W, H); // ribbons are self-contained; redraw cleanly each frame
    ctx.globalCompositeOperation = 'lighter'; // additive glow on the dark panel
    ctx.lineWidth = config.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var n = p.xs.length;
      if (n < 2) { continue; }

      var fadeIn = Math.sin((p.life / p.maxLife) * Math.PI); // 0→1→0 over lifetime
      var headAlpha = fadeIn * 0.62;
      var rgb = p.rgb;
      if (p.boost > 0.02) {
        headAlpha = Math.min(0.95, headAlpha + p.boost * 0.5);
        if (p.boost > 0.45) { rgb = activeRgb; } // brand terracotta in the active zone
      }
      if (headAlpha < 0.018) { continue; }

      /* Perf: one beginPath/stroke per particle instead of one per trail
         segment (was up to ~15 draw calls/particle → ~12k/frame worst case).
         A gradient along the ribbon reproduces the same tail→head alpha
         taper (t² easing) in a single stroke. */
      var stops = n - 1;
      var grad = ctx.createLinearGradient(p.xs[0], p.ys[0], p.xs[stops], p.ys[stops]);
      for (var j = 0; j < n; j++) {
        var t = j / stops;
        var a = headAlpha * t * t;
        grad.addColorStop(t, 'rgba(' + rgb + ',' + a.toFixed(3) + ')');
      }
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(p.xs[0], p.ys[0]);
      for (var k = 1; k < n; k++) { ctx.lineTo(p.xs[k], p.ys[k]); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawPulses() {
    if (!pulses.length) { return; }
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = config.instrument;
    for (var i = 0; i < pulses.length; i++) {
      var pl = pulses[i];
      var rad = pl.age * config.pulseGrow;
      ctx.globalAlpha = Math.max(0, 1 - pl.age / config.pulseLife) * 0.5;
      ctx.beginPath();
      ctx.arc(pl.x, pl.y, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawReticle() {
    if (!pointer.active) { return; }
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.translate(pointer.x, pointer.y);
    ctx.strokeStyle = config.instrument;
    ctx.lineWidth = 1.2;
    // centre cross
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
    ctx.moveTo(0, -6); ctx.lineTo(0, 6);
    ctx.stroke();
    // ring that widens with cursor speed
    var r = 11 + Math.min(16, pointer.speed * 0.45);
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  /* Perf: this is a telemetry readout, not motion — it doesn't need to redraw
     every frame. Throttled to ~10 fps (below) and no longer sets
     ctx.letterSpacing, which forces extra text-shaping work on every call. */
  var hudFrameInterval = 6; // frames between HUD redraws at ~60fps ≈ 10fps
  var hudFrameCounter = 0;

  function drawHud() {
    // The bar/text canvas is cleared by drawParticles() every frame, so the
    // HUD must still be repainted every frame — throttling only the (more
    // expensive) noise-sample + text recompute, reusing the last values
    // between samples for a visually-continuous but cheaper readout.
    if (hudFrameCounter <= 0) {
      var sx = pointer.active ? pointer.x : W * 0.5;
      var sy = pointer.active ? pointer.y : H * 0.5;
      var raw = fieldNoise(sx, sy);
      hudCache.deg = ((raw * config.turn * 180) % 360 + 360) % 360;
      hudCache.mag = Math.min(1, Math.abs(raw) + pointer.speed * 0.012);
      hudFrameCounter = hudFrameInterval;
    }
    hudFrameCounter--;

    var state = sampleFlash > 0 ? 'SAMPLE' : (pointer.active ? 'SWIRL' : 'SCAN');

    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    var rx = W - 12;

    // state line
    ctx.font = '600 8.5px "Martian Mono", ui-monospace, monospace';
    ctx.fillStyle = config.instrument;
    ctx.globalAlpha = state === 'SAMPLE' ? 1 : 0.92;
    ctx.fillText('▸ ' + state, rx, 20);

    // telemetry line
    ctx.font = '500 7.5px "Martian Mono", ui-monospace, monospace';
    ctx.fillStyle = '#D9D0BC';
    ctx.globalAlpha = 0.6;
    ctx.fillText('θ ' + hudCache.deg.toFixed(0) + '°  |v| ' + hudCache.mag.toFixed(2), rx, 33);

    // field-strength micro-bar
    var bw = 54, bh = 2.5, bx = rx - bw, by = 39;
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#D9D0BC';
    ctx.fillRect(bx, by, bw, bh);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = config.instrument;
    ctx.fillRect(bx, by, bw * hudCache.mag, bh);

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function frame() {
    if (!running) { return; }
    time += config.timeScale;
    pointer.speed *= 0.86;
    if (sampleFlash > 0) { sampleFlash--; }

    // advance / cull pulses
    for (var i = pulses.length - 1; i >= 0; i--) {
      pulses[i].age++;
      if (pulses[i].age > config.pulseLife) { pulses.splice(i, 1); }
    }

    for (var j = 0; j < particles.length; j++) { particles[j].step(); }

    drawParticles();
    drawPulses();
    drawReticle();
    drawHud();

    if (!useGsapTicker) rafId = requestAnimationFrame(frame);
  }

  function startLoop() {
    if (running || reduceMotion || !visible || document.hidden) { return; }
    running = true;
    if (useGsapTicker) {
      window.gsap.ticker.add(frame);
    } else {
      rafId = requestAnimationFrame(frame);
    }
  }

  function stopLoop() {
    running = false;
    if (useGsapTicker) { window.gsap.ticker.remove(frame); }
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  }

  /* ── sizing ── */
  // clientWidth/Height return the CSS *layout* size, which is unaffected by the
  // hero's intro transform (translateZ/scale/perspective). getBoundingClientRect
  // would report the visually-distorted size and cram everything into a corner.
  function measure() {
    var w = wrap.clientWidth;
    var h = wrap.clientHeight;
    if (!w || !h) {
      var r = wrap.getBoundingClientRect();
      w = w || Math.round(r.width);
      h = h || Math.round(r.height);
    }
    return { w: Math.max(1, w), h: Math.max(1, h) };
  }

  function resize() {
    refreshCanvasRect();
    var m = measure();
    if (m.w === W && m.h === H && canvas.width) { return; } // no change → skip rebuild
    W = m.w;
    H = m.h;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    // display size is driven by CSS (inset:0 / 100%); never pin it in px here
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    config.trail = W < 380 ? 11 : 16; // shorter ribbons (less work) on small panels
    buildColorLut();
    buildParticles();
    if (reduceMotion) { bakeStaticFrame(); }
  }

  // Reduced motion: advance the field so ribbons fill out, then freeze one frame.
  function bakeStaticFrame() {
    time = 40;
    for (var s = 0; s < config.trail + 6; s++) {
      for (var i = 0; i < particles.length; i++) { particles[i].step(); }
    }
    drawParticles();
    drawHud();
  }

  /* ── pointer ── */
  function setPointer(clientX, clientY) {
    if (!canvasRect) { refreshCanvasRect(); }
    var nx = clientX - canvasRect.left;
    var ny = clientY - canvasRect.top;
    var dx = nx - pointer.lastX;
    var dy = ny - pointer.lastY;
    pointer.speed = Math.min(60, Math.sqrt(dx * dx + dy * dy));
    pointer.x = nx;
    pointer.y = ny;
    pointer.lastX = nx;
    pointer.lastY = ny;
    pointer.active = true;
  }

  function emitPulse(clientX, clientY) {
    setPointer(clientX, clientY);
    if (pulses.length >= config.maxPulses) { pulses.shift(); }
    pulses.push({ x: pointer.x, y: pointer.y, age: 0 });
    sampleFlash = 40;
    startLoop();
  }

  wrap.addEventListener('mousemove', function (e) { setPointer(e.clientX, e.clientY); startLoop(); }, { passive: true });
  wrap.addEventListener('mouseleave', function () { pointer.active = false; pointer.speed = 0; }, { passive: true });
  wrap.addEventListener('mousedown', function (e) { emitPulse(e.clientX, e.clientY); }, { passive: true });
  wrap.addEventListener('touchstart', function (e) { var t = e.touches[0]; emitPulse(t.clientX, t.clientY); }, { passive: true });
  wrap.addEventListener('touchmove', function (e) { var t = e.touches[0]; setPointer(t.clientX, t.clientY); }, { passive: true });
  wrap.addEventListener('touchend', function () { pointer.active = false; pointer.speed = 0; }, { passive: true });

  var resizeRaf = 0;
  function scheduleResize() {
    if (!resizeRaf) { resizeRaf = requestAnimationFrame(function () { resizeRaf = 0; resize(); }); }
  }
  window.addEventListener('resize', scheduleResize, { passive: true });

  // Perf: the hero panel drifts under the depth-engine's intro/exit transform
  // while scrolling, so its viewport rect can go stale — refresh it at most
  // once per animation frame during scroll (never synchronously per mousemove).
  var rectRaf = 0;
  function scheduleRectRefresh() {
    if (!rectRaf) { rectRaf = requestAnimationFrame(function () { rectRaf = 0; refreshCanvasRect(); }); }
  }
  window.addEventListener('scroll', scheduleRectRefresh, { passive: true });

  // Re-fit when the panel's layout box changes (intro settling, fonts, reflow).
  if ('ResizeObserver' in window) {
    var ro = new ResizeObserver(scheduleResize);
    ro.observe(wrap);
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stopLoop(); } else { startLoop(); }
  });

  // Pause when the hero scrolls out of view.
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (visible) { startLoop(); } else { stopLoop(); }
    }, { threshold: 0.05 });
    io.observe(canvas);
  }

  resize(); // bakes a static frame internally when reduceMotion is set
  if (!reduceMotion) {
    startLoop();
  }

  window.addEventListener('pagehide', function () {
    stopLoop();
    if (resizeRaf) {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = 0;
    }
    if (rectRaf) {
      cancelAnimationFrame(rectRaf);
      rectRaf = 0;
    }
    if (ro) ro.disconnect();
    if (io) io.disconnect();
  }, { once: true });
})();
