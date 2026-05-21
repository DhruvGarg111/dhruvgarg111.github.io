/**
 * Dhruv Garg - Portfolio v4 Core Script Engine
 * Integrates Anime.js v4, Three.js WebGL, and custom interaction engines.
 * 
 * TABLE OF CONTENTS:
 * 1. Anime.js v4 Micro-Interactions (Scramble, Odometer, SVG Plotter, HUD Ripple)
 * 2. Custom Cursor Physics & Hover States
 * 3. Three.js 3D Neural Network / Mechanical Stage
 * 4. Z-Axis Scroll Proxy & Timing Mathematics
 * 5. Interactive UI components (Magnetic Buttons, Layer Focusing)
 * 6. Orbital Typographic Constellation Engine (Skills)
 * 7. Vernier Scale Scroll HUD Navigation
 */

// =========================================================================
// SECTION 1: ANIME.JS V4 MICRO-INTERACTIONS & HELPERS
// =========================================================================

// Destructure Anime.js v4 UMD Global utilities (with graceful fallback)
let animate, createTimeline, onScroll, utils, stagger, scrambleText;
try {
    ({ animate, createTimeline, onScroll, utils, stagger, scrambleText } = anime);
} catch (e) {
    console.warn('Anime.js failed to load. Animations disabled.');
    animate = () => ({ then: (cb) => cb && cb() });
    createTimeline = () => ({ add: () => ({}), sync: () => ({}) });
    onScroll = () => ({});
    utils = { set: () => {} };
    stagger = () => 0;
    scrambleText = () => '';
}

// Reduced motion preference check
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Tracks active snapped scroll section to run transition triggers once
let lastActiveIndex = -1;
let metricsAnimated = false; // Guard to prevent odometer re-triggering

/**
 * Performs a cybernetic scramble decryption effect on headings.
 * Handles multiline headings with <br> tags by splitting them into blocks
 * to preserve layout structures without scrambling HTML markup tags.
 * @param {HTMLElement} element 
 */
function triggerScramble(element) {
    if (prefersReducedMotion) return;
    if (element.classList.contains('scrambling')) return;
    element.classList.add('scrambling');
    
    // Save original innerHTML if not already cached
    if (!element.dataset.original) {
        element.dataset.original = element.innerHTML.trim();
    }
    const original = element.dataset.original;
    
    if (original.includes('<br>') || original.includes('<br/>')) {
        const parts = original.split(/<br\s*\/?>/i);
        element.innerHTML = parts.map(() => `<span class="scramble-part block"></span>`).join('<br>');
        const spans = element.querySelectorAll('.scramble-part');
        
        const animations = Array.from(spans).map((span, idx) => {
            return animate(span, {
                innerHTML: scrambleText({
                    text: parts[idx],
                    override: ' '
                }),
                duration: 800 + idx * 250,
                ease: 'linear'
            });
        });
        
        Promise.all(animations).then(() => {
            element.innerHTML = original;
            element.classList.remove('scrambling');
        });
    } else {
        animate(element, {
            innerHTML: scrambleText({
                text: original,
                override: ' '
            }),
            duration: 1000,
            ease: 'linear'
        }).then(() => {
            element.innerHTML = original;
            element.classList.remove('scrambling');
        });
    }
}

/**
 * Triggers a spring-physics odometer count-up on metrics numbers when scrolled into view.
 */
function triggerMetricsOdometer() {
    if (metricsAnimated) return;
    metricsAnimated = true;
    const odometers = document.querySelectorAll('.metric-number');
    odometers.forEach(odo => {
        const targetValue = parseInt(odo.getAttribute('data-value'), 10);
        if (isNaN(targetValue)) return;
        if (prefersReducedMotion) {
            odo.textContent = targetValue;
            return;
        }
        odo.textContent = '0';
        const countObj = { value: 0 };
        animate(countObj, {
            value: targetValue,
            round: 1,
            duration: 2000,
            ease: 'spring(1, 80, 12, 0)',
            onUpdate: () => {
                odo.textContent = Math.round(countObj.value);
            }
        });
    });
}

/**
 * Emits a staggered scale-x pulse wave outward from the active tick index on the Vernier HUD.
 * @param {number} activeIndex 
 */
// Cached vernier tick references (avoid re-querying DOM on every scroll)
const cachedVernierTicks = document.querySelectorAll('.vernier-tick');

function triggerVernierRipple(activeIndex) {
    const ticks = cachedVernierTicks;
    if (ticks.length === 0) return;
    
    animate(ticks, {
        scaleX: [1, 2.5, 1],
        duration: 400,
        delay: stagger(30, { from: activeIndex }),
        ease: 'outQuad'
    });
}

/**
 * Asynchronously fetches project SVG image files and inlines them
 * as real inline <svg> structures in the DOM to enable path drawing.
 */
