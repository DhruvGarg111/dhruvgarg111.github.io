/**
 * Neural Background v8 — Performance-Optimised
 *
 * Uses InstancedMesh + merged geometries to reduce draw calls from ~220 to ~10.
 * Camera on CatmullRomCurve3 driven by scroll progress.
 *
 * Exposed: window.__neuralSetProgress(0-1, section)
 */
;(function () {
  'use strict';

  var canvas = document.getElementById('neural-bg-canvas');
  var prefersRM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isSmall = window.matchMedia('(max-width: 767px)').matches;

  function bail(reason) {
    document.body.classList.add('no-webgl-depth');
    if (canvas) canvas.dataset.neuralState = reason;
  }

  function hasWebGL() {
    try { var c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); }
    catch (e) { return false; }
  }

  if (!canvas || prefersRM) { bail('disabled'); return; }
  if (!window.THREE || !hasWebGL()) { bail('unavailable'); return; }

  var THREE = window.THREE;

  /* Hardware detection — reads the unified tier computed synchronously in
     index.html <head> (window.__deviceTier), which this lazy-loaded module
     is always guaranteed to see already set by the time it runs. Falls back
     to the old local heuristic only if that script somehow never ran.
     isLowEnd is true only for tier === 'low' ('med' gets the reduced-but-
     not-lowest settings elsewhere, e.g. maxPulses/pCount/frameInterval).
     isLowEnd is read once here to bake antialias/powerPreference into the
     WebGLRenderer constructor — those two are genuinely boot-frozen (they are
     constructor options; changing them needs a new GL context), so isLowEnd
     must NOT be reassigned by the devicetierchange listener below. The
     live-adjustable knobs that DO react to tier changes after boot are
     frameInterval, smokeEnabled/smokeQuarterRes/smokeFrameSkip, and the render
     pixel ratio (see renderDprCap — setPixelRatio, unlike the constructor
     options, can be changed on a live context). */
  var cores = navigator.hardwareConcurrency || 4;
  var tier = window.__deviceTier || (cores <= 4 || isSmall ? 'low' : 'high');
  var isLowEnd = tier === 'low'; // kept for the few genuinely binary knobs (antialias, powerPreference — see below)

  /* ═════════════════════════════════════════════════════════ */
  /* SCENE SETUP                                               */
  /* ═════════════════════════════════════════════════════════ */

  var scene = new THREE.Scene();
  var paperColor = 0xF0EBE0;
  scene.fog = new THREE.FogExp2(paperColor, isSmall ? 0.026 : 0.018);

  var renderer = new THREE.WebGLRenderer({
    canvas: canvas, alpha: true, antialias: !isLowEnd,
    powerPreference: isLowEnd ? 'low-power' : 'high-performance',
  });
  renderer.setClearColor(0x000000, 0);

  var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 1000);

  /* ═════════════════════════════════════════════════════════ */
  /* CAMERA PATH                                               */
  /* ═════════════════════════════════════════════════════════ */

  var cameraPath = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,   3, 32),
    new THREE.Vector3(3,   1, 24),
    new THREE.Vector3(-2,  0, 18),
    new THREE.Vector3(1,  -1, 12),
    new THREE.Vector3(-1,  1,  6),
    new THREE.Vector3(2,   0,  0),
    new THREE.Vector3(-1, -1, -6),
    new THREE.Vector3(1,   2, -12),
    new THREE.Vector3(0,   0, -18),
  ], false, 'catmullrom', 0.5);

  var lookAheadDelta = 0.03;

  /* ═════════════════════════════════════════════════════════ */
  /* SMOKE SHADER (3-octave FBM, lighter)                     */
  /* ═════════════════════════════════════════════════════════ */

  var smokeVS = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  var smokeFS = [
    'uniform float uTime;',
    'uniform vec2 uMouse;',
    'uniform float uScroll;',
    'uniform vec2 uRes;',
    'varying vec2 vUv;',
    '',
    'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5); }',
    'float noise(vec2 p) {',
    '  vec2 i = floor(p); vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1,0)), u.x),',
    '             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);',
    '}',
    'float fbm(vec2 x) {',
    '  float v = 0.0; float a = 0.5; vec2 shift = vec2(100.0);',
    '  mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));',
    '  for (int i = 0; i < 3; ++i) { v += a * noise(x); x = rot * x * 2.0 + shift; a *= 0.5; }',
    '  return v;',
    '}',
    'void main() {',
    '  float aspect = uRes.x / uRes.y;',
    '  vec2 uv = vUv;',
    '  vec2 mouseDist = vec2(uv.x * aspect, uv.y) - vec2(uMouse.x * aspect, uMouse.y);',
    '  float dist = length(mouseDist);',
    '  float warp = smoothstep(0.35, 0.0, dist) * 0.08;',
    '  vec2 smokeUv = uv * 2.5 + normalize(mouseDist + vec2(0.001)) * warp;',
    '  smokeUv.y -= uScroll * 0.8 + uTime * 0.015;',
    '  smokeUv.x += sin(uTime * 0.01) * 0.02;',
    '  float n1 = fbm(smokeUv);',
    '  float n2 = fbm(smokeUv + vec2(n1 * 1.5) + vec2(uTime * 0.008));',
    '  float alpha = smoothstep(0.15, 0.72, n2) * 0.45;',
    '  if (alpha < 0.01) discard;',
    '  alpha *= mix(0.15, 1.0, smoothstep(0.06, 0.38, dist));',
    '  vec3 col = mix(vec3(0.94, 0.92, 0.88), vec3(1.0, 0.97, 0.91), 0.35 + uScroll * 0.25);',
    '  gl_FragColor = vec4(col, alpha);',
    '}'
  ].join('\n');

  /* Perf: the FBM smoke shader is the most expensive per-pixel cost in this
     scene (3-octave noise, full-screen, every frame). Rather than rendering
     it at full canvas resolution as part of the main pass, render it into a
     small offscreen target (half res, or less on constrained devices) and
     composite that texture as a full-screen overlay — noise detail doesn't
     need native resolution. Skipped entirely on isLowEnd (kept as a flat,
     static wash via the fallback below) since it's ambience, not content. */
  /* Three real states instead of a binary skip: `low` drops the FBM smoke
     pass entirely (it's ambience, not content — see the comment above).
     `high` runs it every frame at half-canvas-res (existing behavior).
     `med` now runs it too, just at half that resolution again and only
     every other frame — same visual read (a slow drifting wash), a
     fraction of the fill-rate cost. */
  var smokeEnabled = tier !== 'low';
  var smokeQuarterRes = tier === 'med';
  var smokeFrameSkip = tier === 'med'; // update the smoke uniforms every 2nd frame only
  var smokeFrameToggle = false;
  var smokeGeo = new THREE.PlaneGeometry(2, 2);
  var smokeMat = new THREE.ShaderMaterial({
    vertexShader: smokeVS, fragmentShader: smokeFS,
    uniforms: {
      uTime: { value: 0 }, uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uScroll: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) },
    },
    transparent: true, depthWrite: false,
  });
  var smokeMesh = new THREE.Mesh(smokeGeo, smokeMat);
  var smokeScene = new THREE.Scene();
  smokeScene.add(smokeMesh);
  var smokeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
  smokeCamera.position.z = 1;

  /* Always allocated (this module only loads in webgl bgMode — a capable
     device), so a live tier RECOVERY can re-enable smoke even if the module
     happened to initialize during a transient 'low' tier reading. It's just
     a small offscreen target; whether we actually render into it each frame
     is gated by smokeEnabled below, so a device that stays 'low' pays no
     per-frame smoke cost. */
  var smokeRT = new THREE.WebGLRenderTarget(2, 2, { depthBuffer: false, stencilBuffer: false });

  /* Full-screen overlay quad that composites smokeRT's texture on top of the
     already-rendered network scene, in a second render pass (autoClear:false)
     — reproduces the original "smoke drawn over the network" layering without
     paying full-resolution shader cost. */
  var overlayScene = new THREE.Scene();
  /* The smoke is rendered into smokeRT (cleared to transparent black) with the
     shader's default NormalBlending, so its texels come out PREMULTIPLIED
     (rgb already scaled by the fragment's own alpha, e.g. light 0.94 * 0.45 ≈
     0.42). Compositing that texture back over the scene must therefore use a
     premultiplied-over blend (src*1 + dst*(1-srcAlpha)). The old default
     (straight-alpha NormalBlending, src*srcAlpha + dst*(1-srcAlpha)) multiplied
     the already-premultiplied rgb by alpha a SECOND time, collapsing the light
     0.42 haze to ~0.19 — a mid-grey film over the whole page ("random dark film
     on load"). CustomBlending with OneFactor / OneMinusSrcAlphaFactor is the
     correct premultiplied composite and keeps the smoke reading as a light
     wash. Verified: open-background luminance 195 (veil) -> 232 (paper). */
  var overlayMat = new THREE.MeshBasicMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    map: smokeRT.texture,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  var overlayMesh = new THREE.Mesh(smokeGeo, overlayMat);
  overlayScene.add(overlayMesh);

  /* ═════════════════════════════════════════════════════════ */
  /* COLORS & SHARED GEOMETRY                                  */
  /* ═════════════════════════════════════════════════════════ */

  /* Color palette matched to design system tokens */
  var colorPalette = {
    cyan:   new THREE.Color(0x6CB4C4),   // slate-blue-light
    blue:   new THREE.Color(0x3D72A4),   // datum blue
    orange: new THREE.Color(0xB24F20),   // survey burnt-orange
    coral:  new THREE.Color(0xE87428),   // warm coral
    yellow: new THREE.Color(0xE8B86D),   // gold accent
  };

  var sphereGeo = new THREE.SphereGeometry(0.16, 8, 8);
  var pulseGeo = new THREE.SphereGeometry(0.11, 6, 6);
  var boxGeoBase = new THREE.BoxGeometry(0.12, 1.0, 1.0);

  var networkGroup = new THREE.Group();
  scene.add(networkGroup);

  /* ═════════════════════════════════════════════════════════ */
  /* LAYER DEFINITIONS                                         */
  /* ═════════════════════════════════════════════════════════ */

  var layerDefs = [
    { type: 'grid', cols: 3, rows: 3, spacing: 1.5, z: 25, size: 1.0, color: 'cyan' },
    { type: 'grid', cols: 3, rows: 3, spacing: 1.6, z: 21, size: 1.2, color: 'cyan' },
    { type: 'ring', count: 10, radius: 1.8, z: 17, color: 'blue' },
    { type: 'grid', cols: 2, rows: 2, spacing: 1.4, z: 13, size: 1.0, color: 'blue' },
    { type: 'ring', count: 8, radius: 1.4, z: 9, color: 'orange' },
    { type: 'grid', cols: 2, rows: 2, spacing: 1.2, z: 5, size: 0.9, color: 'blue' },
    { type: 'ring', count: 6, radius: 1.0, z: 1, color: 'coral' },
    { type: 'grid', cols: 2, rows: 2, spacing: 1.4, z: -3, size: 1.1, color: 'orange' },
    { type: 'ring', count: 8, radius: 1.4, z: -7, color: 'blue' },
    { type: 'grid', cols: 2, rows: 2, spacing: 1.5, z: -11, size: 1.2, color: 'cyan' },
    { type: 'sheet', z: -15, size: 2.8, color: 'yellow' },
  ];

  /* Collect node positions per layer for synapses + per-instance colors */
  var layers = [];
  var allSpherePositions = [];
  var allSphereColors = [];
  var allBoxPositions = [];
  var allBoxColors = [];
  var allBoxScales = [];
  var allHaloData = [];
  var allHaloColors = [];

  layerDefs.forEach(function (def) {
    var nodes = [];
    var col = colorPalette[def.color] || colorPalette.blue;

    /* Halo ring */
    var haloR = def.type === 'ring' ? def.radius * 1.4 : (def.size || 1) * 1.4;
    allHaloData.push({ radius: haloR, z: def.z });
    allHaloColors.push(col);

    if (def.type === 'grid') {
      var sy = -((def.rows - 1) * def.spacing) / 2;
      var sx = -((def.cols - 1) * def.spacing) / 2;
      for (var r = 0; r < def.rows; r++) {
        for (var c = 0; c < def.cols; c++) {
          var pos = new THREE.Vector3(sx + c * def.spacing, sy + r * def.spacing, def.z);
          allBoxPositions.push(pos);
          allBoxColors.push(col);
          allBoxScales.push(new THREE.Vector3(1, def.size, def.size));
          nodes.push({ position: pos, color: col });
        }
      }
    } else if (def.type === 'ring') {
      for (var i = 0; i < def.count; i++) {
        var angle = (i / def.count) * Math.PI * 2;
        var p = new THREE.Vector3(Math.cos(angle) * def.radius, Math.sin(angle) * def.radius, def.z);
        allSpherePositions.push(p);
        allSphereColors.push(col);
        nodes.push({ position: p, color: col });
      }
    } else if (def.type === 'sheet') {
      var sp = new THREE.Vector3(0, 0, def.z);
      allBoxPositions.push(sp);
      allBoxColors.push(col);
      allBoxScales.push(new THREE.Vector3(1, def.size, def.size));
      nodes.push({ position: sp, color: col });
    }

    layers.push({ def: def, nodes: nodes });
  });

  /* ═════════════════════════════════════════════════════════ */
  /* INSTANCED MESHES — batch identical geometries             */
  /* ═════════════════════════════════════════════════════════ */

  var dummy = new THREE.Object3D();

  /* Sphere nodes (InstancedMesh) — white base so setColorAt works correctly */
  var sphereCount = allSpherePositions.length;
  /* NOTE: this opacity is mirrored as baseSpOp in updateAtmosphere() — that
     function rewrites .opacity every frame, so changing it here alone has no
     lasting effect. Same for boxMat/haloMat below. */
  var sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.96, depthWrite: false, fog: true });
  var sphereInstanced = new THREE.InstancedMesh(sphereGeo, sphereMat, sphereCount);
  allSpherePositions.forEach(function (pos, i) {
    dummy.position.copy(pos);
    dummy.updateMatrix();
    sphereInstanced.setMatrixAt(i, dummy.matrix);
    sphereInstanced.setColorAt(i, allSphereColors[i]);
  });
  sphereInstanced.instanceMatrix.needsUpdate = true;
  if (sphereInstanced.instanceColor) sphereInstanced.instanceColor.needsUpdate = true;
  networkGroup.add(sphereInstanced);

  /* Box nodes (InstancedMesh) — white base so setColorAt works correctly */
  var boxCount = allBoxPositions.length;
  var boxMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, depthWrite: false, fog: true });
  var boxInstanced = new THREE.InstancedMesh(boxGeoBase, boxMat, boxCount);
  allBoxPositions.forEach(function (pos, i) {
    dummy.position.copy(pos);
    dummy.scale.copy(allBoxScales[i]);
    dummy.updateMatrix();
    boxInstanced.setMatrixAt(i, dummy.matrix);
    boxInstanced.setColorAt(i, allBoxColors[i]);
  });
  boxInstanced.instanceMatrix.needsUpdate = true;
  if (boxInstanced.instanceColor) boxInstanced.instanceColor.needsUpdate = true;
  networkGroup.add(boxInstanced);

  /* Halo rings (InstancedMesh) — white base so setColorAt works correctly */
  var haloCount = allHaloData.length;
  var haloGeo = new THREE.RingGeometry(1, 1.04, 32); // unit ring, scaled per instance
  var haloMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.74, depthWrite: false, fog: true, side: THREE.DoubleSide });
  var haloInstanced = new THREE.InstancedMesh(haloGeo, haloMat, haloCount);
  allHaloData.forEach(function (h, i) {
    dummy.position.set(0, 0, h.z);
    dummy.scale.set(h.radius, h.radius, 1);
    dummy.updateMatrix();
    haloInstanced.setMatrixAt(i, dummy.matrix);
    haloInstanced.setColorAt(i, allHaloColors[i]);
  });
  haloInstanced.instanceMatrix.needsUpdate = true;
  if (haloInstanced.instanceColor) haloInstanced.instanceColor.needsUpdate = true;
  networkGroup.add(haloInstanced);

  /* ═════════════════════════════════════════════════════════ */
  /* MERGED SYNAPSES — single LineSegments draw call            */
  /* ═════════════════════════════════════════════════════════ */

  /* Synapses — vertex-colored gradients between layer colors */
  var synapsePoints = [];
  var synapseColors = [];
  for (var li = 0; li < layers.length - 1; li++) {
    var c1 = layers[li].def.color ? colorPalette[layers[li].def.color] : colorPalette.blue;
    var c2 = layers[li + 1].def.color ? colorPalette[layers[li + 1].def.color] : colorPalette.blue;
    layers[li].nodes.forEach(function (n1) {
      layers[li + 1].nodes.forEach(function (n2) {
        if (n1.position.distanceTo(n2.position) > 6.0) return;
        synapsePoints.push(n1.position.x, n1.position.y, n1.position.z);
        synapseColors.push(c1.r, c1.g, c1.b);
        synapsePoints.push(n2.position.x, n2.position.y, n2.position.z);
        synapseColors.push(c2.r, c2.g, c2.b);
      });
    });
  }

  if (synapsePoints.length > 0) {
    var synapseGeo = new THREE.BufferGeometry();
    synapseGeo.setAttribute('position', new THREE.Float32BufferAttribute(synapsePoints, 3));
    synapseGeo.setAttribute('color', new THREE.Float32BufferAttribute(synapseColors, 3));
    var synapseLine = new THREE.LineSegments(synapseGeo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.58, fog: true })
    );
    networkGroup.add(synapseLine);
  }

  /* Skip arcs — color-coded by source layer */
  var arcPoints = [];
  var arcColors = [];
  [[0, 9, 3], [1, 8, 2.5], [2, 7, 2.8], [3, 6, 2]].forEach(function (a) {
    var from = layers[a[0]].nodes;
    var to = layers[a[1]].nodes;
    var n1 = from[Math.floor(from.length / 2)];
    var n2 = to[Math.floor(to.length / 2)];
    if (!n1 || !n2) return;
    var ac1 = colorPalette[layers[a[0]].def.color] || colorPalette.blue;
    var ac2 = colorPalette[layers[a[1]].def.color] || colorPalette.blue;
    var mid = new THREE.Vector3().addVectors(n1.position, n2.position).multiplyScalar(0.5);
    mid.x += a[2]; mid.y += a[2];
    var curve = new THREE.CatmullRomCurve3([n1.position.clone(), mid, n2.position.clone()]);
    var pts = curve.getPoints(20);
    for (var k = 0; k < pts.length - 1; k++) {
      var t = k / (pts.length - 2);
      var cr = ac1.r + (ac2.r - ac1.r) * t;
      var cg = ac1.g + (ac2.g - ac1.g) * t;
      var cb = ac1.b + (ac2.b - ac1.b) * t;
      arcPoints.push(pts[k].x, pts[k].y, pts[k].z);
      arcColors.push(cr, cg, cb);
      arcPoints.push(pts[k + 1].x, pts[k + 1].y, pts[k + 1].z);
      arcColors.push(cr, cg, cb);
    }
  });

  var arcLine = null;
  if (arcPoints.length > 0) {
    var arcGeo = new THREE.BufferGeometry();
    arcGeo.setAttribute('position', new THREE.Float32BufferAttribute(arcPoints, 3));
    arcGeo.setAttribute('color', new THREE.Float32BufferAttribute(arcColors, 3));
    arcLine = new THREE.LineSegments(arcGeo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.78, fog: true })
    );
    networkGroup.add(arcLine);
  }

  /* ═════════════════════════════════════════════════════════ */
  /* PULSES — InstancedMesh                                    */
  /* ═════════════════════════════════════════════════════════ */

  var maxPulses = tier === 'low' ? 8 : tier === 'med' ? 13 : 18;
  var paletteValues = Object.values(colorPalette);
  /* White base so setColorAt can apply palette colors per pulse */
  var pulseMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false, fog: true });
  var pulseInstanced = new THREE.InstancedMesh(pulseGeo, pulseMat, maxPulses);
  var pulses = [];

  for (var pi = 0; pi < maxPulses; pi++) {
    var startLayer = Math.floor(Math.random() * (layers.length - 1));
    var sn = layers[startLayer].nodes[Math.floor(Math.random() * layers[startLayer].nodes.length)];
    var tn = layers[startLayer + 1].nodes[Math.floor(Math.random() * layers[startLayer + 1].nodes.length)];
    var pulseColor = colorPalette[layers[startLayer].def.color] || paletteValues[pi % paletteValues.length];
    pulseInstanced.setColorAt(pi, pulseColor);
    pulses.push({ layer: startLayer, src: sn, tgt: tn, prog: Math.random(), speed: 0.005 + Math.random() * 0.008 });
  }
  if (pulseInstanced.instanceColor) pulseInstanced.instanceColor.needsUpdate = true;
  networkGroup.add(pulseInstanced);

  /* ═════════════════════════════════════════════════════════ */
  /* PARTICLES                                                 */
  /* ═════════════════════════════════════════════════════════ */

  var pCount = tier === 'low' ? 80 : tier === 'med' ? 160 : 250;
  var pPos = new Float32Array(pCount * 3);
  for (var pp = 0; pp < pPos.length; pp++) pPos[pp] = (Math.random() - 0.5) * 50;
  var pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  var particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.04, color: 0x968D7B, transparent: true, opacity: 0.92, depthWrite: false, fog: true,
  }));
  /* Base hue for the per-section hueShift nudge (see SEGMENT_MOTION). Copied
     from — never mutated in place — so the offset can't accumulate. */
  var particlesBaseColor = particles.material.color.clone();
  scene.add(particles);

  /* Network tilt */
  networkGroup.rotation.x = Math.PI / 14;
  networkGroup.rotation.y = -Math.PI / 8;

  /* Framing. The network is built on the world axis (x=0, y=0) but at scroll 0
     the camera sits at (0, 3, 32) aimed at the path's look-ahead point near
     (0.6, 2.7, 30). That sight line runs right and down relative to the
     structure, which therefore lands left of frame and gets clipped — the one
     view every visitor is guaranteed to see, and the view the boot morph
     resolves in.

     The offset needed to centre it there is far too large to apply
     statically: the camera path only wanders x within [-2, 3], so parking the
     group at x≈9 would leave the camera flying *past* the tunnel instead of
     through it for the whole drill. So the offset decays to zero over the
     first slice of scroll — framed at the surface, back on-axis by the time
     the descent actually begins. tick() drives it; these are the boot values
     buildLattice measures against. */
  /* Solved, not guessed: projecting every node instance through the boot
     camera gives ~50px of horizontal and ~54px of vertical screen travel per
     world unit at this distance. These values put the structure's centroid on
     the middle of the plate's type column — open paper, where it actually
     reads — instead of centred in the raw viewport, where it collided with
     the opaque field panel and overflowed the bottom edge by ~175px. */
  var HERO_FRAME_X = 8.9;
  var HERO_FRAME_Y = 3.4;
  /* Scroll fraction over which the framing hands back to the camera path.
     Matched to the hero's own range in SECTIONS (0.00-0.10): the offset is
     fully surrendered exactly as the first stratum takes over, so no stratum
     is ever composed against a network that is still sliding. */
  var HERO_FRAME_FADE = 0.10;
  networkGroup.position.set(HERO_FRAME_X, HERO_FRAME_Y, 0);

  /* ═════════════════════════════════════════════════════════ */
  /* BOOT MORPH — ball/block lattice resolves into the network  */
  /* ═════════════════════════════════════════════════════════ */

  /* A flat, evenly-spaced grid of the same instances the network is built
     from, sized to fill the frustum at scroll progress 0, that lerps into the
     real layered structure once the loader hands off. Geometry only: the
     camera is never touched, so this cannot fight __neuralSetProgress. No new
     meshes, no new draw calls, no new dependency — the existing instances are
     simply somewhere else for the hold-plus-morph window below. */

  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

  var MORPH_MS = 6300;
  /* Held back from the surface-lock signal so the morph doesn't collide with
     the loader clearing and the hero letter-assemble. It reads as its own
     beat instead of a third thing happening at once. */
  var MORPH_DELAY_MS = 2700;
  /* Large enough that the blocks read as solid samples in the lattice rather
     than as specks; still well under their resolved network scale so the
     morph has somewhere to grow from. */
  var LATTICE_BOX_SCALE = 0.42;
  var morphT = 1;               // 1 = fully resolved network; the no-morph resting state
  var morphState = 'off';       // 'off' | 'armed' | 'running' | 'done'
  var morphStartedAt = 0;
  function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  /* Wall-clock time this document has spent hidden, which stepMorph subtracts
     so the morph measures *watched* time rather than elapsed time. Seeded at
     module scope because a tab opened in the background is hidden from its
     very first frame, and `visibilitychange` does NOT fire for a page that
     loaded already-hidden — without this the 1.8s hold + 4.2s morph burns
     through before the visitor ever switches to the tab, and they arrive at a
     resolved network having seen none of it. Middle-click, "open in new tab"
     from search results and restored sessions all land here. */
  var hiddenSince = document.hidden ? nowMs() : 0;
  var hiddenTotal = 0;
  var latticeSpheres = [];
  var latticeBoxes = [];

  /* Skipped on the low tier: a device that already can't hold cadence should
     spend its budget on the resting scene, not on a boot flourish. */
  var morphEnabled = tier !== 'low';

  function buildLattice() {
    var total = sphereCount + boxCount;
    if (total === 0) return;
    /* Fill the frustum at the boot camera position with a roughly square grid.
       The plane is built in WORLD space and converted per-point with
       worldToLocal, so the group's rotation *and* its framing offset are both
       accounted for — the lattice fills the screen regardless of where the
       network itself sits.
       Aspect comes from the window, not camera.aspect — resize() hasn't run
       yet at this point in boot, so camera.aspect is still its constructor 1. */
    var camPos = cameraPath.getPointAt(0);
    var planeZ = camPos.z - 16;
    var halfH = Math.tan((camera.fov * Math.PI / 180) / 2) * Math.abs(camPos.z - planeZ);
    var halfW = halfH * Math.max(1, (window.innerWidth || 1) / (window.innerHeight || 1));
    /* Centre the grid on the camera's own axis rather than the world origin,
       so it reads as a full-frame field instead of one pushed off to a corner. */
    var cx = camPos.x;
    var cy = camPos.y;
    var cols = Math.ceil(Math.sqrt(total * (halfW / halfH)));
    var rows = Math.ceil(total / cols);
    var stepX = (halfW * 2) / Math.max(1, cols - 1);
    var stepY = (halfH * 2) / Math.max(1, rows - 1);

    /* worldToLocal reads matrixWorld, which three.js only refreshes during
       render — and buildLattice runs before the first one. Without this the
       matrix is still identity and the conversion silently no-ops, so the
       lattice ignores both the group's tilt and its framing offset. */
    networkGroup.updateMatrixWorld(true);

    latticeSpheres.length = 0;
    latticeBoxes.length = 0;
    /* Interleave the two meshes across the grid so the lattice reads as one
       uniform field of mixed material samples rather than balls on one side
       and blocks on the other. */
    var si = 0, bi = 0;
    for (var n = 0; n < total; n++) {
      var col = n % cols;
      var row = Math.floor(n / cols);
      var v = new THREE.Vector3(cx - halfW + col * stepX, cy - halfH + row * stepY, planeZ);
      networkGroup.worldToLocal(v);
      var takeSphere = (n % 2 === 0 && si < sphereCount) || bi >= boxCount;
      if (takeSphere && si < sphereCount) { latticeSpheres[si++] = v; }
      else if (bi < boxCount) { latticeBoxes[bi++] = v; }
      else if (si < sphereCount) { latticeSpheres[si++] = v; }
    }
  }

  /* The single owner of every morph matrix write. t=0 lattice, t=1 network. */
  function applyMorph(t) {
    var i;
    /* dummy is shared, and nothing in these loops rotates — set the resting
       orientation once per call rather than once per instance. */
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    for (i = 0; i < sphereCount; i++) {
      var lp = latticeSpheres[i] || allSpherePositions[i];
      dummy.position.lerpVectors(lp, allSpherePositions[i], t);
      dummy.updateMatrix();
      sphereInstanced.setMatrixAt(i, dummy.matrix);
    }
    sphereInstanced.instanceMatrix.needsUpdate = true;

    for (i = 0; i < boxCount; i++) {
      var lb = latticeBoxes[i] || allBoxPositions[i];
      dummy.position.lerpVectors(lb, allBoxPositions[i], t);
      dummy.scale.set(
        LATTICE_BOX_SCALE + (1 - LATTICE_BOX_SCALE) * t,
        LATTICE_BOX_SCALE + (allBoxScales[i].y - LATTICE_BOX_SCALE) * t,
        LATTICE_BOX_SCALE + (allBoxScales[i].z - LATTICE_BOX_SCALE) * t
      );
      dummy.updateMatrix();
      boxInstanced.setMatrixAt(i, dummy.matrix);
    }
    boxInstanced.instanceMatrix.needsUpdate = true;

    /* Halos are the "structure has settled" cue — they arrive last. */
    var haloT = clamp01((t - 0.55) / 0.45);
    for (i = 0; i < haloCount; i++) {
      var h = allHaloData[i];
      dummy.position.set(0, 0, h.z);
      dummy.scale.set(h.radius * haloT, h.radius * haloT, 1);
      dummy.updateMatrix();
      haloInstanced.setMatrixAt(i, dummy.matrix);
    }
    haloInstanced.instanceMatrix.needsUpdate = true;

    /* Lines can't be drawn in per-vertex without touching the buffer, so they
       fade instead (per-vertex draw-in is explicitly out of scope). */
    var lineT = clamp01((t - 0.6) / 0.4);
    /* These three targets mirror the material constructors above; unlike the
       sphere/box/halo set they are not rewritten by updateAtmosphere, so this
       is the only other place they appear. Keep them in step or the network
       snaps brightness the instant the morph finishes. */
    if (synapseLine) synapseLine.material.opacity = 0.58 * lineT;
    if (arcLine) arcLine.material.opacity = 0.78 * lineT;

    particles.material.opacity = 0.92 * clamp01((t - 0.3) / 0.7);
    pulseInstanced.visible = t >= 1;
  }

  function stepMorph() {
    if (morphState !== 'running') return;
    /* Deliberately reads the clock itself rather than taking tick()'s `now`:
       under the GSAP ticker that value is elapsed-since-ticker-start, not a
       performance.now() timestamp, so subtracting morphStartedAt from it
       would yield a negative age and run the morph backwards. */
    var now = nowMs();
    /* The delay is subtracted here rather than deferred with a second
       setTimeout so there is still exactly one clock and one owner of the
       morph's progress. age < 0 simply holds at the lattice.
       hiddenTotal discounts time the tab spent in the background, so the
       morph always plays in front of someone. */
    var age = (now - morphStartedAt - hiddenTotal) - MORPH_DELAY_MS;
    if (age < 0) return;
    var raw = Math.min(1, age / MORPH_MS);
    /* power3.inOut, inlined — the morph must not depend on GSAP being present. */
    var eased = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
    morphT = eased;
    applyMorph(morphT);
    if (raw >= 1) {
      morphState = 'done';
      morphT = 1;
    }
  }

  function beginMorph() {
    if (morphState !== 'armed') return;
    morphStartedAt = nowMs();
    morphState = 'running';
  }

  if (morphEnabled) {
    buildLattice();
    morphT = 0;
    morphState = 'armed';
    applyMorph(0);
    /* Latch first, event second. script.js sets window.__surfaceLocked before
       dispatching, and this module is lazy-loaded on idle — so by the time it
       runs the event may already have come and gone. Checking the flag is what
       stops the lattice being stranded on screen forever. */
    if (window.__surfaceLocked) {
      beginMorph();
    } else {
      window.addEventListener('hero:surface-lock', beginMorph, { once: true });
      /* Belt and braces: if the loader never signals at all (its own ceiling
         timer failing, a JS error upstream), resolve anyway rather than
         leaving a visitor looking at a permanent dot grid. beginMorph's
         'armed' guard makes the later of the two calls a no-op. */
      setTimeout(beginMorph, 3000);
    }
  }

  /* ═════════════════════════════════════════════════════════ */
  /* INPUT & RESIZE                                            */
  /* ═════════════════════════════════════════════════════════ */

  var mouse = { x: 0, y: 0 };
  var shaderMouse = new THREE.Vector2(0.5, 0.5);
  var scrollProgress = 0;
  var targetProgress = 0;
  var sectionManifest = Array.isArray(window.__groundTruthSections) ? window.__groundTruthSections : [];
  var activeSection = null;
  var viewW = window.innerWidth;
  var viewH = window.innerHeight;
  var resizeRafId = 0;
  var disposed = false;

  function normalizeSection(sec) {
    if (!sec) return null;
    return {
      id: sec.id,
      seg: sec.seg || null,
      start: Number(sec.start),
      end: Number(sec.end),
      atmosphereDark: !!sec.atmosphereDark,
      dark: !!sec.dark,
    };
  }

  /* One entry per project segment already used elsewhere in the app
     (perception/training/infra/interface — see SECTIONS in script.js).
     driftMul scales the existing particle rotation speed
     (particles.rotation.y -= 0.0006 * driftMul); hueShift nudges the
     ambient particle material's hue via offsetHSL, copied fresh from a
     stored base each frame so it never accumulates or replaces the palette. */
  var SEGMENT_MOTION = {
    perception:     { driftMul: 1.3, hueShift: 0.00 },  // faster drift — scanning/ROI-tightening read
    training:       { driftMul: 0.6, hueShift: 0.04 },  // slower, denser — internal system state
    infra:          { driftMul: 1.0, hueShift: -0.03 }, // baseline — structured flow
    interface:      { driftMul: 0.85, hueShift: 0.02 }, // observable, user-facing
  };
  function segmentMotion(seg) {
    return SEGMENT_MOTION[seg] || { driftMul: 1, hueShift: 0 };
  }

  window.__neuralSetSections = function (sections) {
    sectionManifest = Array.isArray(sections)
      ? sections.map(normalizeSection).filter(Boolean)
      : [];
  };

  window.__neuralSetProgress = function (p, section) {
    targetProgress = Math.max(0, Math.min(1, p));
    if (section) activeSection = normalizeSection(section);
  };

  function bindInput() {
    window.addEventListener('mousemove', function (e) {
      mouse.x = (e.clientX / viewW - 0.5) * 2;
      mouse.y = (e.clientY / viewH - 0.5) * 2;
      shaderMouse.x = e.clientX / viewW;
      shaderMouse.y = 1 - e.clientY / viewH;
    }, { passive: true });
  }

  /* Render resolution. Unlike `antialias` and `powerPreference` — which are
     WebGLRenderer *constructor* options and genuinely do need a new GL context
     to change — setPixelRatio is live-adjustable, so a device that turns out
     mid-session to be unable to hold cadence can shed fill-rate cost, which on
     a fragment-bound scene like this one is the single largest lever available
     after cadence itself.

     Deliberately a one-way ratchet *below* the boot value, never above it: a
     device that is coping sees exactly the resolution it always did, and only
     one that has demonstrably failed (the frame-time watcher stepped its tier
     down) trades background sharpness for frame rate. That is the same trade
     tier-low devices already take at boot, just applied on evidence rather
     than on the hardware guess. On a DPR-1 display this is a no-op. */
  var bootDprCap = isLowEnd ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  var dprFloorByTier = { low: 1, med: 1.5, high: 2 };
  function renderDprCap() {
    var want = Math.min(window.devicePixelRatio || 1, dprFloorByTier[tier] || 2);
    return Math.min(bootDprCap, want);
  }

  function resize() {
    resizeRafId = 0;
    viewW = window.innerWidth || 1;
    viewH = window.innerHeight || 1;
    camera.aspect = viewW / viewH;
    camera.updateProjectionMatrix();
    renderer.setSize(viewW, viewH, false);
    renderer.setPixelRatio(renderDprCap());
    if (smokeEnabled) {
      /* Perf: smoke noise is rendered at half the canvas's device-pixel
         resolution, then upscaled by the GPU when composited — the FBM
         noise has no fine detail that benefits from full res.
         uRes only changes on resize — set it here, not every frame in tick(). */
      var rtDpr = Math.min(window.devicePixelRatio || 1, 2) * (smokeQuarterRes ? 0.25 : 0.5);
      var rtW = Math.max(2, Math.round(viewW * rtDpr));
      var rtH = Math.max(2, Math.round(viewH * rtDpr));
      smokeRT.setSize(rtW, rtH);
      smokeMat.uniforms.uRes.value.set(rtW, rtH);
    }
  }

  function scheduleResize() {
    if (!resizeRafId) {
      resizeRafId = requestAnimationFrame(resize);
    }
  }

  /* ═════════════════════════════════════════════════════════ */
  /* FOG TRANSITION                                            */
  /* ═════════════════════════════════════════════════════════ */

  var fogColorLight = new THREE.Color(paperColor);
  var fogColorDark = new THREE.Color(0x121A26);

  function sectionDarkness(section, progress, fade) {
    if (!section || !(section.atmosphereDark || section.dark)) return 0;
    var start = Number.isFinite(section.start) ? section.start : 0;
    var end = Number.isFinite(section.end) ? section.end : 1;
    if (progress < start - fade || progress > end + fade) return 0;
    if (start > 0 && progress < start + fade) return Math.max(0, Math.min(1, (progress - (start - fade)) / (fade * 2)));
    if (end < 1 && progress > end - fade) return Math.max(0, Math.min(1, ((end + fade) - progress) / (fade * 2)));
    return 1;
  }

  function updateAtmosphere(progress) {
    var darkness = 0;
    var fade = 0.025;
    if (sectionManifest.length) {
      sectionManifest.forEach(function (section) {
        darkness = Math.max(darkness, sectionDarkness(section, progress, fade));
      });
    } else {
      darkness = Math.max(darkness, sectionDarkness(activeSection, progress, fade));
    }
    scene.fog.color.lerpColors(fogColorLight, fogColorDark, darkness);

    /* Boost node opacity during dark sections so colored nodes glow through
       the semi-transparent dark panels (darkness: 0=light, 1=dark section) */
    var baseSpOp = 0.96;
    var baseBxOp = 0.82;
    var baseHaOp = 0.74;
    /* The lattice rises in rather than popping to full strength. Multiplied
       here — the single place these three opacities are written — so the morph
       never has to fight this per-frame write. Resolves to 1 and stays there.
       The floor is high because the plate substrate sits at 0.12 over the top
       of all of this; anything dimmer and the mesh reads as page texture
       rather than as a structure. */
    var m = 0.84 + 0.16 * morphT;
    sphereMat.opacity = (baseSpOp + (1.0 - baseSpOp) * darkness * 0.7) * m;
    boxMat.opacity    = (baseBxOp + (1.0 - baseBxOp) * darkness * 0.6) * m;
    haloMat.opacity   = (baseHaOp + (1.0 - baseHaOp) * darkness * 0.5) * m;
  }

  /* ═════════════════════════════════════════════════════════ */
  /* RENDER LOOP                                               */
  /* ═════════════════════════════════════════════════════════ */

  var running = false;
  var rafId = 0;
  var useGsapTicker = !!(window.gsap && window.gsap.ticker);
  var lastRender = 0;
  var frameInterval = tier === 'low' ? 33 : tier === 'med' ? 20 : 16; // ~30 / ~50 / ~60fps caps

  /* Live-adjustable on a devicetierchange event, without recreating the
     WebGL context: render cadence, smoke cost, and render pixel ratio
     (downward only — see renderDprCap). NOT live-adjustable:
     particle/pulse instance counts (baked into fixed-size THREE.js
     geometry at init) and antialias/powerPreference (constructor options —
     these do require a new context) — those stay pinned to the tier this
     module booted with. */
  function handleDeviceTierChange(e) {
    var t = e.detail && e.detail.tier;
    if (!t) return;
    tier = t;
    frameInterval = tier === 'low' ? 33 : tier === 'med' ? 20 : 16;
    smokeEnabled = tier !== 'low';
    smokeQuarterRes = tier === 'med';
    smokeFrameSkip = tier === 'med';
    /* Re-run resize() so the new state is applied: the smoke render target's
       smokeQuarterRes resolution, the render pixel ratio for the new tier,
       and — critically — sizing the target the first time smoke turns on after
       booting in 'low' (that setSize lives behind `if (smokeEnabled)`). */
    resize();
  }
  window.addEventListener('devicetierchange', handleDeviceTierChange);

  function tick(now) {
    if (!running) return;
    if (useGsapTicker) now *= 1000;
    if (!useGsapTicker) rafId = requestAnimationFrame(tick);
    if (now - lastRender < frameInterval) return;
    lastRender = now;

    scrollProgress += (targetProgress - scrollProgress) * 0.08;

    /* Camera position on path */
    var clamped = Math.max(0, Math.min(0.999, scrollProgress));
    var pathPos = cameraPath.getPointAt(clamped);
    var lookAheadT = Math.min(clamped + lookAheadDelta, 0.999);
    var lookAt = cameraPath.getPointAt(lookAheadT);
    if (clamped >= 0.96) {
      var tangent = cameraPath.getTangentAt(clamped);
      var tangentLook = pathPos.clone().addScaledVector(tangent, 1.5);
      var blend = (clamped - 0.96) / 0.039;
      lookAt.lerp(tangentLook, Math.min(1, blend));
    }

    var offsetX = mouse.x * 0.8;
    var offsetY = mouse.y * -0.5;

    camera.position.x += (pathPos.x + offsetX - camera.position.x) * 0.06;
    camera.position.y += (pathPos.y + offsetY - camera.position.y) * 0.06;
    camera.position.z += (pathPos.z - camera.position.z) * 0.06;
    camera.lookAt(lookAt.x + offsetX * 0.3, lookAt.y + offsetY * 0.3, lookAt.z);

    /* Fog */
    var baseFog = isSmall ? 0.026 : 0.018;
    var deepFog = isSmall ? 0.012 : 0.008;
    scene.fog.density = baseFog + (deepFog - baseFog) * scrollProgress;
    updateAtmosphere(scrollProgress);

    /* Network rotation */
    networkGroup.rotation.y = -Math.PI / 8 + mouse.x * 0.08 + scrollProgress * 0.3;
    networkGroup.rotation.x = Math.PI / 14 + mouse.y * 0.04;

    /* Hero framing hands back to the camera path as the descent starts. */
    var frameFade = 1 - Math.min(1, scrollProgress / HERO_FRAME_FADE);
    networkGroup.position.x = HERO_FRAME_X * frameFade;
    networkGroup.position.y = HERO_FRAME_Y * frameFade;

    /* Boot morph — runs before the pulse pass so pulseInstanced.visible is
       already correct for this frame. No-op once resolved. */
    stepMorph();

    /* Pulses — update InstancedMesh matrices */
    var pulseNeedsUpdate = false;
    pulses.forEach(function (pulse, idx) {
      pulse.prog += pulse.speed;
      if (pulse.prog >= 1) {
        pulse.layer++;
        if (pulse.layer >= layers.length - 1) pulse.layer = 0;
        pulse.prog = 0;
        pulse.src = pulse.tgt;
        var nl = layers[pulse.layer + 1].nodes;
        pulse.tgt = nl[Math.floor(Math.random() * nl.length)];
      }
      dummy.position.lerpVectors(pulse.src.position, pulse.tgt.position, pulse.prog);
      var sc = 1 + 0.2 * Math.sin(now * 0.006 + idx);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      pulseInstanced.setMatrixAt(idx, dummy.matrix);
      pulseNeedsUpdate = true;
    });
    if (pulseNeedsUpdate) pulseInstanced.instanceMatrix.needsUpdate = true;

    /* Particles — drift speed and ambient hue react to the active section's
       discipline (seg), riding on top of the existing dark/light fade. */
    var motion = segmentMotion(activeSection && activeSection.seg);
    particles.rotation.y -= 0.0006 * motion.driftMul;
    particles.rotation.x += 0.0002 * motion.driftMul;
    particles.material.color.copy(particlesBaseColor).offsetHSL(motion.hueShift, 0, 0);

    renderer.render(scene, camera);

    /* Smoke shader — rendered in a second pass to a small offscreen target,
       then composited over the main scene at canvas resolution. Skipped
       entirely on isLowEnd (see smokeEnabled above). */
    if (smokeEnabled) {
      smokeFrameToggle = !smokeFrameToggle;
      if (!smokeFrameSkip || smokeFrameToggle) {
        smokeMat.uniforms.uTime.value = now * 0.001;
        smokeMat.uniforms.uMouse.value.copy(shaderMouse);
        smokeMat.uniforms.uScroll.value = scrollProgress;

        renderer.setRenderTarget(smokeRT);
        renderer.clear();
        renderer.render(smokeScene, smokeCamera);
        renderer.setRenderTarget(null);
      }
      /* Composite every frame even on the skipped-update frames — the
         render target still holds last frame's texture, so this reuses
         it instead of leaving a blank gap. */
      renderer.autoClear = false;
      renderer.render(overlayScene, smokeCamera);
      renderer.autoClear = true;
    }
  }

  function start() {
    /* document.hidden is checked here, not only in the visibilitychange
       handler: that event never fires for a document that was already hidden
       when it loaded, so a background tab would otherwise run the full render
       loop — and burn the boot morph — with nobody watching. */
    if (running || disposed || document.hidden) return;
    running = true;
    lastRender = 0;
    if (useGsapTicker) window.gsap.ticker.add(tick);
    else rafId = requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    if (useGsapTicker) window.gsap.ticker.remove(tick);
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  }
  function disposeObject(obj) {
    if (!obj) return;
    if (obj.geometry && obj.geometry.dispose) obj.geometry.dispose();
    if (obj.material) {
      var materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach(function (mat) {
        if (!mat) return;
        Object.keys(mat).forEach(function (key) {
          var value = mat[key];
          if (value && value.isTexture && value.dispose) value.dispose();
        });
        if (mat.dispose) mat.dispose();
      });
    }
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    if (resizeRafId) {
      cancelAnimationFrame(resizeRafId);
      resizeRafId = 0;
    }
    window.removeEventListener('resize', scheduleResize);
    window.removeEventListener('devicetierchange', handleDeviceTierChange);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    scene.traverse(disposeObject);
    smokeScene.traverse(disposeObject);
    overlayScene.traverse(disposeObject);
    if (smokeRT) smokeRT.dispose();
    renderer.dispose();
    if (window.__neuralSetProgress) window.__neuralSetProgress = function () {};
    if (window.__neuralSetSections) window.__neuralSetSections = function () {};
  }

  /* ═════════════════════════════════════════════════════════ */
  /* INIT                                                      */
  /* ═════════════════════════════════════════════════════════ */

  resize();
  bindInput();

  var initPos = cameraPath.getPointAt(0);
  camera.position.copy(initPos);
  camera.lookAt(cameraPath.getPointAt(lookAheadDelta));

  /* One synchronous frame so the canvas is never blank behind the loader —
     safe to do while hidden, it's a single draw rather than a running loop. */
  renderer.render(scene, camera);
  document.body.classList.add('has-neural-depth');
  start();

  window.addEventListener('resize', scheduleResize, { passive: true });
  function handleVisibilityChange() {
    if (document.hidden) {
      if (!hiddenSince) hiddenSince = nowMs();
      stop();
    } else {
      if (hiddenSince) { hiddenTotal += nowMs() - hiddenSince; hiddenSince = 0; }
      start();
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', dispose, { once: true });
})();
