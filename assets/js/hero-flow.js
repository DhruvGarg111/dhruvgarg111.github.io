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

  /* devicetierchange fires after this module's already built its particle
     pool from the boot-time tier. config.maxParticles is only consulted
     inside buildParticles() (at resize() time, which early-returns if W/H
     haven't changed) — it isn't read per-frame — so a live tier drop needs
     an explicit buildParticles() call here, not just a config write, or
     the pool silently stays at its original size. */
  function handleDeviceTierChange(e) {
    var t = e.detail && e.detail.tier;
    if (!t) return;
    deviceTier = t;
    hwMaxParticles = t === 'low' ? 260 : (t === 'med' ? 420 : 760);
    config.maxParticles = hwMaxParticles;
    config.resolve = t !== 'low'; // low tier stays coarse-only
    buildParticles();
  }
  window.addEventListener('devicetierchange', handleDeviceTierChange);

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
    instrument: '#E87428', // reticle / pulse / HUD accent

    /* ── Searchlight resolve (coarse→fine) — the hero's signature behaviour ──
       The ambient field renders coarse (dim/soft, coarseAlpha); within the
       reticle's radius particles "resolve" — brighter, sharper, wider stroke —
       and the resolve value decays slowly so a wake of focus trails the moving
       searchlight. Mirrors the site's flagship coarse-to-fine detection work.
       coarseAlpha/fineAlpha correspond to the --field-coarse/--field-fine
       design values (kept here as render scalars, not colour tokens). */
    resolve: deviceTier !== 'low', // disabled on low tier — coarse field only
    coarseAlpha: 0.42,   // ambient (unresolved) head-alpha  → CSS --field-coarse
    fineAlpha: 0.78,     // fully-resolved head-alpha         → CSS --field-fine
    resolveRadius: 150,  // searchlight sensing radius (css px) — wider than the swirl
    resolveDecay: 0.94,  // per-frame resolve persistence → focus wake trails the reticle
    clusterFull: 13,     // resolved-particle count in a bin that reads as density 1.00
    reticle: '#F0A868'   // searchlight ring — mirrors --reticle, brightened for the dark panel
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
  var surfaceLockTimer = 0;

  var TAU = Math.PI * 2;

  /* Searchlight reticle — the resolve source. On devices with a fine hovering
     pointer it follows the cursor; on touch (no hover) it auto-sweeps a slow
     Lissajous path so the coarse→fine effect is communicative without any
     interaction (§6.4 beat 6). */
  var hasHover = window.matchMedia('(any-hover: hover) and (any-pointer: fine)').matches;
  var autoSweep = !hasHover && !reduceMotion;
  var reticle = { x: 0, y: 0, active: false };
  var sweepPhase = 0;
  var SWEEP_SPEED = 0.0131; // ~8s per Lissajous loop at 60fps

  /* Densest-cluster detector for the resolve bracket: a BIN×BIN grid over the
     reticle's resolve square, repopulated each frame from resolved particle
     heads during draw. The densest bin's AABB becomes the bracket; its count
     (normalised by clusterFull) is the honest local-density tag — not an ML score. */
  var BIN = 4;
  var bins = new Array(BIN * BIN);
  for (var bi = 0; bi < bins.length; bi++) { bins[bi] = { n: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 }; }
  var bracket = { active: false, x0: 0, y0: 0, x1: 0, y1: 0, density: 0 };

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

  // Colour lookup honouring the brand-forward weights. Holds *indices* into
  // config.palette, not hex strings, so a particle can key straight into the
  // precomputed rgba table below.
  function buildColorLut() {
    colorLut.length = 0;
    for (var i = 0; i < config.palette.length; i++) {
      for (var k = 0; k < config.paletteWeights[i]; k++) {
        colorLut.push(i);
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

  function hexToRgbStr(hex) {
    return parseInt(hex.substr(1, 2), 16) + ',' + parseInt(hex.substr(3, 2), 16) + ',' + parseInt(hex.substr(5, 2), 16);
  }

  /* Perf: every colour a ribbon can ever be drawn in comes from a fixed
     five-entry set (the four palette hues plus the hot active highlight), and
     canvas compositing is 8-bit, so the complete set of rgba() strings the
     renderer can ever need is finite and small. Build all 5x256 of them once.

     Before this, drawParticles() built a fresh 'rgba(r,g,b,a)' string — with a
     toFixed(3) inside it — for every gradient stop of every particle of every
     frame: ~400k string allocations per second on a full pool, roughly 10MB/s
     of garbage, plus a CSS colour parse per stop. Now it is an array index. */
  var RGBA_LUT = (function () {
    var sources = config.palette.concat([config.active]);
    var table = new Array(sources.length);
    for (var c = 0; c < sources.length; c++) {
      var rgb = hexToRgbStr(sources[c]);
      var row = new Array(256);
      for (var a = 0; a < 256; a++) { row[a] = 'rgba(' + rgb + ',' + (a / 255).toFixed(3) + ')'; }
      table[c] = row;
    }
    return table;
  })();
  var ACTIVE_CI = config.palette.length; // index of config.active within RGBA_LUT
  function rgbaFor(ci, alpha) {
    var step = alpha <= 0 ? 0 : (alpha >= 1 ? 255 : (alpha * 255 + 0.5) | 0);
    return RGBA_LUT[ci][step];
  }

  /* ── particles ──
     The motion-history ribbon is a fixed-capacity ring buffer, not a pair of
     plain arrays. The old form pushed and then shift()ed every frame, which is
     O(trail) element moves per particle per frame (~690k/s on a full pool),
     and reset() reallocated both arrays on every respawn. Capacity equals
     config.trail; the pool is rebuilt whenever that changes (resize()), so
     trailCap and the buffers never disagree. */
  var trailCap = config.trail;

  function Particle() { this.reset(true); }

  Particle.prototype.reset = function (initial) {
    this.x = Math.random() * W;
    this.y = Math.random() * H;
    if (!this.tx || this.tx.length !== trailCap) {
      this.tx = new Float32Array(trailCap);
      this.ty = new Float32Array(trailCap);
    }
    this.tx[0] = this.x;
    this.ty[0] = this.y;
    this.n = 1;      // valid points in the ring
    this.head = 1;   // next write slot (trailCap is always >= 11)
    this.life = initial ? Math.random() * 200 : 0;
    this.maxLife = 90 + Math.random() * 230;
    this.speed = config.speed * (0.65 + Math.random() * 0.9);
    this.ci = regionColor(this.x, this.y); // palette index into RGBA_LUT
    this.boost = 0; // cursor-proximity highlight 0..1
    this.resolve = 0; // searchlight resolve 0..1 (coarse→fine); decays for the wake
  };

  Particle.prototype.step = function () {
    var a = fieldAngle(this.x, this.y);
    var vx = Math.cos(a) * this.speed;
    var vy = Math.sin(a) * this.speed;

    // searchlight resolve — particles inside the reticle radius sharpen; the
    // value decays slowly so focus lingers as a wake behind the moving reticle.
    this.resolve *= config.resolveDecay;
    if (config.resolve && reticle.active) {
      var rdx = this.x - reticle.x;
      var rdy = this.y - reticle.y;
      var rr = config.resolveRadius;
      var rd2 = rdx * rdx + rdy * rdy;
      if (rd2 < rr * rr) {
        var rf = 1 - Math.sqrt(rd2) / rr;
        if (rf > this.resolve) { this.resolve = rf; }
      }
    }

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

    this.tx[this.head] = this.x;
    this.ty[this.head] = this.y;
    this.head++; if (this.head >= trailCap) { this.head = 0; }
    if (this.n < trailCap) { this.n++; }
  };

  function buildParticles() {
    var target = Math.round((W * H) / config.density);
    target = Math.max(config.minParticles, Math.min(config.maxParticles, target));
    trailCap = config.trail; // must precede construction — reset() sizes the rings from it
    particles.length = 0;
    for (var i = 0; i < target; i++) { particles.push(new Particle()); }
    publishFieldTelemetry();
  }

  /* The plate's top rail carries the field readout as real DOM text — legible,
     selectable, and translatable, unlike the sub-pixel canvas glyphs it used to
     be drawn as. Both values are actual runtime state (the live tier and the
     pool this device actually built), never a decorative constant. */
  var railFieldEl = document.getElementById('hero-rail-field');
  function publishFieldTelemetry() {
    if (!railFieldEl) { return; }
    railFieldEl.textContent = 'FIELD · ' + deviceTier.toUpperCase() + ' · ' + particles.length + 'PTS';
  }

  /* ── rendering ── */
  function drawParticles() {
    ctx.clearRect(0, 0, W, H); // ribbons are self-contained; redraw cleanly each frame
    ctx.globalCompositeOperation = 'lighter'; // additive glow on the dark panel
    ctx.lineWidth = config.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Resolve-bracket binning: reset the grid over the reticle's resolve square.
    var accumBins = config.resolve && reticle.active;
    var binX0 = reticle.x - config.resolveRadius;
    var binY0 = reticle.y - config.resolveRadius;
    var binSize = (config.resolveRadius * 2) / BIN;
    if (accumBins) {
      for (var bz = 0; bz < bins.length; bz++) { bins[bz].n = 0; }
    }

    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var n = p.n;
      if (n < 2) { continue; }

      var fadeIn = Math.sin((p.life / p.maxLife) * Math.PI); // 0→1→0 over lifetime
      var res = p.resolve;
      // coarse baseline → fine near the reticle: the visible coarse-to-fine sweep
      var headAlpha = fadeIn * (config.coarseAlpha + (config.fineAlpha - config.coarseAlpha) * res);
      var ci = p.ci;
      if (p.boost > 0.02) {
        headAlpha = Math.min(0.96, headAlpha + p.boost * 0.45);
        if (p.boost > 0.45) { ci = ACTIVE_CI; } // brand terracotta in the active zone
      }
      if (headAlpha < 0.018) { continue; }

      var tx = p.tx, ty = p.ty;
      var tail = p.head - n; if (tail < 0) { tail += trailCap; }
      var headIdx = p.head - 1; if (headIdx < 0) { headIdx += trailCap; }
      var x0 = tx[tail], y0 = ty[tail];
      var hx = tx[headIdx], hy = ty[headIdx];

      /* Perf: one beginPath/stroke per particle instead of one per trail
         segment (was up to ~15 draw calls/particle → ~12k/frame worst case).
         A gradient along the ribbon reproduces the same tail→head alpha
         taper (t² easing) in a single stroke.

         Five stops, not one per trail point. The gradient axis is the straight
         tail→head chord either way; the stops only sample the t² curve along
         it, and piecewise-linear interpolation across quarters is within
         0.008 of true t² — under 2/255 of alpha at the maximum head value, so
         below what 8-bit compositing can represent. Sixteen stops cost 3x the
         colour parses to describe the same ramp. */
      // resolve widens the ribbon slightly — sharpness is density+width, not new colour
      ctx.lineWidth = config.lineWidth + res * 0.7;
      var grad = ctx.createLinearGradient(x0, y0, hx, hy);
      grad.addColorStop(0, RGBA_LUT[ci][0]);
      grad.addColorStop(0.25, rgbaFor(ci, headAlpha * 0.0625));
      grad.addColorStop(0.5, rgbaFor(ci, headAlpha * 0.25));
      grad.addColorStop(0.75, rgbaFor(ci, headAlpha * 0.5625));
      grad.addColorStop(1, rgbaFor(ci, headAlpha));
      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      var ri = tail + 1; if (ri >= trailCap) { ri = 0; }
      for (var k = 1; k < n; k++) {
        ctx.lineTo(tx[ri], ty[ri]);
        ri++; if (ri >= trailCap) { ri = 0; }
      }
      ctx.stroke();

      // Accumulate resolved heads into the density grid for the bracket detector
      if (accumBins && res > 0.25) {
        var bxi = Math.floor((hx - binX0) / binSize);
        var byi = Math.floor((hy - binY0) / binSize);
        if (bxi >= 0 && bxi < BIN && byi >= 0 && byi < BIN) {
          var b = bins[bxi + byi * BIN];
          if (b.n === 0) { b.minX = b.maxX = hx; b.minY = b.maxY = hy; }
          else {
            if (hx < b.minX) { b.minX = hx; } if (hx > b.maxX) { b.maxX = hx; }
            if (hy < b.minY) { b.minY = hy; } if (hy > b.maxY) { b.maxY = hy; }
          }
          b.n++;
        }
      }
    }
    ctx.lineWidth = config.lineWidth; // restore default for subsequent draw calls

    // Find densest bin → bracket AABB + honest local-density tag
    bracket.active = false;
    if (accumBins) {
      var best = -1, bestN = 0;
      for (var bq = 0; bq < bins.length; bq++) {
        if (bins[bq].n > bestN) { bestN = bins[bq].n; best = bq; }
      }
      if (bestN >= 3) {
        var bb = bins[best];
        var pad = 6;
        bracket.x0 = bb.minX - pad; bracket.y0 = bb.minY - pad;
        bracket.x1 = bb.maxX + pad; bracket.y1 = bb.maxY + pad;
        bracket.density = Math.min(1, bestN / config.clusterFull);
        bracket.active = true;
      }
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
    if (!reticle.active) { return; }
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.translate(reticle.x, reticle.y);
    ctx.strokeStyle = config.reticle;
    ctx.lineWidth = 1.2;
    // centre cross
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
    ctx.moveTo(0, -6); ctx.lineTo(0, 6);
    ctx.stroke();
    // searchlight ring — widens with cursor speed
    var r = 11 + Math.min(16, pointer.speed * 0.45);
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.stroke();
    // outer resolve-radius ring (faint) — shows the searchlight sensing boundary
    if (config.resolve) {
      ctx.globalAlpha = 0.08;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(0, 0, config.resolveRadius, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();

    // resolve bracket — snaps to the densest resolved cluster (AABB)
    if (bracket.active) {
      var bx0 = bracket.x0, by0 = bracket.y0, bx1 = bracket.x1, by1 = bracket.y1;
      var bw = bx1 - bx0, bh = by1 - by0;
      if (bw > 4 && bh > 4) {
        var arm = Math.min(10, bw * 0.28, bh * 0.28);
        ctx.save();
        ctx.strokeStyle = config.reticle;
        ctx.lineWidth = 1.4;
        ctx.globalAlpha = 0.55 + bracket.density * 0.35; // brighter when denser
        ctx.beginPath();
        // TL
        ctx.moveTo(bx0 + arm, by0); ctx.lineTo(bx0, by0); ctx.lineTo(bx0, by0 + arm);
        // TR
        ctx.moveTo(bx1 - arm, by0); ctx.lineTo(bx1, by0); ctx.lineTo(bx1, by0 + arm);
        // BR
        ctx.moveTo(bx1, by1 - arm); ctx.lineTo(bx1, by1); ctx.lineTo(bx1 - arm, by1);
        // BL
        ctx.moveTo(bx0 + arm, by1); ctx.lineTo(bx0, by1); ctx.lineTo(bx0, by1 - arm);
        ctx.stroke();
        // density tag — honest local-particle count, not a fake ML score
        ctx.font = '500 7px "Martian Mono", ui-monospace, monospace';
        ctx.fillStyle = config.reticle;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.globalAlpha = 0.75;
        ctx.fillText('field ' + bracket.density.toFixed(2), bx0, by0 - 3);
        ctx.restore();
      }
    }

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

    var state = sampleFlash > 0 ? 'SAMPLE' : (reticle.active ? (config.resolve ? 'RESOLVE' : 'SCAN') : 'SCAN');

    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    var rx = W - 12;

    // state line
    ctx.font = '600 10px "Martian Mono", ui-monospace, monospace';
    ctx.fillStyle = config.instrument;
    ctx.globalAlpha = state === 'SAMPLE' ? 1 : 0.92;
    ctx.fillText('▸ ' + state, rx, 20);

    // Real field telemetry: angle/magnitude come from the sampled curl field,
    // never a fake ML score. The tier/pool-size line moved to the plate's top
    // rail, where it can be real DOM text instead of sub-pixel canvas glyphs.
    ctx.font = '500 9px "Martian Mono", ui-monospace, monospace';
    ctx.fillStyle = '#D9D0BC';
    ctx.globalAlpha = 0.6;
    if ((state === 'RESOLVE' || state === 'SAMPLE') && bracket.active) {
      ctx.fillText((state === 'SAMPLE' ? 'SAMPLE' : 'LOCAL') + ' · field ' + bracket.density.toFixed(2), rx, 34);
    } else {
      ctx.fillText('θ ' + hudCache.deg.toFixed(0) + '°  |v| ' + hudCache.mag.toFixed(2), rx, 34);
    }

    // field-strength micro-bar
    var bw = 54, bh = 2.5, bx = rx - bw, by = 42;
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

    // auto-sweep: Lissajous reticle for touch/no-hover devices (§6.4 beat 6)
    if (autoSweep && W && H) {
      sweepPhase += SWEEP_SPEED;
      reticle.x = W * 0.5 + Math.sin(sweepPhase * 1.0) * W * 0.32;
      reticle.y = H * 0.5 + Math.sin(sweepPhase * 1.6) * H * 0.28;
      reticle.active = true;
    }

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

  // Reduced motion: place reticle at centre, advance field to fill out ribbons,
  // then freeze one fully-resolved frame — static but sharp (§6.4 beat 8).
  function bakeStaticFrame() {
    reticle.x = W * 0.5;
    reticle.y = H * 0.5;
    reticle.active = true;
    time = 40;
    for (var s = 0; s < config.trail + 6; s++) {
      for (var i = 0; i < particles.length; i++) { particles[i].step(); }
    }
    drawParticles();
    drawReticle();
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
    // on hover-capable devices the reticle follows the cursor exactly
    if (hasHover) { reticle.x = nx; reticle.y = ny; reticle.active = true; }
  }

  function emitPulse(clientX, clientY) {
    setPointer(clientX, clientY);
    if (pulses.length >= config.maxPulses) { pulses.shift(); }
    pulses.push({ x: pointer.x, y: pointer.y, age: 0 });
    sampleFlash = 40;
    startLoop();
  }

  /* Loader handoff: the boot sequence resolves the centre of the field once,
     so the loader's survey mark visibly becomes the hero instrument instead
     of simply disappearing behind it. Touch keeps its auto-sweep afterwards;
     desktop lets the reticle clear unless the pointer is already over the
     panel. */
  function onSurfaceLock() {
    if (reduceMotion || !W || !H) { return; }
    reticle.x = W * 0.5;
    reticle.y = H * 0.5;
    reticle.active = true;
    sampleFlash = 34;
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var dx = p.x - reticle.x;
      var dy = p.y - reticle.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < config.resolveRadius) {
        p.resolve = Math.max(p.resolve, 1 - d / config.resolveRadius);
      }
    }
    startLoop();
    if (surfaceLockTimer) { clearTimeout(surfaceLockTimer); }
    if (hasHover) {
      surfaceLockTimer = setTimeout(function () {
        if (!pointer.active) { reticle.active = false; }
      }, 900);
    }
  }
  window.addEventListener('hero:surface-lock', onSurfaceLock);

  wrap.addEventListener('mousemove', function (e) { setPointer(e.clientX, e.clientY); startLoop(); }, { passive: true });
  wrap.addEventListener('mouseleave', function () {
    pointer.active = false; pointer.speed = 0;
    if (hasHover) { reticle.active = false; } // reticle clears on desktop; auto-sweep keeps it on touch
  }, { passive: true });
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

  /* Avant-Garde seam (§6.6): a later live-inference module can call
     window.__mountHeroSpecimen(canvasNode) to replace the idle flow field
     with a live /stylize or ONNX surface — without touching this module again. */
  window.__mountHeroSpecimen = function (node) {
    if (!node || !wrap) { return; }
    stopLoop();
    canvas.style.display = 'none';
    wrap.appendChild(node);
  };

  window.addEventListener('pagehide', function () {
    stopLoop();
    window.removeEventListener('devicetierchange', handleDeviceTierChange);
    window.removeEventListener('hero:surface-lock', onSurfaceLock);
    window.removeEventListener('resize', scheduleResize);
    window.removeEventListener('scroll', scheduleRectRefresh);
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
    if (surfaceLockTimer) clearTimeout(surfaceLockTimer);
  }, { once: true });
})();