async function inlineSVGs() {
    const images = document.querySelectorAll('.project-card img[src$=".svg"]');
    for (const img of images) {
        const src = img.getAttribute('src');
        const alt = img.getAttribute('alt');
        const imgClasses = img.getAttribute('class');
        
        try {
            const response = await fetch(src);
            if (!response.ok) continue;
            let svgText = await response.text();
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgText, 'image/svg+xml');
            const svgElement = doc.querySelector('svg');
            
            if (svgElement) {
                if (imgClasses) svgElement.setAttribute('class', imgClasses + ' inline-svg');
                // SVGs don't support 'alt'; use aria-label and <title> for accessibility
                svgElement.setAttribute('aria-label', alt || '');
                svgElement.setAttribute('role', 'img');
                const titleEl = document.createElementNS('http://www.w3.org/2000/svg', 'title');
                titleEl.textContent = alt || '';
                svgElement.prepend(titleEl);
                
                svgElement.style.width = '100%';
                svgElement.style.height = '100%';
                
                img.parentNode.replaceChild(svgElement, img);
                
                const card = svgElement.closest('.project-card');
                if (card) {
                    bindSVGLineDrawing(card, svgElement);
                }
            }
        } catch (e) {
            console.error('Failed to inline SVG:', src, e);
        }
    }
}

/**
 * Binds mouse hover listeners to project cards, drawing paths on enter and restoring on leave.
 * @param {HTMLElement} card 
 * @param {SVGElement} svgElement 
 */
function bindSVGLineDrawing(card, svgElement) {
    const paths = svgElement.querySelectorAll('path, line, rect, circle, polygon, polyline');
    
    paths.forEach(path => {
        const length = path.getTotalLength ? path.getTotalLength() : 1000;
        path.style.strokeDasharray = length;
        path.style.strokeDashoffset = '0';
    });
    
    let activeAnimation = null;
    
    card.addEventListener('mouseenter', () => {
        if (activeAnimation) activeAnimation.cancel();
        
        activeAnimation = animate(paths, {
            strokeDashoffset: [
                (el) => el.getTotalLength ? el.getTotalLength() : 1000,
                0
            ],
            duration: 1000,
            delay: stagger(50),
            ease: 'outSine'
        });
    });
    
    card.addEventListener('mouseleave', () => {
        if (activeAnimation) activeAnimation.cancel();
        
        paths.forEach(path => {
            path.style.strokeDashoffset = '0';
        });
    });
}

// Initialize SVG inlining instantly on load
inlineSVGs();

// =========================================================================
// SECTION 2: CUSTOM CURSOR PHYSICS & HOVER STATES
// =========================================================================

const cursorDot = document.getElementById('cursorDot');
const cursorRing = document.getElementById('cursorRing');

// Only initialize custom cursor on devices with a fine pointer
if (cursorDot && cursorRing && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.addEventListener('mousemove', (e) => {
        // Instant tracking for the center dot using hardware-accelerated transforms
        utils.set(cursorDot, { x: e.clientX, y: e.clientY });
        
        // Physics-based spring lag for the outer interactive ring
        animate(cursorRing, {
            x: e.clientX,
            y: e.clientY,
            ease: 'spring(1, 80, 10, 0)',
            composition: 'replace'
        });
    });

    // Cursor expansion on hovering interactive links and buttons
    const interactives = document.querySelectorAll('.interactive');
    interactives.forEach(el => {
        el.addEventListener('mouseenter', () => cursorRing.classList.add('active'));
        el.addEventListener('mouseleave', () => cursorRing.classList.remove('active'));
    });
}

// =========================================================================
// SECTION 3: THREE.JS 3D NEURAL NETWORK / MECHANICAL STAGE
// =========================================================================

