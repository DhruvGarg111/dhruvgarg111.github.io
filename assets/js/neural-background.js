/**
 * Neural Background v8 — Performance-Optimised
 *
 * Uses InstancedMesh + merged geometries to reduce draw calls from ~220 to ~10.
 * Camera on CatmullRomCurve3 driven by scroll progress.
 *
 * Exposed: window.__neuralSetProgress(0-1)
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

  /* Hardware detection */
  var cores = navigator.hardwareConcurrency || 4;
  var isLowEnd = cores <= 4 || isSmall;

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
  smokeMesh.position.set(0, 0, -1);
  smokeMesh.renderOrder = 10;
  camera.add(smokeMesh);
  scene.add(camera);

  /* ═════════════════════════════════════════════════════════ */
  /* COLORS & SHARED GEOMETRY                                  */
  /* ═════════════════════════════════════════════════════════ */

  /* Color palette matched to design system tokens */
  var colorPalette = {
    cyan:   new THREE.Color(0x6CB4C4),   // slate-blue-light
    blue:   new THREE.Color(0x3D72A4),   // datum blue
    orange: new THREE.Color(0xC45C26),   // survey terracotta
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

  var maxPulses = isLowEnd ? 8 : 18;
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

  var pCount = isLowEnd ? 80 : 250;
  var pPos = new Float32Array(pCount * 3);
  for (var pp = 0; pp < pPos.length; pp++) pPos[pp] = (Math.random() - 0.5) * 50;
  var pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  var particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.04, color: 0x968D7B, transparent: true, opacity: 0.75, depthWrite: false, fog: true,
  }));
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
  var viewW = window.innerWidth;
  var viewH = window.innerHeight;
  var resizeRafId = 0;
  var disposed = false;

  window.__neuralSetProgress = function (p) { targetProgress = Math.max(0, Math.min(1, p)); };

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
    var fov = (camera.fov * Math.PI) / 180;
    var ph = 2 * Math.tan(fov / 2);
    smokeMesh.scale.set(ph * camera.aspect, ph, 1);
    renderer.setSize(viewW, viewH, false);
    renderer.setPixelRatio(isLowEnd ? 1 : Math.min(window.devicePixelRatio || 1, 2));
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

  function updateAtmosphere(progress) {
    var darkness = 0;
    if (progress > 0.24 && progress < 0.38) {
      var t = 0;
      if (progress < 0.28) t = (progress - 0.24) / 0.04;
      else if (progress > 0.34) t = 1 - (progress - 0.34) / 0.04;
      else t = 1;
      darkness = Math.max(darkness, Math.max(0, Math.min(1, t)));
    }
    if (progress > 0.52 && progress < 0.65) {
      var t2 = 0;
      if (progress < 0.56) t2 = (progress - 0.52) / 0.04;
      else if (progress > 0.61) t2 = 1 - (progress - 0.61) / 0.04;
      else t2 = 1;
      darkness = Math.max(darkness, Math.max(0, Math.min(1, t2)));
    }
    if (progress > 0.93) {
      darkness = Math.max(darkness, Math.min(1, (progress - 0.93) / 0.04));
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
  var frameInterval = isLowEnd ? 33 : 16;

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

    /* Particles */
    particles.rotation.y -= 0.0006;
    particles.rotation.x += 0.0002;

    /* Smoke shader */
    smokeMat.uniforms.uTime.value = now * 0.001;
    smokeMat.uniforms.uMouse.value.copy(shaderMouse);
    smokeMat.uniforms.uScroll.value = scrollProgress;
    smokeMat.uniforms.uRes.value.set(viewW, viewH);

    renderer.render(scene, camera);
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
    scene.traverse(disposeObject);
    renderer.dispose();
    if (window.__neuralSetProgress) window.__neuralSetProgress = function () {};
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
  document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  window.addEventListener('pagehide', dispose, { once: true });
})();
