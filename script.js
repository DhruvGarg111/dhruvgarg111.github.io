/* Kinetic Oracle — V2 Scripts */
document.addEventListener('DOMContentLoaded', () => {

    // ── BOOT SEQUENCE ──
    const boot = document.getElementById('bootLoader');
    const lines = document.querySelectorAll('.boot-line');
    lines.forEach((l, i) => {
        setTimeout(() => l.classList.add('show'), 200 + i * 300);
    });
    setTimeout(() => {
        boot.classList.add('hidden');
        setTimeout(() => {
            document.getElementById('heroTitle').classList.add('loaded');
            // Trigger portrait + sub + actions reveal via JS since they're not CSS siblings of h1
            document.querySelectorAll('.hero-sub, .hero-actions').forEach(el => {
                el.style.opacity = '1'; el.style.transform = 'translateY(0)';
            });
            const portrait = document.getElementById('heroPortrait');
            if (portrait) { portrait.style.opacity = '1'; portrait.style.transform = 'translateX(0)'; }
        }, 400);
    }, 1800);

    // ── CURSOR GLOW ──
    const cursor = document.getElementById('cursorGlow');
    let mx = 0, my = 0, cx = 0, cy = 0;
    if (window.innerWidth > 1024) {
        document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
        (function loop() {
            cx += (mx - cx) * 0.12; cy += (my - cy) * 0.12;
            cursor.style.transform = `translate(${cx}px, ${cy}px)`;
            requestAnimationFrame(loop);
        })();
        document.querySelectorAll('a, button, .bento-tile, .timeline-card, .skill-card').forEach(el => {
            el.addEventListener('mouseenter', () => cursor.classList.add('active'));
            el.addEventListener('mouseleave', () => cursor.classList.remove('active'));
        });
    } else if (cursor) cursor.style.display = 'none';

    // ── DOT GRID ──
    const canvas = document.getElementById('dotGrid');
    const ctx = canvas.getContext('2d');
    let w, h;
    function resize() { w = canvas.width = innerWidth; h = canvas.height = innerHeight; }
    addEventListener('resize', resize); resize();
    (function draw() {
        ctx.clearRect(0, 0, w, h);
        const sp = 36, t = Date.now() / 2000;
        for (let x = 0; x < w; x += sp) {
            for (let y = 0; y < h; y += sp) {
                const d = Math.sin(x / 120 + t) * Math.cos(y / 120 + t * 0.7);
                ctx.fillStyle = `rgba(196,244,0,${0.03 + d * 0.015})`;
                ctx.fillRect(x, y, 1.2, 1.2);
            }
        }
        requestAnimationFrame(draw);
    })();

    // ── SCROLL REVEALS ──
    const obs = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); obs.unobserve(e.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal-up').forEach(el => obs.observe(el));

    // ── NAV TRACKING ──
    const secs = document.querySelectorAll('section[id]');
    const links = document.querySelectorAll('.rail-link');
    const prog = document.getElementById('scrollProgress');
    const tProg = document.getElementById('timelineProgress');

    addEventListener('scroll', () => {
        const y = scrollY;
        let cur = '';
        secs.forEach(s => { if (y >= s.offsetTop - 250) cur = s.id; });
        links.forEach(l => {
            l.classList.toggle('active', l.getAttribute('href').includes(cur));
        });
        const pct = (y / (document.body.scrollHeight - innerHeight)) * 100;
        if (prog) prog.style.height = pct + '%';

        const j = document.getElementById('journey');
        if (j && tProg) {
            const jt = j.offsetTop, jh = j.offsetHeight;
            if (y > jt - innerHeight && y < jt + jh) {
                const p = Math.max(0, Math.min(100, ((y - jt + innerHeight * 0.5) / jh) * 100));
                tProg.style.height = p + '%';
            }
        }
    }, { passive: true });

    // ── MOBILE MENU ──
    const tog = document.getElementById('mobileToggle');
    const menu = document.getElementById('mobileMenu');
    if (tog) {
        tog.onclick = () => {
            tog.classList.toggle('active');
            menu.classList.toggle('open');
            document.body.style.overflow = menu.classList.contains('open') ? 'hidden' : '';
        };
        document.querySelectorAll('.mm-link').forEach(l => l.onclick = () => {
            tog.classList.remove('active');
            menu.classList.remove('open');
            document.body.style.overflow = '';
        });
    }
});
