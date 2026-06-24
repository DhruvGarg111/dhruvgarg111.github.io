# Agents.md — Development History & System Context

This file serves as a comprehensive developer reference and context hand-off for AI agents and human developers working on the **Ground Truth** portfolio website (`dhruvgarg111.github.io`). It details the visual style guide, architectural constraints, chronological upgrades, what worked, what failed (and why), and the current repository state.

---

## 1. Project Context & Design Philosophy
The portfolio website for **Dhruv Garg (AI/ML Engineer)** is built around a distinct, print-survey "Notebook & Ground Truth" aesthetic. It should look like a premium, tactile field notebook or scientific logbook containing synthetic survey records of machine learning models.

### Key Design Tokens (Defined in `style.css`):
*   `--paper`: `#E8E2D6` (Beige paper color)
*   `--ink`: `#1A2B3C` (Deep blue/slate-black ink)
*   `--umber`: `#4A3728` (Dark umber brown for dark sections, now semi-transparent)
*   `--surface`: `#F4F0E8` (Light page surface)
*   `--survey`: `#C45C26` / `--survey-text`: `#8F3A10` (Terracotta highlight orange)
*   `--validated`: `#2F6B5E` (Sage green success)
*   `--coarse`: `#9AAFC4` (Slate blue coarse pass)

### Structural Hierarchy (Z-Indices):
1.  `#neural-bg-canvas` (`z-index: 0`): Three.js background network points and connections.
2.  `.fog-screen` (`z-index: 1`): CSS fallback fog (hidden when WebGL is active).
3.  `.paper-grain` (`z-index: 2`): Tactile noise texture overlaying the scene.
4.  `#fluid-canvas` (`z-index: 3`): Interactive surveyor crosshair and coordinate tracer.
5.  `main` content and sidebar (`z-index: 5`): Active layout blocks, headings, cards.

---

## 2. Chronological Upgrades, Attempts, & Outcomes

### A. Scroll-Animation Performance (Eliminated Jitter & Lag)
*   **The Problem**: The portfolio felt cheap and laggy on scroll. The elements batched by GSAP `ScrollTrigger` were repeatedly entering, exiting, hiding, and refading depending on the scroll direction. This created rendering loops that jittered.
*   **Failed Attempt**: Keeping enter/leave state bindings that toggled element visibility.
*   **The Solution**: Modified `initForegroundReveals()` in `script.js` to animate elements **only once** using `once: true` inside the `ScrollTrigger.batch` call. We also adjusted durations and staggers (`duration: 0.65`, `stagger: 0.05`, `ease: "power2.out"`) to make the reveals snap smoothly. Once revealed, elements remain visible, preventing layout recalculations on reverse scroll.

### B. 3D Neural Network Background (Vibrancy & Blending)
*   **The Problem**: The Three.js background network was too faint and difficult to see on light screens.
*   **Failed Attempt**: Default additive blending (`THREE.AdditiveBlending`) on the network particles caused the colors to wash out and dissolve into the light beige paper background, becoming virtually invisible.
*   **The Solution**: Switched the point and line materials to normal blending (`THREE.NormalBlending`). Realigned the colors to match the actual design tokens: sage green, slate blue, terracotta, gold, and coral. Increased the Point and Line opacity and boosted the background canvas opacity to `0.85` (desktop) / `0.55` (mobile) to make the nodes pop clearly.

### C. Volumetric Smoke Screen (Interactive Depth Shader)
*   **The Problem**: The division between the foreground text and the 3D background network was a plain static blur, which felt flat.
*   **The Solution**: Built a custom GLSL fragment shader and loaded it on a camera-attached plane in `neural-background.js`. The shader renders domain-warped fractional Brownian motion (fBm) noise to simulate volumetric fog. By feeding coordinates (`uMouse`), scroll (`uScroll`), and elapsed time (`uTime`), the smoke warps and dissolves around the mouse pointer, creating a moving spotlight that reveals the clean 3D network underneath. Static CSS veils are hidden programmatically when WebGL compiles successfully.

### D. Missing Sections (Restored Skills Constellation)
*   **The Problem**: The **Skills** section (Stratum block between Journey and Proof) was missing or commented out, and the 3D rotating skills constellation logic was inactive.
*   **The Solution**: Restored the Skills section structure in `index.html` and added it to the sidebar depth rod navigations. Styled the classes (`.orbital-viewport`, `.orbital-backdrop`, `.orbit-node`) in `style.css`. Ported the 3D rotation logic into `initSkillsOrbital()` inside `script.js`. For optimization, we connected start/stop triggers to `setActiveStratum()`, pausing the Skills constellation render loop entirely when the section is scrolled off-screen.

### E. Project Diagram Animations
*   **The Problem**: The diagrams illustrating model workings for "Neural Canvas" and "PixelQueue" were basic placeholders.
*   **The Solution**:
    *   **Neural Canvas**: Replaced flat blocks with SVGs representing Content (mesh contours), Style (impasto curves), and Stylized output, showing a seamless vertical swipe style transfer on scroll trigger.
    *   **PixelQueue**: Designed an interactive SVG workflow queue inside `.magnifier__track` that animates step-by-step model training operations: Konva bounding box draw -> FastAPI POST acceptance -> Celery task worker active spinners -> PostgreSQL DB record commits.

