document.addEventListener('DOMContentLoaded', () => {
    // Intersection Observer for Cinematic Reveals
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('reveal-active');
                entry.target.style.animationPlayState = 'running';
                // Optional: Stop observing once revealed
                // observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Initial pause of animation until scrolled into view
    document.querySelectorAll('.reveal').forEach(el => {
        el.style.animationPlayState = 'paused';
        observer.observe(el);
    });
});