try {
// Three.js initialization wrapped in try/catch for graceful WebGL fallback
const canvas = document.getElementById('webgl-canvas');
const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 15; 

// Group nodes and synapses together to easily spin them in Z-space
const networkGroup = new THREE.Group();
scene.add(networkGroup);

// Cyberpunk blueprint color tokens (optimized for light pebbles background)
const C_CYAN = 0xB07D14;
const C_BLUE = 0x4A6341;
const C_ORANGE = 0x9B5A10;
const C_YELLOW = 0x8B7322;
const C_CORAL = 0x9B3422;

const layers = [];
const layerRings = []; // Holographic stabilizing rings revolving around each layer axis
const layerDefs = [
    { type: 'grid', gridCols: 3, gridRows: 3, spacing: 1.5, x: -10, size: 1.0, color: C_CYAN, label: 'INPUT' },
    { type: 'grid', gridCols: 3, gridRows: 3, spacing: 1.6, x: -8.2, size: 1.2, color: C_CYAN, label: 'CONV1' },
    { type: 'grid', gridCols: 2, gridRows: 2, spacing: 1.7, x: -6.4, size: 1.3, color: C_CYAN, label: 'CONV2' },
    { type: 'grid', gridCols: 2, gridRows: 2, spacing: 1.4, x: -4.6, size: 1.0, color: C_BLUE, label: 'POOL1' },
    { type: 'grid', gridCols: 2, gridRows: 2, spacing: 1.5, x: -2.8, size: 1.1, color: C_BLUE, label: 'CONV3' },
    { type: 'grid', gridCols: 2, gridRows: 2, spacing: 1.2, x: -1.0, size: 0.9, color: C_BLUE, label: 'POOL2' },
    { type: 'ring', count: 10, radius: 1.8, x: 0.8, color: C_ORANGE, label: 'DENSE1' },
    { type: 'ring', count: 8, radius: 1.4, x: 2.6, color: C_ORANGE, label: 'DENSE2' },
    { type: 'ring', count: 6, radius: 1.0, x: 4.4, color: C_CORAL, label: 'LATENT' },
    { type: 'ring', count: 8, radius: 1.4, x: 6.2, color: C_ORANGE, label: 'DENSE3' },
    { type: 'grid', gridCols: 2, gridRows: 2, spacing: 1.4, x: 8.0, size: 1.2, color: C_BLUE, label: 'DECONV1' },
    { type: 'sheet', x: 9.8, size: 2.8, color: C_YELLOW, label: 'OUTPUT' }
];

// Generate 3D geometries for each CNN/ML architecture layer
layerDefs.forEach((def, layerIdx) => {
    const nodes = [];
    
    // Create revolving holographic outer caliper rings
    const ringRadius = def.type === 'ring' ? def.radius * 1.45 : (def.size ? def.size * 1.45 : 2.0);
    const ringGeo = new THREE.RingGeometry(ringRadius, ringRadius + 0.04, 32);
    const ringMat = new THREE.MeshBasicMaterial({
        color: def.color,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.y = Math.PI / 2; // Orient horizontally facing along the X-axis
    ringMesh.position.x = def.x;
    networkGroup.add(ringMesh);
    
    layerRings.push({
        mesh: ringMesh,
        speed: (layerIdx % 2 === 0 ? 1 : -1) * (0.004 + Math.random() * 0.005)
    });
    
    // Generate feature maps, dense layers, or output sheets
    if (def.type === 'grid') {
        const startY = -((def.gridRows - 1) * def.spacing) / 2;
        const startZ = -((def.gridCols - 1) * def.spacing) / 2;
        
        for (let r = 0; r < def.gridRows; r++) {
            for (let c = 0; c < def.gridCols; c++) {
                const nodePos = new THREE.Vector3(
                    def.x,
                    startY + r * def.spacing,
                    startZ + c * def.spacing
                );
                
                // Solid translucent feature bounding box
                const geo = new THREE.BoxGeometry(0.12, def.size, def.size);
                const mat = new THREE.MeshBasicMaterial({
                    color: def.color,
                    transparent: true,
                    opacity: 0.24,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                });
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.copy(nodePos);
                
                // Wireframe edges outline
                const edges = new THREE.EdgesGeometry(geo);
                const edgeMat = new THREE.LineBasicMaterial({
                    color: def.color,
                    opacity: 0.35,
                    transparent: true
                });
                const edgeLines = new THREE.LineSegments(edges, edgeMat);
                edgeLines.position.copy(nodePos);
                
                networkGroup.add(mesh);
                networkGroup.add(edgeLines);
                
                nodes.push({
                    position: nodePos,
                    mesh: mesh,
                    edge: edgeLines
                });
            }
        }
    } else if (def.type === 'ring') {
        for (let i = 0; i < def.count; i++) {
            const angle = (i / def.count) * Math.PI * 2;
            const nodePos = new THREE.Vector3(
                def.x,
                Math.sin(angle) * def.radius,
                Math.cos(angle) * def.radius
            );
            
            // Dense node sphere representation
            const geo = new THREE.SphereGeometry(0.16, 8, 8);
            const mat = new THREE.MeshBasicMaterial({
                color: def.color,
                transparent: true,
                opacity: 0.45,
                blending: THREE.AdditiveBlending
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(nodePos);
            
            // Small halo wireframe ring around dense node
            const edgeGeo = new THREE.RingGeometry(0.16, 0.19, 8);
            const edgeMat = new THREE.MeshBasicMaterial({
                color: def.color,
                opacity: 0.35,
                transparent: true,
                side: THREE.DoubleSide
            });
            const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
            edgeMesh.rotation.y = Math.PI / 2;
            edgeMesh.position.copy(nodePos);
            
            networkGroup.add(mesh);
            networkGroup.add(edgeMesh);
            
            nodes.push({
                position: nodePos,
                mesh: mesh,
                edge: edgeMesh
            });
        }
    } else if (def.type === 'sheet') {
        const nodePos = new THREE.Vector3(def.x, 0, 0);
        
        // Single flat architectural matrix layer sheet
        const geo = new THREE.BoxGeometry(0.12, def.size, def.size);
        const mat = new THREE.MeshBasicMaterial({
            color: def.color,
            transparent: true,
            opacity: 0.30,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(nodePos);
        
        // Edges outline
        const edges = new THREE.EdgesGeometry(geo);
        const edgeMat = new THREE.LineBasicMaterial({
            color: def.color,
            opacity: 0.35,
            transparent: true
        });
        const edgeLines = new THREE.LineSegments(edges, edgeMat);
        edgeLines.position.copy(nodePos);
        
        networkGroup.add(mesh);
        networkGroup.add(edgeLines);
        
        nodes.push({
            position: nodePos,
            mesh: mesh,
            edge: edgeLines
        });
    }
    
    layers.push({
        def: def,
        nodes: nodes
    });
});

// Skip connections (ResNet-like curves skipping layers for architectural complexity)
const skipConnections = [
    { fromLayer: 1, toLayer: 10, color: C_CYAN, height: 2.2 },
    { fromLayer: 2, toLayer: 9, color: C_CORAL, height: 2.8 },
    { fromLayer: 0, toLayer: 11, color: C_YELLOW, height: 3.5 },
    { fromLayer: 3, toLayer: 8, color: C_BLUE, height: 2.0 },
    { fromLayer: 4, toLayer: 7, color: C_ORANGE, height: 1.8 }
];

skipConnections.forEach(sc => {
    const fromNodes = layers[sc.fromLayer].nodes;
    const toNodes = layers[sc.toLayer].nodes;
    const n1 = fromNodes[Math.floor(fromNodes.length / 2)];
    const n2 = toNodes[Math.floor(toNodes.length / 2)];
    
    if (n1 && n2) {
        const p1 = n1.position.clone();
        const p2 = n2.position.clone();
        
        const midPoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        midPoint.y += sc.height;
        
        const curve = new THREE.CatmullRomCurve3([p1, midPoint, p2]);
        const points = curve.getPoints(40);
        const curveGeo = new THREE.BufferGeometry().setFromPoints(points);
        const curveMat = new THREE.LineBasicMaterial({
            color: sc.color,
            transparent: true,
            opacity: 0.30,
            linewidth: 1.5
        });
        const curveLine = new THREE.Line(curveGeo, curveMat);
        networkGroup.add(curveLine);
    }
});

// Synapse wire lines connecting adjacent layer nodes
const synapseMat = new THREE.LineBasicMaterial({
    color: 0x14201A,
    opacity: 0.12,
    transparent: true
});

for (let L = 0; L < layers.length - 1; L++) {
    const currentLayer = layers[L];
    const nextLayer = layers[L + 1];
    
    if (currentLayer.def.type === 'grid' && nextLayer.def.type === 'grid') {
        currentLayer.nodes.forEach(n1 => {
            nextLayer.nodes.forEach(n2 => {
                const dist = n1.position.distanceTo(n2.position);
                if (dist < 4.0) {
                    const geo = new THREE.BufferGeometry().setFromPoints([n1.position, n2.position]);
                    const line = new THREE.Line(geo, synapseMat);
                    networkGroup.add(line);
                }
            });
        });
    } else {
        currentLayer.nodes.forEach(n1 => {
            nextLayer.nodes.forEach(n2 => {
                const geo = new THREE.BufferGeometry().setFromPoints([n1.position, n2.position]);
                const line = new THREE.Line(geo, synapseMat);
                networkGroup.add(line);
            });
        });
    }
}

// Active flowing data packets running through the 3D grid
const pulses = [];
const maxPulses = 35;

const box3 = new THREE.Box3().setFromObject(networkGroup);
const center3 = box3.getCenter(new THREE.Vector3());
networkGroup.position.x = -center3.x; // Re-center node group

const networkWrapper = new THREE.Group();
networkWrapper.add(networkGroup);
scene.add(networkWrapper);

// Create packet pulse instances
for (let i = 0; i < maxPulses; i++) {
    const startLayer = Math.floor(Math.random() * (layers.length - 1));
    const startNodeIdx = Math.floor(Math.random() * layers[startLayer].nodes.length);
    const nextNodeIdx = Math.floor(Math.random() * layers[startLayer + 1].nodes.length);
    const p = {
        currentLayer: startLayer,
        sourceNode: layers[startLayer].nodes[startNodeIdx],
        targetNode: layers[startLayer + 1].nodes[nextNodeIdx],
        progress: Math.random(),
        speed: 0.01 + Math.random() * 0.015,
        mesh: new THREE.Mesh(
            new THREE.SphereGeometry(0.11, 6, 6),
            new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? C_CORAL : C_CYAN, transparent: true, opacity: 0.95 })
        )
    };
    networkGroup.add(p.mesh);
    pulses.push(p);
}

// Initial perspective tilt
networkWrapper.rotation.y = -Math.PI / 5;
networkWrapper.rotation.x = Math.PI / 12;

// Floating ambient background particles
const particlesGeo = new THREE.BufferGeometry();
const particleCount = 600;
const posArray = new Float32Array(particleCount * 3);

for(let i = 0; i < particleCount * 3; i++) {
    posArray[i] = (Math.random() - 0.5) * 40;
}
particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
const particlesMat = new THREE.PointsMaterial({
    size: 0.04,
    color: 0x6B5A30,
    transparent: true,
    opacity: 0.6,
    depthWrite: false
});
const particlesMesh = new THREE.Points(particlesGeo, particlesMat);
scene.add(particlesMesh);

// WebGL Resize handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Render Loop Execution
function render() {
    layerRings.forEach(r => {
        r.mesh.rotation.z += r.speed;
    });

    // Update active telemetry packets along synapses
    pulses.forEach((p, idx) => {
        p.progress += p.speed;
        if (p.progress >= 1) {
            p.currentLayer++;
            if (p.currentLayer >= layers.length - 1) {
                p.currentLayer = 0;
            }
            p.progress = 0;
            p.sourceNode = p.targetNode;
            
            const nextNodes = layers[p.currentLayer + 1].nodes;
            p.targetNode = nextNodes[Math.floor(Math.random() * nextNodes.length)];
        }
        
        p.mesh.position.lerpVectors(p.sourceNode.position, p.targetNode.position, p.progress);
        
        const pulseScale = 1.0 + 0.35 * Math.sin(Date.now() * 0.008 + idx);
        p.mesh.scale.set(pulseScale, pulseScale, pulseScale);
    });

    renderer.render(scene, camera);
    requestAnimationFrame(render);
}
render();

// Binds WebGL movements to Anime's requestAnimationFrame ticker
createTimeline({
    loop: true,
    direction: 'alternate',
    defaults: { ease: 'inOutSine' }
})
.add(networkGroup.rotation, {
    y: [-0.15, 0.15],
    x: [-0.1, 0.1],
    duration: 4000
}, 0)
.add(particlesMesh.rotation, {
    y: [0, -Math.PI / 4],
    duration: 20000,
    ease: 'linear',
    direction: 'normal'
}, 0);

// =========================================================================
// SECTION 4: Z-AXIS SCROLL PROXY & TIMING MATHEMATICS
// =========================================================================

const proxy = document.querySelector('.scroll-proxy');
const sections = document.querySelectorAll('.scroll-section');
const navLinks = document.querySelectorAll('nav a[href^="#"]');

// Scroll range distribution mapping (60% hold, 40% fly-through transition)
const timings = [
    { enterStart: 0, enterEnd: 0, holdEnd: 800, exitEnd: 1200 },         // 0: Hero
    { enterStart: 800, enterEnd: 1200, holdEnd: 1800, exitEnd: 2200 },   // 1: Project 1
    { enterStart: 1800, enterEnd: 2200, holdEnd: 2800, exitEnd: 3200 },  // 2: Project 2
    { enterStart: 2800, enterEnd: 3200, holdEnd: 3800, exitEnd: 4200 },  // 3: Project 3
    { enterStart: 3800, enterEnd: 4200, holdEnd: 4800, exitEnd: 5200 },  // 4: Project 4
    { enterStart: 4800, enterEnd: 5200, holdEnd: 5800, exitEnd: 6200 },  // 5: Journey
    { enterStart: 5800, enterEnd: 6200, holdEnd: 7200, exitEnd: 7600 },  // 6: Skills (increased hold)
    { enterStart: 7600, enterEnd: 8000, holdEnd: 8600, exitEnd: 9000 },  // 7: Metrics
    { enterStart: 9000, enterEnd: 9400, holdEnd: 10000, exitEnd: 10000 } // 8: Contact
];

/**
 * Calculates Z-depth and opacity for a specific index given global scroll position T (0-10000).
 * @param {number} idx 
 * @param {number} T 
 */
function getSectionStyle(idx, T) {
    const t = timings[idx];
    
    // Hero Section Style Solver
    if (idx === 0) {
        if (T <= t.holdEnd) {
            return { z: 0, opacity: 1 };
        } else if (T >= t.exitEnd) {
            return { z: 2000, opacity: 0 };
        } else {
            const p = (T - t.holdEnd) / (t.exitEnd - t.holdEnd);
            const easeP = Math.pow(p, 3);
            return { z: easeP * 2000, opacity: 1 - easeP };
        }
    }
    
    // Contact Section Style Solver
    if (idx === sections.length - 1) {
        if (T <= t.enterStart) {
            return { z: -4000, opacity: 0 };
        } else if (T >= t.enterEnd) {
            return { z: 0, opacity: 1 };
        } else {
            const p = (T - t.enterStart) / (t.enterEnd - t.enterStart);
            const easeP = 1 - Math.pow(1 - p, 3);
            return { z: -4000 + easeP * 4000, opacity: easeP };
        }
    }
    
    // Intermediate Section Style Solvers
    if (T <= t.enterStart) {
        return { z: -4000, opacity: 0 };
    } else if (T <= t.enterEnd) {
        const p = (T - t.enterStart) / (t.enterEnd - t.enterStart);
        const easeP = 1 - Math.pow(1 - p, 3);
        return { z: -4000 + easeP * 4000, opacity: easeP };
    } else if (T <= t.holdEnd) {
        return { z: 0, opacity: 1 };
    } else if (T <= t.exitEnd) {
        const p = (T - t.holdEnd) / (t.exitEnd - t.holdEnd);
        const easeP = Math.pow(p, 3);
        return { z: easeP * 2000, opacity: 1 - easeP };
    } else {
        return { z: 2000, opacity: 0 };
    }
}

/**
 * Refreshes DOM layout transforms, active nav states, and snaps indices.
 */
function updateActiveNavLink() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const currentScroll = window.scrollY;
    const T = maxScroll > 0 ? (currentScroll / maxScroll) * 10000 : 0;
    
    let index = 0;
    if (T < 1000) index = 0;
    else if (T < 2000) index = 1;
    else if (T < 3000) index = 2;
    else if (T < 4000) index = 3;
    else if (T < 5000) index = 4;
    else if (T < 6000) index = 5;
    else if (T < 7600) index = 6;
    else if (T < 9000) index = 7;
    else index = 8;
    
    // Apply 3D coordinate transformations to DOM sections
    sections.forEach((section, idx) => {
        const style = getSectionStyle(idx, T);
        
        section.style.transform = `translate3d(-50%, -50%, ${style.z}px)`;
        section.style.opacity = style.opacity;
        
        const isVisible = (style.opacity > 0.001);
        if (isVisible) {
            section.style.visibility = 'visible';
            section.style.pointerEvents = 'auto';
        } else {
            section.style.visibility = 'hidden';
            section.style.pointerEvents = 'none';
        }

        if (idx === index) {
            section.classList.add('section-active');
        } else {
            section.classList.remove('section-active');
        }
    });

    // Toggle active state classes on Vernier Scale ticks
    cachedVernierTicks.forEach((tick, idx) => {
        if (idx === index) {
            tick.classList.add('active');
        } else {
            tick.classList.remove('active');
        }
    });
    
    let targetHash = '#hero';
    if (index === 0) targetHash = '#hero';
    else if (index >= 1 && index <= 4) targetHash = '#projects';
    else if (index === 5) targetHash = '#journey';
    else if (index === 6) targetHash = '#skills';
    else if (index === 7) targetHash = '#metrics';
    else if (index === 8) targetHash = '#contact';

    navLinks.forEach(link => {
        if (link.getAttribute('href') === targetHash) {
            link.classList.remove('text-deep-slate-green/40');
            link.classList.add('text-laser-cyan', 'bg-deep-slate-green/5');
        } else {
            link.classList.add('text-deep-slate-green/40');
            link.classList.remove('text-laser-cyan', 'bg-deep-slate-green/5');
        }
    });

    // Snapped transition event dispatcher
    if (index !== lastActiveIndex) {
        lastActiveIndex = index;
        
        const activeSection = sections[index];
        if (activeSection) {
            const scrambleTargets = activeSection.querySelectorAll('[data-scramble]');
            scrambleTargets.forEach(el => triggerScramble(el));
        }
        
        if (index === 7) {
            triggerMetricsOdometer();
        }
        
        triggerVernierRipple(index);
    }
}

// Listen to native browser scrolls
window.addEventListener('scroll', updateActiveNavLink);

/**
 * Custom smooth scroll program to snap viewport cleanly to Z-axis coordinates.
 * @param {string} targetId 
 */
window.scrollToSection = function(targetId) {
    let targetSection = document.getElementById(targetId);
    if (!targetSection) return;

    const index = Array.from(sections).indexOf(targetSection);
    if (index === -1) return;

    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    let targetTime = 0;
    
    if (index === 0) {
        targetTime = 0;
    } else if (index === sections.length - 1) {
        targetTime = 10000;
    } else {
        const t = timings[index];
        targetTime = (t.enterEnd + t.holdEnd) / 2;
    }

    const targetScroll = (targetTime / 10000) * maxScroll;

    window.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
    });
    
    history.pushState(null, null, `#${targetId}`);
};

// Bind relative hash anchors to scrollToSection
document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href').substring(1);
        e.preventDefault();
        window.scrollToSection(targetId);
    });
});

