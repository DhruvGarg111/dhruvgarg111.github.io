(function () {
  'use strict';

  /* Lightweight stand-in for neural-background.js's Three.js scene, used
     when window.__bgMode === 'lite' (touch/no-hover devices, where the
     WebGL scene's headline feature — mouse-reactive smoke — can never
     fire; and low-tier devices generally). Same curl-noise approach
     hero-flow.js already uses for the hero canvas, at a much lower
     particle count, tinted toward the section's atmosphereDark state so
     the section-linked mood shift (see Phase 4) still reads. Canvas2d,
     no WebGL context, no shader compile. */

  var canvas = document.getElementById('neural-bg-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var prefersRM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  var COUNT = 46;
  var pts = [];
  for (var i = 0; i < COUNT; i++) {
    pts.push({ x: Math.random() * W, y: Math.random() * H, a: Math.random() * Math.PI * 2 });
  }

  var progress = 0;
  var darkness = 0; // 0..1, driven by the active section
  /* Keep the same public hook as the WebGL renderer so script.js can hand
     either renderer its section manifest without branching. The lite scene
     only needs the active section supplied to __neuralSetProgress(). */
  window.__neuralSetSections = function () {};
  window.__neuralSetProgress = function (p, section) {
    progress = Math.max(0, Math.min(1, p));
    darkness = section && (section.atmosphereDark || section.dark) ? 1 : 0;
  };

  var running = false, rafId = 0, lastT = 0;

  function tick(t) {
    if (!running) return;
    var dt = Math.min(48, t - (lastT || t));
    lastT = t;
    ctx.clearRect(0, 0, W, H);
    var base = darkness ? 'rgba(143,212,184,' : 'rgba(30,123,101,';
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      p.a += 0.0009 * dt * (0.6 + 0.4 * Math.sin(p.x * 0.002 + progress * 6));
      p.x += Math.cos(p.a) * 0.18 * dt;
      p.y += Math.sin(p.a) * 0.18 * dt;
      if (p.x < 0) p.x += W; if (p.x > W) p.x -= W;
      if (p.y < 0) p.y += H; if (p.y > H) p.y -= H;
      ctx.beginPath();
      ctx.fillStyle = base + '0.35)';
      ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
    rafId = requestAnimationFrame(tick);
  }

  function start() { if (running || prefersRM) return; running = true; lastT = 0; rafId = requestAnimationFrame(tick); }
  function stop() { running = false; if (rafId) cancelAnimationFrame(rafId); }

  function handleVisibilityChange() { if (document.hidden) stop(); else start(); }
  document.addEventListener('visibilitychange', handleVisibilityChange);

  window.addEventListener('pagehide', function () {
    stop();
    window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, { once: true });

  if (!prefersRM) {
    document.body.classList.add('has-neural-depth'); // reuses the existing canvas fade-in CSS
    start();
  }
})();
