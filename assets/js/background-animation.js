const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (!prefersReducedMotion) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (ctx) {
    document.body.appendChild(canvas);

    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.zIndex = "-1";
    canvas.style.opacity = "0.34";
    canvas.style.pointerEvents = "none";

    const connectionDistance = 140;
    const connectionDistanceSquared = connectionDistance * connectionDistance;
    const frameInterval = 1000 / 40;
    let frameId = 0;
    let lastFrameTime = 0;
    let resizeTimer = 0;
    let isRunning = true;
    let width = 0;
    let height = 0;
    let particles = [];

    class Particle {
      constructor() {
        this.x = Math.random() * width;
        this.y = Math.random() * height;
        this.vx = (Math.random() - 0.5) * 0.5;
        this.vy = (Math.random() - 0.5) * 0.5;
        this.size = Math.random() * 1.8 + 0.8;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        if (this.y > height) this.y = 0;
      }
    }

    function getParticleCount() {
      if (width < 600) return 22;
      if (width < 1000) return 34;
      return 48;
    }

    function resetCanvas() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      particles = Array.from({ length: getParticleCount() }, () => new Particle());
    }

    function getThemeColors() {
      const isLight = document.documentElement.classList.contains("light-mode");
      canvas.style.opacity = isLight ? "0.15" : "0.34";

      return {
        r: isLight ? 92 : 41,
        g: isLight ? 79 : 244,
        b: isLight ? 63 : 182,
        particleAlpha: isLight ? 0.14 : 0.46,
        lineAlpha: isLight ? 0.2 : 0.95
      };
    }

    function draw() {
      const colors = getThemeColors();
      ctx.clearRect(0, 0, width, height);

      for (const particle of particles) {
        particle.update();
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${colors.r}, ${colors.g}, ${colors.b}, ${colors.particleAlpha})`;
        ctx.fill();
      }

      for (let i = 0; i < particles.length; i += 1) {
        const p1 = particles[i];
        for (let j = i + 1; j < particles.length; j += 1) {
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const distanceSquared = dx * dx + dy * dy;

          if (distanceSquared >= connectionDistanceSquared) {
            continue;
          }

          const intensity = 1 - distanceSquared / connectionDistanceSquared;
          ctx.beginPath();
          ctx.strokeStyle = `rgba(${colors.r}, ${colors.g}, ${colors.b}, ${intensity * colors.lineAlpha})`;
          ctx.lineWidth = 0.45;
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      }
    }

    function animate(timestamp) {
      if (!isRunning) {
        return;
      }

      if (timestamp - lastFrameTime < frameInterval) {
        frameId = window.requestAnimationFrame(animate);
        return;
      }

      lastFrameTime = timestamp;
      draw();
      frameId = window.requestAnimationFrame(animate);
    }

    function onResize() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        resetCanvas();
      }, 120);
    }

    function onVisibilityChange() {
      if (document.hidden) {
        isRunning = false;
        window.cancelAnimationFrame(frameId);
        return;
      }

      if (!isRunning) {
        isRunning = true;
        frameId = window.requestAnimationFrame(animate);
      }
    }

    window.addEventListener("resize", onResize, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);

    resetCanvas();
    frameId = window.requestAnimationFrame(animate);
  }
}