// Handle browser back/forward navigation
window.addEventListener('popstate', () => {
    const hash = window.location.hash.substring(1);
    if (hash) {
        window.scrollToSection(hash);
    }
});

// Configure Anime.js scroll-driven timeline to synchronize camera motion with layout depth
const masterTl = createTimeline({
    defaults: { ease: 'linear' },
    autoplay: onScroll({
        target: '.scroll-proxy',
        enter: 'top top',
        leave: 'bottom bottom',
        sync: 0.1
    })
});

// Set initial transformations
sections.forEach((section, index) => {
    utils.set(section, {
        opacity: index === 0 ? 1 : 0,
        x: '-50%',
        y: '-50%',
        z: index === 0 ? 0 : -4000
    });
});

// Coordinate camera slide-through and grid spin
masterTl.add(camera.position, {
    z: [35, -5],
    duration: 10000
}, 0)
.add(networkWrapper.rotation, {
    y: [-Math.PI / 5, Math.PI * 2.5],
    z: [0, Math.PI * 2],
    duration: 10000
}, 0);

// Initialize layouts on initial run
updateActiveNavLink();

} catch (e) {
    console.warn('Three.js/WebGL initialization failed:', e.message);
    // Still run nav updates even without 3D
    updateActiveNavLink();
}

// =========================================================================
// SECTION 5: INTERACTIVE UI COMPONENTS (MAGNETIC BUTTONS & 3D FOCUSING)
// =========================================================================

