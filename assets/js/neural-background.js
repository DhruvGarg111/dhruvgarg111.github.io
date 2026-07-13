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
     WebGLRenderer constructor and again in resize() for setPixelRatio —
     both are boot-frozen by design (a new GL context would be needed to
     change them mid-session), so isLowEnd must NOT be reassigned by the
     devicetierchange listener below; only the live-adjustable knobs
     (frameInterval, smokeEnabled/smokeQuarterRes/smokeFrameSkip) react to
     tier changes after boot. */
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
  var sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, depthWrite: false, fog: true });
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
  var boxMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, fog: true });
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
  var haloMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false, fog: true, side: THREE.DoubleSide });
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
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.36, fog: true })
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

  if (arcPoints.length > 0) {
    var arcGeo = new THREE.BufferGeometry();
    arcGeo.setAttribute('position', new THREE.Float32BufferAttribute(arcPoints, 3));
    arcGeo.setAttribute('color', new THREE.Float32BufferAttribute(arcColors, 3));
    networkGroup.add(new THREE.LineSegments(arcGeo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.52, fog: true })
    ));
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
    size: 0.04, color: 0x968D7B, transparent: true, opacity: 0.75, depthWrite: false, fog: true,
  }));
  /* Base hue for the per-section hueShift nudge (see SEGMENT_MOTION). Copied
     from — never mutated in place — so the offset can't accumulate. */
  var particlesBaseColor = particles.material.color.clone();
  scene.add(particles);

  /* Network tilt */
  networkGroup.rotation.x = Math.PI / 14;
  networkGroup.rotation.y = -Math.PI / 8;

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

  function resize() {
    resizeRafId = 0;
    viewW = window.innerWidth || 1;
    viewH = window.innerHeight || 1;
    camera.aspect = viewW / viewH;
    camera.updateProjectionMatrix();
    renderer.setSize(viewW, viewH, false);
    renderer.setPixelRatio(isLowEnd ? 1 : Math.min(window.devicePixelRatio || 1, 2));
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
    var baseSpOp = 0.82;
    var baseBxOp = 0.60;
    var baseHaOp = 0.55;
    sphereMat.opacity = baseSpOp + (1.0 - baseSpOp) * darkness * 0.7;
    boxMat.opacity    = baseBxOp + (1.0 - baseBxOp) * darkness * 0.6;
    haloMat.opacity   = baseHaOp + (1.0 - baseHaOp) * darkness * 0.5;
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
     WebGL context: render cadence and smoke cost. NOT live-adjustable:
     particle/pulse instance counts (baked into fixed-size THREE.js
     geometry at init) and antialias/DPR (require a new context) — those
     stay pinned to the tier this module booted with. A mid-session
     downgrade still meaningfully reduces cost via cadence + smoke alone. */
  function handleDeviceTierChange(e) {
    var t = e.detail && e.detail.tier;
    if (!t) return;
    tier = t;
    frameInterval = tier === 'low' ? 33 : tier === 'med' ? 20 : 16;
    smokeEnabled = tier !== 'low';
    smokeQuarterRes = tier === 'med';
    smokeFrameSkip = tier === 'med';
    /* Re-run resize() so the smoke render target is (re)sized for the new
       state: it applies the new smokeQuarterRes resolution, and — critically —
       sizes the target the first time smoke turns on after booting in 'low'
       (the setSize call lives behind `if (smokeEnabled)` in resize()). */
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
    if (running || disposed) return;
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

  renderer.render(scene, camera);
  document.body.classList.add('has-neural-depth');
  start();

  window.addEventListener('resize', scheduleResize, { passive: true });
  function handleVisibilityChange() { if (document.hidden) stop(); else start(); }
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', dispose, { once: true });
})();
