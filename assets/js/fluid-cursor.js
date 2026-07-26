(function () {
  'use strict';

  var canvas = document.getElementById('fluid-canvas');
  if (!canvas) {
    return;
  }

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    return;
  }

  /* Touch-first devices (no fine hover pointer at any width — includes
     touch tablets, which the old max-767px check missed) never get the
     tracer: a persistent trail under a scrolling finger is distracting
     and battery-hostile. The loader in index.html already skips fetching
     this file for them; this guard is defense-in-depth. */
  var isTouchFirst = !window.matchMedia('(any-pointer: fine) and (any-hover: hover)').matches;
  if (isTouchFirst) {
    return;
  }

  var ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  // Configuration for custom coordinate mesh tracer
  var config = {
    maxParticles: 30,
    connectionDist: 85,
    nodeLife: 1200,      // in ms
    dampening: 0.96,
    mouseRadius: 100,
    palette: [
      '#1E7B65', // Sage Green
      '#3D72A4', // Slate Blue
      '#E05A16', // Terracotta Orange
      '#FAA823'  // Warm Gold
    ],
    darkPalette: [
      '#8FD4B8', // Bright Sage
      '#82B2E4', // Bright Slate Blue
      '#FF8243', // Bright Terracotta
      '#FFD066'  // Bright Gold
    ]
  };

  var particles = [];
  var mouse = { x: 0, y: 0, lastX: 0, lastY: 0, active: false, speed: 0, angle: 0 };
  var lastTime = performance.now();
  var running = false;
  var rafId = 0;
  var useGsapTicker = !!(window.gsap && window.gsap.ticker);
  var width = window.innerWidth;
  var height = window.innerHeight;
  var resizeRafId = 0;
  var frameTheme = null;

  // Track coordinates of the cursor to draw technical survey crosshair
  var cursorTarget = { x: 0, y: 0, currentX: 0, currentY: 0, rotation: 0, size: 20 };

  // The hero flow panel has its own cursor reticle; recede over it so the two
  // don't fight. We don't disappear — just stop spawning and dim the crosshair.
  var heroPanel = document.getElementById('hero-image-wrap');
  var heroSection = document.getElementById('hero');
  var heroRect = null;
  function refreshHeroRect() {
    // Only track the panel while the hero is actually visible up top — otherwise
    // its faded/scaled ghost mid-page would dim the tracer over other sections.
    if (heroPanel && heroSection && parseFloat(getComputedStyle(heroSection).opacity || '1') > 0.6) {
      heroRect = heroPanel.getBoundingClientRect();
    } else {
      heroRect = null;
    }
  }
  function overHeroPanel(x, y) {
    return !!heroRect && x >= heroRect.left && x <= heroRect.right && y >= heroRect.top && y <= heroRect.bottom;
  }

  /* Theme is constant until body.is-dark toggles — cache it instead of
     rebuilding an 8-field object every frame/spawn. Consumers only read it. */
  var themeCache = null;
  var themeCacheDark = null;
  function readTheme() {
    var isDark = document.body.classList.contains('is-dark');
    if (themeCache && themeCacheDark === isDark) return themeCache;
    themeCacheDark = isDark;
    themeCache = {
      isDark: isDark,
      palette: isDark ? config.darkPalette : config.palette,
      bbox: isDark ? config.darkPalette[2] : config.palette[2],
      label: isDark ? 'rgba(244, 240, 232, 0.85)' : 'rgba(26, 43, 60, 0.75)',
      connection: isDark ? 'rgba(244, 240, 232, 0.45)' : 'rgba(117, 109, 92, 0.52)',
      cursor: isDark ? 'rgba(250, 168, 35, 0.95)' : 'rgba(196, 92, 38, 0.9)',
      cursorCore: isDark ? 'rgba(244, 240, 232, 0.8)' : 'rgba(26, 43, 60, 0.8)'
    };
    return themeCache;
  }

  function resizeCanvas() {
    resizeRafId = 0;
    var w = window.innerWidth;
    var h = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    width = w;
    height = h;
    refreshHeroRect();
  }

  function scheduleResizeCanvas() {
    if (!resizeRafId) {
      resizeRafId = requestAnimationFrame(resizeCanvas);
    }
  }

  function Particle(x, y, vx, vy, color, type) {
    this.reset(x, y, vx, vy, color, type);
  }

  // Same body the constructor used to have — reused by acquireParticle() to
  // reinitialize a pooled instance in place instead of allocating a new one.
  Particle.prototype.reset = function (x, y, vx, vy, color, type) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.type = type || 'node'; // 'node' or 'bbox'
    this.birth = performance.now();
    this.life = config.nodeLife * (0.8 + Math.random() * 0.4);
    this.size = this.type === 'bbox' ? (8 + Math.random() * 8) : (2.5 + Math.random() * 2);
    this.hasLabel = Math.random() < 0.22;
    // Only compute label string when needed (avoids toFixed for 78% of particles)
    if (this.hasLabel) {
      var normX = (x / (width || 800) - 0.5) * 2;
      var normY = (0.5 - y / (height || 600)) * 2;
      this.label = '[' + normX.toFixed(2) + ',' + normY.toFixed(2) + ']';
    } else {
      this.label = '';
    }
    this.angle = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 0.02;
  };

  // Fixed-size object pool: reuses Particle instances round-robin instead of
  // allocating a fresh one on every spawn (continuous minor-GC pressure on
  // desktop during mouse movement). POOL_SIZE (40) stays comfortably above
  // config.maxParticles (30) so a pool slot is never reset while its
  // occupant is still referenced by the live `particles` render list.
  var POOL_SIZE = 40;
  var pool = [];
  var poolPtr = 0;
  function acquireParticle(x, y, vx, vy, color, type) {
    var p = pool[poolPtr];
    if (!p) {
      p = new Particle(x, y, vx, vy, color, type);
      pool[poolPtr] = p;
    } else {
      p.reset(x, y, vx, vy, color, type);
    }
    poolPtr = (poolPtr + 1) % POOL_SIZE;
    return p;
  }

  Particle.prototype.update = function (dt, now) {
    var age = now - this.birth;
    if (age > this.life) {
      return false;
    }
    
    // Apply velocity with dampening
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= config.dampening;
    this.vy *= config.dampening;
    
    // Slight float/wind effect upwards and sideways
    this.y -= 0.12 * dt;
    this.x += Math.sin(now * 0.002 + this.birth) * 0.15 * dt;

    if (this.type === 'bbox') {
      this.angle += this.rotSpeed * dt;
    }

    return true;
  };

  Particle.prototype.draw = function (now, theme) {
    var age = now - this.birth;
    var pct = 1.0 - (age / this.life);
    var opacity = pct * 0.95; // Brighter opacity
    theme = theme || readTheme();

    ctx.save();
    if (this.type === 'bbox') {
      // Draw technical dashed detection bounding box
      ctx.translate(this.x, this.y);
      ctx.rotate(this.angle);
      ctx.strokeStyle = theme.bbox; // Terracotta Orange (Bright vs Normal)
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = opacity * 1.0;
      ctx.setLineDash([2, 3]);
      ctx.strokeRect(-this.size, -this.size, this.size * 2, this.size * 2);
    } else {
      // Draw standard perception node
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * (0.4 + pct * 0.6), 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.globalAlpha = opacity;
      ctx.fill();

      // Draw relative coordinates text next to node
      if (this.hasLabel && pct > 0.3) {
        ctx.font = '500 8.5px "Martian Mono", ui-monospace, monospace';
        ctx.fillStyle = theme.label;
        ctx.globalAlpha = (pct - 0.3) / 0.7 * 0.95;
        ctx.fillText(this.label, this.x + 6, this.y + 2.5);
      }
    }
    ctx.restore();
  };

  function spawnParticles(x, y, count, force) {
    var theme = frameTheme || readTheme();
    var palette = theme.palette;
    for (var i = 0; i < count; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = Math.random() * force;
      var vx = Math.cos(angle) * speed;
      var vy = Math.sin(angle) * speed;
      var color = palette[Math.floor(Math.random() * palette.length)];
      var type = (Math.random() < 0.08) ? 'bbox' : 'node';
      particles.push(acquireParticle(x, y, vx, vy, color, type));
    }
    if (particles.length > config.maxParticles) {
      particles.splice(0, particles.length - config.maxParticles);
    }
  }

  function ensureRunning() {
    if (!running) {
      running = true;
      lastTime = performance.now();
      if (useGsapTicker) {
        window.gsap.ticker.add(updateFrame);
      } else {
        rafId = requestAnimationFrame(updateFrame);
      }
    }
  }

  function handleMouseMove(e) {
    mouse.active = true;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    
    // Calculate speed and angle of movement
    var dx = mouse.x - mouse.lastX;
    var dy = mouse.y - mouse.lastY;
    var dist = Math.sqrt(dx * dx + dy * dy);
    
    mouse.speed = dist;
    mouse.angle = Math.atan2(dy, dx);
    
    // Spawn nodes during movement (but not over the hero panel — it leads there)
    if (dist > 2 && !overHeroPanel(mouse.x, mouse.y)) {
      var vx = dx * 0.15;
      var vy = dy * 0.15;

      var theme = frameTheme || readTheme();
      var palette = theme.palette;
      var color = palette[Math.floor(Math.random() * palette.length)];
      
      // Spawn standard node
      particles.push(acquireParticle(mouse.x, mouse.y, vx, vy, color, 'node'));

      // If moving rapidly, spawn a bounding box
      if (dist > 15 && Math.random() < 0.25) {
        particles.push(acquireParticle(mouse.x, mouse.y, vx * 0.4, vy * 0.4, theme.bbox, 'bbox'));
      }

      // while (not if): up to 2 particles can be pushed above in one call, and
      // pooled slots must never be reused while still referenced by `particles`.
      while (particles.length > config.maxParticles) {
        particles.shift();
      }
    }
    
    mouse.lastX = mouse.x;
    mouse.lastY = mouse.y;
    
    cursorTarget.x = mouse.x;
    cursorTarget.y = mouse.y;

    ensureRunning();
  }

  function handleMouseDown(e) {
    // Click splat: burst of coordinate nodes and boxes
    spawnParticles(e.clientX, e.clientY, 8, 3.5);
    cursorTarget.size = 12; // Snap target crosshair tight on click
    ensureRunning();
  }

  function handleMouseLeave() {
    mouse.active = false;
  }

  window.addEventListener('mousemove', handleMouseMove, { passive: true });
  window.addEventListener('mousedown', handleMouseDown, { passive: true });
  window.addEventListener('mouseup', function () { cursorTarget.size = 20; }, { passive: true });
  /* No touch listeners, deliberately. The early return above is keyed on
     device *capability* (isTouchFirst), but touch *events* still fire on a
     hybrid machine — a touchscreen laptop matches (any-pointer: fine), so it
     passes that guard and would then draw exactly the finger trail the note
     at the top of this file rules out as distracting and battery-hostile.
     This module is mouse-only by design; pointer input drives it via
     mousemove. */
  document.addEventListener('mouseleave', handleMouseLeave);

  function drawConnections(now, theme) {
    ctx.lineWidth = 1.0;
    theme = theme || readTheme();
    var minDist = config.connectionDist * config.connectionDist;
    var maxJ, connCount;
    
    for (var i = 0; i < particles.length; i++) {
      var pi = particles[i];
      var ageI = now - pi.birth;
      var pctI = 1.0 - (ageI / pi.life);
      connCount = 0;
      maxJ = Math.min(particles.length, i + 12);
      
      for (var j = i + 1; j < maxJ; j++) {
        var pj = particles[j];
        var dx = pi.x - pj.x;
        var dy = pi.y - pj.y;
        var dist = dx * dx + dy * dy;
        
        if (dist < minDist) {
          var ageJ = now - pj.birth;
          var pctJ = 1.0 - (ageJ / pj.life);
          var d = Math.sqrt(dist);
          var distPct = 1.0 - (d / config.connectionDist);
          
          ctx.strokeStyle = theme.connection;
          ctx.globalAlpha = distPct * Math.min(pctI, pctJ) * 0.58;
          ctx.beginPath();
          ctx.moveTo(pi.x, pi.y);
          ctx.lineTo(pj.x, pj.y);
          ctx.stroke();
          connCount++;
          if (connCount >= 4) break;
        }
      }
    }
  }

  function drawCursor(dt, theme) {
    if (!mouse.active) {
      return;
    }
    theme = theme || readTheme();

    // Interpolate surveyor target position for smoothness
    var lerpFactor = 0.18;
    cursorTarget.currentX += (cursorTarget.x - cursorTarget.currentX) * lerpFactor;
    cursorTarget.currentY += (cursorTarget.y - cursorTarget.currentY) * lerpFactor;
    
    // Gently rotate target based on movement speed
    cursorTarget.rotation += (0.01 + mouse.speed * 0.001) * dt;
    
    ctx.save();
    ctx.translate(cursorTarget.currentX, cursorTarget.currentY);
    ctx.rotate(cursorTarget.rotation);
    
    // Draw technical surveyor target bracket corners [ ]
    // Recede over the hero panel so its own reticle leads (slight, not gone).
    var dim = overHeroPanel(cursorTarget.currentX, cursorTarget.currentY) ? 0.3 : 1.0;
    ctx.strokeStyle = theme.cursor; // Gold on dark, Terracotta on light
    ctx.lineWidth = 2.0;
    ctx.globalAlpha = dim;
    
    var size = cursorTarget.size;
    var len = 5;
    
    // Top-left
    ctx.beginPath();
    ctx.moveTo(-size, -size + len);
    ctx.lineTo(-size, -size);
    ctx.lineTo(-size + len, -size);
    ctx.stroke();
    
    // Top-right
    ctx.beginPath();
    ctx.moveTo(size, -size + len);
    ctx.lineTo(size, -size);
    ctx.lineTo(size - len, -size);
    ctx.stroke();
    
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(-size, size - len);
    ctx.lineTo(-size, size);
    ctx.lineTo(-size + len, size);
    ctx.stroke();
    
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(size, size - len);
    ctx.lineTo(size, size);
    ctx.lineTo(size - len, size);
    ctx.stroke();

    // Center crosshair "+"
    ctx.beginPath();
    ctx.moveTo(-4, 0); ctx.lineTo(4, 0);
    ctx.moveTo(0, -4); ctx.lineTo(0, 4);
    ctx.strokeStyle = theme.cursorCore; // Light cream on dark, dark ink on light
    ctx.lineWidth = 1.2;
    ctx.stroke();
    
    ctx.restore();
    
    // Decelerate mouse speed
    mouse.speed *= 0.9;
  }

  function updateFrame(tickerTime, deltaTime) {
    if (!running) {
      return;
    }
    
    var now = performance.now();
    var dt = useGsapTicker && typeof deltaTime === 'number'
      ? deltaTime / 16.666
      : (now - lastTime) / 16.666;
    lastTime = now;
    
    // Clear canvas using cached dimensions
    ctx.clearRect(0, 0, width, height);
    var theme = readTheme();
    frameTheme = theme;

    // Update and draw particles
    var liveCount = 0;
    for (var i = 0; i < particles.length; i++) {
      var particle = particles[i];
      if (particle.update(dt, now)) {
        particle.draw(now, theme);
        particles[liveCount++] = particle;
      }
    }
    particles.length = liveCount;

    // Draw connecting lines
    drawConnections(now, theme);

    // Draw technical crosshair cursor
    drawCursor(dt, theme);

    // Idle detection: check if there are no particles and cursor has settled
    var settled = Math.abs(cursorTarget.currentX - cursorTarget.x) < 0.25 &&
                  Math.abs(cursorTarget.currentY - cursorTarget.y) < 0.25;

    if (particles.length === 0 && (!mouse.active || settled)) {
      ctx.clearRect(0, 0, width, height); // Clear final artifacts
      frameTheme = null;
      stop();
      return;
    }

    frameTheme = null;
    if (!useGsapTicker) {
      rafId = requestAnimationFrame(updateFrame);
    }
  }

  function stop() {
    running = false;
    if (useGsapTicker) {
      window.gsap.ticker.remove(updateFrame);
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  window.addEventListener('resize', scheduleResizeCanvas, { passive: true });

  // Keep the hero-panel rect fresh as the page scrolls (the panel transforms).
  var heroRectRaf = 0;
  window.addEventListener('scroll', function () {
    if (!heroRectRaf) {
      heroRectRaf = requestAnimationFrame(function () { heroRectRaf = 0; refreshHeroRect(); });
    }
  }, { passive: true });

  resizeCanvas();

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stop();
    } else if (particles.length || mouse.active) {
      ensureRunning();
    }
  });

  window.addEventListener('pagehide', function () {
    stop();
    if (resizeRafId) {
      cancelAnimationFrame(resizeRafId);
      resizeRafId = 0;
    }
    if (heroRectRaf) {
      cancelAnimationFrame(heroRectRaf);
      heroRectRaf = 0;
    }
  }, { once: true });
})();