// Magnetic Button Effect using spring physics
const magneticBtns = document.querySelectorAll('.magnetic-btn');
magneticBtns.forEach(btn => {
    const inner = btn.querySelector('.magnetic-inner');

    btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = (e.clientX - rect.left - rect.width / 2) * 0.4;
        const y = (e.clientY - rect.top - rect.height / 2) * 0.4;

        animate(inner, {
            x: x,
            y: y,
            ease: 'spring(1, 100, 15, 0)',
            composition: 'blend' 
        });
    });

    btn.addEventListener('mouseleave', () => {
        animate(inner, {
            x: 0,
            y: 0,
            ease: 'spring(1, 100, 15, 0)',
            composition: 'blend'
        });
    });
});

/**
 * Slide the WebGL camera viewport and highlight active layers in 3D node space.
 * @param {number} layerIndex 
 */
function focusNetworkOnLayer(layerIndex) {
    let targetX = 0;
    let targetY = 0;
    let targetZ = 0;
    let targetRotY = -Math.PI / 5;
    
    if (layerIndex === 0) {
        targetX = 4.5;
        targetY = 0.4;
        targetZ = -1;
        targetRotY = -Math.PI / 6;
    } else if (layerIndex === 1) {
        targetX = 0;
        targetY = 0;
        targetZ = 0;
        targetRotY = -Math.PI / 4;
    } else if (layerIndex === 2) {
        targetX = -4.5;
        targetY = -0.4;
        targetZ = 1;
        targetRotY = -Math.PI / 3;
    }
    
    animate(networkWrapper.position, {
        x: targetX,
        y: targetY,
        z: targetZ,
        duration: 1200,
        ease: 'outExpo'
    });
    
    animate(networkWrapper.rotation, {
        y: targetRotY,
        duration: 1200,
        ease: 'outExpo'
    });
    
    layers.forEach((l, idx) => {
        let isMatch = false;
        if (layerIndex === 0 && idx <= 2) isMatch = true;
        if (layerIndex === 1 && (idx >= 3 && idx <= 5)) isMatch = true;
        if (layerIndex === 2 && idx >= 6) isMatch = true;
        
        l.nodes.forEach(n => {
            animate(n.mesh.scale, {
                x: isMatch ? 1.6 : 1.0,
                y: isMatch ? 1.6 : 1.0,
                z: isMatch ? 1.6 : 1.0,
                duration: 800,
                ease: 'outExpo'
            });
            animate(n.mesh.material, {
                opacity: isMatch ? 0.45 : 0.12,
                duration: 800,
                ease: 'outExpo'
            });
        });
    });
}
window.focusNetworkOnLayer = focusNetworkOnLayer;