### F. Sidebar Rod Transitions & Alternating Layouts
*   **The Problem**: The navigation sidebar turned brown instantly when scrolling onto dark sections, creating a harsh visual jump.
*   **The Solution**: Programmed a smooth GSAP timeline in `script.js` that interpolates the opacity and borders of the sidebar (`.depth-rod`) between light-paper mode and dark-umber mode. Also enabled alternating background sections to cleanly divide the portfolio strata.

### G. Cursor Effect Integration (Rethought & Tailored)
*   **Failed Attempt (WebGL Fluid Shader)**:
    *   *Implementation*: Ported the React `SplashCursor` WebGL fluid splat simulation to a vanilla script.
    *   *Why it failed/rejected*: The fluid splat trails felt too digital, highly saturated, and neon. It clashed aggressively with the tactile paper/ink notebook aesthetic. Additionally, running a second WebGL context alongside the background Three.js scene was resource-heavy, introducing latency on mid-range and mobile devices.
*   **Successful Solution (Custom Surveyor & Coordinate Tracer)**:
    *   *Implementation*: Built a custom 2D canvas tracer in `fluid-cursor.js`.
    *   *Aesthetic*: Draws a surveyor's crosshair and bracket target `[ ]` that rotates on motion and scales down on mouse click.
    *   *Tracer*: Leaves a floating node mesh connected by faint grey lines (`#756D5C`) representing point-clouds and neural keypoints. Nodes occasionally print tiny normalized coordinates `[X, Y]` in monospace next to them before fading out over 1.2 seconds.
    *   *Performance*: Low-overhead, runs at 60fps, passes all mouse clicks through to page buttons/links (`pointer-events: none`), and respects `prefers-reduced-motion`.

### H. Semi-Transparent Brown Sections
*   **The Problem**: Dark sections (`#training`, `#interface`, `#contact`) had fully opaque umber brown backgrounds, which completely blocked the view of the background network and smoke shader.
*   **The Solution**: Modified `.stratum--dark` and `.stratum--contact` in `style.css` to use `background: rgba(74, 55, 40, 0.88) !important` and `backdrop-filter: blur(8px)`. This makes the brown sections slightly see-through, letting the background 3D network nodes glow softly through the dark sections as they drift.

### I. Sidebar Depth Rod Ticks Refactoring (ScrollTrigger Coordination)
*   **The Problem**: Coordinates and lighting transitions for the milestones on the fixed sidebar depth rod were bound to individual card ScrollTriggers. Because the cards are absolute-positioned inside a pinned container (`.journey-map-wrap`), standard viewport ScrollTriggers fired prematurely or concurrently as the section pinned.
*   **The Solution**: Refactored `initJourneyDepthTicks()` to remove the independent ScrollTrigger instances and store the created tick elements in a scoped `depthTicks` array. Inside `initJourneyMap()`, we added a synchronization loop in the main timeline `onUpdate` callback that toggles the `.is-lit` class on each tick based on the car's numeric progress `p`. Ticks now light up and dim dynamically in both scroll directions with zero performance overhead.
*   **Trigger Pinning Refinement**: Resolved pinning constraints where `#journey` was pinned too early (`start: 'top 20%'`), causing the car animation to start while the map was half-visible and cutting off the bottom milestones. We adjusted `initJourneyMap()` to set `trigger: '.journey-map-wrap'`, `start: 'top 10%'`, and `pin: '#journey'`. In `style.css`, we reduced `.journey-map-wrap` margin-top to `1.5rem` and set custom vertical paddings for `#journey` (`padding-top: clamp(2rem, 5vh, 4rem); padding-bottom: clamp(2.5rem, 6vh, 5rem);`). Pinning now locks exactly when the map enters full view, keeping the entire component visible and car progress coordinated.

### J. Accessibility & Mobile Optimization Polish
*   **Keyboard Accessibility**: Added `tabindex="0"` attributes to all skills matrix cards, styled focus states to match hover details, and updated JS triggers so that tabbing through the cards plays the sweep scan line animation.
*   **Mobile Navigation Completeness**: Added anchors for Journey (`J`), Skills (`S`), and Proof (`P`) to the floating mobile navigation flexbar, and introduced a media query targeting screens narrower than `380px` to scale down layout widths and avoid page overflows.
*   **WebGL Fallback Fix**: Restructured the visual rules to ensure that the 2D HTML5 canvas cursor (`#fluid-canvas`) is not hidden when 3D WebGL fails (`body.no-webgl-depth`), keeping coordinate tracking operational.

---

## 3. Developer Hand-off Checklist
If you need to make changes or debug this site, verify these constraints:

*   **Scroll lag**: Ensure GSAP batch elements never re-trigger animations with `onLeave`/`onEnterBack` unless explicitly requested. Keep `once: true` to prevent scroll latency.
*   **Sidebar colors**: The sidebar rod transition is managed dynamically via GSAP scroll triggers checking section boundaries. Avoid overriding `.depth-rod` colors via static CSS without testing the scroll transition.
*   **Click blocking**: The `#fluid-canvas` MUST always have `pointer-events: none` and `z-index: 6`. This ensures all buttons, overlay cards, and repository links inside `main` (z-index 5) remain clickable while the cursor trail renders on top.
*   **Visibility listener**: Both `neural-background.js` and `fluid-cursor.js` listen to the `visibilitychange` event. They automatically call `cancelAnimationFrame` when the tab is hidden and resume on visibility, preventing CPU/battery drain.
*   **Keyboard focus**: Ensure custom card components maintain `tabindex="0"` and listen to both hover and focus states for sweep and outline animations.