// =========================================================================
// SECTION 6: INTERACTIVE ORBITAL ENGINE (SKILLS SPHERE)
// =========================================================================

document.addEventListener('DOMContentLoaded', () => {
    const viewport = document.getElementById('skills-orbital');
    const cluster = document.getElementById('orbital-cluster');
    const nodes = document.querySelectorAll('.orbit-node');
    
    if (!viewport || !cluster || nodes.length === 0) return;

    let currentRotation = 0;
    let targetVelocity = 0.08;
    let currentVelocity = targetVelocity;
    
    let isDragging = false;
    let lastX = 0;
    
    const getOrbitRadius = () => window.innerWidth < 768 ? (window.innerWidth < 480 ? 130 : 180) : 340;
    
    let lastScrollY = window.scrollY;
    
    window.addEventListener('scroll', () => {
        const delta = window.scrollY - lastScrollY;
        lastScrollY = window.scrollY;
        currentVelocity += (delta * 0.015);
    }, { passive: true });

    const handleStart = (clientX) => {
        isDragging = true;
        lastX = clientX;
        viewport.style.cursor = 'grabbing';
    };

    const handleMove = (clientX) => {
        if (!isDragging) return;
        const dx = clientX - lastX;
        currentVelocity = dx * 0.4;
        lastX = clientX;
    };

    const handleEnd = () => {
        isDragging = false;
        viewport.style.cursor = 'grab';
    };

    viewport.addEventListener('mousedown', (e) => handleStart(e.clientX));
    window.addEventListener('mousemove', (e) => handleMove(e.clientX));
    window.addEventListener('mouseup', handleEnd);
    
    viewport.addEventListener('touchstart', (e) => handleStart(e.touches[0].clientX), { passive: true });
    window.addEventListener('touchmove', (e) => handleMove(e.touches[0].clientX), { passive: true });
    window.addEventListener('touchend', handleEnd);

    // Skills physics and layout rendering loop
    const renderLoop = () => {
        if (!isDragging) {
            currentVelocity += (targetVelocity - currentVelocity) * 0.05;
        }

        currentRotation += currentVelocity;
        cluster.style.transform = `rotateX(8deg) rotateY(${currentRotation}deg)`;
        
        const radius = getOrbitRadius();

        nodes.forEach((node) => {
            const angleOffset = parseFloat(node.getAttribute('data-angle'));
            const globalAngle = (currentRotation + angleOffset) % 360;
            const rad = globalAngle * (Math.PI / 180);
            
            const zDepth = Math.cos(rad);
            const normalizedZ = (zDepth + 1) / 2;
            
            const opacity = Math.pow(normalizedZ, 5); 
            const blur = (1 - normalizedZ) * 6;
            const scale = 0.5 + (normalizedZ * 0.6);
            
            node.style.transform = `translate3d(-50%, -50%, 0) rotateY(${angleOffset}deg) translateZ(${radius}px) rotateY(${-globalAngle}deg) rotateX(-8deg) scale(${scale})`;
            node.style.opacity = opacity;
            node.style.filter = `blur(${blur}px)`;
            
            const title = node.querySelector('.orbit-title');
            if (title) {
                title.style.color = '#1A2C42';
            }
            
            const detail = node.querySelector('.orbit-detail');
            if (detail) {
                if (normalizedZ > 0.8) {
                    const detailProgress = Math.min(1, (normalizedZ - 0.8) / 0.1);
                    detail.style.opacity = detailProgress;
                    detail.style.transform = `translateY(${(1 - detailProgress) * 10}px)`;
                } else {
                    detail.style.opacity = 0;
                    detail.style.transform = 'translateY(10px)';
                }
            }
        });

        requestAnimationFrame(renderLoop);
    };

    renderLoop();
});

// =========================================================================
// SECTION 7: VERNIER SCALE SCROLL HUD NAVIGATION
// =========================================================================

const vernierScale = document.getElementById('vernierScale');
const vernierMarker = document.getElementById('vernierMarker');

if (vernierScale && vernierMarker) {
    window.addEventListener('scroll', () => {
        const scrollPct = window.pageYOffset / (document.documentElement.scrollHeight - window.innerHeight);
        vernierMarker.style.top = `${Math.min(100, Math.max(0, scrollPct * 100))}%`;
    });
    
    vernierScale.addEventListener('click', (e) => {
        const rect = vernierScale.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        const pct = Math.min(1, Math.max(0, clickY / rect.height));
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        
        window.scrollTo({
            top: pct * maxScroll,
            behavior: 'smooth'
        });
    });
}

// =========================================================================
// SECTION 8: MOBILE NAVIGATION DRAWER
// =========================================================================

(function initMobileNav() {
    const hamburgerBtn = document.querySelector('#top-nav button');
    const drawer = document.getElementById('mobile-drawer');
    if (!hamburgerBtn || !drawer) return;

    const backdrop = drawer.querySelector('.mobile-drawer-backdrop');
    const closeBtn = drawer.querySelector('.mobile-drawer-close');
    const links = drawer.querySelectorAll('.mobile-drawer-link');

    function openDrawer() {
        drawer.classList.add('open');
        hamburgerBtn.querySelector('span').textContent = 'close';
        document.body.style.overflow = 'hidden';
    }

    function closeDrawer() {
        drawer.classList.remove('open');
        hamburgerBtn.querySelector('span').textContent = 'menu';
        document.body.style.overflow = '';
    }

    hamburgerBtn.addEventListener('click', () => {
        if (drawer.classList.contains('open')) {
            closeDrawer();
        } else {
            openDrawer();
        }
    });

    if (backdrop) backdrop.addEventListener('click', closeDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

    links.forEach(link => {
        link.addEventListener('click', (e) => {
            const targetId = link.getAttribute('href').substring(1);
            e.preventDefault();
            closeDrawer();
            setTimeout(() => window.scrollToSection(targetId), 300);
        });
    });
})();